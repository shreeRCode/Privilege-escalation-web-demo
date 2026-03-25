import { useState } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function JWTForgePage() {
  const { user, useForgedToken } = useAuth();
  const [targetRole, setTargetRole] = useState("admin");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tokenApplied, setTokenApplied] = useState(false);

  const currentToken = localStorage.getItem("red_token");
  const decodeToken = (token) => {
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch {
      return null;
    }
  };

  const currentPayload = currentToken ? decodeToken(currentToken) : null;

  const forgeToken = async () => {
    setLoading(true);
    setResult(null);
    setTokenApplied(false);
    try {
      const res = await api.post("/auth/forge-token", { targetRole });
      setResult({ success: true, data: res.data });
    } catch (err) {
      setResult({ success: false, data: err.response?.data });
    } finally {
      setLoading(false);
    }
  };

  const applyForgedToken = () => {
    if (result?.data?.forgedToken) {
      useForgedToken(result.data.forgedToken);
      setTokenApplied(true);
    }
  };

  const testAdminAccess = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/dashboard");
      setResult({ success: true, data: res.data, testedAdmin: true });
    } catch (err) {
      setResult({ success: false, data: err.response?.data, testedAdmin: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title"><span>JWT</span> ROLE TAMPERING</div>
        <div className="page-subtitle">VERTICAL PRIVILEGE ESCALATION VIA TOKEN FORGERY</div>
        <div className="cve-tag">⊗ CVE-2022-21449 — Broken Object Property Level Authorization</div>
      </div>

      <div className="attack-info">
        HOW IT WORKS: The server embeds the user's role inside the JWT payload and trusts it on every request
        without re-querying the database. By requesting a forged token with role:"admin", you gain full admin
        access. The vulnerability exists because the server uses the 'none' algorithm fallback and weak secrets.{"\n\n"}
        ATTACK CHAIN: Login as regular user → forge token with admin role → use forged token → access admin endpoints
      </div>

      <div className="grid-2">
        <div>
          {/* Current token visualizer */}
          <div className="card">
            <div className="card-title">◈ CURRENT JWT PAYLOAD</div>
            {currentPayload ? (
              <div style={{ display: "grid", gap: 8 }}>
                {Object.entries(currentPayload).map(([k, v]) => (
                  <div key={k} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    background: "var(--bg-3)",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: `1px solid ${k === "role" ? "var(--border)" : "var(--border-dim)"}`,
                  }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>
                      {k}
                    </span>
                    <span style={{
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      color: k === "role"
                        ? (v === "admin" ? "var(--red)" : v === "moderator" ? "var(--amber)" : "var(--text-dim)")
                        : "var(--text)",
                    }}>
                      {typeof v === "number" ? (k === "exp" || k === "iat" ? new Date(v * 1000).toLocaleString() : v) : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="loading">No token found</div>
            )}
          </div>

          {/* Forge controls */}
          <div className="card">
            <div className="card-title">⊗ FORGE NEW TOKEN</div>

            <div className="form-group">
              <label className="form-label">TARGET ROLE</label>
              <select
                className="form-select"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              >
                <option value="moderator">moderator</option>
                <option value="admin">admin</option>
              </select>
            </div>

            <div className="attack-warning">
              ENDPOINT: POST /api/auth/forge-token{"\n"}
              PAYLOAD: {"{ targetRole: \"" + targetRole + "\" }"}{"\n"}
              EFFECT: Returns JWT with role:{targetRole} but your real user ID
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn btn-red"
                onClick={forgeToken}
                disabled={loading || user?.role === targetRole}
                style={{ flex: 1 }}
              >
                {loading ? "FORGING..." : "⊗ FORGE TOKEN"}
              </button>

              {result?.data?.forgedToken && !tokenApplied && (
                <button
                  className="btn btn-outline"
                  onClick={applyForgedToken}
                  style={{ flex: 1 }}
                >
                  ▶ APPLY TOKEN
                </button>
              )}

              {tokenApplied && (
                <button
                  className="btn btn-outline"
                  onClick={testAdminAccess}
                  style={{ flex: 1, color: "var(--green)", borderColor: "var(--green)" }}
                >
                  ✓ TEST ACCESS
                </button>
              )}
            </div>

            {tokenApplied && (
              <div className="attack-success" style={{ marginTop: 14 }}>
                ⊗ FORGED TOKEN APPLIED — You are now presenting as role: {targetRole}
              </div>
            )}
          </div>
        </div>

        {/* Response */}
        <div>
          <div className="card" style={{ height: "100%" }}>
            <div className="card-title">◈ FORGE RESULT</div>

            {!result && <div className="loading">AWAITING TOKEN FORGE...</div>}

            {result?.success && !result.testedAdmin && (
              <>
                <div className="attack-success">
                  ⊗ TOKEN FORGED SUCCESSFULLY
                </div>

                <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                  <div style={{ background: "var(--bg-3)", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border-dim)" }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-faint)", marginBottom: 6 }}>ORIGINAL ROLE</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--text-dim)" }}>
                      {result.data.originalRole}
                    </div>
                  </div>
                  <div style={{ background: "var(--red-faint)", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-faint)", marginBottom: 6 }}>FORGED ROLE</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--red)" }}>
                      {result.data.forgedRole}
                    </div>
                  </div>
                </div>

                <div className="form-label" style={{ marginBottom: 8 }}>FORGED TOKEN (click Apply above)</div>
                <div className="response-box" style={{ fontSize: 10, wordBreak: "break-all", maxHeight: 120 }}>
                  {result.data.forgedToken}
                </div>
              </>
            )}

            {result?.testedAdmin && (
              <>
                {result.success ? (
                  <div className="attack-success">✓ ADMIN ACCESS GRANTED WITH FORGED TOKEN</div>
                ) : (
                  <div className="attack-warning">✗ ACCESS DENIED — Apply the forged token first</div>
                )}
                <div className="response-box success" style={{ marginTop: 12 }}>
                  {JSON.stringify(result.data, null, 2)}
                </div>
              </>
            )}

            {result && !result.success && !result.testedAdmin && (
              <div className="response-box error-box">
                {JSON.stringify(result.data, null, 2)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vulnerable code */}
      <div className="card">
        <div className="card-title">◈ VULNERABLE CODE — WHY THIS WORKS</div>
        <div className="response-box" style={{ maxHeight: 180 }}>
{`// middleware/auth.js — JWT verification flaw
function verifyToken(req, res, next) {
  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256', 'none']  // ❌ 'none' allows unsigned tokens
  });
  req.user = decoded;  // ❌ Role taken from token, not re-fetched from DB
  next();
}

// ✅ FIX: Always fetch role from DB on each request
// const dbUser = await db.get('SELECT role FROM users WHERE id = ?', [decoded.id]);
// req.user = { ...decoded, role: dbUser.role };`}
        </div>
      </div>
    </div>
  );
}
