// src/controllers/paymentController.js
const pool = require('../config/db');

// GET /api/payments
exports.getPayments = (req, res) => {
  const sql = `
    SELECT p.*, pt.name as party_name 
    FROM payments p 
    LEFT JOIN parties pt ON p.party_id = pt.id 
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

  // Insert payment then update party balance
  const insertSql =
    'INSERT INTO payments (party_id, type, amount, payment_date, mode, notes) VALUES (?, ?, ?, ?, ?, ?)';

  pool.getConnection((connErr, conn) => {
    if (connErr) {
      console.error('Error getting connection:', connErr);
      return res.status(500).json({ message: 'Failed to create payment' });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        console.error('Transaction error:', txErr);
        return res.status(500).json({ message: 'Failed to create payment' });
      }

      conn.query(
        insertSql,
        [partyId, type, amount, paymentDate, mode || null, notes || null],
        (insertErr, result) => {
          if (insertErr) {
            console.error('Error inserting payment:', insertErr);
            return conn.rollback(() => {
              conn.release();
              res.status(500).json({ message: 'Failed to create payment' });
            });
          }

          const balanceDelta = type === 'IN' ? -amount : amount;
          const balSql =
            'UPDATE parties SET balance = balance + ? WHERE id = ?';

          conn.query(balSql, [balanceDelta, partyId], (balErr) => {
            if (balErr) {
              console.error('Error updating balance:', balErr);
              return conn.rollback(() => {
                conn.release();
                res
                  .status(500)
                  .json({ message: 'Failed to update party balance' });
              });
            }

            conn.commit((commitErr) => {
              if (commitErr) {
                console.error('Commit error:', commitErr);
                return conn.rollback(() => {
                  conn.release();
                  res.status(500).json({ message: 'Failed to create payment' });
                });
              }

              conn.release();

              res.status(201).json({
                id: result.insertId.toString(),
                partyId: partyId.toString(),
                type,
                amount,
                date: paymentDate,
                mode,
                notes,
              });
            });
          });
        }
      );
    });
  });
};
