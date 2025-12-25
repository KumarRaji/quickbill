// src/controllers/paymentController.js
const pool = require('../config/db');

// GET /api/payments
exports.getPayments = (req, res) => {
  const sql = `
    SELECT p.*, COALESCE(pt.name, ps.name) as party_name 
    FROM payments p 
    LEFT JOIN parties pt ON p.party_id = pt.id 
    LEFT JOIN suppliers ps ON p.party_id = ps.id 
    ORDER BY p.id DESC
  `;
  pool.query(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching payments:', err);
      return res.status(500).json({ message: 'Failed to fetch payments' });
    }

    const payments = rows.map((p) => ({
      id: p.id.toString(),
      partyId: p.party_id.toString(),
      partyName: p.party_name || 'Unknown',
      type: p.type,
      amount: Number(p.amount),
      date: p.payment_date,
      mode: p.mode,
      notes: p.notes,
    }));

    res.json(payments);
  });
};

// POST /api/payments
exports.createPayment = (req, res) => {
  const { partyId, type, amount, date, mode, notes } = req.body;

  if (!partyId || !type || !amount) {
    return res.status(400).json({ message: 'Invalid payment payload' });
  }

  const paymentDate = date ? new Date(date) : new Date();

  // Insert payment
  const insertSql =
    'INSERT INTO payments (party_id, type, amount, payment_date, mode, notes) VALUES (?, ?, ?, ?, ?, ?)';

  pool.query(
    insertSql,
    [partyId, type, amount, paymentDate, mode || null, notes || null],
    (insertErr, insertResult) => {
      if (insertErr) {
        console.error('Error inserting payment:', insertErr);
        return res.status(500).json({ message: 'Failed to create payment', error: insertErr.message });
      }

      const balanceDelta = type === 'IN' ? -amount : amount;
      
      // Try to update suppliers table first
      const supplierUpdateSql = 'UPDATE suppliers SET balance = balance + ? WHERE id = ?';

      pool.query(supplierUpdateSql, [balanceDelta, partyId], (supplierErr, supplierResult) => {
        // If no rows were updated in suppliers (or error), try parties table
        if (!supplierResult || supplierResult.affectedRows === 0) {
          const partyUpdateSql = 'UPDATE parties SET balance = balance + ? WHERE id = ?';
          pool.query(partyUpdateSql, [balanceDelta, partyId], (partyErr, partyResult) => {
            // Send response regardless of balance update success/failure
            res.status(201).json({
              id: insertResult.insertId.toString(),
              partyId: partyId.toString(),
              type,
              amount,
              date: paymentDate,
              mode,
              notes,
            });
          });
        } else {
          // Supplier was updated successfully
          res.status(201).json({
            id: insertResult.insertId.toString(),
            partyId: partyId.toString(),
            type,
            amount,
            date: paymentDate,
            mode,
            notes,
          });
        }
      });
    }
  );
};
