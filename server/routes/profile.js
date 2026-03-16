const express = require("express");
const router = express.Router();
const users = require("../database/users.json");

// ── GET /profile?id=N ─────────────────────────────────────────
//
// VULNERABLE MODE:
//   Returns any user's data based on the supplied ?id= query parameter.
//   No authentication or ownership check performed.
//   → Horizontal Privilege Escalation (IDOR)
//
// FIXED MODE:
//   Requires an active session.
//   Enforces that the logged-in user can only view their own profile.
//   Admins may view any profile.
//   Password field is never returned.
//
router.get("/", (req, res) => {
  const demoMode = req.app.locals.demoMode;
  const id = parseInt(req.query.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  // ── VULNERABLE MODE ─────────────────────────────────────────
  if (demoMode === "vulnerable") {
    // ❌ No authentication — anyone can query any profile
    // ❌ No ownership check — Alice can fetch Bob's data
    // ❌ Returns raw user object including password
    const user = users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      _demo_note: "VULNERABLE: No ownership check performed",
      id: user.id,
      username: user.username,
      password: user.password, // intentionally exposed in vulnerable mode
      role: user.role,
    });
  }

  // ── FIXED MODE ───────────────────────────────────────────────
  // ✅ Step 1: Check authentication
  if (!req.session.user) {
    return res.status(401).json({
      error: "Not authenticated. Please log in first.",
      _demo_note: "FIXED: Authentication required",
    });
  }

  // ✅ Step 2: Enforce ownership — users can only see their own profile
  // Admins are allowed to view any profile
  if (req.session.user.id !== id && req.session.user.role !== "admin") {
    return res.status(403).json({
      error: "Forbidden — you cannot access another user's profile",
      _demo_note: "FIXED: Ownership check prevented IDOR",
      your_id: req.session.user.id,
      requested_id: id,
    });
  }

  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: "User not found" });

  // ✅ Step 3: Strip sensitive fields before returning
  return res.json({
    _demo_note: "FIXED: Only your own profile returned, password hidden",
    id: user.id,
    username: user.username,
    role: user.role,
    // password intentionally NOT returned
  });
});

module.exports = router;
