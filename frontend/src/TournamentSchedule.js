import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import FixtureGenerationModal from './components/FixtureGenerationModal';
import MatchList from './components/MatchList';
import { toast } from 'react-toastify';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-admin-modern.css';
import './styles-tournament-schedule.css';
import './styles-schedule-modern.css';
import './styles-schedule-new.css';

function TournamentSchedule() {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fixtures, setFixtures] = useState([]);
  const [showFixtureModal, setShowFixtureModal] = useState(false);
  const navigate = useNavigate();
  const { code } = useParams();

  // Authentication check with browser back button protection
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (!token || !storedUser) {
        navigate('/login/tournament-admin', { replace: true });
        return false;
      }
      
      try {
        const parsedUser = JSON.parse(storedUser);
        const normalizedRole = (parsedUser.role || '').toString().trim().replace(/[\s_]/g, '').toLowerCase();
        const allowedRoles = ['tournamentadmin', 'superadmin'];
        
        if (!allowedRoles.includes(normalizedRole)) {
          navigate('/login/tournament-admin', { replace: true });
          return false;
        }
        return true;
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login/tournament-admin', { replace: true });
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

  useEffect(() => {
    if (tournament) {
      document.title = `Tournament Schedule - ${tournament.name}`;
    } else {
      document.title = 'Tournament Schedule';
    }
  }, [tournament]);

  const fetchTournament = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTournament(res.data.tournament);
    } catch (err) {
      console.error('Error fetching tournament:', err);
      toast.error('Failed to load tournament schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [code]);

  const fetchFixtures = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/fixtures/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setFixtures(res.data.matches || []);
      }
    } catch (err) {
      // If fixtures don't exist yet, that's okay
      if (err.response?.status !== 404) {
        console.error('Error fetching fixtures:', err);
      }
      setFixtures([]);
    }
  }, [code]);

  useEffect(() => {
    fetchTournament();
    fetchFixtures();
    const interval = setInterval(() => {
      fetchTournament(true);
      fetchFixtures();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchTournament, fetchFixtures]);

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateRange = (startDate, endDate) => {
    if (!startDate && !endDate) return 'Schedule to be announced';
    if (!startDate) return `Ends ${formatDate(endDate)}`;
    if (!endDate) return `Starts ${formatDate(startDate)}`;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);
    
    if (start.toDateString() === end.toDateString()) {
      return startStr;
    }
    
    return `${startStr} - ${endStr}`;
  };

  if (loading) {
    return (
      <div className="schedule-page-new">
        <div className="schedule-loading-state">
          <div className="schedule-loading-spinner"></div>
          <p>Loading tournament schedule...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="schedule-page-new">
        <div className="schedule-empty-state">
          <div className="schedule-empty-icon">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3 className="schedule-empty-title">Tournament not found</h3>
          <p className="schedule-empty-description">Unable to load tournament schedule.</p>
        </div>
      </div>
    );
  }

  const getLogoUrl = () => {
    if (!tournament.logo) return null;
    if (tournament.logo.startsWith('http')) return tournament.logo;
    if (tournament.logo.startsWith('/')) {
      return `${API_BASE_URL}${tournament.logo}`;
    }
    return `${API_BASE_URL}/${tournament.logo}`;
  };

  const formatDateDisplay = (value, fallback = 'TBD') => {
    if (!value) return fallback;
    try {
      return new Date(value).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return fallback;
    }
  };

  const heroDescriptionParts = [
    tournament.location ? `📍 ${tournament.location}` : null,
    tournament.startDate || tournament.endDate
      ? `📅 ${formatDateDisplay(tournament.startDate)} – ${formatDateDisplay(tournament.endDate)}`
      : null,
    tournament.code ? `Code ${tournament.code}` : null
  ];
  const heroDescription = heroDescriptionParts.filter(Boolean).join(' • ');

  const mapStatusTone = (value) => {
    const normalized = (value || '').toLowerCase();
    if (normalized.includes('active')) return 'status-chip--active';
    if (normalized.includes('complete') || normalized.includes('end')) return 'status-chip--completed';
    if (normalized.includes('close')) return 'status-chip--closed';
    return 'status-chip--upcoming';
  };

  const heroStatusTone = mapStatusTone(tournament.status || 'Upcoming');
  const isPltc002 = (code || '').toUpperCase() === 'PLTC002';

  return (
    <div className="schedule-page-new">
      {/* Hero Section */}
      <div className="schedule-hero-new">
        <div className="schedule-hero-content">
          <div className="schedule-hero-main">
            {tournament.logo && (
              <div className="schedule-hero-logo">
                <img src={getLogoUrl()} alt={`${tournament.name} logo`} />
              </div>
            )}
            <div className="schedule-hero-text">
              <div className="schedule-hero-badge">
                <span>📅</span>
                <span>Tournament Schedule</span>
              </div>
              <h1 className="schedule-hero-title">{tournament.name}</h1>
              <div className="schedule-hero-meta">
                {tournament.location && (
                  <span className="schedule-meta-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    {tournament.location}
                  </span>
                )}
                {(tournament.startDate || tournament.endDate) && (
                  <span className="schedule-meta-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    {formatDateDisplay(tournament.startDate)} - {formatDateDisplay(tournament.endDate)}
                  </span>
                )}
                <span className="schedule-meta-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  {fixtures.length} Matches
                </span>
              </div>
            </div>
          </div>
          <div className="schedule-hero-actions">
            <button
              className="schedule-action-btn schedule-action-btn-primary"
              onClick={() => setShowFixtureModal(true)}
              disabled={refreshing}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              Generate Fixtures
            </button>
            <button
              className="schedule-action-btn schedule-action-btn-secondary"
              onClick={() => {
                fetchTournament(true);
                fetchFixtures();
              }}
              disabled={refreshing}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="schedule-stats-grid">
        <div className="schedule-stat-card">
          <div className="schedule-stat-icon schedule-stat-icon-primary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div className="schedule-stat-content">
            <div className="schedule-stat-value">{fixtures.length}</div>
            <div className="schedule-stat-label">Total Matches</div>
          </div>
        </div>
        <div className="schedule-stat-card">
          <div className="schedule-stat-icon schedule-stat-icon-success">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div className="schedule-stat-content">
            <div className="schedule-stat-value">{formatDateDisplay(tournament.startDate, 'TBD')}</div>
            <div className="schedule-stat-label">Start Date</div>
          </div>
        </div>
        <div className="schedule-stat-card">
          <div className="schedule-stat-icon schedule-stat-icon-warning">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div className="schedule-stat-content">
            <div className="schedule-stat-value">{formatDateDisplay(tournament.endDate, 'TBD')}</div>
            <div className="schedule-stat-label">End Date</div>
          </div>
        </div>
        <div className="schedule-stat-card">
          <div className="schedule-stat-icon schedule-stat-icon-info">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="schedule-stat-content">
            <div className="schedule-stat-value">{formatDateRange(tournament.startDate, tournament.endDate).split(' - ')[0]}</div>
            <div className="schedule-stat-label">Duration</div>
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="schedule-timeline-section">
        <div className="schedule-section-header">
          <h2 className="schedule-section-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Tournament Timeline
          </h2>
        </div>
        <div className="schedule-timeline-new">
          <div className="schedule-timeline-item-new">
            <div className="schedule-timeline-marker schedule-timeline-marker-start">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div className="schedule-timeline-content-new">
              <div className="schedule-timeline-label">Start Date</div>
              <div className="schedule-timeline-date">{formatDate(tournament.startDate)}</div>
              {tournament.startDate && (
                <div className="schedule-timeline-time">{formatTime(tournament.startDate)}</div>
              )}
            </div>
          </div>
          <div className="schedule-timeline-connector"></div>
          <div className="schedule-timeline-item-new">
            <div className="schedule-timeline-marker schedule-timeline-marker-end">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <div className="schedule-timeline-content-new">
              <div className="schedule-timeline-label">End Date</div>
              <div className="schedule-timeline-date">{formatDate(tournament.endDate)}</div>
              {tournament.endDate && (
                <div className="schedule-timeline-time">{formatTime(tournament.endDate)}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Matches Section */}
      <div className="schedule-matches-section">
        <div className="schedule-section-header">
          <h2 className="schedule-section-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Match Schedule
          </h2>
          <div className="schedule-section-actions">
            <button
              className="schedule-action-btn schedule-action-btn-icon"
              onClick={() => {
                fetchTournament(true);
                fetchFixtures();
              }}
              disabled={refreshing}
              title="Refresh"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
            <button
              className="schedule-action-btn schedule-action-btn-icon schedule-action-btn-primary"
              onClick={() => setShowFixtureModal(true)}
              title="Generate Fixtures"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </button>
          </div>
        </div>
        <div className="schedule-matches-content">
          {fixtures.length > 0 ? (
            <MatchList
              matches={fixtures}
              tournamentCode={code}
              onMatchUpdated={fetchFixtures}
              onRegenerate={() => setShowFixtureModal(true)}
            />
          ) : (
            <div className="schedule-empty-state">
              <div className="schedule-empty-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <h3 className="schedule-empty-title">No fixtures generated yet</h3>
              <p className="schedule-empty-description">
                Create match fixtures based on your team groups. Select fixture type and match count to get started.
              </p>
              <button
                onClick={() => setShowFixtureModal(true)}
                className="schedule-action-btn schedule-action-btn-primary schedule-empty-action"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Generate Fixtures
              </button>
            </div>
          )}
        </div>
      </div>

      {showFixtureModal && (
        <FixtureGenerationModal
          isOpen={showFixtureModal}
          onClose={() => setShowFixtureModal(false)}
          tournamentCode={code}
          onFixturesGenerated={() => {
            fetchFixtures();
            setShowFixtureModal(false);
          }}
        />
      )}

      {/* Footer App Info */}
      <footer style={{
        marginTop: '48px',
        padding: '24px',
        textAlign: 'center',
        borderTop: '1px solid rgba(0, 0, 0, 0.1)',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
      }}>
        <img 
          src="/logo192.png" 
          alt="PlayLive" 
          style={{ width: '32px', height: '32px', objectFit: 'contain' }}
        />
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
          💙 Powered by <strong>PlayLive</strong> — Tournament Made Simple
        </p>
      </footer>
    </div>
  );
  }

export default TournamentSchedule;

