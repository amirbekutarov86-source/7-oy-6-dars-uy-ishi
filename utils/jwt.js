const jwt = require('jsonwebtoken')
const config = require('./config')

const sign = (user) =>
  jwt.sign({ id: user.id, tv: user.tokenVersion || 0 }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })

const verify = (token) => jwt.verify(token, config.jwtSecret)

module.exports = { sign, verify }
