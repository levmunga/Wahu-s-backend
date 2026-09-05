// db.js — PostgreSQL version
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      compare_at_price INTEGER,
      description TEXT,
      care TEXT,
      sizes TEXT,
      badge TEXT,
      stock INTEGER DEFAULT 0,
      is_new BOOLEAN DEFAULT false,
      is_best BOOLEAN DEFAULT false,
      rating REAL DEFAULT 0,
      reviews INTEGER DEFAULT 0,
      created_at TEXT DEFAULT now()::text,
      updated_at TEXT DEFAULT now()::text
    );
    CREATE TABLE IF NOT EXISTS product_colors (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      hex TEXT,
      image_id TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      data BYTEA NOT NULL,
      mime_type TEXT NOT NULL,
      created_at TEXT DEFAULT now()::text
    );
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT now()::text
    );
  `);
}

initDb().catch(console.error);

module.exports = pool;