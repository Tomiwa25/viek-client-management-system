import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// Update these with the real company contact details.
const CONTACT = {
  instagram: 'https://instagram.com/clientflow',
  twitter: 'https://twitter.com/clientflow',
  whatsapp: 'https://wa.me/2340000000000',
  email: 'hello@clientflow.com',
};

export default function PublicDashboard() {
  const [selectedPipelineStage, setSelectedPipelineStage] = useState('QUALIFIED');

  const pipelineStages = [
    {
      id: 'NEW',
      name: 'Lead Capture',
      badge: 'Stage 01',
      stagePill: 'NEW',
      title: 'Inbound Inquiries & Prospect Intake',
      description: 'Capture inbound prospects with company information, point of contact, and estimated deal value. Instantly assign leads to dedicated sales staff.',
      metrics: '34 Prospects in Queue',
      statusClass: 'status-new',
    },
    {
      id: 'CONTACTED',
      name: 'Engagement',
      badge: 'Stage 02',
      stagePill: 'CONTACTED',
      title: 'Discovery & Initial Outreach',
      description: 'Conduct introductory calls and product demonstrations. Log every communication touchpoint and assign follow-up tasks with target deadlines.',
      metrics: '21 Discovery Calls Completed',
      statusClass: 'status-contacted',
    },
    {
      id: 'QUALIFIED',
      name: 'Qualification',
      badge: 'Stage 03',
      stagePill: 'QUALIFIED',
      title: 'Opportunity Evaluation & Proposal',
      description: 'Confirm budget, timeline, and decision authority. Send tailored proposals. Qualified leads are primed for one-click atomic conversion into permanent clients.',
      metrics: '12 Proposals Awaiting Sign-off',
      statusClass: 'status-qualified',
    },
    {
      id: 'WON',
      name: 'Client Onboarding',
      badge: 'Stage 04',
      stagePill: 'WON / CLIENT',
      title: 'Atomic Lead-to-Client Conversion',
      description: 'Convert won opportunities into permanent Client records seamlessly. Communication logs and outstanding tasks automatically migrate to the new client account.',
      metrics: '48 Active Enterprise Clients',
      statusClass: 'status-won',
    },
  ];

  const currentStage = pipelineStages.find((s) => s.id === selectedPipelineStage) || pipelineStages[2];

  return (
    <div className="public-showcase-wrapper">
      {/* Top Navigation CTA Bar */}
      <header className="public-navbar">
        <div className="public-nav-container">
          <div className="public-brand-group">
            <span className="brand-mark">CLIENTFLOW</span>
            <span className="brand-badge-sub">CRM PLATFORM</span>
          </div>

          <div className="public-auth-ctas">
            <Link to="/login" className="btn btn-outline-sm public-btn-signin">
              Sign In
            </Link>
            <Link to="/register" className="btn btn-primary-sm public-btn-signup">
              Create Organization Account
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Entry Section */}
      <section id="overview" className="showcase-hero">
        <div className="showcase-hero-inner">
          <div className="hero-eyebrow-container">
            <span className="hero-eyebrow-badge">ALL-IN-ONE CLIENT MANAGEMENT SYSTEM</span>
            <span className="hero-eyebrow-tech">Organization Workspaces • Sales Pipeline • Client Portfolios</span>
          </div>

          <h1 className="showcase-hero-title">
            Streamline Your Sales Pipeline & <br />
            <span className="gradient-highlight">Client Relationships in One Workspace</span>
          </h1>

          <p className="showcase-hero-desc">
            ClientFlow delivers a unified platform for organizations to manage prospects from initial lead capture 
            through atomic client conversion, ongoing account management, meeting timelines, and team task execution.
          </p>

          <div className="showcase-hero-actions">
            <Link to="/register" className="btn btn-primary btn-hero">
              <span>🚀</span> Start Free Workspace
            </Link>
            <Link to="/login" className="btn btn-secondary btn-hero">
              <span>🔑</span> Sign In to Existing Account
            </Link>
            <a href="#dashboard-preview" className="btn btn-ghost btn-hero">
              <span>📊</span> View Dashboard Preview ↓
            </a>
          </div>

          {/* Quick Metrics Bar */}
          <div className="showcase-hero-pills">
            <div className="hero-pill-item">
              <span className="pill-dot green"></span>
              <strong>Multi-Tenancy:</strong> Dedicated, private workspace for every organization
            </div>
            <div className="hero-pill-item">
              <span className="pill-dot blue"></span>
              <strong>Zero Data Loss:</strong> Seamless lead-to-client conversion workflow
            </div>
            <div className="hero-pill-item">
              <span className="pill-dot cyan"></span>
              <strong>Team Alignment:</strong> Role-based access for Admin, Manager, and Staff
            </div>
          </div>
        </div>
      </section>

      {/* State / Business Logic Notice Bar */}
      <section className="showcase-notice-bar">
        <div className="notice-inner">
          <span className="notice-icon">📋</span>
          <div className="notice-text">
            <strong>ClientFlow Platform Dashboard:</strong> You are exploring the business logic and capabilities of our client management system. Live CRM actions, record updates, and client communications are available when you sign in or register your organization.
          </div>
          <div className="notice-action">
            <Link to="/register" className="btn btn-sm btn-outline-cyan">Get Started →</Link>
          </div>
        </div>
      </section>

      {/* Main Dashboard Preview Section */}
      <main className="showcase-content-area">
        
        {/* Live CRM Executive Metrics Banner */}
        <section id="dashboard-preview" className="crm-metrics-preview-section">
          <div className="section-header">
            <span className="section-eyebrow">EXECUTIVE DASHBOARD SNAPSHOT</span>
            <h2 className="section-title">Live Organization Overview</h2>
            <p className="section-desc">
              Get an instant pulse on your organization's business health, sales momentum, and pending customer deliverables.
            </p>
          </div>

          <div className="metrics-showcase-grid">
            <div className="metric-showcase-box">
              <div className="metric-box-top">
                <span className="metric-box-label">Total Pipeline Value</span>
                <span className="metric-icon-badge">💰</span>
              </div>
              <div className="metric-box-number">$284,500</div>
              <div className="metric-box-footer positive">
                <span>↑ 18.4%</span> vs last month
              </div>
            </div>

            <div className="metric-showcase-box">
              <div className="metric-box-top">
                <span className="metric-box-label">Active Enterprise Clients</span>
                <span className="metric-icon-badge">🏢</span>
              </div>
              <div className="metric-box-number">48 Accounts</div>
              <div className="metric-box-footer neutral">
                <span>100% Retained</span> across all tiers
              </div>
            </div>

            <div className="metric-showcase-box">
              <div className="metric-box-top">
                <span className="metric-box-label">Active Prospects in Funnel</span>
                <span className="metric-icon-badge">🎯</span>
              </div>
              <div className="metric-box-number">23 Qualified</div>
              <div className="metric-box-footer positive">
                <span>+6 This Week</span> ready for conversion
              </div>
            </div>

            <div className="metric-showcase-box">
              <div className="metric-box-top">
                <span className="metric-box-label">Pending Action Items</span>
                <span className="metric-icon-badge">⚡</span>
              </div>
              <div className="metric-box-number">14 Tasks</div>
              <div className="metric-box-footer alert">
                <span>4 High Priority</span> due within 48h
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Sales Pipeline & Atomic Conversion Workflow */}
        <section id="pipeline-workflow" className="showcase-section">
          <div className="section-header">
            <span className="section-eyebrow">SALES FUNNEL LOGIC</span>
            <h2 className="section-title">The Client Acquisition Pipeline</h2>
            <p className="section-desc">
              Track how sales opportunities progress through deterministic stages from initial contact to won contracts.
            </p>
          </div>

          {/* Interactive Pipeline Funnel */}
          <div className="funnel-steps-container">
            {pipelineStages.map((stage) => {
              const isSelected = selectedPipelineStage === stage.id;
              return (
                <div
                  key={stage.id}
                  className={`funnel-step-card ${isSelected ? 'active-step' : ''}`}
                  onClick={() => setSelectedPipelineStage(stage.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedPipelineStage(stage.id);
                    }
                  }}
                >
                  <div className="step-indicator">
                    <span className="step-badge">{stage.badge}</span>
                    <span className={`step-pill ${stage.statusClass}`}>{stage.stagePill}</span>
                  </div>
                  <h3 className="step-title">{stage.name}</h3>
                  <p className="step-summary">{stage.description}</p>
                  <span className="step-metric-tag">{stage.metrics}</span>
                </div>
              );
            })}
          </div>

          {/* Active Stage Detail Spotlight */}
          <div className="stage-detail-spotlight">
            <div className="spotlight-left">
              <span className="spotlight-badge-primary">FEATURED STAGE LOGIC</span>
              <h3>{currentStage.title}</h3>
              <p>{currentStage.description}</p>
              <div className="spotlight-features-list">
                <div className="spotlight-feat-item">
                  <span className="feat-check">✓</span>
                  <div>
                    <strong>Automated Assignment:</strong> Leads route directly to available sales representatives.
                  </div>
                </div>
                <div className="spotlight-feat-item">
                  <span className="feat-check">✓</span>
                  <div>
                    <strong>Activity Timeline:</strong> Calls, emails, and meetings are automatically logged.
                  </div>
                </div>
                <div className="spotlight-feat-item">
                  <span className="feat-check">✓</span>
                  <div>
                    <strong>Atomic Conversion:</strong> Qualified prospects become permanent clients in a single action.
                  </div>
                </div>
              </div>
            </div>

            <div className="spotlight-right">
              <div className="simulated-card">
                <div className="simulated-header">
                  <span className="sim-tag">PROSPECT CARD</span>
                  <span className="badge badge-success">QUALIFIED</span>
                </div>
                <h4>Nexus Cloud Solutions</h4>
                <p className="sim-contact">Contact: Sarah Jenkins • VP of Engineering</p>
                <p className="sim-email">s.jenkins@nexuscloud.io • (555) 234-8901</p>
                <div className="sim-meta-row">
                  <span>Deal Size: <strong>$45,000 / yr</strong></span>
                  <span>Probability: <strong>85%</strong></span>
                </div>
                <div className="sim-actions-mock">
                  <span className="btn-mock-disabled">Log Call</span>
                  <span className="btn-mock-disabled">Create Task</span>
                  <span className="btn-mock-primary">Convert to Client →</span>
                </div>
                <p className="sim-notice">
                  * Converting seamlessly creates an active Client portfolio record and migrates all pending tasks.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Core Client Management & 360° View */}
        <section id="client-management" className="showcase-section">
          <div className="section-header">
            <span className="section-eyebrow">RELATIONSHIP MANAGEMENT</span>
            <h2 className="section-title">Comprehensive Client Portfolio & Account Hub</h2>
            <p className="section-desc">
              Maintain complete visibility over client contracts, key stakeholders, and communication history in one centralized view.
            </p>
          </div>

          <div className="client-ops-showcase-grid">
            <div className="client-ops-card">
              <div className="ops-card-top">
                <span className="ops-icon">🏢</span>
                <h3>Client Account Directory</h3>
              </div>
              <p className="ops-text">
                Filter, search, and paginate through all registered client organizations with real-time text matching.
              </p>
              <div className="sample-client-rows">
                <div className="sample-client-row">
                  <div className="client-avatar">AC</div>
                  <div className="client-info">
                    <strong>Apex Corporation</strong>
                    <span>Primary Contact: Marcus Vance (marcus@apexcorp.com)</span>
                  </div>
                  <span className="client-status-pill active">ACTIVE</span>
                </div>
                <div className="sample-client-row">
                  <div className="client-avatar">BL</div>
                  <div className="client-info">
                    <strong>BioLogic Technologies</strong>
                    <span>Primary Contact: Dr. Elena Rostova (elena@biologic.tech)</span>
                  </div>
                  <span className="client-status-pill active">ACTIVE</span>
                </div>
                <div className="sample-client-row">
                  <div className="client-avatar">ST</div>
                  <div className="client-info">
                    <strong>Starlight Media Group</strong>
                    <span>Primary Contact: Daniel Kim (dkim@starlightmedia.com)</span>
                  </div>
                  <span className="client-status-pill onboarding">ONBOARDING</span>
                </div>
              </div>
            </div>

            <div className="client-ops-card">
              <div className="ops-card-top">
                <span className="ops-icon">💬</span>
                <h3>Client Interaction Feed</h3>
              </div>
              <p className="ops-text">
                Every client touchpoint is cataloged into a permanent chronological audit timeline.
              </p>
              <div className="sample-timeline-feed">
                <div className="sample-feed-item">
                  <span className="feed-badge meeting">MEETING</span>
                  <div className="feed-body">
                    <strong>Annual Contract Renewal Discussion</strong>
                    <p>Agreed on 3-year enterprise extension with custom SLA terms.</p>
                    <span className="feed-time">Apex Corporation • Today at 11:30 AM</span>
                  </div>
                </div>
                <div className="sample-feed-item">
                  <span className="feed-badge call">CALL</span>
                  <div className="feed-body">
                    <strong>Quarterly Milestone Review</strong>
                    <p>Reviewed platform adoption metrics with team lead and approved Phase 2 rollout.</p>
                    <span className="feed-time">BioLogic Technologies • Yesterday</span>
                  </div>
                </div>
                <div className="sample-feed-item">
                  <span className="feed-badge note">NOTE</span>
                  <div className="feed-body">
                    <strong>Compliance & Security Approval</strong>
                    <p>Completed vendor security assessment and signed mutual NDA.</p>
                    <span className="feed-time">Starlight Media Group • 3 days ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Task & Action Items Execution */}
        <section id="task-tracking" className="showcase-section">
          <div className="section-header">
            <span className="section-eyebrow">OPERATIONAL EXCELLENCE</span>
            <h2 className="section-title">Team Task Tracker & Action Items</h2>
            <p className="section-desc">
              Empower your team to track deliverables, set priorities, and close customer loops on schedule.
            </p>
          </div>

          <div className="tasks-dashboard-layout">
            <div className="tasks-summary-box">
              <h3>Action Items Breakdown</h3>
              <p>Keep your customer success and sales teams synchronized on upcoming commitments.</p>

              <div className="task-stat-pills">
                <div className="t-stat">
                  <span className="t-num">14</span>
                  <span className="t-label">Pending</span>
                </div>
                <div className="t-stat">
                  <span className="t-num">4</span>
                  <span className="t-label">High Priority</span>
                </div>
                <div className="t-stat">
                  <span className="t-num">38</span>
                  <span className="t-label">Completed</span>
                </div>
              </div>

              <div className="task-tips-card">
                <strong>💡 Smart Workflow:</strong>
                <p>When converting a qualified lead into a client, all open follow-up tasks are automatically transferred to the new account with zero manual re-entry.</p>
              </div>
            </div>

            <div className="tasks-interactive-list">
              <div className="task-item-card">
                <span className="task-status-check completed">✓</span>
                <div className="task-details">
                  <span className="task-title-text done">Execute Mutual Non-Disclosure Agreement (NDA)</span>
                  <span className="task-subtext">Linked: Apex Corporation • Assigned to: Marcus Vance</span>
                </div>
                <span className="task-priority-tag low">LOW</span>
              </div>

              <div className="task-item-card">
                <span className="task-status-check pending">○</span>
                <div className="task-details">
                  <span className="task-title-text">Send customized enterprise proposal & tier breakdown</span>
                  <span className="task-subtext">Linked: Nexus Cloud Solutions • Due Tomorrow at 5:00 PM</span>
                </div>
                <span className="task-priority-tag high">HIGH</span>
              </div>

              <div className="task-item-card">
                <span className="task-status-check pending">○</span>
                <div className="task-details">
                  <span className="task-title-text">Schedule executive kickoff meeting with engineering lead</span>
                  <span className="task-subtext">Linked: BioLogic Technologies • Due Friday</span>
                </div>
                <span className="task-priority-tag medium">MEDIUM</span>
              </div>

              <div className="task-item-card">
                <span className="task-status-check pending">○</span>
                <div className="task-details">
                  <span className="task-title-text">Prepare Q4 customer health report and satisfaction scorecard</span>
                  <span className="task-subtext">Linked: Starlight Media Group • Due in 5 days</span>
                </div>
                <span className="task-priority-tag medium">MEDIUM</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Enterprise Security & Data Isolation */}
        <section id="security" className="showcase-section">
          <div className="section-header">
            <span className="section-eyebrow">SECURITY & PRIVACY</span>
            <h2 className="section-title">Multi-Tenant Isolation & Account Protection</h2>
            <p className="section-desc">
              Your organization's client records, sales pipelines, and customer notes are strictly quarantined in an isolated workspace.
            </p>
          </div>

          <div className="security-features-grid">
            <div className="sec-feat-card">
              <div className="sec-feat-icon">🏢</div>
              <h3>Workspace Namespace Isolation</h3>
              <p>
                Every organization operates in a dedicated workspace. Database queries are automatically scoped by your organization ID, ensuring zero cross-tenant visibility.
              </p>
            </div>

            <div className="sec-feat-card">
              <div className="sec-feat-icon">🛡️</div>
              <h3>Role-Based Access Control (RBAC)</h3>
              <p>
                Differentiate permissions between Admin, Manager, and Staff roles. Staff members focus on their assigned leads and clients while managers maintain team-wide oversight.
              </p>
            </div>

            <div className="sec-feat-card">
              <div className="sec-feat-icon">🔑</div>
              <h3>Scrypt Password Cryptography</h3>
              <p>
                User passwords are protected with state-of-the-art memory-hard Scrypt cryptographic hashing with unique per-user salts, protecting against brute-force attacks.
              </p>
            </div>

            <div className="sec-feat-card">
              <div className="sec-feat-icon">📧</div>
              <h3>6-Digit OTP Email Verification</h3>
              <p>
                Every new organization account verifies its corporate email using time-sensitive 6-digit OTP codes, with brute-force rate-limiting and expiration protection.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA Conversion Banner */}
        <section className="showcase-bottom-cta">
          <div className="bottom-cta-inner">
            <span className="cta-brand">CLIENTFLOW CRM</span>
            <h2>Ready to manage your clients with precision?</h2>
            <p>
              Launch your organization workspace today. Register in less than 60 seconds, verify your email, 
              and start qualifying leads, converting clients, and tracking deliverables.
            </p>
            <div className="bottom-cta-actions">
              <Link to="/register" className="btn btn-primary btn-lg">
                Create Organization Account
              </Link>
              <Link to="/login" className="btn btn-secondary btn-lg">
                Sign In to Existing Workspace
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Public Footer */}
      <footer className="public-footer">
        <div className="footer-container">
          <div className="footer-left">
            <span className="brand-mark">CLIENTFLOW</span>
            <p className="footer-tagline">Enterprise client management, pipeline automation, and multi-tenant security.</p>
          </div>
          <div className="footer-social">
            <a href={CONTACT.instagram} target="_blank" rel="noreferrer" className="social-link">Instagram</a>
            <a href={CONTACT.twitter} target="_blank" rel="noreferrer" className="social-link">Twitter</a>
            <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer" className="social-link">WhatsApp</a>
            <a href={`mailto:${CONTACT.email}`} className="social-link">{CONTACT.email}</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} VIEK Client Management System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
