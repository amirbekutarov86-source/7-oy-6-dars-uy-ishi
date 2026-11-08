const { read_file, write_file, next_id } = require('../fs/file-sys')
const config = require('../utils/config')
const { setFlash } = require('../utils/flash')
const { validateProduct, isRealImage, removeUploaded } = require('../utils/helpers')

const PRODUCTS = 'product.json'
const PLACEHOLDER = '/image/products/placeholder.svg'

const SLIDES = [
  { img: '/image/one.webp', title: "Mini Do'kon", text: "Qulay narxlar va sifatli mahsulotlar" },
  { img: '/image/two.webp', title: 'Yangi mahsulotlar', text: "Har hafta yangi tovarlar qo'shiladi" },
  { img: '/image/four.webp', title: 'Chegirmalar', text: "Tanlangan mahsulotlarga maxsus narxlar" },
]

const canManage = (user, product) => !!user && (user.role === 'admin' || user.id === product.createdBy)

const notFoundPage = (res) => res.status(404).render('error', { status: 404, message: 'Mahsulot topilmadi' })
const forbiddenPage = (res) =>
  res.status(403).render('error', { status: 403, message: "Bu mahsulotni faqat egasi yoki admin o'zgartira oladi" })

const findProduct = (id) => read_file(PRODUCTS).find((p) => p.id === Number(id))

const checkUpload = (req) => {
  if (req.uploadError) return req.uploadError
  if (req.file && !isRealImage(req.file.path)) {
    removeUploaded(`/image/uploads/${req.file.filename}`)
    return "Yuborilgan fayl haqiqiy rasm emas"
  }
  return null
}

const index = (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 60)
  const needle = q.toLowerCase()
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)

  let products = read_file(PRODUCTS).sort((a, b) => b.id - a.id) 
  if (needle) {
    products = products.filter((p) =>
      [p.title, p.description, p.category].some((f) => String(f ?? '').toLowerCase().includes(needle)),
    )
  }

  const total = products.length
  const totalPages = Math.max(1, Math.ceil(total / config.pageSize))
  const current = Math.min(page, totalPages)
  const items = products.slice((current - 1) * config.pageSize, current * config.pageSize)

  res.render('index', { slides: SLIDES, products: items, q, total, page: current, totalPages })
}


const single = (req, res) => {
  const product = findProduct(req.params.id)
  if (!product) return notFoundPage(res)

  const owner = read_file('auth.json').find((u) => u.id === product.createdBy)
  res.render('single', {
    product,
    ownerName: owner ? owner.name : "Noma'lum",
    canManage: canManage(req.user, product),
  })
}

const getAdd = (req, res) => {
  res.render('product-form', { mode: 'add', product: {}, errors: [] })
}

const postAdd = (req, res) => {
  const { errors, value } = validateProduct(req.body || {})
  const uploadError = checkUpload(req)
  if (uploadError) errors.push(uploadError)

  if (errors.length) {
    if (req.file) removeUploaded(`/image/uploads/${req.file.filename}`)
    return res.status(400).render('product-form', { mode: 'add', product: value, errors })
  }

  const products = read_file(PRODUCTS)
  const now = new Date().toISOString()
  const product = {
    id: next_id(products),
    ...value,
    image: req.file ? `/image/uploads/${req.file.filename}` : PLACEHOLDER,
    createdBy: req.user.id,
    createdAt: now,
    updatedAt: now,
  }
  products.push(product)
  write_file(PRODUCTS, products)

  setFlash(res, 'success', "Mahsulot qo'shildi")
  res.redirect(`/products/${product.id}`)
}

const getEdit = (req, res) => {
  const product = findProduct(req.params.id)
  if (!product) return notFoundPage(res)
  if (!canManage(req.user, product)) return forbiddenPage(res)

  res.render('product-form', { mode: 'edit', product, errors: [] })
}

const postEdit = (req, res) => {
  const products = read_file(PRODUCTS)
  const index = products.findIndex((p) => p.id === Number(req.params.id))

  const discard = () => req.file && removeUploaded(`/image/uploads/${req.file.filename}`)

  if (index === -1) {
    discard()
    return notFoundPage(res)
  }
  if (!canManage(req.user, products[index])) {
    discard()
    return forbiddenPage(res)
  }

  const { errors, value } = validateProduct(req.body || {})
  const uploadError = checkUpload(req)
  if (uploadError) errors.push(uploadError)

  if (errors.length) {
    discard()
    return res.status(400).render('product-form', {
      mode: 'edit',
      product: { ...products[index], ...value },
      errors,
    })
  }

  const oldImage = products[index].image
  products[index] = {
    ...products[index],
    ...value,
    image: req.file ? `/image/uploads/${req.file.filename}` : oldImage,
    updatedAt: new Date().toISOString(),
  }
  write_file(PRODUCTS, products)

  if (req.file) removeUploaded(oldImage)

  setFlash(res, 'success', 'Mahsulot yangilandi')
  res.redirect(`/products/${products[index].id}`)
}


const postDelete = (req, res) => {
  const products = read_file(PRODUCTS)
  const index = products.findIndex((p) => p.id === Number(req.params.id))

  if (index === -1) return notFoundPage(res)
  if (!canManage(req.user, products[index])) return forbiddenPage(res)

  const [removed] = products.splice(index, 1)
  write_file(PRODUCTS, products)
  removeUploaded(removed.image)

  setFlash(res, 'success', "Mahsulot o'chirildi")
  res.redirect('/')
}

module.exports = { index, single, getAdd, postAdd, getEdit, postEdit, postDelete }
