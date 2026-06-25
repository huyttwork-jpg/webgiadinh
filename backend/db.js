require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

let pool = null;

async function checkAndCreateDatabase() {
  // Connect to the default 'postgres' database first
  const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/postgres`;
  const defaultPool = new Pool({ connectionString });

  try {
    const res = await defaultPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [process.env.DB_NAME]
    );

    if (res.rowCount === 0) {
      console.log(`Database '${process.env.DB_NAME}' does not exist. Creating database...`);
      // CREATE DATABASE cannot run inside a transaction
      await defaultPool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`Database '${process.env.DB_NAME}' created successfully.`);
    } else {
      console.log(`Database '${process.env.DB_NAME}' already exists.`);
    }
  } catch (error) {
    console.error('Error checking/creating database:', error);
  } finally {
    await defaultPool.end();
  }
}

async function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL;
    if (connectionString) {
      pool = new Pool({
        connectionString,
        ssl: {
          rejectUnauthorized: false
        }
      });
    } else {
      await checkAndCreateDatabase();
      pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });
    }
  }
  return pool;
}

// Helper to query the PostgreSQL pool
async function query(text, params) {
  const p = await getPool();
  return p.query(text, params);
}

async function initDb() {
  // Trigger pool creation
  await getPool();

  console.log('Initializing database tables in PostgreSQL...');

  // Create tables in correct sequence
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      fullName VARCHAR(100) NOT NULL,
      relation VARCHAR(50) NOT NULL,
      phoneNumber VARCHAR(20) UNIQUE NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS photos (
      id SERIAL PRIMARY KEY,
      url VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(50) NOT NULL,
      userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS reactions (
      id SERIAL PRIMARY KEY,
      photoId INTEGER REFERENCES photos(id) ON DELETE CASCADE,
      userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) DEFAULT 'heart',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(photoId, userId)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS wishes (
      id SERIAL PRIMARY KEY,
      userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      emoji VARCHAR(50) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS otps (
      id SERIAL PRIMARY KEY,
      userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
      code VARCHAR(10) NOT NULL,
      expiresAt TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT false
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      photoId INTEGER REFERENCES photos(id) ON DELETE CASCADE,
      userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
      senderId INTEGER REFERENCES users(id) ON DELETE CASCADE,
      photoId INTEGER REFERENCES photos(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      content TEXT,
      isRead BOOLEAN DEFAULT false,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Database tables verified/created successfully.');

  // Seed default users if users table is empty
  const userCountRes = await query('SELECT COUNT(*) as count FROM users');
  const userCount = parseInt(userCountRes.rows[0].count);

  if (userCount === 0) {
    console.log('Seeding initial users into PostgreSQL...');
    const hashedPwd123 = await bcrypt.hash('123', 10);
    const hashedPwdAdmin = await bcrypt.hash('admin', 10);

    // Insert users and get their IDs
    const boMinhInsert = await query(
      `INSERT INTO users (username, password, fullName, relation, phoneNumber) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['bominh', hashedPwd123, 'Ba Minh', 'Ba', '0901234567']
    );
    const boMinhId = boMinhInsert.rows[0].id;

    const meLanInsert = await query(
      `INSERT INTO users (username, password, fullName, relation, phoneNumber) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['melan', hashedPwd123, 'Mẹ Lan', 'Mẹ', '0907654321']
    );
    const meLanId = meLanInsert.rows[0].id;

    const adminInsert = await query(
      `INSERT INTO users (username, password, fullName, relation, phoneNumber) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['admin', hashedPwdAdmin, 'Quản trị viên', 'Khác', '0900000000']
    );
    const adminId = adminInsert.rows[0].id;
    console.log('Database seeding completed in PostgreSQL.');
  }
}

module.exports = {
  getPool,
  query,
  initDb
};
