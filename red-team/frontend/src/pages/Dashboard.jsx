import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const ATTACK_CARDS = [
  {
    id: "idor",
    path: "/idor",
    icon: "⊕",
    title: "IDOR Attack",
    type: "HORIZONTAL",
    cve: "OWASP API1:2023",
    desc: "Access any user's profile, SSN, credit card, and financial data by manipulating the user ID parameter.",
    color: "#ff2244",
  },
  {
    id: "jwt",
    path: "/jwt-forge",
    icon: "⊗",
    title: "JWT Role Tampering",
    type: "VERTICAL",
    cve: "CVE-2022-21449",
    desc: "Forge a JWT token with an elevated role (admin) to gain unauthorized access to restricted endpoints.",
    color: "#ff6600",
  },
  {
    id: "mass",
    path: "/mass-assign",
    icon: "⊘",
    title: "Mass Assignment",
    type: "VERTICAL",
    cve: "OWASP API3:2023",
    desc: "Register or update accounts with hidden fields like role:admin or balance:99999 accepted by the server.",
    color: "#cc00ff",
  },
  {
    id: "admin",
    path: "/admin",
    icon: "⊛",
    title: "Admin Panel Escalation",
    type: "VERTICAL",
    cve: "OWASP API5:2023",
    desc: "Combine JWT forgery with forced browsing to access admin endpoints and perform destructive actions.",
    color: "#ff2244",
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentAttacks, setRecentAttacks] = useState([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [logRes, statsRes] = await Promise.all([
        api.get("/attack-log?limit=5"),
        api.get("/attack-log/stats"),
      ]);
      setRecentAttacks(logRes.data.logs?.slice(0, 5) || []);
      setStats(statsRes.data.stats || []);
    } catch {}
  };

  const totalAttacks = stats?.reduce((sum, s) => sum + s.count, 0) || 0;
  const successAttacks = stats?.reduce((sum, s) => sum + s.successes, 0) || 0;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="page-title">
              <span>ATTACK</span> COMMAND CENTER
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
          <div className="stat-value">{totalAttacks}</div>
          <div className="stat-label">TOTAL ATTACKS</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--green)" }}>{successAttacks}</div>
          <div className="stat-label">SUCCESSFUL</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--amber)" }}>
            {totalAttacks > 0 ? Math.round((successAttacks / totalAttacks) * 100) : 0}%
          </div>
          <div className="stat-label">SUCCESS RATE</div>
        </div>
      </div>

      {/* Attack vectors */}
      <div style={{ marginBottom: 28 }}>
        <div className="page-title" style={{ fontSize: 16, marginBottom: 16 }}>
          SELECT <span>ATTACK VECTOR</span>
        </div>
        <div className="grid-2">
          {ATTACK_CARDS.map((card) => (
            <div
              key={card.id}
              className="card"
              onClick={() => navigate(card.path)}
              style={{ cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,34,68,0.4)";
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
                      background: card.type === "HORIZONTAL" ? "rgba(0,200,255,0.1)" : "rgba(255,34,68,0.1)",
                      color: card.type === "HORIZONTAL" ? "#00ccff" : "#ff2244",
                      border: `1px solid ${card.type === "HORIZONTAL" ? "rgba(0,200,255,0.2)" : "rgba(255,34,68,0.2)"}`,
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
                  <div className="cve-tag" style={{ marginTop: 0 }}>{card.cve}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent attacks */}
      {recentAttacks.length > 0 && (
        <div className="card">
          <div className="card-title">⊜ RECENT ATTACK LOG</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>TYPE</th>
                <th>CVE</th>
                <th>ATTACKER</th>
                <th>TARGET</th>
                <th>STATUS</th>
                <th>TIME</th>
              </tr>
            </thead>
            <tbody>
              {recentAttacks.map((log) => (
                <tr key={log.id}>
                  <td style={{ color: "var(--red)", fontWeight: 600 }}>{log.attack_type}</td>
                  <td>{log.cve_id || "—"}</td>
                  <td>{log.attacker_user}</td>
                  <td>{log.target_user || "—"}</td>
                  <td>
                    <span className={`badge ${log.success ? "badge-admin" : "badge-user"}`}>
                      {log.success ? "SUCCESS" : "FAILED"}
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
