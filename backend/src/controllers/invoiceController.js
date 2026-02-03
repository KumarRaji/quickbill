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
      return -qty;  // Sale reduces stock
    case "RETURN":
      return qty;   // Return adds stock back
    case "PURCHASE":
      return qty;   // Purchase adds stock
    case "PURCHASE_RETURN":
      return -qty;  // Purchase return reduces stock
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
  // ✅ FETCH FROM BOTH SALE AND PURCHASE INVOICES
  const saleSql = `
    SELECT 
      i.id,
      i.party_id,
      i.invoice_no,
      CASE 
        WHEN i.original_invoice_id IS NOT NULL THEN 'RETURN'
        ELSE 'SALE'
      END as type,
      i.total_amount,
      COALESCE(i.amount_paid, 0) as amount_paid,
      COALESCE(i.amount_due, GREATEST(0, i.total_amount - COALESCE(i.amount_paid,0))) as amount_due,
      COALESCE(i.due_status,
        CASE
          WHEN COALESCE(i.amount_due, GREATEST(0, i.total_amount - COALESCE(i.amount_paid,0))) <= 0 THEN 'PAID'
          WHEN COALESCE(i.amount_paid,0) > 0 THEN 'PARTIAL'
          ELSE 'PENDING'
        END
      ) as due_status,
      i.invoice_date,
      i.notes,
      i.created_at,
      i.payment_mode,
      i.original_invoice_id as original_invoice_id,
      i.is_closed,
      COALESCE(p.name, 'Cash Customer') as party_name,
      orig.invoice_no as original_invoice_no,
      'SALE' as source_table
    FROM sale_invoices i 
    LEFT JOIN parties p ON i.party_id = p.id
    LEFT JOIN sale_invoices orig ON i.original_invoice_id = orig.id
  `;

  const purchaseSql = `
    SELECT 
      i.id,
      i.supplier_id as party_id,
      i.invoice_no,
      CASE 
        WHEN i.original_purchase_invoice_id IS NOT NULL THEN 'PURCHASE_RETURN'
        ELSE 'PURCHASE'
      END as type,
      i.total_amount,
      COALESCE(i.amount_paid, 0) as amount_paid,
      COALESCE(i.amount_due, GREATEST(0, i.total_amount - COALESCE(i.amount_paid,0))) as amount_due,
      COALESCE(i.due_status,
        CASE
          WHEN COALESCE(i.amount_due, GREATEST(0, i.total_amount - COALESCE(i.amount_paid,0))) <= 0 THEN 'PAID'
          WHEN COALESCE(i.amount_paid,0) > 0 THEN 'PARTIAL'
          ELSE 'PENDING'
        END
      ) as due_status,
      i.invoice_date,
      i.notes,
      i.created_at,
      i.payment_mode,
      i.original_purchase_invoice_id as original_invoice_id,
      i.is_closed,
      s.name as party_name,
      orig.invoice_no as original_invoice_no,
      'PURCHASE' as source_table
    FROM purchase_invoices i
    LEFT JOIN suppliers s ON i.supplier_id = s.id
    LEFT JOIN purchase_invoices orig ON i.original_purchase_invoice_id = orig.id
  `;

  const combinedSql = `
    ${saleSql}
    UNION ALL
    ${purchaseSql}
    ORDER BY id DESC
  `;

  pool.query(combinedSql, (err, invoices) => {
    if (err) {
      console.error("Error fetching invoices:", err);
      return res
        .status(500)
        .json({ message: "Failed to fetch invoices", error: err.message });
    }

    if (!invoices || invoices.length === 0) {
      return res.json([]);
    }

    // Separate sale and purchase invoices for fetching items
    const saleInvoiceIds = invoices.filter(i => i.source_table === 'SALE').map(inv => inv.id);
    const purchaseInvoiceIds = invoices.filter(i => i.source_table === 'PURCHASE').map(inv => inv.id);

    const grouped = {};

    // Fetch items for sale invoices
    const fetchSaleItems = (callback) => {
      if (saleInvoiceIds.length === 0) {
        callback(null);
        return;
      }

      const saleItemsSql = "SELECT * FROM sale_invoice_items WHERE invoice_id IN (?) ORDER BY id ASC";
      pool.query(saleItemsSql, [saleInvoiceIds], (itemsErr, items) => {
        if (itemsErr) {
          console.error("Error fetching sale invoice items:", itemsErr);
          return callback(itemsErr);
        }

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

        callback(null);
      });
    };

    // Fetch items for purchase invoices
    const fetchPurchaseItems = (callback) => {
      if (purchaseInvoiceIds.length === 0) {
        callback(null);
        return;
      }

      const purchaseItemsSql = `
        SELECT 
          pii.*,
          COALESCE(i.category, s.category, '') as category,
          COALESCE(i.code, s.code, '') as code,
          COALESCE(i.barcode, s.barcode, '') as barcode
        FROM purchase_invoice_items pii
        LEFT JOIN items i ON pii.item_id = i.id
        LEFT JOIN stock s ON s.purchase_invoice_id = pii.invoice_id
        WHERE pii.invoice_id IN (?) 
        ORDER BY pii.id ASC
      `;
      pool.query(purchaseItemsSql, [purchaseInvoiceIds], (itemsErr, items) => {
        if (itemsErr) {
          console.error("Error fetching purchase invoice items:", itemsErr);
          return callback(itemsErr);
        }

        (items || []).forEach((it) => {
          if (!grouped[it.invoice_id]) grouped[it.invoice_id] = [];
          grouped[it.invoice_id].push({
            id: String(it.id),
            itemId: String(it.item_id || it.id),
            itemName: it.name,
            quantity: Number(it.quantity),
            mrp: Number(it.mrp || 0),
            price: Number(it.price),
            taxRate: Number(it.tax_rate || 0),
            amount: Number(it.total),
            category: it.category || "",
            code: it.code || "",
            barcode: it.barcode || "",
          });
        });

        callback(null);
      });
    };

    // Fetch both sets of items in parallel
    let completed = 0;
    let hasError = false;

    fetchSaleItems((err) => {
      if (err) {
        hasError = true;
        console.error("Error fetching sale items:", err);
        return res.status(500).json({
          message: "Failed to fetch invoice items",
          error: err.message,
        });
      }
      completed++;
      if (completed === 2) buildResponse();
    });

    fetchPurchaseItems((err) => {
      if (err && !hasError) {
        hasError = true;
        console.error("Error fetching purchase items:", err);
        return res.status(500).json({
          message: "Failed to fetch invoice items",
          error: err.message,
        });
      }
      completed++;
      if (completed === 2) buildResponse();
    });

    function buildResponse() {
      const response = invoices.map((inv) => {
        const invoiceItems = grouped[inv.id] || [];
        const totalTax = invoiceItems.reduce((sum, item) => {
          const taxAmount = (item.price * item.quantity * item.taxRate) / 100;
          return sum + taxAmount;
        }, 0);

        // Round-off derived from stored total minus sum of line totals
        const lineTotal = invoiceItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const roundOff = Number(inv.total_amount || 0) - lineTotal;

        return {
          id: String(inv.id),
          partyId: String(inv.party_id),
          invoiceNumber: inv.invoice_no,
          type: inv.type,
          totalAmount: Number(inv.total_amount),
          roundOff: Number(roundOff.toFixed(2)),
          amountPaid: Number(inv.amount_paid || 0),
          amountDue: inv.amount_due != null ? Number(inv.amount_due) : Math.max(0, Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)),
          dueStatus:
            inv.due_status ||
            (inv.amount_due != null
              ? (Number(inv.amount_due) <= 0 ? "PAID" : Number(inv.amount_paid || 0) > 0 ? "PARTIAL" : "PENDING")
              : Math.max(0, Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)) <= 0
                ? "PAID"
                : Number(inv.amount_paid || 0) > 0
                ? "PARTIAL"
                : "PENDING"),
          totalTax,
          date: inv.invoice_date,
          notes: inv.notes,
          paymentMode: inv.payment_mode,
          status: inv.status || (inv.type === "PURCHASE" || inv.type === "PURCHASE_RETURN"
            ? (inv.due_status === "PAID" || (inv.amount_due != null && Number(inv.amount_due) <= 0) ? "PAID" : "UNPAID")
            : "PAID"),
          partyName: inv.party_name || "Cash Customer",
          originalRefNumber: inv.original_invoice_no || null,
          items: invoiceItems,
        };
      });

      res.json(response);
    }
  });
};

