/**
 * RED TEAM - Vulnerable Backend Server
 * =====================================
 * This server is INTENTIONALLY VULNERABLE for educational purposes.
 * Contains: IDOR, broken JWT, mass assignment, forced browsing vulnerabilities.
 * DO NOT use in production.
 */

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const AttackAgent = require("./attackAgent");
const { createAgentRouter } = require("./routes/agent");

const { initDB, getDB } = require("./database/init");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const adminRoutes = require("./routes/admin");
const attackLogRoutes = require("./routes/attackLog");

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:3001"];

// =====================================================================
// VULNERABILITY #1: Overly permissive CORS (allows any origin)
// FIX WOULD BE: cors({ origin: 'https://trusted-domain.com' })
// =====================================================================
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"], credentials: true },
});

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Attach io to every request so routes can emit events
app.use((req, res, next) => {
  req.io = io;
  next();
});

// =====================================================================
// Real-time request counter middleware
// Emits red:request Socket.IO event for every incoming request
// =====================================================================
let requestCounter = 0;
app.use((req, res, next) => {
  requestCounter++;
  io.emit("red:request", {
    method: req.method,
    path: req.originalUrl,
    ts: new Date().toISOString(),
    count: requestCounter,
  });
  next();
});

// =====================================================================
// VULNERABILITY #2: No global auth middleware — each route decides
// This makes it easy to forget auth checks (and we "forget" often)
// =====================================================================

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/attack-log", attackLogRoutes);

// Attack agent (smart adaptive agent with chained attacks)
const attackAgent = new AttackAgent(io);
app.use("/agent", createAgentRouter(attackAgent));

// GET /admin/audit-log — paginated access to attack_log table
app.get("/api/admin/audit-log", (req, res) => {
  const db = getDB();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  db.get("SELECT COUNT(*) as total FROM attack_log", [], (err, countRow) => {
    if (err) return res.status(500).json({ error: err.message });
    const total = countRow?.total || 0;

    db.all(
      "SELECT * FROM attack_log ORDER BY timestamp DESC LIMIT ? OFFSET ?",
      [limit, offset],
      (err2, rows) => {
        if (err2) return res.status(500).json({ error: err2.message });
        const parsed = rows.map((log) => ({
          ...log,
          payload: (() => { try { return JSON.parse(log.payload); } catch { return log.payload; } })(),
          success: log.success === 1,
        }));
        res.json({ logs: parsed, total, page, limit, pages: Math.ceil(total / limit) });
      }
    );
  });
});

// =====================================================================
// VULNERABILITY #3: Verbose error messages leak stack traces
// =====================================================================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message,
    stack: err.stack, // NEVER expose in production
    hint: "Something broke on the server side",
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "vulnerable-and-running", port: 4000 });
});

// WebSocket connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Initialize DB then start server
initDB().then(() => {
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`\n🔴 RED TEAM Vulnerable Server running on port ${PORT}`);
    console.log(`   ⚠️  This server is INTENTIONALLY VULNERABLE`);
    console.log(`   📚 For educational/CTF purposes only\n`);

    // Auto-start attack agent is DISABLED because the user requested that
    // the live battle should only advance when the human clicks execute.
    // attackAgent.start();
  });
});

module.exports = { app, io };
