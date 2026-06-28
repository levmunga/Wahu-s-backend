// products.js — PostgreSQL version
const pool = require('./db');
const crypto = require('crypto');

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

async function saveImage(buffer, mimeType) {
  const id = newId('img');
  await pool.query(
    'INSERT INTO images (id, data, mime_type) VALUES ($1, $2, $3)',
    [id, buffer, mimeType]
  );
  return id;
}

async function getImage(id) {
  const { rows } = await pool.query(
    'SELECT data, mime_type FROM images WHERE id = $1', [id]
  );
  return rows[0] || null;
}

async function deleteImage(id) {
  await pool.query('DELETE FROM images WHERE id = $1', [id]);
}

async function listProducts({ category } = {}) {
  let rows;
  if (category && category !== 'all') {
    const r = await pool.query(
      'SELECT * FROM products WHERE category = $1 ORDER BY created_at DESC', [category]
    );
    rows = r.rows;
  } else {
    const r = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    rows = r.rows;
  }
  return Promise.all(rows.map(attachColors));
}

async function getProduct(id) {
  const { rows } = await pool.query(
    'SELECT * FROM products WHERE id = $1', [id]
  );
  if (!rows[0]) return null;
  return attachColors(rows[0]);
}

async function attachColors(productRow) {
  const { rows: colors } = await pool.query(
    'SELECT * FROM product_colors WHERE product_id = $1 ORDER BY sort_order ASC',
    [productRow.id]
  );
  return {
    id: productRow.id,
    name: productRow.name,
    category: productRow.category,
    price: productRow.price,
    compareAtPrice: productRow.compare_at_price || null,
    description: productRow.description,
    care: productRow.care,
    sizes: productRow.sizes ? JSON.parse(productRow.sizes) : null,
    badge: productRow.badge,
    stock: productRow.stock,
    isNew: !!productRow.is_new,
    isBest: !!productRow.is_best,
    rating: productRow.rating,
    reviews: productRow.reviews,
    createdAt: productRow.created_at,
    updatedAt: productRow.updated_at,
    colors: colors.map(c => ({
      id: c.id,
      name: c.name,
      hex: c.hex,
      imageId: c.image_id,
      sortOrder: c.sort_order
    }))
  };
}

async function createProduct(data) {
  const id = newId('prod');
  await pool.query(
    `INSERT INTO products (id, name, category, price, compare_at_price, description, care, sizes, badge, stock, is_new, is_best, rating, reviews)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [id, data.name, data.category, data.price, data.compareAtPrice || null,
     data.description, data.care, data.sizes ? JSON.stringify(data.sizes) : null,
     data.badge, data.stock || 0, data.isNew || false, data.isBest || false,
     data.rating || 0, data.reviews || 0]
  );
  return getProduct(id);
}

async function updateProduct(id, data) {
  await pool.query(
    `UPDATE products SET name=$1, category=$2, price=$3, compare_at_price=$4,
     description=$5, care=$6, sizes=$7, badge=$8, stock=$9, is_new=$10,
     is_best=$11, rating=$12, reviews=$13, updated_at=now()::text WHERE id=$14`,
    [data.name, data.category, data.price, data.compareAtPrice || null,
     data.description, data.care, data.sizes ? JSON.stringify(data.sizes) : null,
     data.badge, data.stock || 0, data.isNew || false, data.isBest || false,
     data.rating || 0, data.reviews || 0, id]
  );
  return getProduct(id);
}

async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id = $1', [id]);
}

async function addColor(productId, colorData) {
  const id = newId('col');
  await pool.query(
    'INSERT INTO product_colors (id, product_id, name, hex, image_id, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, productId, colorData.name, colorData.hex, colorData.imageId || null, colorData.sortOrder || 0]
  );
  return id;
}

async function deleteColor(id) {
  await pool.query('DELETE FROM product_colors WHERE id = $1', [id]);
}

async function findAdminUser(username) {
  const { rows } = await pool.query(
    'SELECT * FROM admin_users WHERE username = $1', [username]
  );
  return rows[0] || null;
}

async function createAdminUser(username, passwordHash) {
  await pool.query(
    'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)',
    [username, passwordHash]
  );
}

module.exports = {
  saveImage, getImage, deleteImage,
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
  addColor, deleteColor, findAdminUser, createAdminUser
};