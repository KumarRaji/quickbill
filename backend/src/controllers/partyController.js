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
  const { name, phone, gstin, address } = req.body;

  const sql =
    'UPDATE parties SET name = ?, phone = ?, gstin = ?, address = ? WHERE id = ?';
  pool.query(
    sql,
    [name, phone || null, gstin || null, address || null, id],
    (err, result) => {
      if (err) {
        console.error('Error updating party:', err);
        return res.status(500).json({ message: 'Failed to update party' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Party not found' });
      }
      res.status(204).end();
    }
  );
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
