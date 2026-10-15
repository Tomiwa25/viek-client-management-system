import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { verifyMutation, resendMutation } = useAuth();

  const urlEmail = searchParams.get('email') || location.state?.email || '';
  const urlOtp = searchParams.get('otp') || searchParams.get('code') || '';

  const [email, setEmail] = useState(urlEmail);
  const [otp, setOtp] = useState(urlOtp);
  const [infoMessage, setInfoMessage] = useState(location.state?.message || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const autoSubmittedRef = useRef(false);

  // Handle countdown timer for Resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const executeVerification = async (targetEmail, targetOtp) => {
    if (!targetEmail.trim()) {
      setErrorMessage('Please provide your account email address.');
      return;
    }
    const cleanOtp = targetOtp.trim().replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setErrorMessage('The verification code must be exactly 6 digits.');
      return;
    }

    setErrorMessage('');
    setInfoMessage('');

    try {
      await verifyMutation.mutateAsync({
        email: targetEmail.trim().toLowerCase(),
        otp: cleanOtp,
      });

      setSuccessMessage('Email verified successfully! Redirecting you to sign in...');
      setTimeout(() => {
        navigate(`/login?email=${encodeURIComponent(targetEmail.trim().toLowerCase())}&verified=1`);
      }, 1500);
    } catch (err) {
      setErrorMessage(err.message || 'Verification failed. Please check the code and try again.');
    }
  };

  // If email and OTP are both present in URL query params on initial mount, auto-verify!
  useEffect(() => {
    if (urlEmail && urlOtp && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      executeVerification(urlEmail, urlOtp);
    }
  }, [urlEmail, urlOtp]);

  const handleOtpChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(rawVal);
    if (errorMessage) setErrorMessage('');
    if (rawVal.length === 6 && email.trim()) {
      executeVerification(email, rawVal);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      setOtp(pastedData);
      if (pastedData.length === 6 && email.trim()) {
        executeVerification(email, pastedData);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    executeVerification(email, otp);
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setErrorMessage('Please specify your email to resend the code.');
      return;
    }

    try {
      setErrorMessage('');
      const res = await resendMutation.mutateAsync({ email: email.trim().toLowerCase() });
      setInfoMessage(res?.message || 'A fresh 6-digit code has been dispatched to your email.');
      setResendCooldown(45);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend code. Please try again later.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <header className="auth-header">
          <div className="auth-icon-circle">✉️</div>
          <h1 className="auth-title">Verify your email</h1>
          <p className="auth-subtitle">
            Enter the 6-digit verification code sent to your inbox.
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
            <label htmlFor="verifyEmail">Account Email</label>
            <input
              id="verifyEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="otpCode">6-Digit Verification Code</label>
            <div className="otp-input-wrapper">
              <input
                id="otpCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={handleOtpChange}
                onPaste={handlePaste}
                placeholder="••••••"
                className="otp-code-input"
                autoFocus
                required
              />
            </div>
            <p className="input-hint">You can type or paste the 6-digit code here.</p>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={verifyMutation.isPending || successMessage !== ''}
          >
            {verifyMutation.isPending ? 'Verifying code…' : 'Verify Account →'}
          </button>
        </form>

        <div className="resend-section">
          <p>Didn't receive the email?</p>
          <button
            type="button"
            onClick={handleResend}
            className="btn-link"
            disabled={resendMutation.isPending || resendCooldown > 0}
          >
            {resendCooldown > 0
              ? `Resend available in ${resendCooldown}s`
              : resendMutation.isPending
              ? 'Sending code…'
              : 'Resend 6-digit code'}
          </button>
        </div>

        <footer className="auth-footer">
          <p>
            Already verified?{' '}
            <Link to="/login" className="auth-link">Return to login</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
