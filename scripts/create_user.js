require('dotenv').config();
const pool = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Usage: node scripts/create_user.js <username> [password]
async function main() {
  const username = process.argv[2] || process.env.NEW_USER || 'concurrency_user';
  let password = process.argv[3] || process.env.NEW_PASS;

  if (!password) {
    // generate a random password
    password = crypto.randomBytes(8).toString('base64').replace(/\W/g, 'A');
  }

  const saltRounds = 10;
  const hashed = await bcrypt.hash(password, saltRounds);

  const conn = await pool.getConnection();
  try {
    // check if exists
    const [rows] = await conn.execute('SELECT id FROM usuarios WHERE username = ?', [username]);
    if (rows.length > 0) {
      // update password
      await conn.execute('UPDATE usuarios SET password = ? WHERE username = ?', [hashed, username]);
      console.log(`Updated password for existing user: ${username}`);
    } else {
      const [res] = await conn.execute('INSERT INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)', [username, hashed, username, 'vendedor']);
      console.log(`Created user id=${res.insertId} username=${username}`);
    }

    console.log('Credentials:');
    console.log('  username:', username);
    console.log('  password:', password);
  } catch (err) {
    console.error('Error creating user:', err.message);
    process.exit(1);
  } finally {
    conn.release();
  }
}

main();
