import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="top-navbar">
        <div className="nav-left">
          <div className="brand-group">
            <span className="brand-mark">CLIENTFLOW</span>
            {user?.organization && (
              <span className="org-pill" title={`Slug: ${user.organization.slug}`}>
                🏢 {user.organization.name}
              </span>
            )}
          </div>

          <nav className="nav-links">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/leads"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              Leads
            </NavLink>
            <NavLink
              to="/clients"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              Clients
            </NavLink>
            <NavLink
              to="/projects"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              Projects
            </NavLink>
            <NavLink
              to="/tasks"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              Tasks
            </NavLink>
            {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
              <NavLink
                to="/team"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                Team
              </NavLink>
            )}
            <NavLink
              to="/overview"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              Overview
            </NavLink>
          </nav>
        </div>

        <div className="nav-right">
          <div className="user-indicator">
            <span className="user-avatar-sm">
              {(user?.fullName || user?.email || 'U').charAt(0).toUpperCase()}
            </span>
            <div className="user-meta">
              <span className="user-name-text">{user?.fullName || user?.email}</span>
              <span className="user-role-tag">{user?.role}</span>
            </div>
          </div>
          <button onClick={logout} className="btn-logout" title="Sign out of account">
            Sign Out
          </button>
        </div>
      </header>

      <main className="shell-content">
        {children || <Outlet />}
      </main>
    </div>
  );
}
