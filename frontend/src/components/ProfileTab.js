import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/apiConfig';

const ProfileTab = ({ stats, tournaments }) => {
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).username : '',
    email: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).email : '',
    mobile: '+91 9744251422'
  });
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [systemInfo] = useState({
    appUrl: window.location.origin,
    version: 'v1.0.0',
    database: 'MongoDB (Local)'
  });

  const handleEditProfile = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/auth/update-profile`, {
        email: profileForm.email,
        mobile: profileForm.mobile
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('✅ Profile updated successfully');
      setShowEditProfileModal(false);
    } catch (err) {
      alert('❌ Error updating profile');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      alert('❌ Passwords do not match');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/auth/change-password`, {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.new
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('✅ Password changed successfully');
      setShowChangePasswordModal(false);
    } catch (err) {
      alert('❌ Error changing password');
    }
  };



  const handleResetSystem = async () => {
    if (resetConfirmText === 'RESET ALL USERS') {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_BASE_URL}/api/auth/full-reset`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          alert(`✅ System reset successfully!\n\nDeleted:\n- ${response.data.deleted?.tournaments || 0} tournaments\n- ${response.data.deleted?.players || 0} players\n- ${response.data.deleted?.teams || 0} teams\n- ${response.data.deleted?.users || 0} users\n- ${response.data.deleted?.auditLogs || 0} audit logs`);
          setShowResetModal(false);
          setResetConfirmText('');
          // Optionally reload the page to refresh the UI
          window.location.reload();
        } else {
          alert('❌ Error: ' + (response.data.message || 'System reset failed'));
        }
      } catch (err) {
        const errorMessage = err.response?.data?.message || err.message || 'Error resetting system';
        alert('❌ Error: ' + errorMessage);
        console.error('Reset system error:', err);
      }
    } else {
      alert('Confirmation text does not match. Please type "RESET ALL USERS" exactly.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  return (
    <>
      <div className="profile-section">
        <h2>Super Admin Profile</h2>

        {/* Animated Stats Row */}
        <div className="profile-stats">
          <div className="stat-item">
            <span className="stat-icon">🏆</span>
            <span className="stat-label">Total Tournaments</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">👥</span>
            <span className="stat-label">Teams</span>
            <span className="stat-value">{tournaments.reduce((acc, t) => acc + (t.teams?.length || 0), 0)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">👤</span>
            <span className="stat-label">Players</span>
            <span className="stat-value">{tournaments.reduce((acc, t) => acc + (t.players?.length || 0), 0)}</span>
          </div>
        </div>

        {/* Profile Card */}
        <div className="profile-card">
          <div className="profile-avatar">
            <img src="https://via.placeholder.com/120x120?text=Admin" alt="Profile" />
            <button className="change-picture-btn">Change Picture</button>
          </div>
          <div className="profile-details">
            <p><strong>Name:</strong> {profileForm.name}</p>
            <p><strong>Email:</strong> {profileForm.email}</p>
            <p><strong>Mobile:</strong> {profileForm.mobile}</p>
            <p><strong>Role:</strong> Super Admin</p>
            <p><strong>Joined On:</strong> 12-Feb-2026</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="profile-actions">
          <button className="btn btn-primary" onClick={() => setShowEditProfileModal(true)}>✏️ Edit Profile</button>
          <button className="btn btn-secondary" onClick={() => setShowChangePasswordModal(true)}>🔑 Change Password</button>
        </div>

        {/* System Settings */}
        <div className="system-settings">
          <h3>System Settings ⚙️</h3>
          <div className="system-info">
            <p><strong>🌐 App URL:</strong> {systemInfo.appUrl}</p>
            <p><strong>📦 Version:</strong> {systemInfo.version}</p>
            <p><strong>🗄️ Database:</strong> {systemInfo.database}</p>
          </div>
        </div>


        {/* Reset Controls */}
        <div className="reset-controls">
          <button className="btn btn-danger" onClick={() => setShowResetModal(true)}>🧩 Reset System</button>
        </div>

        {/* Logout Button */}
        <div className="logout-section">
          <button className="btn btn-danger logout-btn" onClick={handleLogout}>🚪 Logout</button>
        </div>
      </div>

      {/* Modals */}
      {showEditProfileModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>✏️ Edit Super Admin Profile</h3>
            <form onSubmit={handleEditProfile}>
              <label htmlFor="profile-name">Name:</label>
              <input id="profile-name" name="name" type="text" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required />
              <label htmlFor="profile-email">Email:</label>
              <input id="profile-email" name="email" type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} required />
              <label htmlFor="profile-mobile">Mobile:</label>
              <input id="profile-mobile" name="mobile" type="text" value={profileForm.mobile} onChange={(e) => setProfileForm({ ...profileForm, mobile: e.target.value })} required />
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditProfileModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">💾 Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChangePasswordModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>🔐 Change Password</h3>
            <form onSubmit={handleChangePassword}>
              <label htmlFor="current-password">Current Password:</label>
              <input id="current-password" name="currentPassword" type="password" value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} required />
              <label htmlFor="new-password">New Password:</label>
              <input id="new-password" name="newPassword" type="password" value={passwordForm.new} onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })} required />
              <label htmlFor="confirm-password">Confirm Password:</label>
              <input id="confirm-password" name="confirmPassword" type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} required />
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowChangePasswordModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">🔒 Update Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>⚠️ Confirm Full System Reset</h3>
            <p>This will permanently delete all tournaments, teams, players, and tournament admins.</p>
            <p>Only the Super Admin profile will remain.</p>
            <label htmlFor="reset-confirm-text">Type RESET ALL USERS to confirm:</label>
            <input id="reset-confirm-text" name="resetConfirmText" type="text" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)} />
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowResetModal(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleResetSystem}>🔴 Confirm Reset</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileTab;
