// src/controllers/userController.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// GET /api/users
exports.getUsers = (req, res) => {
  const sql = 'SELECT id, name, username, role, created_at FROM users ORDER BY id DESC';

  pool.query(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ message: 'Failed to fetch users' });
    }
    res.json(rows);
  });
};

// POST /api/users
exports.createUser = async (req, res) => {
  try {
    const { name, username, password, role } = req.body;

    if (!name || !username || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check username exists
    const checkSql = 'SELECT id FROM users WHERE username = ? LIMIT 1';
    pool.query(checkSql, [username], async (checkErr, rows) => {
      if (checkErr) {
        console.error('Error checking username:', checkErr);
        return res.status(500).json({ message: 'Failed to create user' });
      }

      if (rows.length > 0) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      const insertSql =
        'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)';
      pool.query(
        insertSql,
        [name, username, passwordHash, role],
        (insertErr, result) => {
          if (insertErr) {
            console.error('Error inserting user:', insertErr);
            return res.status(500).json({ message: 'Failed to create user' });
          }

          return res.status(201).json({
            id: result.insertId,
            name,
            username,
            role,
          });
        }
      );
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Failed to create user' });
  }
};

// DELETE /api/users/:id
exports.deleteUser = (req, res) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ message: 'User ID is required' });

  // Extra safety: do not delete SUPER_ADMIN (even if called directly)
  const sql = 'DELETE FROM users WHERE id = ? AND role != "SUPER_ADMIN"';

  pool.query(sql, [id], (err, result) => {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).json({ message: 'Failed to delete user' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found or cannot be deleted' });
    }

    res.json({ message: 'User deleted successfully' });
  });
};
