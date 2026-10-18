import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../lib/api';

export default function Projects() {
  const queryClient = useQueryClient();

  const [selectedClient, setSelectedClient] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    clientId: '',
    description: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch clients for dropdown filter and creation
  const { data: clientsData, isLoading: isClientsLoading } = useQuery({
    queryKey: ['clients', 'all'],
    queryFn: () => crmApi.clients.list({ limit: 100 }),
  });

  const clients = clientsData?.clients || clientsData?.data || [];

  // Fetch projects (optionally filtered by selectedClient)
  const { data: projectsData, isLoading: isProjectsLoading, isError, error } = useQuery({
    queryKey: ['projects', { clientId: selectedClient }],
    queryFn: () => crmApi.projects.list({ clientId: selectedClient || undefined }),
  });

  const projects = projectsData?.projects || projectsData?.data || [];

  // Mutations
  const createProjectMutation = useMutation({
    mutationFn: crmApi.projects.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsCreateOpen(false);
      setNewProject({ name: '', clientId: '', description: '' });
      setSuccessMessage('Project added successfully');
      setErrorMessage('');
      setTimeout(() => setSuccessMessage(''), 4000);
    },
    onError: (err) => {
      setErrorMessage(err.message || 'Failed to create project');
      setSuccessMessage('');
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: crmApi.projects.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setSuccessMessage('Project deleted successfully');
      setErrorMessage('');
      setTimeout(() => setSuccessMessage(''), 4000);
    },
    onError: (err) => {
      setErrorMessage(err.message || 'Failed to delete project');
      setSuccessMessage('');
    },
  });

  function handleCreateSubmit(e) {
    e.preventDefault();
    if (!newProject.name.trim()) {
      setErrorMessage('Project name is required');
      return;
    }
    if (!newProject.clientId) {
      setErrorMessage('Please select a client for this project');
      return;
    }
    createProjectMutation.mutate({
      name: newProject.name.trim(),
      clientId: newProject.clientId,
      description: newProject.description.trim() || undefined,
    });
  }

  function handleDelete(id, name) {
    if (window.confirm(`Are you sure you want to delete project "${name}"?`)) {
      deleteProjectMutation.mutate(id);
    }
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">
            Manage organizational projects, deliverables, and track client assignments.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setIsCreateOpen(true);
            setErrorMessage('');
          }}
        >
          + Add Project
        </button>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          {errorMessage}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="card filter-bar" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div className="flex flex-wrap items-center gap-4">
          <label htmlFor="client-filter-select" style={{ fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
            Filter by Client:
          </label>
          <select
            id="client-filter-select"
            className="input-select"
            style={{ maxWidth: '300px' }}
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="">All Clients ({clients.length})</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.company ? `(${c.company})` : ''}
              </option>
            ))}
          </select>

          {selectedClient && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedClient('')}
            >
              Clear Filter
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--text-muted, #64748b)' }}>
            Showing {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </div>
        </div>
      </div>

      {/* Projects List / Table */}
      <div className="card">
        {isProjectsLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
            Loading projects...
          </div>
        ) : isError ? (
          <div className="alert alert-danger" style={{ margin: '1.5rem' }}>
            Failed to load projects: {error?.message || 'Unknown error'}
          </div>
        ) : projects.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              No projects found
            </h3>
            <p style={{ color: 'var(--text-muted, #64748b)', marginBottom: '1.5rem' }}>
              {selectedClient
                ? 'There are no active projects associated with the selected client.'
                : 'No projects have been created in this organization yet.'}
            </p>
            <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
              Create First Project
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Client</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((proj) => (
                  <tr key={proj.id}>
                    <td>
                      <strong>{proj.name}</strong>
                    </td>
                    <td>
                      <span className="badge badge-client">
                        {proj.client?.name || 'Unassigned'}
                      </span>
                      {proj.client?.company && (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>
                          {proj.client.company}
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: '320px', color: '#475569' }}>
                      {proj.description || '—'}
                    </td>
                    <td>
                      <span className="badge badge-success">
                        {proj.status || 'Active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(proj.id, proj.name)}
                        disabled={deleteProjectMutation.isPending}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Project Modal */}
      {isCreateOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Add New Project</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsCreateOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {errorMessage && (
                  <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                    {errorMessage}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="project-name-input">Project Name *</label>
                  <input
                    id="project-name-input"
                    type="text"
                    className="input-text"
                    placeholder="e.g. Website Overhaul"
                    value={newProject.name}
                    onChange={(e) =>
                      setNewProject((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="project-client-select">Associated Client *</label>
                  <select
                    id="project-client-select"
                    className="input-select"
                    value={newProject.clientId}
                    onChange={(e) =>
                      setNewProject((prev) => ({ ...prev, clientId: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select a client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="project-desc-input">Description (Optional)</label>
                  <textarea
                    id="project-desc-input"
                    className="input-text"
                    rows="3"
                    placeholder="Brief description of project scope..."
                    value={newProject.description}
                    onChange={(e) =>
                      setNewProject((prev) => ({ ...prev, description: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createProjectMutation.isPending}
                >
                  {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
