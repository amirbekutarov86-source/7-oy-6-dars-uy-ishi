const { read_file } = require('../fs/file-sys')
const { verify } = require('../utils/jwt')
const { readFlash, setFlash } = require('../utils/flash')
const { publicUser } = require('../utils/helpers')


const loadUser = (req, res, next) => {
  res.locals.user = null
  res.locals.flash = readFlash(req, res)
  res.locals.currentPath = req.path

  const token = req.cookies.token
  if (token) {
    try {
      const payload = verify(token)
      const user = read_file('auth.json').find((u) => u.id === payload.id)

      if (user && user.verified && (user.tokenVersion || 0) === (payload.tv || 0)) {
        req.user = publicUser(user)
        res.locals.user = req.user
      } else {
        res.clearCookie('token')
      }
    } catch {
      res.clearCookie('token')
    }
  }
  next()
}


const requireAuth = (req, res, next) => {
  if (req.user) return next()

  setFlash(res, 'warning', 'Avval tizimga kiring')
  const back = req.method === 'GET' ? `?next=${encodeURIComponent(req.originalUrl)}` : ''
  res.redirect(`/login${back}`)
}


const requireGuest = (req, res, next) => {
  if (req.user) return res.redirect('/')
  next()
}

module.exports = { loadUser, requireAuth, requireGuest }
