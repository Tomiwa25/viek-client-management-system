import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { crmApi } from '../lib/api';

const STAGES = ['ALL', 'NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST'];

export default function Leads() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState(null);

  // Form states
  const [newLead, setNewLead] = useState({ name: '', email: '', company: '', stage: 'NEW' });
  const [conversionData, setConversionData] = useState({ phone: '', notes: '' });
  const [actionError, setActionError] = useState('');
  const [successBanner, setSuccessBanner] = useState(null);

  // Fetch leads with search and stage filter
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['leads', { search, stage: selectedStage }],
    queryFn: () =>
      crmApi.leads.list({
        search: search.trim() || undefined,
        stage: selectedStage !== 'ALL' ? selectedStage : undefined,
      }),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: crmApi.leads.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setIsCreateOpen(false);
      setNewLead({ name: '', email: '', company: '', stage: 'NEW' });
      setActionError('');
    },
    onError: (err) => setActionError(err.message || 'Failed to create lead'),
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, stage }) => crmApi.leads.update(id, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const convertMutation = useMutation({
    mutationFn: ({ id, data }) => crmApi.leads.convert(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setSuccessBanner({
        message: `Lead "${res.client.name}" successfully converted to an active client!`,
        clientId: res.client.id,
      });
      setConvertingLead(null);
      setConversionData({ phone: '', notes: '' });
      setActionError('');
    },
    onError: (err) => setActionError(err.message || 'Failed to convert lead'),
  });

  const deleteMutation = useMutation({
    mutationFn: crmApi.leads.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newLead.name.trim()) return;
    setActionError('');
    createMutation.mutate({
      name: newLead.name.trim(),
      email: newLead.email.trim() || undefined,
      company: newLead.company.trim() || undefined,
      stage: newLead.stage,
    });
  };

  const handleConvertSubmit = (e) => {
    e.preventDefault();
    if (!convertingLead) return;
    setActionError('');
    convertMutation.mutate({
      id: convertingLead.id,
      data: {
        phone: conversionData.phone.trim() || undefined,
        notes: conversionData.notes.trim() || undefined,
      },
    });
  };

  const leads = data?.leads || [];

  return (
    <div className="crm-view-container">
      <header className="page-header">
        <div>
          <span className="eyebrow">SALES PIPELINE</span>
          <h1 className="page-title">Leads Directory</h1>
          <p className="page-subtitle">Track prospects and qualify leads into active client accounts</p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary">
          + Add New Lead
        </button>
      </header>

      {successBanner && (
        <div className="alert alert-success crm-banner" role="status">
          <span className="alert-icon">✓</span>
          <div className="banner-content">
            <p>{successBanner.message}</p>
            <Link to="/clients" className="alert-action-link">
              View in Clients directory →
            </Link>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="btn-close-banner">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search leads by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="btn-clear-search">✕</button>
          )}
        </div>

        <div className="stage-pills">
          {STAGES.map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStage(st)}
              className={`pill-btn ${selectedStage === st ? 'active' : ''}`}
            >
              {st === 'ALL' ? 'All Leads' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Leads Table */}
      <div className="table-responsive-wrapper">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading sales leads...</p>
          </div>
        ) : isError ? (
          <div className="alert alert-error">
            <p>Failed to load leads: {error?.message}</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <h3>No leads found</h3>
            <p>
              {search || selectedStage !== 'ALL'
                ? 'Try adjusting your search criteria or stage filter.'
                : 'Get started by creating your first sales lead.'}
            </p>
            <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary">
              + Create Lead
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Lead / Contact</th>
                <th>Company</th>
                <th>Pipeline Stage</th>
                <th>Owner</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const isConverted = Boolean(lead.convertedClientId || lead.stage === 'WON');
                return (
                  <tr key={lead.id} className={isConverted ? 'row-converted' : ''}>
                    <td>
                      <div className="cell-title">{lead.name}</div>
                      <div className="cell-sub">{lead.email || 'No email registered'}</div>
                    </td>
                    <td>
                      <span className="cell-company">{lead.company || '—'}</span>
                    </td>
                    <td>
                      <select
                        value={lead.stage}
                        disabled={isConverted || updateStageMutation.isPending}
                        onChange={(e) => updateStageMutation.mutate({ id: lead.id, stage: e.target.value })}
                        className={`stage-select stage-${lead.stage.toLowerCase()}`}
                      >
                        {STAGES.filter((s) => s !== 'ALL').map((stageOption) => (
                          <option key={stageOption} value={stageOption}>
                            {stageOption.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className="owner-badge">{lead.owner?.fullName || 'Unassigned'}</span>
                    </td>
                    <td className="text-muted">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      <div className="action-button-group">
                        {isConverted ? (
                          <Link to="/clients" className="badge badge-success text-link">
                            Converted Client ✓
                          </Link>
                        ) : (
                          <button
                            onClick={() => {
                              setActionError('');
                              setConvertingLead(lead);
                            }}
                            className="btn-action-convert"
                            title="Convert into active client"
                          >
                            ⚡ Convert
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete lead "${lead.name}"?`)) {
                              deleteMutation.mutate(lead.id);
                            }
                          }}
                          className="btn-action-delete"
                          title="Delete lead"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Create Lead */}
      {isCreateOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <header className="modal-header">
              <h3>Create New Lead</h3>
              <button onClick={() => setIsCreateOpen(false)} className="btn-close-modal">✕</button>
            </header>

            {actionError && (
              <div className="alert alert-error">
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="modal-form">
              <div className="form-group">
                <label>Prospect Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Contact Email</label>
                  <input
                    type="email"
                    placeholder="alex@target.com"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Company / Organization</label>
                  <input
                    type="text"
                    placeholder="e.g. Horizon Labs"
                    value={newLead.company}
                    onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Initial Pipeline Stage</label>
                <select
                  value={newLead.stage}
                  onChange={(e) => setNewLead({ ...newLead, stage: e.target.value })}
                >
                  <option value="NEW">NEW - Just added</option>
                  <option value="CONTACTED">CONTACTED - Outreach sent</option>
                  <option value="QUALIFIED">QUALIFIED - Verified budget & fit</option>
                  <option value="PROPOSAL_SENT">PROPOSAL_SENT - Contract sent</option>
                </select>
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
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Saving…' : 'Create Lead'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Convert Lead to Client */}
      {convertingLead && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <header className="modal-header">
              <div className="modal-title-group">
                <span className="badge badge-primary">ATOMIC CONVERSION</span>
                <h3>Convert Lead to Active Client</h3>
              </div>
              <button onClick={() => setConvertingLead(null)} className="btn-close-modal">✕</button>
            </header>

            {actionError && (
              <div className="alert alert-error">
                <span>{actionError}</span>
              </div>
            )}

            <div className="conversion-lead-preview">
              <div className="preview-row">
                <span className="preview-label">Client Name:</span>
                <span className="preview-value">{convertingLead.name}</span>
              </div>
              <div className="preview-row">
                <span className="preview-label">Company:</span>
                <span className="preview-value">{convertingLead.company || '—'}</span>
              </div>
              <div className="preview-row">
                <span className="preview-label">Email:</span>
                <span className="preview-value">{convertingLead.email || '—'}</span>
              </div>
            </div>

            <p className="conversion-explanation">
              Converting will create a new Client record, mark this lead as <strong>WON</strong>, and re-link all scheduled tasks to the client.
            </p>

            <form onSubmit={handleConvertSubmit} className="modal-form">
              <div className="form-group">
                <label>Phone Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="+1 (555) 012-3456"
                  value={conversionData.phone}
                  onChange={(e) => setConversionData({ ...conversionData, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Conversion Notes / Deal Summary</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Closed 12-month enterprise contract with 15 seats..."
                  value={conversionData.notes}
                  onChange={(e) => setConversionData({ ...conversionData, notes: e.target.value })}
                />
              </div>

              <footer className="modal-footer">
                <button
                  type="button"
                  onClick={() => setConvertingLead(null)}
                  className="btn btn-outline-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={convertMutation.isPending}
                >
                  {convertMutation.isPending ? 'Converting…' : 'Confirm Conversion →'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
