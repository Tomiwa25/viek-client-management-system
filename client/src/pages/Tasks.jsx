import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../lib/api';

const STATUS_FILTERS = ['ALL', 'TODO', 'IN_PROGRESS', 'COMPLETED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function Tasks() {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    priority: 'MEDIUM',
    dueAt: '',
    clientId: '',
    leadId: '',
  });
  const [actionError, setActionError] = useState('');

  // Fetch tasks
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tasks', { status: statusFilter, priority: priorityFilter }],
    queryFn: () =>
      crmApi.tasks.list({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
      }),
  });

  // Fetch clients & leads for dropdown selection
  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'compact'],
    queryFn: () => crmApi.clients.list({ limit: 100 }),
    enabled: isCreateOpen,
  });

  const { data: leadsData } = useQuery({
    queryKey: ['leads', 'compact'],
    queryFn: () => crmApi.leads.list({ limit: 100 }),
    enabled: isCreateOpen,
  });

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: crmApi.tasks.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsCreateOpen(false);
      setNewTask({ title: '', priority: 'MEDIUM', dueAt: '', clientId: '', leadId: '' });
      setActionError('');
    },
    onError: (err) => setActionError(err.message || 'Failed to create task'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }) => crmApi.tasks.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: crmApi.tasks.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setActionError('');
    createTaskMutation.mutate({
      title: newTask.title.trim(),
      priority: newTask.priority,
      dueAt: newTask.dueAt ? new Date(newTask.dueAt).toISOString() : null,
      clientId: newTask.clientId || null,
      leadId: newTask.leadId || null,
    });
  };

  const tasks = data?.tasks || [];
  const clients = clientsData?.clients || [];
  const leads = leadsData?.leads || [];

  return (
    <div className="crm-view-container">
      <header className="page-header">
        <div>
          <span className="eyebrow">ACTION ITEMS</span>
          <h1 className="page-title">Task Tracker</h1>
          <p className="page-subtitle">Coordinate client deliverables, calls, and sales follow-ups</p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary">
          + Add New Task
        </button>
      </header>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="stage-pills">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`pill-btn ${statusFilter === s ? 'active' : ''}`}
            >
              {s === 'ALL' ? 'All Tasks' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="priority-filter-group">
          <span className="filter-label">Priority:</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="table-responsive-wrapper">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading tasks...</p>
          </div>
        ) : isError ? (
          <div className="alert alert-error">
            <p>Failed to load tasks: {error?.message}</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <h3>No tasks found</h3>
            <p>
              {statusFilter !== 'ALL' || priorityFilter !== 'ALL'
                ? 'No tasks match the active filters.'
                : 'All caught up! Add a new task to stay organized.'}
            </p>
            <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary">
              + Create Task
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Done</th>
                <th>Task Title</th>
                <th>Associated Entity</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Assignee</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const isDone = task.status === 'COMPLETED';
                return (
                  <tr key={task.id} className={isDone ? 'row-completed' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() =>
                          toggleStatusMutation.mutate({
                            id: task.id,
                            status: isDone ? 'TODO' : 'COMPLETED',
                          })
                        }
                        className="task-checkbox"
                        title={isDone ? 'Mark as incomplete' : 'Mark as completed'}
                      />
                    </td>
                    <td>
                      <span className={`task-title-cell ${isDone ? 'line-through' : ''}`}>
                        {task.title}
                      </span>
                    </td>
                    <td>
                      {task.client ? (
                        <span className="badge badge-success">
                          Client: {task.client.name}
                        </span>
                      ) : task.lead ? (
                        <span className="badge badge-primary">
                          Lead: {task.lead.name}
                        </span>
                      ) : (
                        <span className="text-muted">General workspace</span>
                      )}
                    </td>
                    <td>
                      <span className={`priority-tag priority-${task.priority.toLowerCase()}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="text-muted">
                      {task.dueAt ? new Date(task.dueAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <span className="owner-badge">
                        {task.assignee?.fullName || 'Assigned to team'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete task "${task.title}"?`)) {
                            deleteTaskMutation.mutate(task.id);
                          }
                        }}
                        className="btn-action-delete"
                        title="Delete task"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Create Task */}
      {isCreateOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <header className="modal-header">
              <h3>Create New Action Item</h3>
              <button onClick={() => setIsCreateOpen(false)} className="btn-close-modal">✕</button>
            </header>

            {actionError && (
              <div className="alert alert-error">
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="modal-form">
              <div className="form-group">
                <label>Task Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Schedule onboarding workshop with engineering team"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={newTask.dueAt}
                    onChange={(e) => setNewTask({ ...newTask, dueAt: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Link to Client (Optional)</label>
                  <select
                    value={newTask.clientId}
                    onChange={(e) => setNewTask({ ...newTask, clientId: e.target.value, leadId: '' })}
                  >
                    <option value="">None (Unlinked)</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Link to Lead (Optional)</label>
                  <select
                    value={newTask.leadId}
                    onChange={(e) => setNewTask({ ...newTask, leadId: e.target.value, clientId: '' })}
                  >
                    <option value="">None (Unlinked)</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.company ? `(${l.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
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
                  disabled={createTaskMutation.isPending}
                >
                  {createTaskMutation.isPending ? 'Saving…' : 'Create Task'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
