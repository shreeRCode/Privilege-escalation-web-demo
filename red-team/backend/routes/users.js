/**
 * USER ROUTES — Vulnerable Implementation
 * =========================================
 * VULNERABILITIES:
 * 1. IDOR — /api/users/:id returns any user's data without ownership check
 * 2. IDOR on update — any user can update any other user's profile
 * 3. Sensitive data exposed (SSN, credit card) in responses
 * 4. No pagination — full user list exposed
 */

const express = require("express");
const router = express.Router();
const { getDB } = require("../database/init");
const { verifyToken } = require("../middleware/auth");
const { logAttack } = require("../middleware/attackLogger");

// =====================================================================
// GET /api/users
// VULNERABILITY: Returns ALL users with sensitive data — no pagination, no field filtering
// =====================================================================
router.get("/", verifyToken, (req, res) => {
  const db = getDB();

  // VULNERABILITY: Returns SSN, credit card, everything
  db.all(`SELECT id, username, email, role, balance, ssn, credit_card, profile_data, created_at FROM users`, [], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({
      users,
      total: users.length,
      warning: "⚠️ All user data including sensitive fields returned — no field filtering",
    });
  });
});

// =====================================================================
// GET /api/users/:id
// VULNERABILITY: IDOR — No check that req.user.id === params.id
// Any authenticated user can view ANY other user's full profile
// CVE: OWASP API1:2023 — Broken Object Level Authorization
// =====================================================================
router.get("/:id", verifyToken, (req, res) => {
  const db = getDB();
  const targetId = req.params.id;
  const requestingUserId = req.user.id;

  // VULNERABILITY: Missing ownership check
  // FIX WOULD BE:
  // if (req.user.id !== parseInt(targetId) && req.user.role !== 'admin') {
  //   return res.status(403).json({ error: 'Access denied' });
  // }

  const isIDOR = parseInt(targetId) !== requestingUserId;

  db.get(
    `SELECT id, username, email, role, balance, ssn, credit_card, profile_data, created_at FROM users WHERE id = ?`,
    [targetId],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: "User not found" });

      if (isIDOR) {
        logAttack({
          io: req.io,
          type: "IDOR_READ",
          cveId: "OWASP-API1-2023",
          attacker: req.user.username,
          target: user.username,
          payload: { accessedUserId: targetId, attackerUserId: requestingUserId },
          success: true,
          details: `User '${req.user.username}' (ID:${requestingUserId}) accessed '${user.username}' (ID:${targetId}) profile including SSN and credit card`,
        });
      }

      res.json({
        user,
        idor_detected: isIDOR,
        message: isIDOR
          ? `⚠️ IDOR Attack! You (ID:${requestingUserId}) accessed user ID:${targetId}'s data including SSN: ${user.ssn}`
          : "Your own profile",
      });
    }
  );
});

// =====================================================================
// PUT /api/users/:id
// VULNERABILITY: IDOR on UPDATE — any user can update any other user's profile
// Also: Mass assignment on update — can set role, balance, etc.
// =====================================================================
router.put("/:id", verifyToken, (req, res) => {
  const db = getDB();
  const targetId = req.params.id;
  const requestingUserId = req.user.id;

  // VULNERABILITY: No ownership check before update
  const { username, email, profile_data, role, balance, credit_card, ssn } = req.body;

  const isIDOR = parseInt(targetId) !== requestingUserId;
  const isMassAssignment = role || balance !== undefined;

  // Build dynamic update — VULNERABILITY: allows updating ANY field including role
  const fields = [];
  const values = [];

  if (username) { fields.push("username = ?"); values.push(username); }
  if (email) { fields.push("email = ?"); values.push(email); }
  if (profile_data) { fields.push("profile_data = ?"); values.push(JSON.stringify(profile_data)); }
  if (role) { fields.push("role = ?"); values.push(role); } // Mass assignment
  if (balance !== undefined) { fields.push("balance = ?"); values.push(balance); } // Mass assignment
  if (credit_card) { fields.push("credit_card = ?"); values.push(credit_card); }
  if (ssn) { fields.push("ssn = ?"); values.push(ssn); }

  if (fields.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  values.push(targetId);

  db.run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values, function (err) {
    if (err) return res.status(500).json({ error: err.message });

    const attackType = isIDOR && isMassAssignment
      ? "IDOR_UPDATE + MASS_ASSIGNMENT"
      : isIDOR
      ? "IDOR_UPDATE"
      : isMassAssignment
      ? "MASS_ASSIGNMENT"
      : null;

    if (attackType) {
      logAttack({
        io: req.io,
        type: attackType,
        cveId: isIDOR ? "OWASP-API1-2023" : "OWASP-API3-2023",
        attacker: req.user.username,
        target: `user_id:${targetId}`,
        payload: req.body,
        success: true,
        details: `Profile update: IDOR=${isIDOR}, role_changed=${!!role}, balance_changed=${balance !== undefined}`,
      });
    }

    // Fetch updated user
    db.get(`SELECT id, username, email, role, balance, profile_data FROM users WHERE id = ?`, [targetId], (err2, updatedUser) => {
      res.json({
        message: "User updated successfully",
        updatedUser,
        idor_detected: isIDOR,
        mass_assignment_detected: isMassAssignment,
        attacks: attackType
          ? [`⚠️ ${attackType} detected`]
          : ["✅ Legitimate update"],
      });
    });
  });
});

// =====================================================================
// GET /api/users/:id/balance
// VULNERABILITY: IDOR — can check any user's bank balance
// =====================================================================
router.get("/:id/balance", verifyToken, (req, res) => {
  const db = getDB();
  const targetId = req.params.id;
  const isIDOR = parseInt(targetId) !== req.user.id;

  db.get(`SELECT id, username, balance FROM users WHERE id = ?`, [targetId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (isIDOR) {
      logAttack({
        io: req.io,
        type: "IDOR_FINANCIAL",
        cveId: "OWASP-API1-2023",
        attacker: req.user.username,
        target: user.username,
        payload: { targetUserId: targetId },
        success: true,
        details: `Financial data exposed: ${user.username}'s balance $${user.balance}`,
      });
    }

    res.json({
      userId: user.id,
      username: user.username,
      balance: user.balance,
      idor_detected: isIDOR,
      message: isIDOR ? `⚠️ You accessed ${user.username}'s financial data!` : "Your balance",
    });
  });
});

module.exports = router;
