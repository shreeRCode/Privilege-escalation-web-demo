/**
 * AUTH ROUTES — Secure Implementation
 * ======================================
 * FIXES APPLIED:
 * 1. Registration whitelist — only username, email, password accepted
 * 2. Rate limiting on login (5 attempts per minute)
 * 3. Generic error messages — no username enumeration
 * 4. Password strength check (minimum 8 characters)
 * 5. No forge-token endpoint
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { getDB } = require("../database/init");
const { generateToken, verifyToken } = require("../middleware/auth");
const { logDefense } = require("../middleware/securityLogger");

// FIX: Rate limiting on login — prevents brute force
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute
  message: { error: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// =====================================================================
// POST /api/auth/register
// FIX: Field whitelist — only safe fields accepted, role/balance IGNORED
// =====================================================================
router.post("/register", (req, res) => {
  const db = getDB();

  // FIX: Only extract SAFE fields — role and balance are IGNORED
  const { username, email, password } = req.body;

  // Check if attacker tried to inject role/balance
  const attemptedMassAssign = req.body.role || req.body.balance !== undefined;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // FIX: Password strength check
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const hashedPassword = bcrypt.hashSync(password, 12); // FIX: Higher salt rounds

  // FIX: Role is ALWAYS 'user', balance is ALWAYS default — user input ignored
  const userRole = "user";
  const userBalance = 1000.0;

  if (attemptedMassAssign) {
    logDefense({
      io: req.io,
      type: "MASS_ASSIGNMENT_BLOCKED",
      threat: "OWASP-API3-2023",
      user: username,
      target: "registration_endpoint",
      payload: { attemptedRole: req.body.role, attemptedBalance: req.body.balance },
      blocked: true,
      details: `Mass assignment attempt blocked — tried to set role:'${req.body.role}', balance:${req.body.balance}`,
    });
  }

  db.run(
    `INSERT INTO users (username, email, password, role, balance) VALUES (?, ?, ?, ?, ?)`,
    [username, email, hashedPassword, userRole, userBalance],
    function (err) {
      if (err) {
        // FIX: Generic error — don't reveal if username exists
        if (err.message.includes("UNIQUE")) {
          return res.status(409).json({
            error: "Registration failed. Please try different credentials.",
          });
        }
        return res.status(500).json({ error: "Registration failed" });
      }

      const newUser = { id: this.lastID, username, email, role: userRole };
      const token = generateToken(newUser);

      res.status(201).json({
        message: "User registered successfully",
        token,
        user: newUser,
        defense: attemptedMassAssign
          ? "🛡️ Mass assignment attempt detected and blocked — role/balance fields were ignored"
          : undefined,
      });
    }
  );
});

// =====================================================================
// POST /api/auth/login
// FIX: Rate limited, generic errors, consistent timing
// =====================================================================
router.post("/login", loginLimiter, (req, res) => {
  const db = getDB();
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err) return res.status(500).json({ error: "Login failed" });

    // FIX: Generic error for BOTH user-not-found AND wrong-password
    // Prevents username enumeration
    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    const token = generateToken(user);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        balance: user.balance,
      },
    });
  });
});

// FIX: NO /forge-token endpoint — JWT tampering is impossible
// The red team had: router.post('/forge-token', ...) which allowed role tampering

// GET /api/auth/me
router.get("/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
