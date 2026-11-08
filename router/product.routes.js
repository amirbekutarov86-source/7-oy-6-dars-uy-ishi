const express = require('express')
const controller = require('../controller/product.controller')
const { requireAuth } = require('../middleware/auth.middleware')
const { uploadImage } = require('../middleware/upload.middleware')

const router = express.Router()


router.param('id', (req, res, next, value) => {
  if (!/^\d+$/.test(value)) {
    return res.status(404).render('error', { status: 404, message: 'Mahsulot topilmadi' })
  }
  next()
})

router.get('/', controller.index)


router.get('/products/add', requireAuth, controller.getAdd)
router.post('/products/add', requireAuth, uploadImage, controller.postAdd)

router.get('/products/:id', controller.single)
router.get('/products/:id/edit', requireAuth, controller.getEdit)
router.post('/products/:id/edit', requireAuth, uploadImage, controller.postEdit)
router.post('/products/:id/delete', requireAuth, controller.postDelete)

module.exports = router
