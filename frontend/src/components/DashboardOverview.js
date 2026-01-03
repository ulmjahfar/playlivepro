import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import TournamentCreate from '../TournamentCreate';
import { API_BASE_URL } from '../utils/apiConfig';

const DashboardOverview = ({ tournaments = [], loading, stats = {}, onTournamentSuccess }) => {
  const navigate = useNavigate();
  const [activityReloadToken, setActivityReloadToken] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [adminName, setAdminName] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      if (!stored) return 'Super Admin';
      const parsed = JSON.parse(stored);
      return parsed?.name || parsed?.fullName || parsed?.email || 'Super Admin';
    } catch {
      return 'Super Admin';
    }
  });
  const [now, setNow] = useState(new Date());

  const handleTournamentSuccess = () => {
    onTournamentSuccess();
    setShowCreateModal(false);
  };

  useEffect(() => {
    let ignore = false;

    const loadActivity = async () => {
      try {
        const token = localStorage.getItem('token');
        await axios.get(`${API_BASE_URL}/api/dashboard/activity?limit=10`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (ignore) return;
      } catch (err) {
        if (ignore) return;
        console.error('Error loading dashboard activity:', err);
      }
    };

    loadActivity();
    const interval = setInterval(() => loadActivity(), 60_000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [activityReloadToken]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const syncAdminName = () => {
      try {
        const stored = localStorage.getItem('user');
        if (!stored) return;
        const parsed = JSON.parse(stored);
        setAdminName(parsed?.name || parsed?.fullName || parsed?.email || 'Super Admin');
      } catch {
        setAdminName('Super Admin');
      }
    };
    window.addEventListener('storage', syncAdminName);
    return () => window.removeEventListener('storage', syncAdminName);
  }, []);

  const safeTournaments = useMemo(() => tournaments || [], [tournaments]);
  const pendingStatuses = useMemo(() => ['pending', 'draft', 'review'], []);
  const dayInMs = 24 * 60 * 60 * 1000;

  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Hello';
  }, [now]);

  const formattedDate = useMemo(
    () =>
      now.toLocaleDateString('en-IN', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      }),
    [now]
  );

  const formattedTime = useMemo(
    () =>
      now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      }),
    [now]
  );

  const handleNavigateSection = useCallback((section) => {
    window.dispatchEvent(new CustomEvent('superadmin:navigate', { detail: section }));
  }, []);

  const quickActions = useMemo(
    () => [
      {
        label: 'Create Tournament',
        helper: 'Launch wizard',
        icon: '➕',
        action: () => setShowCreateModal(true)
      },
      {
        label: 'Manage Tournaments',
        helper: 'Full inventory',
        icon: '📋',
        action: () => handleNavigateSection('tournaments')
      },
      {
        label: 'Open Reports',
        helper: 'Insights & exports',
        icon: '📊',
        action: () => handleNavigateSection('reports')
      },
      {
        label: 'Audit Logs',
        helper: 'Track every change',
        icon: '🕵️',
        action: () => navigate('/audit-logs')
      },
      {
        label: 'System Settings',
        helper: 'Feature flags & access',
        icon: '⚙️',
        action: () => handleNavigateSection('settings')
      }
    ],
    [handleNavigateSection, navigate]
  );

  // Tier Coverage Data
  const tierCoverage = useMemo(() => {
    const tierCounts = {};
    safeTournaments.forEach((t) => {
      const tier = t.tier || 'STANDARD';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });
    const total = safeTournaments.length;
    const activeCount = safeTournaments.filter((t) => t.status === 'Active').length;
    const topTier = Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      activeTournaments: activeCount,
      topTier: topTier ? topTier[0] : 'STANDARD',
      topTierCount: topTier ? topTier[1] : 0,
      totalTiers: Object.keys(tierCounts).length,
      percentage: total > 0 ? Math.round(((topTier ? topTier[1] : 0) / total) * 100) : 0
    };
  }, [safeTournaments]);

  // Sports Mix Data
  const sportsMix = useMemo(() => {
    const sportCounts = {};
    safeTournaments.forEach((t) => {
      const sport = t.sport || 'Cricket';
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });
    const topSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0];
    const total = safeTournaments.length;
    return {
      topSport: topSport ? topSport[0] : 'Cricket',
      topSportCount: topSport ? topSport[1] : 0,
      percentage: total > 0 ? Math.round(((topSport ? topSport[1] : 0) / total) * 100) : 0
    };
  }, [safeTournaments]);

  // Readiness Radar Data
  const readinessRadar = useMemo(() => {
    const current = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const threeDays = 3 * oneDay;
    const oneWeek = 7 * oneDay;

    let critical = 0;
    let warning = 0;
    let info = 0;
    let disabled = 0;
    let auctionReady = 0;

    safeTournaments.forEach((t) => {
      if (t.autoDeleteAt) {
        const deleteDate = new Date(t.autoDeleteAt);
        const diff = deleteDate.getTime() - current.getTime();
        if (diff > 0 && diff <= oneDay) critical++;
        else if (diff > oneDay && diff <= threeDays) warning++;
        else if (diff > threeDays && diff <= oneWeek) info++;
      }
      if (t.autoDeleteEnabled === false) disabled++;
      if (t.auctionEnabled === true) auctionReady++;
    });

    return { critical, warning, info, disabled, auctionReady };
  }, [safeTournaments]);

  const latestLaunches = useMemo(() => {
    return safeTournaments
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 1);
  }, [safeTournaments]);

  const reviewQueueCount = useMemo(
    () =>
      safeTournaments.filter((t) => pendingStatuses.includes((t.status || '').toLowerCase())).length,
    [pendingStatuses, safeTournaments]
  );

  const manualRetentionCount = readinessRadar.disabled;
  const cleanupSoonCount = readinessRadar.critical + readinessRadar.warning;

  const needsAttention = useMemo(() => {
    const nowTs = Date.now();
    return safeTournaments
      .filter((t) => {
        const status = (t.status || '').toLowerCase();
        const pending = pendingStatuses.includes(status);
        const cleanupDate = t.autoDeleteAt ? new Date(t.autoDeleteAt).getTime() : null;
        const cleanupSoon = cleanupDate ? cleanupDate - nowTs <= 3 * dayInMs : false;
        const manualRetention = t.autoDeleteEnabled === false;
        return pending || cleanupSoon || manualRetention;
      })
      .sort((a, b) => {
        const aDate = new Date(a.autoDeleteAt || a.updatedAt || 0).getTime();
        const bDate = new Date(b.autoDeleteAt || b.updatedAt || 0).getTime();
        return aDate - bDate;
      })
      .slice(0, 4);
  }, [dayInMs, pendingStatuses, safeTournaments]);

  const automationCoverage = useMemo(() => {
    if (!safeTournaments.length) return 0;
    const enabled = safeTournaments.filter((t) => t.autoDeleteEnabled !== false).length;
    return Math.round((enabled / safeTournaments.length) * 100);
  }, [safeTournaments]);

  const auctionReadyShare = useMemo(() => {
    if (!safeTournaments.length) return 0;
    return Math.round((readinessRadar.auctionReady / safeTournaments.length) * 100);
  }, [readinessRadar.auctionReady, safeTournaments]);

  const pausedAuctions = useMemo(
    () => safeTournaments.filter((t) => t.auctionEnabled === false).length,
    [safeTournaments]
  );

  return (
    <div className="dashboard-overview">
      <section className="overview-hero surface-card">
        <div className="overview-hero-text">
          <span className="overview-eyebrow">{greeting}</span>
          <h2>{adminName}, welcome back 👋</h2>
          <p>
            {stats.active || stats.total
              ? `You are monitoring ${stats.active || 0} live tournaments out of ${stats.total || 0} total instances.`
              : 'Everything is staged for your next launch.'}
          </p>
        </div>
        <div className="overview-hero-meta">
          <div className="overview-hero-date">
            <span>{formattedDate}</span>
            <strong>{formattedTime}</strong>
          </div>
          <div className="overview-hero-badge">
            <span>Review queue</span>
            <strong>{reviewQueueCount}</strong>
          </div>
          <div className="overview-hero-badge">
            <span>Cleanup soon</span>
            <strong>{cleanupSoonCount}</strong>
          </div>
        </div>
      </section>

      <section className="kpi-ribbon">
        <article className="kpi-card">
          <header>Active</header>
          <strong>{stats.active || 0}</strong>
          <span>Currently live</span>
        </article>
        <article className="kpi-card">
          <header>Upcoming</header>
          <strong>{stats.upcoming || 0}</strong>
          <span>Ready for launch</span>
        </article>
        <article className="kpi-card">
          <header>Completed</header>
          <strong>{stats.completed || 0}</strong>
          <span>Archived safely</span>
        </article>
        <article className="kpi-card">
          <header>Manual retention</header>
          <strong>{manualRetentionCount}</strong>
          <span>Auto-delete disabled</span>
        </article>
      </section>

      <section className="operations-grid">
        <div className="surface-card quick-actions-panel">
          <div className="panel-header minimal">
            <div>
              <p className="panel-eyebrow">Command Center</p>
              <h3>Quick actions</h3>
            </div>
            <span className="panel-meta">Instant routing</span>
          </div>
          <div className="quick-actions-grid">
            {quickActions.map((action) => (
              <button key={action.label} className="quick-action" onClick={action.action} type="button">
                <div className="quick-action-icon">{action.icon}</div>
                <div className="quick-action-labels">
                  <strong>{action.label}</strong>
                  <span>{action.helper}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="surface-card attention-panel">
          <div className="panel-header minimal">
            <div>
              <p className="panel-eyebrow">Signals</p>
              <h3>Needs attention</h3>
            </div>
            <span className="panel-meta">{needsAttention.length || 'No'} flagged</span>
          </div>
          <div className="attention-list">
            {needsAttention.length === 0 && <p className="empty-attention-state">All systems green.</p>}
            {needsAttention.map((tournament) => {
              const statusLabel = tournament.status || 'Unknown';
              const cleanupDate = tournament.autoDeleteAt
                ? new Date(tournament.autoDeleteAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short'
                  })
                : null;
              return (
                <article key={tournament._id || tournament.code} className="attention-item">
                  <div>
                    <strong>{tournament.name}</strong>
                    <span>{statusLabel}</span>
                  </div>
                  <div className="attention-meta">
                    {cleanupDate && <span className="attention-pill warning">Deletes {cleanupDate}</span>}
                    {tournament.autoDeleteEnabled === false && (
                      <span className="attention-pill muted">Manual retention</span>
                    )}
                    {pendingStatuses.includes((tournament.status || '').toLowerCase()) && (
                      <span className="attention-pill info">Awaiting review</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="surface-card system-health-panel">
          <div className="panel-header minimal">
            <div>
              <p className="panel-eyebrow">Observability</p>
              <h3>System health</h3>
            </div>
            <span className="panel-meta">Live signals</span>
          </div>
          <div className="system-health-grid">
            <div className="health-stat">
              <p>Automation coverage</p>
              <strong>{automationCoverage}%</strong>
              <span>Auto-delete enabled</span>
            </div>
            <div className="health-stat">
              <p>Auction ready</p>
              <strong>{auctionReadyShare}%</strong>
              <span>{readinessRadar.auctionReady} tournaments</span>
            </div>
            <div className="health-stat">
              <p>Auctions paused</p>
              <strong>{pausedAuctions}</strong>
              <span>Manual oversight</span>
            </div>
            <div className="health-stat">
              <p>Cleanup in 72h</p>
              <strong>{cleanupSoonCount}</strong>
              <span>Critical + warning</span>
            </div>
          </div>
        </div>
      </section>

      <div className="dashboard-cards-grid">
        <section className="dashboard-card surface-card">
          <div className="dashboard-card-header">
            <h3 className="dashboard-card-title">LATEST LAUNCHES</h3>
            <div className="dashboard-card-subtitles">
              <span className="dashboard-card-subtitle-1">Recently created</span>
              <span className="dashboard-card-subtitle-2">Fresh additions in the last rollout</span>
            </div>
          </div>
          <div className="dashboard-card-content">
            {latestLaunches.length === 0 ? (
              <div className="empty-launch-state">No recent launches</div>
            ) : (
              latestLaunches.map((tournament) => {
                const createdDate = tournament.createdAt
                  ? new Date(tournament.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                  : 'N/A';
                const year = tournament.year || new Date(tournament.createdAt || Date.now()).getFullYear();
                return (
                  <div key={tournament._id || tournament.code} className="launch-card">
                    <div className="launch-card-content">
                      <div className="launch-name">{tournament.name}</div>
                      <div className="launch-year">{year}</div>
                      <div className="launch-date">{createdDate}</div>
                      <div className="launch-meta">
                        <span className="launch-dot"></span>
                        <span className="launch-tier-tag">{tournament.tier || 'STANDARD'}</span>
                        <span className="launch-status">Active</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="launch-open-btn"
                      onClick={() => navigate(`/tournament/${tournament.code}/overview`)}
                    >
                      Open
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="dashboard-card surface-card">
          <div className="dashboard-card-header">
            <h3 className="dashboard-card-title">TIER COVERAGE</h3>
            <div className="dashboard-card-subtitles">
              <span className="dashboard-card-subtitle-1">Plan distribution</span>
              <span className="dashboard-card-subtitle-2">{tierCoverage.activeTournaments} active tournaments</span>
            </div>
          </div>
          <div className="dashboard-card-content">
            <div className="tier-tag-wrapper">
              <span className="tier-tag">{tierCoverage.topTier}</span>
              <div className="progress-bar-wrapper">
                <div className="progress-bar" style={{ width: `${tierCoverage.percentage}%` }}></div>
                <span className="progress-text">
                  {tierCoverage.topTierCount}-{tierCoverage.percentage}%
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-card surface-card">
          <div className="dashboard-card-header">
            <h3 className="dashboard-card-title">SPORTS MIX</h3>
            <div className="dashboard-card-subtitles">
              <span className="dashboard-card-subtitle-1">Top disciplines</span>
              <span className="dashboard-card-subtitle-2">Leading sports by volume</span>
            </div>
          </div>
          <div className="dashboard-card-content">
            <div className="sport-item">
              <span className="sport-name">{sportsMix.topSport}</span>
              <div className="progress-bar-wrapper">
                <div className="progress-bar" style={{ width: `${sportsMix.percentage}%` }}></div>
                <span className="progress-text">
                  {sportsMix.topSportCount}-{sportsMix.percentage}%
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-card surface-card">
          <div className="dashboard-card-header">
            <h3 className="dashboard-card-title">READINESS RADAR</h3>
            <div className="dashboard-card-subtitles">
              <span className="dashboard-card-subtitle-1">Deletion & governance</span>
              <span className="dashboard-card-subtitle-2">Monitor upcoming clean-ups</span>
            </div>
          </div>
          <div className="dashboard-card-content">
            <div className="readiness-grid">
              <div className="readiness-status-card critical">
                <div className="readiness-label">CRITICAL</div>
                <div className="readiness-value">{readinessRadar.critical}</div>
                <div className="readiness-description">Deleting within 24h</div>
              </div>
              <div className="readiness-status-card warning">
                <div className="readiness-label">WARNING</div>
                <div className="readiness-value">{readinessRadar.warning}</div>
                <div className="readiness-description">Deletes in 3 days</div>
              </div>
              <div className="readiness-status-card info">
                <div className="readiness-label">INFO</div>
                <div className="readiness-value">{readinessRadar.info}</div>
                <div className="readiness-description">Less than a week</div>
              </div>
              <div className="readiness-status-card disabled">
                <div className="readiness-label">DISABLED</div>
                <div className="readiness-value">{readinessRadar.disabled}</div>
                <div className="readiness-description">Manual retention</div>
              </div>
              <div className="readiness-status-card auction-ready">
                <div className="readiness-label">AUCTION READY</div>
                <div className="readiness-value">{readinessRadar.auctionReady}</div>
                <div className="readiness-description">Auctions enabled</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {showCreateModal && (
        <TournamentCreate onSuccess={handleTournamentSuccess} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
};

export default DashboardOverview;
