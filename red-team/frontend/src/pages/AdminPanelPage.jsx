import { useState } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function AdminPanelPage() {
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [promoteForm, setPromoteForm] = useState({ userId: "", newRole: "admin" });
  const [allUsers, setAllUsers] = useState([]);

  const executeAttack = async (action) => {
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
        case "promote":
          res = await api.post(`/admin/users/${promoteForm.userId}/promote`, {
            newRole: promoteForm.newRole,
          });
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

  const deleteUser = async (userId, username) => {
    if (!window.confirm(`Delete user ${username}? (ID: ${userId})`)) return;
    setLoading(true);
    try {
      const res = await api.delete(`/admin/users/${userId}`);
      setResult({ success: true, data: res.data });
      setAllUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      setResult({ success: false, data: err.response?.data });
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === "admin";
  const isEscalated = isAdmin && user?.username !== "admin";

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title"><span>ADMIN</span> PANEL ESCALATION</div>
        <div className="page-subtitle">VERTICAL PRIVILEGE ESCALATION — FORCED BROWSING + JWT ABUSE</div>
        <div className="cve-tag">⊛ OWASP API5:2023 — Broken Function Level Authorization</div>
      </div>

      {!isAdmin && (
        <div className="attack-warning" style={{ marginBottom: 20 }}>
          ⚠ YOUR CURRENT ROLE: {user?.role?.toUpperCase()} — Admin endpoints will be blocked.{"\n"}
          STEP 1: Go to JWT Tampering page and forge an admin token, then apply it.{"\n"}
          STEP 2: Return here — admin actions will now succeed.
        </div>
      )}

      {isAdmin && (
        <div className="attack-success" style={{ marginBottom: 20 }}>
          ⊛ ADMIN ROLE ACTIVE — {isEscalated ? "ESCALATED via JWT Forgery" : "Logged in as admin"} — All admin endpoints accessible
        </div>
      )}

      <div className="grid-2">
        {/* Actions */}
        <div>
          <div className="card">
            <div className="card-title">⊛ ADMIN ATTACK ACTIONS</div>

            <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
              {[
                { action: "dashboard", label: "Access Admin Dashboard", desc: "Full system overview + all user PII" },
                { action: "users", label: "Dump All Users", desc: "Complete user table including hashed passwords" },
                { action: "secret", label: "Exfiltrate Secret Config", desc: "API keys, DB passwords, internal endpoints" },
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
                      className="btn btn-red"
                      onClick={() => executeAttack(action)}
                      disabled={loading}
                      style={{ fontSize: 11, padding: "5px 12px" }}
                    >
                      EXECUTE
                    </button>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>{desc}</div>
                </div>
              ))}
            </div>

            {/* Promote user */}
            <div style={{
              background: "var(--bg-3)",
              border: "1px solid var(--border-dim)",
              borderRadius: 8,
              padding: 14,
              marginBottom: 10,
            }}>
              <div style={{ fontFamily: "var(--display)", fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
                Escalate User Role
              </div>
              <div className="grid-2" style={{ gap: 8, marginBottom: 10 }}>
                <div>
                  <label className="form-label">TARGET USER ID</label>
                  <input
                    className="form-input"
                    type="number"
                    value={promoteForm.userId}
                    onChange={(e) => setPromoteForm({ ...promoteForm, userId: e.target.value })}
                    placeholder="User ID (1-4)"
                  />
                </div>
                <div>
                  <label className="form-label">PROMOTE TO</label>
                  <select
                    className="form-select"
                    value={promoteForm.newRole}
                    onChange={(e) => setPromoteForm({ ...promoteForm, newRole: e.target.value })}
                  >
                    <option value="moderator">moderator</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
              </div>
              <button
                className="btn btn-red"
                onClick={() => executeAttack("promote")}
                disabled={loading || !promoteForm.userId}
                style={{ width: "100%", fontSize: 12 }}
              >
                ⊛ ESCALATE ROLE
              </button>
            </div>
          </div>
        </div>

        {/* Response */}
        <div>
          <div className="card">
            <div className="card-title">◈ RESPONSE</div>

            {!result && <div className="loading">SELECT AN ATTACK ACTION...</div>}

            {result?.success && (
              <div className="attack-success" style={{ marginBottom: 12 }}>
                ⊛ ADMIN ACCESS SUCCESSFUL — {activeAction?.toUpperCase()}
              </div>
            )}
            {result && !result.success && (
              <div className="attack-warning" style={{ marginBottom: 12 }}>
                ✗ ACCESS DENIED — {result.data?.error || "Insufficient privileges"}{"\n"}
                Apply an admin JWT token first (JWT Tampering page)
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

      {/* User table if loaded */}
      {allUsers.length > 0 && (
        <div className="card">
          <div className="card-title">◈ EXFILTRATED USER DATABASE ({allUsers.length} records)</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>USERNAME</th>
                  <th>EMAIL</th>
                  <th>ROLE</th>
                  <th>BALANCE</th>
                  <th>SSN 🔥</th>
                  <th>CREDIT CARD 🔥</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => (
                  <tr key={u.id}>
                    <td style={{ color: "var(--red)" }}>{u.id}</td>
                    <td style={{ color: "var(--text)" }}>{u.username}</td>
                    <td>{u.email}</td>
                    <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                    <td style={{ color: "var(--green)" }}>${u.balance}</td>
                    <td style={{ color: "var(--red)", fontWeight: 600 }}>{u.ssn}</td>
                    <td style={{ color: "var(--red)", fontWeight: 600 }}>{u.credit_card}</td>
                    <td>
                      {u.id !== user?.id && (
                        <button
                          onClick={() => deleteUser(u.id, u.username)}
                          style={{
                            background: "none",
                            border: "1px solid rgba(255,34,68,0.3)",
                            color: "var(--red)",
                            padding: "3px 8px",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontFamily: "var(--mono)",
                            fontSize: 10,
                          }}
                        >
                          DELETE
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attack chain */}
      <div className="card">
        <div className="card-title">◈ FULL ATTACK CHAIN — HOW TO ESCALATE</div>
        <div className="attack-info">
          {`STEP 1: Login as 'alice' (regular user, ID: 1)\n`}
          {`STEP 2: Go to JWT Tampering → forge token with role:"admin"\n`}
          {`STEP 3: Click "Apply Token" — your session now has admin role\n`}
          {`STEP 4: Return here → execute "Access Admin Dashboard" — FULL ACCESS\n`}
          {`STEP 5: Use "Escalate Role" to promote alice permanently in the DB\n`}
          {`STEP 6: Use "Dump All Users" to exfiltrate SSN + credit cards of all 4 users\n\n`}
          {`VULNERABILITY: Admin check only verifies JWT role, not DB role. A forged token\n`}
          {`bypasses all admin protections because the server trusts the token payload.`}
        </div>
      </div>
    </div>
  );
}
