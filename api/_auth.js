// Shared authentication / authorization helpers for the privileged API endpoints.
// These verify a Firebase ID token (sent as `Authorization: Bearer <token>`) using
// the Admin SDK and check the caller's role before any privileged action runs.
const {initAdmin} = require("./firebase-admin");

// Origins allowed to call the privileged endpoints via CORS.
// Set ALLOWED_ORIGINS in the environment (comma-separated) to override in production.
const DEFAULT_ORIGINS = ["https://backcountrybayit.com", "https://www.backcountrybayit.com", "http://localhost:3000"];

const getAllowedOrigins = () => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }
  return DEFAULT_ORIGINS;
};

// Apply a restrictive CORS policy: only echo the Origin header when it is allow-listed.
const applyCors = (req, res, methods = "POST, OPTIONS") => {
  const origin = req.headers.origin;
  if (origin && getAllowedOrigins().includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

// Verify the Bearer token. Throws { status, message } on failure.
const verifyRequest = async (req) => {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) {
    throw {status: 401, message: "Authentication required"};
  }

  let admin;
  try {
    admin = initAdmin();
  } catch (err) {
    console.error("Firebase Admin initialization failed:", err);
    throw {status: 500, message: "Server authentication is not configured"};
  }

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return {admin, decoded};
  } catch (err) {
    throw {status: 401, message: "Invalid or expired session"};
  }
};

// Resolve the caller's role from custom claims, falling back to their Firestore user doc.
const resolveRole = async (admin, decoded) => {
  if (decoded.admin) return "admin";
  if (decoded.isManager) return "manager";
  try {
    const snap = await admin.firestore().collection("users").doc(decoded.uid).get();
    if (snap.exists) return snap.data().role || null;
  } catch (err) {
    console.error("Failed to read user role:", err);
  }
  return null;
};

// Require the caller to be a manager or admin. Throws { status, message } otherwise.
const requireManager = async (req) => {
  const {admin, decoded} = await verifyRequest(req);
  const role = await resolveRole(admin, decoded);
  if (role !== "admin" && role !== "manager") {
    throw {status: 403, message: "Insufficient permissions"};
  }
  return {admin, decoded, role};
};

// Require the caller to be an admin. Throws { status, message } otherwise.
const requireAdmin = async (req) => {
  const {admin, decoded} = await verifyRequest(req);
  const role = await resolveRole(admin, decoded);
  if (role !== "admin") {
    throw {status: 403, message: "Admin access required"};
  }
  return {admin, decoded, role};
};

module.exports = {applyCors, verifyRequest, resolveRole, requireManager, requireAdmin};
