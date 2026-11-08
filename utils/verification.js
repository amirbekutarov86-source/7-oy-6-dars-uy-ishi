const crypto = require('crypto')
const config = require('./config')


const generateCode = () => String(crypto.randomInt(100000, 1000000))


const hashCode = (code, userId) =>
  crypto.createHash('sha256').update(`${code}:${userId}:${config.jwtSecret}`).digest('hex')

const matches = (code, userId, storedHash) => {
  const a = Buffer.from(hashCode(code, userId))
  const b = Buffer.from(String(storedHash))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const createVerification = (userId) => {
  const code = generateCode()
  const now = Date.now()
  return {
    code,
    record: { hash: hashCode(code, userId), expiresAt: now + config.verify.ttlMs, attempts: 0, sentAt: now },
  }
}

module.exports = { createVerification, matches }
