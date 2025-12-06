require('dotenv').config();
const pool = require('./src/config/db');
const bcrypt = require('bcryptjs');

async function seedUsers() {
  const users = [
    { name: 'Super Admin', username: 'superadmin', password: 'password', role: 'SUPER_ADMIN' },
    { name: 'Admin User', username: 'admin', password: 'password', role: 'ADMIN' },
    { name: 'Staff User', username: 'staff', password: 'password', role: 'STAFF' }
  ];

  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 10);
    const sql = 'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = ?';
    
    pool.query(sql, [user.name, user.username, hash, user.role, hash], (err) => {
      if (err) {
        console.error(`Error seeding ${user.username}:`, err.message);
      } else {
        console.log(`✓ Seeded user: ${user.username}`);
      }
    });
  }

  setTimeout(() => {
    console.log('\n✅ Seeding complete!');
    process.exit(0);
  }, 1000);
}

seedUsers();
