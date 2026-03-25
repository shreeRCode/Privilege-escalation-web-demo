/**
 * Attack Log Routes
 * Provides attack history for the Purple Team Dashboard
 */

const express = require("express");
const router = express.Router();
const { getDB } = require("../database/init");

// GET /api/attack-log — returns all logged attacks
router.get("/", (req, res) => {
  const db = getDB();

  db.all(
    `SELECT * FROM attack_log ORDER BY timestamp DESC LIMIT 100`,
    [],
    (err, logs) => {
      if (err) return res.status(500).json({ error: err.message });

      // Parse payload JSON
      const parsed = logs.map((log) => ({
        ...log,
        payload: (() => {
          try { return JSON.parse(log.payload); }
          catch { return log.payload; }
        })(),
        success: log.success === 1,
      }));

      res.json({ logs: parsed, total: parsed.length });
    }
  );
});

// GET /api/attack-log/stats
router.get("/stats", (req, res) => {
  const db = getDB();

  db.all(
    `SELECT attack_type, COUNT(*) as count, SUM(success) as successes
     FROM attack_log GROUP BY attack_type`,
    [],
    (err, stats) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ stats });
    }
  );
});

// DELETE /api/attack-log — reset logs
router.delete("/", (req, res) => {
  const db = getDB();
  db.run(`DELETE FROM attack_log`, [], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Attack log cleared", deleted: this.changes });
  });
});

module.exports = router;
