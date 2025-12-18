// src/controllers/invoiceController.js
const pool = require('../config/db');

// 👇 Make sure you have a "Cash Customer" in `parties` with this ID
// INSERT INTO parties (name, phone, gstin, balance, address)
// VALUES ('Cash Customer', NULL, NULL, 0, NULL);
const CASH_PARTY_ID = 1; // Use existing party ID

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
  const sql = `
    SELECT i.*, 
      CASE 
        WHEN i.type IN ('PURCHASE', 'PURCHASE_RETURN') THEN s.name
        ELSE p.name
      END as party_name,
      orig.invoice_no as original_invoice_no
    FROM invoices i 
    LEFT JOIN parties p ON i.party_id = p.id AND i.type NOT IN ('PURCHASE', 'PURCHASE_RETURN')
    LEFT JOIN suppliers s ON i.party_id = s.id AND i.type IN ('PURCHASE', 'PURCHASE_RETURN')
    LEFT JOIN invoices orig ON i.original_invoice_id = orig.id
    ORDER BY i.id DESC
  `;
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
          itemName: it.name,
          quantity: Number(it.quantity),
          mrp: Number(it.mrp || 0),
          price: Number(it.price),
          taxRate: Number(it.tax_rate),
          amount: Number(it.total),
        });
      });

      const response = invoices.map((inv) => {
        const invoiceItems = grouped[inv.id] || [];
        const totalTax = invoiceItems.reduce((sum, item) => {
          const taxAmount = (item.price * item.quantity * item.taxRate) / 100;
          return sum + taxAmount;
        }, 0);

        return {
          id: inv.id.toString(),
          partyId: inv.party_id.toString(),
          invoiceNumber: inv.invoice_no,
          type: inv.type,
          totalAmount: Number(inv.total_amount),
          totalTax: totalTax,
          date: inv.invoice_date,
          notes: inv.notes,
          paymentMode: inv.payment_mode,
          status: 'PAID',
          partyName: inv.party_name || "Cash Customer",
          originalRefNumber: inv.original_invoice_no || null,
          items: invoiceItems,
        };
      });

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
        invoiceNumber: inv.invoice_no,
        type: inv.type,
        totalAmount: Number(inv.total_amount),
        date: inv.invoice_date,
        notes: inv.notes,
        paymentMode: inv.payment_mode,
        items: items.map((it) => ({
          id: it.id.toString(),
          itemId: it.item_id.toString(),
          itemName: it.name || 'Unknown',
          quantity: Number(it.quantity),
          price: Number(it.price),
          taxRate: Number(it.tax_rate),
          amount: Number(it.total),
        })),
      };

      res.json(response);
    });
  });
};

