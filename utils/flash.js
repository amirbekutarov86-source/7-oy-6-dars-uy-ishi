
const TYPES = ['success', 'danger', 'warning', 'info']

const setFlash = (res, type, message) => {
  res.cookie('flash', JSON.stringify({ type, message }), { httpOnly: true, sameSite: 'lax', maxAge: 15000 })
}

const readFlash = (req, res) => {
  const raw = req.cookies.flash
  if (!raw) return null
  res.clearCookie('flash')

  try {
    const flash = JSON.parse(raw)
    if (!flash || typeof flash.message !== 'string') return null
    return { type: TYPES.includes(flash.type) ? flash.type : 'info', message: flash.message.slice(0, 300) }
  } catch {
    return null
  }
}

module.exports = { setFlash, readFlash }
