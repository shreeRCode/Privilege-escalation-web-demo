/**
 * BLUE TEAM — Secure Backend Server
 * ====================================
 * All privilege escalation vulnerabilities FIXED.
 * FIXES: Restricted CORS, generic errors, global auth, no stack traces.
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
const defenseLogRoutes = require("./routes/defenseLog");

const app = express();
const server = http.createServer(app);

// FIX #1: Restricted CORS — only allow trusted frontend origin
const ALLOWED_ORIGIN = "http://localhost:3001";

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ["GET", "POST"] },
});

app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Attach io to every request so routes can emit events
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/defense-log", defenseLogRoutes);

// FIX #3: Generic error handler — NO stack traces leaked
app.use((err, req, res, next) => {
  console.error(err.stack); // Log internally only
  res.status(500).json({
    error: "An internal server error occurred",
    // NO stack trace, NO err.message exposed
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "secure-and-running", port: 5000 });
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
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`\n🔵 BLUE TEAM Secure Server running on port ${PORT}`);
    console.log(`   🛡️  All vulnerabilities FIXED`);
    console.log(`   📚 Secure implementation for comparison\n`);
  });
});

module.exports = { app, io };
