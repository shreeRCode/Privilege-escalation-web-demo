import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import api from "../utils/api";

const ATTACK_COLORS = {
  IDOR_READ: "#ff2244",
  IDOR_UPDATE: "#ff2244",
  IDOR_FINANCIAL: "#ff6600",
  JWT_ROLE_TAMPERING: "#cc00ff",
  MASS_ASSIGNMENT: "#ff8800",
  VERTICAL_ESCALATION: "#ff2244",
  VERTICAL_ESCALATION_DESTRUCT: "#ff0000",
};

export default function AttackLogPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const tableRef = useRef(null);

  useEffect(() => {
    fetchLogs();

    // WebSocket for live feed
    socketRef.current = io("http://localhost:4000");
    socketRef.current.on("attack_event", (event) => {
      if (live) {
        setLogs((prev) => [
          { ...event, id: event.id || Date.now(), isNew: true },
          ...prev,
        ].slice(0, 100));
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [logRes, statsRes] = await Promise.all([
        api.get("/attack-log"),
        api.get("/attack-log/stats"),
      ]);
      setLogs(logRes.data.logs || []);
      setStats(statsRes.data.stats || []);
    } catch {}
    finally { setLoading(false); }
  };

  const clearLogs = async () => {
    if (!window.confirm("Clear all attack logs?")) return;
    await api.delete("/attack-log");
    setLogs([]);
    setStats([]);
  };

  const totalAttacks = stats.reduce((s, i) => s + i.count, 0);
  const totalSuccess = stats.reduce((s, i) => s + i.successes, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="page-title">⊜ ATTACK <span>LOG</span></div>
            <div className="page-subtitle">REAL-TIME ATTACK FEED — ALL SESSIONS</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: live ? "var(--green)" : "var(--text-dim)",
              background: "var(--bg-2)",
              border: `1px solid ${live ? "rgba(0,255,136,0.2)" : "var(--border-dim)"}`,
              padding: "6px 12px",
              borderRadius: 6,
              cursor: "pointer",
            }} onClick={() => setLive(!live)}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: live ? "var(--green)" : "var(--text-faint)",
                boxShadow: live ? "0 0 6px var(--green)" : "none",
                animation: live ? "blink 1.4s ease-in-out infinite" : "none",
              }} />
              {live ? "LIVE" : "PAUSED"}
            </div>
            <button className="btn btn-outline" onClick={fetchLogs} style={{ fontSize: 11 }}>⟳ REFRESH</button>
            <button
              className="btn btn-outline"
              onClick={clearLogs}
              style={{ fontSize: 11, color: "var(--amber)", borderColor: "rgba(255,170,0,0.3)" }}
            >
              ✕ CLEAR
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
          <div className="stat-value">{totalAttacks}</div>
          <div className="stat-label">TOTAL</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
          <div className="stat-value" style={{ color: "var(--green)" }}>{totalSuccess}</div>
          <div className="stat-label">SUCCESSFUL</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
          <div className="stat-value" style={{ color: "var(--amber)" }}>
            {totalAttacks > 0 ? Math.round((totalSuccess / totalAttacks) * 100) : 0}%
          </div>
          <div className="stat-label">SUCCESS RATE</div>
        </div>
        {stats.map((s) => (
          <div key={s.attack_type} className="stat-card" style={{ flex: 1, minWidth: 140 }}>
            <div className="stat-value" style={{ fontSize: 24, color: ATTACK_COLORS[s.attack_type] || "var(--red)" }}>
              {s.count}
            </div>
            <div className="stat-label" style={{ fontSize: 8 }}>
              {s.attack_type.replace(/_/g, " ")}
            </div>
          </div>
        ))}
      </div>

      {/* Log table */}
      <div className="card">
        <div className="card-title">
          ⊜ ATTACK FEED
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", fontWeight: 400 }}>
            {logs.length} ENTRIES
          </span>
        </div>

        {loading ? (
          <div className="loading">LOADING ATTACK LOG...</div>
        ) : logs.length === 0 ? (
          <div className="loading">NO ATTACKS LOGGED YET — EXECUTE ATTACKS FROM OTHER PAGES</div>
        ) : (
          <div style={{ overflowX: "auto" }} ref={tableRef}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>TYPE</th>
                  <th>CVE</th>
                  <th>ATTACKER</th>
                  <th>TARGET</th>
                  <th>STATUS</th>
                  <th>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    style={{
                      animation: log.isNew ? "fadeIn 0.4s ease" : "none",
                    }}
                  >
                    <td style={{ whiteSpace: "nowrap", fontSize: 10 }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td>
                      <span style={{
                        color: ATTACK_COLORS[log.attack_type] || "var(--red)",
                        fontWeight: 600,
                        fontSize: 11,
                      }}>
                        {log.attack_type}
                      </span>
                    </td>
                    <td style={{ fontSize: 10 }}>{log.cve_id || "—"}</td>
                    <td style={{ color: "var(--text)" }}>{log.attacker_user}</td>
                    <td>{log.target_user || "—"}</td>
                    <td>
                      <span className={`badge ${log.success ? "badge-admin" : "badge-user"}`}>
                        {log.success ? "✓ SUCCESS" : "✗ FAILED"}
                      </span>
                    </td>
                    <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, color: "var(--text-faint)" }}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; background: rgba(255,34,68,0.1); }
          to { opacity: 1; background: transparent; }
        }
      `}</style>
    </div>
  );
}
