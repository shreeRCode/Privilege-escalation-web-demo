const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const adminRoutes = require("./routes/admin");

const app = express();

// ── Middleware ─────────────────────────────────────────────────
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../client")));

// Redirect root to login page
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// Session middleware — proper per-user sessions (FIX for broken auth)
app.use(session({
  secret: "privilege-demo-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 3600000 } // 1 hour
}));

// ── Demo Mode Toggle ──────────────────────────────────────────
// Tracks whether the app is in VULNERABLE or FIXED mode.
// This is used by all routes to demonstrate the attack vs. the fix.
app.locals.demoMode = "vulnerable"; // default: show the vulnerability

app.post("/demo-mode", (req, res) => {
  const { mode } = req.body;
  if (mode !== "vulnerable" && mode !== "fixed") {
    return res.status(400).json({ error: "Mode must be 'vulnerable' or 'fixed'" });
  }
  app.locals.demoMode = mode;
  res.json({ mode, message: `Demo mode switched to: ${mode}` });
});

app.get("/demo-mode", (req, res) => {
  res.json({ mode: app.locals.demoMode });
});

// ── Routes ────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/admin", adminRoutes);

// ── Start Server ──────────────────────────────────────────────
app.listen(3000, () => {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Privilege Escalation Demo Server Running        ║");
  console.log("║  http://localhost:3000                           ║");
  console.log("║  Default mode: VULNERABLE                        ║");
  console.log("╚══════════════════════════════════════════════════╝");
});
