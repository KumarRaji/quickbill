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
    ORDER BY s.created_at DESC
  `;
  
  pool.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching stock:', err);
      return res.status(500).json({ message: 'Failed to fetch stock', error: err.message });
    }
    
    // Return stock items with their stored tax_rate values
    res.json(results);
  });
};

// POST /api/stock - Add stock item
exports.addStock = (req, res) => {
  const { name, category, code, barcode, supplier_id, purchase_price, mrp, quantity, unit, tax_rate } = req.body;

  console.log('Tax rate received:', tax_rate);

  if (!name || !quantity || !purchase_price) {
    return res.status(400).json({ message: 'Name, quantity, and purchase price are required' });
  }

  // First check if tax_rate column exists
  pool.query('DESCRIBE stock', (descErr, columns) => {
    if (descErr) {
      console.error('Error describing table:', descErr);
      return res.status(500).json({ message: 'Database error', error: descErr.message });
    }
    
    const hasTaxRate = columns.some(col => col.Field === 'tax_rate');
    console.log('Has tax_rate column:', hasTaxRate);
    console.log('Available columns:', columns.map(c => c.Field));
    
    if (!hasTaxRate) {
      // Add tax_rate column if it doesn't exist
      pool.query('ALTER TABLE stock ADD COLUMN tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0', (alterErr) => {
        if (alterErr) {
          console.error('Error adding tax_rate column:', alterErr);
          return res.status(500).json({ message: 'Failed to add tax_rate column', error: alterErr.message });
        }
        // Proceed with insert after adding column
        insertStock();
      });
    } else {
      // Column exists, proceed with insert
      insertStock();
    }
  });

  function insertStock() {
    const sql = `INSERT INTO stock (name, category, code, barcode, supplier_id, purchase_price, mrp, quantity, unit, tax_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
      name,
      category || null,
      code || null,
      barcode || null,
      supplier_id || null,
      purchase_price || 0,
      mrp || 0,
      quantity,
      unit || 'PCS',
      parseFloat(tax_rate) || 0
    ];

    console.log('Inserting with values:', values);

    pool.query(sql, values, (err, result) => {
      if (err) {
        console.error('Error adding stock:', err);
        return res.status(500).json({ message: 'Failed to add stock', error: err.message });
      }
      res.status(201).json({ id: result.insertId, message: 'Stock added successfully' });
    });
  }
};

