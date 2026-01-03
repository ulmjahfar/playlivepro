import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles-system-status.css';

const SystemStatus = () => {
  const [systemStatus, setSystemStatus] = useState({
    database: 'checking',
    server: 'checking'
  });

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      // Mock system status - in real app, implement actual health checks
      setSystemStatus({
        database: 'healthy',
        server: 'healthy'
      });
    } catch (error) {
      console.error('Error fetching system status:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return '🟢';
      case 'warning': return '🟡';
      case 'error': return '🔴';
      default: return '⚪';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="system-status-modern">
      <div className="system-status-header">
        <div className="header-content">
          <div className="header-icon">🔧</div>
          <div className="header-text">
            <h2>System Status</h2>
            <p>Monitor system health</p>
          </div>
        </div>
      </div>

      <div className="status-overview">
        <div className="status-cards-grid">
          <div className="status-card-modern">
            <div className="card-header">
              <div className="status-indicator">
                <span className="status-dot" data-status={systemStatus.database}></span>
                <span className="status-icon">{getStatusIcon(systemStatus.database)}</span>
              </div>
              <h3>Database</h3>
            </div>
            <div className="card-content">
              <p className="status-message">
                {systemStatus.database === 'healthy' ? 'Connected & Healthy' :
                 systemStatus.database === 'warning' ? 'Minor Issues Detected' : 'Connection Error'}
              </p>
              <div className="status-details">
                <span className="detail-label">Last Check:</span>
                <span className="detail-value">{formatDate(new Date())}</span>
              </div>
            </div>
          </div>

          <div className="status-card-modern">
            <div className="card-header">
              <div className="status-indicator">
                <span className="status-dot" data-status={systemStatus.server}></span>
                <span className="status-icon">{getStatusIcon(systemStatus.server)}</span>
              </div>
              <h3>Server</h3>
            </div>
            <div className="card-content">
              <p className="status-message">
                {systemStatus.server === 'healthy' ? 'Running Smoothly' : 'Performance Issues'}
              </p>
              <div className="status-details">
                <span className="detail-label">Uptime:</span>
                <span className="detail-value">99.9%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemStatus;
