import { useState } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function IDORDefensePage() {
  const { user } = useAuth();
  const [targetId, setTargetId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  const [updateFields, setUpdateFields] = useState({ email: "", profile_data: "" });

  const fetchProfile = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.get(`/users/${targetId}`);
      setResult({ success: true, data: res.data });
    } catch (err) {
      setResult({ success: false, data: err.response?.data });
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.get(`/users/${targetId}/balance`);
      setResult({ success: true, data: res.data });
    } catch (err) {
      setResult({ success: false, data: err.response?.data });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    setLoading(true);
    setResult(null);
    try {
      const payload = {};
      if (updateFields.email) payload.email = updateFields.email;
      if (updateFields.profile_data) payload.profile_data = { bio: updateFields.profile_data };
      const res = await api.put(`/users/${targetId}`, payload);
      setResult({ success: true, data: res.data });
    } catch (err) {
      setResult({ success: false, data: err.response?.data });
    } finally {
      setLoading(false);
    }
  };

  const isOwnId = parseInt(targetId) === user?.id;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title"><span>IDOR</span> DEFENSE MODULE</div>
        <div className="page-subtitle">OWNERSHIP VERIFICATION — PREVENTS HORIZONTAL PRIVILEGE ESCALATION</div>
        <div className="cve-tag">🛡️ OWASP API1:2023 — Object Level Authorization Enforced</div>
      </div>

      <div className="defense-info">
        HOW IT'S PROTECTED: Every request to /api/users/:id checks that req.user.id === targetId.
        If the requesting user doesn't own the resource and isn't an admin, the request is REJECTED
        with a 403 status. Sensitive fields (SSN, credit_card) are NEVER returned to non-admin users.{"\n\n"}
        YOUR USER ID: {user?.id} — Try accessing other IDs (1-4) to see the defense in action.
      </div>

      <div className="grid-2">
        <div>
          <div className="card">
            <div className="card-title">🛡️ TEST DEFENSE</div>

            <div className="form-group">
              <label className="form-label">TARGET USER ID</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder={`Your ID is ${user?.id} — try others (1-4)`}
              />
              {targetId && (
                <div style={{
                  marginTop: 6,
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: isOwnId ? "var(--green)" : "var(--blue)",
                }}>
                  {isOwnId ? "✓ Accessing your own data — allowed" : `🛡️ Another user's data — will be BLOCKED`}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["profile", "balance", "update"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`btn ${activeTab === tab ? "btn-blue" : "btn-outline"}`}
                  style={{ fontSize: 11, padding: "6px 14px" }}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {activeTab === "profile" && (
              <>
                <div className="defense-blocked">
                  TEST: GET /api/users/{targetId || ":id"}{"\n"}
                  DEFENSE: Ownership check — only own profile or admin access allowed
                </div>
                <button
                  className="btn btn-blue"
                  onClick={fetchProfile}
                  disabled={!targetId || loading}
                  style={{ width: "100%" }}
                >
                  {loading ? "TESTING..." : "🛡️ TEST IDOR DEFENSE"}
                </button>
              </>
            )}

            {activeTab === "balance" && (
              <>
                <div className="defense-blocked">
                  TEST: GET /api/users/{targetId || ":id"}/balance{"\n"}
                  DEFENSE: Financial data restricted to own account only
                </div>
                <button
                  className="btn btn-blue"
                  onClick={fetchBalance}
                  disabled={!targetId || loading}
                  style={{ width: "100%" }}
                >
                  {loading ? "TESTING..." : "🛡️ TEST FINANCIAL IDOR DEFENSE"}
                </button>
              </>
            )}

            {activeTab === "update" && (
              <>
                <div className="defense-blocked">
                  TEST: PUT /api/users/{targetId || ":id"}{"\n"}
                  DEFENSE: Ownership check + field whitelist (only email, profile_data)
                </div>
                <div className="form-group">
                  <label className="form-label">NEW EMAIL (optional)</label>
                  <input
                    className="form-input"
                    value={updateFields.email}
                    onChange={(e) => setUpdateFields({ ...updateFields, email: e.target.value })}
                    placeholder="newemail@example.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">NEW BIO (optional)</label>
                  <input
                    className="form-input"
                    value={updateFields.profile_data}
                    onChange={(e) => setUpdateFields({ ...updateFields, profile_data: e.target.value })}
                    placeholder="Updated bio"
                  />
                </div>
                <button
                  className="btn btn-blue"
                  onClick={updateProfile}
                  disabled={!targetId || loading}
                  style={{ width: "100%" }}
                >
                  {loading ? "TESTING..." : "🛡️ TEST IDOR UPDATE DEFENSE"}
                </button>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title">◈ SEED USER REFERENCE</div>
            <table className="data-table">
              <thead>
                <tr><th>ID</th><th>USERNAME</th><th>ROLE</th></tr>
              </thead>
              <tbody>
                {[
                  { id: 1, username: "alice", role: "user" },
                  { id: 2, username: "bob", role: "user" },
                  { id: 3, username: "charlie", role: "moderator" },
                  { id: 4, username: "admin", role: "admin" },
                ].map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setTargetId(String(u.id))}
                    style={{ cursor: "pointer" }}
                    title="Click to target this user"
                  >
                    <td style={{ color: "var(--blue)" }}>{u.id}</td>
                    <td>{u.username}</td>
                    <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="card" style={{ height: "100%" }}>
            <div className="card-title">◈ SERVER RESPONSE</div>

            {!result && (
              <div className="loading">AWAITING DEFENSE TEST...</div>
            )}

            {result && !result.success && result.data?.defense && (
              <div className="defense-success">
                🛡️ ATTACK BLOCKED — {result.data.defense}
              </div>
            )}

            {result && result.success && (
              <div className="defense-success">
                ✓ Authorized access — your own data returned safely
              </div>
            )}

            {result && (
              <>
                <div className="form-label" style={{ marginBottom: 8 }}>RAW RESPONSE</div>
                <div className={`response-box ${result.success ? "success" : "error-box"}`}>
                  {JSON.stringify(result.data, null, 2)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <div className="card-title">◈ SECURE CODE — HOW THE FIX WORKS</div>
        <div className="response-box" style={{ maxHeight: 180 }}>
{`// routes/users.js — FIXED: Ownership check
router.get('/:id', verifyToken, (req, res) => {
  const targetId = parseInt(req.params.id);

  // ✅ FIX: Verify ownership — only own profile or admin
  if (targetId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  // ✅ FIX: Return only safe fields — SSN/credit_card hidden
  db.get('SELECT id, username, email, role, balance FROM users WHERE id = ?',
    [targetId], (err, user) => { res.json({ user }); }
  );
});`}
        </div>
      </div>
    </div>
  );
}
