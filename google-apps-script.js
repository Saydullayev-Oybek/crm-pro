// ============================================================
// CRM Pro — Google Apps Script (To'liq Backend)
// script.google.com ga joylashtiring
// Deploy: "Execute as: Me" | "Who has access: Anyone"
// ============================================================

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action } = payload;
    const params = Object.assign({}, payload);
    delete params.action;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let result;

    switch (action) {
      case 'stats':             result = getStats(ss);                    break;
      case 'customers.list':    result = listCustomers(ss, params.q);     break;
      case 'customers.create':  result = createCustomer(ss, params);      break;
      case 'customers.update':  result = updateCustomer(ss, params);      break;
      case 'customers.delete':  result = deleteItem(ss, 'Customers', params.id); break;
      case 'products.list':     result = listProducts(ss, params.q);      break;
      case 'products.create':   result = createProduct(ss, params);       break;
      case 'products.update':   result = updateProduct(ss, params);       break;
      case 'products.delete':   result = deleteItem(ss, 'Products', params.id);  break;
      case 'sales.list':        result = listSales(ss);                   break;
      case 'sales.create':      result = createSale(ss, params);          break;
      default: throw new Error('Noma\'lum action: ' + action);
    }

    return json({ ok: true, result });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Sheet yordamchilari ──────────────────────────────────────────────────────

const HEADERS = {
  Customers: ['id', 'name', 'phone', 'email', 'address', 'created_at'],
  Products:  ['id', 'name', 'price', 'qty', 'created_at'],
  Sales:     ['id', 'customer_id', 'customer_name', 'customer_phone', 'customer_email', 'customer_address', 'total', 'created_at'],
  SaleItems: ['id', 'sale_id', 'product_id', 'name', 'price', 'qty'],
};

function getSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headers = HEADERS[name];
    const r = sheet.getRange(1, 1, 1, headers.length);
    r.setValues([headers]);
    r.setFontWeight('bold');
    r.setBackground('#4f8ef7');
    r.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sheetToObjects(ss, name) {
  const sheet = getSheet(ss, name);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function nextId(ss, name) {
  const sheet = getSheet(ss, name);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 1;
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const v = Number(data[i][0]);
    if (v > max) max = v;
  }
  return max + 1;
}

function findRowById(ss, name, id) {
  const sheet = getSheet(ss, name);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return { sheet, rowNum: i + 1 };
  }
  return { sheet, rowNum: -1 };
}

function nowStr() {
  return Utilities.formatDate(new Date(), 'Asia/Tashkent', "yyyy-MM-dd'T'HH:mm:ss");
}

// ── Stats ────────────────────────────────────────────────────────────────────

function getStats(ss) {
  const customers = sheetToObjects(ss, 'Customers');
  const products  = sheetToObjects(ss, 'Products');
  const sales     = sheetToObjects(ss, 'Sales');
  const revenue   = sales.reduce((sum, s) => sum + Number(s.total), 0);
  return { customers: customers.length, products: products.length, sales: sales.length, revenue };
}

// ── Customers ────────────────────────────────────────────────────────────────

function listCustomers(ss, q) {
  let list = sheetToObjects(ss, 'Customers');
  if (q) {
    const lq = q.toLowerCase();
    list = list.filter(c =>
      String(c.name).toLowerCase().includes(lq) ||
      String(c.phone).toLowerCase().includes(lq)
    );
  }
  return list.reverse();
}

function createCustomer(ss, p) {
  const sheet = getSheet(ss, 'Customers');
  const id = nextId(ss, 'Customers');
  const created_at = nowStr();
  sheet.appendRow([id, p.name, p.phone, p.email || '', p.address || '', created_at]);
  return { id, name: p.name, phone: p.phone, email: p.email || '', address: p.address || '', created_at };
}

function updateCustomer(ss, p) {
  const { sheet, rowNum } = findRowById(ss, 'Customers', p.id);
  if (rowNum < 0) throw new Error('Mijoz topilmadi');
  const created_at = sheet.getRange(rowNum, 6).getValue();
  sheet.getRange(rowNum, 1, 1, 6).setValues([[p.id, p.name, p.phone, p.email || '', p.address || '', created_at]]);
  return { id: Number(p.id), name: p.name, phone: p.phone, email: p.email || '', address: p.address || '', created_at };
}

