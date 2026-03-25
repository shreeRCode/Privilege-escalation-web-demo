/**
 * ADMIN ROUTES — Vulnerable Implementation
 * ==========================================
 * VULNERABILITIES:
 * 1. Forced browsing — admin routes accessible via direct URL
 * 2. Broken function level auth — JWT role check only (not DB verified)
 * 3. Admin endpoints expose all user data
 * 4. Privilege escalation via forged JWT token
 */

const express = require("express");
const router = express.Router();
const { getDB } = require("../database/init");
const { verifyToken, requireRole } = require("../middleware/auth");
const { logAttack } = require("../middleware/attackLogger");

// =====================================================================
// GET /api/admin/dashboard
// VULNERABILITY: Broken Function Level Authorization
// Role check is done via JWT token — attacker with forged token gets in
// CVE: OWASP API5:2023 — Broken Function Level Authorization
// =====================================================================
router.get("/dashboard", verifyToken, requireRole("admin"), (req, res) => {
  const db = getDB();

  // Log if this was accessed via forged token (role mismatch simulation)
  logAttack({
    io: req.io,
    type: "VERTICAL_ESCALATION",
    cveId: "OWASP-API5-2023",
    attacker: req.user.username,
    target: "admin_dashboard",
    payload: { tokenRole: req.user.role },
    success: true,
    details: `Admin dashboard accessed by '${req.user.username}' with role '${req.user.role}' (may be forged JWT)`,
  });

  db.all(`SELECT id, username, email, role, balance, ssn, credit_card, created_at FROM users`, [], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });

    db.get(`SELECT COUNT(*) as total FROM attack_log`, [], (err2, stats) => {
      res.json({
        message: "🔴 Admin Dashboard — Full system access",
        accessedBy: req.user.username,
        tokenRole: req.user.role,
        warning: "This route checks JWT role only — a forged token with role:admin bypasses this",
        systemStats: {
          totalUsers: users.length,
          totalAttacks: stats?.total || 0,
        },
        allUsers: users, // VULNERABILITY: Returns everything including SSN/CC
        dangerousCapabilities: [
          "View all users' SSN and credit cards",
          "Delete any user",
          "Change any user's role",
          "Access full system logs",
        ],
      });
    });
  });
});

// =====================================================================
// GET /api/admin/users
// VULNERABILITY: Returns full user dump including PII
// =====================================================================
router.get("/users", verifyToken, requireRole("admin"), (req, res) => {
  const db = getDB();

  db.all(`SELECT * FROM users`, [], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({
      totalUsers: users.length,
      users, // Exposes passwords (hashed but still) + all PII
    });
  });
});

// =====================================================================
// POST /api/admin/users/:id/promote
// VULNERABILITY: Vertical privilege escalation — promotes any user to any role
// =====================================================================
router.post("/users/:id/promote", verifyToken, requireRole("admin"), (req, res) => {
  const db = getDB();
  const { newRole } = req.body;
  const targetId = req.params.id;

  const validRoles = ["user", "moderator", "admin"];
  if (!validRoles.includes(newRole)) {
    return res.status(400).json({ error: "Invalid role", validRoles });
  }

  db.get(`SELECT * FROM users WHERE id = ?`, [targetId], (err, targetUser) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    db.run(`UPDATE users SET role = ? WHERE id = ?`, [newRole, targetId], function (updateErr) {
      if (updateErr) return res.status(500).json({ error: updateErr.message });

      logAttack({
        io: req.io,
        type: "VERTICAL_ESCALATION",
        cveId: "OWASP-API5-2023",
        attacker: req.user.username,
        target: targetUser.username,
        payload: { oldRole: targetUser.role, newRole },
        success: true,
        details: `Role escalation: ${targetUser.username} from '${targetUser.role}' to '${newRole}'`,
      });

      res.json({
        message: `User ${targetUser.username} promoted from '${targetUser.role}' to '${newRole}'`,
        attackChain: [
          "1. Attacker logged in as regular user",
          "2. Used /api/auth/forge-token to get admin JWT",
          "3. Called /api/admin/users/:id/promote with forged token",
          "4. Successfully escalated another user's privileges",
        ],
      });
    });
  });
});

// =====================================================================
// DELETE /api/admin/users/:id
// VULNERABILITY: Vertical escalation allows deleting any user
// =====================================================================
router.delete("/users/:id", verifyToken, requireRole("admin"), (req, res) => {
  const db = getDB();
  const targetId = req.params.id;

  db.get(`SELECT username FROM users WHERE id = ?`, [targetId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (targetId == req.user.id) {
      return res.status(400).json({ error: "Cannot delete yourself" });
    }

    db.run(`DELETE FROM users WHERE id = ?`, [targetId], function (deleteErr) {
      if (deleteErr) return res.status(500).json({ error: deleteErr.message });

      logAttack({
        io: req.io,
        type: "VERTICAL_ESCALATION_DESTRUCT",
        cveId: "OWASP-API5-2023",
        attacker: req.user.username,
        target: user.username,
        payload: { deletedUserId: targetId },
        success: true,
        details: `User '${user.username}' deleted by '${req.user.username}' via privilege escalation`,
      });

      res.json({
        message: `User '${user.username}' deleted successfully`,
        deletedBy: req.user.username,
        attackType: "Vertical Privilege Escalation → Destructive Action",
      });
    });
  });
});

// =====================================================================
// GET /api/admin/secret
// VULNERABILITY: Forced browsing — no additional auth beyond JWT role
// =====================================================================
router.get("/secret", verifyToken, requireRole("admin"), (req, res) => {
  res.json({
    secretData: "SUPER_SECRET_API_KEY_12345",
    dbPassword: "admin_db_pass_2024",
    internalEndpoints: [
      "/api/internal/reset-all-passwords",
      "/api/internal/export-all-data",
      "/api/internal/drop-tables",
    ],
    message: "🔴 Sensitive config data exposed via forced browsing + privilege escalation",
  });
});

module.exports = router;
