/**
 * Attack Logger
 * Logs all attack attempts to DB and emits via WebSocket to purple team dashboard
 */

const { getDB } = require("../database/init");

function logAttack({ io, type, cveId, attacker, target, payload, success, details }) {
  const db = getDB();

  db.run(
    `INSERT INTO attack_log (attack_type, cve_id, attacker_user, target_user, payload, success, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [type, cveId || null, attacker || "anonymous", target || null, JSON.stringify(payload), success ? 1 : 0, details || null],
    function (err) {
      if (err) console.error("Attack log error:", err);

      // Emit to purple team dashboard via WebSocket
      if (io) {
        io.emit("attack_event", {
          id: this?.lastID,
          type,
          cveId,
          attacker,
          target,
          payload,
          success,
          details,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}

module.exports = { logAttack };
