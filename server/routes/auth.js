const express = require("express");
const router = express.Router();
const users = require("../database/users.json");

// ── POST /auth/login ──────────────────────────────────────────
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  // FIX: Store user in session (not a broken global variable)
  req.session.user = { id: user.id, username: user.username, role: user.role };

  // Never return the password field
  res.json({ id: user.id, username: user.username, role: user.role });
});

// ── POST /auth/logout ─────────────────────────────────────────
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.json({ message: "Logged out successfully" });
  });
});

// ── GET /auth/me ──────────────────────────────────────────────
// Returns the current session user (for page load checks)
router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json(req.session.user);
});

module.exports = router;
