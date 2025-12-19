// src/controllers/invoiceController.js
const pool = require("../config/db");

// 👇 Make sure you have a "Cash Customer" in `parties` with this ID
// INSERT INTO parties (name, phone, gstin, balance, address)
// VALUES ('Cash Customer', NULL, NULL, 0, NULL);
const CASH_PARTY_ID = 1;

// ==============================
// Type helpers (IMPORTANT)
// ==============================
function normalizeType(type) {
  return String(type || "").trim().toUpperCase();
}

const ALLOWED_TYPES = ["SALE", "RETURN", "PURCHASE", "PURCHASE_RETURN"];

function assertValidType(type, res) {
  if (!ALLOWED_TYPES.includes(type)) {
    res.status(400).json({
      message: `Invalid invoice type. Allowed: ${ALLOWED_TYPES.join(", ")}`,
    });
    return false;
  }
  return true;
}

// Helper: apply stock impact based on invoice type
function getStockDelta(type, qty) {
  switch (type) {
    case "SALE":
      return -qty;
    case "RETURN":
      return qty;
    case "PURCHASE":
      return qty;
    case "PURCHASE_RETURN":
      return -qty;
    default:
      return 0;
  }
}

// Helper: apply party balance impact based on invoice type
function getBalanceDelta(type, total) {
  switch (type) {
    case "SALE":
      return total;
    case "RETURN":
      return -total;
    case "PURCHASE":
      return -total;
    case "PURCHASE_RETURN":
      return total;
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
      COALESCE(p.name, 'Cash Customer') as party_name,
      orig.invoice_no as original_invoice_no
    FROM sale_invoices i 
    LEFT JOIN parties p ON i.party_id = p.id
    LEFT JOIN sale_invoices orig ON i.original_invoice_id = orig.id
    ORDER BY i.id DESC
  `;

  pool.query(sql, (err, invoices) => {
    if (err) {
      console.error("Error fetching invoices:", err);
      return res
        .status(500)
        .json({ message: "Failed to fetch invoices", error: err.message });
    }

    if (!invoices || invoices.length === 0) {
      return res.json([]);
    }

    const invoiceIds = invoices.map((inv) => inv.id);
    const itemsSql =
      "SELECT * FROM sale_invoice_items WHERE invoice_id IN (?) ORDER BY id ASC";

    pool.query(itemsSql, [invoiceIds], (itemsErr, items) => {
      if (itemsErr) {
        console.error("Error fetching invoice items:", itemsErr);
        return res.status(500).json({
          message: "Failed to fetch invoice items",
          error: itemsErr.message,
        });
      }

      const grouped = {};
      (items || []).forEach((it) => {
        if (!grouped[it.invoice_id]) grouped[it.invoice_id] = [];
        grouped[it.invoice_id].push({
          id: String(it.id),
          itemId: String(it.item_id),
          itemName: it.name,
          quantity: Number(it.quantity),
          mrp: Number(it.mrp || 0),
          price: Number(it.price),
          taxRate: Number(it.tax_rate || 0),
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
          id: String(inv.id),
          partyId: String(inv.party_id),
          invoiceNumber: inv.invoice_no,
          type: inv.type,
          totalAmount: Number(inv.total_amount),
          totalTax,
          date: inv.invoice_date,
          notes: inv.notes,
          paymentMode: inv.payment_mode,
          status: "PAID",
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
  const invoiceSql = "SELECT * FROM sale_invoices WHERE id = ? LIMIT 1";

  pool.query(invoiceSql, [id], (err, rows) => {
    if (err) {
      console.error("Error fetching invoice:", err);
      return res
        .status(500)
        .json({ message: "Failed to fetch invoice", error: err.message });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const inv = rows[0];
    const itemsSql = "SELECT * FROM sale_invoice_items WHERE invoice_id = ?";

    pool.query(itemsSql, [id], (itemsErr, items) => {
      if (itemsErr) {
        console.error("Error fetching invoice items:", itemsErr);
        return res.status(500).json({
          message: "Failed to fetch invoice items",
          error: itemsErr.message,
        });
      }

      const response = {
        id: String(inv.id),
        partyId: String(inv.party_id),
        invoiceNumber: inv.invoice_no,
        type: inv.type,
        totalAmount: Number(inv.total_amount),
        date: inv.invoice_date,
        notes: inv.notes,
        paymentMode: inv.payment_mode,
        items: (items || []).map((it) => ({
          id: String(it.id),
          itemId: String(it.item_id),
          itemName: it.name || "Unknown",
          quantity: Number(it.quantity),
          price: Number(it.price),
          taxRate: Number(it.tax_rate || 0),
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
exports.createInvoice = (req, res) => {
  let { partyId, type, date, items, totalAmount, invoiceNo, notes, paymentMode } =
    req.body;

  // ✅ normalize + validate type (CREATE has no oldInv)
  type = normalizeType(type);
  if (!assertValidType(type, res)) return;

  console.log("📥 Incoming invoice payload:", JSON.stringify(req.body, null, 2));
  console.log("📥 partyId:", partyId, "| type:", type);

  // ✅ PURCHASE / PURCHASE_RETURN must have supplier (not CASH)
  if (
    (type === "PURCHASE" || type === "PURCHASE_RETURN") &&
    (!partyId || partyId === "CASH" || partyId === "cash" || partyId === "")
  ) {
    return res
      .status(400)
      .json({ message: "Supplier is required for purchase invoices" });
  }

  // Handle walk-in customers
  let partyIdNum;
  if (!partyId || partyId === "CASH" || partyId === "cash" || partyId === "") {
    partyIdNum = CASH_PARTY_ID;
  } else {
    partyIdNum = Number(partyId);
    if (!partyIdNum) return res.status(400).json({ message: "Invalid partyId" });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Invalid invoice payload" });
  }

  for (const it of items) {
    if (!it.itemId) {
      return res.status(400).json({ message: "Each item must have itemId" });
    }
    if (it.quantity == null || isNaN(Number(it.quantity))) {
      return res
        .status(400)
        .json({ message: "Each item must have a numeric quantity" });
    }
    if (it.price == null || isNaN(Number(it.price))) {
      return res
        .status(400)
        .json({ message: "Each item must have a numeric price" });
    }
  }

  if (totalAmount == null || isNaN(Number(totalAmount))) {
    return res.status(400).json({
      message: "totalAmount is required and must be a number",
    });
  }

  const total = Number(totalAmount);

  pool.getConnection((connErr, conn) => {
    if (connErr) {
      return res.status(500).json({
        message: "Failed to create invoice",
        error: connErr.message,
        code: connErr.code,
      });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res
          .status(500)
          .json({ message: "Failed to create invoice", error: txErr.message });
      }

      // ✅ For purchase types, sync supplier → parties inside transaction
      const syncSupplier = (callback) => {
        if (
          (type === "PURCHASE" || type === "PURCHASE_RETURN") &&
          partyIdNum !== CASH_PARTY_ID
        ) {
          conn.query(
            "SELECT * FROM suppliers WHERE id = ?",
            [partyIdNum],
            (err, rows) => {
              if (err) return callback(err);
              if (!rows || rows.length === 0) {
                return callback(new Error(`Supplier with ID ${partyIdNum} not found`));
              }

              const supplier = rows[0];
              conn.query(
                `INSERT INTO parties (id, name, phone, gstin, address, balance)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   name = VALUES(name),
                   phone = VALUES(phone),
                   gstin = VALUES(gstin),
                   address = VALUES(address)`,
                [
                  supplier.id,
                  supplier.name,
                  supplier.phone || null,
                  supplier.gstin || null,
                  supplier.address || null,
                  supplier.balance || 0,
                ],
                (syncErr) => callback(syncErr)
              );
            }
          );
        } else {
          callback(null);
        }
      };

      syncSupplier((syncErr) => {
        if (syncErr) {
          return conn.rollback(() => {
            conn.release();
            res.status(500).json({
              message: "Failed to sync supplier data",
              error: syncErr.message,
            });
          });
        }

        // ✅ invoice number (returns => CN)
        const prefix =
          type === "RETURN" || type === "PURCHASE_RETURN" ? "CN" : "TXN";
        const generatedInvoiceNo =
          invoiceNo || `${prefix}-${Date.now().toString().slice(-6)}`;

        const invSql = `
          INSERT INTO sale_invoices
          (party_id, invoice_no, type, total_amount, invoice_date, notes, payment_mode)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        conn.query(
          invSql,
          [
            partyIdNum,
            generatedInvoiceNo,
            type,
            total,
            date ? new Date(date) : new Date(),
            notes || null,
            paymentMode || "CASH",
          ],
          (invErr, invResult) => {
            if (invErr) {
              return conn.rollback(() => {
                conn.release();
                res.status(500).json({
                  message: "Failed to create invoice",
                  error: invErr.message,
                });
              });
            }

            const invoiceId = invResult.insertId;

            const insertItemSql = `
              INSERT INTO sale_invoice_items
              (invoice_id, item_id, name, quantity, mrp, price, tax_rate, total)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const updateStockSql = `UPDATE items SET stock = stock + ? WHERE id = ?`;

            let idx = 0;

            const next = () => {
              if (idx >= items.length) {
                const balanceDelta = getBalanceDelta(type, total);

                conn.query(
                  "UPDATE parties SET balance = balance + ? WHERE id = ?",
                  [balanceDelta, partyIdNum],
                  (balErr) => {
                    if (balErr) {
                      return conn.rollback(() => {
                        conn.release();
                        res.status(500).json({
                          message: "Failed to update party balance",
                          error: balErr.message,
                        });
                      });
                    }

                    conn.commit((commitErr) => {
                      if (commitErr) {
                        return conn.rollback(() => {
                          conn.release();
                          res.status(500).json({
                            message: "Commit failed",
                            error: commitErr.message,
                          });
                        });
                      }

                      conn.release();

                      const totalTax = items.reduce((sum, item) => {
                        const taxAmount =
                          (Number(item.price) *
                            Number(item.quantity) *
                            Number(item.taxRate || 0)) /
                          100;
                        return sum + taxAmount;
                      }, 0);

                      return res.status(201).json({
                        id: String(invoiceId),
                        partyId: String(partyIdNum),
                        invoiceNumber: generatedInvoiceNo,
                        type,
                        totalAmount: total,
                        totalTax,
                        date,
                        notes,
                        paymentMode,
                        status: "PAID",
                        items,
                      });
                    });
                  }
                );
                return;
              }

              const it = items[idx];
              const qty = Number(it.quantity);
              const price = Number(it.price);
              const taxRate = it.taxRate != null ? Number(it.taxRate) : 0;

              const base = qty * price;
              const taxAmount = (base * taxRate) / 100;
              let lineTotal =
                it.total != null ? Number(it.total) : base + taxAmount;
              if (isNaN(lineTotal)) lineTotal = base + taxAmount;

              const stockDelta = getStockDelta(type, qty);

              conn.query(
                insertItemSql,
                [
                  invoiceId,
                  Number(it.itemId),
                  String(it.itemName || it.name || "Unknown"),
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
                      res.status(500).json({
                        message: "Failed to create invoice items",
                        error: itemErr.message,
                      });
                    });
                  }

                  conn.query(
                    updateStockSql,
                    [stockDelta, Number(it.itemId)],
                    (stockErr) => {
                      if (stockErr) {
                        return conn.rollback(() => {
                          conn.release();
                          res.status(500).json({
                            message: "Failed to update stock",
                            error: stockErr.message,
                          });
                        });
                      }

                      idx++;
                      next();
                    }
                  );
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

// ==============================
// PATCH /api/invoices/:id
// ==============================
exports.updateInvoice = (req, res) => {
  const { id } = req.params;
  let { partyId, type, date, items, totalAmount, invoiceNo, notes, paymentMode } =
    req.body;

  pool.getConnection((connErr, conn) => {
    if (connErr) {
      console.error("Error getting connection:", connErr);
      return res
        .status(500)
        .json({ message: "Failed to update invoice", error: connErr.message });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        console.error("Transaction error:", txErr);
        return res
          .status(500)
          .json({ message: "Failed to update invoice", error: txErr.message });
      }

      // 1) Load existing invoice
      conn.query(
        "SELECT * FROM sale_invoices WHERE id = ? LIMIT 1",
        [id],
        (invErr, invRows) => {
          if (invErr) {
            return conn.rollback(() => {
              conn.release();
              console.error("Error fetching invoice:", invErr);
              res.status(500).json({
                message: "Failed to update invoice",
                error: invErr.message,
              });
            });
          }

          if (!invRows || invRows.length === 0) {
            return conn.rollback(() => {
              conn.release();
              res.status(404).json({ message: "Invoice not found" });
            });
          }

          const oldInv = invRows[0];

          // ✅ normalize + validate type (UPDATE can fallback to old type)
          type = normalizeType(type || oldInv.type);
          if (!assertValidType(type, res)) {
            return conn.rollback(() => conn.release());
          }

          // 2) Load old items
          conn.query(
            "SELECT * FROM sale_invoice_items WHERE invoice_id = ?",
            [id],
            (itemsErr, oldItems) => {
              if (itemsErr) {
                return conn.rollback(() => {
                  conn.release();
                  console.error("Error fetching invoice items:", itemsErr);
                  res.status(500).json({
                    message: "Failed to update invoice",
                    error: itemsErr.message,
                  });
                });
              }

              const oldItemsArr = Array.isArray(oldItems) ? oldItems : [];

              // 3) Reverse old stock & balance
              const reverseOldStock = (idx) => {
                if (idx >= oldItemsArr.length) {
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
                          res.status(500).json({
                            message: "Failed to update invoice",
                            error: balErr.message,
                          });
                        });
                      }

                      // 4) Delete old items
                      conn.query(
                        "DELETE FROM sale_invoice_items WHERE invoice_id = ?",
                        [id],
                        (delErr) => {
                          if (delErr) {
                            return conn.rollback(() => {
                              conn.release();
                              console.error("Error deleting old items:", delErr);
                              res.status(500).json({
                                message: "Failed to update invoice",
                                error: delErr.message,
                              });
                            });
                          }

                          // 5) Party
                          let partyIdNum;
                          if (
                            !partyId ||
                            partyId === "CASH" ||
                            partyId === "cash" ||
                            partyId === ""
                          ) {
                            partyIdNum = CASH_PARTY_ID;
                          } else {
                            partyIdNum = Number(partyId);
                            if (!partyIdNum) {
                              return conn.rollback(() => {
                                conn.release();
                                res.status(400).json({ message: "Invalid partyId" });
                              });
                            }
                          }

                          const newItems = Array.isArray(items) ? items : [];
                          if (newItems.length === 0) {
                            return conn.rollback(() => {
                              conn.release();
                              res
                                .status(400)
                                .json({ message: "Invoice must have at least one item" });
                            });
                          }

                          const newTotal = Number(totalAmount || 0);
                          if (isNaN(newTotal)) {
                            return conn.rollback(() => {
                              conn.release();
                              res
                                .status(400)
                                .json({ message: "totalAmount must be a number" });
                            });
                          }

                          const updateSql = `
                            UPDATE sale_invoices
                            SET party_id = ?, invoice_no = ?, type = ?, total_amount = ?, invoice_date = ?, notes = ?, payment_mode = ?
                            WHERE id = ?
                          `;

                          conn.query(
                            updateSql,
                            [
                              partyIdNum,
                              invoiceNo || oldInv.invoice_no,
                              type,
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
                                  res.status(500).json({
                                    message: "Failed to update invoice",
                                    error: updErr.message,
                                  });
                                });
                              }

                              // 6) Insert new items + stock
                              let itemIdx = 0;
                              const insertItemSql =
                                "INSERT INTO sale_invoice_items (invoice_id, item_id, name, quantity, mrp, price, tax_rate, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
                              const stockSql =
                                "UPDATE items SET stock = stock + ? WHERE id = ?";

                              const processNewItem = () => {
                                if (itemIdx >= newItems.length) {
                                  // Apply new balance
                                  const newBalDelta = getBalanceDelta(type, newTotal);

                                  conn.query(
                                    "UPDATE parties SET balance = balance + ? WHERE id = ?",
                                    [newBalDelta, partyIdNum],
                                    (newBalErr) => {
                                      if (newBalErr) {
                                        return conn.rollback(() => {
                                          conn.release();
                                          console.error(
                                            "Error applying new balance:",
                                            newBalErr
                                          );
                                          res.status(500).json({
                                            message: "Failed to update invoice",
                                            error: newBalErr.message,
                                          });
                                        });
                                      }

                                      conn.commit((commitErr) => {
                                        if (commitErr) {
                                          return conn.rollback(() => {
                                            conn.release();
                                            console.error("Commit error:", commitErr);
                                            res.status(500).json({
                                              message: "Failed to update invoice",
                                              error: commitErr.message,
                                            });
                                          });
                                        }

                                        conn.release();

                                        const totalTax = newItems.reduce((sum, item) => {
                                          const taxAmount =
                                            (Number(item.price) *
                                              Number(item.quantity) *
                                              Number(item.taxRate || 0)) /
                                            100;
                                          return sum + taxAmount;
                                        }, 0);

                                        res.json({
                                          id: String(id),
                                          partyId: String(partyIdNum),
                                          invoiceNumber: invoiceNo || oldInv.invoice_no,
                                          type,
                                          totalAmount: newTotal,
                                          totalTax,
                                          date: date || oldInv.invoice_date,
                                          notes:
                                            notes !== undefined ? notes : oldInv.notes,
                                          paymentMode:
                                            paymentMode || oldInv.payment_mode,
                                          status: "PAID",
                                          items: newItems,
                                        });
                                      });
                                    }
                                  );
                                  return;
                                }

                                const it = newItems[itemIdx];

                                if (!it.itemId) {
                                  return conn.rollback(() => {
                                    conn.release();
                                    res.status(400).json({
                                      message: "Each item must have itemId",
                                    });
                                  });
                                }

                                const qty = Number(it.quantity);
                                const price = Number(it.price);
                                const taxRate = it.taxRate != null ? Number(it.taxRate) : 0;

                                if (isNaN(qty) || qty <= 0) {
                                  return conn.rollback(() => {
                                    conn.release();
                                    res.status(400).json({
                                      message: "Each item must have valid quantity",
                                    });
                                  });
                                }
                                if (isNaN(price)) {
                                  return conn.rollback(() => {
                                    conn.release();
                                    res.status(400).json({
                                      message: "Each item must have valid price",
                                    });
                                  });
                                }

                                const base = qty * price;
                                const taxAmount = (base * taxRate) / 100;
                                let lineTotal =
                                  it.total != null ? Number(it.total) : base + taxAmount;
                                if (isNaN(lineTotal)) lineTotal = base + taxAmount;

                                const stockDelta = getStockDelta(type, qty);

                                conn.query(
                                  insertItemSql,
                                  [
                                    id,
                                    Number(it.itemId),
                                    String(it.itemName || it.name || "Unknown"),
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
                                        console.error("Error inserting new item:", itemErr);
                                        res.status(500).json({
                                          message: "Failed to update invoice",
                                          error: itemErr.message,
                                        });
                                      });
                                    }

                                    conn.query(
                                      stockSql,
                                      [stockDelta, Number(it.itemId)],
                                      (stockErr) => {
                                        if (stockErr) {
                                          return conn.rollback(() => {
                                            conn.release();
                                            console.error("Error updating stock:", stockErr);
                                            res.status(500).json({
                                              message: "Failed to update invoice",
                                              error: stockErr.message,
                                            });
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
                        }
                      );
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
                        res.status(500).json({
                          message: "Failed to update invoice",
                          error: stockErr.message,
                        });
                      });
                    }
                    reverseOldStock(idx + 1);
                  }
                );
              };

              reverseOldStock(0);
            }
          );
        }
      );
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
      return res
        .status(500)
        .json({ message: "Failed to delete invoice", error: connErr.message });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        console.error("Transaction error:", txErr);
        return res
          .status(500)
          .json({ message: "Failed to delete invoice", error: txErr.message });
      }

      conn.query(
        "SELECT * FROM sale_invoices WHERE id = ? LIMIT 1",
        [id],
        (invErr, invRows) => {
          if (invErr) {
            return conn.rollback(() => {
              conn.release();
              console.error("Error fetching invoice:", invErr);
              res.status(500).json({
                message: "Failed to delete invoice",
                error: invErr.message,
              });
            });
          }

          if (!invRows || invRows.length === 0) {
            return conn.rollback(() => {
              conn.release();
              res.status(404).json({ message: "Invoice not found" });
            });
          }

          const inv = invRows[0];

          conn.query(
            "SELECT * FROM sale_invoice_items WHERE invoice_id = ?",
            [id],
            (itemsErr, itemRows) => {
              if (itemsErr) {
                return conn.rollback(() => {
                  conn.release();
                  console.error("Error fetching invoice items:", itemsErr);
                  res.status(500).json({
                    message: "Failed to delete invoice",
                    error: itemsErr.message,
                  });
                });
              }

              const items = Array.isArray(itemRows) ? itemRows : [];

              const reverseOne = (idx) => {
                if (idx >= items.length) {
                  const total = Number(inv.total_amount || 0);
                  const partyId = Number(inv.party_id);

                  const balDelta = -getBalanceDelta(inv.type, total);

                  conn.query(
                    "UPDATE parties SET balance = balance + ? WHERE id = ?",
                    [balDelta, partyId],
                    (balErr) => {
                      if (balErr) {
                        return conn.rollback(() => {
                          conn.release();
                          console.error("Error reversing party balance:", balErr);
                          res.status(500).json({
                            message: "Failed to delete invoice",
                            error: balErr.message,
                          });
                        });
                      }

                      conn.query(
                        "DELETE FROM sale_invoice_items WHERE invoice_id = ?",
                        [id],
                        (delItemsErr) => {
                          if (delItemsErr) {
                            return conn.rollback(() => {
                              conn.release();
                              console.error(
                                "Error deleting invoice items:",
                                delItemsErr
                              );
                              res.status(500).json({
                                message: "Failed to delete invoice",
                                error: delItemsErr.message,
                              });
                            });
                          }

                          conn.query(
                            "DELETE FROM sale_invoices WHERE id = ?",
                            [id],
                            (delInvErr, delInvResult) => {
                              if (delInvErr) {
                                return conn.rollback(() => {
                                  conn.release();
                                  console.error("Error deleting invoice:", delInvErr);
                                  res.status(500).json({
                                    message: "Failed to delete invoice",
                                    error: delInvErr.message,
                                  });
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
                                    res.status(500).json({
                                      message: "Failed to delete invoice",
                                      error: commitErr.message,
                                    });
                                  });
                                }

                                conn.release();
                                return res.status(204).send();
                              });
                            }
                          );
                        }
                      );
                    }
                  );

                  return;
                }

                const row = items[idx];
                const qty = Number(row.quantity || 0);
                const itemId = Number(row.item_id);
                const reverseStock = -getStockDelta(inv.type, qty);

                conn.query(
                  "UPDATE items SET stock = stock + ? WHERE id = ?",
                  [reverseStock, itemId],
                  (stockErr) => {
                    if (stockErr) {
                      return conn.rollback(() => {
                        conn.release();
                        console.error("Error reversing stock:", stockErr);
                        res.status(500).json({
                          message: "Failed to delete invoice",
                          error: stockErr.message,
                        });
                      });
                    }
                    reverseOne(idx + 1);
                  }
                );
              };

              reverseOne(0);
            }
          );
        }
      );
    });
  });
};


// ==============================
// POST /api/invoices/:id/sale-return
// Body: { items:[{itemId, quantity}], reason?, processedBy? }
// ==============================
exports.applySaleReturn = (req, res) => {
  const originalId = Number(req.params.id);
  const { items, reason } = req.body;

  if (!originalId) return res.status(400).json({ message: "Invalid invoice id" });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Return items are required" });
  }

  pool.getConnection((connErr, conn) => {
    if (connErr) return res.status(500).json({ message: "Failed to process return", error: connErr.message });

    const rollback = (status, payload) =>
      conn.rollback(() => {
        conn.release();
        res.status(status).json(payload);
      });

    conn.beginTransaction((txErr) => {
      if (txErr) return rollback(500, { message: "Failed to process return", error: txErr.message });

      // 1) Load original invoice (must be SALE and not closed)
      conn.query(
        "SELECT * FROM sale_invoices WHERE id = ? LIMIT 1",
        [originalId],
        (invErr, invRows) => {
          if (invErr) return rollback(500, { message: "Failed to load invoice", error: invErr.message });
          if (!invRows || invRows.length === 0) return rollback(404, { message: "Invoice not found" });

          const original = invRows[0];
          if (original.type !== "SALE") {
            return rollback(400, { message: "Sale return allowed only for SALE invoices" });
          }
          if (Number(original.is_closed) === 1) {
            return rollback(400, { message: "Invoice is closed. Cannot return." });
          }

          // 2) Load original items
          conn.query(
            "SELECT * FROM sale_invoice_items WHERE invoice_id = ?",
            [originalId],
            (itemsErr, origItems) => {
              if (itemsErr) return rollback(500, { message: "Failed to load invoice items", error: itemsErr.message });

              const lines = Array.isArray(origItems) ? origItems : [];
              if (lines.length === 0) return rollback(400, { message: "No items found in original invoice" });

              const lineMap = {};
              lines.forEach((r) => (lineMap[String(r.item_id)] = r));

              // 3) Normalize + validate return payload
              const normalized = items.map((it) => ({
                itemId: String(it.itemId),
                quantity: Number(it.quantity),
              }));

              for (const it of normalized) {
                const row = lineMap[it.itemId];
                if (!row) return rollback(400, { message: `Item ${it.itemId} not found in original invoice` });

                if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
                  return rollback(400, { message: "Invalid return quantity" });
                }

                const qtyLeft = Number(row.quantity || 0);
                if (it.quantity > qtyLeft) {
                  return rollback(400, { message: `Cannot return more than sold. Item ${it.itemId} left: ${qtyLeft}` });
                }
              }

              // 4) Compute return totals (base + tax)
              let returnGrand = 0;
              const computedItems = normalized.map((it) => {
                const row = lineMap[it.itemId];
                const price = Number(row.price || 0);
                const taxRate = Number(row.tax_rate || 0);

                const sub = price * it.quantity;
                const tax = (sub * taxRate) / 100;
                const total = Number((sub + tax).toFixed(2));

                returnGrand += total;

                return {
                  item_id: Number(it.itemId),
                  name: row.name && String(row.name).trim() ? row.name : "Unknown",
                  mrp: Number(row.mrp || 0),
                  price,
                  tax_rate: taxRate,
                  quantity: it.quantity,
                  total,
                  original_row_id: row.id,
                  original_qty_left: Number(row.quantity || 0),
                };
              });

              returnGrand = Number(returnGrand.toFixed(2));

              // 5) Insert RETURN invoice
              const returnInvoiceNo = `CN-${Date.now().toString().slice(-8)}`;
              conn.query(
                `INSERT INTO sale_invoices
                 (party_id, invoice_no, type, total_amount, invoice_date, notes, payment_mode, original_invoice_id)
                 VALUES (?, ?, 'RETURN', ?, ?, ?, ?, ?)`,
                [
                  original.party_id,
                  returnInvoiceNo,
                  returnGrand,
                  new Date(),
                  reason ? `Sale Return: ${reason}` : `Sale Return for ${original.invoice_no}`,
                  original.payment_mode || "CASH",
                  originalId,
                ],
                (insErr, insRes) => {
                  if (insErr) return rollback(500, { message: "Failed to create return invoice", error: insErr.message });

                  const returnInvoiceId = insRes.insertId;

                  // 6) Insert return items + update original qty + stock back
                  let idx = 0;
                  const insertSql =
                    "INSERT INTO sale_invoice_items (invoice_id, item_id, name, quantity, mrp, price, tax_rate, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

                  const step = () => {
                    if (idx >= computedItems.length) {
                      // 7) Update original invoice totals
                      conn.query(
                        "SELECT COALESCE(SUM(total),0) AS total_amount FROM sale_invoice_items WHERE invoice_id = ?",
                        [originalId],
                        (sumErr, sumRows) => {
                          if (sumErr) return rollback(500, { message: "Failed to recalc original total", error: sumErr.message });

                          const newOriginalTotal = Number(sumRows?.[0]?.total_amount || 0);

                          conn.query(
                            "UPDATE sale_invoices SET total_amount = ? WHERE id = ?",
                            [newOriginalTotal, originalId],
                            (updTotErr) => {
                              if (updTotErr) return rollback(500, { message: "Failed to update original total", error: updTotErr.message });

                              // 8) party balance: SALE_RETURN means customer owes less => balance -= returnGrand
                              conn.query(
                                "UPDATE parties SET balance = balance - ? WHERE id = ?",
                                [returnGrand, original.party_id],
                                (balErr) => {
                                  if (balErr) return rollback(500, { message: "Failed to update party balance", error: balErr.message });

                                  // 9) close if fully returned (all qty left = 0)
                                  conn.query(
                                    "SELECT COALESCE(SUM(quantity),0) AS qty_left FROM sale_invoice_items WHERE invoice_id = ?",
                                    [originalId],
                                    (leftErr, leftRows) => {
                                      if (leftErr) return rollback(500, { message: "Failed to check qty left", error: leftErr.message });

                                      const qtyLeft = Number(leftRows?.[0]?.qty_left || 0);
                                      const closeSql = qtyLeft <= 0 ? "UPDATE sale_invoices SET is_closed = 1 WHERE id = ?" : null;

                                      const finish = () => {
                                        conn.commit((cErr) => {
                                          if (cErr) return rollback(500, { message: "Commit failed", error: cErr.message });
                                          conn.release();
                                          return res.status(201).json({
                                            message: "Sale return processed",
                                            returnInvoiceId: String(returnInvoiceId),
                                            invoiceNumber: returnInvoiceNo,
                                            totalAmount: returnGrand,
                                          });
                                        });
                                      };

                                      if (!closeSql) return finish();

                                      conn.query(closeSql, [originalId], (closeErr) => {
                                        if (closeErr) return rollback(500, { message: "Failed to close invoice", error: closeErr.message });
                                        finish();
                                      });
                                    }
                                  );
                                }
                              );
                            }
                          );
                        }
                      );
                      return;
                    }

                    const it = computedItems[idx];

                    conn.query(
                      insertSql,
                      [returnInvoiceId, it.item_id, it.name, it.quantity, it.mrp, it.price, it.tax_rate, it.total],
                      (itemErr) => {
                        if (itemErr) return rollback(500, { message: "Failed to insert return item", error: itemErr.message });

                        // reduce qty left in original invoice item row
                        const newQty = it.original_qty_left - it.quantity;
                        const newSub = it.price * newQty;
                        const newTax = (newSub * it.tax_rate) / 100;
                        const newTotal = Number((newSub + newTax).toFixed(2));

                        conn.query(
                          "UPDATE sale_invoice_items SET quantity = ?, total = ? WHERE id = ?",
                          [newQty, newTotal, it.original_row_id],
                          (updLineErr) => {
                            if (updLineErr) return rollback(500, { message: "Failed to update original item qty", error: updLineErr.message });

                            // stock back
                            conn.query(
                              "UPDATE items SET stock = stock + ? WHERE id = ?",
                              [it.quantity, it.item_id],
                              (stockErr) => {
                                if (stockErr) return rollback(500, { message: "Failed to update stock", error: stockErr.message });
                                idx++;
                                step();
                              }
                            );
                          }
                        );
                      }
                    );
                  };

                  step();
                }
              );
            }
          );
        }
      );
    });
  });
};

// ==============================
// POST /api/invoices/:id/purchase-return
// Body: { items:[{itemId, quantity}], reason?, processedBy? }
// ==============================
exports.applyPurchaseReturn = (req, res) => {
  const originalId = Number(req.params.id);
  const { items, reason } = req.body;

  if (!originalId) return res.status(400).json({ message: "Invalid invoice id" });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Return items are required" });
  }

  pool.getConnection((connErr, conn) => {
    if (connErr) return res.status(500).json({ message: "Failed to process return", error: connErr.message });

    const rollback = (status, payload) =>
      conn.rollback(() => {
        conn.release();
        res.status(status).json(payload);
      });

    conn.beginTransaction((txErr) => {
      if (txErr) return rollback(500, { message: "Failed to process return", error: txErr.message });

      // 1) Load original invoice (must be PURCHASE and not closed)
      conn.query(
        "SELECT * FROM sale_invoices WHERE id = ? LIMIT 1",
        [originalId],
        (invErr, invRows) => {
          if (invErr) return rollback(500, { message: "Failed to load invoice", error: invErr.message });
          if (!invRows || invRows.length === 0) return rollback(404, { message: "Invoice not found" });

          const original = invRows[0];
          if (original.type !== "PURCHASE") {
            return rollback(400, { message: "Purchase return allowed only for PURCHASE invoices" });
          }
          if (Number(original.is_closed) === 1) {
            return rollback(400, { message: "Invoice is closed. Cannot return." });
          }

          // 2) Load original items
          conn.query(
            "SELECT * FROM sale_invoice_items WHERE invoice_id = ?",
            [originalId],
            (itemsErr, origItems) => {
              if (itemsErr) return rollback(500, { message: "Failed to load invoice items", error: itemsErr.message });

              const lines = Array.isArray(origItems) ? origItems : [];
              if (lines.length === 0) return rollback(400, { message: "No items found in original invoice" });

              const lineMap = {};
              lines.forEach((r) => (lineMap[String(r.item_id)] = r));

              // 3) Normalize + validate
              const normalized = items.map((it) => ({
                itemId: String(it.itemId),
                quantity: Number(it.quantity),
              }));

              for (const it of normalized) {
                const row = lineMap[it.itemId];
                if (!row) return rollback(400, { message: `Item ${it.itemId} not found in original invoice` });

                if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
                  return rollback(400, { message: "Invalid return quantity" });
                }

                const qtyLeft = Number(row.quantity || 0);
                if (it.quantity > qtyLeft) {
                  return rollback(400, { message: `Cannot return more than purchased. Item ${it.itemId} left: ${qtyLeft}` });
                }
              }

              // 4) Compute totals (base + tax)
              let returnGrand = 0;
              const computedItems = normalized.map((it) => {
                const row = lineMap[it.itemId];
                const price = Number(row.price || 0);
                const taxRate = Number(row.tax_rate || 0);

                const sub = price * it.quantity;
                const tax = (sub * taxRate) / 100;
                const total = Number((sub + tax).toFixed(2));

                returnGrand += total;

                return {
                  item_id: Number(it.itemId),
                  name: row.name && String(row.name).trim() ? row.name : "Unknown",
                  mrp: Number(row.mrp || 0),
                  price,
                  tax_rate: taxRate,
                  quantity: it.quantity,
                  total,
                  original_row_id: row.id,
                  original_qty_left: Number(row.quantity || 0),
                };
              });

              returnGrand = Number(returnGrand.toFixed(2));

              // 5) Insert PURCHASE_RETURN invoice
              const returnInvoiceNo = `PRN-${Date.now().toString().slice(-8)}`;
              conn.query(
                `INSERT INTO sale_invoices
                 (party_id, invoice_no, type, total_amount, invoice_date, notes, payment_mode, original_invoice_id)
                 VALUES (?, ?, 'PURCHASE_RETURN', ?, ?, ?, ?, ?)`,
                [
                  original.party_id,
                  returnInvoiceNo,
                  returnGrand,
                  new Date(),
                  reason ? `Purchase Return: ${reason}` : `Purchase Return for ${original.invoice_no}`,
                  original.payment_mode || "CASH",
                  originalId,
                ],
                (insErr, insRes) => {
                  if (insErr) return rollback(500, { message: "Failed to create return invoice", error: insErr.message });

                  const returnInvoiceId = insRes.insertId;

                  // 6) Insert return items + update original qty + stock decreases (sent back to supplier)
                  let idx = 0;
                  const insertSql =
                    "INSERT INTO sale_invoice_items (invoice_id, item_id, name, quantity, mrp, price, tax_rate, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

                  const step = () => {
                    if (idx >= computedItems.length) {
                      // 7) Recalc original invoice totals
                      conn.query(
                        "SELECT COALESCE(SUM(total),0) AS total_amount FROM sale_invoice_items WHERE invoice_id = ?",
                        [originalId],
                        (sumErr, sumRows) => {
                          if (sumErr) return rollback(500, { message: "Failed to recalc original total", error: sumErr.message });

                          const newOriginalTotal = Number(sumRows?.[0]?.total_amount || 0);

                          conn.query(
                            "UPDATE sale_invoices SET total_amount = ? WHERE id = ?",
                            [newOriginalTotal, originalId],
                            (updTotErr) => {
                              if (updTotErr) return rollback(500, { message: "Failed to update original total", error: updTotErr.message });

                              // 8) party balance: PURCHASE_RETURN means we owe supplier less => balance += returnGrand
                              conn.query(
                                "UPDATE parties SET balance = balance + ? WHERE id = ?",
                                [returnGrand, original.party_id],
                                (balErr) => {
                                  if (balErr) return rollback(500, { message: "Failed to update party balance", error: balErr.message });

                                  // 9) close if fully returned
                                  conn.query(
                                    "SELECT COALESCE(SUM(quantity),0) AS qty_left FROM sale_invoice_items WHERE invoice_id = ?",
                                    [originalId],
                                    (leftErr, leftRows) => {
                                      if (leftErr) return rollback(500, { message: "Failed to check qty left", error: leftErr.message });

                                      const qtyLeft = Number(leftRows?.[0]?.qty_left || 0);
                                      const closeSql = qtyLeft <= 0 ? "UPDATE sale_invoices SET is_closed = 1 WHERE id = ?" : null;

                                      const finish = () => {
                                        conn.commit((cErr) => {
                                          if (cErr) return rollback(500, { message: "Commit failed", error: cErr.message });
                                          conn.release();
                                          return res.status(201).json({
                                            message: "Purchase return processed",
                                            returnInvoiceId: String(returnInvoiceId),
                                            invoiceNumber: returnInvoiceNo,
                                            totalAmount: returnGrand,
                                          });
                                        });
                                      };

                                      if (!closeSql) return finish();

                                      conn.query(closeSql, [originalId], (closeErr) => {
                                        if (closeErr) return rollback(500, { message: "Failed to close invoice", error: closeErr.message });
                                        finish();
                                      });
                                    }
                                  );
                                }
                              );
                            }
                          );
                        }
                      );
                      return;
                    }

                    const it = computedItems[idx];

                    conn.query(
                      insertSql,
                      [returnInvoiceId, it.item_id, it.name, it.quantity, it.mrp, it.price, it.tax_rate, it.total],
                      (itemErr) => {
                        if (itemErr) return rollback(500, { message: "Failed to insert return item", error: itemErr.message });

                        // reduce qty left in original purchase invoice item row
                        const newQty = it.original_qty_left - it.quantity;
                        const newSub = it.price * newQty;
                        const newTax = (newSub * it.tax_rate) / 100;
                        const newTotal = Number((newSub + newTax).toFixed(2));

                        conn.query(
                          "UPDATE sale_invoice_items SET quantity = ?, total = ? WHERE id = ?",
                          [newQty, newTotal, it.original_row_id],
                          (updLineErr) => {
                            if (updLineErr) return rollback(500, { message: "Failed to update original item qty", error: updLineErr.message });

                            // stock decreases
                            conn.query(
                              "UPDATE items SET stock = stock - ? WHERE id = ?",
                              [it.quantity, it.item_id],
                              (stockErr) => {
                                if (stockErr) return rollback(500, { message: "Failed to update stock", error: stockErr.message });
                                idx++;
                                step();
                              }
                            );
                          }
                        );
                      }
                    );
                  };

                  step();
                }
              );
            }
          );
        }
      );
    });
  });
};

