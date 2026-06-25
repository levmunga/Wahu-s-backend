// server.js
// Main entry point. Two route groups:
//   /api/products/*      — public, read-only, used by the storefront
//   /api/admin/*         — protected by login, used by the admin panel
//
// Run with: node src/server.js
// Configure via a .env file (see .env.example).

require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const auth = require("./auth");
const products = require("./products");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Middleware ----
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/admin", express.static(path.join(__dirname, "..", "public", "admin")));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image is plenty for product photos
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
});

// =========================================================================
// PUBLIC ROUTES — no login required. The storefront reads from these.
// =========================================================================

// List all products, optionally filtered by category.
app.get("/api/products", (req, res) => {
  try {
    const list = products.listProducts({ category: req.query.category });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "Could not load products." });
  }
});

// Get a single product by id.
app.get("/api/products/:id", (req, res) => {
  const product = products.getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  res.json(product);
});

// Serve a stored image by id. Cached aggressively since images never change in place
// (an edit creates a new image id rather than overwriting bytes).
app.get("/api/images/:id", (req, res) => {
  const image = products.getImage(req.params.id);
  if (!image) return res.status(404).send("Not found");
  res.set("Content-Type", image.mime_type);
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(Buffer.from(image.data));
});

// =========================================================================
// AUTH ROUTES
// =========================================================================

// One-time setup: create the first (and only) admin account.
// This route locks itself after the first admin is created.
app.post("/api/admin/setup", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ error: "Username and a password of at least 6 characters are required." });
  }
  const result = auth.createAdminIfNoneExists(username, password);
  if (!result.created) {
    return res.status(409).json({ error: result.reason });
  }
  res.json({ ok: true });
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  const admin = auth.findAdminByUsername(username || "");
  if (!admin || !auth.verifyPassword(password || "", admin.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  const token = auth.issueToken(admin.id, admin.username);
  res.cookie(auth.COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true, username: admin.username });
});

app.post("/api/admin/logout", (req, res) => {
  res.clearCookie(auth.COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/admin/me", auth.requireAdmin, (req, res) => {
  res.json({ username: req.admin.username });
});

// =========================================================================
// ADMIN ROUTES — everything below requires a valid login session.
// =========================================================================

app.use("/api/admin/products", auth.requireAdmin);

app.get("/api/admin/products", (req, res) => {
  res.json(products.listProducts({}));
});

app.get("/api/admin/products/:id", (req, res) => {
  const product = products.getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  res.json(product);
});

app.post("/api/admin/products", (req, res) => {
  try {
    const created = products.createProduct(req.body);
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: "Could not create product: " + e.message });
  }
});

app.put("/api/admin/products/:id", (req, res) => {
  try {
    const updated = products.updateProduct(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Product not found." });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: "Could not update product: " + e.message });
  }
});

app.delete("/api/admin/products/:id", (req, res) => {
  products.deleteProduct(req.params.id);
  res.json({ ok: true });
});

// Upload an image (used when adding/editing a color variant in the admin panel).
// Returns an imageId to attach to a product color.
app.post("/api/admin/images", auth.requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file received." });
  const imageId = products.saveImage(req.file.buffer, req.file.mimetype);
  res.status(201).json({ imageId });
});

app.delete("/api/admin/images/:id", auth.requireAdmin, (req, res) => {
  products.deleteImage(req.params.id);
  res.json({ ok: true });
});

// =========================================================================
app.listen(PORT, () => {
  console.log(`Wahu's Closet backend running on http://localhost:${PORT}`);
});
