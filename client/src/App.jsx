import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import PublicDashboard from './pages/PublicDashboard';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import VerifyResetCode from './pages/VerifyResetCode';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Clients from './pages/Clients';
import Tasks from './pages/Tasks';
import Projects from './pages/Projects';

function NotFound() {
  return (
    <div className="auth-container">
      <div className="auth-card not-found-card">
        <h1>404</h1>
        <h2>Page not found</h2>
        <p>The page you are looking for does not exist or has been moved.</p>
        <Link to="/" className="btn btn-primary">Return to Dashboard</Link>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { token } = useAuth();

  return (
    <Routes>
      {/* Root Route: If authenticated, renders active tenant Dashboard; if visitor, renders Public Platform Showcase */}
      <Route
        path="/"
        element={
          token ? (
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          ) : (
            <PublicDashboard />
          )
        }
      />

      {/* Protected workspace views wrapped in top-nav AppLayout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/leads" element={<Leads />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/team" element={<Team />} />
      </Route>

      {/* Public platform overview & blueprint showcase */}
      <Route path="/overview" element={<PublicDashboard />} />

      {/* Public auth views */}
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-reset-code" element={<VerifyResetCode />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