// ── Products ─────────────────────────────────────────────────────────────────

function listProducts(ss, q) {
  let list = sheetToObjects(ss, 'Products');
  if (q) {
    const lq = q.toLowerCase();
    list = list.filter(p => String(p.name).toLowerCase().includes(lq));
  }
  return list.reverse().map(p => ({ ...p, price: Number(p.price), qty: Number(p.qty) }));
}

function createProduct(ss, p) {
  const sheet = getSheet(ss, 'Products');
  const id = nextId(ss, 'Products');
  const created_at = nowStr();
  sheet.appendRow([id, p.name, Number(p.price), Number(p.qty), created_at]);
  return { id, name: p.name, price: Number(p.price), qty: Number(p.qty), created_at };
}

function updateProduct(ss, p) {
  const { sheet, rowNum } = findRowById(ss, 'Products', p.id);
  if (rowNum < 0) throw new Error('Mahsulot topilmadi');
  const created_at = sheet.getRange(rowNum, 5).getValue();
  sheet.getRange(rowNum, 1, 1, 5).setValues([[p.id, p.name, Number(p.price), Number(p.qty), created_at]]);
  return { id: Number(p.id), name: p.name, price: Number(p.price), qty: Number(p.qty), created_at };
}

// ── Umumiy o'chirish ─────────────────────────────────────────────────────────

function deleteItem(ss, sheetName, id) {
  const { sheet, rowNum } = findRowById(ss, sheetName, id);
  if (rowNum > 0) sheet.deleteRow(rowNum);
  return { ok: true };
}

// ── Sales ────────────────────────────────────────────────────────────────────

function listSales(ss) {
  const sales     = sheetToObjects(ss, 'Sales');
  const saleItems = sheetToObjects(ss, 'SaleItems');

  return sales.reverse().map(sale => ({
    ...sale,
    total: Number(sale.total),
    items: saleItems
      .filter(item => String(item.sale_id) === String(sale.id))
      .map(item => ({ ...item, price: Number(item.price), qty: Number(item.qty) })),
  }));
}

function createSale(ss, p) {
  const customers = sheetToObjects(ss, 'Customers');
  const customer  = customers.find(c => String(c.id) === String(p.customerId));
  if (!customer) throw new Error('Mijoz topilmadi');

  // Stok tekshirish
  const productsSheet = getSheet(ss, 'Products');
  for (const item of p.items) {
    const prods = sheetToObjects(ss, 'Products');
    const prod  = prods.find(pr => String(pr.id) === String(item.productId));
    if (!prod) throw new Error(`Mahsulot topilmadi: ${item.name}`);
    if (Number(prod.qty) < Number(item.qty)) {
      throw new Error(`"${prod.name}" uchun faqat ${prod.qty} dona mavjud!`);
    }
  }

  // Stokdan ayirish
  for (const item of p.items) {
    const prods = sheetToObjects(ss, 'Products');
    const prod  = prods.find(pr => String(pr.id) === String(item.productId));
    const { rowNum } = findRowById(ss, 'Products', prod.id);
    productsSheet.getRange(rowNum, 4).setValue(Number(prod.qty) - Number(item.qty));
  }

  const total      = p.items.reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0);
  const salesSheet = getSheet(ss, 'Sales');
  const saleId     = nextId(ss, 'Sales');
  const created_at = nowStr();

  salesSheet.appendRow([
    saleId, customer.id, customer.name, customer.phone,
    customer.email || '', customer.address || '', total, created_at,
  ]);

  const saleItemsSheet = getSheet(ss, 'SaleItems');
  for (const item of p.items) {
    saleItemsSheet.appendRow([
      nextId(ss, 'SaleItems'), saleId,
      item.productId, item.name, Number(item.price), Number(item.qty),
    ]);
  }

  return {
    id: saleId,
    customer_id:      customer.id,
    customer_name:    customer.name,
    customer_phone:   customer.phone,
    customer_email:   customer.email   || '',
    customer_address: customer.address || '',
    total,
    created_at,
    items: p.items.map(i => ({ ...i, price: Number(i.price), qty: Number(i.qty) })),
  };
}
