const nodemailer = require('nodemailer')
const config = require('./config')

let transporter = null
if (config.smtp.host && config.smtp.user) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  })
}
const sendVerificationCode = async (email, name, code) => {
  if (!transporter) {
    if (config.nodeEnv !== 'test') {
      console.log('')
      console.log('=============== TASDIQLASH KODI ===============')
      console.log(` Email: ${email}`)
      console.log(` Kod:   ${code}   (${config.verify.ttlMs / 60000} daqiqa amal qiladi)`)
      console.log('===============================================')
      console.log('')
    } else {
      console.log(`VERIFY_CODE ${email} ${code}`) // test skripti shuni o'qiydi
    }
    return true
  }

  try {
    await transporter.sendMail({
      from: config.smtp.from,
      to: email,
      subject: "Mini Do'kon: tasdiqlash kodi",
      text: `Salom, ${name}!\n\nTasdiqlash kodingiz: ${code}\nKod ${config.verify.ttlMs / 60000} daqiqa amal qiladi.\n\nAgar bu siz bo'lmasangiz, xabarni e'tiborsiz qoldiring.`,
    })
    return true
  } catch (err) {
    console.error('Email yuborilmadi:', err.message)
    return false
  }
}

module.exports = { sendVerificationCode }
