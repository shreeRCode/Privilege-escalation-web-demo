/**
 * RED TEAM - Vulnerable Backend Server
 * =====================================
 * This server is INTENTIONALLY VULNERABLE for educational purposes.
 * Contains: IDOR, broken JWT, mass assignment, forced browsing vulnerabilities.
 * DO NOT use in production.
 */

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const { initDB } = require("./database/init");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const adminRoutes = require("./routes/admin");
const attackLogRoutes = require("./routes/attackLog");

const app = express();
const server = http.createServer(app);

// =====================================================================
// VULNERABILITY #1: Overly permissive CORS (allows any origin)
// FIX WOULD BE: cors({ origin: 'https://trusted-domain.com' })
// =====================================================================
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors()); // VULNERABILITY: No origin restriction
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Attach io to every request so routes can emit events
app.use((req, res, next) => {
  req.io = io;
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
  });
});

module.exports = { app, io };
