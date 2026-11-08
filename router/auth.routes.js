const express = require('express')
const controller = require('../controller/auth.controller')
const { requireGuest } = require('../middleware/auth.middleware')
const { authLimiter } = require('../middleware/limiter.middleware')

const router = express.Router()

router.get('/register', requireGuest, controller.getRegister)
router.post('/register', requireGuest, authLimiter, controller.postRegister)

router.get('/verify', requireGuest, controller.getVerify)
router.post('/verify', requireGuest, authLimiter, controller.postVerify)
router.post('/verify/resend', requireGuest, authLimiter, controller.postResend)

router.get('/login', requireGuest, controller.getLogin)
router.post('/login', requireGuest, authLimiter, controller.postLogin)

router.post('/logout', controller.postLogout)

module.exports = router
