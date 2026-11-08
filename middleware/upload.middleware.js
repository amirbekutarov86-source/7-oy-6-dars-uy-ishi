const fs = require('fs')
const multer = require('multer')
const config = require('../utils/config')

fs.mkdirSync(config.uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),

  filename: (req, file, cb) => {
    const ext = config.allowedImages[file.mimetype]
    cb(null, `product-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: config.maxImageSize, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => {
    if (!config.allowedImages[file.mimetype]) {
      return cb(new Error('INVALID_TYPE'))
    }
    cb(null, true)
  },
})


const uploadImage = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') req.uploadError = "Rasm hajmi 2 MB dan oshmasligi kerak"
      else if (err.message === 'INVALID_TYPE') req.uploadError = "Faqat JPG, PNG yoki WEBP rasm yuborish mumkin"
      else req.uploadError = "Rasmni yuklashda xato yuz berdi"
    }
    next()
  })
}

module.exports = { uploadImage }
