import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const DEMO_USERS = [
    { username: "alice", password: "password123", role: "user" },
    { username: "bob", password: "password123", role: "user" },
    { username: "charlie", password: "password123", role: "moderator" },
    { username: "admin", password: "admin123", role: "admin" },
  ];

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(form.username, form.password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (user) => {
    setLoading(true);
    setError("");
    try {
      await login(user.username, user.password);
      navigate("/");
    } catch (err) {
      setError("Quick login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-container">
        <div className="login-brand">
          <div className="login-logo">◈</div>
          <div className="login-title">RED TEAM</div>
          <div className="login-subtitle">PRIVILEGE ESCALATION LAB</div>
          <div className="login-desc">
            Ethical hacking simulation environment.<br />
            Demonstrating horizontal & vertical privilege escalation.
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-header">
            <span>OPERATOR LOGIN</span>
            <span className="live-dot">● LIVE</span>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">USERNAME</label>
              <input
                className="form-input"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Enter username"
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label className="form-label">PASSWORD</label>
              <input
                type="password"
                className="form-input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>

            {error && <div className="login-error">⚠ {error}</div>}

            <button type="submit" className="btn btn-red" style={{ width: "100%" }} disabled={loading}>
              {loading ? "AUTHENTICATING..." : "INITIATE SESSION"}
            </button>
          </form>

          <div className="quick-login-section">
            <div className="quick-login-label">QUICK LOGIN — DEMO OPERATORS</div>
            <div className="quick-login-grid">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.username}
                  className={`quick-btn role-${u.role}`}
                  onClick={() => quickLogin(u)}
                  disabled={loading}
                >
                  <span className="quick-user">{u.username}</span>
                  <span className="quick-role">{u.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="login-note">
          ⚠ This environment contains intentional security vulnerabilities for educational demonstration.
          All attacks are logged and monitored by the purple team dashboard.
        </div>
      </div>
    </div>
  );
}
