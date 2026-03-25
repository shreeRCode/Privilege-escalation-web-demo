/**
 * ADMIN ROUTES — Secure Implementation
 * =======================================
 * FIXES APPLIED:
 * 1. DB-verified admin role check (via middleware — role from DB, not JWT)
 * 2. No secret config endpoint (removed forced browsing target)
 * 3. User listing excludes SSN, credit_card
 * 4. Self-delete protection
 * 5. Audit trail for admin actions
 */

const express = require("express");
const router = express.Router();
const { getDB } = require("../database/init");
const { verifyToken, requireRole } = require("../middleware/auth");
const { logDefense } = require("../middleware/securityLogger");

// =====================================================================
// GET /api/admin/dashboard
// FIX: Role verified from DB (in verifyToken middleware), not from JWT
// =====================================================================
router.get("/dashboard", verifyToken, requireRole("admin"), (req, res) => {
  const db = getDB();

  // FIX: Don't expose SSN/credit_card even to admin in dashboard view
  db.all(`SELECT id, username, email, role, balance, created_at FROM users`, [], (err, users) => {
    if (err) return res.status(500).json({ error: "Failed to load dashboard" });

    db.get(`SELECT COUNT(*) as total FROM defense_log`, [], (err2, stats) => {
      res.json({
        message: "🔵 Admin Dashboard — Secure Access",
        accessedBy: req.user.username,
        roleVerifiedFromDB: true,
        systemStats: {
          totalUsers: users.length,
          totalDefenseEvents: stats?.total || 0,
        },
        allUsers: users,
        capabilities: [
          "View user accounts (no PII exposed)",
          "Manage user roles",
          "View defense event logs",
        ],
      });
    });
  });
});

// =====================================================================
// GET /api/admin/users
// FIX: Excludes sensitive PII (SSN, credit_card, password)
// =====================================================================
router.get("/users", verifyToken, requireRole("admin"), (req, res) => {
  const db = getDB();

  // FIX: Never return passwords or sensitive PII
  db.all(`SELECT id, username, email, role, balance, profile_data, created_at FROM users`, [], (err, users) => {
    if (err) return res.status(500).json({ error: "Failed to fetch users" });

    res.json({
      totalUsers: users.length,
      users,
    });
  });
});

// =====================================================================
// POST /api/admin/users/:id/promote
// FIX: DB-verified admin check, audit trail
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
    if (err) return res.status(500).json({ error: "Failed to find user" });
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    db.run(`UPDATE users SET role = ? WHERE id = ?`, [newRole, targetId], function (updateErr) {
      if (updateErr) return res.status(500).json({ error: "Role update failed" });

      // Audit trail
      logDefense({
        io: req.io,
        type: "ADMIN_ROLE_CHANGE",
        threat: null,
        user: req.user.username,
        target: targetUser.username,
        payload: { oldRole: targetUser.role, newRole },
        blocked: false,
        details: `Admin '${req.user.username}' changed '${targetUser.username}' role: ${targetUser.role} → ${newRole}`,
      });

      res.json({
        message: `User ${targetUser.username} role updated from '${targetUser.role}' to '${newRole}'`,
        securityNote: "This action has been logged in the audit trail",
      });
    });
  });
});

// =====================================================================
// DELETE /api/admin/users/:id
// FIX: Self-delete protection, audit trail
// =====================================================================
router.delete("/users/:id", verifyToken, requireRole("admin"), (req, res) => {
  const db = getDB();
  const targetId = req.params.id;

  db.get(`SELECT username FROM users WHERE id = ?`, [targetId], (err, user) => {
    if (err) return res.status(500).json({ error: "Failed to find user" });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (targetId == req.user.id) {
      return res.status(400).json({ error: "Cannot delete yourself" });
    }

    db.run(`DELETE FROM users WHERE id = ?`, [targetId], function (deleteErr) {
      if (deleteErr) return res.status(500).json({ error: "Delete failed" });

      logDefense({
        io: req.io,
        type: "ADMIN_USER_DELETE",
        threat: null,
        user: req.user.username,
        target: user.username,
        payload: { deletedUserId: targetId },
        blocked: false,
        details: `Admin '${req.user.username}' deleted user '${user.username}' — audit logged`,
      });

      res.json({
        message: `User '${user.username}' deleted successfully`,
        deletedBy: req.user.username,
        securityNote: "Action recorded in audit trail",
      });
    });
  });
});

// FIX: NO /secret endpoint — forced browsing target REMOVED
// The red team had: router.get('/secret', ...) which exposed API keys and DB passwords

module.exports = router;
