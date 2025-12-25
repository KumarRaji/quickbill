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
      i.supplier_id AS supplierId
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
          itemId: String(it.item_id),
          itemName: it.name,
          quantity: Number(it.quantity),
          mrp: Number(it.mrp || 0),
          price: Number(it.price || 0),
          taxRate: Number(it.tax_rate || 0),
          amount: Number(it.total || 0),
        });
      });

      const response = bills.map((b) => ({
        id: String(b.id),
        billNo: b.billNo,
        date: b.date,
        supplierId: String(b.supplierId),
        supplier: b.supplier,
        totalAmount: Number(b.amount),
        paymentMode: b.paymentMode,
        items: map[b.id] || [],
      }));

      return res.json(response);
    });
  });
};

// ✅ POST /api/purchase-bills
exports.createPurchaseBill = (req, res) => {
  const { supplierId, invoiceNo, date, items, totalAmount, notes, paymentMode } = req.body;

  // ✅ supplier mandatory
  const supplierIdNum = Number(supplierId);
  if (!supplierIdNum) {
    return res.status(400).json({ message: "Supplier is required (supplierId)" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "At least one item is required" });
  }

  const total = Number(totalAmount);
  if (isNaN(total)) {
    return res.status(400).json({ message: "totalAmount must be a number" });
  }

  for (const it of items) {
    const qty = Number(it.quantity);
    const price = Number(it.price);
    if (!it.itemId || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      return res.status(400).json({ message: "Invalid items payload" });
    }
  }

  pool.getConnection((connErr, conn) => {
    if (connErr) {
      return res.status(500).json({ message: "DB connection error", error: connErr.message });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).json({ message: "Transaction error", error: txErr.message });
      }

      // ✅ ensure supplier exists
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
          (supplier_id, invoice_no, total_amount, invoice_date, notes, payment_mode)
          VALUES (?, ?, ?, ?, ?, ?)
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

            const updateStockSql = `UPDATE items SET stock = stock + ? WHERE id = ?`;

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
                  
                  // ✅ Fetch full invoice data with items and supplier info
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

                          const invoice = {
                            id: String(inv.id),
                            invoiceNumber: inv.invoice_no,
                            type: "PURCHASE",
                            partyId: String(inv.supplier_id),
                            partyName: inv.supplier_name || "Unknown Supplier",
                            date: inv.invoice_date,
                            totalAmount: Number(inv.total_amount),
                            totalTax: 0,
                            status: "UNPAID",
                            paymentMode: inv.payment_mode || "CASH",
                            notes: inv.notes || "",
                            items: (itemsRows || []).map((it) => ({
                              itemId: String(it.item_id),
                              itemName: it.name,
                              quantity: Number(it.quantity),
                              mrp: Number(it.mrp),
                              price: Number(it.price),
                              taxRate: Number(it.tax_rate),
                              amount: Number(it.total),
                            })),
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
              const lineTotal = isNaN(Number(it.total)) ? (base + tax) : Number(it.total);

              conn.query(
                itemSql,
                [
                  purchaseInvoiceId,
                  Number(it.itemId),
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

                  conn.query(updateStockSql, [qty, Number(it.itemId)], (stErr) => {
                    if (stErr) {
                      return conn.rollback(() => {
                        conn.release();
                        res.status(500).json({ message: "Failed to update stock", error: stErr.message });
                      });
                    }
                    idx++;
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
