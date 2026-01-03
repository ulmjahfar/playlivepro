import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useAppLogo } from './hooks/useAppLogo';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-super-admin-login.css';

function SuperAdminLogin() {
  const [form, setForm] = useState({ username: '', password: '', rememberMe: false });
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
        role: 'SUPER_ADMIN'
      };
      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, loginData, {
        timeout: 5000 // 5 second timeout
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      if (form.rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      }
      toast.success(t('Welcome, Super Admin.'));
      setTimeout(() => navigate(res.data.redirectPath || '/dashboard/superadmin'), 1000);
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
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  return (
    <div className="super-admin-login">
      {/* Animated Background */}
      <div className="sal-background">
        <div className="sal-gradient-orb sal-orb-1"></div>
        <div className="sal-gradient-orb sal-orb-2"></div>
        <div className="sal-gradient-orb sal-orb-3"></div>
        <div className="sal-grid-pattern"></div>
      </div>

      {/* Main Layout */}
      <div className="sal-layout">
        {/* Hero Section (Left/Bottom) */}
        <div className="sal-hero">
          <div className="sal-hero-content">
            <div className="sal-brand">
              {logoUrl ? (
                <img src={logoUrl} alt="PlayLive Logo" className="sal-logo" />
              ) : (
                <img src="/logo192.png" alt="PlayLive Logo" className="sal-logo" />
              )}
            </div>
            <h1 className="sal-title">PlayLive</h1>
            <p className="sal-subtitle">TOURNAMENT MANAGEMENT SYSTEM</p>
            <div className="sal-divider"></div>
            <p className="sal-description">
              Streamline your tournaments with powerful tools for auction management, 
              team coordination, and real-time analytics.
            </p>
            <div className="sal-features">
              <span className="sal-feature">⚡ Live Auctions</span>
              <span className="sal-feature">📊 Analytics</span>
              <span className="sal-feature">🏆 Tournaments</span>
            </div>
          </div>
          <div className="sal-footer">
            <p>© 2025 PlayLive. {t('All rights reserved.')}</p>
          </div>
        </div>

        {/* Login Section (Top Right) */}
        <div className="sal-login-area">
          <div className="sal-login-card">
            <div className="sal-card-header">
              <div className="sal-admin-badge">
                <span>🛡️</span>
                <span>SUPER ADMIN</span>
              </div>
              <h2>Welcome Back</h2>
              <p>Sign in to access the control center</p>
            </div>

            <form onSubmit={handleSubmit} className="sal-form">
              <div className="sal-fields-row">
                <div className="sal-field">
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

                <div className="sal-field">
                  <label htmlFor="password">🔐 Password</label>
                  <div className="sal-password-wrap">
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
                      className="sal-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="sal-options">
                <label className="sal-checkbox">
                  <input
                    name="rememberMe"
                    type="checkbox"
                    checked={form.rememberMe}
                    onChange={handleChange}
                  />
                  <span className="sal-checkmark"></span>
                  <span>{t('Keep me signed in')}</span>
                </label>
                <button type="button" onClick={handleForgotPassword} className="sal-forgot">
                  {t('Forgot Password?')}
                </button>
              </div>

              {message && (
                <div className="sal-error">
                  <span>⚠️</span>
                  <span>{message}</span>
                </div>
              )}

              <button type="submit" className="sal-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="sal-spinner"></span>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="sal-arrow">→</span>
                  </>
                )}
              </button>

              <div className="sal-security">
                <span>🔒</span>
                <span>Secured with 256-bit encryption</span>
              </div>
            </form>
          </div>

          <div className="sal-support">
            <span>{t('Need help?')}</span>
            <a href="mailto:playlive@gmail.com">📧 Email</a>
            <a href="https://wa.me/91XXXXXXXXXX" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SuperAdminLogin;
