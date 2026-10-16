import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const ROLE_OPTIONS = [
  { value: 'STAFF', label: 'Staff Member', description: 'Can manage assigned leads, clients, and operational tasks' },
  { value: 'MANAGER', label: 'Team Manager', description: 'Can view team rosters, lead pipelines, and operational analytics' },
  { value: 'ADMIN', label: 'Workspace Administrator', description: 'Full control over memberships, invitations, and workspace settings' },
];

export default function Team() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Modal states
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [newInvite, setNewInvite] = useState({ email: '', role: 'STAFF' });

  // Deactivate modal state
  const [deactivatingMember, setDeactivatingMember] = useState(null);
  const [deactivateReason, setDeactivateReason] = useState('');

  // Status/Feedback banners
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // 1. Fetch team members
  const {
    data: membersData,
    isLoading: loadingMembers,
    isError: errorMembers,
    refetch: refetchMembers,
  } = useQuery({
    queryKey: ['team', 'members'],
    queryFn: teamApi.members.list,
  });

  // 2. Fetch invitations
  const {
    data: invitationsData,
    isLoading: loadingInvitations,
    refetch: refetchInvitations,
  } = useQuery({
    queryKey: ['team', 'invitations'],
    queryFn: teamApi.invitations.list,
  });

  const members = membersData?.members || [];
  const invitations = invitationsData?.invitations || [];

  // Mutations
  const inviteMutation = useMutation({
    mutationFn: teamApi.invitations.create,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations'] });
      setIsInviteOpen(false);
      setNewInvite({ email: '', role: 'STAFF' });
      setFeedback({
        type: 'success',
        message: `Invitation successfully sent to ${res.invitation?.email || 'new member'}! Email link valid for 7 days.`,
      });
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to send invitation.' });
    },
  });

  const resendMutation = useMutation({
    mutationFn: teamApi.invitations.resend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations'] });
      setFeedback({
        type: 'success',
        message: 'A fresh invitation with a reset 7-day expiration has been emailed to the recipient.',
      });
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to resend invitation.' });
    },
  });

  const reminderMutation = useMutation({
    mutationFn: teamApi.invitations.reminder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations'] });
      setFeedback({
        type: 'success',
        message: 'Reminder email dispatched to the invited user.',
      });
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to send reminder email.' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: teamApi.invitations.revoke,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations'] });
      setFeedback({
        type: 'success',
        message: 'Invitation has been revoked. The secure link is now deactivated.',
      });
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to revoke invitation.' });
    },
  });

  const processRemindersMutation = useMutation({
    mutationFn: teamApi.invitations.processReminders,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations'] });
      setFeedback({
        type: 'success',
        message: `Reminder scan completed. Sent reminders to ${res.sentCount} candidate(s).`,
      });
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to process reminders.' });
    },
  });

  const roleChangeMutation = useMutation({
    mutationFn: ({ id, role }) => teamApi.members.updateRole(id, role),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['team', 'members'] });
      setFeedback({
        type: 'success',
        message: `Role for ${res.user?.fullName || res.user?.email} updated to ${res.user?.role}. Notification email sent.`,
      });
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to update member role.' });
    },
  });

  const statusChangeMutation = useMutation({
    mutationFn: ({ id, status, reason }) => teamApi.members.updateStatus(id, status, reason),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['team', 'members'] });
      setDeactivatingMember(null);
      setDeactivateReason('');
      setFeedback({
        type: 'success',
        message: `Account status for ${res.user?.fullName || res.user?.email} updated to ${res.user?.status}. Notification email sent.`,
      });
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to update account status.' });
    },
  });

  const handleInviteSubmit = (e) => {
    e.preventDefault();
    if (!newInvite.email.trim()) return;
    inviteMutation.mutate({
      email: newInvite.email.trim(),
      role: newInvite.role,
    });
  };

  const handleDeactivateConfirm = (e) => {
    e.preventDefault();
    if (!deactivatingMember) return;
    statusChangeMutation.mutate({
      id: deactivatingMember.id,
      status: 'SUSPENDED',
      reason: deactivateReason.trim() || undefined,
    });
  };

  const formatExpiresIn = (dateStr) => {
    const exp = new Date(dateStr);
    const now = new Date();
    const diffMs = exp - now;
    if (diffMs <= 0) return 'Expired';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours < 24) {
      return `Expiring soon (${hours}h remaining)`;
    }
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} left`;
  };

  // KPI Calculations
  const activeCount = members.filter((m) => m.status === 'ACTIVE').length;
  const adminCount = members.filter((m) => m.role === 'ADMIN').length;
  const pendingInvitesCount = invitations.filter((i) => i.status === 'PENDING').length;

  return (
    <div className="crm-view-container">
      {/* Header */}
      <header className="page-header">
        <div>
          <span className="eyebrow">ORGANIZATION ACCESS & RBAC</span>
          <h1 className="page-title">Team Management</h1>
          <p className="page-subtitle">
            Manage organization members, assign access roles, and invite staff members with secure 7-day tokens
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isAdmin && (
            <>
              <button
                onClick={() => processRemindersMutation.mutate()}
                className="btn btn-outline"
                disabled={processRemindersMutation.isPending}
                title="Trigger automated 6th-day reminder scan for invitations expiring within 24 hours"
              >
                {processRemindersMutation.isPending ? 'Scanning…' : '⏰ Scan 6th-Day Reminders'}
              </button>
              <button onClick={() => setIsInviteOpen(true)} className="btn btn-primary">
                + Invite Team Member
              </button>
            </>
          )}
        </div>
      </header>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-error'} crm-banner`}
          role="status"
        >
          <span className="alert-icon">{feedback.type === 'success' ? '✓' : '✕'}</span>
          <div className="banner-content">
            <p>{feedback.message}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="btn-close-banner">
            ✕
          </button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Members</span>
            <span className="metric-icon">👥</span>
          </div>
          <div className="metric-value">{loadingMembers ? '…' : activeCount}</div>
          <div className="metric-hint">Current authenticated workspace seats</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Workspace Admins</span>
            <span className="metric-icon">🛡️</span>
          </div>
          <div className="metric-value">{loadingMembers ? '…' : adminCount}</div>
          <div className="metric-hint">Members with full configuration authority</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Pending Invitations</span>
            <span className="metric-icon">✉️</span>
          </div>
          <div className="metric-value">{loadingInvitations ? '…' : pendingInvitesCount}</div>
          <div className="metric-hint">7-day secure access links awaiting response</div>
        </div>
      </div>

      {/* SECTION 1: Active Team Members Table */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Workspace Members</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Active and suspended collaborators with role-based access to this workspace
            </p>
          </div>
          <button onClick={() => refetchMembers()} className="btn btn-outline-sm" title="Refresh members list">
            ↻ Refresh
          </button>
        </div>

        <div className="table-responsive-wrapper">
          {loadingMembers ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading workspace members…</p>
            </div>
          ) : errorMembers ? (
            <div className="alert alert-error">
              <p>Unable to load members list. Make sure you have MANAGER or ADMIN permissions.</p>
            </div>
          ) : members.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>No members registered</h3>
              <p>Start by sending an invitation to your team.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined Date</th>
                  {isAdmin && <th className="text-right">Admin Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = member.id === user?.id;
                  const roleBadgeColor =
                    member.role === 'ADMIN'
                      ? '#ef4444'
                      : member.role === 'MANAGER'
                      ? '#3b82f6'
                      : '#10b981';

                  return (
                    <tr key={member.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span
                            className="user-avatar-sm"
                            style={{
                              background: 'var(--primary-light)',
                              border: '1px solid var(--border-subtle)',
                              fontWeight: 700,
                            }}
                          >
                            {(member.fullName || member.email).charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <div className="cell-title">
                              {member.fullName || 'Invited User'} {isSelf && <span style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>(You)</span>}
                            </div>
                            <div className="cell-sub">{member.email}</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        {isAdmin && !isSelf ? (
                          <select
                            className="stage-select"
                            value={member.role}
                            onChange={(e) =>
                              roleChangeMutation.mutate({
                                id: member.id,
                                role: e.target.value,
                              })
                            }
                            disabled={roleChangeMutation.isPending}
                            title="Change role (sends notification email)"
                          >
                            <option value="STAFF">STAFF</option>
                            <option value="MANAGER">MANAGER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              color: roleBadgeColor,
                              backgroundColor: `${roleBadgeColor}15`,
                              border: `1px solid ${roleBadgeColor}40`,
                              padding: '0.2rem 0.6rem',
                              borderRadius: 'var(--radius-sm)',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {member.role}
                          </span>
                        )}
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: member.status === 'ACTIVE' ? '#34d399' : '#f87171',
                            backgroundColor: member.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            border: `1px solid ${member.status === 'ACTIVE' ? '#10b981' : '#ef4444'}`,
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-full)',
                          }}
                        >
                          {member.status === 'ACTIVE' ? '● Active' : '● Suspended'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(member.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </td>

                      {isAdmin && (
                        <td className="text-right">
                          <div className="action-button-group">
                            {isSelf ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                Active Session
                              </span>
                            ) : member.status === 'ACTIVE' ? (
                              <button
                                onClick={() => setDeactivatingMember(member)}
                                className="btn btn-outline-sm"
                                style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                title="Suspend account access"
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  statusChangeMutation.mutate({
                                    id: member.id,
                                    status: 'ACTIVE',
                                  })
                                }
                                className="btn btn-outline-sm"
                                style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                                title="Reactivate user access"
                              >
                                Reactivate
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SECTION 2: Pending Invitations Table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Team Invitations</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Dedicated tracking for sent invitations with 7-day expiration windows and reminder notifications
            </p>
          </div>
          <button onClick={() => refetchInvitations()} className="btn btn-outline-sm" title="Refresh invitations">
            ↻ Refresh
          </button>
        </div>

        <div className="table-responsive-wrapper">
          {loadingInvitations ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading invitations…</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✉️</div>
              <h3>No pending invitations</h3>
              <p>All invitations have been accepted or none have been sent yet.</p>
              {isAdmin && (
                <button onClick={() => setIsInviteOpen(true)} className="btn btn-primary">
                  + Send First Invitation
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invited Email</th>
                  <th>Assigned Role</th>
                  <th>Invited By</th>
                  <th>Expiration Window</th>
                  <th>Status</th>
                  {isAdmin && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {invitations.map((invite) => {
                  const isPending = invite.status === 'PENDING';
                  const expiresIn = formatExpiresIn(invite.expiresAt);
                  const isExpiringSoon = isPending && expiresIn.includes('Expiring soon');

                  return (
                    <tr key={invite.id}>
                      <td>
                        <div className="cell-title">{invite.email}</div>
                        <div className="cell-sub">
                          Sent on{' '}
                          {new Date(invite.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            color:
                              invite.role === 'ADMIN'
                                ? '#ef4444'
                                : invite.role === 'MANAGER'
                                ? '#3b82f6'
                                : '#10b981',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          {invite.role}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {invite.inviter?.fullName || invite.inviter?.email || 'System Admin'}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: isExpiringSoon ? '#fbbf24' : 'var(--text-muted)',
                          }}
                        >
                          {expiresIn}
                        </span>
                        {invite.remindedAt && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>
                            ⏰ Reminded on {new Date(invite.remindedAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color:
                              invite.status === 'ACCEPTED'
                                ? '#34d399'
                                : invite.status === 'PENDING'
                                ? '#fbbf24'
                                : '#94a3b8',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {invite.status}
                        </span>
                      </td>

                      {isAdmin && (
                        <td className="text-right">
                          <div className="action-button-group">
                            {isPending && (
                              <>
                                <button
                                  onClick={() => resendMutation.mutate(invite.id)}
                                  disabled={resendMutation.isPending}
                                  className="btn btn-outline-sm"
                                  title="Resend email with new 7-day token"
                                >
                                  Resend
                                </button>
                                <button
                                  onClick={() => reminderMutation.mutate(invite.id)}
                                  disabled={reminderMutation.isPending}
                                  className="btn btn-outline-sm"
                                  title="Send 6th-day reminder notification email"
                                >
                                  Remind
                                </button>
                                <button
                                  onClick={() => revokeMutation.mutate(invite.id)}
                                  disabled={revokeMutation.isPending}
                                  className="btn-action-delete"
                                  title="Revoke / cancel invitation"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal: Invite Team Member */}
      {isInviteOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <header className="modal-header">
              <div className="modal-title-group">
                <span className="auth-brand-badge">TEAM ONBOARDING</span>
                <h3 style={{ fontSize: '1.25rem', marginTop: '0.25rem' }}>Invite New Team Member</h3>
              </div>
              <button onClick={() => setIsInviteOpen(false)} className="btn-close-modal">
                ✕
              </button>
            </header>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              The recipient will receive an invitation email formatted with a secure token. The link is valid for{' '}
              <strong style={{ color: '#fbbf24' }}>7 days</strong>, and reminders can be triggered anytime.
            </p>

            <form onSubmit={handleInviteSubmit} className="modal-form">
              <div className="form-group">
                <label>Recipient Email Address</label>
                <input
                  type="email"
                  placeholder="colleague@organization.com"
                  value={newInvite.email}
                  onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Assigned Access Role</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {ROLE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.65rem',
                        padding: '0.65rem 0.85rem',
                        background: newInvite.role === opt.value ? 'var(--bg-surface-elevated)' : 'transparent',
                        border: `1px solid ${newInvite.role === opt.value ? 'var(--border-focus)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="inviteRole"
                        value={opt.value}
                        checked={newInvite.role === opt.value}
                        onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value })}
                        style={{ marginTop: '0.2rem' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {opt.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <footer className="modal-footer">
                <button type="button" onClick={() => setIsInviteOpen(false)} className="btn btn-outline-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? 'Sending Invitation…' : 'Send Invitation Email →'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Deactivate Member Confirmation */}
      {deactivatingMember && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <header className="modal-header">
              <div className="modal-title-group">
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#f87171',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  ACCOUNT SUSPENSION
                </span>
                <h3 style={{ fontSize: '1.25rem', marginTop: '0.35rem' }}>Deactivate Team Member</h3>
              </div>
              <button onClick={() => setDeactivatingMember(null)} className="btn-close-modal">
                ✕
              </button>
            </header>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '1.25rem' }}>
              Are you sure you want to suspend access for{' '}
              <strong style={{ color: 'var(--text-main)' }}>
                {deactivatingMember.fullName || deactivatingMember.email}
              </strong>
              ? They will be immediately blocked from signing in or executing actions. An email notice will be sent.
            </p>

            <form onSubmit={handleDeactivateConfirm} className="modal-form">
              <div className="form-group">
                <label>Reason for Suspension (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Contract ended, role transition, leave of absence"
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                />
              </div>

              <footer className="modal-footer">
                <button
                  type="button"
                  onClick={() => setDeactivatingMember(null)}
                  className="btn btn-outline-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#ef4444', borderColor: '#ef4444' }}
                  disabled={statusChangeMutation.isPending}
                >
                  {statusChangeMutation.isPending ? 'Suspending…' : 'Confirm Suspension'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
