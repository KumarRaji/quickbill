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
    // stringify id as string to match frontend type if needed
    const users = rows.map((u) => ({
      ...u,
      id: u.id.toString(),
    }));
    res.json(users);
  });
};

// POST /api/users
exports.createUser = (req, res) => {
  const { name, username, password, role } = req.body;
  if (!name || !username || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const checkSql = 'SELECT id FROM users WHERE username = ? LIMIT 1';
  pool.query(checkSql, [username], async (checkErr, rows) => {
    if (checkErr) {
      console.error('Error checking username:', checkErr);
      return res.status(500).json({ message: 'Failed to create user' });
    }

    if (rows.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

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

        res.status(201).json({
          id: result.insertId.toString(),
          name,
          username,
          role,
        });
      }
    );
  });
};

// DELETE /api/users/:id
exports.deleteUser = (req, res) => {
  const { id } = req.params;

  // Prevent deleting the last SUPER_ADMIN
  const countSql =
    'SELECT COUNT(*) AS count FROM users WHERE role = "SUPER_ADMIN"';
  pool.query(countSql, (countErr, rows) => {
    if (countErr) {
      console.error('Error counting super admins:', countErr);
      return res.status(500).json({ message: 'Failed to delete user' });
    }

    const superAdminCount = rows[0].count;

    const findSql = 'SELECT role FROM users WHERE id = ? LIMIT 1';
    pool.query(findSql, [id], (findErr, userRows) => {
      if (findErr) {
        console.error('Error fetching user:', findErr);
        return res.status(500).json({ message: 'Failed to delete user' });
      }

      if (userRows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const userRole = userRows[0].role;

      if (userRole === 'SUPER_ADMIN' && superAdminCount <= 1) {
        return res
          .status(400)
          .json({ message: 'Cannot delete the only Super Admin' });
      }

      const delSql = 'DELETE FROM users WHERE id = ?';
      pool.query(delSql, [id], (delErr, result) => {
        if (delErr) {
          console.error('Error deleting user:', delErr);
          return res.status(500).json({ message: 'Failed to delete user' });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
      });
    });
  });
};
