import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../lib/api';

export default function Clients() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Modals & Panels
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);

  // New Client Form
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', company: '' });
  const [actionError, setActionError] = useState('');

  // Slide-over Interaction / Task form states
  const [newNote, setNewNote] = useState({ type: 'NOTE', notes: '' });
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Fetch client directory
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['clients', { search, includeArchived }],
    queryFn: () =>
      crmApi.clients.list({
        search: search.trim() || undefined,
        includeArchived: includeArchived ? 'true' : undefined,
      }),
  });

  // Fetch single client profile when selected
  const { data: detailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ['client', selectedClientId],
    queryFn: () => crmApi.clients.get(selectedClientId),
    enabled: Boolean(selectedClientId),
  });

  // Mutations
  const createClientMutation = useMutation({
    mutationFn: crmApi.clients.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsCreateOpen(false);
      setNewClient({ name: '', email: '', phone: '', company: '' });
      setActionError('');
    },
    onError: (err) => setActionError(err.message || 'Failed to create client'),
  });

  const archiveMutation = useMutation({
    mutationFn: crmApi.clients.archive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (selectedClientId) setSelectedClientId(null);
    },
  });

  const addInteractionMutation = useMutation({
    mutationFn: (payload) => crmApi.interactions.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', selectedClientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setNewNote({ type: 'NOTE', notes: '' });
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: (payload) => crmApi.tasks.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', selectedClientId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewTaskTitle('');
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, status }) => crmApi.tasks.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', selectedClientId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newClient.name.trim()) return;
    setActionError('');
    createClientMutation.mutate({
      name: newClient.name.trim(),
      email: newClient.email.trim() || undefined,
      phone: newClient.phone.trim() || undefined,
      company: newClient.company.trim() || undefined,
    });
  };

  const handleLogInteraction = (e) => {
    e.preventDefault();
    if (!newNote.notes.trim() || !selectedClientId) return;
    addInteractionMutation.mutate({
      clientId: selectedClientId,
      type: newNote.type,
      notes: newNote.notes.trim(),
    });
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedClientId) return;
    addTaskMutation.mutate({
      clientId: selectedClientId,
      title: newTaskTitle.trim(),
      priority: 'MEDIUM',
    });
  };

  const clients = data?.clients || [];
  const activeClient = detailData?.client;

  return (
    <div className="crm-view-container">
      <header className="page-header">
        <div>
          <span className="eyebrow">CLIENT PORTFOLIO</span>
          <h1 className="page-title">Client Accounts</h1>
          <p className="page-subtitle">Manage company relationships, timelines, and active commitments</p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary">
          + Add New Client
        </button>
      </header>

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search clients by name, company, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="btn-clear-search">✕</button>
          )}
        </div>

        <label className="checkbox-label filter-checkbox">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          <span>Show archived accounts</span>
        </label>
      </div>

      {/* Clients Table */}
      <div className="table-responsive-wrapper">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading clients...</p>
          </div>
        ) : isError ? (
          <div className="alert alert-error">
            <p>Failed to load clients: {error?.message}</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No clients found</h3>
            <p>
              {search
                ? 'No clients match your search query.'
                : 'Convert a lead from your pipeline or add your first client manually.'}
            </p>
            <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary">
              + Add Client
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Company</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Activity</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`clickable-row ${selectedClientId === client.id ? 'row-selected' : ''}`}
                >
                  <td>
                    <div className="cell-title">{client.name}</div>
                    <div className="cell-sub">{client.owner?.fullName || 'Assigned to team'}</div>
                  </td>
                  <td>
                    <span className="cell-company">{client.company || '—'}</span>
                  </td>
                  <td>
                    <div className="cell-contact">{client.email || '—'}</div>
                    <div className="cell-phone">{client.phone || ''}</div>
                  </td>
                  <td>
                    <span className={`badge ${client.archivedAt ? 'badge-error' : 'badge-success'}`}>
                      {client.status}
                    </span>
                  </td>
                  <td>
                    <div className="activity-counters">
                      <span title="Associated Tasks">📋 {client._count?.tasks || 0}</span>
                      <span title="Logged Interactions">💬 {client._count?.interactions || 0}</span>
                    </div>
                  </td>
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="action-button-group">
                      <button
                        onClick={() => setSelectedClientId(client.id)}
                        className="btn-action-view"
                        title="View profile & activity timeline"
                      >
                        Profile →
                      </button>
                      {!client.archivedAt && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Archive client "${client.name}"?`)) {
                              archiveMutation.mutate(client.id);
                            }
                          }}
                          className="btn-action-delete"
                          title="Archive client"
                        >
                          📦
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-over Profile Drawer */}
      {selectedClientId && (
        <div className="drawer-overlay" onClick={() => setSelectedClientId(null)}>
          <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <header className="drawer-header">
              <div>
                <span className="badge badge-primary">CLIENT PROFILE</span>
                <h2>{activeClient?.name || 'Loading profile…'}</h2>
                <p className="drawer-sub">
                  {activeClient?.company} {activeClient?.email ? `• ${activeClient.email}` : ''}
                </p>
              </div>
              <button onClick={() => setSelectedClientId(null)} className="btn-close-modal">✕</button>
            </header>

            {isDetailLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
              </div>
            ) : activeClient ? (
              <div className="drawer-body">
                {/* Contact Information Cards */}
                <div className="drawer-info-grid">
                  <div className="info-item">
                    <span className="info-label">Phone</span>
                    <span className="info-value">{activeClient.phone || 'None provided'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Account Owner</span>
                    <span className="info-value">{activeClient.owner?.fullName || 'Unassigned'}</span>
                  </div>
                  {activeClient.convertedFrom && (
                    <div className="info-item">
                      <span className="info-label">Converted From Lead</span>
                      <span className="info-value text-accent">Qualified Lead ✓</span>
                    </div>
                  )}
                </div>

                {/* Section: Client Tasks */}
                <section className="drawer-section">
                  <div className="section-title-row">
                    <h3>Associated Tasks</h3>
                    <span className="counter-pill">{activeClient.tasks?.length || 0}</span>
                  </div>

                  <form onSubmit={handleAddTask} className="inline-add-task">
                    <input
                      type="text"
                      placeholder="+ Add task for this client and press Enter..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                    />
                  </form>

                  <div className="task-list">
                    {activeClient.tasks?.length === 0 ? (
                      <p className="empty-hint">No active tasks for this client.</p>
                    ) : (
                      activeClient.tasks?.map((task) => {
                        const isDone = task.status === 'COMPLETED';
                        return (
                          <div key={task.id} className={`task-row ${isDone ? 'task-done' : ''}`}>
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() =>
                                  toggleTaskMutation.mutate({
                                    id: task.id,
                                    status: isDone ? 'TODO' : 'COMPLETED',
                                  })
                                }
                              />
                              <span className="task-title-text">{task.title}</span>
                            </label>
                            <span className={`priority-tag priority-${task.priority.toLowerCase()}`}>
                              {task.priority}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* Section: Activity & Interaction Log */}
                <section className="drawer-section">
                  <div className="section-title-row">
                    <h3>Activity Timeline</h3>
                    <span className="counter-pill">{activeClient.interactions?.length || 0}</span>
                  </div>

                  {/* Log new interaction */}
                  <form onSubmit={handleLogInteraction} className="log-interaction-box">
                    <div className="type-selector">
                      {['NOTE', 'CALL', 'MEETING', 'EMAIL'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewNote({ ...newNote, type: t })}
                          className={`type-btn ${newNote.type === t ? 'active' : ''}`}
                        >
                          {t === 'CALL' ? '📞 Call' : t === 'MEETING' ? '📅 Meeting' : t === 'EMAIL' ? '✉️ Email' : '📝 Note'}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={2}
                      placeholder={`Log a ${newNote.type.toLowerCase()} with ${activeClient.name}...`}
                      value={newNote.notes}
                      onChange={(e) => setNewNote({ ...newNote, notes: e.target.value })}
                    />
                    <div className="log-action-bar">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={addInteractionMutation.isPending || !newNote.notes.trim()}
                      >
                        {addInteractionMutation.isPending ? 'Logging…' : 'Log Activity'}
                      </button>
                    </div>
                  </form>

                  {/* Timeline entries */}
                  <div className="timeline-stream">
                    {activeClient.interactions?.length === 0 ? (
                      <p className="empty-hint">No activities logged yet.</p>
                    ) : (
                      activeClient.interactions?.map((item) => (
                        <div key={item.id} className="timeline-entry">
                          <div className="timeline-badge-circle">
                            {item.type === 'CALL' ? '📞' : item.type === 'MEETING' ? '📅' : item.type === 'EMAIL' ? '✉️' : '📝'}
                          </div>
                          <div className="timeline-bubble">
                            <div className="timeline-meta">
                              <strong>{item.author?.fullName || 'Team Member'}</strong>
                              <span>{new Date(item.occurredAt).toLocaleString()}</span>
                            </div>
                            <p className="timeline-text">{item.notes}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            ) : null}
          </aside>
        </div>
      )}

      {/* Modal: Add New Client */}
      {isCreateOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <header className="modal-header">
              <h3>Create Client Account</h3>
              <button onClick={() => setIsCreateOpen(false)} className="btn-close-modal">✕</button>
            </header>

            {actionError && (
              <div className="alert alert-error">
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="modal-form">
              <div className="form-group">
                <label>Client / Contact Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Wayne Bruce"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Company</label>
                  <input
                    type="text"
                    placeholder="Wayne Enterprises"
                    value={newClient.company}
                    onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 019-9234"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="contact@company.com"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                />
              </div>

              <footer className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="btn btn-outline-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createClientMutation.isPending}
                >
                  {createClientMutation.isPending ? 'Saving…' : 'Create Client'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
