// src/controllers/invoiceController.js
const pool = require('../config/db');

// 👇 Make sure you have a "Cash Customer" in `parties` with this ID
// INSERT INTO parties (name, phone, gstin, balance, address)
// VALUES ('Cash Customer', NULL, NULL, 0, NULL);
const CASH_PARTY_ID = 1;

// Helper: apply stock impact based on invoice type
function getStockDelta(type, qty) {
  switch (type) {
    case 'SALE':
      return -qty;
    case 'RETURN':
      return qty;
    case 'PURCHASE':
      return qty;
    case 'PURCHASE_RETURN':
      return -qty;
    default:
      return 0;
  }
}

// Helper: apply party balance impact based on invoice type
function getBalanceDelta(type, total) {
  switch (type) {
    case 'SALE':
      return total; // customer owes us more
    case 'RETURN':
      return -total; // customer owes us less
    case 'PURCHASE':
      return -total; // we owe supplier
    case 'PURCHASE_RETURN':
      return total; // we owe supplier less
    default:
      return 0;
  }
}

// ==============================
// GET /api/invoices
// ==============================
exports.getInvoices = (req, res) => {
  const sql = 'SELECT * FROM invoices ORDER BY id DESC';
  pool.query(sql, (err, invoices) => {
    if (err) {
      console.error('Error fetching invoices:', err);
      return res
        .status(500)
        .json({ message: 'Failed to fetch invoices', error: err.message });
    }

    if (invoices.length === 0) {
      return res.json([]);
    }

    const invoiceIds = invoices.map((inv) => inv.id);
    const itemsSql =
      'SELECT * FROM invoice_items WHERE invoice_id IN (?) ORDER BY id ASC';

    pool.query(itemsSql, [invoiceIds], (itemsErr, items) => {
      if (itemsErr) {
        console.error('Error fetching invoice items:', itemsErr);
        return res.status(500).json({
          message: 'Failed to fetch invoice items',
          error: itemsErr.message,
        });
      }

      const grouped = {};
      items.forEach((it) => {
        if (!grouped[it.invoice_id]) grouped[it.invoice_id] = [];
        grouped[it.invoice_id].push({
          id: it.id.toString(),
          itemId: it.item_id.toString(),
          name: it.name,
          quantity: Number(it.quantity),
          price: Number(it.price),
          taxRate: Number(it.tax_rate),
          total: Number(it.total),
        });
      });

      const response = invoices.map((inv) => ({
        id: inv.id.toString(),
        partyId: inv.party_id.toString(),
        invoiceNo: inv.invoice_no,
        type: inv.type,
        totalAmount: Number(inv.total_amount),
        date: inv.invoice_date,
        notes: inv.notes,
        items: grouped[inv.id] || [],
      }));

      res.json(response);
    });
  });
};

// ==============================
// GET /api/invoices/:id
// ==============================
exports.getInvoiceById = (req, res) => {
  const { id } = req.params;
  const invoiceSql = 'SELECT * FROM invoices WHERE id = ? LIMIT 1';

  pool.query(invoiceSql, [id], (err, rows) => {
    if (err) {
      console.error('Error fetching invoice:', err);
      return res
        .status(500)
        .json({ message: 'Failed to fetch invoice', error: err.message });
    }
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const inv = rows[0];
    const itemsSql = 'SELECT * FROM invoice_items WHERE invoice_id = ?';

    pool.query(itemsSql, [id], (itemsErr, items) => {
      if (itemsErr) {
        console.error('Error fetching invoice items:', itemsErr);
        return res.status(500).json({
          message: 'Failed to fetch invoice items',
          error: itemsErr.message,
        });
      }

      const response = {
        id: inv.id.toString(),
        partyId: inv.party_id.toString(),
        invoiceNo: inv.invoice_no,
        type: inv.type,
        totalAmount: Number(inv.total_amount),
        date: inv.invoice_date,
        notes: inv.notes,
        items: items.map((it) => ({
          id: it.id.toString(),
          itemId: it.item_id.toString(),
          name: it.name || 'Unknown',
          quantity: Number(it.quantity),
          price: Number(it.price),
          taxRate: Number(it.tax_rate),
          total: Number(it.total),
        })),
      };

      res.json(response);
    });
  });
};

