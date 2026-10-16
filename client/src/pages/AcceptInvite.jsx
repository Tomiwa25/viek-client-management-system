import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);
  const [loadError, setLoadError] = useState('');

  // Form states
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) {
      setLoadError('No invitation token found in this link. Please check your invitation email.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    authApi
      .getInvitation(token)
      .then((res) => {
        if (isMounted) {
          setInvitation(res.invitation);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setLoadError(err.message || 'The invitation link is invalid or has expired.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }

    if (!password || password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.acceptInvite({
        token,
        fullName: fullName.trim(),
        password,
      });

      if (res.accessToken && res.user) {
        setSession(res.accessToken, res.user);
        navigate('/', { replace: true });
      } else {
        navigate('/login', {
          replace: true,
          state: { message: 'Account activated successfully! Please sign in.' },
        });
      }
    } catch (err) {
      setFormError(err.message || 'Failed to activate account. The invitation may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
          <h2>Verifying Invitation…</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Validating secure token credentials with the workspace server.
          </p>
        </div>
      </div>
    );
  }

  if (loadError || !invitation) {
    return (
      <div className="auth-container">
        <div className="auth-card not-found-card" style={{ textAlign: 'center' }}>
          <div className="auth-icon-circle" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            ⚠️
          </div>
          <span className="auth-brand-badge" style={{ color: 'var(--error-text)', borderColor: 'var(--error-border)', background: 'var(--error-bg)' }}>
            INVITATION ERROR
          </span>
          <h2 style={{ marginTop: '0.5rem' }}>Invitation Unavailable</h2>
          <p style={{ color: 'var(--text-muted)', margin: '1rem 0 1.5rem 0', fontSize: '0.95rem', lineHeight: '1.6' }}>
            {loadError}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to="/login" className="btn btn-primary">
              Sign In to Existing Account
            </Link>
            <Link to="/overview" className="btn btn-outline">
              Learn More
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const roleColor =
    invitation.role === 'ADMIN'
      ? '#ef4444'
      : invitation.role === 'MANAGER'
      ? '#3b82f6'
      : '#10b981';

  return (
    <div className="auth-container">
      <div className="auth-card">
        <header className="auth-header">
          <span className="auth-brand-badge">WORKSPACE INVITATION</span>
          <h1>Join {invitation.organizationName}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Accept your team seat and finalize your secure login credentials
          </p>
        </header>

        {/* Workspace Details Banner */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '1.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Workspace Organization</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
              🏢 {invitation.organizationName}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Invited Email</span>
            <span style={{ fontWeight: 600, color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>
              {invitation.email}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Assigned Team Role</span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: roleColor,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${roleColor}40`,
                letterSpacing: '0.05em',
              }}
            >
              {invitation.role}
            </span>
          </div>
        </div>

        {formError && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
            <span className="alert-icon">✕</span>
            <p>{formError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              placeholder="e.g. Alex Morgan"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Create Password</label>
            <div className="input-with-action">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                className="btn-input-action"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <span className="field-hint">Use at least 8 characters with a mix of letters and numbers.</span>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
            style={{ marginTop: '0.75rem' }}
          >
            {submitting ? 'Activating Workspace Account…' : `Join ${invitation.organizationName} →`}
          </button>
        </form>

        <footer className="auth-footer" style={{ marginTop: '1.75rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Already have an active account?{' '}
            <Link to="/login" style={{ color: 'var(--accent-cyan)' }}>
              Sign in directly
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
