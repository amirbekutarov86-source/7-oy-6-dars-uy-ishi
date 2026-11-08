# Mini Do'kon (EJS)

Express + EJS asosidagi kichik internet do'kon: slayder, mahsulotlar ro'yxati, bitta mahsulot sahifasi,
mahsulot qo'shish/tahrirlash/o'chirish, ro'yxatdan o'tish va email kodi bilan tasdiqlash.

## Ishga tushirish

```bash
npm install
npm run dev
```

Brauzerda: http://localhost:3000 (port band bo'lsa, server o'zi keyingisini oladi va terminalda yozadi).

## Tayyor akkauntlar

| Email | Parol | Rol |
|---|---|---|
| admin@dokon.uz | admin123 | admin (hamma mahsulotni o'zgartira oladi) |
| ali@example.com | user123 | oddiy foydalanuvchi |

## Tasdiqlash kodi (verify.ejs)

Yangi odam ro'yxatdan o'tganda 6 xonali kod yaratiladi:

- `.env` da SMTP sozlanmagan bo'lsa, kod **serverni ishga tushirgan terminalga** yoziladi.
- SMTP sozlansa (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`), kod emailga yuboriladi.
- Kod 10 daqiqa amal qiladi, 5 marta xato kiritilsa bloklanadi, qayta yuborish 1 daqiqada bir marta.
- Kod bazada hash holatida saqlanadi.

## Papkalar

```
mini-dokon/
├── controller/    auth.controller.js, product.controller.js
├── data/          auth.json, product.json
├── fs/            file-sys.js (read_file, write_file)
├── middleware/    auth, upload (multer), limiter, error
├── public/
│   ├── css/       style.css
│   └── image/     one/two/three/four/bg (.webp), products/ (mahsulot rasmlari), uploads/ (yuklanganlar)
├── router/        auth.routes.js, product.routes.js
├── utils/         config, jwt, mailer, verification, flash, helpers
├── views/         index, single, register, verify, login, product-form, error (.ejs) + partials/
├── tests/         shop.test.js
├── .env
└── index.js
```

## Sahifalar

| Manzil | Sahifa | Kim uchun |
|---|---|---|
| `/` | slayder + Products + Add product + kartochkalar (qidiruv `?q=`, sahifalash `?page=`) | hamma |
| `/products/:id` | bitta mahsulot ("View more") | hamma |
| `/products/add` | mahsulot qo'shish | login qilganlar |
| `/products/:id/edit` | tahrirlash | egasi yoki admin |
| `/register`, `/verify`, `/login` | ro'yxatdan o'tish, tasdiqlash, kirish | mehmonlar |

## Rasmlar

| Fayl | Qayerda ishlatiladi |
|---|---|
| `one.webp` | slayder, 1-slayd |
| `two.webp` | slayder, 2-slayd (tog'lar; yozuv va ramka qirqib tashlangan) |
| `three.webp` | login / register / verify sahifalarining foni |
| `four.webp` | slayder, 3-slayd (yangi, yaratilgan) |
| `bg.webp` | butun sayt foni (yangi, yaratilgan) |
| `products/*.svg` | mahsulot rasmlari |

## Xavfsizlik

- Login cookie'da (JWT), `HttpOnly` va `SameSite=Lax`. Parollar bcrypt bilan hash qilinadi.
- Hamma kiritilgan matn EJS tomonidan escape qilinadi (XSS himoyasi), helmet (CSP) yoqilgan.
- Yuklangan rasm haqiqiy rasm ekani baytlari bo'yicha tekshiriladi (JPG, PNG, WEBP, 2 MB gacha).
- Login/register/verify uchun urinishlar cheklangan (15 daqiqada 30 ta).
- Login'dan keyin yo'naltirishda faqat saytning o'z manzillari qabul qilinadi.

## Sinov

```bash
npm test
```

Server vaqtinchalik ma'lumot papkasi bilan ishga tushadi va 100 dan ortiq tekshiruv o'tkaziladi. Asl `data/` ga tegilmaydi.
