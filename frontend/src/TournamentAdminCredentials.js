import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-admin-credentials.css';

function TournamentAdminCredentials() {
  const { tournamentCode } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Authentication check with browser back button protection
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (!token || !storedUser) {
        navigate('/login/super-admin', { replace: true });
        return false;
      }
      
      try {
        const parsedUser = JSON.parse(storedUser);
        const normalizedRole = (parsedUser.role || '').toString().trim().replace(/[\s_]/g, '').toLowerCase();
        if (normalizedRole !== 'superadmin') {
          navigate('/login/super-admin', { replace: true });
          return false;
        }
        return true;
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login/super-admin', { replace: true });
        return false;
      }
    };

    if (!checkAuth()) {
      return;
    }

    const handlePageShow = (e) => {
      if (e.persisted) {
        checkAuth();
      }
    };

    const handleFocus = () => {
      checkAuth();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAuth();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate]);

  const loadAdminData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please login to access this page');
        navigate('/login/super-admin');
        return;
      }
      
      const response = await axios.get(
        `${API_BASE_URL}/api/users/admin-credentials/${tournamentCode}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        if (!response.data.admin || !response.data.tournament) {
          toast.warning('Tournament admin not assigned yet');
          setAdmin(null);
          setTournament(null);
          setErrorMessage(null);
        } else {
          setAdmin(response.data.admin);
          setTournament(response.data.tournament);
          setErrorMessage(null);
        }
      } else {
        const message = response.data.message || 'Failed to load admin credentials';
        toast.error(message);
        setErrorMessage(message);
        setAdmin(null);
        // Keep tournament info if available
        if (response.data.tournament) {
          setTournament(response.data.tournament);
        } else {
          setTournament(null);
        }
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to load admin credentials';
      toast.error(errorMsg);
      setErrorMessage(errorMsg);
      
      if (error.response?.status === 404) {
        setAdmin(null);
        // Keep tournament info if available in error response
        if (error.response?.data?.tournament) {
          setTournament(error.response.data.tournament);
        } else {
          setTournament(null);
        }
      } else if (error.response?.status === 401) {
        navigate('/login/super-admin');
      } else {
        setTournament(null);
      }
    } finally {
      setLoading(false);
    }
  }, [tournamentCode, navigate]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const copyToClipboard = async (text) => {
    if (!text || text === 'N/A') {
      toast.error('Nothing to copy');
      return;
    }
    
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            toast.success('Copied to clipboard!');
          } else {
            throw new Error('Copy command failed');
          }
        } catch (err) {
          toast.error('Failed to copy. Please select and copy manually.');
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('Failed to copy. Please select and copy manually.');
    }
  };


  if (loading) {
    return (
      <div className="credentials-loading">
        <div className="loading-spinner">⏳</div>
        <p>Loading admin credentials...</p>
      </div>
    );
  }

  if (!admin || !tournament) {
    return (
      <div className="credentials-error">
        <div className="error-content">
          <div className="error-icon">🔍</div>
          <h2>Admin Credentials Not Found</h2>
          <p>
            {errorMessage || `This tournament (${tournamentCode}) does not have an admin assigned yet, or the admin account was not found.`}
          </p>
          {tournament && (
            <div className="tournament-info-error">
              <p><strong>Tournament:</strong> {tournament.name}</p>
              <p><strong>Code:</strong> {tournament.code}</p>
            </div>
          )}
          <div className="error-actions">
            <button className="btn-primary" onClick={() => navigate('/dashboard/superadmin')}>
              ← Back to Dashboard
            </button>
            <button className="btn-secondary" onClick={loadAdminData}>
              🔄 Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const copyAllCredentials = () => {
    const baseUrl = window.location.origin;
    const loginUrl = `${baseUrl}/login/tournament-admin`;
    const credentials = `🎟️ Tournament Admin Credentials
───────────────────────────────
🏆 Tournament: ${tournament.name}
🏷️ Code: ${tournament.code}
👤 Username: ${admin.username}
📧 Email: ${admin.email || 'N/A'}
🔑 Password: ${admin.plainPassword || 'N/A'}
🧩 Role: Tournament Admin
───────────────────────────────
🔗 Login Link: ${loginUrl}
───────────────────────────────
© PlayLive 2025`;
    copyToClipboard(credentials);
  };

  return (
    <div className="credentials-modal-overlay" onClick={() => navigate('/dashboard/superadmin')}>
      <div className="credentials-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="credentials-modal-header">
          <div className="modal-header-left">
            <span className="modal-header-icon">🔒</span>
            <div className="modal-header-text">
              <h2>Admin Credentials</h2>
              <p>Secure access information for tournament administration</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={() => navigate('/dashboard/superadmin')}>
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="credentials-modal-content">
          {/* Tournament Information Section */}
          <div className="credentials-section">
            <div className="section-header-box">
              <span className="section-header-icon">🏆</span>
              <div className="section-header-text">
                <h3>Tournament Information</h3>
                <p>Basic tournament details</p>
              </div>
            </div>
            <div className="credentials-fields">
              <div className="credential-input-group">
                <label className="credential-label">
                  <span className="label-icon">🏆</span>
                  TOURNAMENT NAME
                </label>
                <div className="credential-input-wrapper">
                  <input 
                    type="text" 
                    className="credential-input" 
                    value={tournament.name} 
                    readOnly 
                  />
                  <button 
                    className="copy-field-btn" 
                    onClick={() => copyToClipboard(tournament.name)}
                    title="Copy tournament name"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="https://www.w3.org/2000/svg">
                      <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      <path d="M3 11V3C3 2.44772 3.44772 2 4 2H11" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="credential-input-group">
                <label className="credential-label">
                  <span className="label-icon">🏷️</span>
                  TOURNAMENT CODE
                </label>
                <div className="credential-input-wrapper">
                  <input 
                    type="text" 
                    className="credential-input code-input" 
                    value={tournament.code} 
                    readOnly 
                  />
                  <button 
                    className="copy-field-btn" 
                    onClick={() => copyToClipboard(tournament.code)}
                    title="Copy tournament code"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="https://www.w3.org/2000/svg">
                      <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      <path d="M3 11V3C3 2.44772 3.44772 2 4 2H11" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Access Credentials Section */}
          <div className="credentials-section">
            <div className="section-header-box">
              <span className="section-header-icon">🔒</span>
              <div className="section-header-text">
                <h3>Access Credentials</h3>
                <p>Login information for admin access</p>
              </div>
            </div>
            <div className="credentials-fields">
              <div className="credential-input-group">
                <label className="credential-label">
                  <span className="label-icon">👤</span>
                  USERNAME
                </label>
                <div className="credential-input-wrapper">
                  <input 
                    type="text" 
                    className="credential-input" 
                    value={admin.username} 
                    readOnly 
                  />
                  <button 
                    className="copy-field-btn" 
                    onClick={() => copyToClipboard(admin.username)}
                    title="Copy username"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="https://www.w3.org/2000/svg">
                      <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      <path d="M3 11V3C3 2.44772 3.44772 2 4 2H11" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="credential-input-group">
                <label className="credential-label">
                  <span className="label-icon">📧</span>
                  EMAIL ADDRESS
                </label>
                <div className="credential-input-wrapper">
                  <input 
                    type="text" 
                    className="credential-input" 
                    value={admin.email || ''} 
                    readOnly 
                  />
                  <button 
                    className="copy-field-btn" 
                    onClick={() => copyToClipboard(admin.email || '')}
                    title="Copy email"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="https://www.w3.org/2000/svg">
                      <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      <path d="M3 11V3C3 2.44772 3.44772 2 4 2H11" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="credential-input-group">
                <label className="credential-label">
                  <span className="label-icon">🔑</span>
                  PASSWORD
                </label>
                <div className="credential-input-wrapper">
                  {showPassword ? (
                    <input 
                      type="text"
                      className="credential-input" 
                      value={admin.plainPassword || 'N/A'} 
                      readOnly 
                    />
                  ) : (
                    <span className="credential-input password-masked">••••••••••••</span>
                  )}
                  <div className="password-actions-group">
                    <button
                      className="copy-field-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <button 
                      className="copy-field-btn" 
                      onClick={() => copyToClipboard(admin.plainPassword || '')}
                      title="Copy password"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="https://www.w3.org/2000/svg">
                        <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                        <path d="M3 11V3C3 2.44772 3.44772 2 4 2H11" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <div className="credential-input-group login-link-group">
                <label className="credential-label">
                  <span className="label-icon">🔗</span>
                  LOGIN LINK
                </label>
                <div className="credential-input-wrapper login-link-wrapper">
                  <input 
                    type="text" 
                    className="credential-input login-link-input" 
                    value={`${window.location.origin}/login/tournament-admin`} 
                    readOnly 
                  />
                  <div className="login-link-actions-group">
                    <button 
                      className="copy-field-btn" 
                      onClick={() => copyToClipboard(`${window.location.origin}/login/tournament-admin`)}
                      title="Copy login link"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="https://www.w3.org/2000/svg">
                        <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                        <path d="M3 11V3C3 2.44772 3.44772 2 4 2H11" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      </svg>
                    </button>
                    <a
                      href={`${window.location.origin}/login/tournament-admin`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="copy-field-btn login-link-btn"
                      title="Open login page in new tab"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="https://www.w3.org/2000/svg">
                        <path d="M13 2H11M13 2V4M13 2L8 7M4 2H2C1.44772 2 1 2.44772 1 3V14C1 14.5523 1.44772 15 2 15H13C13.5523 15 14 14.5523 14 14V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="credentials-modal-footer">
          <button className="copy-all-btn" onClick={copyAllCredentials}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="https://www.w3.org/2000/svg">
              <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M3 11V3C3 2.44772 3.44772 2 4 2H11" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
            Copy All Credentials
          </button>
          <button className="close-btn" onClick={() => navigate('/dashboard/superadmin')}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default TournamentAdminCredentials;

