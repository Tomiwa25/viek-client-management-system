import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { crmApi } from '../lib/api';

export default function Dashboard() {
  const { user } = useAuth();

  const { data: leadsData } = useQuery({
    queryKey: ['leads', 'metric'],
    queryFn: () => crmApi.leads.list({ limit: 1 }),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'metric'],
    queryFn: () => crmApi.clients.list({ limit: 1 }),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', 'metric'],
    queryFn: () => crmApi.tasks.list({ status: 'TODO', limit: 1 }),
  });

  const totalLeads = leadsData?.pagination?.total ?? '—';
  const totalClients = clientsData?.pagination?.total ?? '—';
  const pendingTasks = tasksData?.pagination?.total ?? '—';

  return (
    <div className="crm-view-container">
      <section className="welcome-hero">
        <div className="hero-content">
          <span className="eyebrow">ORGANIZATION DASHBOARD</span>
          <h1>Welcome, {user?.fullName || user?.email}!</h1>
          <p>
            Workspace active for <strong>{user?.organization?.name}</strong>. Manage your sales pipeline, clients, and action items in one place.
          </p>
        </div>
        <div className="hero-status-pill">
          <span className="status-dot online"></span>
          <span>Tenant Isolated: {user?.organization?.slug}</span>
        </div>
      </section>

      {/* Quick Metrics Bar */}
      <section className="metrics-row">
        <Link to="/leads" className="metric-box">
          <div className="metric-header">
            <span className="metric-title">Sales Prospects</span>
            <span className="metric-icon">🎯</span>
          </div>
          <div className="metric-value">{totalLeads}</div>
          <span className="metric-hint">Pipeline Leads →</span>
        </Link>

        <Link to="/clients" className="metric-box">
          <div className="metric-header">
            <span className="metric-title">Active Clients</span>
            <span className="metric-icon">🏢</span>
          </div>
          <div className="metric-value">{totalClients}</div>
          <span className="metric-hint">View Portfolio →</span>
        </Link>

        <Link to="/tasks" className="metric-box">
          <div className="metric-header">
            <span className="metric-title">Pending Action Items</span>
            <span className="metric-icon">⚡</span>
          </div>
          <div className="metric-value">{pendingTasks}</div>
          <span className="metric-hint">Task Tracker →</span>
        </Link>
      </section>

      {/* Workspace Profile & Status */}
      <section className="stats-grid">
        <div className="stat-card">
          <h3>Tenant Namespace</h3>
          <p className="stat-detail"><strong>Organization:</strong> {user?.organization?.name}</p>
          <p className="stat-detail"><strong>Tenant Slug:</strong> <code>{user?.organization?.slug}</code></p>
          <p className="stat-detail"><strong>Workspace ID:</strong> <span className="mono-text">{user?.organization?.id}</span></p>
        </div>

        <div className="stat-card">
          <h3>Authenticated Identity</h3>
          <p className="stat-detail"><strong>Email:</strong> {user?.email}</p>
          <p className="stat-detail"><strong>Role:</strong> <span className="badge badge-primary">{user?.role}</span></p>
          <p className="stat-detail"><strong>Status:</strong> <span className="badge badge-success">{user?.status}</span></p>
        </div>

        <div className="stat-card highlight-card">
          <h3>Quick CRM Actions</h3>
          <div className="quick-actions-list">
            <Link to="/leads" className="btn btn-outline-sm">
              + Add / Qualify Leads
            </Link>
            <Link to="/clients" className="btn btn-outline-sm">
              + Log Client Activity
            </Link>
            <Link to="/tasks" className="btn btn-outline-sm">
              + Create Action Item
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
