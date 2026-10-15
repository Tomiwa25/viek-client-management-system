import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <span className="brand-badge">CLIENTFLOW</span>
          <span className="tenant-slug">{user?.organization?.name || 'Workspace'}</span>
        </div>
        <div className="dashboard-user-bar">
          <div className="user-profile-badge">
            <span className="user-avatar">
              {(user?.fullName || user?.email || 'U').charAt(0).toUpperCase()}
            </span>
            <div className="user-details">
              <span className="user-name">{user?.fullName || 'Team Member'}</span>
              <span className="user-email">{user?.email}</span>
            </div>
          </div>
          <button onClick={logout} className="btn btn-outline-sm">
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="welcome-hero">
          <div className="hero-content">
            <span className="eyebrow">WORKSPACE ACTIVE</span>
            <h1>Welcome to {user?.organization?.name}</h1>
            <p>
              Your multi-tenant workspace is fully initialized and your email is verified.
            </p>
          </div>
          <div className="hero-status-pill">
            <span className="status-dot online"></span>
            <span>Organization Admin: {user?.role}</span>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <h3>Organization Profile</h3>
            <p className="stat-detail"><strong>Name:</strong> {user?.organization?.name}</p>
            <p className="stat-detail"><strong>Slug:</strong> <code>{user?.organization?.slug}</code></p>
            <p className="stat-detail"><strong>Workspace ID:</strong> <span className="mono-text">{user?.organization?.id}</span></p>
          </div>

          <div className="stat-card">
            <h3>Session & Identity</h3>
            <p className="stat-detail"><strong>User ID:</strong> <span className="mono-text">{user?.id}</span></p>
            <p className="stat-detail"><strong>Status:</strong> <span className="badge badge-success">{user?.status}</span></p>
            <p className="stat-detail"><strong>Role:</strong> <span className="badge badge-primary">{user?.role}</span></p>
          </div>

          <div className="stat-card highlight-card">
            <h3>Next Phase: CRM Modules</h3>
            <p className="stat-description">
              The foundational authentication and workspace layer is ready.
            </p>
            <ul className="module-checklist">
              <li>✓ Multi-tenant Organization Onboarding</li>
              <li>✓ 6-Digit Mail-Log OTP Verification</li>
              <li>✓ Secure Session & JWT Auth Context</li>
              <li className="pending-item">⏳ Leads Module & Atomic Client Conversion</li>
              <li className="pending-item">⏳ Client Management & Pipeline Tracking</li>
              <li className="pending-item">⏳ Task Scheduling & Activity Logs</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
