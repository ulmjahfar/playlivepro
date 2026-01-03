import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-view.css';

function TournamentView() {
  const { code } = useParams();

  const getRegistrationLink = useCallback(() => {
    // Always construct dynamically from current origin to avoid localhost issues
    return `${window.location.origin}/register/${code}`;
  }, [code]);
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [players, setPlayers] = useState([]);
  // Removed unused teams state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [toast, setToast] = useState(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [playerRegistrationLocked, setPlayerRegistrationLocked] = useState(false);
  const [teamRegistrationLocked, setTeamRegistrationLocked] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');

        // Fetch tournament details
        const tournamentResponse = await axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTournament(tournamentResponse.data.tournament);

        // Set admin details from populated tournament data
        if (tournamentResponse.data.tournament.adminId) {
          setAdmin(tournamentResponse.data.tournament.adminId);
        }

        // Fetch registered players
        const playersResponse = await axios.get(`${API_BASE_URL}/api/players/${code}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPlayers(playersResponse.data.players);

        // Fetch teams (assuming endpoint exists, else placeholder)
        // const teamsResponse = await axios.get(`${API_BASE_URL}/api/teams/${code}`, { headers: { Authorization: `Bearer ${token}` } });
        // setTeams(teamsResponse.data.teams || []);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load tournament details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [code]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  };

  const shareLink = async (link) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tournament Registration', url: link });
      } catch (error) {
        // User cancelled or share failed - this is normal, don't show error
        if (error.name !== 'AbortError') {
          console.error('Share failed:', error);
          // Fallback to WhatsApp if share fails
          window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, '_blank');
        }
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, '_blank');
    }
  };

  const lockRegistration = (type) => {
    if (type === 'Player') {
      setPlayerRegistrationLocked(true);
      showToast('Player registration locked.', 'warning');
    } else if (type === 'Team') {
      setTeamRegistrationLocked(true);
      showToast('Team registration locked.', 'warning');
    }
  };

  const downloadPDF = () => {
    // Placeholder for PDF download
    showToast('PDF download not implemented yet.', 'error');
  };

  const handleStatusChange = async (newStatus) => {
    if (isUpdatingStatus) return;
    
    setIsUpdatingStatus(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_BASE_URL}/api/tournaments/${code}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setTournament(response.data.tournament);
        showToast(`Tournament status updated to ${newStatus}`, 'success');
      } else {
        showToast('Failed to update status', 'error');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showToast(error.response?.data?.message || 'Failed to update tournament status', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading tournament details...</div>;
  }

  if (error || !tournament) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error || 'Tournament not found'}</p>
        <button onClick={() => navigate('/dashboard/superadmin')} className="btn btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const maxFundPerTeam = 20000; // Placeholder, calculate from auction rules if possible

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            {/* Summary Cards */}
            <div className="summary-cards">
              <div className="summary-card">
                <div className="card-icon">👥</div>
                <div className="card-content">
                  <label>Registered Players</label>
                  <span className="card-value">{players.length}</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon">🧑‍🤝‍🧑</div>
                <div className="card-content">
                  <label>Participating Teams</label>
                  <span className="card-value">{tournament.participatingTeams}</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon">🪙</div>
                <div className="card-content">
                  <label>Maximum Fund per Team</label>
                  <span className="card-value">₹{maxFundPerTeam}</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon">💰</div>
                <div className="card-content">
                  <label>Auction Type</label>
                  <span className="card-value">{tournament.auctionRules.type === 'slab' ? 'Slab Method' : 'Straight Method'}</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon">🏟️</div>
                <div className="card-content">
                  <label>Venue</label>
                  <span className="card-value">{tournament.location || 'Not specified'}</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon">📅</div>
                <div className="card-content">
                  <label>Registration Period</label>
                  <span className="card-value">
                    {tournament.registrationStartDate ? new Date(tournament.registrationStartDate).toLocaleDateString() : 'N/A'} - {tournament.registrationEndDate ? new Date(tournament.registrationEndDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tournament Information Panel */}
            <div className="overview-section">
              <h2 className="section-title">🏆 {tournament.name}</h2>
              <div className="tournament-info-grid">
                <div className="info-item">
                  <label>Venue:</label>
                  <span>{tournament.location || 'Not specified'}</span>
                </div>
                <div className="info-item">
                  <label>Type:</label>
                  <span>{tournament.sport}</span>
                </div>
                <div className="info-item">
                  <label>Dates:</label>
                  <span>{tournament.startDate ? new Date(tournament.startDate).toLocaleDateString() : 'Not Available'} → {tournament.endDate ? new Date(tournament.endDate).toLocaleDateString() : 'Not Available'}</span>
                </div>
              </div>

              {/* Admin Credentials - Show for SuperAdmin or the TournamentAdmin themselves */}
              {(user.role === 'SuperAdmin' || (user.role === 'TournamentAdmin' && user.id === admin._id)) && admin && (
                <div className="admin-credentials-section">
                  <h3>👤 Tournament Admin Credentials</h3>
                  <div className="credentials-grid">
                    <div className="credential-item">
                      <label className="credential-label">Username:</label>
                      <span className="credential-value">{admin.username}</span>
                    </div>
                    <div className="credential-item">
                      <label className="credential-label">Password:</label>
                      <span className={`credential-value ${!passwordVisible ? 'password-hidden' : ''}`}>
                        {passwordVisible ? admin.plainPassword : '••••••••'}
                      </span>
                      <div className="credential-actions">
                        <button className="btn-show" onClick={() => setPasswordVisible(!passwordVisible)}>
                          {passwordVisible ? 'Hide' : 'Show'}
                        </button>
                        <button className="btn-copy" onClick={() => copyToClipboard(admin.plainPassword)}>Copy</button>
                      </div>
                    </div>
                    <div className="credential-item">
                      <label className="credential-label">Email:</label>
                      <span className="credential-value">{admin.email}</span>
                    </div>
                  </div>
                  <div className="credential-actions">
                    <button className="btn-copy" onClick={() => copyToClipboard(`${admin.username}\n${admin.plainPassword}`)}>📋 Copy Credentials</button>
                    <button className="btn-copy" onClick={downloadPDF}>⬇️ Download PDF</button>
                  </div>
                </div>
              )}

              {/* Registration Links */}
              <div className="registration-links-section">
                <h3>🔗 Registration Links</h3>
                <div className={`registration-link-card ${playerRegistrationLocked ? 'closed' : 'active'}`}>
                  <div className="link-header">
                    <span className="link-title">🎟️ Player Registration Link:</span>
                    <span className={`link-status ${playerRegistrationLocked ? 'status-closed' : 'status-active'}`}>{playerRegistrationLocked ? 'Locked' : 'Active'}</span>
                  </div>
                  <div className="registration-link-display">{tournament.registrationLink || 'Not available'}</div>
                  <div className="link-actions">
                    <button className="btn-copy-link" onClick={() => copyToClipboard(tournament.registrationLink)}>📋 Copy Link</button>
                    <button className="btn-share" onClick={() => shareLink(tournament.registrationLink)}>💬 Share</button>
                    <button className="btn-close-registration" onClick={() => lockRegistration('Player')}>🔒 Lock Registration</button>
                    {!playerRegistrationLocked && (
                      <button
                        className="btn-register"
                        onClick={() => window.open(getRegistrationLink(), '_blank')}
                        title="Open Registration Form"
                      >
                        🧾 Register
                      </button>
                    )}
                    {playerRegistrationLocked && (
                      <button
                        className="btn-register disabled"
                        disabled
                        title="Registration is closed"
                      >
                        🧾 Register
                      </button>
                    )}
                  </div>
                </div>
                <div className={`registration-link-card ${teamRegistrationLocked ? 'closed' : 'active'}`}>
                  <div className="link-header">
                    <span className="link-title">🏁 Team Registration Link:</span>
                    <span className={`link-status ${teamRegistrationLocked ? 'status-closed' : 'status-active'}`}>{teamRegistrationLocked ? 'Locked' : 'Active'}</span>
                  </div>
                  <div className="registration-link-display">{tournament.teamRegistrationLink || 'Not available'}</div>
                  <div className="link-actions">
                    <button className="btn-copy-link" onClick={() => copyToClipboard(tournament.teamRegistrationLink)}>📋 Copy Link</button>
                    <button className="btn-share" onClick={() => shareLink(tournament.teamRegistrationLink)}>💬 Share</button>
                    <button className="btn-close-registration" onClick={() => lockRegistration('Team')}>🔒 Lock Team Registration</button>
                    {!teamRegistrationLocked && (
                      <button
                        className="btn-register"
                        onClick={() => window.open(tournament.teamRegistrationLink, '_blank')}
                        title="Open Registration Form"
                      >
                        🧾 Register
                      </button>
                    )}
                    {teamRegistrationLocked && (
                      <button
                        className="btn-register disabled"
                        disabled
                        title="Registration is closed"
                      >
                        🧾 Register
                      </button>
                    )}
                  </div>
                </div>
                <p>
                  Status: {playerRegistrationLocked && teamRegistrationLocked ? '🔴 Both Registrations Closed' : playerRegistrationLocked ? '🟡 Player Registration Active | Team Registration Locked' : teamRegistrationLocked ? '🟡 Player Registration Locked | Team Registration Active' : '✅ Both Registrations Active'}
                </p>
              </div>
            </div>
          </>
        );
      case 'players':
        return <div className="tab-content">Players tab content here</div>;
      case 'teams':
        return <div className="tab-content">Teams tab content here</div>;
      case 'auction':
        return <div className="tab-content">Auction tab content here</div>;
      case 'reports':
        return <div className="tab-content">Reports tab content here</div>;
      default:
        return <div className="tab-content">Overview content</div>;
    }
  };

  return (
    <div className="tournament-view-container">
      {/* Header Bar */}
      <header className="tournament-header-bar">
        <div className="tournament-header-left">
          {tournament.logo && <img src={`${API_BASE_URL}/${tournament.logo}`} alt="Logo" className="tournament-logo" />}
          <div className="tournament-title-section">
            <h1>{tournament.name}</h1>
            <div className="tournament-meta">
              <span>{tournament.code}</span> | <span>{tournament.sport}</span>
            </div>
          </div>
          <div className="tournament-status-section">
            <span className={`tournament-status-badge status-${tournament.status.toLowerCase()}`}>
              {tournament.status === 'Active' ? 'Active' : tournament.status === 'Completed' ? 'Completed' : tournament.status === 'End' ? 'End' : 'Upcoming'}
            </span>
            {user.role === 'SuperAdmin' && (
              <select
                className="status-select"
                value={tournament.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={isUpdatingStatus}
                title="Change tournament status"
              >
                <option value="Upcoming">Upcoming</option>
                <option value="Active">Active</option>
                <option value="End">End</option>
                <option value="Completed">Completed</option>
              </select>
            )}
          </div>
        </div>
        <div className="tournament-header-actions">
          {user.role === 'SuperAdmin' && (
            <>
              <button className="btn-header btn-edit" onClick={() => navigate(`/edit-tournament/${tournament.code}`)}>⚙️ Settings</button>
              <button className="btn-header btn-edit" onClick={() => navigate(`/edit-tournament/${tournament.code}`)}>🖊️ Edit Tournament</button>
              <button className="btn-header btn-delete">🗑️ Delete Tournament</button>
            </>
          )}
          <button className="btn-header btn-back" onClick={() => user.role === 'SuperAdmin' ? navigate('/dashboard/superadmin') : navigate('/')}>🔙 Back</button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="tournament-tabs">
        <ul className="tabs-nav">
          <li className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</li>
          <li className={`tab-item ${activeTab === 'players' ? 'active' : ''}`} onClick={() => setActiveTab('players')}>Players</li>
          <li className={`tab-item ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')}>Teams</li>
          <li className={`tab-item ${activeTab === 'auction' ? 'active' : ''}`} onClick={() => setActiveTab('auction')}>Auction</li>
          <li className={`tab-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>Reports</li>
        </ul>
      </nav>

      {/* Tab Content */}
      <main className="tab-content">
        {renderTabContent()}
      </main>

      {/* Footer */}
      <footer className="tournament-footer">
        <p>Powered by PlayLive © 2023</p>
      </footer>

      {/* Toast Notifications */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default TournamentView;
