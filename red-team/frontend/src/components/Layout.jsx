import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Layout.css";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: "⬡", exact: true },
  { path: "/idor", label: "IDOR Attack", icon: "⊕", badge: "OWASP A01" },
  { path: "/jwt-forge", label: "JWT Tampering", icon: "⊗", badge: "CVE-2022" },
  { path: "/mass-assign", label: "Mass Assignment", icon: "⊘", badge: "OWASP A03" },
  { path: "/admin", label: "Admin Escalation", icon: "⊛", badge: "OWASP A05" },
  { path: "/attack-log", label: "Attack Log", icon: "⊜" },
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
            <span className="logo-icon">◈</span>
            <div>
              <div className="logo-title">RED TEAM</div>
              <div className="logo-sub">Privilege Lab</div>
            </div>
          </div>
          <div className="threat-level">
            <span className="threat-dot" />
            <span>LIVE SESSION</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">ATTACK VECTORS</div>
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
          {user && (
            <div className="user-info">
              <div className="user-avatar">{user.username?.[0]?.toUpperCase()}</div>
              <div className="user-details">
                <div className="user-name">{user.username}</div>
                <div className={`user-role role-${user.role}`}>{user.role?.toUpperCase()}</div>
              </div>
              <button onClick={handleLogout} className="logout-btn" title="Logout">⏻</button>
            </div>
          )}
          <div className="disclaimer">
            ⚠️ Educational use only. Ethical hacking lab.
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