// ==============================
// GET /api/invoices/:id
// ==============================
// ==============================
// GET /api/invoices/:id
// ==============================
exports.getInvoiceById = (req, res) => {
  const { id } = req.params;

  // ✅ Try to fetch from sale_invoices first
  pool.query("SELECT * FROM sale_invoices WHERE id = ? LIMIT 1", [id], (err, saleRows) => {
    if (err) {
      console.error("Error fetching invoice:", err);
      return res
        .status(500)
        .json({ message: "Failed to fetch invoice", error: err.message });
    }

    // If found in sale_invoices, fetch its items
    if (saleRows && saleRows.length > 0) {
      const inv = saleRows[0];
      pool.query("SELECT * FROM sale_invoice_items WHERE invoice_id = ?", [id], (itemsErr, items) => {
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
          roundOff: Number((Number(inv.total_amount || 0) - (items || []).reduce((s, it) => s + Number(it.total || 0), 0)).toFixed(2)),
          date: inv.invoice_date,
          notes: inv.notes,
          paymentMode: inv.payment_mode,
          amountPaid: Number(inv.amount_paid || 0),
          amountDue: inv.amount_due != null ? Number(inv.amount_due) : Math.max(0, Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)),
          dueStatus: inv.due_status || (Number(inv.amount_due || Math.max(0, Number(inv.total_amount || 0) - Number(inv.amount_paid || 0))) <= 0
            ? "PAID"
            : Number(inv.amount_paid || 0) > 0
            ? "PARTIAL"
            : "PENDING"),
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
      return;
    }

    // Otherwise, try to fetch from purchase_invoices
    pool.query("SELECT * FROM purchase_invoices WHERE id = ? LIMIT 1", [id], (err, purchaseRows) => {
      if (err) {
        console.error("Error fetching purchase invoice:", err);
        return res
          .status(500)
          .json({ message: "Failed to fetch invoice", error: err.message });
      }

      if (!purchaseRows || purchaseRows.length === 0) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const inv = purchaseRows[0];
      const purchaseItemsSql = `
        SELECT 
          pii.*,
          COALESCE(i.category, s.category, '') as category,
          COALESCE(i.code, s.code, '') as code,
          COALESCE(i.barcode, s.barcode, '') as barcode
        FROM purchase_invoice_items pii
        LEFT JOIN items i ON pii.item_id = i.id
        LEFT JOIN stock s ON s.purchase_invoice_id = pii.invoice_id
        WHERE pii.invoice_id = ?
        ORDER BY pii.id ASC
      `;
      pool.query(purchaseItemsSql, [id], (itemsErr, items) => {
        if (itemsErr) {
          console.error("Error fetching purchase invoice items:", itemsErr);
          return res.status(500).json({
            message: "Failed to fetch invoice items",
            error: itemsErr.message,
          });
        }

        const response = {
          id: String(inv.id),
          partyId: String(inv.supplier_id),
          invoiceNumber: inv.invoice_no,
          type: "PURCHASE",
          totalAmount: Number(inv.total_amount),
          roundOff: Number((Number(inv.total_amount || 0) - (items || []).reduce((s, it) => s + Number(it.total || 0), 0)).toFixed(2)),
          date: inv.invoice_date,
          notes: inv.notes,
          paymentMode: inv.payment_mode,
          amountPaid: Number(inv.amount_paid || 0),
          amountDue: inv.amount_due != null ? Number(inv.amount_due) : Math.max(0, Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)),
          dueStatus: inv.due_status || (Number(inv.amount_due || Math.max(0, Number(inv.total_amount || 0) - Number(inv.amount_paid || 0))) <= 0
            ? "PAID"
            : Number(inv.amount_paid || 0) > 0
            ? "PARTIAL"
            : "PENDING"),
          items: (items || []).map((it) => ({
            id: String(it.id),
            itemId: String(it.item_id || it.id),
            itemName: it.name || "Unknown",
            quantity: Number(it.quantity),
            price: Number(it.price),
            taxRate: Number(it.tax_rate || 0),
            amount: Number(it.total),
            category: it.category || "",
            code: it.code || "",
            barcode: it.barcode || "",
          })),
        };

        res.json(response);
      });
    });
  });
};

