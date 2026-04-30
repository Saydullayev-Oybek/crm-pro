# CRM Pro

Mijozlar bilan ishlash uchun zamonaviy CRM tizimi. Node.js, Express va PostgreSQL asosida qurilgan.

## Texnologiyalar

- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL
- **Frontend:** HTML, CSS, JavaScript (vanilla)

## O'rnatish

### 1. Reponi klonlash

```bash
git clone https://github.com/Saydullayev-Oybek/crm-pro.git
cd crm-pro
```

### 2. Dependencylarni o'rnatish

```bash
npm install
```

### 3. `.env` fayl yaratish

Loyiha papkasida `.env` fayl yarating va quyidagilarni yozing:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_db
DB_USER=postgres
DB_PASSWORD=your_password
PORT=3000
```

### 4. PostgreSQL bazasini sozlash

PostgreSQL o'rnatilgan bo'lishi va `.env` dagi ma'lumotlar to'g'ri bo'lishi kerak.

### 5. Serverni ishga tushirish

```bash
# Production
npm start

# Development (nodemon bilan)
npm run dev
```

Brauzerda oching: [http://localhost:3000](http://localhost:3000)

## Xususiyatlar

- Mijozlar ro'yxatini boshqarish
- Buyurtmalar va tranzaksiyalarni kuzatish
- PDF hisobot chiqarish
- Qorong'i interfeys (Dark UI)
- Mobil qurilmalarga moslashgan dizayn

## Loyiha tuzilishi

```
crm-pro/
├── server.js       # Backend server
├── crm.html        # Frontend interfeys
├── package.json    # Dependencies
└── .env            # Muhit o'zgaruvchilari (gitga yuklanmaydi)
```

## Litsenziya

MIT
