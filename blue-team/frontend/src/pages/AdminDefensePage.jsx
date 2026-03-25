import { useState } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function AdminDefensePage() {
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  const executeTest = async (action) => {
    setLoading(true);
    setActiveAction(action);
    setResult(null);
    try {
      let res;
      switch (action) {
        case "dashboard":
          res = await api.get("/admin/dashboard");
          if (res.data.allUsers) setAllUsers(res.data.allUsers);
          break;
        case "users":
          res = await api.get("/admin/users");
          if (res.data.users) setAllUsers(res.data.users);
          break;
        case "secret":
          res = await api.get("/admin/secret");
          break;
        default:
          break;
      }
      setResult({ success: true, data: res.data });
    } catch (err) {
      setResult({ success: false, data: err.response?.data });
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === "admin";

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title"><span>ADMIN</span> ACCESS DEFENSE</div>
        <div className="page-subtitle">DB-VERIFIED AUTHORIZATION — PREVENTS VERTICAL ESCALATION</div>
        <div className="cve-tag">🛡️ OWASP API5:2023 — Function Level Authorization Enforced</div>
      </div>

      <div className="defense-info">
        HOW IT'S PROTECTED:{"\n"}
        1. Admin role verified from DATABASE on every request (not JWT token){"\n"}
        2. No /admin/secret endpoint — forced browsing target removed{"\n"}
        3. Admin user listing excludes sensitive PII (SSN, credit cards){"\n"}
        4. All admin actions logged in audit trail{"\n\n"}
        {isAdmin
          ? "YOUR ROLE: ADMIN — You have legitimate admin access verified from DB"
          : "YOUR ROLE: " + user?.role?.toUpperCase() + " — Admin endpoints will BLOCK your requests"}
      </div>

      {!isAdmin && (
        <div className="defense-blocked" style={{ marginBottom: 20 }}>
          🛡️ YOUR CURRENT ROLE: {user?.role?.toUpperCase()} — Admin endpoints are protected by DB-verified role checks.{"\n"}
          Unlike the red team, forging a JWT token won't help — there's no forge endpoint and roles come from the database.
        </div>
      )}

      {isAdmin && (
        <div className="defense-success" style={{ marginBottom: 20 }}>
          ✓ ADMIN ROLE VERIFIED FROM DATABASE — Legitimate admin access granted
        </div>
      )}

      <div className="grid-2">
        <div>
          <div className="card">
            <div className="card-title">🛡️ TEST ADMIN DEFENSES</div>

            <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
              {[
                { action: "dashboard", label: "Access Admin Dashboard", desc: "DB-verified admin check — no PII exposed" },
                { action: "users", label: "List All Users", desc: "Safe fields only — SSN/credit cards excluded" },
                { action: "secret", label: "Access Secret Config", desc: "Endpoint REMOVED — returns 404" },
              ].map(({ action, label, desc }) => (
                <div key={action} style={{
                  background: "var(--bg-3)",
                  border: `1px solid ${activeAction === action && result?.success ? "var(--border)" : "var(--border-dim)"}`,
                  borderRadius: 8,
                  padding: 14,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontFamily: "var(--display)", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                      {label}
                    </div>
                    <button
                      className="btn btn-blue"
                      onClick={() => executeTest(action)}
                      disabled={loading}
                      style={{ fontSize: 11, padding: "5px 12px" }}
                    >
                      TEST
                    </button>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-title">◈ RESPONSE</div>

            {!result && <div className="loading">SELECT A TEST...</div>}

            {result?.success && (
              <div className="defense-success" style={{ marginBottom: 12 }}>
                ✓ AUTHORIZED — {activeAction?.toUpperCase()} (admin role verified from DB)
              </div>
            )}
            {result && !result.success && (
              <div className="defense-success" style={{ marginBottom: 12 }}>
                🛡️ ACCESS BLOCKED — {result.data?.error || "Insufficient privileges"}{"\n"}
                Role verified from database, not JWT token
              </div>
            )}

            {result && (
              <div className={`response-box ${result.success ? "success" : "error-box"}`}>
                {JSON.stringify(result.data, null, 2)}
              </div>
            )}
          </div>
        </div>
      </div>

      {allUsers.length > 0 && (
        <div className="card">
          <div className="card-title">◈ USER DATA ({allUsers.length} records) — NO SENSITIVE PII</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>USERNAME</th>
                  <th>EMAIL</th>
                  <th>ROLE</th>
                  <th>BALANCE</th>
                  <th>SSN</th>
                  <th>CREDIT CARD</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => (
                  <tr key={u.id}>
                    <td style={{ color: "var(--blue)" }}>{u.id}</td>
                    <td style={{ color: "var(--text)" }}>{u.username}</td>
                    <td>{u.email}</td>
                    <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                    <td style={{ color: "var(--green)" }}>${u.balance}</td>
                    <td style={{ color: "var(--text-faint)" }}>{u.ssn || "🛡️ Hidden"}</td>
                    <td style={{ color: "var(--text-faint)" }}>{u.credit_card || "🛡️ Hidden"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">◈ SECURE CODE — HOW THE FIX WORKS</div>
        <div className="response-box" style={{ maxHeight: 180 }}>
{`// middleware/auth.js — FIXED: Role from DB, not token
function verifyToken(req, res, next) {
  const decoded = jwt.verify(token, STRONG_SECRET, { algorithms: ['HS256'] });

  // ✅ FIX: Fetch role from database
  db.get('SELECT role FROM users WHERE id = ?', [decoded.id], (err, user) => {
    req.user.role = user.role;  // DB role, not token role
    next();
  });
}

// ✅ FIX: No /admin/secret endpoint — forced browsing target removed
// ✅ FIX: User listing excludes SSN, credit_card, password hash`}
        </div>
      </div>
    </div>
  );
}
