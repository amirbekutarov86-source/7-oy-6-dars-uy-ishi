const path = require('path')
const express = require('express')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')

const config = require('./utils/config')
const { truncate, formatPrice } = require('./utils/helpers')
const { loadUser } = require('./middleware/auth.middleware')
const { notFound, errorHandler } = require('./middleware/error.middleware')
const authRoutes = require('./router/auth.routes')
const productRoutes = require('./router/product.routes')

const app = express()


app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// Shablonlarda ishlatiladigan umumiy qiymatlar
app.locals.appName = "Mini Do'kon"
app.locals.truncate = truncate
app.locals.formatPrice = formatPrice
app.locals.user = null
app.locals.flash = null


app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        objectSrc: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
)


app.use('/image/uploads', express.static(config.uploadDir)) // foydalanuvchi yuklagan rasmlar
app.use('/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')))
app.use(express.static(path.join(__dirname, 'public')))

// ---------- So'rovlarni o'qish ----------
app.use(express.urlencoded({ extended: false, limit: '50kb' }))
app.use(cookieParser())


if (config.nodeEnv !== 'test') {
  app.use((req, res, next) => {
    res.on('finish', () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode}`))
    next()
  })
}

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: Math.round(process.uptime()) }))

app.use(loadUser)
app.use('/', authRoutes)
app.use('/', productRoutes)

app.use(notFound)
app.use(errorHandler)

const MAX_TRIES = 10 
let port = config.port
let tries = 0

const server = app.listen(port)

server.on('listening', () => {
  console.log(`Server ${port}-Portda ishladi`)
  console.log(`http://localhost:${port}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && tries < MAX_TRIES) {
    console.log(`${port}-port band, ${port + 1}-port sinab ko'rilmoqda...`)
    tries++
    port++
    setTimeout(() => server.listen(port), 100)
  } else {
    console.error('Server xatosi:', err.message)
    process.exit(1)
  }
})

const shutdown = () => {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 500)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)


process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err))
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err))