// ==============================
// POST /api/invoices
// ==============================
exports.createInvoice = (req, res) => {
  let { partyId, type, date, items, totalAmount, invoiceNo, notes } = req.body;

  console.log(
    '📥 Incoming invoice payload:',
    JSON.stringify(req.body, null, 2)
  );

  // Map special CASH value to numeric ID
  if (partyId === 'CASH' || partyId === 'cash') {
    partyId = CASH_PARTY_ID;
  }

  const partyIdNum = Number(partyId);
  if (!partyIdNum) {
    return res.status(400).json({ message: 'Invalid partyId' });
  }

  if (!type || !items || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'Invalid invoice payload' });
  }

  // Validate each item has quantity & price
  for (const it of items) {
    if (it.quantity == null || isNaN(Number(it.quantity))) {
      return res.status(400).json({
        message: 'Each item must have a numeric quantity',
      });
    }
    if (it.price == null || isNaN(Number(it.price))) {
      return res.status(400).json({
        message: 'Each item must have a numeric price',
      });
    }
  }

  if (totalAmount == null || isNaN(Number(totalAmount))) {
    return res.status(400).json({
      message: 'totalAmount is required and must be a number',
    });
  }

  const total = Number(totalAmount);

  pool.getConnection((connErr, conn) => {
    if (connErr) {
      console.error('Error getting connection:', connErr);
      return res.status(500).json({
        message: 'Failed to create invoice',
        error: connErr.message,
        code: connErr.code,
      });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        console.error('Transaction error:', txErr);
        return res.status(500).json({
          message: 'Failed to create invoice',
          error: txErr.message,
          code: txErr.code,
        });
      }

      const invSql =
        'INSERT INTO invoices (party_id, invoice_no, type, total_amount, invoice_date, notes) VALUES (?, ?, ?, ?, ?, ?)';

      conn.query(
        invSql,
        [
          partyIdNum,
          invoiceNo || null,
          type,
          total,
          date ? new Date(date) : new Date(),
          notes || null,
        ],
        (invErr, invResult) => {
          if (invErr) {
            console.error('Error inserting invoice:', invErr);
            return conn.rollback(() => {
              conn.release();
              res.status(500).json({
                message: 'Failed to create invoice',
                error: invErr.message,
                code: invErr.code,
              });
            });
          }

          const invoiceId = invResult.insertId;

          const insertItemSql =
            'INSERT INTO invoice_items (invoice_id, item_id, name, quantity, price, tax_rate, total) VALUES (?, ?, ?, ?, ?, ?, ?)';
          const updateStockSql =
            'UPDATE items SET stock = stock + ? WHERE id = ?';

          let idx = 0;

          const processNextItem = () => {
            if (idx >= items.length) {
              // All items processed → update party balance
              const balanceDelta = getBalanceDelta(type, total);
              const balSql =
                'UPDATE parties SET balance = balance + ? WHERE id = ?';

              conn.query(balSql, [balanceDelta, partyIdNum], (balErr) => {
                if (balErr) {
                  console.error('Error updating balance:', balErr);
                  return conn.rollback(() => {
                    conn.release();
                    res.status(500).json({
                      message: 'Failed to update party balance',
                      error: balErr.message,
                      code: balErr.code,
                    });
                  });
                }

                conn.commit((commitErr) => {
                  if (commitErr) {
                    console.error('Commit error:', commitErr);
                    return conn.rollback(() => {
                      conn.release();
                      res.status(500).json({
                        message: 'Failed to create invoice',
                        error: commitErr.message,
                        code: commitErr.code,
                      });
                    });
                  }

                  conn.release();

                  res.status(201).json({
                    id: invoiceId.toString(),
                    partyId: partyIdNum.toString(),
                    invoiceNo,
                    type,
                    totalAmount: total,
                    date,
                    notes,
                    items,
                  });
                });
              });

              return;
            }

            const it = items[idx];

            // Normalize numbers
            const qty = Number(it.quantity);
            const price = Number(it.price);
            const taxRate = it.taxRate != null ? Number(it.taxRate) : 0;

            const base = qty * price;
            const taxAmount = (base * taxRate) / 100;

            // Prefer sent total, but if missing / NaN, compute
            let lineTotal =
              it.total != null ? Number(it.total) : base + taxAmount;
            if (isNaN(lineTotal)) {
              lineTotal = base + taxAmount;
            }

            const stockDelta = getStockDelta(type, qty);

            conn.query(
              insertItemSql,
              [
                invoiceId,
                it.itemId,
                it.name || null,
                qty,
                price,
                taxRate,
                lineTotal, // ✅ not null now
              ],
              (itemErr) => {
                if (itemErr) {
                  console.error(
                    'Error inserting invoice_item:',
                    itemErr,
                    'for item payload:',
                    it
                  );
                  return conn.rollback(() => {
                    conn.release();
                    res.status(500).json({
                      message: 'Failed to create invoice items',
                      error: itemErr.message,
                      code: itemErr.code,
                    });
                  });
                }

                conn.query(
                  updateStockSql,
                  [stockDelta, it.itemId],
                  (stockErr) => {
                    if (stockErr) {
                      console.error('Error updating stock:', stockErr);
                      return conn.rollback(() => {
                        conn.release();
                        res.status(500).json({
                          message: 'Failed to update stock',
                          error: stockErr.message,
                          code: stockErr.code,
                        });
                      });
                    }

                    idx++;
                    processNextItem();
                  }
                );
              }
            );
          };

          processNextItem();
        }
      );
    });
  });
};
