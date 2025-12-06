const pool = require('../config/db');
const bcrypt = require('bcryptjs');

exports.login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const sql = 'SELECT id, name, username, password_hash, role FROM users WHERE username = ? LIMIT 1';
  
  pool.query(sql, [username], async (err, rows) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).json({ message: 'Login failed' });
    }

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    res.json({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    });
  });
};
