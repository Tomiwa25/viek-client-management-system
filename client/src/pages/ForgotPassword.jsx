import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your account email address.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await authApi.forgotPassword({ email: email.trim().toLowerCase() });
      navigate(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`, {
        state: {
          email: email.trim().toLowerCase(),
          message: 'If an account exists, a 6-digit password reset code has been dispatched to your email.',
        },
      });
    } catch (err) {
      setErrorMessage(err.message || 'Failed to send password reset code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <header className="auth-header">
          <div className="auth-icon-circle">🔑</div>
          <h1 className="auth-title">Forgot your password?</h1>
          <p className="auth-subtitle">
            Enter your account email and we'll send you a 6-digit reset code.
          </p>
        </header>

        {errorMessage && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="forgotEmail">Account Email Address</label>
            <input
              id="forgotEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending reset code…' : 'Send Reset Code →'}
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
