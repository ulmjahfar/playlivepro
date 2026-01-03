import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-dashboard.css';

function AuditLogs() {
  const navigate = useNavigate();
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

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (!token || !storedUser) {
        navigate('/login/super-admin', { replace: true });
        return false;
      }
      
      try {
        const user = JSON.parse(storedUser);
        if (user.role !== 'SuperAdmin') {
          navigate('/dashboard/superadmin', { replace: true });
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

    fetchLogs();
  }, [navigate, pagination.page, filters, fetchLogs]);

  // Handle browser back button and cache restoration
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (!token || !storedUser) {
        navigate('/login/super-admin', { replace: true });
        return;
      }
      
      try {
        const user = JSON.parse(storedUser);
        if (user.role !== 'SuperAdmin') {
          navigate('/dashboard/superadmin', { replace: true });
          return;
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login/super-admin', { replace: true });
      }
    };

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
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching audit logs');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

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
    if (action.includes('start') || action.includes('create')) return '#10b981';
    if (action.includes('end') || action.includes('delete')) return '#ef4444';
    if (action.includes('update') || action.includes('sold')) return '#3b82f6';
    return '#94a3b8';
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Audit & History Logs</h1>
        <p>Complete audit trail of all system actions (SuperAdmin Only)</p>
      </div>

      <div className="dashboard-content">
        {/* Filters */}
        <div className="panel" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Filters</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Tournament Code</label>
              <input
                type="text"
                name="tournamentCode"
                value={filters.tournamentCode}
                onChange={handleFilterChange}
                placeholder="e.g., KPL2026"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #334155' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Action</label>
              <input
                type="text"
                name="action"
                value={filters.action}
                onChange={handleFilterChange}
                placeholder="e.g., auction:start"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #334155' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Entity Type</label>
              <input
                type="text"
                name="entityType"
                value={filters.entityType}
                onChange={handleFilterChange}
                placeholder="e.g., Tournament"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #334155' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Start Date</label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #334155' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>End Date</label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #334155' }}
              />
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
            <button
              onClick={fetchLogs}
              style={{
                padding: '10px 20px',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Apply Filters
            </button>
            <button
              onClick={handleExport}
              style={{
                padding: '10px 20px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>Audit Logs ({pagination.total} total)</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                style={{
                  padding: '8px 16px',
                  background: pagination.page === 1 ? '#334155' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: pagination.page === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Previous
              </button>
              <span style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                disabled={pagination.page >= pagination.pages}
                style={{
                  padding: '8px 16px',
                  background: pagination.page >= pagination.pages ? '#334155' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: pagination.page >= pagination.pages ? 'not-allowed' : 'pointer'
                }}
              >
                Next
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
          ) : error ? (
            <div style={{ color: '#ef4444', padding: '20px' }}>{error}</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No audit logs found</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1e293b', borderBottom: '2px solid #334155' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Timestamp</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Action</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Entity</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Tournament</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>User</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Role</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <tr key={log._id || idx} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#94a3b8' }}>
                        {formatDate(log.timestamp)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: getActionColor(log.action) + '20',
                          color: getActionColor(log.action),
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>
                        {log.entityType} {log.entityName && `- ${log.entityName}`}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#94a3b8' }}>
                        {log.tournamentCode || '-'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>
                        {log.username || 'System'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#94a3b8' }}>
                        {log.userRole || 'System'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#64748b', fontFamily: 'monospace' }}>
                        {log.ipAddress || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuditLogs;





