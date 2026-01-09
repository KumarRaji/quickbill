// src/controllers/userController.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// helper: count super admins
const countSuperAdmins = (cb) => {
  const countSql = 'SELECT COUNT(*) AS count FROM users WHERE role = "SUPER_ADMIN"';
  pool.query(countSql, (err, rows) => {
    if (err) return cb(err);
    cb(null, rows[0].count);
  });
};

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

// PUT /api/users/:id
exports.updateUser = (req, res) => {
  const { id } = req.params;
  const { name, username, password, role } = req.body;

  const findSql = 'SELECT * FROM users WHERE id = ? LIMIT 1';
  pool.query(findSql, [id], async (findErr, rows) => {
    if (findErr) {
      console.error('Error fetching user:', findErr);
      return res.status(500).json({ message: 'Failed to update user' });
    }

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existing = rows[0];
    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }

    if (username && username !== existing.username) {
      const checkSql = 'SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1';
      try {
        const dup = await new Promise((resolve, reject) => {
          pool.query(checkSql, [username, id], (err, r) => (err ? reject(err) : resolve(r)));
        });
        if (dup.length > 0) {
          return res.status(400).json({ message: 'Username already exists' });
        }
      } catch (err) {
        console.error('Error checking username:', err);
        return res.status(500).json({ message: 'Failed to update user' });
      }
      updates.push('username = ?');
      params.push(username);
    }

    if (password) {
      try {
        const hash = await bcrypt.hash(password, 10);
        updates.push('password_hash = ?');
        params.push(hash);
      } catch (err) {
        console.error('Error hashing password:', err);
        return res.status(500).json({ message: 'Failed to update user' });
      }
    }

    if (role && role !== existing.role) {
      // Prevent demoting the last SUPER_ADMIN
      if (existing.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
        countSuperAdmins((countErr, count) => {
          if (countErr) {
            console.error('Error counting super admins:', countErr);
            return res.status(500).json({ message: 'Failed to update user' });
          }
          if (count <= 1) {
            return res.status(400).json({ message: 'Cannot change role of the only Super Admin' });
          }
          updates.push('role = ?');
          params.push(role);
          finalizeUpdate();
        });
        return;
      }
      updates.push('role = ?');
      params.push(role);
    }

    const finalizeUpdate = () => {
      if (updates.length === 0) {
        return res.json({ id: existing.id.toString(), name: existing.name, username: existing.username, role: existing.role });
      }

      const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      params.push(id);

      pool.query(sql, params, (updErr, result) => {
        if (updErr) {
          console.error('Error updating user:', updErr);
          return res.status(500).json({ message: 'Failed to update user' });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'User not found' });
        }

        res.json({
          id: id.toString(),
          name: name || existing.name,
          username: username || existing.username,
          role: role || existing.role,
        });
      });
    };

    // proceed if role change not pending async check
    if (!(existing.role === 'SUPER_ADMIN' && role && role !== 'SUPER_ADMIN')) {
      finalizeUpdate();
    }
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
