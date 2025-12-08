// src/controllers/authController.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

exports.login = (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  const sql = 'SELECT * FROM users WHERE username = ? LIMIT 1';
  pool.query(sql, [username], async (err, rows) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).json({ message: 'Login failed' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const userResponse = {
      id: user.id.toString(),
      name: user.name,
      username: user.username,
      role: user.role,
    };

    res.json(userResponse);
  });
};
