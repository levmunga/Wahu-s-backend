// auth.js
// Handles admin password hashing and session tokens (JWT in an httpOnly cookie).

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-this-in-production";
const COOKIE_NAME = "wahus_admin_session";
const TOKEN_EXPIRY = "7d";

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function createAdminIfNoneExists(username, plainPassword) {
  const existing = db.prepare("SELECT id FROM admin_users LIMIT 1").get();
  if (existing) return { created: false, reason: "An admin account already exists." };
  const hash = hashPassword(plainPassword);
  db.prepare("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)").run(username, hash);
  return { created: true };
}

function findAdminByUsername(username) {
  return db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username);
}

function issueToken(adminId, username) {
  return jwt.sign({ sub: adminId, username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// Express middleware: blocks the request unless a valid admin session cookie is present.
function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not logged in." });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Session expired. Please log in again." });
  req.admin = payload;
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  createAdminIfNoneExists,
  findAdminByUsername,
  issueToken,
  verifyToken,
  requireAdmin,
  COOKIE_NAME,
};
