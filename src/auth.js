// auth.js — PostgreSQL version
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-this-in-production";
const COOKIE_NAME = "wahus_admin_session";
const TOKEN_EXPIRY = "7d";

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

async function createAdminIfNoneExists(username, plainPassword) {
  const { rows } = await pool.query("SELECT id FROM admin_users LIMIT 1");
  if (rows.length > 0) return { created: false, reason: "An admin account already exists." };
  const hash = hashPassword(plainPassword);
  await pool.query(
    "INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)",
    [username, hash]
  );
  return { created: true };
}

async function findAdminByUsername(username) {
  const { rows } = await pool.query(
    "SELECT * FROM admin_users WHERE username = $1", [username]
  );
  return rows[0] || null;
}

function issueToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired session" });
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