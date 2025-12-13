// src/controllers/itemController.js
const pool = require('../config/db');
const xlsx = require('xlsx');
const { parse } = require('csv-parse/sync');

/* ----------------------------- helpers ----------------------------- */
const toNum = (v, def = 0) => {
  if (v === null || v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const pick = (row, keys) => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
  }
  return undefined;
};

const normalizeBarcode = (v) => {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
};

/* ----------------------------- GET /api/items ----------------------------- */
exports.getItems = (req, res) => {
  const sql =
    'SELECT id, name, code, barcode, selling_price, purchase_price, stock, mrp, unit, tax_rate FROM items ORDER BY id DESC';

  pool.query(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching items:', err);
      return res.status(500).json({ message: 'Failed to fetch items' });
    }

    const items = rows.map((i) => ({
      id: i.id.toString(),
      name: i.name,
      code: i.code,
      barcode: i.barcode,
      sellingPrice: Number(i.selling_price),
      purchasePrice: Number(i.purchase_price),
      stock: Number(i.stock),
      mrp: Number(i.mrp),
      unit: i.unit,
      taxRate: Number(i.tax_rate),
    }));

    res.json(items);
  });
};

/* ----------------------------- POST /api/items ----------------------------- */
exports.createItem = (req, res) => {
  const {
    name,
    code,
    barcode,
    sellingPrice,
    purchasePrice,
    stock,
    unit,
    taxRate,
    mrp,
  } = req.body;

  if (!name || sellingPrice == null || purchasePrice == null) {
    return res
      .status(400)
      .json({ message: 'Name, sellingPrice & purchasePrice are required' });
  }

  const sql =
    'INSERT INTO items (name, code, barcode, selling_price, purchase_price, mrp, stock, unit, tax_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

  pool.query(
    sql,
    [
      name,
      code || null,
      normalizeBarcode(barcode),
      toNum(sellingPrice, 0),
      toNum(purchasePrice, 0),
      toNum(mrp, 0),
      toNum(stock, 0),
      unit || 'pcs',
      toNum(taxRate, 0),
    ],
    (err, result) => {
      if (err) {
        console.error('Error creating item:', err);
        return res.status(500).json({ message: 'Failed to create item' });
      }

      res.status(201).json({
        id: result.insertId.toString(),
        name,
        code: code || null,
        barcode: normalizeBarcode(barcode),
        sellingPrice: toNum(sellingPrice, 0),
        purchasePrice: toNum(purchasePrice, 0),
        mrp: toNum(mrp, 0),
        stock: toNum(stock, 0),
        unit: unit || 'pcs',
        taxRate: toNum(taxRate, 0),
      });
    }
  );
};

/* ----------------------------- PUT /api/items/:id ----------------------------- */
/**
 * ✅ FIXED: your previous SQL + params order was wrong
 */
