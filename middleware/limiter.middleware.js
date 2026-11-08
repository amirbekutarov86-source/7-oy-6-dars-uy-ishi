const rateLimit = require('express-rate-limit')
const config = require('../utils/config')


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.limits.auth,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).render('error', {
      status: 429,
      message: "Juda ko'p urinish bo'ldi. 15 daqiqadan keyin qayta urinib ko'ring",
    }),
})

module.exports = { authLimiter }
