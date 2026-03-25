import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import api from "../utils/api";

const DEFENSE_COLORS = {
  IDOR_BLOCKED: "#2266ff",
  IDOR_UPDATE_BLOCKED: "#2266ff",
  IDOR_FINANCIAL_BLOCKED: "#00ccff",
  MASS_ASSIGNMENT_BLOCKED: "#8866ff",
  ADMIN_ROLE_CHANGE: "#00ff88",
  ADMIN_USER_DELETE: "#ffaa00",
};

export default function DefenseLogPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchLogs();

    socketRef.current = io("http://localhost:5000");
    socketRef.current.on("defense_event", (event) => {
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
        api.get("/defense-log"),
        api.get("/defense-log/stats"),
      ]);
      setLogs(logRes.data.logs || []);
      setStats(statsRes.data.stats || []);
    } catch {}
    finally { setLoading(false); }
  };

  const clearLogs = async () => {
    if (!window.confirm("Clear all defense logs?")) return;
    await api.delete("/defense-log");
    setLogs([]);
    setStats([]);
  };

  const totalEvents = stats.reduce((s, i) => s + i.count, 0);
  const totalBlocked = stats.reduce((s, i) => s + (i.blocked_count || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="page-title">⊜ DEFENSE <span>LOG</span></div>
            <div className="page-subtitle">REAL-TIME DEFENSE EVENT FEED — ALL BLOCKED ATTEMPTS</div>
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
          <div className="stat-value">{totalEvents}</div>
          <div className="stat-label">TOTAL EVENTS</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
          <div className="stat-value" style={{ color: "var(--green)" }}>{totalBlocked}</div>
          <div className="stat-label">ATTACKS BLOCKED</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
          <div className="stat-value" style={{ color: "var(--cyan)" }}>
            {totalEvents > 0 ? Math.round((totalBlocked / totalEvents) * 100) : 100}%
          </div>
          <div className="stat-label">DEFENSE RATE</div>
        </div>
        {stats.map((s) => (
          <div key={s.defense_type} className="stat-card" style={{ flex: 1, minWidth: 140 }}>
            <div className="stat-value" style={{ fontSize: 24, color: DEFENSE_COLORS[s.defense_type] || "var(--blue)" }}>
              {s.count}
            </div>
            <div className="stat-label" style={{ fontSize: 8 }}>
              {s.defense_type.replace(/_/g, " ")}
            </div>
          </div>
        ))}
      </div>

      {/* Log table */}
      <div className="card">
        <div className="card-title">
          ⊜ DEFENSE FEED
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", fontWeight: 400 }}>
            {logs.length} ENTRIES
          </span>
        </div>

        {loading ? (
          <div className="loading">LOADING DEFENSE LOG...</div>
        ) : logs.length === 0 ? (
          <div className="loading">NO DEFENSE EVENTS YET — TEST DEFENSES FROM OTHER PAGES</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>TYPE</th>
                  <th>THREAT</th>
                  <th>USER</th>
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
                        color: DEFENSE_COLORS[log.defense_type] || "var(--blue)",
                        fontWeight: 600,
                        fontSize: 11,
                      }}>
                        {log.defense_type}
                      </span>
                    </td>
                    <td style={{ fontSize: 10 }}>{log.threat_blocked || "—"}</td>
                    <td style={{ color: "var(--text)" }}>{log.user}</td>
                    <td>{log.target || "—"}</td>
                    <td>
                      <span className={`badge ${log.blocked ? "badge-blocked" : "badge-user"}`}>
                        {log.blocked ? "🛡️ BLOCKED" : "✓ ALLOWED"}
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
          from { opacity: 0; background: rgba(34,102,255,0.1); }
          to { opacity: 1; background: transparent; }
        }
      `}</style>
    </div>
  );
}
