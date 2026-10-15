import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { authApi } from '../lib/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const initialEmail = searchParams.get('email') || location.state?.email || '';
  const initialOtp = searchParams.get('otp') || searchParams.get('code') || '';

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(initialOtp);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [infoMessage, setInfoMessage] = useState(location.state?.message || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOtpChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(raw);
    if (errorMessage) setErrorMessage('');
  };

  const handlePasteOtp = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 6);
    if (pasted) setOtp(pasted);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Please provide your account email address.');
      return;
    }

    const cleanOtp = otp.trim().replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setErrorMessage('The password reset code must be exactly 6 digits.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        otp: cleanOtp,
        newPassword,
      });

      setSuccessMessage('Password reset successfully! Redirecting you to sign in...');
      setTimeout(() => {
        navigate(`/login?email=${encodeURIComponent(email.trim().toLowerCase())}`);
      }, 1500);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to reset password. Please check the code and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <header className="auth-header">
          <div className="auth-icon-circle">🔐</div>
          <h1 className="auth-title">Set a new password</h1>
          <p className="auth-subtitle">
            Enter the 6-digit code sent to your email and your new password.
          </p>
        </header>

        {infoMessage && (
          <div className="alert alert-info" role="status">
            <span>{infoMessage}</span>
          </div>
        )}

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
            <label htmlFor="resetEmail">Account Email</label>
            <input
              id="resetEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="resetOtp">6-Digit Reset Code</label>
            <div className="otp-input-wrapper">
              <input
                id="resetOtp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={handleOtpChange}
                onPaste={handlePasteOtp}
                placeholder="••••••"
                className="otp-code-input"
                autoFocus={!initialOtp}
                required
              />
            </div>
            <p className="input-hint">Type or paste the 6-digit reset code from your email.</p>
          </div>

          <div className="form-row">
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
              <label htmlFor="confirmNewPassword">Confirm Password</label>
              <div className="password-wrapper">
                <input
                  id="confirmNewPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
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
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || successMessage !== ''}
          >
            {isSubmitting ? 'Updating password…' : 'Reset Password →'}
          </button>
        </form>

        <footer className="auth-footer">
          <p>
            Remembered your password?{' '}
            <Link to="/login" className="auth-link">Return to login</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
