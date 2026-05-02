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

      // Emit to dashboard via WebSocket (existing event)
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

        // Emit blue:blocked event for the defense monitor
        if (blocked) {
          const endpoint = payload?.http?.path || target || "unknown";
          const reason = type.replace(/_/g, " ").toLowerCase();
          io.emit("blue:blocked", {
            type,
            endpoint,
            reason: details || reason,
            ts: new Date().toISOString(),
            user: user || "anonymous",
            threat: threat || null,
          });
        }
      }
    }
  );
}

module.exports = { logDefense };
