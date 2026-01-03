import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/apiConfig';
import '../styles-super-admin-dashboard.css';

const SuperAdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data.users || res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && user.isActive !== false) ||
        (statusFilter === 'inactive' && user.isActive === false);
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const userStats = useMemo(() => {
    const total = users.length;
    const superAdmins = users.filter(u => u.role === 'SuperAdmin').length;
    const tournamentAdmins = users.filter(u => u.role === 'TournamentAdmin').length;
    const activeUsers = users.filter(u => u.isActive !== false).length;
    
    return { total, superAdmins, tournamentAdmins, activeUsers };
  }, [users]);

  const handleToggleUserStatus = async (user) => {
    if (!window.confirm(`Are you sure you want to ${user.isActive === false ? 'activate' : 'deactivate'} this user?`)) {
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/users/${user._id}/toggle-status`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating user status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (user) => {
    const newPassword = window.prompt('Enter new password for this user (minimum 6 characters):');
    if (!newPassword || newPassword.length < 6) {
      if (newPassword) alert('Password must be at least 6 characters');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/users/${user._id}/reset-password`, 
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      alert('Password reset successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Error resetting password');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.role === 'SuperAdmin') {
      alert('Cannot delete Super Admin users');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${user.username || user.email}? This action cannot be undone.`)) {
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/users/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting user');
    } finally {
      setActionLoading(false);
    }
  };

  const viewUserDetails = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'SuperAdmin': return 'role-badge--superadmin';
      case 'TournamentAdmin': return 'role-badge--admin';
      default: return 'role-badge--user';
    }
  };

  return (
    <div className="super-admin-page users-page">
      {/* Hero Section */}
      <section className="surface-card users-hero">
        <div className="users-hero-content">
          <span className="users-hero-eyebrow">👥 User Management</span>
          <h1>Platform Users</h1>
          <p>Manage all user accounts, roles, and permissions across the PlayLive platform. Monitor activity and maintain security.</p>
        </div>
        <div className="users-hero-stats">
          <div className="users-stat">
            <strong>{userStats.total}</strong>
            <span>Total Users</span>
          </div>
          <div className="users-stat">
            <strong>{userStats.superAdmins}</strong>
            <span>Super Admins</span>
          </div>
          <div className="users-stat">
            <strong>{userStats.tournamentAdmins}</strong>
            <span>Tournament Admins</span>
          </div>
          <div className="users-stat">
            <strong>{userStats.activeUsers}</strong>
            <span>Active Users</span>
          </div>
        </div>
      </section>

      {/* Filters & Search Panel */}
      <section className="surface-card users-filters-panel">
        <div className="users-filters-row">
          <div className="users-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name, username, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="users-search-input"
            />
          </div>
          <div className="users-filter-group">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="users-filter-select"
            >
              <option value="all">All Roles</option>
              <option value="SuperAdmin">Super Admin</option>
              <option value="TournamentAdmin">Tournament Admin</option>
            </select>
          </div>
          <div className="users-filter-group">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="users-filter-select"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button className="users-btn users-btn--secondary" onClick={fetchUsers}>
            🔄 Refresh
          </button>
        </div>
      </section>

      {/* Users Table */}
      <section className="surface-card users-table-panel">
        <div className="panel-header minimal">
          <div>
            <p className="panel-eyebrow">User Directory</p>
            <h3>{filteredUsers.length} Users Found</h3>
          </div>
        </div>

        {loading ? (
          <div className="users-loading">
            <div className="loading-spinner-modern"></div>
            <p>Loading users...</p>
          </div>
        ) : error ? (
          <div className="users-error">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
            <button onClick={fetchUsers} className="users-btn users-btn--primary">Retry</button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="users-empty">
            <span className="empty-icon">👥</span>
            <p>No users found matching your criteria</p>
            <button onClick={() => { setSearchQuery(''); setRoleFilter('all'); setStatusFilter('all'); }} className="users-btn users-btn--secondary">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="users-table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user._id}>
                    <td className="users-cell-user">
                      <div className="user-avatar">
                        {(user.username || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="user-info">
                        <span className="user-name">{user.username || user.name || 'Unknown'}</span>
                        <span className="user-email">{user.email || 'No email'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                        {user.role || 'User'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${user.isActive === false ? 'status-badge--inactive' : 'status-badge--active'}`}>
                        {user.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="users-cell-date">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="users-cell-date">
                      {formatDate(user.lastLogin)}
                    </td>
                    <td className="users-cell-actions">
                      <div className="users-actions-group">
                        <button 
                          className="users-action-btn" 
                          title="View Details"
                          onClick={() => viewUserDetails(user)}
                        >
                          👁️
                        </button>
                        <button 
                          className="users-action-btn" 
                          title="Reset Password"
                          onClick={() => handleResetPassword(user)}
                          disabled={actionLoading}
                        >
                          🔑
                        </button>
                        <button 
                          className="users-action-btn" 
                          title={user.isActive === false ? 'Activate' : 'Deactivate'}
                          onClick={() => handleToggleUserStatus(user)}
                          disabled={actionLoading}
                        >
                          {user.isActive === false ? '✅' : '⏸️'}
                        </button>
                        {user.role !== 'SuperAdmin' && (
                          <button 
                            className="users-action-btn users-action-btn--danger" 
                            title="Delete User"
                            onClick={() => handleDeleteUser(user)}
                            disabled={actionLoading}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="users-modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="users-modal" onClick={(e) => e.stopPropagation()}>
            <div className="users-modal-header">
              <h3>User Details</h3>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>×</button>
            </div>
            <div className="users-modal-body">
              <div className="user-detail-avatar">
                {(selectedUser.username || selectedUser.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="user-detail-row">
                <span className="detail-label">Username</span>
                <span className="detail-value">{selectedUser.username || 'N/A'}</span>
              </div>
              <div className="user-detail-row">
                <span className="detail-label">Email</span>
                <span className="detail-value">{selectedUser.email || 'N/A'}</span>
              </div>
              <div className="user-detail-row">
                <span className="detail-label">Name</span>
                <span className="detail-value">{selectedUser.name || selectedUser.fullName || 'N/A'}</span>
              </div>
              <div className="user-detail-row">
                <span className="detail-label">Role</span>
                <span className={`role-badge ${getRoleBadgeClass(selectedUser.role)}`}>
                  {selectedUser.role || 'User'}
                </span>
              </div>
              <div className="user-detail-row">
                <span className="detail-label">Status</span>
                <span className={`status-badge ${selectedUser.isActive === false ? 'status-badge--inactive' : 'status-badge--active'}`}>
                  {selectedUser.isActive === false ? 'Inactive' : 'Active'}
                </span>
              </div>
              <div className="user-detail-row">
                <span className="detail-label">Created</span>
                <span className="detail-value">{formatDate(selectedUser.createdAt)}</span>
              </div>
              <div className="user-detail-row">
                <span className="detail-label">Last Login</span>
                <span className="detail-value">{formatDate(selectedUser.lastLogin)}</span>
              </div>
              {selectedUser.tournamentCode && (
                <div className="user-detail-row">
                  <span className="detail-label">Tournament</span>
                  <span className="detail-value">{selectedUser.tournamentCode}</span>
                </div>
              )}
            </div>
            <div className="users-modal-actions">
              <button 
                className="users-btn users-btn--secondary" 
                onClick={() => handleResetPassword(selectedUser)}
                disabled={actionLoading}
              >
                🔑 Reset Password
              </button>
              <button 
                className="users-btn users-btn--primary" 
                onClick={() => handleToggleUserStatus(selectedUser)}
                disabled={actionLoading}
              >
                {selectedUser.isActive === false ? '✅ Activate' : '⏸️ Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminUsers;

