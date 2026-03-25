import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const DEFENSE_CARDS = [
  {
    id: "idor",
    path: "/idor-defense",
    icon: "⊕",
    title: "IDOR Defense",
    type: "OWNERSHIP CHECK",
    fix: "OWASP API1:2023",
    desc: "Ownership verification blocks unauthorized access to other users' profiles, financial data, and SSN.",
    color: "#2266ff",
  },
  {
    id: "jwt",
    path: "/jwt-defense",
    icon: "⊗",
    title: "JWT Defense",
    type: "DB-VERIFIED ROLES",
    fix: "CVE-2022-21449",
    desc: "HS256-only algorithm, DB-verified roles, and no forge endpoint make JWT tampering impossible.",
    color: "#00ccff",
  },
  {
    id: "mass",
    path: "/mass-assign-defense",
    icon: "⊘",
    title: "Mass Assignment Defense",
    type: "FIELD WHITELIST",
    fix: "OWASP API3:2023",
    desc: "Registration and update endpoints use strict field whitelists — role and balance fields are always ignored.",
    color: "#8866ff",
  },
  {
    id: "admin",
    path: "/admin-defense",
    icon: "⊛",
    title: "Admin Access Defense",
    type: "DB-VERIFIED AUTH",
    fix: "OWASP API5:2023",
    desc: "Admin endpoints verify roles from the database on every request. No secret config endpoint exists.",
    color: "#2266ff",
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [logRes, statsRes] = await Promise.all([
        api.get("/defense-log?limit=5"),
        api.get("/defense-log/stats"),
      ]);
      setRecentEvents(logRes.data.logs?.slice(0, 5) || []);
      setStats(statsRes.data.stats || []);
    } catch {}
  };

  const totalBlocked = stats?.reduce((sum, s) => sum + s.count, 0) || 0;
  const totalDefended = stats?.reduce((sum, s) => sum + (s.blocked_count || 0), 0) || 0;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="page-title">
              <span>DEFENSE</span> COMMAND CENTER
            </div>
            <div className="page-subtitle">
              OPERATOR: {user?.username?.toUpperCase()} — CURRENT ROLE: {user?.role?.toUpperCase()}
            </div>
          </div>
          <button className="btn btn-outline" onClick={fetchStats} style={{ fontSize: "12px" }}>
            ⟳ REFRESH
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-value">{totalBlocked}</div>
          <div className="stat-label">TOTAL EVENTS</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--green)" }}>{totalDefended}</div>
          <div className="stat-label">ATTACKS BLOCKED</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--cyan)" }}>
            {totalBlocked > 0 ? Math.round((totalDefended / totalBlocked) * 100) : 100}%
          </div>
          <div className="stat-label">DEFENSE RATE</div>
        </div>
      </div>

      {/* Defense modules */}
      <div style={{ marginBottom: 28 }}>
        <div className="page-title" style={{ fontSize: 16, marginBottom: 16 }}>
          <span>DEFENSE</span> MODULES
        </div>
        <div className="grid-2">
          {DEFENSE_CARDS.map((card) => (
            <div
              key={card.id}
              className="card"
              onClick={() => navigate(card.path)}
              style={{ cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(34,102,255,0.4)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.transform = "";
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{
                  fontSize: 28,
                  color: card.color,
                  textShadow: `0 0 16px ${card.color}44`,
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  {card.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div className="card-title" style={{ margin: 0, fontSize: 15 }}>{card.title}</div>
                    <span style={{
                      background: "rgba(0,255,136,0.1)",
                      color: "#00ff88",
                      border: "1px solid rgba(0,255,136,0.2)",
                      fontFamily: "var(--mono)",
                      fontSize: 9,
                      padding: "2px 7px",
                      borderRadius: 3,
                      letterSpacing: 1,
                    }}>
                      {card.type}
                    </span>
                  </div>
                  <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 12 }}>
                    {card.desc}
                  </p>
                  <div className="cve-tag" style={{ marginTop: 0 }}>🛡️ {card.fix}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent defense events */}
      {recentEvents.length > 0 && (
        <div className="card">
          <div className="card-title">⊜ RECENT DEFENSE EVENTS</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>TYPE</th>
                <th>THREAT</th>
                <th>USER</th>
                <th>TARGET</th>
                <th>STATUS</th>
                <th>TIME</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((log) => (
                <tr key={log.id}>
                  <td style={{ color: "var(--blue)", fontWeight: 600 }}>{log.defense_type}</td>
                  <td>{log.threat_blocked || "—"}</td>
                  <td>{log.user}</td>
                  <td>{log.target || "—"}</td>
                  <td>
                    <span className={`badge ${log.blocked ? "badge-blocked" : "badge-user"}`}>
                      {log.blocked ? "BLOCKED" : "ALLOWED"}
                    </span>
                  </td>
                  <td>{new Date(log.timestamp).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
