// src/controllers/expenseController.js
const pool = require('../config/db');

// GET /api/expenses
exports.getExpenses = (req, res) => {
  const sql = 'SELECT * FROM expenses ORDER BY id DESC';
  pool.query(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching expenses:', err);
      return res.status(500).json({ message: 'Failed to fetch expenses' });
    }

    const expenses = rows.map((e) => ({
      id: e.id.toString(),
      category: e.category,
      amount: Number(e.amount),
      date: e.expense_date,
      notes: e.notes,
    }));

    res.json(expenses);
  });
};

// POST /api/expenses
exports.createExpense = (req, res) => {
  const { category, amount, date, notes } = req.body;

  if (!amount) {
    return res.status(400).json({ message: 'Amount is required' });
  }

  const expenseDate = date ? new Date(date) : new Date();

  const sql =
    'INSERT INTO expenses (category, amount, expense_date, notes) VALUES (?, ?, ?, ?)';

  pool.query(
    sql,
    [category || null, amount, expenseDate, notes || null],
    (err, result) => {
      if (err) {
        console.error('Error creating expense:', err);
        return res.status(500).json({ message: 'Failed to create expense' });
      }

      res.status(201).json({
        id: result.insertId.toString(),
        category,
        amount,
        date: expenseDate,
        notes,
      });
    }
  );
};
