/**
 * USER ROUTES — Secure Implementation
 * ======================================
 * FIXES APPLIED:
 * 1. IDOR protection — ownership check (req.user.id === targetId OR admin)
 * 2. Sensitive fields (SSN, credit_card) NEVER returned to non-admin
 * 3. Update whitelist — only email, profile_data allowed
 * 4. Balance endpoint — own balance only
 */

const express = require("express");
const router = express.Router();
const { getDB } = require("../database/init");
const { verifyToken } = require("../middleware/auth");
const { logDefense } = require("../middleware/securityLogger");

// Safe fields that non-admin users can see
const PUBLIC_FIELDS = "id, username, email, role, balance, profile_data, created_at";
const ALL_FIELDS = "id, username, email, role, balance, ssn, credit_card, profile_data, created_at";

// =====================================================================
// GET /api/users
// FIX: Returns only public fields, no sensitive data
// =====================================================================
router.get("/", verifyToken, (req, res) => {
  const db = getDB();
  const fields = req.user.role === "admin" ? ALL_FIELDS : PUBLIC_FIELDS;

  db.all(`SELECT ${fields} FROM users`, [], (err, users) => {
    if (err) return res.status(500).json({ error: "Failed to fetch users" });

    res.json({
      users,
      total: users.length,
    });
  });
});

// =====================================================================
// GET /api/users/:id
// FIX: Ownership check — can only access OWN profile (or admin)
// =====================================================================
router.get("/:id", verifyToken, (req, res) => {
  const db = getDB();
  const targetId = parseInt(req.params.id);
  const requestingUserId = req.user.id;
  const isAdmin = req.user.role === "admin";

  // FIX: IDOR PROTECTION — ownership check
  if (targetId !== requestingUserId && !isAdmin) {
    logDefense({
      io: req.io,
      type: "IDOR_BLOCKED",
      threat: "OWASP-API1-2023",
      user: req.user.username,
      target: `user_id:${targetId}`,
      payload: { accessedUserId: targetId, attackerUserId: requestingUserId },
      blocked: true,
      details: `IDOR attempt blocked: '${req.user.username}' (ID:${requestingUserId}) tried to access user ID:${targetId}`,
    });

    return res.status(403).json({
      error: "Access denied",
      message: "You can only access your own profile",
      defense: "🛡️ IDOR protection — ownership verification enforced",
    });
  }

  // FIX: Return sensitive fields only to admin
  const fields = isAdmin ? ALL_FIELDS : PUBLIC_FIELDS;

  db.get(
    `SELECT ${fields} FROM users WHERE id = ?`,
    [targetId],
    (err, user) => {
      if (err) return res.status(500).json({ error: "Failed to fetch user" });
      if (!user) return res.status(404).json({ error: "User not found" });

      res.json({
        user,
        message: "Your own profile",
      });
    }
  );
});

// =====================================================================
// PUT /api/users/:id
// FIX: Ownership check + update whitelist (only email, profile_data)
// =====================================================================
router.put("/:id", verifyToken, (req, res) => {
  const db = getDB();
  const targetId = parseInt(req.params.id);
  const requestingUserId = req.user.id;
  const isAdmin = req.user.role === "admin";

  // FIX: Ownership check on update
  if (targetId !== requestingUserId && !isAdmin) {
    logDefense({
      io: req.io,
      type: "IDOR_UPDATE_BLOCKED",
      threat: "OWASP-API1-2023",
      user: req.user.username,
      target: `user_id:${targetId}`,
      payload: req.body,
      blocked: true,
      details: `IDOR update blocked: '${req.user.username}' tried to modify user ID:${targetId}`,
    });

    return res.status(403).json({
      error: "Access denied",
      message: "You can only update your own profile",
      defense: "🛡️ IDOR protection — ownership verification enforced",
    });
  }

  // FIX: Whitelist — only safe fields can be updated
  const { email, profile_data } = req.body;
  const attemptedMassAssign = req.body.role || req.body.balance !== undefined || req.body.ssn || req.body.credit_card;

  if (attemptedMassAssign) {
    logDefense({
      io: req.io,
      type: "MASS_ASSIGNMENT_BLOCKED",
      threat: "OWASP-API3-2023",
      user: req.user.username,
      target: `user_id:${targetId}`,
      payload: { attemptedRole: req.body.role, attemptedBalance: req.body.balance },
      blocked: true,
      details: `Mass assignment on update blocked — tried to set role/balance/ssn/credit_card`,
    });
  }

  const fields = [];
  const values = [];

  if (email) { fields.push("email = ?"); values.push(email); }
  if (profile_data) { fields.push("profile_data = ?"); values.push(JSON.stringify(profile_data)); }

  if (fields.length === 0) {
    return res.status(400).json({
      error: "No valid fields to update",
      allowedFields: ["email", "profile_data"],
      defense: attemptedMassAssign
        ? "🛡️ Mass assignment blocked — role, balance, ssn, credit_card cannot be set via API"
        : undefined,
    });
  }

  values.push(targetId);

  db.run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values, function (err) {
    if (err) return res.status(500).json({ error: "Update failed" });

    db.get(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`, [targetId], (err2, updatedUser) => {
      res.json({
        message: "User updated successfully",
        updatedUser,
        defense: attemptedMassAssign
          ? "🛡️ Mass assignment blocked — only safe fields (email, profile_data) were updated"
          : undefined,
      });
    });
  });
});

// =====================================================================
// GET /api/users/:id/balance
// FIX: Own balance only (or admin)
// =====================================================================
router.get("/:id/balance", verifyToken, (req, res) => {
  const db = getDB();
  const targetId = parseInt(req.params.id);
  const isAdmin = req.user.role === "admin";

  // FIX: Can only view own balance
  if (targetId !== req.user.id && !isAdmin) {
    logDefense({
      io: req.io,
      type: "IDOR_FINANCIAL_BLOCKED",
      threat: "OWASP-API1-2023",
      user: req.user.username,
      target: `user_id:${targetId}`,
      payload: { targetUserId: targetId },
      blocked: true,
      details: `Financial IDOR blocked: '${req.user.username}' tried to access user ID:${targetId}'s balance`,
    });

    return res.status(403).json({
      error: "Access denied",
      message: "You can only view your own balance",
      defense: "🛡️ IDOR protection — financial data access restricted",
    });
  }

  db.get(`SELECT id, username, balance FROM users WHERE id = ?`, [targetId], (err, user) => {
    if (err) return res.status(500).json({ error: "Failed to fetch balance" });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      userId: user.id,
      username: user.username,
      balance: user.balance,
      message: "Your balance",
    });
  });
});

module.exports = router;
