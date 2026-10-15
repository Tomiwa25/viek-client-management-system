import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { registerMutation } = useAuth();

  const [formData, setFormData] = useState({
    organizationName: '',
    fullName: '',
    email: '',
    confirmEmail: '',
    password: '',
    phone: '',
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  const validate = () => {
    const newErrors = {};

    if (!formData.organizationName.trim() || formData.organizationName.trim().length < 2) {
      newErrors.organizationName = 'Organization name must be at least 2 characters.';
    }

    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters.';
    }

    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please provide a valid email address.';
    }

    if (formData.email.trim().toLowerCase() !== formData.confirmEmail.trim().toLowerCase()) {
      newErrors.confirmEmail = 'Email addresses do not match.';
    }

    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) {
      setServerError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setServerError('');
    try {
      await registerMutation.mutateAsync({
        organizationName: formData.organizationName.trim(),
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      navigate(`/verify-email?email=${encodeURIComponent(formData.email.trim().toLowerCase())}`, {
        state: {
          email: formData.email.trim().toLowerCase(),
          message: 'Account created! Enter the 6-digit OTP code sent to your email to activate your account.',
        },
      });
    } catch (err) {
      setServerError(err.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <header className="auth-header">
          <span className="auth-brand-badge">CLIENTFLOW</span>
          <h1 className="auth-title">Create your workspace</h1>
          <p className="auth-subtitle">Get started with multi-tenant client management</p>
        </header>

        {serverError && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="organizationName">Organization / Company Name</label>
            <input
              id="organizationName"
              name="organizationName"
              type="text"
              placeholder="e.g. Acme Corporation"
              value={formData.organizationName}
              onChange={handleChange}
              className={errors.organizationName ? 'input-error' : ''}
              required
            />
            {errors.organizationName && <span className="field-error">{errors.organizationName}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="e.g. Jane Doe"
              value={formData.fullName}
              onChange={handleChange}
              className={errors.fullName ? 'input-error' : ''}
              required
            />
            {errors.fullName && <span className="field-error">{errors.fullName}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="email">Work Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'input-error' : ''}
                required
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmEmail">Confirm Work Email</label>
              <input
                id="confirmEmail"
                name="confirmEmail"
                type="email"
                placeholder="Repeat your email"
                value={formData.confirmEmail}
                onChange={handleChange}
                className={errors.confirmEmail ? 'input-error' : ''}
                required
              />
              {errors.confirmEmail && <span className="field-error">{errors.confirmEmail}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'input-error' : ''}
                required
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number <span className="label-optional">(Optional)</span></label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? 'Setting up workspace…' : 'Register Organization →'}
          </button>
        </form>

        <footer className="auth-footer">
          <p>
            Already have an organization?{' '}
            <Link to="/login" className="auth-link">Sign in here</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
