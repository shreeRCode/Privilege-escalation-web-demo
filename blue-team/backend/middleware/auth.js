/**
 * BLUE TEAM — Secure JWT Middleware
 * ===================================
 * FIXES APPLIED:
 * 1. Strong, long secret key (in production, use env variable)
 * 2. Only HS256 algorithm — 'none' algorithm REJECTED
 * 3. Short token expiry (1 hour)
 * 4. Role ALWAYS fetched from DB, never trusted from token
 * 5. requireRole checks DB role, not token role
 */

const jwt = require("jsonwebtoken");
const { getDB } = require("../database/init");

// FIX: Strong secret (in production, use process.env.JWT_SECRET)
const JWT_SECRET = "b1u3_t34m_$tr0ng_S3cr3t!_K3y_2024_x9Qm7pLw";

function generateToken(user) {
  // FIX: Only embed user ID and username — role is NOT in token
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
    },
    JWT_SECRET,
    { expiresIn: "1h", algorithm: "HS256" } // FIX: Short expiry
  );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    // FIX: Only accept HS256 — 'none' algorithm is REJECTED
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });

    // FIX: Fetch REAL role from database, don't trust token
    const db = getDB();
    db.get(
      `SELECT id, username, email, role, balance FROM users WHERE id = ?`,
      [decoded.id],
      (err, dbUser) => {
        if (err || !dbUser) {
          return res.status(401).json({ error: "User not found" });
        }

        // Use DB role, not token role
        req.user = {
          id: dbUser.id,
          username: dbUser.username,
          email: dbUser.email,
          role: dbUser.role,
          balance: dbUser.balance,
        };
        next();
      }
    );
  } catch (err) {
    // FIX: Generic error — don't leak token details
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

// FIX: Role check uses DB-verified role (set in verifyToken)
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const roleHierarchy = { user: 1, moderator: 2, admin: 3 };
    const userLevel = roleHierarchy[req.user.role] || 0;
    const requiredLevel = roleHierarchy[role] || 0;

    if (userLevel >= requiredLevel) {
      next();
    } else {
      res.status(403).json({
        error: "Insufficient privileges",
        message: "Your account does not have the required access level",
      });
    }
  };
}

module.exports = { generateToken, verifyToken, requireRole, JWT_SECRET };
