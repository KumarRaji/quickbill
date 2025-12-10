// src/controllers/itemController.js
const pool = require('../config/db');

// GET /api/items
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
      unit: i.unit,
      taxRate: Number(i.tax_rate),
      mrp: Number(i.mrp)
    }));

    res.json(items);
  });
};

// POST /api/items
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
    'INSERT INTO items (name, code, barcode, selling_price, purchase_price, stock, unit, tax_rate, mrp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

  pool.query(
    sql,
    [
      name,
      code || null,
      barcode || null,
      sellingPrice || 0,
      purchasePrice || 0,
      stock || 0,
      unit || 'pcs',
      taxRate || 0,
      mrp || 0
    ],
    (err, result) => {
      if (err) {
        console.error('Error creating item:', err);
        return res.status(500).json({ message: 'Failed to create item' });
      }

      res.status(201).json({
        id: result.insertId.toString(),
        name,
        code,
        barcode,
        sellingPrice: Number(sellingPrice || 0),
        purchasePrice: Number(purchasePrice || 0),
        stock: Number(stock || 0),
        unit: unit || 'pcs',
        taxRate: Number(taxRate || 0),
        mrp: Number(mrp || 0) 
      });
    }
  );
};

// PUT /api/items/:id
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
    'UPDATE items SET name=?, code=?, barcode=?, selling_price=?, mrp=?, purchase_price=?, stock=?, unit=?, tax_rate=? WHERE id = ?';

  pool.query(
    sql,
    [
      name,
      code || null,
      barcode || null,
      sellingPrice || 0,
      purchasePrice || 0,
      stock || 0,
      unit || 'pcs',
      taxRate || 0,
      id,
      mrp || 0
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

// DELETE /api/items/:id
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

// PATCH /api/items/:id/stock
exports.adjustStock = (req, res) => {
  const { id } = req.params;
  const { addedQuantity } = req.body;

  if (typeof addedQuantity !== 'number') {
    return res
      .status(400)
      .json({ message: 'addedQuantity must be a number' });
  }

  const sql = 'UPDATE items SET stock = stock + ? WHERE id = ?';
  pool.query(sql, [addedQuantity, id], (err, result) => {
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
