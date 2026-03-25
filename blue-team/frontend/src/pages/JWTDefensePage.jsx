import { useState } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function JWTDefensePage() {
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const currentToken = localStorage.getItem("blue_token");
  const decodeToken = (token) => {
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch {
      return null;
    }
  };

  const currentPayload = currentToken ? decodeToken(currentToken) : null;

  // Test: Try to access admin endpoint (should fail for non-admin)
  const testAdminAccess = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.get("/admin/dashboard");
      setResult({ success: true, data: res.data, test: "admin" });
    } catch (err) {
      setResult({ success: false, data: err.response?.data, test: "admin" });
    } finally {
      setLoading(false);
    }
  };

  // Test: Try to forge token (endpoint doesn't exist)
  const testForgeToken = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post("/auth/forge-token", { targetRole: "admin" });
      setResult({ success: true, data: res.data, test: "forge" });
    } catch (err) {
      setResult({ success: false, data: err.response?.data, test: "forge" });
    } finally {
      setLoading(false);
    }
  };

  // Test: Verify that role comes from DB
  const testRoleVerification = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.get("/auth/me");
      setResult({ success: true, data: res.data, test: "verify" });
    } catch (err) {
      setResult({ success: false, data: err.response?.data, test: "verify" });
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === "admin";

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title"><span>JWT</span> DEFENSE MODULE</div>
        <div className="page-subtitle">HS256-ONLY + DB-VERIFIED ROLES — PREVENTS VERTICAL ESCALATION</div>
        <div className="cve-tag">🛡️ CVE-2022-21449 — JWT Tampering Blocked</div>
      </div>

      <div className="defense-info">
        HOW IT'S PROTECTED:{"\n"}
        1. Only HS256 algorithm accepted — 'none' algorithm REJECTED{"\n"}
        2. Strong, cryptographic JWT secret (not "secret123"){"\n"}
        3. Role is NOT stored in token — fetched from DB on EVERY request{"\n"}
        4. No /forge-token endpoint exists — cannot request role changes{"\n"}
        5. Token expiry set to 1 hour (not 7 days){"\n\n"}
        RESULT: Even if an attacker modified the JWT payload, the server ignores it and checks the database.
      </div>

      <div className="grid-2">
        <div>
          {/* Current token payload */}
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
                        ? "var(--green)"
                        : "var(--text)",
                    }}>
                      {typeof v === "number" ? (k === "exp" || k === "iat" ? new Date(v * 1000).toLocaleString() : v) : String(v)}
                    </span>
                  </div>
                ))}
                <div className="defense-success" style={{ marginTop: 8, marginBottom: 0 }}>
                  🛡️ Note: Token contains only ID and username — role is NOT in the token
                </div>
              </div>
            ) : (
              <div className="loading">No token found</div>
            )}
          </div>

          {/* Test controls */}
          <div className="card">
            <div className="card-title">🛡️ TEST DEFENSES</div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{
                background: "var(--bg-3)",
                border: "1px solid var(--border-dim)",
                borderRadius: 8,
                padding: 14,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontFamily: "var(--display)", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                    Test Forge Endpoint
                  </div>
                  <button
                    className="btn btn-blue"
                    onClick={testForgeToken}
                    disabled={loading}
                    style={{ fontSize: 11, padding: "5px 12px" }}
                  >
                    TEST
                  </button>
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>
                  POST /api/auth/forge-token — endpoint REMOVED, will return 404
                </div>
              </div>

              <div style={{
                background: "var(--bg-3)",
                border: "1px solid var(--border-dim)",
                borderRadius: 8,
                padding: 14,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontFamily: "var(--display)", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                    Test Admin Access
                  </div>
                  <button
                    className="btn btn-blue"
                    onClick={testAdminAccess}
                    disabled={loading}
                    style={{ fontSize: 11, padding: "5px 12px" }}
                  >
                    TEST
                  </button>
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>
                  GET /api/admin/dashboard — {isAdmin ? "should succeed (you're admin)" : "will be blocked (not admin)"}
                </div>
              </div>

              <div style={{
                background: "var(--bg-3)",
                border: "1px solid var(--border-dim)",
                borderRadius: 8,
                padding: 14,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontFamily: "var(--display)", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                    Verify DB Role
                  </div>
                  <button
                    className="btn btn-blue"
                    onClick={testRoleVerification}
                    disabled={loading}
                    style={{ fontSize: 11, padding: "5px 12px" }}
                  >
                    TEST
                  </button>
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>
                  GET /api/auth/me — role returned from DATABASE, not JWT payload
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Response */}
        <div>
          <div className="card" style={{ height: "100%" }}>
            <div className="card-title">◈ TEST RESULT</div>

            {!result && <div className="loading">SELECT A TEST ABOVE...</div>}

            {result?.test === "forge" && !result.success && (
              <div className="defense-success">
                🛡️ FORGE ENDPOINT BLOCKED — Endpoint doesn't exist on secure server
              </div>
            )}

            {result?.test === "admin" && !result.success && (
              <div className="defense-success">
                🛡️ ADMIN ACCESS DENIED — Role verified from database, not JWT
              </div>
            )}

            {result?.test === "admin" && result.success && (
              <div className="defense-success">
                ✓ Admin access granted — your DB role is verified as admin
              </div>
            )}

            {result?.test === "verify" && result.success && (
              <>
                <div className="defense-success">
                  ✓ Role fetched from DATABASE — token role is ignored
                </div>
                <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                  <div style={{ background: "rgba(0,255,136,0.05)", padding: "10px 14px", borderRadius: 6, border: "1px solid rgba(0,255,136,0.15)" }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-faint)", marginBottom: 6 }}>DB-VERIFIED ROLE</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--green)" }}>
                      {result.data.user?.role}
                    </div>
                  </div>
                </div>
              </>
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
        <div className="response-box" style={{ maxHeight: 200 }}>
{`// middleware/auth.js — FIXED: DB-verified roles
function verifyToken(req, res, next) {
  const decoded = jwt.verify(token, STRONG_SECRET, {
    algorithms: ['HS256']  // ✅ Only HS256 — 'none' REJECTED
  });

  // ✅ FIX: Fetch REAL role from database, ignore token
  db.get('SELECT * FROM users WHERE id = ?', [decoded.id], (err, dbUser) => {
    req.user = {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,  // ← From DB, NOT from token
    };
    next();
  });
}

// ✅ FIX: No forge-token endpoint exists`}
        </div>
      </div>
    </div>
  );
}
