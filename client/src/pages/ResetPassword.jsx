import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { authApi } from '../lib/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const email = searchParams.get('email') || location.state?.email || '';
  const otp = searchParams.get('otp') || searchParams.get('code') || location.state?.otp || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If no email or OTP provided, prompt the user to request a code
  if (!email || !otp) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <header className="auth-header">
            <div className="auth-icon-circle">⚠️</div>
            <h1 className="auth-title">Reset Code Required</h1>
            <p className="auth-subtitle">
              You must enter the 6-digit verification code from your email before setting a new password.
            </p>
          </header>

          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link to={email ? `/verify-reset-code?email=${encodeURIComponent(email)}` : '/forgot-password'} className="btn btn-primary">
              {email ? 'Enter 6-Digit Code →' : 'Request Password Reset →'}
            </Link>
            <Link to="/login" className="btn btn-secondary">
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      });

      setSuccessMessage('Password reset successfully! Redirecting you to sign in...');
      setTimeout(() => {
        navigate(`/login?email=${encodeURIComponent(email.trim().toLowerCase())}&reset=success`);
      }, 1200);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to reset password. The code may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <header className="auth-header">
          <div className="auth-icon-circle">🔑</div>
          <h1 className="auth-title">Set New Password</h1>
          <p className="auth-subtitle">
            Type your new password and confirm it for{' '}
            <strong style={{ color: 'var(--text-main)' }}>{email}</strong>
          </p>
        </header>

        {errorMessage && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success" role="status">
            <span className="alert-icon">✓</span>
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <div className="password-wrapper">
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                disabled={isSubmitting || successMessage !== ''}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="btn-toggle-eye"
                title={showPassword ? 'Hide password' : 'View password'}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmNewPassword">Confirm New Password</label>
            <div className="password-wrapper">
              <input
                id="confirmNewPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isSubmitting || successMessage !== ''}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="btn-toggle-eye"
                title={showConfirmPassword ? 'Hide password' : 'View password'}
                tabIndex={-1}
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || successMessage !== ''}
          >
            {isSubmitting ? 'Updating password…' : 'Reset Password & Sign In →'}
          </button>
        </form>

        <footer className="auth-footer">
          <p>
            Remembered your credentials?{' '}
            <Link to="/login" className="auth-link">Return to login</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