// ==============================
// POST /api/invoices
// ==============================
exports.createInvoice = async (req, res) => {
  let { partyId, type, date, items, totalAmount, invoiceNo, notes, paymentMode } = req.body;

  console.log(
    '📥 Incoming invoice payload:',
    JSON.stringify(req.body, null, 2)
  );

  // Handle walk-in customers (empty partyId)
  let partyIdNum;
  if (!partyId || partyId === 'CASH' || partyId === 'cash' || partyId === '') {
    partyIdNum = CASH_PARTY_ID;
  } else {
    partyIdNum = Number(partyId);
    if (!partyIdNum) {
      return res.status(400).json({ message: 'Invalid partyId' });
    }
    
    // For PURCHASE invoices, sync supplier to parties table
    if (type === 'PURCHASE' || type === 'PURCHASE_RETURN') {
      try {
        const checkSupplier = await new Promise((resolve, reject) => {
          pool.query('SELECT * FROM suppliers WHERE id = ?', [partyIdNum], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        
        if (checkSupplier && checkSupplier.length > 0) {
          const supplier = checkSupplier[0];
          // Upsert to parties table
          await new Promise((resolve, reject) => {
            pool.query(
              'INSERT INTO parties (id, name, phone, gstin, address, balance) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), gstin = VALUES(gstin), address = VALUES(address)',
              [supplier.id, supplier.name, supplier.phone, supplier.gstin, supplier.address, supplier.balance || 0],
              (err, result) => {
                if (err) reject(err);
                else resolve(result);
              }
            );
          });
        }
      } catch (syncErr) {
        console.error('Error syncing supplier to parties:', syncErr);
        return res.status(500).json({ message: 'Failed to sync supplier data', error: syncErr.message });
      }
    }
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

      const generatedInvoiceNo = invoiceNo || `${type === 'RETURN' || type === 'PURCHASE_RETURN' ? 'CN' : 'TXN'}-${Date.now().toString().slice(-6)}`;
      
      const invSql =
        'INSERT INTO invoices (party_id, invoice_no, type, total_amount, invoice_date, notes, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?)';

      conn.query(
        invSql,
        [
          partyIdNum,
          generatedInvoiceNo,
          type,
          total,
          date ? new Date(date) : new Date(),
          notes || null,
          paymentMode || 'CASH',
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
            'INSERT INTO invoice_items (invoice_id, item_id, name, quantity, mrp, price, tax_rate, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
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

                  const totalTax = items.reduce((sum, item) => {
                    const taxAmount = (Number(item.price) * Number(item.quantity) * Number(item.taxRate || 0)) / 100;
                    return sum + taxAmount;
                  }, 0);

                  res.status(201).json({
                    id: invoiceId.toString(),
                    partyId: partyIdNum.toString(),
                    invoiceNumber: generatedInvoiceNo,
                    type,
                    totalAmount: total,
                    totalTax: totalTax,
                    date,
                    notes,
                    paymentMode,
                    status: 'PAID',
                    partyName: 'Cash Customer',
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
                it.itemName || it.name || null,
                qty,
                Number(it.mrp || 0),
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

// ==============================
// PATCH /api/invoices/:id
// ==============================
exports.updateInvoice = async (req, res) => {
  const { id } = req.params;
  let { partyId, type, date, items, totalAmount, invoiceNo, notes, paymentMode } = req.body;

  pool.getConnection((connErr, conn) => {
    if (connErr) {
      console.error("Error getting connection:", connErr);
      return res.status(500).json({ message: "Failed to update invoice", error: connErr.message });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        console.error("Transaction error:", txErr);
        return res.status(500).json({ message: "Failed to update invoice", error: txErr.message });
      }

      // 1) Load existing invoice
      conn.query("SELECT * FROM invoices WHERE id = ? LIMIT 1", [id], (invErr, invRows) => {
        if (invErr) {
          return conn.rollback(() => {
            conn.release();
            console.error("Error fetching invoice:", invErr);
            res.status(500).json({ message: "Failed to update invoice", error: invErr.message });
          });
        }

        if (!invRows || invRows.length === 0) {
          return conn.rollback(() => {
            conn.release();
            res.status(404).json({ message: "Invoice not found" });
          });
        }

        const oldInv = invRows[0];

        // 2) Load old items
        conn.query("SELECT * FROM invoice_items WHERE invoice_id = ?", [id], (itemsErr, oldItems) => {
          if (itemsErr) {
            return conn.rollback(() => {
              conn.release();
              console.error("Error fetching invoice items:", itemsErr);
              res.status(500).json({ message: "Failed to update invoice", error: itemsErr.message });
            });
          }

          const oldItemsArr = Array.isArray(oldItems) ? oldItems : [];

          // 3) Reverse old stock & balance
          const reverseOldStock = (idx) => {
            if (idx >= oldItemsArr.length) {
              // Reverse old balance
              const oldTotal = Number(oldInv.total_amount || 0);
              const oldBalDelta = -getBalanceDelta(oldInv.type, oldTotal);
              conn.query(
                "UPDATE parties SET balance = balance + ? WHERE id = ?",
                [oldBalDelta, oldInv.party_id],
                (balErr) => {
                  if (balErr) {
                    return conn.rollback(() => {
                      conn.release();
                      console.error("Error reversing balance:", balErr);
                      res.status(500).json({ message: "Failed to update invoice", error: balErr.message });
                    });
                  }

                  // 4) Delete old items
                  conn.query("DELETE FROM invoice_items WHERE invoice_id = ?", [id], (delErr) => {
                    if (delErr) {
                      return conn.rollback(() => {
                        conn.release();
                        console.error("Error deleting old items:", delErr);
                        res.status(500).json({ message: "Failed to update invoice", error: delErr.message });
                      });
                    }

                    // 5) Update invoice record
                    let partyIdNum;
                    if (!partyId || partyId === 'CASH' || partyId === 'cash' || partyId === '') {
                      partyIdNum = CASH_PARTY_ID;
                    } else {
                      partyIdNum = Number(partyId);
                    }

                    const newTotal = Number(totalAmount || 0);
                    const updateSql = `UPDATE invoices SET party_id = ?, invoice_no = ?, type = ?, total_amount = ?, invoice_date = ?, notes = ?, payment_mode = ? WHERE id = ?`;

                    conn.query(
                      updateSql,
                      [
                        partyIdNum,
                        invoiceNo || oldInv.invoice_no,
                        type || oldInv.type,
                        newTotal,
                        date ? new Date(date) : oldInv.invoice_date,
                        notes !== undefined ? notes : oldInv.notes,
                        paymentMode || oldInv.payment_mode,
                        id,
                      ],
                      (updErr) => {
                        if (updErr) {
                          return conn.rollback(() => {
                            conn.release();
                            console.error("Error updating invoice:", updErr);
                            res.status(500).json({ message: "Failed to update invoice", error: updErr.message });
                          });
                        }

                        // 6) Insert new items
                        const newItems = Array.isArray(items) ? items : [];
                        if (newItems.length === 0) {
                          return conn.rollback(() => {
                            conn.release();
                            res.status(400).json({ message: "Invoice must have at least one item" });
                          });
                        }

                        let itemIdx = 0;
                        const processNewItem = () => {
                          if (itemIdx >= newItems.length) {
                            // Apply new balance
                            const newBalDelta = getBalanceDelta(type || oldInv.type, newTotal);
                            conn.query(
                              "UPDATE parties SET balance = balance + ? WHERE id = ?",
                              [newBalDelta, partyIdNum],
                              (newBalErr) => {
                                if (newBalErr) {
                                  return conn.rollback(() => {
                                    conn.release();
                                    console.error("Error applying new balance:", newBalErr);
                                    res.status(500).json({ message: "Failed to update invoice", error: newBalErr.message });
                                  });
                                }

                                conn.commit((commitErr) => {
                                  if (commitErr) {
                                    return conn.rollback(() => {
                                      conn.release();
                                      console.error("Commit error:", commitErr);
                                      res.status(500).json({ message: "Failed to update invoice", error: commitErr.message });
                                    });
                                  }

                                  conn.release();

                                  const totalTax = newItems.reduce((sum, item) => {
                                    const taxAmount = (Number(item.price) * Number(item.quantity) * Number(item.taxRate || 0)) / 100;
                                    return sum + taxAmount;
                                  }, 0);

                                  res.json({
                                    id: id.toString(),
                                    partyId: partyIdNum.toString(),
                                    invoiceNumber: invoiceNo || oldInv.invoice_no,
                                    type: type || oldInv.type,
                                    totalAmount: newTotal,
                                    totalTax: totalTax,
                                    date: date || oldInv.invoice_date,
                                    notes: notes !== undefined ? notes : oldInv.notes,
                                    paymentMode: paymentMode || oldInv.payment_mode,
                                    status: 'PAID',
                                    items: newItems,
                                  });
                                });
                              }
                            );
                            return;
                          }

                          const it = newItems[itemIdx];
                          const qty = Number(it.quantity);
                          const price = Number(it.price);
                          const taxRate = it.taxRate != null ? Number(it.taxRate) : 0;
                          const base = qty * price;
                          const taxAmount = (base * taxRate) / 100;
                          let lineTotal = it.total != null ? Number(it.total) : base + taxAmount;
                          if (isNaN(lineTotal)) lineTotal = base + taxAmount;

                          const stockDelta = getStockDelta(type || oldInv.type, qty);

                          const insertItemSql = 'INSERT INTO invoice_items (invoice_id, item_id, name, quantity, mrp, price, tax_rate, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
                          conn.query(
                            insertItemSql,
                            [id, it.itemId, it.itemName || it.name || null, qty, Number(it.mrp || 0), price, taxRate, lineTotal],
                            (itemErr) => {
                              if (itemErr) {
                                return conn.rollback(() => {
                                  conn.release();
                                  console.error("Error inserting new item:", itemErr);
                                  res.status(500).json({ message: "Failed to update invoice", error: itemErr.message });
                                });
                              }

                              conn.query(
                                "UPDATE items SET stock = stock + ? WHERE id = ?",
                                [stockDelta, it.itemId],
                                (stockErr) => {
                                  if (stockErr) {
                                    return conn.rollback(() => {
                                      conn.release();
                                      console.error("Error updating stock:", stockErr);
                                      res.status(500).json({ message: "Failed to update invoice", error: stockErr.message });
                                    });
                                  }

                                  itemIdx++;
                                  processNewItem();
                                }
                              );
                            }
                          );
                        };

                        processNewItem();
                      }
                    );
                  });
                }
              );
              return;
            }

            const row = oldItemsArr[idx];
            const qty = Number(row.quantity || 0);
            const itemId = Number(row.item_id);
            const reverseStock = -getStockDelta(oldInv.type, qty);

            conn.query(
              "UPDATE items SET stock = stock + ? WHERE id = ?",
              [reverseStock, itemId],
              (stockErr) => {
                if (stockErr) {
                  return conn.rollback(() => {
                    conn.release();
                    console.error("Error reversing stock:", stockErr);
                    res.status(500).json({ message: "Failed to update invoice", error: stockErr.message });
                  });
                }
                reverseOldStock(idx + 1);
              }
            );
          };

          reverseOldStock(0);
        });
      });
    });
  });
};

// ==============================
// DELETE /api/invoices/:id
// ==============================
exports.deleteInvoice = (req, res) => {
  const { id } = req.params;

  pool.getConnection((connErr, conn) => {
    if (connErr) {
      console.error("Error getting connection:", connErr);
      return res.status(500).json({ message: "Failed to delete invoice", error: connErr.message });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        console.error("Transaction error:", txErr);
        return res.status(500).json({ message: "Failed to delete invoice", error: txErr.message });
      }

      // 1) Load invoice
      conn.query("SELECT * FROM invoices WHERE id = ? LIMIT 1", [id], (invErr, invRows) => {
        if (invErr) {
          return conn.rollback(() => {
            conn.release();
            console.error("Error fetching invoice:", invErr);
            res.status(500).json({ message: "Failed to delete invoice", error: invErr.message });
          });
        }

        if (!invRows || invRows.length === 0) {
          return conn.rollback(() => {
            conn.release();
            res.status(404).json({ message: "Invoice not found" });
          });
        }

        const inv = invRows[0];

        // Optional: block delete for return invoices if you want (you can remove this)
        // if (inv.type === "RETURN" || inv.type === "PURCHASE_RETURN") {
        //   return conn.rollback(() => {
        //     conn.release();
        //     res.status(400).json({ message: "Cannot delete return invoices" });
        //   });
        // }

        // 2) Load invoice items
        conn.query("SELECT * FROM invoice_items WHERE invoice_id = ?", [id], (itemsErr, itemRows) => {
          if (itemsErr) {
            return conn.rollback(() => {
              conn.release();
              console.error("Error fetching invoice items:", itemsErr);
              res.status(500).json({ message: "Failed to delete invoice", error: itemsErr.message });
            });
          }

          const items = Array.isArray(itemRows) ? itemRows : [];

          // 3) Reverse stock for each item (undo original invoice effect)
          const reverseOne = (idx) => {
            if (idx >= items.length) {
              // 4) Reverse party balance (undo original invoice effect)
              const total = Number(inv.total_amount || 0);
              const partyId = Number(inv.party_id);

              const balDelta = -getBalanceDelta(inv.type, total); // reverse
              conn.query(
                "UPDATE parties SET balance = balance + ? WHERE id = ?",
                [balDelta, partyId],
                (balErr) => {
                  if (balErr) {
                    return conn.rollback(() => {
                      conn.release();
                      console.error("Error reversing party balance:", balErr);
                      res.status(500).json({ message: "Failed to delete invoice", error: balErr.message });
                    });
                  }

                  // 5) Delete invoice items then invoice
                  conn.query("DELETE FROM invoice_items WHERE invoice_id = ?", [id], (delItemsErr) => {
                    if (delItemsErr) {
                      return conn.rollback(() => {
                        conn.release();
                        console.error("Error deleting invoice items:", delItemsErr);
                        res.status(500).json({ message: "Failed to delete invoice", error: delItemsErr.message });
                      });
                    }

                    conn.query("DELETE FROM invoices WHERE id = ?", [id], (delInvErr, delInvResult) => {
                      if (delInvErr) {
                        return conn.rollback(() => {
                          conn.release();
                          console.error("Error deleting invoice:", delInvErr);
                          res.status(500).json({ message: "Failed to delete invoice", error: delInvErr.message });
                        });
                      }

                      if (!delInvResult || delInvResult.affectedRows === 0) {
                        return conn.rollback(() => {
                          conn.release();
                          res.status(404).json({ message: "Invoice not found" });
                        });
                      }

                      conn.commit((commitErr) => {
                        if (commitErr) {
                          return conn.rollback(() => {
                            conn.release();
                            console.error("Commit error:", commitErr);
                            res.status(500).json({ message: "Failed to delete invoice", error: commitErr.message });
                          });
                        }

                        conn.release();
                        return res.status(204).send();
                      });
                    });
                  });
                }
              );

              return;
            }

            const row = items[idx];
            const qty = Number(row.quantity || 0);
            const itemId = Number(row.item_id);

            // Reverse stock delta
            const reverseStock = -getStockDelta(inv.type, qty);

            conn.query(
              "UPDATE items SET stock = stock + ? WHERE id = ?",
              [reverseStock, itemId],
              (stockErr) => {
                if (stockErr) {
                  return conn.rollback(() => {
                    conn.release();
                    console.error("Error reversing stock:", stockErr);
                    res.status(500).json({ message: "Failed to delete invoice", error: stockErr.message });
                  });
                }
                reverseOne(idx + 1);
              }
            );
          };

          reverseOne(0);
        });
      });
    });
  });
};

// ==============================
// POST /api/invoices/:id/purchase-return
// ==============================
exports.applyPurchaseReturn = async (req, res) => {
  const originalId = Number(req.params.id);
  const { items, reason, processedBy } = req.body;

  if (!originalId) return res.status(400).json({ message: "Invalid original invoice id" });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Return items are required" });
  }

  const getConn = () =>
    new Promise((resolve, reject) => {
      pool.getConnection((err, conn) => (err ? reject(err) : resolve(conn)));
    });

  const q = (conn, sql, params = []) =>
    new Promise((resolve, reject) => {
      conn.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
    });

  const begin = (conn) =>
    new Promise((resolve, reject) => conn.beginTransaction((e) => (e ? reject(e) : resolve())));
  const commit = (conn) =>
    new Promise((resolve, reject) => conn.commit((e) => (e ? reject(e) : resolve())));
  const rollback = (conn) => new Promise((resolve) => conn.rollback(() => resolve()));

  let conn;

  try {
    conn = await getConn();
    await begin(conn);

    // ✅ Ensure required columns exist
    const cols = await q(
      conn,
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='invoices'
       AND COLUMN_NAME IN ('original_invoice_id','is_closed')`
    );
    const colNames = (Array.isArray(cols) ? cols : []).map((c) => c.COLUMN_NAME);
    if (!colNames.includes("original_invoice_id")) {
      await rollback(conn);
      conn.release();
      return res.status(500).json({ message: "DB missing column original_invoice_id in invoices table" });
    }
    if (!colNames.includes("is_closed")) {
      await rollback(conn);
      conn.release();
      return res.status(500).json({ message: "DB missing column is_closed in invoices table" });
    }

    // 1) Load original invoice
    const invRows = await q(conn, `SELECT * FROM invoices WHERE id = ? LIMIT 1`, [originalId]);
    const original = Array.isArray(invRows) ? invRows[0] : null;

    if (!original) {
      await rollback(conn);
      conn.release();
      return res.status(404).json({ message: "Original invoice not found" });
    }
    if (original.type !== "PURCHASE") {
      await rollback(conn);
      conn.release();
      return res.status(400).json({ message: "Purchase return allowed only for PURCHASE invoices" });
    }
    if (Number(original.is_closed) === 1) {
      await rollback(conn);
      conn.release();
      return res.status(400).json({ message: "Invoice is closed. Cannot return." });
    }

    // 2) Load invoice items
    const lineRows = await q(conn, `SELECT * FROM invoice_items WHERE invoice_id = ?`, [originalId]);
    const lines = Array.isArray(lineRows) ? lineRows : [];

    if (lines.length === 0) {
      await rollback(conn);
      conn.release();
      return res.status(400).json({ message: "No items found in the original invoice" });
    }

    const lineMap = {};
    for (const r of lines) lineMap[String(r.item_id)] = r;

    // 3) Normalize + Validate payload
    const normalized = items.map((it) => ({
      itemId: String(it.itemId),
      quantity: Number(it.quantity),
    }));

    for (const it of normalized) {
      const row = lineMap[it.itemId];
      if (!row) {
        await rollback(conn);
        conn.release();
        return res.status(400).json({ message: "Return contains an item not in original purchase invoice" });
      }
      if (!it.quantity || it.quantity <= 0) {
        await rollback(conn);
        conn.release();
        return res.status(400).json({ message: "Invalid return quantity" });
      }
      const purchasedQtyLeft = Number(row.quantity || 0);
      if (it.quantity > purchasedQtyLeft) {
        await rollback(conn);
        conn.release();
        return res.status(400).json({ message: "Cannot return more quantity than purchased" });
      }
    }

    const qtyLeftAll = lines.reduce((s, r) => s + Number(r.quantity || 0), 0);
    if (qtyLeftAll <= 0) {
      await rollback(conn);
      conn.release();
      return res.status(400).json({ message: "Invoice already fully returned" });
    }

    // 4) Compute return totals (same math)
    let returnSubtotal = 0;
    let returnTax = 0;

    for (const it of normalized) {
      const row = lineMap[it.itemId];
      const price = Number(row.price || 0);
      const taxRate = Number(row.tax_rate || 0);

      const sub = price * it.quantity;
      const tax = (sub * taxRate) / 100;

      returnSubtotal += sub;
      returnTax += tax;
    }

    const returnGrand = Number((returnSubtotal + returnTax).toFixed(2));

    // 5) Insert purchase return invoice (debit/return note)
    const invoiceNo = `PRN-${Date.now().toString().slice(-8)}`;
    const invoiceDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    const insInv = await q(
      conn,
      `INSERT INTO invoices
       (party_id, invoice_no, type, total_amount, invoice_date, notes, payment_mode, original_invoice_id)
       VALUES (?, ?, 'PURCHASE_RETURN', ?, ?, ?, ?, ?)`,
      [
        original.party_id,
        invoiceNo,
        returnGrand,
        invoiceDate,
        reason ? `Purchase Return: ${reason}` : "Purchase Return",
        original.payment_mode || "CASH",
        originalId,
      ]
    );

    const returnInvoiceId = Number(insInv.insertId);

    // 6) Process each returned item
    for (const it of normalized) {
      const row = lineMap[it.itemId];

      const itemId = Number(it.itemId);
      const qty = Number(it.quantity);
      const price = Number(row.price || 0);
      const taxRate = Number(row.tax_rate || 0);

      const sub = price * qty;
      const tax = (sub * taxRate) / 100;
      const total = Number((sub + tax).toFixed(2));

      const safeName = row.name && String(row.name).trim() ? row.name : "Unknown";

      // insert into purchase return invoice
      await q(
        conn,
        `INSERT INTO invoice_items (invoice_id, item_id, name, quantity, price, tax_rate, total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [returnInvoiceId, itemId, safeName, qty, price, taxRate, total]
      );

      // reduce qty in original purchase invoice
      const newQty = Number(row.quantity || 0) - qty;
      const newSub = price * newQty;
      const newTax = (newSub * taxRate) / 100;
      const newTotal = Number((newSub + newTax).toFixed(2));

      await q(conn, `UPDATE invoice_items SET quantity = ?, total = ? WHERE id = ?`, [
        newQty,
        newTotal,
        row.id,
      ]);

      // ✅ stock decreases because items sent back to supplier
      await q(conn, `UPDATE items SET stock = stock - ? WHERE id = ?`, [qty, itemId]);

      // ✅ audit table (optional) — only if exists
      // ✅ audit (now table exists)
      await q(
        conn,
        `INSERT INTO purchase_return_audit
   (original_invoice_id, return_invoice_id, item_id, quantity, reason, processed_by)
   VALUES (?, ?, ?, ?, ?, ?)`,
        [originalId, returnInvoiceId, itemId, qty, reason || null, processedBy || "Unknown"]
      );

    }

    // 7) Update original invoice total_amount
    const newTotals = await q(
      conn,
      `SELECT COALESCE(SUM(total),0) AS total_amount FROM invoice_items WHERE invoice_id = ?`,
      [originalId]
    );
    const newTotalAmount = Number((newTotals?.[0]?.total_amount || 0));

    await q(conn, `UPDATE invoices SET total_amount = ? WHERE id = ?`, [newTotalAmount, originalId]);

    // 8) ✅ party balance adjustment
    // PURCHASE makes balance negative (we owe supplier).
    // PURCHASE_RETURN means we owe less, so balance should increase (+ returnGrand).
    await q(conn, `UPDATE parties SET balance = balance + ? WHERE id = ?`, [
      returnGrand,
      original.party_id,
    ]);

    // 9) close if fully returned
    const left = await q(
      conn,
      `SELECT COALESCE(SUM(quantity),0) AS qty_left FROM invoice_items WHERE invoice_id = ?`,
      [originalId]
    );
    const qtyLeft = Number(left?.[0]?.qty_left || 0);
    if (qtyLeft <= 0) {
      await q(conn, `UPDATE invoices SET is_closed = 1 WHERE id = ?`, [originalId]);
    }

    await commit(conn);
    conn.release();

    return res.json({ message: "Purchase return processed", returnInvoiceId: String(returnInvoiceId) });
  } catch (err) {
    console.error("Purchase return error:", err);
    if (conn) {
      try {
        await rollback(conn);
        conn.release();
      } catch { }
    }
    return res.status(500).json({
      message: "Failed to process purchase return",
      error: err?.message || String(err),
    });
  }
};

// ==============================
// POST /api/invoices/:id/sale-return
// ==============================
// ==============================
// POST /api/invoices/:id/sale-return
// ==============================
exports.applySaleReturn = async (req, res) => {
  const originalId = Number(req.params.id);
  const { items, reason, processedBy } = req.body;

  if (!originalId) return res.status(400).json({ message: "Invalid original invoice id" });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Return items are required" });
  }

  const getConn = () =>
    new Promise((resolve, reject) => {
      pool.getConnection((err, conn) => (err ? reject(err) : resolve(conn)));
    });

  const q = (conn, sql, params = []) =>
    new Promise((resolve, reject) => {
      conn.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
    });

  const begin = (conn) => new Promise((resolve, reject) => conn.beginTransaction((e) => (e ? reject(e) : resolve())));
  const commit = (conn) => new Promise((resolve, reject) => conn.commit((e) => (e ? reject(e) : resolve())));
  const rollback = (conn) => new Promise((resolve) => conn.rollback(() => resolve()));

  let conn;

  try {
    conn = await getConn();
    await begin(conn);

    // ✅ Ensure required columns exist (fails fast with clear message)
    const cols = await q(
      conn,
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='invoices'
       AND COLUMN_NAME IN ('original_invoice_id','is_closed')`
    );
    const colNames = (Array.isArray(cols) ? cols : []).map((c) => c.COLUMN_NAME);
    if (!colNames.includes("original_invoice_id")) {
      await rollback(conn);
      conn.release();
      return res.status(500).json({ message: "DB missing column original_invoice_id in invoices table" });
    }
    if (!colNames.includes("is_closed")) {
      await rollback(conn);
      conn.release();
      return res.status(500).json({ message: "DB missing column is_closed in invoices table" });
    }

    // 1) Load original invoice
    const invRows = await q(conn, `SELECT * FROM invoices WHERE id = ? LIMIT 1`, [originalId]);
    const original = Array.isArray(invRows) ? invRows[0] : null;

    if (!original) {
      await rollback(conn);
      conn.release();
      return res.status(404).json({ message: "Original invoice not found" });
    }
    if (original.type !== "SALE") {
      await rollback(conn);
      conn.release();
      return res.status(400).json({ message: "Sale return allowed only for SALE invoices" });
    }
    if (Number(original.is_closed) === 1) {
      await rollback(conn);
      conn.release();
      return res.status(400).json({ message: "Invoice is closed. Cannot return." });
    }

    // 2) Load invoice items
    const lineRows = await q(conn, `SELECT * FROM invoice_items WHERE invoice_id = ?`, [originalId]);
    const lines = Array.isArray(lineRows) ? lineRows : [];

    if (lines.length === 0) {
      await rollback(conn);
      conn.release();
      return res.status(400).json({ message: "No items found in the original invoice" });
    }

    const lineMap = {};
    for (const r of lines) lineMap[String(r.item_id)] = r;

    // 3) Normalize + Validate payload
    const normalized = items.map((it) => ({
      itemId: String(it.itemId),
      quantity: Number(it.quantity),
    }));

    for (const it of normalized) {
      const row = lineMap[it.itemId];
      if (!row) {
        await rollback(conn);
        conn.release();
        return res.status(400).json({ message: "Return contains an item not in original invoice" });
      }
      if (!it.quantity || it.quantity <= 0) {
        await rollback(conn);
        conn.release();
        return res.status(400).json({ message: "Invalid return quantity" });
      }
      const soldQtyLeft = Number(row.quantity || 0);
      if (it.quantity > soldQtyLeft) {
        await rollback(conn);
        conn.release();
        return res.status(400).json({ message: "Cannot return more quantity than sold" });
      }
    }

    const qtyLeftAll = lines.reduce((s, r) => s + Number(r.quantity || 0), 0);
    if (qtyLeftAll <= 0) {
      await rollback(conn);
      conn.release();
      return res.status(400).json({ message: "Invoice already fully returned" });
    }

    // 4) Compute return totals
    let returnSubtotal = 0;
    let returnTax = 0;

    for (const it of normalized) {
      const row = lineMap[it.itemId];
      const price = Number(row.price || 0);
      const taxRate = Number(row.tax_rate || 0);

      const sub = price * it.quantity;
      const tax = (sub * taxRate) / 100;

      returnSubtotal += sub;
      returnTax += tax;
    }

    const returnGrand = Number((returnSubtotal + returnTax).toFixed(2));

    // 5) Insert return invoice (credit note)
    const invoiceNo = `CN-${Date.now().toString().slice(-8)}`;
    const invoiceDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    const insInv = await q(
      conn,
      `INSERT INTO invoices
       (party_id, invoice_no, type, total_amount, invoice_date, notes, payment_mode, original_invoice_id)
       VALUES (?, ?, 'RETURN', ?, ?, ?, ?, ?)`,
      [
        original.party_id,
        invoiceNo,
        returnGrand,
        invoiceDate,
        reason ? `Return: ${reason}` : "Sale Return",
        original.payment_mode || "CASH",
        originalId,
      ]
    );

    const returnInvoiceId = Number(insInv.insertId);

    // 6) Process each returned item
    for (const it of normalized) {
      const row = lineMap[it.itemId];

      const itemId = Number(it.itemId);
      const qty = Number(it.quantity);
      const price = Number(row.price || 0);
      const taxRate = Number(row.tax_rate || 0);

      const sub = price * qty;
      const tax = (sub * taxRate) / 100;
      const total = Number((sub + tax).toFixed(2));

      // ✅ insert return invoice item with safe name
      const safeName = row.name && String(row.name).trim() ? row.name : "Unknown";

      await q(
        conn,
        `INSERT INTO invoice_items (invoice_id, item_id, name, quantity, price, tax_rate, total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [returnInvoiceId, itemId, safeName, qty, price, taxRate, total]
      );

      // ✅ reduce original invoice item qty + total
      const newQty = Number(row.quantity || 0) - qty;
      const newSub = price * newQty;
      const newTax = (newSub * taxRate) / 100;
      const newTotal = Number((newSub + newTax).toFixed(2));

      await q(conn, `UPDATE invoice_items SET quantity = ?, total = ? WHERE id = ?`, [
        newQty,
        newTotal,
        row.id,
      ]);

      // ✅ stock back
      await q(conn, `UPDATE items SET stock = stock + ? WHERE id = ?`, [qty, itemId]);

      // ✅ audit
      await q(
        conn,
        `INSERT INTO sale_return_audit
         (original_invoice_id, return_invoice_id, item_id, quantity, reason, processed_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [originalId, returnInvoiceId, itemId, qty, reason || null, processedBy || "Unknown"]
      );
    }

    // 7) Update original invoice total_amount
    const newTotals = await q(
      conn,
      `SELECT COALESCE(SUM(total),0) AS total_amount FROM invoice_items WHERE invoice_id = ?`,
      [originalId]
    );
    const newTotalAmount = Number((newTotals?.[0]?.total_amount || 0));

    await q(conn, `UPDATE invoices SET total_amount = ? WHERE id = ?`, [newTotalAmount, originalId]);

    // 8) party balance decrease
    await q(conn, `UPDATE parties SET balance = balance - ? WHERE id = ?`, [
      returnGrand,
      original.party_id,
    ]);

    // 9) close if fully returned
    const left = await q(
      conn,
      `SELECT COALESCE(SUM(quantity),0) AS qty_left FROM invoice_items WHERE invoice_id = ?`,
      [originalId]
    );
    const qtyLeft = Number(left?.[0]?.qty_left || 0);
    if (qtyLeft <= 0) {
      await q(conn, `UPDATE invoices SET is_closed = 1 WHERE id = ?`, [originalId]);
    }

    await commit(conn);
    conn.release();

    return res.json({ message: "Sale return processed", returnInvoiceId: String(returnInvoiceId) });
  } catch (err) {
    console.error("Sale return error:", err);
    if (conn) {
      try {
        await rollback(conn);
        conn.release();
      } catch { }
    }
    return res.status(500).json({
      message: "Failed to process sale return",
      error: err?.message || String(err),
    });
  }
};


