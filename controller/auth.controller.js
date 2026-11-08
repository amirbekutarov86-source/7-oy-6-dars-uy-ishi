const bcrypt = require('bcryptjs')
const { read_file, write_file, next_id } = require('../fs/file-sys')
const config = require('../utils/config')
const { sign } = require('../utils/jwt')
const { setFlash } = require('../utils/flash')
const { safeNext, validateRegister } = require('../utils/helpers')
const { createVerification, matches } = require('../utils/verification')
const { sendVerificationCode } = require('../utils/mailer')

const USERS = 'auth.json'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/


const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10)

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProd,
  maxAge: config.cookieMaxAge,
}

const cleanEmail = (value) => String(value ?? '').trim().toLowerCase()


const getRegister = (req, res) => {
  res.render('register', { errors: [], form: {} })
}

const postRegister = async (req, res) => {
  const body = req.body || {}
  const { errors, value } = validateRegister(body)
  const form = { name: value.name, email: value.email }

  if (errors.length) return res.status(400).render('register', { errors, form })

  const hash = await bcrypt.hash(value.password, 10)

 
  const users = read_file(USERS)
  const existing = users.find((u) => u.email === value.email)

  if (existing && existing.verified) {
    return res.status(409).render('register', { errors: ["Bu email allaqachon ro'yxatdan o'tgan"], form })
  }

  const id = existing ? existing.id : next_id(users)
  const { code, record } = createVerification(id)

  if (existing) {
  
    Object.assign(existing, { name: value.name, password: hash, verification: record })
  } else {
    users.push({
      id,
      name: value.name,
      email: value.email,
      password: hash,
      role: 'user',
      verified: false,
      tokenVersion: 0,
      verification: record,
      createdAt: new Date().toISOString(),
    })
  }
  write_file(USERS, users)

  const sent = await sendVerificationCode(value.email, value.name, code)
  setFlash(
    res,
    sent ? 'info' : 'warning',
    sent
      ? 'Tasdiqlash kodi yuborildi. Kodni pastga kiriting'
      : "Kodni yuborib bo'lmadi. \"Kodni qayta yuborish\" tugmasini bosing",
  )
  res.redirect(`/verify?email=${encodeURIComponent(value.email)}`)
}


const getVerify = (req, res) => {
  const email = cleanEmail(req.query.email)
  if (!email) return res.redirect('/register')
  res.render('verify', { email, errors: [] })
}

const postVerify = async (req, res) => {
  const body = req.body || {}
  const email = cleanEmail(body.email)
  const code = String(body.code ?? '').trim()

  const fail = (message) => res.status(400).render('verify', { email, errors: [message] })

  if (!EMAIL_RE.test(email)) return res.redirect('/register')
  if (!/^\d{6}$/.test(code)) return fail("Kod 6 ta raqamdan iborat bo'lishi kerak")

  const users = read_file(USERS)
  const user = users.find((u) => u.email === email)


  if (!user) return fail("Kod noto'g'ri yoki muddati tugagan")

  if (user.verified) {
    setFlash(res, 'info', 'Akkaunt allaqachon tasdiqlangan, kirishingiz mumkin')
    return res.redirect('/login')
  }

  const v = user.verification
  if (!v) return fail("Yangi kod so'rang (\"Kodni qayta yuborish\")")
  if (Date.now() > v.expiresAt) return fail("Kod muddati tugagan. Yangi kod so'rang")
  if (v.attempts >= config.verify.maxAttempts) return fail("Urinishlar tugadi. Yangi kod so'rang")

  if (!matches(code, user.id, v.hash)) {
    v.attempts += 1
    write_file(USERS, users)
    const left = config.verify.maxAttempts - v.attempts
    return fail(left > 0 ? `Kod noto'g'ri. Yana ${left} ta urinish qoldi` : "Kod noto'g'ri. Urinishlar tugadi, yangi kod so'rang")
  }

  user.verified = true
  user.verification = null
  write_file(USERS, users)

  setFlash(res, 'success', "Email tasdiqlandi! Endi tizimga kirishingiz mumkin")
  res.redirect('/login')
}

const postResend = async (req, res) => {
  const email = cleanEmail((req.body || {}).email)
  if (!EMAIL_RE.test(email)) return res.redirect('/register')

  const users = read_file(USERS)
  const user = users.find((u) => u.email === email)
  const back = `/verify?email=${encodeURIComponent(email)}`

  if (user && !user.verified) {
    const wait = user.verification ? user.verification.sentAt + config.verify.resendDelayMs - Date.now() : 0
    if (wait > 0) {
      setFlash(res, 'warning', `Yangi kodni ${Math.ceil(wait / 1000)} soniyadan keyin so'rashingiz mumkin`)
      return res.redirect(back)
    }

    const { code, record } = createVerification(user.id)
    user.verification = record
    write_file(USERS, users)
    await sendVerificationCode(user.email, user.name, code)
  }


  setFlash(res, 'info', 'Agar email to\'g\'ri bo\'lsa, yangi kod yuborildi')
  res.redirect(back)
}


const getLogin = (req, res) => {
  res.render('login', { errors: [], form: {}, next: safeNext(req.query.next) || '' })
}

const postLogin = async (req, res) => {
  const body = req.body || {}
  const email = cleanEmail(body.email)
  const password = String(body.password ?? '')
  const next = safeNext(body.next) || ''

  const fail = (message, status = 401) =>
    res.status(status).render('login', { errors: [message], form: { email }, next })

  if (!EMAIL_RE.test(email) || !password) return fail('Email va parolni to\'g\'ri kiriting', 400)

  const users = read_file(USERS)
  const user = users.find((u) => u.email === email)
  const match = await bcrypt.compare(password, user ? user.password : DUMMY_HASH)

  if (!user || !match) return fail("Email yoki parol noto'g'ri")


  if (!user.verified) {
    const canSend = !user.verification || Date.now() - user.verification.sentAt > config.verify.resendDelayMs
    if (canSend) {
      const { code, record } = createVerification(user.id)
      user.verification = record
      write_file(USERS, users)
      await sendVerificationCode(user.email, user.name, code)
    }
    setFlash(res, 'warning', 'Avval emailni tasdiqlang. Kod yuborildi')
    return res.redirect(`/verify?email=${encodeURIComponent(user.email)}`)
  }

  res.cookie('token', sign(user), cookieOptions)
  setFlash(res, 'success', `Xush kelibsiz, ${user.name}!`)
  res.redirect(next || '/')
}

const postLogout = (req, res) => {
  res.clearCookie('token')
  setFlash(res, 'info', 'Tizimdan chiqdingiz')
  res.redirect('/')
}

module.exports = { getRegister, postRegister, getVerify, postVerify, postResend, getLogin, postLogin, postLogout }