exports.updateItem = (req, res) => {
  const { id } = req.params;
  const {
    name,
    code,
    barcode,
    sellingPrice,
    purchasePrice,
    stock,
    unit,
    taxRate,
    mrp,
  } = req.body;

  const sql =
    'UPDATE items SET name=?, code=?, barcode=?, selling_price=?, purchase_price=?, mrp=?, stock=?, unit=?, tax_rate=? WHERE id=?';

  pool.query(
    sql,
    [
      name,
      code || null,
      normalizeBarcode(barcode),
      toNum(sellingPrice, 0),
      toNum(purchasePrice, 0),
      toNum(mrp, 0),
      toNum(stock, 0),
      unit || 'pcs',
      toNum(taxRate, 0),
      id,
    ],
    (err, result) => {
      if (err) {
        console.error('Error updating item:', err);
        return res.status(500).json({ message: 'Failed to update item' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Item not found' });
      }

      res.status(204).end();
    }
  );
};

/* ----------------------------- DELETE /api/items/:id ----------------------------- */
exports.deleteItem = (req, res) => {
  const { id } = req.params;

  // Check for dependencies in invoices
  const checkSql = 'SELECT COUNT(*) AS cnt FROM invoice_items WHERE item_id = ?';
  pool.query(checkSql, [id], (checkErr, rows) => {
    if (checkErr) {
      console.error('Error checking item invoices:', checkErr);
      return res.status(500).json({ message: 'Failed to delete item' });
    }

    const count = rows[0].cnt;
    if (count > 0) {
      return res.status(400).json({
        message:
          'Cannot delete item: It is included in existing invoices. Please delete the invoices first.',
      });
    }

    const delSql = 'DELETE FROM items WHERE id = ?';
    pool.query(delSql, [id], (delErr, result) => {
      if (delErr) {
        console.error('Error deleting item:', delErr);
        return res.status(500).json({ message: 'Failed to delete item' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Item not found' });
      }

      res.status(204).end();
    });
  });
};

/* ----------------------------- PATCH /api/items/:id/stock ----------------------------- */
exports.adjustStock = (req, res) => {
  const { id } = req.params;
  const { addedQuantity } = req.body;

  const qty = Number(addedQuantity);
  if (!Number.isFinite(qty)) {
    return res.status(400).json({ message: 'addedQuantity must be a number' });
  }

  const sql = 'UPDATE items SET stock = stock + ? WHERE id = ?';
  pool.query(sql, [qty, id], (err, result) => {
    if (err) {
      console.error('Error adjusting stock:', err);
      return res.status(500).json({ message: 'Failed to adjust stock' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.status(204).end();
  });
};

/* ----------------------------- POST /api/items/bulk-upload ----------------------------- */
/**
 * CSV/XLSX bulk upload
 * - Upsert by UNIQUE barcode
 * - If barcode is empty -> insert new row (barcode NULL)
 */
exports.bulkUploadItems = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File is required (csv/xlsx)' });
    }

    const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
    let rows = [];

    if (ext === 'csv') {
      const text = req.file.buffer.toString('utf8');
      rows = parse(text, { columns: true, skip_empty_lines: true, trim: true });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    } else {
      return res.status(400).json({ message: 'Unsupported file type. Upload csv/xlsx' });
    }

    if (!rows.length) {
      return res.status(400).json({ message: 'No rows found in file' });
    }

    const errors = [];
    const values = [];

    rows.forEach((r, idx) => {
      const rowNo = idx + 2;

      const name = String(pick(r, ['name', 'Name', 'itemName', 'Item Name']) || '').trim();
      const codeVal = pick(r, ['code', 'Code']);
      const barcodeVal = pick(r, ['barcode', 'Barcode']);

      const sellingPrice = toNum(pick(r, ['sellingPrice', 'selling_price', 'Selling Price', 'selling price']), 0);
      const purchasePrice = toNum(pick(r, ['purchasePrice', 'purchase_price', 'Purchase Price', 'purchase price']), 0);
      const mrp = toNum(pick(r, ['mrp', 'MRP']), 0);
      const stock = toNum(pick(r, ['stock', 'Stock']), 0);
      const unit = String(pick(r, ['unit', 'Unit']) || 'pcs').trim() || 'pcs';
      const taxRate = toNum(pick(r, ['taxRate', 'tax_rate', 'Tax Rate', 'tax rate']), 0);

      const code = codeVal ? String(codeVal).trim() : null;
      const barcode = normalizeBarcode(barcodeVal);

      // validations
      if (!name) errors.push({ row: rowNo, message: 'name is required' });
      if (sellingPrice < 0) errors.push({ row: rowNo, message: 'sellingPrice cannot be negative' });
      if (purchasePrice < 0) errors.push({ row: rowNo, message: 'purchasePrice cannot be negative' });
      if (mrp < 0) errors.push({ row: rowNo, message: 'mrp cannot be negative' });
      if (taxRate < 0) errors.push({ row: rowNo, message: 'taxRate cannot be negative' });

      values.push([
        name,
        code,
        barcode,          // NULL allowed
        sellingPrice,
        purchasePrice,
        mrp,
        stock,
        unit,
        taxRate,
      ]);
    });

    if (errors.length) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.slice(0, 50),
      });
    }

    const sql = `
      INSERT INTO items
        (name, code, barcode, selling_price, purchase_price, mrp, stock, unit, tax_rate)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        code = VALUES(code),
        selling_price = VALUES(selling_price),
        purchase_price = VALUES(purchase_price),
        mrp = VALUES(mrp),
        stock = VALUES(stock),
        unit = VALUES(unit),
        tax_rate = VALUES(tax_rate)
    `;

    pool.query(sql, [values], (err, result) => {
      if (err) {
        console.error('Bulk upload error:', err);
        return res.status(500).json({ message: 'Bulk upload failed', error: err.message });
      }

      res.json({
        message: 'Bulk upload success',
        totalRows: values.length,
        affectedRows: result.affectedRows,
      });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Bulk upload failed', error: e.message });
  }
};
