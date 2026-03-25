import { useState } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function MassAssignDefensePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("register");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const [regForm, setRegForm] = useState({
    username: "",
    email: "",
    password: "hacker123",
    role: "admin",
    balance: "99999",
  });

  const [updateForm, setUpdateForm] = useState({
    targetId: "",
    role: "admin",
    balance: "",
  });

  const registerMassAssign = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post("/auth/register", regForm);
      setResult({ success: true, data: res.data });
    } catch (err) {
      setResult({ success: false, data: err.response?.data });
    } finally {
      setLoading(false);
    }
  };

  const updateMassAssign = async () => {
    setLoading(true);
    setResult(null);
    try {
      const payload = {};
      if (updateForm.role) payload.role = updateForm.role;
      if (updateForm.balance) payload.balance = parseFloat(updateForm.balance);
      const res = await api.put(`/users/${updateForm.targetId || user?.id}`, payload);
      setResult({ success: true, data: res.data });
    } catch (err) {
      setResult({ success: false, data: err.response?.data });
    } finally {
      setLoading(false);
    }
  };

  const randomUsername = () => {
    const names = ["defender", "shield", "guardian", "sentinel", "warden"];
    return names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 9999);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title"><span>MASS ASSIGNMENT</span> DEFENSE</div>
        <div className="page-subtitle">FIELD WHITELIST — BLOCKS UNAUTHORIZED PROPERTY INJECTION</div>
        <div className="cve-tag">🛡️ OWASP API3:2023 — Object Property Level Authorization Enforced</div>
      </div>

      <div className="defense-info">
        HOW IT'S PROTECTED: The registration endpoint uses a field whitelist — only username, email, and
        password are extracted from the request body. Any attempt to set role, balance, or other privileged
        fields is IGNORED. The update endpoint similarly only allows email and profile_data modifications.{"\n\n"}
        DEFENSE: Even if you send role:"admin" in the request body, the server hardcodes role to "user".
      </div>

      <div className="grid-2">
        <div>
          <div className="card">
            <div className="card-title">🛡️ TEST DEFENSE</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["register", "update"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setResult(null); }}
                  className={`btn ${activeTab === tab ? "btn-blue" : "btn-outline"}`}
                  style={{ fontSize: 11, padding: "7px 16px" }}
                >
                  {tab === "register" ? "🛡️ REGISTER WITH INJECTION" : "🛡️ UPDATE WITH INJECTION"}
                </button>
              ))}
            </div>

            {activeTab === "register" && (
              <>
                <div className="defense-blocked">
                  TEST: POST /api/auth/register with role:"{regForm.role}", balance:{regForm.balance}{"\n"}
                  DEFENSE: Server IGNORES role and balance — always sets role:"user", balance:1000
                </div>

                <div className="form-group">
                  <label className="form-label">USERNAME</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="form-input"
                      value={regForm.username}
                      onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                      placeholder="test_username"
                    />
                    <button
                      className="btn btn-outline"
                      onClick={() => setRegForm({ ...regForm, username: randomUsername() })}
                      style={{ fontSize: 11, whiteSpace: "nowrap" }}
                    >
                      RANDOM
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">EMAIL</label>
                  <input
                    className="form-input"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    placeholder={`${regForm.username || "test"}@example.com`}
                  />
                </div>

                <div className="grid-2" style={{ gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: "var(--blue)" }}>
                      ROLE (WILL BE IGNORED 🛡️)
                    </label>
                    <select
                      className="form-select"
                      value={regForm.role}
                      onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}
                    >
                      <option value="user">user</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: "var(--blue)" }}>
                      BALANCE (WILL BE IGNORED 🛡️)
                    </label>
                    <input
                      className="form-input"
                      type="number"
                      value={regForm.balance}
                      onChange={(e) => setRegForm({ ...regForm, balance: e.target.value })}
                      placeholder="99999"
                    />
                  </div>
                </div>

                <button
                  className="btn btn-blue"
                  onClick={registerMassAssign}
                  disabled={loading || !regForm.username}
                  style={{ width: "100%" }}
                >
                  {loading ? "TESTING..." : "🛡️ TEST REGISTRATION DEFENSE"}
                </button>
              </>
            )}

            {activeTab === "update" && (
              <>
                <div className="defense-blocked">
                  TEST: PUT /api/users/{updateForm.targetId || user?.id} with role/balance fields{"\n"}
                  DEFENSE: Only email and profile_data are accepted — role/balance IGNORED
                </div>

                <div className="form-group">
                  <label className="form-label">TARGET USER ID</label>
                  <input
                    className="form-input"
                    type="number"
                    value={updateForm.targetId}
                    onChange={(e) => setUpdateForm({ ...updateForm, targetId: e.target.value })}
                    placeholder={`Your ID: ${user?.id}`}
                  />
                </div>

                <div className="grid-2" style={{ gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: "var(--blue)" }}>ROLE (WILL BE IGNORED 🛡️)</label>
                    <select
                      className="form-select"
                      value={updateForm.role}
                      onChange={(e) => setUpdateForm({ ...updateForm, role: e.target.value })}
                    >
                      <option value="">— no change —</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: "var(--blue)" }}>BALANCE (WILL BE IGNORED 🛡️)</label>
                    <input
                      className="form-input"
                      type="number"
                      value={updateForm.balance}
                      onChange={(e) => setUpdateForm({ ...updateForm, balance: e.target.value })}
                      placeholder="e.g. 999999"
                    />
                  </div>
                </div>

                <button
                  className="btn btn-blue"
                  onClick={updateMassAssign}
                  disabled={loading}
                  style={{ width: "100%" }}
                >
                  {loading ? "TESTING..." : "🛡️ TEST UPDATE DEFENSE"}
                </button>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="card" style={{ height: "100%" }}>
            <div className="card-title">◈ SERVER RESPONSE</div>

            {!result && <div className="loading">AWAITING DEFENSE TEST...</div>}

            {result?.success && result.data?.defense && (
              <div className="defense-success">
                🛡️ {result.data.defense}
              </div>
            )}

            {result?.success && result.data?.user && (
              <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "USERNAME", value: result.data.user.username },
                  { label: "ACTUAL ROLE ASSIGNED", value: result.data.user.role },
                  { label: "USER ID", value: result.data.user.id },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    background: label.includes("ROLE") ? "rgba(0,255,136,0.05)" : "var(--bg-3)",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: `1px solid ${label.includes("ROLE") ? "rgba(0,255,136,0.15)" : "var(--border-dim)"}`,
                  }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>{label}</span>
                    <span style={{
                      fontFamily: "var(--mono)",
                      fontSize: 13,
                      color: label.includes("ROLE") ? "var(--green)" : "var(--text)",
                      fontWeight: label.includes("ROLE") ? 700 : 400,
                    }}>{String(value)}</span>
                  </div>
                ))}
              </div>
            )}

            {result && !result.success && (
              <div className="defense-warning" style={{ marginBottom: 12 }}>
                {result.data?.defense || result.data?.error || "Request failed"}
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

      <div className="card">
        <div className="card-title">◈ SECURE CODE — HOW THE FIX WORKS</div>
        <div className="response-box" style={{ maxHeight: 160 }}>
{`// routes/auth.js — FIXED: Field whitelist
router.post('/register', (req, res) => {
  // ✅ FIX: Only extract SAFE fields — role/balance IGNORED
  const { username, email, password } = req.body;

  const userRole = 'user';     // ✅ Always default, NEVER from request
  const userBalance = 1000.0;  // ✅ Always default, NEVER from request

  db.run('INSERT INTO users (role, balance) VALUES (?, ?)',
    [userRole, userBalance]  // Attacker input has no effect
  );
});`}
        </div>
      </div>
    </div>
  );
}
