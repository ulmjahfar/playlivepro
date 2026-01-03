import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/apiConfig';
import '../styles-super-admin-dashboard.css';

const SuperAdminAudit = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    tournamentCode: '',
    action: '',
    entityType: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      };

      const res = await axios.get(`${API_BASE_URL}/api/audit`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setLogs(res.data.logs || []);
      setPagination(prev => ({
        ...prev,
        total: res.data.pagination?.total || 0,
        pages: res.data.pagination?.pages || 0
      }));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching audit logs');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchLogs();
    // Record audit page access with MAC address
    recordPageAccess();
  }, [fetchLogs]);

  const recordPageAccess = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/audit/record-access`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      // Silently fail - don't interrupt user experience
      console.error('Error recording audit page access:', err);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleExport = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v));
      const queryString = new URLSearchParams(params).toString();
      
      window.open(
        `${API_BASE_URL}/api/audit/export?${queryString}`,
        '_blank'
      );
    } catch (err) {
      alert('Error exporting audit logs');
    }
  };

  const handleClearFilters = () => {
    setFilters({
      tournamentCode: '',
      action: '',
      entityType: '',
      startDate: '',
      endDate: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionColor = (action) => {
    if (action.includes('start') || action.includes('create')) return 'success';
    if (action.includes('end') || action.includes('delete')) return 'danger';
    if (action.includes('update') || action.includes('sold')) return 'info';
    return 'muted';
  };

  return (
    <div className="super-admin-page audit-page">
      {/* Hero Section */}
      <section className="surface-card audit-hero">
        <div className="audit-hero-content">
          <span className="audit-hero-eyebrow">🕵️ Audit Trail</span>
          <h1>System Audit Logs</h1>
          <p>Complete audit trail of all system actions. Track every change, monitor user activity, and ensure compliance with detailed logs.</p>
        </div>
        <div className="audit-hero-stats">
          <div className="audit-stat">
            <strong>{pagination.total}</strong>
            <span>Total Events</span>
          </div>
          <div className="audit-stat">
            <strong>{logs.filter(l => l.action?.includes('create')).length}</strong>
            <span>Creates</span>
          </div>
          <div className="audit-stat">
            <strong>{logs.filter(l => l.action?.includes('update')).length}</strong>
            <span>Updates</span>
          </div>
        </div>
      </section>

      {/* Filters Panel */}
      <section className="surface-card audit-filters-panel">
        <div className="panel-header minimal">
          <div>
            <p className="panel-eyebrow">Refine Results</p>
            <h3>Filters</h3>
          </div>
          <div className="filter-actions">
            <button className="audit-btn audit-btn--secondary" onClick={handleClearFilters}>
              Clear All
            </button>
            <button className="audit-btn audit-btn--primary" onClick={fetchLogs}>
              Apply Filters
            </button>
          </div>
        </div>
        
        <div className="audit-filters-grid">
          <div className="audit-filter-group">
            <label>Tournament Code</label>
            <input
              type="text"
              name="tournamentCode"
              value={filters.tournamentCode}
              onChange={handleFilterChange}
              placeholder="e.g., KPL2026"
              className="audit-input"
            />
          </div>
          <div className="audit-filter-group">
            <label>Action</label>
            <input
              type="text"
              name="action"
              value={filters.action}
              onChange={handleFilterChange}
              placeholder="e.g., auction:start"
              className="audit-input"
            />
          </div>
          <div className="audit-filter-group">
            <label>Entity Type</label>
            <select
              name="entityType"
              value={filters.entityType}
              onChange={handleFilterChange}
              className="audit-input"
            >
              <option value="">All Entities</option>
              <option value="Tournament">Tournament</option>
              <option value="Player">Player</option>
              <option value="Team">Team</option>
              <option value="User">User</option>
              <option value="Auction">Auction</option>
            </select>
          </div>
          <div className="audit-filter-group">
            <label>Start Date</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="audit-input"
            />
          </div>
          <div className="audit-filter-group">
            <label>End Date</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="audit-input"
            />
          </div>
        </div>
      </section>

      {/* Logs Table */}
      <section className="surface-card audit-logs-panel">
        <div className="panel-header minimal">
          <div>
            <p className="panel-eyebrow">Activity Log</p>
            <h3>Recent Events</h3>
          </div>
          <div className="audit-table-actions">
            <button className="audit-btn audit-btn--secondary" onClick={handleExport}>
              📥 Export CSV
            </button>
            <div className="audit-pagination">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="audit-btn audit-btn--ghost"
              >
                ← Previous
              </button>
              <span className="audit-page-info">
                Page {pagination.page} of {pagination.pages || 1}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                disabled={pagination.page >= pagination.pages}
                className="audit-btn audit-btn--ghost"
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="audit-loading">
            <div className="loading-spinner-modern"></div>
            <p>Loading audit logs...</p>
          </div>
        ) : error ? (
          <div className="audit-error">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
            <button onClick={fetchLogs} className="audit-btn audit-btn--primary">Retry</button>
          </div>
        ) : logs.length === 0 ? (
          <div className="audit-empty">
            <span className="empty-icon">📋</span>
            <p>No audit logs found matching your criteria</p>
            <button onClick={handleClearFilters} className="audit-btn audit-btn--secondary">Clear Filters</button>
          </div>
        ) : (
          <div className="audit-table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Tournament</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>IP Address</th>
                  <th>MAC Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log._id || idx}>
                    <td className="audit-cell-timestamp">
                      {formatDate(log.timestamp)}
                    </td>
                    <td>
                      <span className={`audit-action-badge audit-action-badge--${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="audit-cell-entity">
                      <span className="entity-type">{log.entityType}</span>
                      {log.entityName && <span className="entity-name">{log.entityName}</span>}
                    </td>
                    <td className="audit-cell-code">
                      {log.tournamentCode || '—'}
                    </td>
                    <td className="audit-cell-user">
                      {log.username || 'System'}
                    </td>
                    <td className="audit-cell-role">
                      <span className={`role-badge role-badge--${(log.userRole || 'system').toLowerCase()}`}>
                        {log.userRole || 'System'}
                      </span>
                    </td>
                    <td className="audit-cell-ip">
                      {log.ipAddress || '—'}
                    </td>
                    <td className="audit-cell-mac">
                      {log.macAddress || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default SuperAdminAudit;

