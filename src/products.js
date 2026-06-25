// products.js
// Data access layer for products, colors, and images.
// Keeping this separate from the route handlers (server.js) makes the
// query logic easy to test and easy to swap later if you ever move off SQLite.

const db = require("./db");
const crypto = require("crypto");

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function saveImage(buffer, mimeType) {
  const id = newId("img");
  db.prepare("INSERT INTO images (id, data, mime_type) VALUES (?, ?, ?)").run(id, buffer, mimeType);
  return id;
}

function getImage(id) {
  return db.prepare("SELECT data, mime_type FROM images WHERE id = ?").get(id);
}

function deleteImage(id) {
  db.prepare("DELETE FROM images WHERE id = ?").run(id);
}

function listProducts({ category } = {}) {
  let rows;
  if (category && category !== "all") {
    rows = db.prepare("SELECT * FROM products WHERE category = ? ORDER BY created_at DESC").all(category);
  } else {
    rows = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
  }
  return rows.map(attachColors);
}

function getProduct(id) {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!row) return null;
  return attachColors(row);
}

function attachColors(productRow) {
  const colors = db
    .prepare("SELECT * FROM product_colors WHERE product_id = ? ORDER BY sort_order ASC")
    .all(productRow.id);
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
    colors: colors.map((c) => ({
      id: c.id,
      name: c.name,
      hex: c.hex,
      imageId: c.image_id,
    })),
  };
}

function createProduct(data) {
  const id = newId("p");
  db.prepare(
    `INSERT INTO products
      (id, name, category, price, compare_at_price, description, care, sizes, badge, stock, is_new, is_best, rating, reviews)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.name,
    data.category,
    data.price,
    data.compareAtPrice || null,
    data.description || "",
    data.care || "",
    data.sizes ? JSON.stringify(data.sizes) : null,
    data.badge || null,
    data.stock || "in",
    data.isNew ? 1 : 0,
    data.isBest ? 1 : 0,
    data.rating != null ? data.rating : 5.0,
    data.reviews != null ? data.reviews : 0
  );

  if (Array.isArray(data.colors)) {
    data.colors.forEach((color, idx) => {
      const colorId = newId("col");
      db.prepare(
        "INSERT INTO product_colors (id, product_id, name, hex, image_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(colorId, id, color.name, color.hex || null, color.imageId || null, idx);
    });
  }

  return getProduct(id);
}

function updateProduct(id, data) {
  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
  if (!existing) return null;

  db.prepare(
    `UPDATE products SET
      name = ?, category = ?, price = ?, compare_at_price = ?, description = ?,
      care = ?, sizes = ?, badge = ?, stock = ?, is_new = ?, is_best = ?,
      rating = ?, reviews = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    data.name,
    data.category,
    data.price,
    data.compareAtPrice || null,
    data.description || "",
    data.care || "",
    data.sizes ? JSON.stringify(data.sizes) : null,
    data.badge || null,
    data.stock || "in",
    data.isNew ? 1 : 0,
    data.isBest ? 1 : 0,
    data.rating != null ? data.rating : 5.0,
    data.reviews != null ? data.reviews : 0,
    id
  );

  // Replace colors wholesale on update — simplest correct approach for an admin panel.
  if (Array.isArray(data.colors)) {
    db.prepare("DELETE FROM product_colors WHERE product_id = ?").run(id);
    data.colors.forEach((color, idx) => {
      const colorId = newId("col");
      db.prepare(
        "INSERT INTO product_colors (id, product_id, name, hex, image_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(colorId, id, color.name, color.hex || null, color.imageId || null, idx);
    });
  }

  return getProduct(id);
}

function deleteProduct(id) {
  // Clean up any images this product's colors referenced, then the product itself.
  // product_colors rows are removed automatically via ON DELETE CASCADE.
  const colors = db.prepare("SELECT image_id FROM product_colors WHERE product_id = ?").all(id);
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
  colors.forEach((c) => {
    if (c.image_id) {
      // Only delete the image if no other color references it (rare reuse case).
      const stillUsed = db
        .prepare("SELECT 1 FROM product_colors WHERE image_id = ? LIMIT 1")
        .get(c.image_id);
      if (!stillUsed) deleteImage(c.image_id);
    }
  });
  return true;
}

module.exports = {
  saveImage,
  getImage,
  deleteImage,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};
