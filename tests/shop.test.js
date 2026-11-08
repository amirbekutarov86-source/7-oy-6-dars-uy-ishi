
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = path.join(__dirname, '..')
const PORT = 4200
const BASE = `http://localhost:${PORT}`

let passed = 0
let failed = 0
const check = (name, ok, extra = '') => {
  if (ok) {
    passed++
    console.log(`OK    ${name}`)
  } else {
    failed++
    console.log(`XATO  ${name} ${extra}`)
  }
}


const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-dokon-'))
const dataDir = path.join(tmp, 'data')
const uploadDir = path.join(tmp, 'uploads')
fs.cpSync(path.join(root, 'data'), dataDir, { recursive: true })
fs.mkdirSync(uploadDir, { recursive: true })

let logs = ''
const start = (port, extraEnv = {}) => {
  const child = spawn(process.execPath, ['index.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      DATA_DIR: dataDir,
      UPLOAD_DIR: uploadDir,
      AUTH_RATE_LIMIT_MAX: '1000',
      ...extraEnv,
    },
  })
  child.stdout.on('data', (d) => { logs += d.toString() })
  child.stderr.on('data', (d) => { logs += d.toString() })
  return child
}

const waitUp = async (port) => {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/health`)
      if (r.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('server ishga tushmadi')
}


class Browser {
  constructor(base = BASE) {
    this.base = base
    this.cookies = {}
  }

  async go(method, url, { form, multipart } = {}) {
    const opts = { method, redirect: 'manual', headers: {} }
    const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ')
    if (cookie) opts.headers.cookie = cookie
    if (form) {
      opts.headers['content-type'] = 'application/x-www-form-urlencoded'
      opts.body = new URLSearchParams(form).toString()
    }
    if (multipart) opts.body = multipart

    const res = await fetch(this.base + url, opts)
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';')
      const i = pair.indexOf('=')
      const name = pair.slice(0, i)
      const value = pair.slice(i + 1)
      if (!value || /expires=Thu, 01 Jan 1970/i.test(line)) delete this.cookies[name]
      else this.cookies[name] = value
    }

    const isHtml = (res.headers.get('content-type') || '').includes('text/html')
    const text = isHtml ? await res.text() : ((await res.arrayBuffer()), '')
    return {
      status: res.status,
      text,
      location: res.headers.get('location'),
      setCookie: res.headers.getSetCookie(),
    }
  }

  get(url) { return this.go('GET', url) }
  post(url, form) { return this.go('POST', url, { form }) }
}


const lastCode = (email) => {
  const re = new RegExp(`VERIFY_CODE ${email.replace(/[.+]/g, '\\$&')} (\\d{6})`, 'g')
  let m
  let code
  while ((m = re.exec(logs))) code = m[1]
  return code
}

// 1x1 haqiqiy PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const productForm = (fields, file) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  if (file) fd.append('image', new Blob([file.data], { type: file.type }), file.name)
  return fd
}

const uploadCount = () => fs.readdirSync(uploadDir).filter((f) => !f.startsWith('.')).length
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const run = async () => {
  const guest = new Browser()

  console.log('\n--- Ochiq sahifalar ---')
  let r = await guest.get('/')
  check('GET / -> 200', r.status === 200)
  check('Products sarlavhasi va Add product tugmasi bor', r.text.includes('Products') && r.text.includes('Add product'))
  check('slayderda 3 ta rasm', (r.text.match(/class="carousel-item/g) || []).length === 3)
  check('birinchi kartochka: Eraser Pro Max (220$)', r.text.includes('Eraser Pro Max') && r.text.includes('220$'))
  check('har bir kartochkada "View more" bor', (r.text.match(/View more/g) || []).length === 8)
  check('1-sahifada 8 ta mahsulot', (r.text.match(/class="card h-100 product-card/g) || []).length === 8)
  check("sahifalash (2 sahifa) ko'rinadi", r.text.includes('page-link') && r.text.includes('?page=2'))
  check('Login va Register havolalari (mehmon uchun)', r.text.includes('href="/login"') && r.text.includes('href="/register"'))

  r = await guest.get('/?page=2')
  check('2-sahifada qolgan mahsulot (Pencil Case)', r.status === 200 && r.text.includes('Pencil Case') && !r.text.includes('Eraser Pro Max'))
  r = await guest.get('/?page=999')
  check('juda katta sahifa raqami xato bermaydi', r.status === 200)
  r = await guest.get('/?page=abc')
  check("noto'g'ri sahifa raqami xato bermaydi", r.status === 200)

  r = await guest.get('/?q=lamp')
  check("qidiruv: lamp -> Desk Lamp topildi, Eraser yo'q", r.text.includes('Desk Lamp') && !r.text.includes('Eraser Pro Max'))
  r = await guest.get('/?q=zzzyyyxxx')
  check("qidiruv: natija yo'q xabari", r.status === 200 && r.text.includes('Mahsulot topilmadi'))
  r = await guest.get('/?q=' + encodeURIComponent('<script>alert(1)</script>'))
  check("XSS: qidiruv so'zi escape qilinadi", r.text.includes('&lt;script&gt;') && !r.text.includes('<script>alert(1)'))

  r = await guest.get('/products/9')
  check('GET /products/9 -> 200, nom va narx', r.status === 200 && r.text.includes('Eraser Pro Max') && r.text.includes('220$'))
  check("mehmonga Edit/Delete tugmalari ko'rinmaydi", !r.text.includes('>Edit<') && !r.text.includes('>Delete<'))
  r = await guest.get('/products/999')
  check('mavjud emas mahsulot -> 404', r.status === 404)
  r = await guest.get('/products/abc')
  check("id harf bo'lsa -> 404", r.status === 404)
  r = await guest.get('/nope')
  check("noma'lum sahifa -> 404", r.status === 404 && r.text.includes('Sahifa topilmadi'))

  for (const f of [
    '/vendor/bootstrap/css/bootstrap.min.css',
    '/vendor/bootstrap/js/bootstrap.bundle.min.js',
    '/css/style.css',
    '/image/one.webp',
    '/image/two.webp',
    '/image/three.webp',
    '/image/four.webp',
    '/image/bg.webp',
    '/image/products/eraser-pro.svg',
  ]) {
    r = await guest.go('GET', f)
    check(`statik fayl: ${f}`, r.status === 200)
  }

  console.log('\n--- Login qilmaganlar ---')
  r = await guest.get('/products/add')
  check("/products/add -> /login ga yo'naltiriladi", r.status === 302 && r.location.startsWith('/login?next='))
  r = await guest.post('/products/add', { title: 'x' })
  check('POST /products/add loginsiz -> /login', r.status === 302 && r.location.startsWith('/login'))
  r = await guest.post('/products/9/delete', {})
  check('POST delete loginsiz -> /login', r.status === 302 && r.location.startsWith('/login'))
  r = await guest.get('/products/9/edit')
  check('edit sahifasi loginsiz -> /login', r.status === 302)

  console.log('\n--- Register ---')
  const A = new Browser()
  r = await A.post('/register', { name: 'D', email: 'abc', password: '123', confirm: '456' })
  check(
    "noto'g'ri ma'lumot -> 400 va xatolar ro'yxati",
    r.status === 400 && r.text.includes('Ism 2 dan 50') && r.text.includes('Email noto') && r.text.includes('Parollar bir xil emas'),
  )
  r = await A.post('/register', { name: 'Dilnoza', email: 'dilnoza@example.com', password: 'parol123', confirm: 'parol123' })
  check("register muvaffaqiyatli -> /verify ga yo'naltiradi", r.status === 302 && r.location.startsWith('/verify?email='))
  await sleep(200)
  const codeA = lastCode('dilnoza@example.com')
  check('tasdiqlash kodi (6 xonali) terminalga yozildi', /^\d{6}$/.test(codeA || ''))
  const users = JSON.parse(fs.readFileSync(path.join(dataDir, 'auth.json'), 'utf8'))
  const rec = users.find((u) => u.email === 'dilnoza@example.com')
  check(
    'bazada parol hash, kod ham hash holatida',
    rec.password.startsWith('$2') && !JSON.stringify(rec).includes(codeA) && rec.verified === false,
  )

  r = await A.get('/verify?email=dilnoza@example.com')
  check("GET /verify -> 200, email ko'rinadi", r.status === 200 && r.text.includes('dilnoza@example.com'))
  r = await A.get('/verify')
  check('emailsiz /verify -> /register', r.status === 302 && r.location === '/register')

  r = await A.post('/register', { name: 'Boshqa', email: 'dilnoza@example.com', password: 'parol123', confirm: 'parol123' })
  check('tasdiqlanmagan akkaunt qayta register -> yangi kod', r.status === 302)
  await sleep(200)
  check('yangi kod berildi', /^\d{6}$/.test(lastCode('dilnoza@example.com') || ''))
  await A.post('/register', { name: 'Dilnoza', email: 'dilnoza@example.com', password: 'parol123', confirm: 'parol123' })
  await sleep(200)
  const codeA3 = lastCode('dilnoza@example.com')

  console.log('\n--- Verify ---')
  r = await A.post('/login', { email: 'dilnoza@example.com', password: 'parol123' })
  check('tasdiqlanmagan akkaunt login qilsa -> /verify', r.status === 302 && r.location.startsWith('/verify'))
  r = await A.post('/login', { email: 'dilnoza@example.com', password: 'xato-parol' })
  check("tasdiqlanmagan akkauntda noto'g'ri parol -> 401", r.status === 401)

  r = await A.post('/verify', { email: 'dilnoza@example.com', code: 'abc' })
  check("kod raqam bo'lmasa -> 400", r.status === 400 && r.text.includes('6 ta raqam'))
  const wrong = codeA3 === '000000' ? '111111' : '000000'
  r = await A.post('/verify', { email: 'dilnoza@example.com', code: wrong })
  check("noto'g'ri kod -> 400 va qolgan urinishlar", r.status === 400 && r.text.includes('Yana 4 ta urinish'))
  r = await A.post('/verify', { email: 'yoq@example.com', code: '123456' })
  check("mavjud bo'lmagan email -> umumiy xabar", r.status === 400 && r.text.includes('Kod noto'))
  r = await A.post('/verify/resend', { email: 'dilnoza@example.com' })
  check('kodni qayta yuborish: 1 daqiqa kutish talab qilinadi', r.status === 302)
  r = await A.get('/verify?email=dilnoza@example.com')
  check("kutish xabari ko'rinadi", r.text.includes('soniyadan keyin'))
  r = await A.post('/verify/resend', { email: 'yoq@example.com' })
  check("resend: mavjud bo'lmagan emailga ham bir xil javob", r.status === 302)

  r = await A.post('/verify', { email: 'dilnoza@example.com', code: codeA3 })
  check("to'g'ri kod -> /login ga yo'naltiradi", r.status === 302 && r.location === '/login')
  r = await A.get('/login')
  check("tasdiqlandi xabari ko'rinadi", r.text.includes('Email tasdiqlandi'))
  r = await A.post('/verify', { email: 'dilnoza@example.com', code: codeA3 })
  check('allaqachon tasdiqlangan akkaunt -> /login', r.status === 302 && r.location === '/login')

  // 5 marta noto'g'ri kiritilsa, kod bloklanadi
  const B = new Browser()
  await B.post('/register', { name: 'Bahrom', email: 'bahrom@example.com', password: 'parol123', confirm: 'parol123' })
  await sleep(200)
  const codeB = lastCode('bahrom@example.com')
  const wrongB = codeB === '000000' ? '111111' : '000000'
  for (let i = 0; i < 5; i++) await B.post('/verify', { email: 'bahrom@example.com', code: wrongB })
  r = await B.post('/verify', { email: 'bahrom@example.com', code: codeB })
  check("5 ta xato urinishdan keyin to'g'ri kod ham qabul qilinmaydi", r.status === 400 && r.text.includes('Urinishlar tugadi'))

  r = await guest.post('/register', { name: 'Ali', email: 'ali@example.com', password: 'parol123', confirm: 'parol123' })
  check("tasdiqlangan email qayta ro'yxatdan o'tmaydi -> 409", r.status === 409 && r.text.includes('allaqachon'))

  console.log('\n--- Login / Logout ---')
  const C = new Browser()
  r = await C.post('/login', { email: 'ali@example.com', password: 'xato' })
  check("noto'g'ri parol -> 401", r.status === 401 && r.text.includes('Email yoki parol noto'))
  r = await C.post('/login', { email: 'yoq@example.com', password: 'xato' })
  check("mavjud bo'lmagan email -> xuddi shu xabar", r.status === 401 && r.text.includes('Email yoki parol noto'))
  r = await C.post('/login', { email: '', password: '' })
  check("bo'sh forma -> 400", r.status === 400)

  r = await C.post('/login', { email: 'ali@example.com', password: 'user123', next: '//evil.com' })
  check("ochiq yo'naltirish (open redirect) bloklanadi: //evil.com -> /", r.status === 302 && r.location === '/')
  const tokenCookie = r.setCookie.find((c) => c.startsWith('token='))
  check('token cookie: HttpOnly va SameSite=Lax', /HttpOnly/i.test(tokenCookie) && /SameSite=Lax/i.test(tokenCookie))
  r = await C.get('/')
  check(
    'login qilgach: "Hi, Ali Valiyev" va Logout ko\'rinadi',
    r.text.includes('Ali Valiyev') && r.text.includes('Logout') && !r.text.includes('href="/register"'),
  )
  check('xush kelibsiz xabari (flash)', r.text.includes('Xush kelibsiz'))
  r = await C.get('/')
  check('flash xabar faqat bir marta chiqadi', !r.text.includes('Xush kelibsiz'))
  r = await C.get('/login')
  check('login qilgan odam /login ga kirsa -> /', r.status === 302 && r.location === '/')
  r = await C.get('/register')
  check('login qilgan odam /register ga kirsa -> /', r.status === 302 && r.location === '/')

  r = await C.post('/logout', {})
  check('logout -> 302 /', r.status === 302 && r.location === '/')
  r = await C.get('/')
  check('logoutdan keyin Login havolasi qaytadi', r.text.includes('href="/login"') && !r.text.includes('Logout'))

  const D = new Browser()
  r = await D.post('/login', { email: 'ali@example.com', password: 'user123', next: '/products/add' })
  check('next parametri ishlaydi (/products/add)', r.status === 302 && r.location === '/products/add')

  const T = new Browser()
  T.cookies.token = 'soxta.token.qiymati'
  r = await T.get('/')
  check("soxta token -> mehmon sifatida ko'rsatiladi (xato yo'q)", r.status === 200 && r.text.includes('href="/login"'))

  console.log("\n--- Mahsulot qo'shish ---")
  r = await A.post('/login', { email: 'dilnoza@example.com', password: 'parol123' })
  check('Dilnoza login qildi', r.status === 302 && r.location === '/')
  r = await A.get('/products/add')
  check('GET /products/add -> forma', r.status === 200 && r.text.includes('name="title"') && r.text.includes('name="image"'))

  r = await A.go('POST', '/products/add', { multipart: productForm({ title: 'x', description: '', price: '-5', category: '' }) })
  check("noto'g'ri forma -> 400 va xatolar", r.status === 400 && r.text.includes('Nomi 2 dan 80') && r.text.includes('Narx 0 dan'))
  r = await A.go('POST', '/products/add', { multipart: productForm({ title: 'Test', description: 'Tavsif', price: 'abc' }) })
  check("narx harf bo'lsa -> 400", r.status === 400 && r.text.includes('Narx son'))

  let before = uploadCount()
  r = await A.go('POST', '/products/add', { multipart: productForm({ title: 'Rasmsiz mahsulot', description: 'Rasm yuklanmagan', price: '12,5', category: 'Test' }) })
  check("rasmsiz qo'shildi -> mahsulot sahifasiga yo'naltirildi", r.status === 302 && /^\/products\/\d+$/.test(r.location))
  const noImgUrl = r.location
  r = await A.get(noImgUrl)
  check("narx vergul bilan (12,5) -> 12.5$ ; rasm o'rnida placeholder", r.text.includes('12.5$') && r.text.includes('placeholder.svg'))
  check("qo'shildi xabari va Edit/Delete tugmalari (egasi)", r.text.includes('Mahsulot qo&#39;shildi') && r.text.includes('>Edit<') && r.text.includes('>Delete<'))

  r = await A.go('POST', '/products/add', {
    multipart: productForm({ title: 'Rasmli mahsulot', description: 'Rasm bilan', price: '99.99', category: 'Test' }, { data: PNG, type: 'image/png', name: 'x.png' }),
  })
  check("PNG bilan qo'shildi", r.status === 302)
  const withImgUrl = r.location
  r = await A.get(withImgUrl)
  const imgMatch = r.text.match(/src="(\/image\/uploads\/product-[^"]+\.png)"/)
  check("yuklangan rasm sahifada ko'rinadi", !!imgMatch)
  const imgRes = await fetch(BASE + imgMatch[1])
  check('yuklangan rasm serverdan olinadi (image/png)', imgRes.status === 200 && imgRes.headers.get('content-type').includes('image/png'))
  check('rasm uploads papkasiga saqlandi', uploadCount() === before + 1)
  const uploadedFile = imgMatch[1]

  before = uploadCount()
  r = await A.go('POST', '/products/add', {
    multipart: productForm({ title: 'Soxta', description: 'Soxta rasm', price: '5' }, { data: Buffer.from('bu rasm emas, oddiy matn'), type: 'image/png', name: 'soxta.png' }),
  })
  check('soxta rasm (mimetype png, ichi matn) -> 400', r.status === 400 && r.text.includes('haqiqiy rasm emas'))
  await sleep(150)
  check("soxta fayl diskdan o'chirildi", uploadCount() === before)

  r = await A.go('POST', '/products/add', {
    multipart: productForm({ title: 'Matn', description: 'Matn fayl', price: '5' }, { data: Buffer.from('salom'), type: 'text/plain', name: 'a.txt' }),
  })
  check("rasm bo'lmagan fayl turi -> 400", r.status === 400 && r.text.includes('Faqat JPG, PNG yoki WEBP'))

  const big = Buffer.concat([PNG, Buffer.alloc(2.2 * 1024 * 1024)])
  r = await A.go('POST', '/products/add', {
    multipart: productForm({ title: 'Katta', description: 'Katta fayl', price: '5' }, { data: big, type: 'image/png', name: 'big.png' }),
  })
  check('2 MB dan katta rasm -> 400', r.status === 400 && r.text.includes('2 MB'))
  await sleep(150)
  check('katta fayl diskda qolmadi', uploadCount() === before)

  r = await A.go('POST', '/products/add', {
    multipart: productForm({ title: '<img src=x onerror=alert(1)>', description: '<script>alert(2)</script>', price: '1' }),
  })
  check('XSS nomli mahsulot qabul qilinadi', r.status === 302)
  r = await A.get(r.location)
  check(
    'XSS: nom va tavsif escape qilinadi',
    r.text.includes('&lt;img src=x onerror=alert(1)&gt;') && !r.text.includes('<img src=x onerror') && !r.text.includes('<script>alert(2)'),
  )
  r = await A.get('/')
  check('yangi mahsulotlar bosh sahifada birinchi chiqadi', r.text.indexOf('&lt;img') !== -1 && r.text.indexOf('&lt;img') < r.text.indexOf('Eraser Pro Max'))

  console.log("\n--- Tahrirlash va o'chirish (ruxsatlar) ---")
  const myId = withImgUrl.split('/').pop()
  r = await A.get(`/products/${myId}/edit`)
  check('egasi: edit formasi eski qiymatlar bilan', r.status === 200 && r.text.includes('Rasmli mahsulot') && r.text.includes('99.99'))
  r = await A.go('POST', `/products/${myId}/edit`, { multipart: productForm({ title: 'Yangi nom', description: 'Yangi tavsif', price: '50', category: 'Yangi' }) })
  check('egasi: yangilash -> 302', r.status === 302 && r.location === `/products/${myId}`)
  r = await A.get(`/products/${myId}`)
  check("o'zgarish ko'rinadi, rasm saqlanib qoldi", r.text.includes('Yangi nom') && r.text.includes('50$') && r.text.includes(uploadedFile))

  r = await A.go('POST', `/products/${myId}/edit`, { multipart: productForm({ title: '', description: '', price: '1' }) })
  check("edit: noto'g'ri forma -> 400", r.status === 400)

  before = uploadCount()
  r = await A.go('POST', `/products/${myId}/edit`, {
    multipart: productForm({ title: 'Yangi nom', description: 'Yangi tavsif', price: '50' }, { data: PNG, type: 'image/png', name: 'new.png' }),
  })
  check('edit: yangi rasm yuklandi', r.status === 302)
  await sleep(200)
  check("edit: eski rasm o'chdi, yangisi qoldi (fayllar soni o'zgarmadi)", uploadCount() === before)
  r = await A.get(`/products/${myId}`)
  check("edit: rasm yo'li yangilandi", r.text.includes('/image/uploads/product-') && !r.text.includes(uploadedFile))
  const newImg = r.text.match(/src="(\/image\/uploads\/product-[^"]+\.png)"/)[1]

  // boshqa foydalanuvchi (Ali, oddiy user)
  const ali = new Browser()
  await ali.post('/login', { email: 'ali@example.com', password: 'user123' })
  r = await ali.get(`/products/${myId}`)
  check("boshqa foydalanuvchiga Edit/Delete ko'rinmaydi", r.status === 200 && !r.text.includes('>Edit<') && !r.text.includes('>Delete<'))
  r = await ali.get(`/products/${myId}/edit`)
  check('boshqa foydalanuvchi edit formasini ocha olmaydi -> 403', r.status === 403)
  r = await ali.go('POST', `/products/${myId}/edit`, { multipart: productForm({ title: 'Hack', description: 'Hack hack', price: '1' }) })
  check("boshqa foydalanuvchi o'zgartira olmaydi -> 403", r.status === 403)
  r = await ali.post(`/products/${myId}/delete`, {})
  check("boshqa foydalanuvchi o'chira olmaydi -> 403", r.status === 403)
  r = await ali.get(`/products/${myId}`)
  check("hujumdan keyin mahsulot o'zgarmagan", r.text.includes('Yangi nom') && !r.text.includes('Hack'))
  r = await ali.get('/products/9/edit')
  check("Ali admin yaratgan mahsulotni ham o'zgartira olmaydi -> 403", r.status === 403)

  // admin
  const admin = new Browser()
  await admin.post('/login', { email: 'admin@dokon.uz', password: 'admin123' })
  r = await admin.get('/')
  check('admin: navbarda "admin" belgisi', r.text.includes('>admin<'))
  r = await admin.get(`/products/${myId}`)
  check("admin: boshqaning mahsulotida Edit/Delete ko'rinadi", r.text.includes('>Edit<') && r.text.includes('>Delete<'))
  r = await admin.go('POST', `/products/${myId}/edit`, { multipart: productForm({ title: 'Admin tahriri', description: 'Admin yozdi', price: '77' }) })
  check("admin: boshqaning mahsulotini o'zgartira oladi", r.status === 302)

  // o'chirish
  r = await A.post(`/products/${myId}/delete`, {})
  check("egasi o'chirdi -> 302 /", r.status === 302 && r.location === '/')
  r = await A.get(`/products/${myId}`)
  check("o'chirilgan mahsulot -> 404", r.status === 404)
  await sleep(200)
  const gone = await fetch(BASE + newImg)
  check("o'chirilgan mahsulotning rasmi ham o'chdi", gone.status === 404)
  r = await A.post(`/products/${myId}/delete`, {})
  check("allaqachon o'chirilganni qayta o'chirish -> 404", r.status === 404)
  r = await admin.post(`/products/${noImgUrl.split('/').pop()}/delete`, {})
  check("admin boshqaning mahsulotini o'chira oladi", r.status === 302)

  r = await A.post('/products/9/delete', {})
  check("oddiy foydalanuvchi admin mahsulotini o'chira olmaydi -> 403", r.status === 403)
  r = await admin.post('/products/9/delete', {})
  check(
    "admin seed mahsulotni o'chirdi, tayyor rasm fayli saqlanib qoldi",
    r.status === 302 && (await fetch(BASE + '/image/products/eraser-pro.svg')).status === 200,
  )

  await A.post('/logout', {})
  r = await A.get('/products/add')
  check('logoutdan keyin himoyalangan sahifa yopiq', r.status === 302)

  console.log('\n--- Cheklov (rate limit) ---')
  const limited = start(PORT + 1, { AUTH_RATE_LIMIT_MAX: '3' })
  try {
    await waitUp(PORT + 1)
    const L = new Browser(`http://localhost:${PORT + 1}`)
    const codes = []
    for (let i = 0; i < 5; i++) codes.push((await L.post('/login', { email: 'ali@example.com', password: 'xato' })).status)
    check("3 ta urinishdan keyin 429 (juda ko'p urinish)", codes.slice(0, 3).every((c) => c === 401) && codes[3] === 429 && codes[4] === 429, JSON.stringify(codes))
  } finally {
    limited.kill()
  }

  check("serverda kutilmagan xato bo'lmadi", !/Kutilmagan xato|Unhandled|Uncaught/.test(logs), logs.split('\n').filter((l) => /xato|Unhandled|Uncaught/i.test(l)).slice(0, 3).join(' | '))
}


const server = start(PORT)
;(async () => {
  try {
    await waitUp(PORT)
    await run()
  } catch (err) {
    failed++
    console.error("SINOV TO'XTADI:", err)
  } finally {
    server.kill()
    fs.rmSync(tmp, { recursive: true, force: true })
    console.log(`\nNatija: ${passed} ta o'tdi, ${failed} ta xato`)
    process.exit(failed ? 1 : 0)
  }
})()
