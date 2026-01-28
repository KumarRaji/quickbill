// src/controllers/purchaseBillController.js
const pool = require("../config/db");

// ✅ GET /api/purchase-bills
exports.getPurchaseBills = (req, res) => {
  const sql = `
    SELECT 
      i.id,
      i.invoice_no AS billNo,
      i.invoice_date AS date,
      s.name AS supplier,
      i.total_amount AS amount,
      i.payment_mode AS paymentMode,
      i.supplier_id AS supplierId,
      i.amount_paid AS amountPaid,
      i.amount_due AS amountDue,
      i.due_status AS dueStatus
    FROM purchase_invoices i
    LEFT JOIN suppliers s ON i.supplier_id = s.id
    ORDER BY i.id DESC
  `;

  pool.query(sql, (err, bills) => {
    if (err) {
      console.error("Error fetching purchase bills:", err);
      return res.status(500).json({ message: "Failed to fetch purchase bills", error: err.message });
    }

    if (!bills || bills.length === 0) return res.json([]);

    const billIds = bills.map((b) => b.id);

    const itemsSql = `
      SELECT invoice_id, item_id, name, quantity, mrp, price, tax_rate, total
      FROM purchase_invoice_items
      WHERE invoice_id IN (?)
      ORDER BY id ASC
    `;

    pool.query(itemsSql, [billIds], (itemsErr, items) => {
      if (itemsErr) {
        console.error("Error fetching purchase bill items:", itemsErr);
        return res.status(500).json({ message: "Failed to fetch purchase bill items", error: itemsErr.message });
      }

      const map = {};
      (items || []).forEach((it) => {
        if (!map[it.invoice_id]) map[it.invoice_id] = [];
        map[it.invoice_id].push({
          itemId: null,
          itemName: it.name,
          quantity: Number(it.quantity),
          mrp: Number(it.mrp || 0),
          price: Number(it.price || 0),
          taxRate: Number(it.tax_rate || 0),
          amount: Number(it.total || 0),
        });
      });

      const response = bills.map((b) => {
        const paid = Number(b.amountPaid || 0);
        const due = b.amountDue != null ? Number(b.amountDue) : Math.max(0, Number(b.amount || 0) - paid);
        const dueStatus = b.dueStatus || (due <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING");
        
        const billItems = (map[b.id] || []);
        const lineSum = billItems.reduce((sum, it) => sum + Number(it.amount || 0), 0);
        
        // Calculate total tax from items
        const totalTax = billItems.reduce((sum, item) => {
          const base = item.quantity * item.price;
          const tax = (base * item.taxRate) / 100;
          return sum + tax;
        }, 0);
        
        const roundOff = Number((Number(b.amount || 0) - lineSum).toFixed(2));

        return {
          id: String(b.id),
          billNo: b.billNo,
          date: b.date,
          supplierId: String(b.supplierId),
          supplier: b.supplier,
          totalAmount: Number(b.amount),
          totalTax: Number(totalTax.toFixed(2)),
          roundOff,
          paymentMode: b.paymentMode,
          amountPaid: paid,
          amountDue: due,
          dueStatus,
          items: billItems,
        };
      });

      return res.json(response);
    });
  });
};

// ✅ POST /api/purchase-bills
exports.createPurchaseBill = (req, res) => {
  const { supplierId, invoiceNo, date, items, totalAmount, notes, paymentMode } = req.body;

  const amountPaidNum = Number(req.body.amountPaid || 0);
  const amountDueNum = Number(req.body.amountDue != null ? req.body.amountDue : Math.max(0, Number(totalAmount || 0) - amountPaidNum));
  const dueStatusVal = req.body.dueStatus || (amountDueNum <= 0 ? "PAID" : amountPaidNum > 0 ? "PARTIAL" : "PENDING");

  const supplierIdNum = Number(supplierId);
  if (!supplierIdNum) return res.status(400).json({ message: "Supplier is required (supplierId)" });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "At least one item is required" });

  const total = Number(totalAmount);
  if (isNaN(total)) return res.status(400).json({ message: "totalAmount must be a number" });

  for (const it of items) {
    const qty = Number(it.quantity);
    const price = Number(it.price);
    if (!it.itemName || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      return res.status(400).json({ message: "Invalid items payload" });
    }
  }

  pool.getConnection((connErr, conn) => {
    if (connErr) return res.status(500).json({ message: "DB connection error", error: connErr.message });

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).json({ message: "Transaction error", error: txErr.message });
      }

      conn.query("SELECT id FROM suppliers WHERE id = ? LIMIT 1", [supplierIdNum], (sErr, sRows) => {
        if (sErr) {
          return conn.rollback(() => {
            conn.release();
            res.status(500).json({ message: "Failed to validate supplier", error: sErr.message });
          });
        }
        if (!sRows || sRows.length === 0) {
          return conn.rollback(() => {
            conn.release();
            res.status(400).json({ message: `Supplier not found: ${supplierIdNum}` });
          });
        }

        const generatedBillNo = invoiceNo || `PB-${Date.now().toString().slice(-8)}`;
        const invSql = `
          INSERT INTO purchase_invoices
          (supplier_id, invoice_no, total_amount, invoice_date, notes, payment_mode, amount_paid, amount_due, due_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        conn.query(
          invSql,
          [
            supplierIdNum,
            generatedBillNo,
            total,
            date ? new Date(date) : new Date(),
            notes || null,
            paymentMode || "CASH",
            amountPaidNum,
            amountDueNum,
            dueStatusVal,
          ],
          (invErr, invResult) => {
            if (invErr) {
              return conn.rollback(() => {
                conn.release();
                res.status(500).json({ message: "Failed to create purchase invoice", error: invErr.message });
              });
            }

            const purchaseInvoiceId = invResult.insertId;
            const itemSql = `
              INSERT INTO purchase_invoice_items
              (invoice_id, item_id, name, quantity, mrp, price, tax_rate, total)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const insertStockSql = `
              INSERT INTO stock
                (name, category, code, barcode, supplier_id, purchase_price, mrp, quantity, unit, tax_rate, purchase_invoice_id, item_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            let idx = 0;
            const next = () => {
              if (idx >= items.length) {
                return conn.commit((cErr) => {
                  if (cErr) {
                    return conn.rollback(() => {
                      conn.release();
                      res.status(500).json({ message: "Commit failed", error: cErr.message });
                    });
                  }
                  conn.release();

                  pool.query(
                    `SELECT 
                      i.id,
                      i.invoice_no,
                      i.total_amount,
                      i.invoice_date,
                      i.notes,
                      i.payment_mode,
                      i.supplier_id,
                      s.name as supplier_name
                    FROM purchase_invoices i
                    LEFT JOIN suppliers s ON i.supplier_id = s.id
                    WHERE i.id = ?`,
                    [purchaseInvoiceId],
                    (invErr, invRows) => {
                      if (invErr || !invRows || invRows.length === 0) {
                        return res.status(500).json({ message: "Failed to fetch created invoice" });
                      }

                      const inv = invRows[0];

                      pool.query(
                        `SELECT invoice_id, item_id, name, quantity, mrp, price, tax_rate, total
                        FROM purchase_invoice_items
                        WHERE invoice_id = ?`,
                        [purchaseInvoiceId],
                        (itemsErr, itemsRows) => {
                          if (itemsErr) itemsRows = [];

                          // Calculate tax total and round off properly
                          const itemsWithTax = (itemsRows || []).map((it) => ({
                            itemId: null,
                            itemName: it.name,
                            quantity: Number(it.quantity),
                            mrp: Number(it.mrp),
                            price: Number(it.price),
                            taxRate: Number(it.tax_rate),
                            amount: Number(it.total),
                          }));

                          // Calculate total tax from items
                          const totalTax = itemsWithTax.reduce((sum, item) => {
                            const base = item.quantity * item.price;
                            const tax = (base * item.taxRate) / 100;
                            return sum + tax;
                          }, 0);

                          const lineSum = itemsWithTax.reduce((s, it) => s + it.amount, 0);
                          const roundOff = Number((Number(inv.total_amount || 0) - lineSum).toFixed(2));

                          const invoice = {
                            id: String(inv.id),
                            invoiceNumber: inv.invoice_no,
                            type: "PURCHASE",
                            partyId: String(inv.supplier_id),
                            partyName: inv.supplier_name || "Unknown Supplier",
                            date: inv.invoice_date,
                            totalAmount: Number(inv.total_amount),
                            totalTax: Number(totalTax.toFixed(2)),
                            status: "UNPAID",
                            paymentMode: inv.payment_mode || "CASH",
                            notes: inv.notes || "",
                            amountPaid: amountPaidNum,
                            amountDue: amountDueNum,
                            dueStatus: dueStatusVal,
                            roundOff,
                            items: itemsWithTax,
                          };

                          res.status(201).json(invoice);
                        }
                      );
                    }
                  );
                });
              }

              const it = items[idx];
              const qty = Number(it.quantity);
              const price = Number(it.price);
              const taxRate = it.taxRate != null ? Number(it.taxRate) : 0;

              const base = qty * price;
              const tax = (base * taxRate) / 100;
              const lineTotal = isNaN(Number(it.total)) ? base + tax : Number(it.total);

              conn.query(
                itemSql,
                [
                  purchaseInvoiceId,
                  null,
                  it.itemName || it.name || null,
                  qty,
                  Number(it.mrp || 0),
                  price,
                  taxRate,
                  lineTotal,
                ],
                (itemErr) => {
                  if (itemErr) {
                    return conn.rollback(() => {
                      conn.release();
                      res.status(500).json({ message: "Failed to create invoice items", error: itemErr.message });
                    });
                  }

                  const stockPayload = [
                    it.itemName || it.name || `Item-${idx}`,
                    it.category || null,
                    it.code || null,
                    it.barcode || null,
                    supplierIdNum,
                    price,
                    Number(it.mrp || 0),
                    qty,
                    it.unit || "PCS",
                    taxRate,
                    purchaseInvoiceId,
                    null,
                  ];

                  conn.query(insertStockSql, stockPayload, (stockErr) => {
                    if (stockErr) {
                      return conn.rollback(() => {
                        conn.release();
                        res.status(500).json({ message: "Failed to record stock entry", error: stockErr.message });
                      });
                    }
                    idx += 1;
                    next();
                  });
                }
              );
            };

            next();
          }
        );
      });
    });
  });
};

// ✅ PATCH /api/purchase-bills/:id
exports.updatePurchaseBill = (req, res) => {
  const { id } = req.params;
  const { supplierId, invoiceNo, date, items, totalAmount, notes, paymentMode } = req.body;

  const total = Number(totalAmount);
  const amountPaidNum = Number(req.body.amountPaid || 0);
  const amountDueNum = Number(req.body.amountDue != null ? req.body.amountDue : Math.max(0, total - amountPaidNum));
  const dueStatusVal = req.body.dueStatus || (amountDueNum <= 0 ? "PAID" : amountPaidNum > 0 ? "PARTIAL" : "PENDING");

  const supplierIdNum = Number(supplierId);
  if (!supplierIdNum) return res.status(400).json({ message: "Supplier is required (supplierId)" });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "At least one item is required" });
  if (isNaN(total)) return res.status(400).json({ message: "totalAmount must be a number" });

  for (const it of items) {
    const qty = Number(it.quantity);
    const price = Number(it.price);
    if (!it.itemName || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      return res.status(400).json({ message: "Invalid items payload" });
    }
  }

  pool.getConnection((connErr, conn) => {
    if (connErr) return res.status(500).json({ message: "DB connection error", error: connErr.message });

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).json({ message: "Transaction error", error: txErr.message });
      }

      conn.query("SELECT id FROM purchase_invoices WHERE id = ? LIMIT 1", [id], (invCheckErr, invRows) => {
        if (invCheckErr) {
          return conn.rollback(() => {
            conn.release();
            res.status(500).json({ message: "Failed to fetch purchase invoice", error: invCheckErr.message });
          });
        }
        if (!invRows || invRows.length === 0) {
          return conn.rollback(() => {
            conn.release();
            res.status(404).json({ message: `Purchase invoice not found: ${id}` });
          });
        }

        conn.query("SELECT id FROM suppliers WHERE id = ? LIMIT 1", [supplierIdNum], (sErr, sRows) => {
          if (sErr) {
            return conn.rollback(() => {
              conn.release();
              res.status(500).json({ message: "Failed to validate supplier", error: sErr.message });
            });
          }
          if (!sRows || sRows.length === 0) {
            return conn.rollback(() => {
              conn.release();
              res.status(400).json({ message: `Supplier not found: ${supplierIdNum}` });
            });
          }

          conn.query("DELETE FROM stock WHERE purchase_invoice_id = ?", [id], (removeStockErr) => {
            if (removeStockErr) {
              return conn.rollback(() => {
                conn.release();
                res.status(500).json({ message: "Failed to clean previous stock entries", error: removeStockErr.message });
              });
            }

            conn.query("DELETE FROM purchase_invoice_items WHERE invoice_id = ?", [id], (delErr) => {
              if (delErr) {
                return conn.rollback(() => {
                  conn.release();
                  res.status(500).json({ message: "Failed to delete old items", error: delErr.message });
                });
              }

              const updateSql = `
                UPDATE purchase_invoices
                SET supplier_id = ?, invoice_no = ?, total_amount = ?, invoice_date = ?, notes = ?, payment_mode = ?, amount_paid = ?, amount_due = ?, due_status = ?
                WHERE id = ?
              `;

              conn.query(
                updateSql,
                [
                  supplierIdNum,
                  invoiceNo || `PB-${Date.now().toString().slice(-8)}`,
                  total,
                  date ? new Date(date) : new Date(),
                  notes || null,
                  paymentMode || "CASH",
                  amountPaidNum,
                  amountDueNum,
                  dueStatusVal,
                  id,
                ],
                (updateErr) => {
                  if (updateErr) {
                    return conn.rollback(() => {
                      conn.release();
                      res.status(500).json({ message: "Failed to update purchase invoice", error: updateErr.message });
                    });
                  }

                  const itemSql = `
                    INSERT INTO purchase_invoice_items
                    (invoice_id, item_id, name, quantity, mrp, price, tax_rate, total)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  `;
                  const insertStockSql = `
                    INSERT INTO stock
                      (name, category, code, barcode, supplier_id, purchase_price, mrp, quantity, unit, tax_rate, purchase_invoice_id, item_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `;

                  let idxInsert = 0;
                  const insertNext = () => {
                    if (idxInsert >= items.length) {
                      return conn.commit((cErr) => {
                        if (cErr) {
                          return conn.rollback(() => {
                            conn.release();
                            res.status(500).json({ message: "Commit failed", error: cErr.message });
                          });
                        }
                        conn.release();
                        res.json({ message: "Purchase bill updated successfully" });
                      });
                    }

                    const it = items[idxInsert];
                    const qty = Number(it.quantity);
                    const price = Number(it.price);
                    const taxRate = it.taxRate != null ? Number(it.taxRate) : 0;

                    const base = qty * price;
                    const tax = (base * taxRate) / 100;
                    const lineTotal = isNaN(Number(it.total)) ? base + tax : Number(it.total);

                    conn.query(
                      itemSql,
                      [
                        id,
                        null,
                        it.itemName || it.name || null,
                        qty,
                        Number(it.mrp || 0),
                        price,
                        taxRate,
                        lineTotal,
                      ],
                      (itemErr) => {
                        if (itemErr) {
                          return conn.rollback(() => {
                            conn.release();
                            res.status(500).json({ message: "Failed to insert invoice items", error: itemErr.message });
                          });
                        }

                        const stockPayload = [
                          it.itemName || it.name || `Item-${idxInsert}`,
                          it.category || null,
                          it.code || null,
                          it.barcode || null,
                          supplierIdNum,
                          price,
                          Number(it.mrp || 0),
                          qty,
                          it.unit || "PCS",
                          taxRate,
                          id,
                          null,
                        ];

                        conn.query(insertStockSql, stockPayload, (stockErr) => {
                          if (stockErr) {
                            return conn.rollback(() => {
                              conn.release();
                              res.status(500).json({ message: "Failed to record stock entry", error: stockErr.message });
                            });
                          }
                          idxInsert += 1;
                          insertNext();
                        });
                      }
                    );
                  };

                  insertNext();
                }
              );
            });
          });
        });
      });
    });
  });
};