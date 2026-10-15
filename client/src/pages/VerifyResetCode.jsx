import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { authApi } from '../lib/api';

export default function VerifyResetCode() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const initialEmail = searchParams.get('email') || location.state?.email || '';
  const initialOtp = searchParams.get('otp') || searchParams.get('code') || '';

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(initialOtp);
  const [infoMessage, setInfoMessage] = useState(
    location.state?.message || 'Please check your email for the 6-digit password reset code.'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');

  // Handle countdown timer for Resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const verifyAndAdvance = async (targetEmail, targetOtp) => {
    if (!targetEmail.trim()) {
      setErrorMessage('Please provide your account email address.');
      return;
    }

    const cleanOtp = targetOtp.trim().replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setErrorMessage('The reset code must be exactly 6 digits.');
      return;
    }

    setErrorMessage('');
    setIsVerifying(true);

    try {
      await authApi.verifyResetCode({
        email: targetEmail.trim().toLowerCase(),
        otp: cleanOtp,
      });

      // Code is valid! Immediately take user to the Reset Password page to type & confirm new password
      navigate(
        `/reset-password?email=${encodeURIComponent(targetEmail.trim().toLowerCase())}&otp=${encodeURIComponent(cleanOtp)}`,
        {
          state: {
            email: targetEmail.trim().toLowerCase(),
            otp: cleanOtp,
          },
        }
      );
    } catch (err) {
      setErrorMessage(err.message || 'Invalid or expired reset code. Please check and try again.');
      setIsVerifying(false);
    }
  };

  // If both email and OTP are provided on initial load (e.g. from query params), auto-advance
  useEffect(() => {
    if (initialEmail && initialOtp && initialOtp.length === 6) {
      verifyAndAdvance(initialEmail, initialOtp);
    }
  }, []);

  const handleOtpChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(rawVal);
    if (errorMessage) setErrorMessage('');
    if (rawVal.length === 6 && email.trim()) {
      verifyAndAdvance(email, rawVal);
    }
  };

  const handlePasteOtp = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      setOtp(pastedData);
      if (pastedData.length === 6 && email.trim()) {
        verifyAndAdvance(email, pastedData);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    verifyAndAdvance(email, otp);
  };

  const handleResend = async () => {
    if (!email.trim() || resendCooldown > 0) return;
    setErrorMessage('');
    setResendMessage('');

    try {
      await authApi.forgotPassword({ email: email.trim().toLowerCase() });
      setResendMessage('A fresh 6-digit reset code has been sent to your email.');
      setResendCooldown(60);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend reset code. Please try again later.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <header className="auth-header">
          <div className="auth-icon-circle">🔐</div>
          <h1 className="auth-title">Enter Reset Code</h1>
          <p className="auth-subtitle">
            {email ? (
              <>
                We sent a 6-digit password reset code to{' '}
                <strong style={{ color: 'var(--text-main)' }}>{email}</strong>
              </>
            ) : (
              'Enter the 6-digit reset code sent to your email.'
            )}
          </p>
        </header>

        {infoMessage && (
          <div className="alert alert-info" role="status">
            <span>{infoMessage}</span>
          </div>
        )}

        {resendMessage && (
          <div className="alert alert-success" role="status">
            <span className="alert-icon">✓</span>
            <span>{resendMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!initialEmail && (
            <div className="form-group">
              <label htmlFor="verifyResetEmail">Account Email</label>
              <input
                id="verifyResetEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="resetOtpCode">6-Digit Reset Code</label>
            <div className="otp-input-wrapper">
              <input
                id="resetOtpCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={handleOtpChange}
                onPaste={handlePasteOtp}
                placeholder="••••••"
                className="otp-code-input"
                autoFocus
                required
                disabled={isVerifying}
              />
            </div>
            <p className="input-hint">
              Paste or type the 6-digit code. You'll be taken immediately to set your new password.
            </p>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isVerifying || otp.length !== 6}
          >
            {isVerifying ? 'Verifying code…' : 'Continue to Reset Password →'}
          </button>
        </form>

        <div className="otp-resend-area">
          <p className="text-muted text-sm">
            Didn't receive the code?{' '}
            <button
              type="button"
              className="btn-link"
              onClick={handleResend}
              disabled={resendCooldown > 0 || isVerifying || !email.trim()}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </button>
          </p>
        </div>

        <footer className="auth-footer">
          <p>
            Remembered your password?{' '}
            <Link to="/login" className="auth-link">Return to login</Link>
          </p>
          <p style={{ marginTop: '0.35rem' }}>
            <Link to="/forgot-password" className="auth-link-sm">
              Use a different email address
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
