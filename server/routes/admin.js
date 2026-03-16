const express = require("express");
const router = express.Router();
const users = require("../database/users.json");

// ── GET /admin ────────────────────────────────────────────────
//
// VULNERABLE MODE:
//   Admin panel is accessible to ANY request — no auth, no role check.
//   → Vertical Privilege Escalation
//
// FIXED MODE:
//   Requires an active session AND the user must have role === "admin".
//   Returns 401 if not logged in, 403 if logged in but not admin.
//
router.get("/", (req, res) => {
  const demoMode = req.app.locals.demoMode;

  // ── VULNERABLE MODE ─────────────────────────────────────────
  if (demoMode === "vulnerable") {
    // ❌ No authentication check
    // ❌ No role check
    // Any user (or even unauthenticated request) gains admin access
    return res.json({
      _demo_note: "VULNERABLE: No authentication or role check performed",
      message: "Welcome to the Admin Panel",
      users: users.map(u => ({ id: u.id, username: u.username, role: u.role })),
      admin_data: {
        total_users: users.length,
        server_info: "Node.js v18 — Ubuntu 22.04",
        secret_config: "db_password=admin123_super_secret",
      },
    });
  }

  // ── FIXED MODE ───────────────────────────────────────────────
  // ✅ Step 1: Check authentication
  if (!req.session.user) {
    return res.status(401).json({
      error: "Not authenticated. Please log in first.",
      _demo_note: "FIXED: Authentication check blocked unauthenticated access",
    });
  }

  // ✅ Step 2: Check role — only admins allowed
  if (req.session.user.role !== "admin") {
    return res.status(403).json({
      error: "Forbidden — admin access only",
      _demo_note: "FIXED: Role check blocked non-admin user",
      your_role: req.session.user.role,
      required_role: "admin",
    });
  }

  // ✅ Step 3: Serve admin content only to verified admins
  return res.json({
    _demo_note: "FIXED: Only admin users can reach this response",
    message: `Welcome to the Admin Panel, ${req.session.user.username}!`,
    users: users.map(u => ({ id: u.id, username: u.username, role: u.role })),
    admin_data: {
      total_users: users.length,
      server_info: "Node.js v18 — Ubuntu 22.04",
    },
  });
});

module.exports = router;
