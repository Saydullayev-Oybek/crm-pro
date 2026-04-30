const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// .env faylini o'qish (dotenv o'rnatilmagan bo'lsa ham ishlaydi)
if (fs.existsSync(path.join(__dirname, '.env'))) {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── PostgreSQL ulanish ───────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'crm_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '0121',
});

// ─── Jadvallarni yaratish ─────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id        SERIAL PRIMARY KEY,
      name      VARCHAR(200) NOT NULL,
      phone     VARCHAR(50)  NOT NULL,
      email     VARCHAR(200),
      address   TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(200) NOT NULL,
      price      NUMERIC(15,2) NOT NULL DEFAULT 0,
      qty        INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sales (
      id            SERIAL PRIMARY KEY,
      customer_id   INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_name VARCHAR(200),
      customer_phone VARCHAR(50),
      customer_email VARCHAR(200),
      customer_address TEXT,
      total         NUMERIC(15,2) NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id         SERIAL PRIMARY KEY,
      sale_id    INTEGER REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      name       VARCHAR(200),
      price      NUMERIC(15,2),
      qty        INTEGER
    );
  `);
  console.log('✅ Jadvallar tayyor');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/customers', async (req, res) => {
  const { q } = req.query;
  let sql = 'SELECT * FROM customers';
  const params = [];
  if (q) {
    sql += ' WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1';
    params.push(`%${q}%`);
  }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

app.post('/api/customers', async (req, res) => {
  const { name, phone, email, address } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Ism va telefon majburiy' });
  const { rows } = await pool.query(
    'INSERT INTO customers (name,phone,email,address) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, phone, email||null, address||null]
  );
  res.json(rows[0]);
});

app.put('/api/customers/:id', async (req, res) => {
  const { name, phone, email, address } = req.body;
  const { rows } = await pool.query(
    'UPDATE customers SET name=$1,phone=$2,email=$3,address=$4 WHERE id=$5 RETURNING *',
    [name, phone, email||null, address||null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });
  res.json(rows[0]);
});

app.delete('/api/customers/:id', async (req, res) => {
  await pool.query('DELETE FROM customers WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/products', async (req, res) => {
  const { q } = req.query;
  let sql = 'SELECT * FROM products';
  const params = [];
  if (q) { sql += ' WHERE name ILIKE $1'; params.push(`%${q}%`); }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

app.post('/api/products', async (req, res) => {
  const { name, price, qty } = req.body;
  if (!name || price == null || qty == null) return res.status(400).json({ error: 'Barcha maydonlar kerak' });
  const { rows } = await pool.query(
    'INSERT INTO products (name,price,qty) VALUES ($1,$2,$3) RETURNING *',
    [name, price, qty]
  );
  res.json(rows[0]);
});

app.put('/api/products/:id', async (req, res) => {
  const { name, price, qty } = req.body;
  const { rows } = await pool.query(
    'UPDATE products SET name=$1,price=$2,qty=$3 WHERE id=$4 RETURNING *',
    [name, price, qty, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });
  res.json(rows[0]);
});

app.delete('/api/products/:id', async (req, res) => {
  await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SALES
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/sales', async (req, res) => {
  const { rows: saleRows } = await pool.query('SELECT * FROM sales ORDER BY created_at DESC');
  const { rows: itemRows } = await pool.query('SELECT * FROM sale_items');
  const result = saleRows.map(s => ({
    ...s,
    items: itemRows.filter(i => i.sale_id === s.id)
  }));
  res.json(result);
});

app.post('/api/sales', async (req, res) => {
  const { customerId, items } = req.body;
  if (!customerId || !items?.length) return res.status(400).json({ error: 'Mijoz va mahsulotlar kerak' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [customer] } = await client.query('SELECT * FROM customers WHERE id=$1', [customerId]);
    if (!customer) throw new Error('Mijoz topilmadi');

    // Stok tekshirish va kamaytirish
    for (const item of items) {
      const { rows: [prod] } = await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE', [item.productId]);
      if (!prod) throw new Error(`Mahsulot topilmadi: ${item.productId}`);
      if (prod.qty < item.qty) throw new Error(`"${prod.name}" uchun yetarli miqdor yo'q (${prod.qty} dona bor)`);
      await client.query('UPDATE products SET qty = qty - $1 WHERE id=$2', [item.qty, item.productId]);
    }

    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const { rows: [sale] } = await client.query(
      `INSERT INTO sales (customer_id,customer_name,customer_phone,customer_email,customer_address,total)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [customer.id, customer.name, customer.phone, customer.email||'', customer.address||'', total]
    );

    for (const item of items) {
      await client.query(
        'INSERT INTO sale_items (sale_id,product_id,name,price,qty) VALUES ($1,$2,$3,$4,$5)',
        [sale.id, item.productId, item.name, item.price, item.qty]
      );
    }

    await client.query('COMMIT');

    const { rows: saleItems } = await pool.query('SELECT * FROM sale_items WHERE sale_id=$1', [sale.id]);
    res.json({ ...sale, items: saleItems });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── Dashboard statistikasi ───────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  const [c, p, s] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM customers'),
    pool.query('SELECT COUNT(*) FROM products'),
    pool.query('SELECT COUNT(*), COALESCE(SUM(total),0) AS revenue FROM sales'),
  ]);
  res.json({
    customers: parseInt(c.rows[0].count),
    products:  parseInt(p.rows[0].count),
    sales:     parseInt(s.rows[0].count),
    revenue:   parseFloat(s.rows[0].revenue),
  });
});

// ─── Serverni ishga tushirish ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
initDB()
  .then(() => app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`)))
  .catch(err => { console.error('❌ DB ulanish xatosi:', err.message); process.exit(1); });
