// src/controllers/partyController.js
const pool = require('../config/db');

// GET /api/parties
exports.getParties = (req, res) => {
  const sql = 'SELECT * FROM parties ORDER BY id DESC';
  pool.query(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching parties:', err);
      return res.status(500).json({ message: 'Failed to fetch parties' });
    }
    const parties = rows.map((p) => ({ ...p, id: p.id.toString() }));
    res.json(parties);
  });
};

// POST /api/parties
exports.createParty = (req, res) => {
  const { name, phone, gstin, balance, address } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });

  const sql =
    'INSERT INTO parties (name, phone, gstin, balance, address) VALUES (?, ?, ?, ?, ?)';
  pool.query(
    sql,
    [name, phone || null, gstin || null, balance || 0, address || null],
    (err, result) => {
      if (err) {
        console.error('Error creating party:', err);
        return res.status(500).json({ message: 'Failed to create party' });
      }
      res.status(201).json({
        id: result.insertId.toString(),
        name,
        phone,
        gstin,
        balance: balance || 0,
        address,
      });
    }
  );
};

// PUT /api/parties/:id
exports.updateParty = (req, res) => {
  const { id } = req.params;
  const { name, phone, gstin, address, balance } = req.body;

  const sql =
    'UPDATE parties SET name = ?, phone = ?, gstin = ?, address = ?, balance = ? WHERE id = ?';
  pool.query(
    sql,
    [name, phone || null, gstin || null, address || null, balance || 0, id],
    (err, result) => {
      if (err) {
        console.error('Error updating party:', err);
        return res.status(500).json({ message: 'Failed to update party' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Party not found' });
      }
      const selectSql = 'SELECT * FROM parties WHERE id = ?';
      pool.query(selectSql, [id], (selectErr, rows) => {
        if (selectErr || rows.length === 0) {
          return res.status(500).json({ message: 'Failed to fetch updated party' });
        }
        res.json({ ...rows[0], id: rows[0].id.toString() });
      });
    }
  );
};

// DELETE /api/parties/:id
exports.deleteParty = (req, res) => {
  const { id } = req.params;

  // First check if party has any invoices or payments
  const checkSql = `
    SELECT 
      (SELECT COUNT(*) FROM sale_invoices WHERE party_id = ?) as invoice_count,
      (SELECT COUNT(*) FROM payments WHERE party_id = ?) as payment_count
  `;
  
  pool.query(checkSql, [id, id], (checkErr, checkResult) => {
    if (checkErr) {
      console.error('Error checking party references:', checkErr);
      return res.status(500).json({ message: 'Failed to delete party' });
    }

    const { invoice_count, payment_count } = checkResult[0];
    
    if (invoice_count > 0) {
      return res.status(400).json({ 
        message: `Cannot delete party. It has ${invoice_count} invoices. Delete those invoices first.` 
      });
    }
    
    // If only payments exist, delete them first (cascade delete)
    if (payment_count > 0) {
      const deletePaymentsSql = 'DELETE FROM payments WHERE party_id = ?';
      pool.query(deletePaymentsSql, [id], (paymentErr) => {
        if (paymentErr) {
          console.error('Error deleting payments:', paymentErr);
          return res.status(500).json({ message: 'Failed to delete party payments' });
        }
        
        // Now delete the party
        const deleteSql = 'DELETE FROM parties WHERE id = ?';
        pool.query(deleteSql, [id], (err, result) => {
          if (err) {
            console.error('Error deleting party:', err);
            return res.status(500).json({ message: 'Failed to delete party' });
          }
          if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Party not found' });
          }
          res.status(204).end();
        });
      });
      return;
    }

    // Safe to delete
    const deleteSql = 'DELETE FROM parties WHERE id = ?';
    pool.query(deleteSql, [id], (err, result) => {
      if (err) {
        console.error('Error deleting party:', err);
        return res.status(500).json({ message: 'Failed to delete party' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Party not found' });
      }
      res.status(204).end();
    });
  });
};

// PATCH /api/parties/:id/balance
exports.updateBalance = (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (typeof amount !== 'number') {
    return res
      .status(400)
      .json({ message: 'amount must be a number (can be negative)' });
  }

  const sql = 'UPDATE parties SET balance = balance + ? WHERE id = ?';
  pool.query(sql, [amount, id], (err, result) => {
    if (err) {
      console.error('Error updating balance:', err);
      return res.status(500).json({ message: 'Failed to update balance' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Party not found' });
    }
    res.status(204).end();
  });
};
