/**
 * VULNERABLE JWT Middleware
 * =========================
 * VULNERABILITIES:
 * 1. Accepts 'none' algorithm (CVE-2022-21449 style)
 * 2. Weak secret key
 * 3. No token expiry check
 * 4. Role extracted directly from token without DB verification
 */

const jwt = require("jsonwebtoken");

// VULNERABILITY: Weak, hardcoded secret
const JWT_SECRET = "secret123";

function generateToken(user) {
  // VULNERABILITY: Role embedded in token — attacker can forge role
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role, // Should be fetched from DB on each request, not stored in token
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: "7d" } // Too long expiry
  );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    // VULNERABILITY #1: Allows 'none' algorithm — attacker can skip signature
    // FIX: jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256", "none"] });

    // VULNERABILITY #2: Role taken from token directly, not verified in DB
    // Attacker can craft token with role: "admin"
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token", details: err.message });
  }
}

// Weak role check — only checks token payload, not DB
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
        yourRole: req.user.role,
        requiredRole: role,
      });
    }
  };
}

module.exports = { generateToken, verifyToken, requireRole, JWT_SECRET };
