// db.js
// SQLite database setup using Node's built-in node:sqlite module.
// This avoids native compilation entirely (no node-gyp, no platform-specific
// binaries), which means it works the same on your machine, on Render, or
// on any other standard Node 22+ host without extra build steps.

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "wahus.db");
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL,
    compare_at_price INTEGER,
    description TEXT,
    care TEXT,
    sizes TEXT,            -- JSON array string, e.g. '["S","M","L"]' or null
    badge TEXT,             -- 'New' | 'Sale' | 'Best Seller' | null
    stock TEXT DEFAULT 'in',-- 'in' | 'few' | 'out'
    is_new INTEGER DEFAULT 0,
    is_best INTEGER DEFAULT 0,
    rating REAL DEFAULT 5.0,
    reviews INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_colors (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    hex TEXT,
    image_id TEXT,           -- references images.id
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    data BLOB NOT NULL,        -- raw image bytes
    mime_type TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_product_colors_product_id ON product_colors(product_id);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
`);

module.exports = db;
