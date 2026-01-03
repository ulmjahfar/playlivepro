import React, { useState } from 'react';
import { copyToClipboard as copyToClipboardUtil } from '../utils/clipboard';
import '../styles-registration-links.css';

const RegistrationLinks = ({ tournaments }) => {
  const [copiedLink, setCopiedLink] = useState(null);
  const [expandedTournament, setExpandedTournament] = useState(null);
  const baseUrl = window.location.origin;

  const copyToClipboard = async (link) => {
    const success = await copyToClipboardUtil(link);
    if (success) {
      setCopiedLink(link);
      setTimeout(() => setCopiedLink(null), 2000);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return '#28a745';
      case 'Upcoming': return '#ffc107';
      case 'Completed': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const toggleExpand = (tournamentId) => {
    setExpandedTournament(expandedTournament === tournamentId ? null : tournamentId);
  };

  return (
    <div className="registration-links">
      <h3>Tournament Registration Links</h3>
      <div className="links-list">
        {tournaments.map(tournament => (
          <div key={tournament._id} className="link-item">
            <div className="tournament-header" onClick={() => toggleExpand(tournament._id)}>
              <h4>{tournament.name}</h4>
              <div className="header-right">
                <span
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(tournament.status) }}
                >
                  {tournament.status}
                </span>
                <span className={`expand-icon ${expandedTournament === tournament._id ? 'expanded' : ''}`}>▼</span>
              </div>
            </div>
            {expandedTournament === tournament._id && (
              <div className="link-details">
                <div className="link-section">
                  <label>Player Registration:</label>
                  <div className="link-input-group">
                    <input
                      type="text"
                      value={tournament.registrationLink || `${baseUrl}/register/${tournament.code}`}
                      readOnly
                    />
                    <button
                      onClick={() => copyToClipboard(tournament.registrationLink || `${baseUrl}/register/${tournament.code}`)}
                      className="copy-btn"
                    >
                      {copiedLink === (tournament.registrationLink || `${baseUrl}/register/${tournament.code}`) ? '✓' : '📋'}
                    </button>
                  </div>
                </div>

                <div className="link-section">
                  <label>Team Registration:</label>
                  <div className="link-input-group">
                    <input
                      type="text"
                      value={tournament.teamRegistrationLink || `${baseUrl}/register/team/${tournament.code}`}
                      readOnly
                    />
                    <button
                      onClick={() => copyToClipboard(tournament.teamRegistrationLink || `${baseUrl}/register/team/${tournament.code}`)}
                      className="copy-btn"
                    >
                      {copiedLink === (tournament.teamRegistrationLink || `${baseUrl}/register/team/${tournament.code}`) ? '✓' : '📋'}
                    </button>
                  </div>
                </div>

                <div className="tournament-meta">
                  <span>Code: {tournament.code}</span>
                  <span>Sport: {tournament.sport}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RegistrationLinks;
