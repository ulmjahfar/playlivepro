import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import TournamentAdminLayout from './components/TournamentAdminLayout';
import useTournamentFeatures from './hooks/useTournamentFeatures';
import FeatureLocked from './components/FeatureLocked';
import { copyToClipboard } from './utils/clipboard';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-overview.css';

function TournamentOverview() {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [auctionData, setAuctionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalState, setModalState] = useState({ open: false, scope: 'player' });
  const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'SUPER_ADMIN';
  const {
    loading: featuresLoading,
    error: featureError,
    planLabel,
    hasFeature,
    refetch: refetchFeatures
  } = useTournamentFeatures(code);

  const baseUrl = window.location.origin;

  const fetchData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [tournamentRes, playersRes, teamsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/tournaments/${code}`, { headers }),
        axios
          .get(`${API_BASE_URL}/api/players/${code}`, { headers })
          .catch(() => ({ data: { players: [] } })),
        axios
          .get(`${API_BASE_URL}/api/teams/${code}`, { headers })
          .catch(() => ({ data: { teams: [] } }))
      ]);

      setTournament(tournamentRes.data.tournament);
      setPlayers(playersRes.data.players || []);
      setTeams(teamsRes.data.teams || []);

      try {
        const auctionRes = await axios.get(`${API_BASE_URL}/api/auctions/summary/${code}`, { headers });
        setAuctionData(auctionRes.data.summary);
      } catch {
        setAuctionData(null);
      }

      refetchFeatures();
    } catch (err) {
      console.error('Error fetching dashboard data', err);
      if (!showRefreshing) {
        toast.error('Failed to load tournament dashboard');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [code, refetchFeatures]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [code, fetchData]);

  useEffect(() => {
    if (featureError) {
      toast.warning(featureError);
    }
  }, [featureError]);

  const mutateRegistration = async (action, scope) => {
    if (featuresLoading) {
      toast.info('Checking feature permissions…');
      return;
    }
    if (!hasFeature('registration_portal')) {
      toast.info('🔒 Registration portal is locked for this plan.');
      setModalState({ open: false, scope: 'player' });
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/tournaments/${code}/${action}-registration`,
        { scope },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(
        action === 'close'
          ? `Closed ${scope === 'both' ? 'player & team' : scope} registration`
          : `Reopened ${scope === 'both' ? 'player & team' : scope} registration`
      );
      fetchData();
    } catch (err) {
      console.error(`Error trying to ${action} registration`, err);
      toast.error(`Could not ${action} ${scope} registration`);
    } finally {
      setModalState({ open: false, scope: 'player' });
    }
  };

  const copyLink = async (scope) => {
    if (featuresLoading) {
      toast.info('Checking feature permissions…');
      return;
    }
    if (!hasFeature('registration_portal')) {
      toast.info('🔒 Registration portal is locked for this plan.');
      return;
    }
    const path = scope === 'team' ? `/register/team/${code}` : `/register/${code}`;
    const link = `${baseUrl}${path}`;
    const success = await copyToClipboard(link);
    if (success) {
      toast.success('✅ Link copied');
    } else {
      toast.error('Failed to copy link');
    }
  };

  const shareOnWhatsApp = (scope) => {
    if (featuresLoading) {
      toast.info('Checking feature permissions…');
      return;
    }
    if (!hasFeature('registration_portal')) {
      toast.info('🔒 Registration portal is locked for this plan.');
      return;
    }
    const path = scope === 'team' ? `/register/team/${code}` : `/register/${code}`;
    const link = `${baseUrl}${path}`;
    const message = `🏆 Register for ${tournament?.name || 'this tournament'}!\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const startAuction = useCallback(async () => {
    if (featuresLoading) {
      toast.info('Checking feature permissions…');
      return;
    }
    if (!hasFeature('auction_live')) {
      toast.info('🔒 Live auction is not available in your current plan.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/tournaments/${code}/start-auction`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Auction started successfully');
      navigate(`/tournament/${code}/auction`);
    } catch (err) {
      console.error('Error starting auction', err);
      const errorData = err.response?.data;
      if (errorData?.code === 'AUCTION_NOT_READY') {
        toast.warning('Registration/quorum incomplete. You can start with bypass on the auction page.');
        navigate(`/tournament/${code}/auction`);
      } else {
        toast.error(errorData?.message || 'Unable to start auction');
      }
    }
  }, [featuresLoading, hasFeature, code, navigate]);

  const handleBackNavigation = () => {
    if (location.state?.from) {
      navigate(location.state.from);
      return;
    }
    navigate('/dashboard/superadmin');
  };

  const computeRegistrationStatus = (scope) => {
    if (!tournament) return 'Not Started';
    const now = new Date();
    const start = tournament.registrationStartDate ? new Date(tournament.registrationStartDate) : null;
    const end = tournament.registrationEndDate ? new Date(tournament.registrationEndDate) : null;

    const isEnabled = scope === 'player'
      ? Boolean(tournament.playerRegistrationEnabled)
      : Boolean(tournament.teamRegistrationEnabled);

    if (isEnabled) {
      return 'Active';
    }

    if (start && now < start) return 'Not Started';
    if (end && now > end) return 'Closed';

    return 'Closed';
  };

  const formatDate = (value, fallback = 'TBD') => {
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

  const formatTime = (value, fallback = '') => {
    if (!value) return fallback;
    try {
      return new Date(value).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fallback;
    }
  };

  const safeTournament = useMemo(() => tournament || {}, [tournament]);
  const registeredPlayers = players.length;
  const registeredTeams = teams.length;
  const totalPlayerPoolSize = safeTournament.playerPoolSize || safeTournament.maxPlayers || 100;
  const maxTeams = safeTournament.participatingTeams || 8;
  const playerStatus = computeRegistrationStatus('player');
  const teamStatus = computeRegistrationStatus('team');
  const soldPlayerEntries = useMemo(
    () => players.filter((p) => p.auctionStatus === 'Sold'),
    [players]
  );
  const soldPlayers = soldPlayerEntries.length;
  const totalSpend = soldPlayerEntries.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
  const highestBid = auctionData?.highestBid ? Number(auctionData.highestBid) : null;
  const canManagePlayers = !featuresLoading && hasFeature('registration_portal');
  const canStartAuction = !featuresLoading && hasFeature('auction_live');

  const heroStats = useMemo(
    () => [
      {
        label: 'Players',
        value: `${registeredPlayers}/${totalPlayerPoolSize}`,
        hint: 'Registered'
      },
      {
        label: 'Teams',
        value: `${registeredTeams}/${maxTeams}`,
        hint: 'Confirmed'
      },
      {
        label: 'Auction',
        value: `₹${totalSpend.toLocaleString('en-IN')}`,
        hint: `${soldPlayers} sold`
      },
      {
        label: 'Status',
        value: tournament?.status || 'Upcoming',
        hint: planLabel
      }
    ],
    [registeredPlayers, totalPlayerPoolSize, registeredTeams, maxTeams, totalSpend, soldPlayers, tournament?.status, planLabel]
  );

  const timelineItems = useMemo(() => {
    const items = [];
    if (safeTournament.registrationStartDate) {
      items.push({
        title: 'Registration opens',
        date: formatDate(safeTournament.registrationStartDate),
        time: formatTime(safeTournament.registrationStartDate),
        status: new Date() < new Date(safeTournament.registrationStartDate) ? 'upcoming' : 'completed'
      });
    }
    if (safeTournament.registrationEndDate) {
      items.push({
        title: 'Registration closes',
        date: formatDate(safeTournament.registrationEndDate),
        time: formatTime(safeTournament.registrationEndDate),
        status: new Date() > new Date(safeTournament.registrationEndDate) ? 'completed' : 'upcoming'
      });
    }
    if (safeTournament.startDate) {
      items.push({
        title: 'Tournament kickoff',
        date: formatDate(safeTournament.startDate),
        time: formatTime(safeTournament.startDate),
        status: safeTournament.status === 'Upcoming' ? 'upcoming' : 'completed'
      });
    }
    if (safeTournament.endDate) {
      items.push({
        title: 'Final day',
        date: formatDate(safeTournament.endDate),
        time: formatTime(safeTournament.endDate),
        status: safeTournament.status === 'Completed' ? 'completed' : 'upcoming'
      });
    }
    return items;
  }, [safeTournament]);

  const recentRegistrations = useMemo(
    () =>
      players
        .slice(-6)
        .reverse()
        .map((player) => ({
          id: player._id,
          name: player.name,
          role: player.role || 'Player',
          city: player.city || '—',
          timestamp: formatDate(player.registeredAt, 'Recently'),
          avatar: player.photo ? `${API_BASE_URL}/${player.photo}` : null
        })),
    [players]
  );

  const quickActions = useMemo(
    () => [
      {
        icon: '👥',
        title: 'Manage Players',
        description: 'View, approve & edit player registrations',
        handler: () => navigate(`/tournament/${code}/players`),
        featureId: 'registration_portal'
      },
      {
        icon: '🏆',
        title: 'Manage Teams',
        description: 'Review squads and confirm captains',
        handler: () => navigate(`/tournament/${code}/teams`),
        featureId: 'tournament_core'
      },
      {
        icon: '📅',
        title: 'Schedule',
        description: 'View fixtures and match timings',
        handler: () => navigate(`/tournament/${code}/schedule`),
        featureId: 'tournament_core'
      },
      {
        icon: '📊',
        title: 'Reports',
        description: 'Analytics and tournament insights',
        handler: () => navigate(`/tournament/${code}/report`),
        featureId: 'tournament_core'
      },
      {
        icon: '🔗',
        title: 'Share Links',
        description: 'Copy and broadcast registration URLs',
        handler: () => navigate(`/tournament/${code}/links`),
        featureId: 'registration_portal'
      },
      {
        icon: '🎤',
        title: 'Launch Auction',
        description: 'Enter the live auction console',
        handler: startAuction,
        featureId: 'auction_live'
      }
    ],
    [code, navigate, startAuction]
  );

  const handleQuickAction = (action) => {
    if (action.featureId) {
      if (featuresLoading) {
        toast.info('Checking feature permissions…');
        return;
      }
      if (!hasFeature(action.featureId)) {
        toast.info('🔒 This feature is locked for this plan.');
        return;
      }
    }
    action.handler();
  };

  const getLogoUrl = () => {
    if (!tournament?.logo) return null;
    if (tournament.logo.startsWith('http')) return tournament.logo;
    if (tournament.logo.startsWith('/')) {
      return `${API_BASE_URL}${tournament.logo}`;
    }
    return `${API_BASE_URL}/${tournament.logo}`;
  };

  const mapStatusTone = (value) => {
    const normalized = (value || '').toLowerCase();
    if (normalized.includes('active')) return 'status-chip--active';
    if (normalized.includes('complete') || normalized.includes('end')) return 'status-chip--completed';
    if (normalized.includes('close')) return 'status-chip--closed';
    return 'status-chip--upcoming';
  };

  const getRegistrationActionLabel = (status) => {
    if (status === 'Active') return 'Close Registration';
    if (status === 'Not Started') return 'Start Registration';
    return 'Reopen Registration';
  };

  const playerProgressPct = Math.min((registeredPlayers / totalPlayerPoolSize) * 100, 100);
  const teamProgressPct = Math.min((registeredTeams / maxTeams) * 100, 100);
  const playerRegistrationLink = `${baseUrl}/register/${code}`;
  const teamRegistrationLink = `${baseUrl}/register/team/${code}`;

  // Loading state
  if (loading) {
    return (
      <TournamentAdminLayout>
        <div className="overview-redesign-light">
          <div className="ovr-loading">
            <div className="ovr-loading__spinner" />
            <p className="ovr-loading__text">Loading tournament dashboard...</p>
          </div>
        </div>
      </TournamentAdminLayout>
    );
  }

  // Error state
  if (!tournament) {
    return (
      <TournamentAdminLayout>
        <div className="overview-redesign-light">
          <div className="ovr-empty">
            <div className="ovr-empty__icon">⚠️</div>
            <p className="ovr-empty__text">Unable to load tournament details. Please refresh or check your connection.</p>
          </div>
        </div>
      </TournamentAdminLayout>
    );
  }

  const heroDescription = [
    tournament.location ? `📍 ${tournament.location}` : null,
    tournament.startDate ? `📅 ${formatDate(tournament.startDate)} – ${formatDate(tournament.endDate)}` : null
  ].filter(Boolean).join('  •  ');

  const statusTone = (tournament.status || 'Upcoming').toLowerCase();

  return (
    <TournamentAdminLayout>
      <div className="overview-redesign-light">
        {/* Hero Section */}
        <section className="ovr-hero">
          <div className="ovr-hero__content">
            <div className="ovr-hero__identity">
              <div className={`ovr-hero__logo ${!tournament.logo ? 'fallback' : ''}`}>
                {tournament.logo ? (
                  <img src={getLogoUrl()} alt={`${tournament.name} logo`} />
                ) : (
                  '🏆'
                )}
              </div>
              <div className="ovr-hero__info">
                <p className="ovr-hero__eyebrow">
                  Tournament Dashboard
                  <span>Code: {tournament.code}</span>
                </p>
                <h1 className="ovr-hero__title">{tournament.name}</h1>
                {heroDescription && (
                  <p className="ovr-hero__subtitle">
                    {tournament.location && <span>📍 {tournament.location}</span>}
                    {tournament.startDate && (
                      <span>📅 {formatDate(tournament.startDate)} – {formatDate(tournament.endDate)}</span>
                    )}
                    {tournament.sport && <span>🏏 {tournament.sport}</span>}
                  </p>
                )}
                <div className="ovr-hero__badges">
                  <span className={`ovr-badge ovr-badge--status ${statusTone}`}>
                    {tournament.status || 'Upcoming'}
                  </span>
                  <span className="ovr-badge">📋 {planLabel} Plan</span>
                  <span className="ovr-badge">👥 {registeredPlayers} Players</span>
                  <span className="ovr-badge">🏆 {registeredTeams} Teams</span>
                </div>
                <div className="ovr-hero__actions">
                  {isSuperAdmin && (
                    <button type="button" className="ovr-btn ovr-btn--ghost" onClick={handleBackNavigation}>
                      ← Back to Dashboard
                    </button>
                  )}
                  <button
                    type="button"
                    className="ovr-btn ovr-btn--primary"
                    onClick={() => navigate(`/tournament/${code}/players`)}
                    disabled={!canManagePlayers}
                  >
                    👥 Manage Players
                  </button>
                  <button
                    type="button"
                    className="ovr-btn ovr-btn--secondary"
                    onClick={() => navigate(`/tournament/${code}/teams`)}
                  >
                    🏆 Manage Teams
                  </button>
                  <button
                    type="button"
                    className="ovr-btn ovr-btn--secondary"
                    onClick={startAuction}
                    disabled={!canStartAuction}
                  >
                    🎤 Launch Auction
                  </button>
                </div>
              </div>
            </div>
            <div className="ovr-hero__stats">
              {heroStats.map((stat) => (
                <div key={stat.label} className="ovr-stat-card">
                  <p className="ovr-stat-card__label">{stat.label}</p>
                  <p className="ovr-stat-card__value">{stat.value}</p>
                  <p className="ovr-stat-card__hint">{stat.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Main Content */}
        <main className="ovr-main">
          {/* Quick Actions Console */}
          <section className="ovr-console ovr-animate-in">
            <div className="ovr-console__header">
              <div className="ovr-console__title-group">
                <p className="ovr-console__eyebrow">Control Center</p>
                <h2 className="ovr-console__title">Quick Actions</h2>
                <p className="ovr-console__subtitle">Manage your tournament from one central dashboard</p>
              </div>
              <div className="ovr-console__actions">
                <button
                  type="button"
                  className="ovr-console__action-btn"
                  onClick={() => window.open(`/tournament/${code}/report`, '_blank', 'noopener,noreferrer')}
                >
                  📄 Print Report
                </button>
                <button
                  type="button"
                  className="ovr-console__action-btn"
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                >
                  {refreshing ? '⏳ Syncing...' : '🔄 Refresh Data'}
                </button>
              </div>
            </div>
            <div className="ovr-console__grid">
              {quickActions.map((action) => {
                const locked = action.featureId ? (!featuresLoading && !hasFeature(action.featureId)) : false;
                const pending = action.featureId ? featuresLoading : false;
                return (
                  <button
                    key={action.title}
                    type="button"
                    className={`ovr-quick-action ${locked ? 'is-locked' : ''}`}
                    onClick={() => handleQuickAction(action)}
                    disabled={locked}
                  >
                    <span className="ovr-quick-action__icon">{action.icon}</span>
                    <h4 className="ovr-quick-action__title">{action.title}</h4>
                    <p className="ovr-quick-action__desc">
                      {locked ? 'Upgrade plan to unlock' : action.description}
                    </p>
                    {pending && <small style={{ color: 'var(--ov-text-light)' }}>Checking access...</small>}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Registration Cards */}
          <div className="ovr-grid ovr-animate-in" style={{ animationDelay: '0.15s' }}>
            {/* Player Registration */}
            <div className={`ovr-registration player`}>
              <div className="ovr-registration__header">
                <div>
                  <p className="ovr-registration__eyebrow">Player Intake</p>
                  <h3 className="ovr-registration__title">Player Registration</h3>
                </div>
                <span className={`ovr-registration__status ${mapStatusTone(playerStatus)}`}>
                  {playerStatus}
                </span>
              </div>
              {featuresLoading ? (
                <div className="ovr-registration__body">
                  <div className="ovr-loading" style={{ padding: '24px' }}>
                    <p className="ovr-loading__text">Checking permissions...</p>
                  </div>
                </div>
              ) : !hasFeature('registration_portal') ? (
                <div className="ovr-registration__body">
                  <div className="ovr-feature-locked">
                    <div className="ovr-feature-locked__icon">🔒</div>
                    <p className="ovr-feature-locked__text">Registration portal is locked</p>
                    <span className="ovr-feature-locked__plan">{planLabel} Plan</span>
                  </div>
                </div>
              ) : (
                <div className="ovr-registration__body">
                  <div className="ovr-registration__stats">
                    <span className="ovr-registration__count">{registeredPlayers}/{totalPlayerPoolSize}</span>
                    <span className="ovr-registration__desc">players registered</span>
                  </div>
                  <div className="ovr-progress">
                    <div className="ovr-progress__bar" style={{ width: `${playerProgressPct}%` }} />
                  </div>
                  <div className="ovr-link-row">
                    <input
                      type="text"
                      value={playerRegistrationLink}
                      readOnly
                      className="ovr-link-row__input"
                    />
                    <button type="button" className="ovr-link-row__btn" onClick={() => copyLink('player')}>
                      Copy
                    </button>
                    <button type="button" className="ovr-link-row__btn secondary" onClick={() => shareOnWhatsApp('player')}>
                      Share
                    </button>
                  </div>
                  <div className="ovr-registration__actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => setModalState({ open: true, scope: 'player' })}
                    >
                      {getRegistrationActionLabel(playerStatus)}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => navigate(`/tournament/${code}/players`)}
                    >
                      Open Roster
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Team Registration */}
            <div className={`ovr-registration team`}>
              <div className="ovr-registration__header">
                <div>
                  <p className="ovr-registration__eyebrow">Team Confirmation</p>
                  <h3 className="ovr-registration__title">Team Registration</h3>
                </div>
                <span className={`ovr-registration__status ${mapStatusTone(teamStatus)}`}>
                  {teamStatus}
                </span>
              </div>
              {featuresLoading ? (
                <div className="ovr-registration__body">
                  <div className="ovr-loading" style={{ padding: '24px' }}>
                    <p className="ovr-loading__text">Checking permissions...</p>
                  </div>
                </div>
              ) : !hasFeature('registration_portal') ? (
                <div className="ovr-registration__body">
                  <div className="ovr-feature-locked">
                    <div className="ovr-feature-locked__icon">🔒</div>
                    <p className="ovr-feature-locked__text">Registration portal is locked</p>
                    <span className="ovr-feature-locked__plan">{planLabel} Plan</span>
                  </div>
                </div>
              ) : (
                <div className="ovr-registration__body">
                  <div className="ovr-registration__stats">
                    <span className="ovr-registration__count">{registeredTeams}/{maxTeams}</span>
                    <span className="ovr-registration__desc">teams confirmed</span>
                  </div>
                  <div className="ovr-progress">
                    <div className="ovr-progress__bar" style={{ width: `${teamProgressPct}%` }} />
                  </div>
                  <div className="ovr-link-row">
                    <input
                      type="text"
                      value={teamRegistrationLink}
                      readOnly
                      className="ovr-link-row__input"
                    />
                    <button type="button" className="ovr-link-row__btn" onClick={() => copyLink('team')}>
                      Copy
                    </button>
                    <button type="button" className="ovr-link-row__btn secondary" onClick={() => shareOnWhatsApp('team')}>
                      Share
                    </button>
                  </div>
                  <div className="ovr-registration__actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => setModalState({ open: true, scope: 'team' })}
                    >
                      {getRegistrationActionLabel(teamStatus)}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => navigate(`/tournament/${code}/teams`)}
                    >
                      Review Teams
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline and Activity */}
          <div className="ovr-grid ovr-animate-in" style={{ animationDelay: '0.25s' }}>
            {/* Timeline */}
            <div className="ovr-panel">
              <div className="ovr-panel__header">
                <div>
                  <p className="ovr-panel__eyebrow">Event Milestones</p>
                  <h3 className="ovr-panel__title">Schedule Timeline</h3>
                </div>
              </div>
              <div className="ovr-panel__body">
                {timelineItems.length ? (
                  <ul className="ovr-timeline">
                    {timelineItems.map((item) => (
                      <li key={`${item.title}-${item.date}`} className={`ovr-timeline__item ${item.status}`}>
                        <div className="ovr-timeline__dot" />
                        <div className="ovr-timeline__content">
                          <strong>{item.title}</strong>
                          <span>{item.date}{item.time ? ` • ${item.time}` : ''}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="ovr-empty">
                    <div className="ovr-empty__icon">📅</div>
                    <p className="ovr-empty__text">Add dates to your tournament to see milestones here.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="ovr-panel">
              <div className="ovr-panel__header">
                <div>
                  <p className="ovr-panel__eyebrow">Latest Activity</p>
                  <h3 className="ovr-panel__title">Recent Registrations</h3>
                </div>
                <button
                  type="button"
                  className="ovr-panel__action-btn"
                  onClick={() => navigate(`/tournament/${code}/players`)}
                >
                  View All →
                </button>
              </div>
              <div className="ovr-panel__body">
                {recentRegistrations.length ? (
                  <div className="ovr-activity">
                    {recentRegistrations.map((entry) => (
                      <div key={entry.id} className="ovr-activity__item">
                        <div className="ovr-activity__avatar">
                          {entry.avatar ? (
                            <img src={entry.avatar} alt={entry.name} />
                          ) : (
                            entry.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="ovr-activity__info">
                          <p className="ovr-activity__name">{entry.name}</p>
                          <p className="ovr-activity__meta">{entry.role} • {entry.city}</p>
                        </div>
                        <span className="ovr-activity__time">{entry.timestamp}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ovr-empty">
                    <div className="ovr-empty__icon">👥</div>
                    <p className="ovr-empty__text">No registrations yet. Share your links to get started!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Auction Summary */}
          <div className="ovr-panel ovr-animate-in" style={{ animationDelay: '0.35s' }}>
            <div className="ovr-panel__header">
              <div>
                <p className="ovr-panel__eyebrow">Trading Floor</p>
                <h3 className="ovr-panel__title">{auctionData ? 'Auction Summary' : 'Auction Not Started'}</h3>
              </div>
              <button
                type="button"
                className="ovr-panel__action-btn"
                onClick={startAuction}
                disabled={featuresLoading || !hasFeature('auction_live')}
              >
                🎤 Enter Console
              </button>
            </div>
            <div className="ovr-panel__body">
              {featuresLoading ? (
                <div className="ovr-loading" style={{ padding: '24px' }}>
                  <p className="ovr-loading__text">Checking permissions...</p>
                </div>
              ) : hasFeature('auction_live') ? (
                <div className="ovr-auction-grid">
                  <div className="ovr-auction-stat">
                    <p className="ovr-auction-stat__label">Players Sold</p>
                    <p className="ovr-auction-stat__value">{soldPlayers}</p>
                  </div>
                  <div className="ovr-auction-stat">
                    <p className="ovr-auction-stat__label">Total Spend</p>
                    <p className="ovr-auction-stat__value">₹{totalSpend.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="ovr-auction-stat">
                    <p className="ovr-auction-stat__label">Highest Bid</p>
                    <p className="ovr-auction-stat__value">
                      {highestBid ? `₹${highestBid.toLocaleString('en-IN')}` : '—'}
                    </p>
                  </div>
                  <div className="ovr-auction-stat">
                    <p className="ovr-auction-stat__label">Average Spend</p>
                    <p className="ovr-auction-stat__value">
                      {soldPlayers ? `₹${Math.round(totalSpend / soldPlayers).toLocaleString('en-IN')}` : '—'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="ovr-feature-locked">
                  <div className="ovr-feature-locked__icon">🔒</div>
                  <p className="ovr-feature-locked__text">Live auction is not available in your plan</p>
                  <span className="ovr-feature-locked__plan">{planLabel} Plan</span>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Registration Modal */}
        {modalState.open && (
          <div className="ovr-modal" role="dialog" aria-modal="true">
            <div className="ovr-modal__dialog">
              <header className="ovr-modal__header">
                <h3 className="ovr-modal__title">Confirm Registration Update</h3>
                <button
                  type="button"
                  className="ovr-modal__close"
                  onClick={() => setModalState({ open: false, scope: 'player' })}
                >
                  ×
                </button>
              </header>
              <div className="ovr-modal__body">
                <p className="ovr-modal__text">
                  {(() => {
                    const status = computeRegistrationStatus(modalState.scope);
                    if (status === 'Active') return `Are you sure you want to close ${modalState.scope} registration? New registrations will be blocked.`;
                    if (status === 'Not Started') return `Ready to open ${modalState.scope} registration? Players will be able to register through your link.`;
                    return `Reopen ${modalState.scope} registration? This will allow new registrations again.`;
                  })()}
                </p>
              </div>
              <footer className="ovr-modal__footer">
                <button
                  type="button"
                  className="ovr-modal__btn ovr-modal__btn--cancel"
                  onClick={() => setModalState({ open: false, scope: 'player' })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ovr-modal__btn ovr-modal__btn--confirm"
                  onClick={() =>
                    mutateRegistration(
                      computeRegistrationStatus(modalState.scope) === 'Active' ? 'close' : 'reopen',
                      modalState.scope
                    )
                  }
                >
                  Confirm
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>

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
    </TournamentAdminLayout>
  );
}

export default TournamentOverview;
