import { useState, useEffect } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function IDORPage() {
  const { user } = useAuth();
  const [targetId, setTargetId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("profile"); // profile | balance | update

  // IDOR: Read profile
  const fetchProfile = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("http://localhost:4000/agent/fire", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: "idor_profile" })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed");
      // Display the raw red team data from the battle event
      setResult({ success: true, data: data.event?.red?.bodyPreview ? JSON.parse(data.event.red.bodyPreview) : {} });
    } catch (err) {
      setResult({ success: false, data: { error: err.message } });
    } finally {
      setLoading(false);
    }
  };

  // IDOR: Read balance (Actually we can use the same scenario or just standard API)
  // To keep it simple, we'll leave fetchBalance as a direct API call unless we have a balance scenario.
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

  // IDOR: Update another user's profile
  const [updateFields, setUpdateFields] = useState({ email: "", profile_data: "" });
  const updateProfile = async () => {
    setLoading(true);
    setResult(null);
    try {
      // Trigger mass_assign_role for update tests to show the popup!
      const res = await fetch("http://localhost:4000/agent/fire", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: "mass_assign_role" })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed");
      setResult({ success: true, data: data.event?.red?.bodyPreview ? JSON.parse(data.event.red.bodyPreview) : {} });
    } catch (err) {
      setResult({ success: false, data: { error: err.message } });
    } finally {
      setLoading(false);
    }
  };

  // ─── Live IDOR Attempts from Agent ───
  const [liveAttempts, setLiveAttempts] = useState([]);
  const [liveLoading, setLiveLoading] = useState(true);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch("http://localhost:4000/agent/history?category=IDOR&limit=5");
        const data = await res.json();
        setLiveAttempts(data.events || []);
      } catch {} finally { setLiveLoading(false); }
    };
    fetchLive();
    const timer = setInterval(fetchLive, 30000);
    return () => clearInterval(timer);
  }, []);

  const isOwnId = parseInt(targetId) === user?.id;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title"><span>IDOR</span> ATTACK MODULE</div>
        <div className="page-subtitle">INSECURE DIRECT OBJECT REFERENCE — HORIZONTAL PRIVILEGE ESCALATION</div>
        <div className="cve-tag">⊕ OWASP API1:2023 — Broken Object Level Authorization</div>
      </div>

      {/* Explanation */}
      <div className="attack-info">
        HOW IT WORKS: The server fetches user data using the ID from the URL (/api/users/:id) without verifying
        that the requesting user owns that resource. By changing the ID, you access any user's profile, SSN,
        credit card data, and financial information.{"\n\n"}
        YOUR USER ID: {user?.id} — Try accessing IDs 1, 2, 3, 4 to hit different users.
      </div>

      <div className="grid-2">
        {/* Left: Controls */}
        <div>
          <div className="card">
            <div className="card-title">⊕ ATTACK CONFIGURATION</div>

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
                  color: isOwnId ? "var(--text-faint)" : "var(--red)",
                }}>
                  {isOwnId ? "↳ Accessing your own data" : `⚠ Targeting another user's data`}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["profile", "balance", "update"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`btn ${activeTab === tab ? "btn-red" : "btn-outline"}`}
                  style={{ fontSize: 11, padding: "6px 14px" }}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {activeTab === "profile" && (
              <>
                <div className="attack-warning">
                  ATTACK: GET /api/users/{targetId || ":id"}{"\n"}
                  Returns: username, email, role, SSN, credit card, balance — NO ownership check
                </div>
                <button
                  className="btn btn-red"
                  onClick={fetchProfile}
                  disabled={!targetId || loading}
                  style={{ width: "100%" }}
                >
                  {loading ? "FETCHING..." : "⊕ EXECUTE IDOR READ"}
                </button>
              </>
            )}

            {activeTab === "balance" && (
              <>
                <div className="attack-warning">
                  ATTACK: GET /api/users/{targetId || ":id"}/balance{"\n"}
                  Returns: another user's financial balance — NO ownership check
                </div>
                <button
                  className="btn btn-red"
                  onClick={fetchBalance}
                  disabled={!targetId || loading}
                  style={{ width: "100%" }}
                >
                  {loading ? "FETCHING..." : "⊕ STEAL FINANCIAL DATA"}
                </button>
              </>
            )}

            {activeTab === "update" && (
              <>
                <div className="attack-warning">
                  ATTACK: PUT /api/users/{targetId || ":id"}{"\n"}
                  Modifies another user's profile data — NO ownership check
                </div>
                <div className="form-group">
                  <label className="form-label">NEW EMAIL (optional)</label>
                  <input
                    className="form-input"
                    value={updateFields.email}
                    onChange={(e) => setUpdateFields({ ...updateFields, email: e.target.value })}
                    placeholder="hacker@evil.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">NEW BIO (optional)</label>
                  <input
                    className="form-input"
                    value={updateFields.profile_data}
                    onChange={(e) => setUpdateFields({ ...updateFields, profile_data: e.target.value })}
                    placeholder="Account compromised"
                  />
                </div>
                <button
                  className="btn btn-red"
                  onClick={updateProfile}
                  disabled={!targetId || loading}
                  style={{ width: "100%" }}
                >
                  {loading ? "UPDATING..." : "⊕ EXECUTE IDOR UPDATE"}
                </button>
              </>
            )}
          </div>

          {/* User ID reference card */}
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
                    <td style={{ color: "var(--red)" }}>{u.id}</td>
                    <td>{u.username}</td>
                    <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>
              ↑ Click any row to set as target
            </div>
          </div>
        </div>

        {/* Right: Response */}
        <div>
          <div className="card" style={{ height: "100%" }}>
            <div className="card-title">◈ SERVER RESPONSE</div>

            {!result && (
              <div className="loading">AWAITING ATTACK EXECUTION...</div>
            )}

            {result && (
              <>
                {result.success && result.data?.idor_detected && (
                  <div className="attack-success">
                    ⊕ IDOR ATTACK SUCCESSFUL — Unauthorized data accessed
                  </div>
                )}

                {result.data?.user && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="form-label" style={{ marginBottom: 10 }}>EXFILTRATED DATA</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {[
                        { label: "USERNAME", value: result.data.user.username },
                        { label: "EMAIL", value: result.data.user.email },
                        { label: "ROLE", value: result.data.user.role },
                        { label: "BALANCE", value: result.data.user.balance ? `$${result.data.user.balance}` : null },
                        { label: "SSN 🔥", value: result.data.user.ssn },
                        { label: "CREDIT CARD 🔥", value: result.data.user.credit_card },
                      ].filter(f => f.value).map(({ label, value }) => (
                        <div key={label} style={{
                          display: "flex",
                          justifyContent: "space-between",
                          background: "var(--bg-3)",
                          padding: "8px 12px",
                          borderRadius: 6,
                          border: "1px solid var(--border-dim)",
                        }}>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>{label}</span>
                          <span style={{
                            fontFamily: "var(--mono)",
                            fontSize: 12,
                            color: label.includes("🔥") ? "var(--red)" : "var(--text)",
                          }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-label" style={{ marginBottom: 8 }}>RAW RESPONSE</div>
                <div className={`response-box ${result.success ? "success" : "error-box"}`}>
                  {JSON.stringify(result.data, null, 2)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Vulnerable code snippet */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="card-title">◈ VULNERABLE CODE — WHY THIS WORKS</div>
        <div className="response-box" style={{ maxHeight: 160 }}>
{`// routes/users.js — Missing ownership check (line ~45)
router.get('/:id', verifyToken, (req, res) => {
  const targetId = req.params.id;
  // ❌ VULNERABILITY: No check that req.user.id === targetId
  // ✅ FIX: if (req.user.id !== parseInt(targetId) && req.user.role !== 'admin') {
  //           return res.status(403).json({ error: 'Access denied' });
  //         }
  db.get('SELECT * FROM users WHERE id = ?', [targetId], (err, user) => {
    res.json({ user }); // Returns SSN, credit card, everything
  });
});`}
        </div>
      </div>

      {/* ═══ LIVE IDOR ATTEMPTS FROM AGENT ═══ */}
      <div className="card">
        <div className="card-title">
          ⊕ LIVE IDOR ATTEMPTS
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)", fontWeight: 400 }}>AUTO-REFRESHES EVERY 30s</span>
        </div>
        {liveLoading ? (
          <div className="loading">Loading live IDOR data...</div>
        ) : liveAttempts.length === 0 ? (
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)", padding: 16, textAlign: "center" }}>No IDOR attempts recorded yet</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {liveAttempts.map((ev) => (
              <div key={ev.id} style={{ background: "var(--bg-3)", border: "1px solid var(--border-dim)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontFamily: "var(--display)", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{ev.name}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span className="badge" style={{ background: ev.red?.success ? "var(--red-faint)" : "rgba(0,255,136,0.06)", color: ev.red?.success ? "var(--red)" : "var(--green)", fontSize: 10 }}>RED {ev.red?.status}</span>
                    <span className="badge" style={{ background: ev.blue?.success ? "var(--red-faint)" : "rgba(0,255,136,0.06)", color: ev.blue?.success ? "var(--red)" : "var(--green)", fontSize: 10 }}>BLUE {ev.blue?.status}</span>
                  </div>
                </div>
                {ev.narration && typeof ev.narration === "object" && (
                  <div style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>{ev.narration.summary}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