// PUT /api/stock/:id - Update stock item
exports.updateStock = (req, res) => {
  const { id } = req.params;
  const { name, category, code, barcode, supplier_id, purchase_price, mrp, quantity, unit, tax_rate } = req.body;

  const sql = `UPDATE stock SET name = ?, category = ?, code = ?, barcode = ?, supplier_id = ?, purchase_price = ?, mrp = ?, quantity = ?, unit = ?, tax_rate = ? WHERE id = ?`;

  pool.query(
    sql,
    [name, category || null, code || null, barcode || null, supplier_id || null, purchase_price, mrp || 0, quantity, unit || 'PCS', parseFloat(tax_rate) || 0, id],
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

    const sql = `INSERT INTO stock (name, category, code, barcode, supplier_id, purchase_price, mrp, quantity, unit, tax_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    let inserted = 0;

    const processRow = (index) => {
      if (index >= data.length) {
        return res.json({ message: 'Bulk upload completed', totalRows: data.length, affectedRows: inserted });
      }

      const row = data[index];
      const name = row.name || row.Name;
      const category = row.category || row.Category || null;
      const code = row.code || row.Code || null;
      const barcode = row.barcode || row.Barcode || null;
      const supplier_id = row.supplier_id || row.Supplier_ID || null;
      const purchase_price = parseFloat(row.purchase_price || row.Purchase_Price || row.purchasePrice || 0);
      const mrp = parseFloat(row.mrp || row.MRP || 0);
      const quantity = parseInt(row.quantity || row.Quantity || 0);
      const unit = row.unit || row.Unit || 'PCS';
      const tax_rate = parseFloat(row.tax_rate || row.Tax_Rate || row.taxRate || 0);

      if (!name || !purchase_price || !quantity) {
        return processRow(index + 1);
      }

      pool.query(sql, [name, category, code, barcode, supplier_id, purchase_price, mrp, quantity, unit, tax_rate], (err) => {
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

// GET /api/stock/:id/tax-rate - Get tax rate from purchase bill
exports.getTaxRateFromPurchaseBill = (req, res) => {
  const { id } = req.params;

  // Get stock item and find matching tax rate from purchase invoice items
  const sql = `
    SELECT pii.tax_rate
    FROM stock s
    JOIN purchase_invoice_items pii ON s.name = pii.name
    WHERE s.id = ?
    ORDER BY pii.id DESC
    LIMIT 1
  `;

  pool.query(sql, [id], (err, results) => {
    if (err) {
      console.error('Error fetching tax rate:', err);
      return res.status(500).json({ message: 'Failed to fetch tax rate', error: err.message });
    }

    const taxRate = results && results.length > 0 ? results[0].tax_rate || 0 : 0;
    res.json({ tax_rate: taxRate });
  });
};

// GET /api/stock/test-schema - Test database schema
exports.testSchema = (req, res) => {
  const sql = 'DESCRIBE stock';
  pool.query(sql, (err, results) => {
    if (err) {
      console.error('Error describing stock table:', err);
      return res.status(500).json({ message: 'Failed to describe table', error: err.message });
    }
    res.json({ columns: results });
  });
};

// POST /api/stock/fix-tax-rates - Fix existing stock items with zero tax rates
exports.fixTaxRates = (req, res) => {
  const { defaultTaxRate = 5.00 } = req.body;
  
  const sql = 'UPDATE stock SET tax_rate = ? WHERE tax_rate = 0.00';
  pool.query(sql, [defaultTaxRate], (err, result) => {
    if (err) {
      console.error('Error updating tax rates:', err);
      return res.status(500).json({ message: 'Failed to update tax rates', error: err.message });
    }
    res.json({ 
      message: `Updated ${result.affectedRows} stock items with tax rate ${defaultTaxRate}%`,
      affectedRows: result.affectedRows 
    });
  });
};

// POST /api/stock/test-insert - Test direct insert with tax rate
exports.testInsert = (req, res) => {
  const sql = `INSERT INTO stock (name, tax_rate) VALUES ('Test Item', 5.00)`;
  
  pool.query(sql, (err, result) => {
    if (err) {
      console.error('Test insert error:', err);
      return res.status(500).json({ message: 'Test insert failed', error: err.message });
    }
    
    pool.query('SELECT * FROM stock WHERE id = ?', [result.insertId], (selectErr, selectResult) => {
      if (selectErr) {
        return res.status(500).json({ message: 'Select failed', error: selectErr.message });
      }
      res.json({ 
        message: 'Test insert successful', 
        insertedId: result.insertId,
        data: selectResult[0]
      });
    });
  });
};

// GET /api/stock/:id - Get single stock item for move to items
exports.getStockItem = (req, res) => {
  const { id } = req.params;
  
  const sql = 'SELECT * FROM stock WHERE id = ?';
  pool.query(sql, [id], (err, results) => {
    if (err) {
      console.error('Error fetching stock item:', err);
      return res.status(500).json({ message: 'Failed to fetch stock item', error: err.message });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Stock item not found' });
    }
    
    res.json(results[0]);
  });
};

// POST /api/stock/:id/move-to-items - Move stock to items master
exports.moveToItems = (req, res) => {
  const { id } = req.params;
  const { selling_price, mrp, tax_rate } = req.body;

  if (!selling_price || tax_rate === undefined || tax_rate === null) {
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

        // Check if barcode already exists in items table
        const checkBarcodeSql = 'SELECT id FROM items WHERE barcode = ? AND barcode IS NOT NULL';
        conn.query(checkBarcodeSql, [stock.barcode], (barcodeErr, barcodeRows) => {
          if (barcodeErr) {
            return conn.rollback(() => {
              conn.release();
              console.error('Error checking barcode:', barcodeErr);
              res.status(500).json({ message: 'Failed to move to items', error: barcodeErr.message });
            });
          }

          // Use null for barcode if it already exists
          const barcodeToUse = (barcodeRows && barcodeRows.length > 0) ? null : stock.barcode;

          // Insert into items
          const insertSql = `
            INSERT INTO items (name, category, code, barcode, supplier_id, selling_price, purchase_price, mrp, stock, unit, tax_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          conn.query(
            insertSql,
            [
              stock.name,
              stock.category || null,
              stock.code,
              barcodeToUse,
              stock.supplier_id,
              selling_price,
              stock.purchase_price,
              mrp || stock.mrp || 0,
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
                  const message = barcodeToUse ? 'Stock moved to items successfully' : 'Stock moved to items successfully (barcode removed due to duplicate)';
                  res.json({ 
                    message,
                    itemId: insertResult.insertId 
                  });
                });
              });
            }
          );
        });
      });
    });
  });
};
