const fs = require('fs')
const path = require('path')
const config = require('./config')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const safeNext = (value) => {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role })

const truncate = (text, max = 60) => {
  const str = String(text ?? '')
  return str.length > max ? str.slice(0, max).trimEnd() + '...' : str
}

const formatPrice = (price) => `${Number(price)}$`

const validateRegister = (body) => {
  const errors = []
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const confirm = String(body.confirm ?? '')

  if (name.length < 2 || name.length > 50) errors.push("Ism 2 dan 50 tagacha belgi bo'lishi kerak")
  if (!EMAIL_RE.test(email) || email.length > 100) errors.push("Email noto'g'ri formatda (masalan: ali@example.com)")
  if (password.length < 6 || password.length > 100) errors.push("Parol kamida 6 ta belgi bo'lishi kerak")
  if (password !== confirm) errors.push('Parollar bir xil emas')

  return { errors, value: { name, email, password } }
}

const validateProduct = (body) => {
  const errors = []
  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()
  const category = String(body.category ?? '').trim()
  const price = Math.round(Number(String(body.price ?? '').replace(',', '.')) * 100) / 100

  if (title.length < 2 || title.length > 80) errors.push("Nomi 2 dan 80 tagacha belgi bo'lishi kerak")
  if (description.length < 2 || description.length > 1000) errors.push("Tavsif 2 dan 1000 tagacha belgi bo'lishi kerak")
  if (!Number.isFinite(price) || String(body.price ?? '').trim() === '') errors.push("Narx son bo'lishi kerak")
  else if (price < 0 || price > 1000000) errors.push("Narx 0 dan 1 000 000 gacha bo'lishi kerak")
  if (category.length > 40) errors.push("Kategoriya 40 ta belgidan oshmasligi kerak")

  return { errors, value: { title, description, category, price } }
}

const isRealImage = (filePath) => {
  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(12)
    fs.readSync(fd, buf, 0, 12, 0)
    fs.closeSync(fd)

    const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    const png = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    const webp = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP'
    return jpg || png || webp
  } catch {
    return false
  }
}

const removeUploaded = (imageUrl) => {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/image/uploads/')) return
  const file = path.join(config.uploadDir, path.basename(imageUrl))
  fs.rm(file, { force: true }, () => {})
}

module.exports = {
  safeNext, publicUser, truncate, formatPrice,
  validateRegister, validateProduct, isRealImage, removeUploaded,
}
