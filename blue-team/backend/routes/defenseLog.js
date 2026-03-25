/**
 * Defense Log Routes
 * Provides defense event history for the Blue Team Dashboard
 */

const express = require("express");
const router = express.Router();
const { getDB } = require("../database/init");

// GET /api/defense-log — returns all logged defense events
router.get("/", (req, res) => {
  const db = getDB();

  db.all(
    `SELECT * FROM defense_log ORDER BY timestamp DESC LIMIT 100`,
    [],
    (err, logs) => {
      if (err) return res.status(500).json({ error: "Failed to fetch logs" });

      const parsed = logs.map((log) => ({
        ...log,
        payload: (() => {
          try { return JSON.parse(log.payload); }
          catch { return log.payload; }
        })(),
        blocked: log.blocked === 1,
      }));

      res.json({ logs: parsed, total: parsed.length });
    }
  );
});

// GET /api/defense-log/stats
router.get("/stats", (req, res) => {
  const db = getDB();

  db.all(
    `SELECT defense_type, COUNT(*) as count, SUM(blocked) as blocked_count
     FROM defense_log GROUP BY defense_type`,
    [],
    (err, stats) => {
      if (err) return res.status(500).json({ error: "Failed to fetch stats" });
      res.json({ stats });
    }
  );
});

// DELETE /api/defense-log — reset logs
router.delete("/", (req, res) => {
  const db = getDB();
  db.run(`DELETE FROM defense_log`, [], function (err) {
    if (err) return res.status(500).json({ error: "Failed to clear logs" });
    res.json({ message: "Defense log cleared", deleted: this.changes });
  });
});

module.exports = router;
