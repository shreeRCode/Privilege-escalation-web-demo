/**
 * Security Logger
 * Logs all blocked attack attempts to DB and emits via WebSocket
 */

const { getDB } = require("../database/init");

function logDefense({ io, type, threat, user, target, payload, blocked, details }) {
  const db = getDB();

  db.run(
    `INSERT INTO defense_log (defense_type, threat_blocked, user, target, payload, blocked, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [type, threat || null, user || "anonymous", target || null, JSON.stringify(payload), blocked ? 1 : 0, details || null],
    function (err) {
      if (err) console.error("Defense log error:", err);

      // Emit to dashboard via WebSocket
      if (io) {
        io.emit("defense_event", {
          id: this?.lastID,
          type,
          threat,
          user,
          target,
          payload,
          blocked,
          details,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}

module.exports = { logDefense };
