import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { loginMutation } = useAuth();

  const urlEmail = searchParams.get('email') || '';
  const isVerifiedBanner = searchParams.get('verified') === '1';

  const [email, setEmail] = useState(urlEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isUnverified, setIsUnverified] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setErrorMessage('');
    setIsUnverified(false);

    try {
      await loginMutation.mutateAsync({
        email: email.trim().toLowerCase(),
        password,
        rememberMe,
      });

      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      if (err.code === 'UNVERIFIED_EMAIL') {
        setIsUnverified(true);
        setErrorMessage('Your email address has not been verified yet.');
      } else {
        setErrorMessage(err.message || 'Invalid email or password.');
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <header className="auth-header">
          <span className="auth-brand-badge">CLIENTFLOW</span>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to your organization workspace</p>
        </header>

        {isVerifiedBanner && (
          <div className="alert alert-success" role="status">
            <span className="alert-icon">✓</span>
            <span>Your email was successfully verified! Please sign in with your credentials.</span>
          </div>
        )}

        {errorMessage && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <div>
              <p>{errorMessage}</p>
              {isUnverified && (
                <Link
                  to={`/verify-email?email=${encodeURIComponent(email)}`}
                  className="alert-action-link"
                >
                  Verify your email now →
                </Link>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="loginEmail">Email Address</label>
            <input
              id="loginEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoFocus={!urlEmail}
            />
          </div>

          <div className="form-group">
            <div className="label-with-link">
              <label htmlFor="loginPassword">Password</label>
            </div>
            <input
              id="loginPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoFocus={Boolean(urlEmail)}
            />
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember me for 30 days</span>
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? 'Authenticating…' : 'Sign In →'}
          </button>
        </form>

        <footer className="auth-footer">
          <p>
            Don't have an organization workspace yet?{' '}
            <Link to="/register" className="auth-link">Create one</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
