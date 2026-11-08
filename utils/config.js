const path = require('path')

const root = path.join(__dirname, '..')
require('dotenv').config({ quiet: true, path: path.join(root, '.env') })

module.exports = {
  root,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 3000,

  dataDir: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data'),
  uploadDir: process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(root, 'public', 'image', 'uploads'),

  jwtSecret: process.env.JWT_SECRET || 'dev-secret-faqat-sinov-uchun',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  cookieMaxAge: 24 * 60 * 60 * 1000,

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || "Mini Do'kon <no-reply@mini-dokon.uz>",
  },

  // Tasdiqlash kodi qoidalari
  verify: { ttlMs: 10 * 60 * 1000, maxAttempts: 5, resendDelayMs: 60 * 1000 },

  pageSize: 8,
  maxImageSize: 2 * 1024 * 1024, // 2 MB
  allowedImages: { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' },

  limits: { auth: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30 },
}
