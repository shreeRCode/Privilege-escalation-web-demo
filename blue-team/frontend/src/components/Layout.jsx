import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Layout.css";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: "⬡", exact: true },
  { path: "/idor-defense", label: "IDOR Defense", icon: "⊕", badge: "OWASP A01" },
  { path: "/jwt-defense", label: "JWT Defense", icon: "⊗", badge: "CVE-2022" },
  { path: "/mass-assign-defense", label: "Mass Assignment", icon: "⊘", badge: "OWASP A03" },
  { path: "/admin-defense", label: "Admin Defense", icon: "⊛", badge: "OWASP A05" },
  { path: "/defense-log", label: "Defense Log", icon: "⊜" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🛡</span>
            <div>
              <div className="logo-title">BLUE TEAM</div>
              <div className="logo-sub">Defense Lab</div>
            </div>
          </div>
          <div className="threat-level">
            <span className="threat-dot" />
            <span>SECURE SESSION</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">DEFENSE MODULES</div>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {user ? (
            <div className="user-info">
              <div className="user-avatar">{user.username?.[0]?.toUpperCase()}</div>
              <div className="user-details">
                <div className="user-name">{user.username}</div>
                <div className={`user-role role-${user.role}`}>{user.role?.toUpperCase()}</div>
              </div>
              <button onClick={handleLogout} className="logout-btn" title="Logout">⏻</button>
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="sidebar-login-btn"
            >
              ⏻ LOGIN
            </button>
          )}
          <div className="disclaimer">
            🛡️ Secure implementation. All attacks blocked.
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
