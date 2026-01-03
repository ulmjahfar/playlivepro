import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppLogo } from './hooks/useAppLogo';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-admin-login.css';

function TournamentAdminLogin() {
  const [form, setForm] = useState({ username: '', password: '', rememberMe: false, role: 'TOURNAMENT_ADMIN' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logoUrl } = useAppLogo();

  useEffect(() => {
    const usernameInput = document.getElementById('username');
    if (usernameInput) usernameInput.focus();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const loginData = {
        username: form.username,
        password: form.password,
        role: form.role
      };
      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, loginData, {
        timeout: 5000 // 5 second timeout
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      if (res.data.tournamentCode) {
        localStorage.setItem('tournamentCode', res.data.tournamentCode);
      }
      if (form.rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      }
      setMessage(t('Login successful! Redirecting...'));
      setTimeout(() => navigate(res.data.redirectPath || '/dashboard/tournamentadmin'), 2000);
    } catch (err) {
      // Check if this is a network/connection error (backend not running)
      const isNetworkError = 
        err.code === 'ERR_NETWORK' || 
        err.code === 'ECONNREFUSED' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNABORTED' ||
        err.message === 'Network Error' ||
        (err.message && err.message.includes('ERR_CONNECTION_REFUSED')) ||
        (err.message && err.message.includes('timeout'));
      
      let errorMessage;
      if (isNetworkError) {
        errorMessage = 'Unable to connect to server. Please ensure the backend server is running on port 5000.';
      } else {
        errorMessage = err.response?.data?.message || t('Incorrect username or password.');
      }
      
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  return (
    <div className="tournament-admin-login">
      {/* Animated Background */}
      <div className="tal-background">
        <div className="tal-gradient-orb tal-orb-1"></div>
        <div className="tal-gradient-orb tal-orb-2"></div>
        <div className="tal-gradient-orb tal-orb-3"></div>
        <div className="tal-grid-pattern"></div>
      </div>

      {/* Main Layout */}
      <div className="tal-layout">
        {/* Hero Section (Left/Bottom) */}
        <div className="tal-hero">
          <div className="tal-hero-content">
            <div className="tal-brand">
              {logoUrl ? (
                <img src={logoUrl} alt="PlayLive Logo" className="tal-logo" />
              ) : (
                <img src="/logo192.png" alt="PlayLive Logo" className="tal-logo" />
              )}
            </div>
            <h1 className="tal-title">PlayLive</h1>
            <p className="tal-subtitle">TOURNAMENT MANAGEMENT SYSTEM</p>
            <div className="tal-divider"></div>
            <p className="tal-description">
              Streamline your tournaments with powerful tools for auction management, 
              team coordination, and real-time analytics.
            </p>
            <div className="tal-features">
              <span className="tal-feature">⚡ Live Auctions</span>
              <span className="tal-feature">📊 Analytics</span>
              <span className="tal-feature">🏆 Tournaments</span>
            </div>
          </div>
          <div className="tal-footer">
            <p>© 2025 PlayLive. {t('All rights reserved.')}</p>
          </div>
        </div>

        {/* Login Section (Top Right) */}
        <div className="tal-login-area">
          <div className="tal-login-card">
            <div className="tal-card-header">
              <div className="tal-admin-badge">
                <span>🎯</span>
                <span>TOURNAMENT ADMIN</span>
              </div>
              <h2>Welcome Back</h2>
              <p>Sign in to access the tournament dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="tal-form">
              <div className="tal-field">
                <label htmlFor="role">👤 Role</label>
                <select
                  id="role"
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  required
                  className="tal-select"
                >
                  <option value="TOURNAMENT_ADMIN">Tournament Admin</option>
                  <option value="TOURNAMENT_MANAGER">Tournament Manager</option>
                  <option value="AUCTION_CONTROLLER">Auction Controller</option>
                </select>
              </div>

              <div className="tal-fields-row">
                <div className="tal-field">
                  <label htmlFor="username">👤 Username</label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    placeholder={t('Enter your username')}
                    onChange={handleChange}
                    required
                    autoComplete="username"
                  />
                </div>

                <div className="tal-field">
                  <label htmlFor="password">🔐 Password</label>
                  <div className="tal-password-wrap">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('Enter your password')}
                      onChange={handleChange}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="tal-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="tal-options">
                <label className="tal-checkbox">
                  <input
                    name="rememberMe"
                    type="checkbox"
                    checked={form.rememberMe}
                    onChange={handleChange}
                  />
                  <span className="tal-checkmark"></span>
                  <span>{t('Keep me signed in')}</span>
                </label>
                <button type="button" onClick={handleForgotPassword} className="tal-forgot">
                  {t('Forgot Password?')}
                </button>
              </div>

              {message && (
                <div className={`tal-message ${message.includes('successful') ? 'tal-success' : 'tal-error'}`}>
                  <span>{message.includes('successful') ? '✅' : '⚠️'}</span>
                  <span>{message}</span>
                </div>
              )}

              <button type="submit" className="tal-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="tal-spinner"></span>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="tal-arrow">→</span>
                  </>
                )}
              </button>

              <div className="tal-security">
                <span>🔒</span>
                <span>Secured with 256-bit encryption</span>
              </div>
            </form>
          </div>

          <div className="tal-support">
            <span>{t('Need help?')}</span>
            <a href="mailto:playlive@gmail.com">📧 Email</a>
            <a href="https://wa.me/91XXXXXXXXXX" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TournamentAdminLogin;
