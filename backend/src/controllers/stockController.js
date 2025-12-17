const pool = require('../config/db');
const multer = require('multer');
const xlsx = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/stock - Get all stock items
exports.getStock = (req, res) => {
  const sql = `
    SELECT s.*, sup.name as supplier_name 
    FROM stock s
    LEFT JOIN suppliers sup ON s.supplier_id = sup.id
    ORDER BY s.id DESC
  `;
  
  pool.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching stock:', err);
      return res.status(500).json({ message: 'Failed to fetch stock', error: err.message });
    }
    res.json(results);
  });
};

// POST /api/stock - Add stock item
exports.addStock = (req, res) => {
  const { name, code, barcode, supplier_id, purchase_price, quantity, unit } = req.body;

  if (!name || !quantity || !purchase_price) {
    return res.status(400).json({ message: 'Name, quantity, and purchase price are required' });
  }

  const sql = `
    INSERT INTO stock (name, code, barcode, supplier_id, purchase_price, quantity, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  pool.query(
    sql,
    [name, code || null, barcode || null, supplier_id || null, purchase_price, quantity, unit || 'PCS'],
    (err, result) => {
      if (err) {
        console.error('Error adding stock:', err);
        return res.status(500).json({ message: 'Failed to add stock', error: err.message });
      }
      res.status(201).json({ id: result.insertId, message: 'Stock added successfully' });
    }
  );
};

// PUT /api/stock/:id - Update stock item
exports.updateStock = (req, res) => {
  const { id } = req.params;
  const { name, code, barcode, supplier_id, purchase_price, quantity, unit } = req.body;

  const sql = `
    UPDATE stock 
    SET name = ?, code = ?, barcode = ?, supplier_id = ?, purchase_price = ?, quantity = ?, unit = ?
    WHERE id = ?
  `;

  pool.query(
    sql,
    [name, code || null, barcode || null, supplier_id || null, purchase_price, quantity, unit || 'PCS', id],
    (err, result) => {
      if (err) {
        console.error('Error updating stock:', err);
        return res.status(500).json({ message: 'Failed to update stock', error: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Stock item not found' });
      }
      res.json({ message: 'Stock updated successfully' });
    }
  );
};

// DELETE /api/stock/:id - Delete stock item
exports.deleteStock = (req, res) => {
  const { id } = req.params;

  pool.query('DELETE FROM stock WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error deleting stock:', err);
      return res.status(500).json({ message: 'Failed to delete stock', error: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Stock item not found' });
    }
    res.json({ message: 'Stock deleted successfully' });
  });
};

// POST /api/stock/bulk-upload - Bulk upload stock
exports.bulkUpload = [upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ message: 'File is empty' });
    }

    const sql = `INSERT INTO stock (name, code, barcode, supplier_id, purchase_price, quantity, unit) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    let inserted = 0;

    const processRow = (index) => {
      if (index >= data.length) {
        return res.json({ message: 'Bulk upload completed', totalRows: data.length, affectedRows: inserted });
      }

      const row = data[index];
      const name = row.name || row.Name;
      const code = row.code || row.Code || null;
      const barcode = row.barcode || row.Barcode || null;
      const supplier_id = row.supplier_id || row.Supplier_ID || null;
      const purchase_price = parseFloat(row.purchase_price || row.Purchase_Price || row.purchasePrice || 0);
      const quantity = parseInt(row.quantity || row.Quantity || 0);
      const unit = row.unit || row.Unit || 'PCS';

      if (!name || !purchase_price || !quantity) {
        return processRow(index + 1);
      }

      pool.query(sql, [name, code, barcode, supplier_id, purchase_price, quantity, unit], (err) => {
        if (!err) inserted++;
        processRow(index + 1);
      });
    };

    processRow(0);
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ message: 'Failed to process file', error: error.message });
  }
}];

// POST /api/stock/:id/move-to-items - Move stock to items master
exports.moveToItems = (req, res) => {
  const { id } = req.params;
  const { selling_price, mrp, tax_rate } = req.body;

  if (!selling_price || !tax_rate) {
    return res.status(400).json({ message: 'Selling price and tax rate are required' });
  }

  pool.getConnection((connErr, conn) => {
    if (connErr) {
      console.error('Error getting connection:', connErr);
      return res.status(500).json({ message: 'Failed to move to items', error: connErr.message });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        console.error('Transaction error:', txErr);
        return res.status(500).json({ message: 'Failed to move to items', error: txErr.message });
      }

      // Get stock item
      conn.query('SELECT * FROM stock WHERE id = ?', [id], (err, stockRows) => {
        if (err) {
          return conn.rollback(() => {
            conn.release();
            console.error('Error fetching stock:', err);
            res.status(500).json({ message: 'Failed to move to items', error: err.message });
          });
        }

        if (stockRows.length === 0) {
          return conn.rollback(() => {
            conn.release();
            res.status(404).json({ message: 'Stock item not found' });
          });
        }

        const stock = stockRows[0];

        // Insert into items
        const insertSql = `
          INSERT INTO items (name, code, barcode, mrp, selling_price, purchase_price, stock, unit, tax_rate)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        conn.query(
          insertSql,
          [
            stock.name,
            stock.code,
            stock.barcode,
            mrp || stock.purchase_price,
            selling_price,
            stock.purchase_price,
            stock.quantity,
            stock.unit,
            tax_rate
          ],
          (insertErr, insertResult) => {
            if (insertErr) {
              return conn.rollback(() => {
                conn.release();
                console.error('Error inserting item:', insertErr);
                res.status(500).json({ message: 'Failed to move to items', error: insertErr.message });
              });
            }

            // Delete from stock
            conn.query('DELETE FROM stock WHERE id = ?', [id], (delErr) => {
              if (delErr) {
                return conn.rollback(() => {
                  conn.release();
                  console.error('Error deleting stock:', delErr);
                  res.status(500).json({ message: 'Failed to move to items', error: delErr.message });
                });
              }

              conn.commit((commitErr) => {
                if (commitErr) {
                  return conn.rollback(() => {
                    conn.release();
                    console.error('Commit error:', commitErr);
                    res.status(500).json({ message: 'Failed to move to items', error: commitErr.message });
                  });
                }

                conn.release();
                res.json({ 
                  message: 'Stock moved to items successfully',
                  itemId: insertResult.insertId 
                });
              });
            });
          }
        );
      });
    });
  });
};