// ==============================
// POST /api/invoices
// ==============================
exports.createInvoice = (req, res) => {
  let { partyId, type, date, items, totalAmount, invoiceNo, notes, paymentMode, originalRefNumber } =
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
  const isPurchaseType = type === "PURCHASE" || type === "PURCHASE_RETURN";
  const roundOffVal = Number(req.body.roundOff || 0);

  const amountPaidNum = Number(req.body.amountPaid || 0);
  const amountDueNum = Number(
    req.body.amountDue != null ? req.body.amountDue : Math.max(0, total - amountPaidNum)
  );
  const dueStatusVal =
    req.body.dueStatus || (amountDueNum <= 0 ? "PAID" : amountPaidNum > 0 ? "PARTIAL" : "PENDING");

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

      // ✅ For purchase types, validate supplier exists in suppliers table
      const validateSupplier = (callback) => {
        if (isPurchaseType && partyIdNum !== CASH_PARTY_ID) {
          conn.query(
            "SELECT * FROM suppliers WHERE id = ?",
            [partyIdNum],
            (err, rows) => {
              if (err) return callback(err);
              if (!rows || rows.length === 0) {
                return callback(new Error(`Supplier with ID ${partyIdNum} not found`));
              }
              callback(null);
            }
          );
        } else {
          callback(null);
        }
      };

      validateSupplier((valErr) => {
        if (valErr) {
          return conn.rollback(() => {
            conn.release();
            res.status(500).json({
              message: "Failed to validate supplier",
              error: valErr.message,
            });
          });
        }

        // ✅ invoice number (returns => CN)
        const prefix =
          type === "RETURN" || type === "PURCHASE_RETURN" ? "CN" : "TXN";
        const generatedInvoiceNo =
          invoiceNo || `${prefix}-${Date.now().toString().slice(-6)}`;

        // ✅ ROUTE TO CORRECT TABLE BASED ON TYPE
        let invSql, tableName, itemsTableName;
        if (isPurchaseType) {
          invSql = `
            INSERT INTO purchase_invoices
            (supplier_id, invoice_no, total_amount, invoice_date, notes, payment_mode, original_purchase_invoice_id, amount_paid, amount_due, due_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          tableName = "purchase_invoices";
          itemsTableName = "purchase_invoice_items";
        } else {
          invSql = `
            INSERT INTO sale_invoices
            (party_id, invoice_no, type, total_amount, invoice_date, notes, payment_mode, original_invoice_id, amount_paid, amount_due, due_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          tableName = "sale_invoices";
          itemsTableName = "sale_invoice_items";
        }

        // Prepare values based on table type
        let invValues;
        if (isPurchaseType) {
          // For purchase, need to fetch original invoice ID if provided
          let originalRefId = null;
          if (type === "PURCHASE_RETURN" && originalRefNumber) {
            // Will be set after checking DB
            invValues = [
              partyIdNum,
              generatedInvoiceNo,
              total,
              date ? new Date(date) : new Date(),
              notes || null,
              paymentMode || "CASH",
              null,
              amountPaidNum,
              amountDueNum,
              dueStatusVal,
            ];
          } else {
            invValues = [
              partyIdNum,
              generatedInvoiceNo,
              total,
              date ? new Date(date) : new Date(),
              notes || null,
              paymentMode || "CASH",
              null,
              amountPaidNum,
              amountDueNum,
              dueStatusVal,
            ];
          }
        } else {
          // For sale
          invValues = [
            partyIdNum,
            generatedInvoiceNo,
            type,
            total,
            date ? new Date(date) : new Date(),
            notes || null,
            paymentMode || "CASH",
            null,
            amountPaidNum,
            amountDueNum,
            dueStatusVal,
          ];
        }

        conn.query(invSql, invValues, (invErr, invResult) => {
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
            INSERT INTO ${itemsTableName}
            (invoice_id, item_id, name, quantity, mrp, price, tax_rate, total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;
          const updateStockSql = `UPDATE items SET stock = stock + ? WHERE id = ?`;

          let idx = 0;
          const next = () => {
            if (idx >= items.length) {
              // ✅ INSERT INTO AUDIT TABLES FOR RETURNS
              if (type === "RETURN" && originalRefNumber) {
                const auditInserts = items.map((it) => {
                  return [originalRefNumber, invoiceId, Number(it.itemId), Number(it.quantity), null, null];
                });

                const auditSql = `
                  INSERT INTO sale_return_audit
                  (original_invoice_id, return_invoice_id, item_id, quantity, reason, processed_by)
                  VALUES (?, ?, ?, ?, ?, ?)
                `;

                let auditIdx = 0;
                const nextAudit = () => {
                  if (auditIdx >= auditInserts.length) {
                    // Continue with balance update
                    updateBalance();
                    return;
                  }
                  conn.query(auditSql, auditInserts[auditIdx], (auditErr) => {
                    if (auditErr) {
                      console.warn("Warning: Failed to insert audit entry:", auditErr.message);
                    }
                    auditIdx++;
                    nextAudit();
                  });
                };
                nextAudit();
              } else if (type === "PURCHASE_RETURN" && originalRefNumber) {
                const auditInserts = items.map((it) => {
                  return [originalRefNumber, invoiceId, Number(it.itemId), Number(it.quantity), null, null];
                });

                const auditSql = `
                  INSERT INTO purchase_return_audit
                  (original_invoice_id, return_invoice_id, item_id, quantity, reason, processed_by)
                  VALUES (?, ?, ?, ?, ?, ?)
                `;

                let auditIdx = 0;
                const nextAudit = () => {
                  if (auditIdx >= auditInserts.length) {
                    updateBalance();
                    return;
                  }
                  conn.query(auditSql, auditInserts[auditIdx], (auditErr) => {
                    if (auditErr) {
                      console.warn("Warning: Failed to insert audit entry:", auditErr.message);
                    }
                    auditIdx++;
                    nextAudit();
                  });
                };
                nextAudit();
              } else {
                updateBalance();
              }

              function updateBalance() {
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
                        roundOff: roundOffVal,
                        date,
                        notes,
                        paymentMode,
                        status: "PAID",
                        items,
                      });
                    });
                  }
                );
              }
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
        });
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

                          // Normalize payment tracking for due status
                          const paidInput =
                            req.body.amountPaid != null
                              ? Number(req.body.amountPaid)
                              : Number(oldInv.amount_paid || 0);
                          const amountPaidNum = isNaN(paidInput)
                            ? Number(oldInv.amount_paid || 0)
                            : paidInput;

                          const dueInput =
                            req.body.amountDue != null
                              ? Number(req.body.amountDue)
                              : Math.max(0, newTotal - amountPaidNum);
                          const amountDueNum = isNaN(dueInput)
                            ? Math.max(0, newTotal - amountPaidNum)
                            : Math.max(0, dueInput);

                          const dueStatusVal =
                            req.body.dueStatus ||
                            (amountDueNum <= 0
                              ? "PAID"
                              : amountPaidNum > 0
                              ? "PARTIAL"
                              : "PENDING");

                            const roundOffVal = Number(req.body.roundOff || 0);

                          const updateSql = `
                            UPDATE sale_invoices
                            SET party_id = ?, invoice_no = ?, type = ?, total_amount = ?, invoice_date = ?, notes = ?, payment_mode = ?, amount_paid = ?, amount_due = ?, due_status = ?
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
                              amountPaidNum,
                              amountDueNum,
                              dueStatusVal,
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
                                          roundOff: roundOffVal,
                                          date: date || oldInv.invoice_date,
                                          notes:
                                            notes !== undefined ? notes : oldInv.notes,
                                          paymentMode:
                                            paymentMode || oldInv.payment_mode,
                                          status:
                                            dueStatusVal === "PAID"
                                              ? "PAID"
                                              : dueStatusVal === "PENDING"
                                              ? "PENDING"
                                              : "UNPAID",
                                          amountPaid: amountPaidNum,
                                          amountDue: amountDueNum,
                                          dueStatus: dueStatusVal,
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

      // Try to fetch from sale_invoices first
      conn.query(
        "SELECT * FROM sale_invoices WHERE id = ? LIMIT 1",
        [id],
        (saleErr, saleRows) => {
          if (saleErr) {
            return conn.rollback(() => {
              conn.release();
              console.error("Error fetching invoice:", saleErr);
              res.status(500).json({
                message: "Failed to delete invoice",
                error: saleErr.message,
              });
            });
          }

          // If found in sale_invoices, delete it
          if (saleRows && saleRows.length > 0) {
            const inv = saleRows[0];
            deleteSaleInvoice(inv);
            return;
          }

          // Otherwise try purchase_invoices
          conn.query(
            "SELECT * FROM purchase_invoices WHERE id = ? LIMIT 1",
            [id],
            (purchaseErr, purchaseRows) => {
              if (purchaseErr) {
                return conn.rollback(() => {
                  conn.release();
                  console.error("Error fetching purchase invoice:", purchaseErr);
                  res.status(500).json({
                    message: "Failed to delete invoice",
                    error: purchaseErr.message,
                  });
                });
              }

              if (!purchaseRows || purchaseRows.length === 0) {
                return conn.rollback(() => {
                  conn.release();
                  res.status(404).json({ message: "Invoice not found" });
                });
              }

              const inv = purchaseRows[0];
              deletePurchaseInvoice(inv);
            }
          );

          function deleteSaleInvoice(inv) {
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
                let idx = 0;

                const reverseOne = () => {
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
                                console.error("Error deleting invoice items:", delItemsErr);
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
                      idx++;
                      reverseOne();
                    }
                  );
                };

                reverseOne();
              }
            );
          }

          function deletePurchaseInvoice(inv) {
            const purchaseItemsSql = `
              SELECT 
                pii.*,
                i.category,
                i.code,
                i.barcode
              FROM purchase_invoice_items pii
              LEFT JOIN items i ON pii.item_id = i.id
              WHERE pii.invoice_id = ?
              ORDER BY pii.id ASC
            `;
            conn.query(
              purchaseItemsSql,
              [id],
              (itemsErr, itemRows) => {
                if (itemsErr) {
                  return conn.rollback(() => {
                    conn.release();
                    console.error("Error fetching purchase invoice items:", itemsErr);
                    res.status(500).json({
                      message: "Failed to delete invoice",
                      error: itemsErr.message,
                    });
                  });
                }

                const items = Array.isArray(itemRows) ? itemRows : [];
                let idx = 0;

                const reverseOne = () => {
                  if (idx >= items.length) {
                    const total = Number(inv.total_amount || 0);
                    const supplierId = Number(inv.supplier_id);
                    const balDelta = -getBalanceDelta("PURCHASE", total);

                    conn.query(
                      "UPDATE suppliers SET balance = balance + ? WHERE id = ?",
                      [balDelta, supplierId],
                      (balErr) => {
                        if (balErr) {
                          return conn.rollback(() => {
                            conn.release();
                            console.error("Error reversing supplier balance:", balErr);
                            res.status(500).json({
                              message: "Failed to delete invoice",
                              error: balErr.message,
                            });
                          });
                        }

                        conn.query(
                          "DELETE FROM purchase_invoice_items WHERE invoice_id = ?",
                          [id],
                          (delItemsErr) => {
                            if (delItemsErr) {
                              return conn.rollback(() => {
                                conn.release();
                                console.error("Error deleting purchase invoice items:", delItemsErr);
                                res.status(500).json({
                                  message: "Failed to delete invoice",
                                  error: delItemsErr.message,
                                });
                              });
                            }

                            conn.query(
                              "DELETE FROM purchase_invoices WHERE id = ?",
                              [id],
                              (delInvErr, delInvResult) => {
                                if (delInvErr) {
                                  return conn.rollback(() => {
                                    conn.release();
                                    console.error("Error deleting purchase invoice:", delInvErr);
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
                  const reverseStock = -getStockDelta("PURCHASE", qty);

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
                      idx++;
                      reverseOne();
                    }
                  );
                };

                reverseOne();
              }
            );
          }
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
  const { items, reason, processedBy } = req.body;

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
              let normalized;
              try {
                normalized = items.map((it) => {
                  const itemIdNum = Number(it.itemId);
                  
                  // ✅ Validate BEFORE SQL
                  if (!Number.isInteger(itemIdNum)) {
                    throw new Error(`Invalid itemId: ${it.itemId}`);
                  }
                  
                  return {
                    itemId: String(itemIdNum),
                    quantity: Number(it.quantity),
                  };
                });
              } catch (validationErr) {
                return rollback(400, { message: validationErr.message });
              }

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

              // 4) Compute return totals (base only, tax excluded from return amount)
              let returnSubtotal = 0;
              let returnTax = 0;
              const computedItems = normalized.map((it) => {
                const row = lineMap[it.itemId];
                const price = Number(row.price || 0);
                const taxRate = Number(row.tax_rate || 0);

                const sub = price * it.quantity;
                const tax = (sub * taxRate) / 100;
                const total = Number((sub + tax).toFixed(2));

                // Return amount should be subtotal only (excluding tax)
                returnSubtotal += sub;
                returnTax += tax;

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

              // Return amount is subtotal only (excluding tax)
              const returnGrand = Number(returnSubtotal.toFixed(2));

              // 5) Insert RETURN invoice
              const returnInvoiceNo = `CN-${Date.now().toString().slice(-8)}`;
              conn.query(
                `INSERT INTO sale_invoices
                 (party_id, invoice_no, type, total_amount, invoice_date, notes, payment_mode, original_invoice_id)
                 VALUES (?, ?, 'RETURN', ?, ?, ?, ?, ?)`,
                [
                  original.party_id,
                  returnInvoiceNo,
                  -returnGrand,
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
                      // 7) Insert audit entries into sale_return_audit
                      let auditIdx = 0;
                      const auditInsertSql = `
                        INSERT INTO sale_return_audit
                        (original_invoice_id, return_invoice_id, item_id, quantity, reason, processed_by)
                        VALUES (?, ?, ?, ?, ?, ?)
                      `;

                      const insertAudit = () => {
                        if (auditIdx >= computedItems.length) {
                          // Continue with original invoice updates
                          updateOriginalInvoice();
                          return;
                        }

                        const auditItem = computedItems[auditIdx];
                        conn.query(
                          auditInsertSql,
                          [originalId, returnInvoiceId, auditItem.item_id, auditItem.quantity, reason || null, processedBy || null],
                          (auditErr) => {
                            if (auditErr) {
                              console.warn("Warning: Failed to insert audit entry:", auditErr.message);
                            }
                            auditIdx++;
                            insertAudit();
                          }
                        );
                      };

                      insertAudit();

                      function updateOriginalInvoice() {
                        // 8) Do NOT update original invoice total_amount
                        // The original invoice stays unchanged, and the RETURN invoice (with negative amount)
                        // handles the reduction. This prevents double counting.

                        // 9) party balance: SALE_RETURN means customer owes less => balance -= returnGrand
                        conn.query(
                          "UPDATE parties SET balance = balance - ? WHERE id = ?",
                          [returnGrand, original.party_id],
                          (balErr) => {
                            if (balErr) return rollback(500, { message: "Failed to update party balance", error: balErr.message });

                            // 10) close if fully returned (all qty left = 0)
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
  const { items, reason, processedBy } = req.body;

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

      // 1) Load original invoice (must be PURCHASE and not closed) - from purchase_invoices table
      conn.query(
        "SELECT * FROM purchase_invoices WHERE id = ? LIMIT 1",
        [originalId],
        (invErr, invRows) => {
          if (invErr) return rollback(500, { message: "Failed to load invoice", error: invErr.message });
          if (!invRows || invRows.length === 0) return rollback(404, { message: "Invoice not found" });

          const original = invRows[0];
          if (Number(original.is_closed) === 1) {
            return rollback(400, { message: "Invoice is closed. Cannot return." });
          }

          // 2) Load original items from purchase_invoice_items table
          const purchaseItemsSql = `
            SELECT 
              pii.*,
              i.category,
              i.code,
              i.barcode
            FROM purchase_invoice_items pii
            LEFT JOIN items i ON pii.item_id = i.id
            WHERE pii.invoice_id = ?
            ORDER BY pii.id ASC
          `;
          conn.query(
            purchaseItemsSql,
            [originalId],
            (itemsErr, origItems) => {
              if (itemsErr) return rollback(500, { message: "Failed to load invoice items", error: itemsErr.message });

              const lines = Array.isArray(origItems) ? origItems : [];
              if (lines.length === 0) return rollback(400, { message: "No items found in original invoice" });

              const lineMap = {};
              lines.forEach((r) => {
                // Use item_id if available, otherwise use purchase_invoice_items.id
                const key = String(r.item_id || r.id);
                lineMap[key] = r;
              });

              // 3) Normalize + validate
              let normalized;
              try {
                normalized = items.map((it) => {
                  const itemIdNum = Number(it.itemId);
                  
                  // ✅ Validate BEFORE SQL
                  if (!Number.isInteger(itemIdNum)) {
                    throw new Error(`Invalid itemId: ${it.itemId}`);
                  }
                  
                  return {
                    itemId: String(itemIdNum),
                    quantity: Number(it.quantity),
                  };
                });
              } catch (validationErr) {
                return rollback(400, { message: validationErr.message });
              }

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

              // 4) Compute totals (base only, tax excluded from return amount)
              let returnSubtotal = 0;
              let returnTax = 0;
              const computedItems = normalized.map((it) => {
                const row = lineMap[it.itemId];
                const price = Number(row.price || 0);
                const taxRate = Number(row.tax_rate || 0);

                const sub = price * it.quantity;
                const tax = (sub * taxRate) / 100;
                const total = Number((sub + tax).toFixed(2));

                // Return amount should be subtotal only (excluding tax)
                returnSubtotal += sub;
                returnTax += tax;

                return {
                  item_id: row.item_id || row.id,  // Use actual item_id or line item id
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

              // Return amount is subtotal only (excluding tax)
              const returnGrand = Number(returnSubtotal.toFixed(2));

              // 5) Insert PURCHASE_RETURN invoice into purchase_invoices table
              // Store with NEGATIVE amount so it subtracts from Dashboard totals
              const returnInvoiceNo = `PRN-${Date.now().toString().slice(-8)}`;
              conn.query(
                `INSERT INTO purchase_invoices
                 (supplier_id, invoice_no, total_amount, invoice_date, notes, payment_mode, original_purchase_invoice_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  original.supplier_id,
                  returnInvoiceNo,
                  -returnGrand,
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
                    "INSERT INTO purchase_invoice_items (invoice_id, item_id, name, quantity, mrp, price, tax_rate, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

                  const step = () => {
                    if (idx >= computedItems.length) {
                      // 7) Insert audit entries into purchase_return_audit
                      let auditIdx = 0;
                      const auditInsertSql = `
                        INSERT INTO purchase_return_audit
                        (original_invoice_id, return_invoice_id, item_id, quantity, reason, processed_by)
                        VALUES (?, ?, ?, ?, ?, ?)
                      `;

                      const insertAudit = () => {
                        if (auditIdx >= computedItems.length) {
                          // Continue with original invoice updates
                          updateOriginalInvoice();
                          return;
                        }

                        const auditItem = computedItems[auditIdx];
                        conn.query(
                          auditInsertSql,
                          [originalId, returnInvoiceId, auditItem.item_id, auditItem.quantity, reason || null, processedBy || null],
                          (auditErr) => {
                            if (auditErr) {
                              console.warn("Warning: Failed to insert audit entry:", auditErr.message);
                            }
                            auditIdx++;
                            insertAudit();
                          }
                        );
                      };

                      insertAudit();

                      function updateOriginalInvoice() {
                        // 8) Do NOT update original invoice total_amount
                        // The original invoice stays unchanged, and the PURCHASE_RETURN invoice (with negative amount)
                        // handles the reduction. This prevents double counting.

                        // 9) supplier balance: PURCHASE_RETURN means we owe supplier less => balance += returnGrand
                        conn.query(
                          "UPDATE suppliers SET balance = balance + ? WHERE id = ?",
                          [returnGrand, original.supplier_id],
                          (balErr) => {
                            if (balErr) return rollback(500, { message: "Failed to update supplier balance", error: balErr.message });

                            // 10) close if fully returned
                            conn.query(
                              "SELECT COALESCE(SUM(quantity),0) AS qty_left FROM purchase_invoice_items WHERE invoice_id = ?",
                              [originalId],
                              (leftErr, leftRows) => {
                                if (leftErr) return rollback(500, { message: "Failed to check qty left", error: leftErr.message });

                                const qtyLeft = Number(leftRows?.[0]?.qty_left || 0);
                                const closeSql = qtyLeft <= 0 ? "UPDATE purchase_invoices SET is_closed = 1 WHERE id = ?" : null;

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
                          "UPDATE purchase_invoice_items SET quantity = ?, total = ? WHERE id = ?",
                          [newQty, newTotal, it.original_row_id],
                          (updLineErr) => {
                            if (updLineErr) return rollback(500, { message: "Failed to update original item qty", error: updLineErr.message });

                            // stock decreases (sent back to supplier)
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

