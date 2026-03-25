/**
 * AUTH ROUTES — Vulnerable Implementation
 * =========================================
 * VULNERABILITIES:
 * 1. No rate limiting on login (brute force possible)
 * 2. Mass assignment — user can set their own role on register
 * 3. Verbose error messages reveal if username exists
 * 4. Weak password policy (no enforcement)
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { getDB } = require("../database/init");
const { generateToken, verifyToken } = require("../middleware/auth");
const { logAttack } = require("../middleware/attackLogger");

// =====================================================================
// POST /api/auth/register
// VULNERABILITY: Mass Assignment — accepts 'role' from request body
// Attacker can register with role: "admin"
// CVE Reference: OWASP API3:2023 Broken Object Property Level Auth
// =====================================================================
router.post("/register", (req, res) => {
  const db = getDB();

  // VULNERABILITY: Destructuring ALL fields from body including role
  // FIX WOULD BE: const { username, email, password } = req.body; (ignore role)
  const { username, email, password, role, balance } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  // VULNERABILITY: Using user-supplied role directly
  const userRole = role || "user"; // Attacker sends role: "admin"
  const userBalance = balance || 1000.0; // Attacker can set own balance

  const isMassAssignment = role && role !== "user";

  db.run(
    `INSERT INTO users (username, email, password, role, balance) VALUES (?, ?, ?, ?, ?)`,
    [username, email, hashedPassword, userRole, userBalance],
    function (err) {
      if (err) {
        // VULNERABILITY: Reveals if username already exists
        if (err.message.includes("UNIQUE")) {
          return res.status(409).json({
            error: `Username '${username}' already exists`,
            hint: "Try a different username",
          });
        }
        return res.status(500).json({ error: err.message });
      }

      if (isMassAssignment) {
        logAttack({
          io: req.io,
          type: "MASS_ASSIGNMENT",
          cveId: "OWASP-API3-2023",
          attacker: username,
          target: "registration_endpoint",
          payload: { role, balance },
          success: true,
          details: `User registered with elevated role: ${userRole}`,
        });
      }

      const newUser = { id: this.lastID, username, email, role: userRole };
      const token = generateToken(newUser);

      res.status(201).json({
        message: "User registered successfully",
        token,
        user: newUser,
        warning: isMassAssignment ? "⚠️ Mass assignment succeeded — role was set to: " + userRole : undefined,
      });
    }
  );
});

// =====================================================================
// POST /api/auth/login
// VULNERABILITY: No rate limiting, verbose errors, timing attacks possible
// =====================================================================
router.post("/login", (req, res) => {
  const db = getDB();
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });

    // VULNERABILITY: Different errors for "user not found" vs "wrong password"
    // This allows username enumeration
    if (!user) {
      return res.status(401).json({
        error: "User not found", // Should be generic: "Invalid credentials"
        hint: `No account with username '${username}'`,
      });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        error: "Incorrect password", // Should be generic
        hint: "Check your password and try again",
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

// =====================================================================
// POST /api/auth/forge-token
// VULNERABILITY: Educational endpoint showing JWT role tampering
// Generates a token with any role the attacker specifies
// =====================================================================
router.post("/forge-token", verifyToken, (req, res) => {
  const { targetRole } = req.body;

  const validRoles = ["user", "moderator", "admin"];
  if (!validRoles.includes(targetRole)) {
    return res.status(400).json({ error: "Invalid role", validRoles });
  }

  // Forge a token with elevated role — simulating JWT manipulation attack
  const forgedToken = generateToken({
    ...req.user,
    role: targetRole,
  });

  logAttack({
    io: req.io,
    type: "JWT_ROLE_TAMPERING",
    cveId: "CVE-2022-21449",
    attacker: req.user.username,
    target: "jwt_middleware",
    payload: { originalRole: req.user.role, forgedRole: targetRole },
    success: true,
    details: `JWT forged from role '${req.user.role}' to '${targetRole}'`,
  });

  res.json({
    message: "Token forged successfully",
    originalRole: req.user.role,
    forgedRole: targetRole,
    forgedToken,
    explanation:
      "This token has your user ID but an elevated role. Because the server trusts the role in the token without DB verification, this grants you elevated access.",
    cve: "CVE-2022-21449 — Broken Object Level Authorization via JWT manipulation",
  });
});

// GET /api/auth/me
router.get("/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
