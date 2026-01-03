import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import BackButton from './components/BackButton';
import ImageUploadCrop from './components/ImageUploadCrop';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-settings.css';

function Settings() {
  const navigate = useNavigate();
  const [user] = useState(JSON.parse(localStorage.getItem('user')));
  const [activeTab, setActiveTab] = useState('general');
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    email: user?.email || '',
    theme: 'light',
    language: 'English',
    showUploadProgress: true,
    autoCompression: true,
    openCropAfterUpload: true,
    progressTheme: 'light'
  });
  const [message, setMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetConfirmation, setResetConfirmation] = useState('');

  const [resetProgress, setResetProgress] = useState(0);
  const [resetStatus, setResetStatus] = useState('');
  const [autoDeleteSettings, setAutoDeleteSettings] = useState({
    autoDeleteEnabled: false,
    autoDeleteDays: 45
  });
  const [autoDeleteLoading, setAutoDeleteLoading] = useState(false);
  const [autoDeleteMessage, setAutoDeleteMessage] = useState('');

  // Authentication check with browser back button protection
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (!token || !storedUser) {
        navigate('/login/super-admin', { replace: true });
        return;
      }
    };

    checkAuth();

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

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setMessage('❌ Passwords do not match');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/auth/change-password`, {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      }, { headers: { Authorization: `Bearer ${token}` } });
      setMessage('✅ Password changed successfully');
    } catch (err) {
      setMessage('❌ Error changing password');
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/auth/update-profile`, {
        email: form.email
      }, { headers: { Authorization: `Bearer ${token}` } });
      setMessage('✅ Profile updated successfully');
    } catch (err) {
      setMessage('❌ Error updating profile');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };



  const handleFullReset = async () => {
    setResetStep(2);
    setResetProgress(0);
    setResetStatus('Starting system reset...');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/auth/full-reset`, {}, { headers: { Authorization: `Bearer ${token}` } });

      if (response.data.success) {
        // Simulate progress updates
        const progressSteps = [
          { progress: 10, status: 'Deleting tournaments...' },
          { progress: 30, status: 'Deleting players...' },
          { progress: 50, status: 'Deleting teams...' },
          { progress: 70, status: 'Deleting users...' },
          { progress: 90, status: 'Clearing uploaded files...' },
          { progress: 100, status: 'Reset complete!' }
        ];

        for (const step of progressSteps) {
          await new Promise(resolve => setTimeout(resolve, 500));
          setResetProgress(step.progress);
          setResetStatus(step.status);
        }

        setResetStep(3);
        setMessage(`✅ System reset completed! Deleted ${response.data.deleted?.tournaments || 0} tournaments, ${response.data.deleted?.players || 0} players, ${response.data.deleted?.teams || 0} teams, ${response.data.deleted?.users || 0} users, and ${response.data.deleted?.auditLogs || 0} audit logs.`);
      } else {
        setMessage('❌ Error: ' + (response.data.message || 'System reset failed'));
        setShowResetModal(false);
        setResetStep(1);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error during system reset';
      setMessage('❌ Error: ' + errorMessage);
      console.error('Reset system error:', err);
      setShowResetModal(false);
      setResetStep(1);
    }
  };

  // Load auto-delete settings
  useEffect(() => {
    if (user?.role === 'SuperAdmin') {
      const loadAutoDeleteSettings = async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get(`${API_BASE_URL}/api/auto-delete/settings`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data.success) {
            setAutoDeleteSettings(res.data.settings);
          }
        } catch (err) {
          console.error('Error loading auto-delete settings:', err);
        }
      };
      loadAutoDeleteSettings();
    }
  }, [user]);

  const handleAutoDeleteSettingsChange = async () => {
    setAutoDeleteLoading(true);
    setAutoDeleteMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(
        `${API_BASE_URL}/api/auto-delete/settings`,
        autoDeleteSettings,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setAutoDeleteMessage('✅ Auto-delete settings saved successfully');
        setAutoDeleteSettings(res.data.settings);
      }
    } catch (err) {
      setAutoDeleteMessage('❌ Error saving settings: ' + (err.response?.data?.message || err.message));
    } finally {
      setAutoDeleteLoading(false);
      setTimeout(() => setAutoDeleteMessage(''), 5000);
    }
  };

  const tabs = [
    { id: 'general', label: 'General Settings', icon: '🏠' },
    { id: 'theme', label: 'Theme Settings', icon: '🎨' },
    { id: 'system', label: 'System Controls', icon: '⚙️' },
    { id: 'notifications', label: 'Notification Settings', icon: '🔔' },
    { id: 'info', label: 'System Info', icon: 'ℹ️' }
  ];

  return (
    <div className="settings">
      <div className="dashboard-container">
        <div className="dashboard-header">
          <BackButton />
          <div className="logo">PlayLive</div>
          <div className="welcome">Settings</div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
        <div className="dashboard-main">
          <div className="settings-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="tab-content">
            {activeTab === 'general' && (
              <div className="settings-sections">
                <div className="settings-section">
                  <h3>Change Password</h3>
                  <form onSubmit={handlePasswordChange}>
                    <input name="currentPassword" type="password" placeholder="Current Password" onChange={handleChange} required />
                    <input name="newPassword" type="password" placeholder="New Password" onChange={handleChange} required />
                    <input name="confirmPassword" type="password" placeholder="Confirm New Password" onChange={handleChange} required />
                    <button type="submit" className="btn">Change Password</button>
                  </form>
                </div>
                <div className="settings-section">
                  <h3>Update Profile</h3>
                  <form onSubmit={handleProfileUpdate}>
                    <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
                    <div className="form-group">
                      <label>Profile Picture:</label>
                      <ImageUploadCrop
                        onImageSelect={(file) => setForm({ ...form, profilePicture: file })}
                        aspectRatio={1}
                        maxWidth={512}
                        quality={80}
                        uploadType="admin-profile"
                        placeholder="Click to upload profile picture"
                        maxSizeMB={1}
                      />
                    </div>
                    <button type="submit" className="btn">Update Profile</button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'theme' && (
              <div className="settings-sections">
                <div className="settings-section">
                  <h3>App Preferences</h3>
                  <label>Color Theme</label>
                  <select name="theme" value={form.theme} onChange={handleChange}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                  <label>Language</label>
                  <select name="language" value={form.language} onChange={handleChange}>
                    <option value="English">English</option>
                    <option value="Malayalam">Malayalam</option>
                  </select>
                </div>
                {user?.role === 'SuperAdmin' && (
                  <div className="settings-section">
                    <h3>🖼️ Image Upload Behavior</h3>
                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={form.showUploadProgress}
                          onChange={(e) => setForm({...form, showUploadProgress: e.target.checked})}
                        />
                        Show upload progress bar
                      </label>
                    </div>
                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={form.autoCompression}
                          onChange={(e) => setForm({...form, autoCompression: e.target.checked})}
                        />
                        Allow auto compression
                      </label>
                    </div>
                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={form.openCropAfterUpload}
                          onChange={(e) => setForm({...form, openCropAfterUpload: e.target.checked})}
                        />
                        Open crop window after upload
                      </label>
                    </div>
                    <div className="form-group">
                      <label>Progress theme</label>
                      <select
                        value={form.progressTheme}
                        onChange={(e) => setForm({...form, progressTheme: e.target.value})}
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}



            {activeTab === 'notifications' && (
              <div className="settings-sections">
                <div className="settings-section">
                  <h3>Email / WhatsApp Notifications</h3>
                  <p>Notification settings will be implemented here.</p>
                </div>
              </div>
            )}

            {activeTab === 'system' && user?.role === 'SuperAdmin' && (
              <div className="system-controls-section">
                <h2>⚙️ System Controls</h2>
                
                {/* Auto Delete Settings */}
                <div className="system-controls-card">
                  <h3>🗑️ Auto Delete System</h3>
                  <p>Automatically delete completed tournament data after a selectable number of days. This helps manage storage and keeps your system clean.</p>
                  
                  <div className="form-group" style={{ marginTop: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                      <input
                        type="checkbox"
                        checked={autoDeleteSettings.autoDeleteEnabled}
                        onChange={(e) => setAutoDeleteSettings({ ...autoDeleteSettings, autoDeleteEnabled: e.target.checked })}
                        style={{ width: '20px', height: '20px' }}
                      />
                      <strong>Enable Auto-Delete System</strong>
                    </label>
                    <p style={{ marginLeft: '30px', color: 'var(--text-secondary, #64748b)', fontSize: '14px' }}>
                      When enabled, completed tournaments will be automatically deleted after the selected number of days.
                    </p>
                  </div>

                  {autoDeleteSettings.autoDeleteEnabled && (
                    <div className="form-group" style={{ marginTop: '20px', marginLeft: '30px' }}>
                      <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
                        Auto Delete After Auction Completion:
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[30, 45, 60, 90].map((days) => (
                          <label key={days} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              type="radio"
                              name="autoDeleteDays"
                              value={days}
                              checked={autoDeleteSettings.autoDeleteDays === days}
                              onChange={(e) => setAutoDeleteSettings({ ...autoDeleteSettings, autoDeleteDays: parseInt(e.target.value) })}
                            />
                            <span>{days} Days {days === 45 && '(Recommended)'}</span>
                          </label>
                        ))}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="radio"
                            name="autoDeleteDays"
                            value="custom"
                            checked={![30, 45, 60, 90].includes(autoDeleteSettings.autoDeleteDays)}
                            onChange={() => {}}
                          />
                          <span>Custom: </span>
                          <input
                            type="number"
                            min="7"
                            value={![30, 45, 60, 90].includes(autoDeleteSettings.autoDeleteDays) ? autoDeleteSettings.autoDeleteDays : ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (val >= 7) {
                                setAutoDeleteSettings({ ...autoDeleteSettings, autoDeleteDays: val });
                              }
                            }}
                            placeholder="Days (min 7)"
                            style={{ width: '100px', padding: '5px' }}
                          />
                          <span>Days</span>
                        </label>
                      </div>
                      <p style={{ marginTop: '10px', color: 'var(--text-secondary, #64748b)', fontSize: '13px' }}>
                        ⚠️ Minimum allowed: 7 days. All tournament data (players, teams, files, reports) will be permanently deleted.
                      </p>
                    </div>
                  )}

                  {autoDeleteMessage && (
                    <p style={{ 
                      marginTop: '15px', 
                      padding: '10px', 
                      borderRadius: '5px',
                      backgroundColor: autoDeleteMessage.includes('✅') ? '#d1fae5' : '#fee2e2',
                      color: autoDeleteMessage.includes('✅') ? '#065f46' : '#991b1b'
                    }}>
                      {autoDeleteMessage}
                    </p>
                  )}

                  <div style={{ marginTop: '20px' }}>
                    <button
                      className="btn"
                      onClick={handleAutoDeleteSettingsChange}
                      disabled={autoDeleteLoading}
                      style={{ 
                        backgroundColor: '#3b82f6', 
                        color: 'white', 
                        padding: '10px 20px',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: autoDeleteLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {autoDeleteLoading ? 'Saving...' : '💾 Save Auto Delete Settings'}
                    </button>
                  </div>
                </div>

                {/* Full System Reset */}
                <div className="system-controls-card" style={{ marginTop: '30px' }}>
                  <h3>🔥 Full System Reset</h3>
                  <p>Perform a complete factory reset of the entire PlayLive system. This will permanently delete all tournaments, users, teams, players, and uploaded files.</p>
                  <div className="reset-button-container">
                    <button className="reset-button" onClick={() => setShowResetModal(true)}>
                      🔥 Reset & Delete All Data (Full System Factory Reset)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'info' && (
              <div className="settings-sections">
                <div className="settings-section">
                  <h3>Server & Version Details</h3>
                  <p>System information will be displayed here.</p>
                </div>
              </div>
            )}
          </div>



          {showResetModal && (
            <div className="reset-modal-overlay">
              <div className="reset-modal">
                {resetStep === 1 && (
                  <>
                    <div className="reset-modal-header">
                      <h3>⚠️ Confirm Full System Reset</h3>
                    </div>
                    <div className="reset-modal-content">
                      <p>This will <strong>PERMANENTLY delete</strong>:</p>
                      <ul>
                        <li>All tournaments and tournament admins</li>
                        <li>All players and teams</li>
                        <li>All user accounts</li>
                        <li>All uploaded logos and player images</li>
                        <li>All auction data and reports</li>
                      </ul>
                      <p>This cannot be undone.</p>
                      <div className="reset-confirmation">
                        <label>To confirm, type: <strong>RESET ALL USERS</strong></label>
                        <input
                          type="text"
                          value={resetConfirmation}
                          onChange={(e) => setResetConfirmation(e.target.value)}
                          placeholder="Type here to confirm"
                        />

                      </div>
                    </div>
                    <div className="reset-modal-actions">
                      <button
                        className="btn danger"
                        disabled={resetConfirmation !== 'RESET ALL USERS'}
                        onClick={handleFullReset}
                      >
                        🔥 Confirm & Delete Everything
                      </button>
                      <button className="btn" onClick={() => { setShowResetModal(false); setResetConfirmation(''); }}>❌ Cancel</button>
                    </div>
                  </>
                )}

                {resetStep === 2 && (
                  <>
                    <div className="reset-modal-header">
                      <h3>🧹 Wiping Data Securely...</h3>
                    </div>
                    <div className="reset-modal-content">
                      <div className="progress-container">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${resetProgress}%` }}></div>
                        </div>
                        <p>{resetStatus}</p>
                        <p className="progress-text">Do not close this window until process completes.</p>
                      </div>
                    </div>
                  </>
                )}

                {resetStep === 3 && (
                  <>
                    <div className="reset-modal-header success">
                      <h3>✅ System Reset Complete!</h3>
                    </div>
                    <div className="reset-modal-content">
                      <p>All tournaments, players, and user accounts have been deleted.</p>
                      <p>The system has been restored to PlayLive's default configuration.</p>
                      <p><strong>Remaining User:</strong> 👑 Super Admin — {user?.email}</p>
                    </div>
                    <div className="reset-modal-actions">
                      <button className="btn primary" onClick={() => window.location.reload()}>🔄 Restart Application</button>
                      <button className="btn" onClick={() => { setShowResetModal(false); setResetStep(1); setResetConfirmation(''); }}>OK</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {message && (
            <p className={`message ${message.includes('❌') ? 'error' : 'success'}`}>{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
