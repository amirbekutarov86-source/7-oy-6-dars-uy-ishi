
const notFound = (req, res) => {
  res.status(404).render('error', { status: 404, message: 'Sahifa topilmadi' })
}


const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err)

  const status = err.status || err.statusCode || 500
  let message = 'Serverda xatolik yuz berdi'

  if (status === 400) message = "So'rov noto'g'ri yuborilgan"
  else if (status === 413) message = "Yuborilgan ma'lumot juda katta"
  else if (status < 500 && err.expose) message = err.message

  if (status >= 500) console.error('Kutilmagan xato:', err)

  res.status(status).render('error', { status, message })
}

module.exports = { notFound, errorHandler }
