import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-team-details-page.css';

function TeamDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const defaultSeatPolicy = useMemo(() => ({ mode: 'single', votersRequired: 1, allowDynamicQuorum: true, allowLeadOverride: true }), []);
  const [seatPanel, setSeatPanel] = useState({ loading: false, seats: [], seatPolicy: null, accessCode: '' });
  const [seatForm, setSeatForm] = useState({ label: '', email: '', role: 'Strategist', isLead: false, isVoter: true });
  const [policyForm, setPolicyForm] = useState(defaultSeatPolicy);
  const [seatMessage, setSeatMessage] = useState('');
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch (err) {
      return null;
    }
  })();
  const token = localStorage.getItem('token');
  const isAdmin = Boolean(user && ['SuperAdmin', 'TournamentAdmin'].includes(user.role) && token);
  const tournamentPlan = useMemo(() => {
    const rawPlan = tournament?.plan;
    if (!rawPlan) return 'Standard';
    const normalized = rawPlan.toString().replace(/\s+/g, '').toLowerCase();
    if (normalized === 'standard') return 'Standard';
    if (normalized === 'auctionpro') return 'AuctionPro';
    if (normalized === 'lite' || normalized === 'liteplus') return 'Standard'; // Map old tiers to Standard
    return 'Standard';
  }, [tournament?.plan]);
  const isAuctionProTournament = tournamentPlan === 'AuctionPro';
  const dashboardLink = useMemo(() => {
    if (!tournament?.code) return '';
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    return `${origin}/team-dashboard/${tournament.code}`;
  }, [tournament?.code]);

  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    setError('');

    const endpoints = [
      `${API_BASE_URL}/api/teams/by-id/${id}`,
      `${API_BASE_URL}/api/teams/details/${id}`
    ];

    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        const res = await axios.get(endpoint);
        setTeam(res.data.team);
        setTournament(res.data.tournament);
        setLoading(false);
        return;
      } catch (err) {
        lastError = err;
        // If endpoint truly doesn't exist, continue to next one
        if (err.response?.status === 404 || err.response?.status === 400) {
          continue;
        }
        break;
      }
    }

    console.error('Error fetching team data:', lastError);
    const fallbackMessage = lastError?.response?.data?.message || lastError?.message || 'Unable to load team details right now.';
    setError(fallbackMessage);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#auction-pro') return;
    const el = document.getElementById('auction-pro');
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  const fetchSeatPanel = useCallback(async () => {
    if (!isAdmin || !team?._id || !isAuctionProTournament) return;
    try {
      setSeatPanel((prev) => ({ ...prev, loading: true }));
      const res = await axios.get(`${API_BASE_URL}/api/teams/admin/${team._id}/auction-pro`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setSeatPanel({
          loading: false,
          seats: res.data.seats || [],
          seatPolicy: res.data.seatPolicy || null,
          accessCode: res.data.auctionAccessCode || ''
        });
        setPolicyForm(res.data.seatPolicy || defaultSeatPolicy);
      } else {
        setSeatPanel((prev) => ({ ...prev, loading: false }));
      }
    } catch (seatErr) {
      console.error('Error fetching seat panel:', seatErr);
      setSeatPanel((prev) => ({ ...prev, loading: false }));
    }
  }, [isAdmin, team?._id, token, defaultSeatPolicy, isAuctionProTournament]);

  useEffect(() => {
    if (isAdmin && team?._id && isAuctionProTournament) {
      fetchSeatPanel();
    } else if (!isAuctionProTournament) {
      setSeatPanel({ loading: false, seats: [], seatPolicy: null, accessCode: '' });
    }
  }, [isAdmin, team?._id, isAuctionProTournament, fetchSeatPanel]);

  const buildLogoUrl = (logo) => {
    if (!logo) return '/default-logo.png';
    if (logo.startsWith('http')) return logo;
    if (logo.startsWith('uploads')) {
      return `${API_BASE_URL}/${logo}`;
    }
    if (logo.startsWith('/')) {
      return `${API_BASE_URL}${logo}`;
    }
    return `${API_BASE_URL}/${logo}`;
  };

  const buildPhotoUrl = (photo) => {
    if (!photo) return null;
    if (photo.startsWith('http')) return photo;
    if (photo.startsWith('uploads')) {
      return `${API_BASE_URL}/${photo}`;
    }
    if (photo.startsWith('/')) {
      return `${API_BASE_URL}${photo}`;
    }
    return `${API_BASE_URL}/uploads/${photo}`;
  };

  const handleBack = () => {
    if (tournament?.code) {
      navigate(`/tournament/${tournament.code}/teams`);
    } else {
      navigate(-1);
    }
  };

  const handleDownloadConfirmation = () => {
    if (!team?.confirmationPdf) {
      alert('Confirmation slip is not available.');
      return;
    }
    const pdfUrl = `${API_BASE_URL}/${team.confirmationPdf}`;
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareWhatsApp = () => {
    if (!team || !tournament) return;
    const message = `🏆 ${team.name} - Team Details\n\nTeam ID: ${team.teamId}\nCaptain: ${team.captainName}\nCity: ${team.city}\nTournament: ${tournament.name}\n\nView details: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
      alert('Unable to copy link. Please copy it manually.');
    }
  };

  const handleSeatFormChange = (field, value) => {
    setSeatForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateSeat = async (event) => {
    event.preventDefault();
    if (!seatForm.label) {
      setSeatMessage('Seat label is required.');
      return;
    }
    try {
      setSeatMessage('Creating seat…');
      const res = await axios.post(
        `${API_BASE_URL}/api/teams/admin/${team._id}/seats`,
        seatForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setSeatMessage('Seat created successfully.');
        alert(`Seat created!\nSeat Code: ${res.data.credentials.seatCode}\nPIN: ${res.data.credentials.pin}`);
        setSeatForm({ label: '', email: '', role: 'Strategist', isLead: false, isVoter: true });
        fetchSeatPanel();
      }
    } catch (err) {
      console.error('Error creating seat:', err);
      const message = err.response?.data?.message || 'Unable to create seat right now.';
      setSeatMessage(message);
    }
  };

  const handlePolicySave = async () => {
    try {
      setSeatMessage('Saving seat policy…');
      const res = await axios.patch(
        `${API_BASE_URL}/api/teams/admin/${team._id}/seat-policy`,
        policyForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setSeatMessage('Seat policy updated.');
        fetchSeatPanel();
      }
    } catch (err) {
      console.error('Policy update failed', err);
      const message = err.response?.data?.message || 'Unable to update policy.';
      setSeatMessage(message);
    }
  };

  const handleResetSeatPin = async (seatId) => {
    if (!window.confirm('Reset PIN for this seat? The new PIN will need to be shared manually.')) return;
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/teams/admin/${team._id}/seats/${seatId}/reset-pin`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        alert(`Pin reset!\nSeat Code: ${res.data.credentials.seatCode}\nNew PIN: ${res.data.credentials.pin}`);
        fetchSeatPanel();
      }
    } catch (err) {
      console.error('Failed to reset pin', err);
      alert(err.response?.data?.message || 'Unable to reset pin right now.');
    }
  };

  const handleToggleSeatStatus = async (seat) => {
    const isDisabled = seat.status === 'Disabled';
    const nextStatus = isDisabled ? 'Invited' : 'Disabled';
    const confirmText = isDisabled
      ? `Enable ${seat.label}? They will be able to log in again with their existing credentials.`
      : `Disable ${seat.label}? This blocks the seat from logging in until you enable it.`;
    if (!window.confirm(confirmText)) return;

    try {
      setSeatMessage('Updating seat status…');
      await axios.patch(
        `${API_BASE_URL}/api/teams/admin/${team._id}/seats/${seat.id}`,
        { status: nextStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSeatMessage(isDisabled ? 'Seat enabled.' : 'Seat disabled.');
      fetchSeatPanel();
    } catch (err) {
      console.error('Failed to toggle seat status', err);
      const message = err.response?.data?.message || 'Unable to update seat status right now.';
      setSeatMessage(message);
    }
  };

  const handleCopyAccessCode = async () => {
    if (!seatPanel.accessCode) return;
    try {
      await navigator.clipboard.writeText(seatPanel.accessCode);
      alert('Team auction access code copied to clipboard.');
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const handleCopyDashboardLink = async () => {
    if (!dashboardLink) return;
    try {
      await navigator.clipboard.writeText(dashboardLink);
      alert('Seat console link copied to clipboard.');
    } catch (err) {
      console.error('Failed to copy dashboard link', err);
    }
  };

  const seatInsights = useMemo(() => {
    const seats = seatPanel.seats || [];
    const total = seats.length;
    const active = seats.filter((seat) => seat.status === 'Active').length;
    const pending = seats.filter((seat) => seat.status !== 'Active').length;
    const voters = seats.filter((seat) => seat.isVoter).length;
    const leads = seats.filter((seat) => seat.isLead).length;
    const modeCopy =
      {
        single: 'Single controller',
        any: 'Any seat',
        majority: 'Majority vote',
        unanimous: 'Unanimous vote'
      }[policyForm.mode] || 'Custom policy';

    return {
      total,
      active,
      pending,
      voters,
      leads,
      modeCopy,
      votersRequired: policyForm.votersRequired || 1
    };
  }, [seatPanel.seats, policyForm.mode, policyForm.votersRequired]);

  const teamTags = useMemo(() => {
    if (!team) return [];
    return [
      team.city,
      tournament?.sport,
      tournament?.code,
      team.budget ? `Budget ₹${team.budget.toLocaleString()}` : null
    ].filter(Boolean);
  }, [team, tournament?.sport, tournament?.code]);

  if (loading) {
    return (
      <div className="team-details-page">
        <div className="team-details-container">
          <div className="team-details-loading">
            <div className="loading-spinner"></div>
            <p>Loading team details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="team-details-page">
        <div className="team-details-container">
          <div className="team-details-error">
            <span className="error-icon">⚠️</span>
            <h2>Unable to Load Team Details</h2>
            <p>{error || 'Team details were not found.'}</p>
            <button className="primary-btn" onClick={handleBack}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const purchasedPlayers = team.purchasedPlayers || [];
  const guestPlayers = team.guestPlayers || [];
  const totalSpent = purchasedPlayers.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
  const avgPrice = purchasedPlayers.length > 0 ? totalSpent / purchasedPlayers.length : 0;
  const budgetUsed = team.budget ? Math.min(100, Number(((totalSpent / team.budget) * 100).toFixed(1))) : 0;
  const budgetBalance = team.budget ? team.budget - totalSpent : 0;

  const contactItems = [
    { label: 'Captain', value: team.captainName },
    { label: 'City', value: team.city },
    { label: 'Mobile', value: team.mobile },
    { label: 'Email', value: team.email }
  ].filter(item => !!item.value);

  const infoSections = [
    {
      title: 'Team Snapshot',
      items: [
        { label: 'Team ID', value: team.teamId },
        { label: 'Players Registered', value: team.numberOfPlayers },
        { label: 'Registered On', value: team.createdAt ? new Date(team.createdAt).toLocaleDateString() : 'N/A' }
      ]
    },
    tournament && {
      title: 'Tournament',
      items: [
        { label: 'Name', value: tournament.name },
        { label: 'Sport', value: tournament.sport || 'N/A' },
        { label: 'Location', value: tournament.location || 'TBA' },
        { label: 'Start Date', value: tournament.startDate ? new Date(tournament.startDate).toLocaleDateString() : 'TBA' },
        { label: 'End Date', value: tournament.endDate ? new Date(tournament.endDate).toLocaleDateString() : 'TBA' },
        {
          label: 'Status',
          value: tournament.status || 'N/A',
          accent: true,
          status: tournament.status?.toLowerCase()
        }
      ]
    }
  ].filter(Boolean);

  const timelineEntries = (() => {
    const entries = [];
    if (team.createdAt) {
      entries.push({
        label: 'Registration Completed',
        date: new Date(team.createdAt).toLocaleDateString(),
        description: `${team.numberOfPlayers || 0} players submitted`
      });
    }
    if (purchasedPlayers.length) {
      entries.push({
        label: 'Auction Picks',
        date: 'Latest Activity',
        description: `${purchasedPlayers.length} player${purchasedPlayers.length > 1 ? 's' : ''} purchased`
      });
    }
    if (tournament?.startDate) {
      entries.push({
        label: 'Tournament Begins',
        date: new Date(tournament.startDate).toLocaleDateString(),
        description: tournament.location || 'Venue TBA'
      });
    }
    if (tournament?.endDate) {
      entries.push({
        label: 'Tournament Ends',
        date: new Date(tournament.endDate).toLocaleDateString(),
        description: 'Final whistle'
      });
    }
    return entries;
  })();

  return (
    <div className="team-details-page">
      <div className="team-details-backdrop" />
      <div className="team-details-glow" />
      <div className="team-details-container">
        <div className="team-details-header">
          <button className="ghost-btn" onClick={handleBack}>
            ← Teams
          </button>
          <div className="header-title-block">
            <span className="eyebrow">Team Profile</span>
            <h1>{team.name}</h1>
            <div className="team-id-inline" aria-label="Team Identifier">
              <span>Team ID</span>
              <strong>{team.teamId || '—'}</strong>
            </div>
            <p>{tournament?.name || 'Independent Registration'}</p>
          </div>
          <div className="header-actions">
            <button className="pill-btn" onClick={handleShareWhatsApp} title="Share on WhatsApp">
              💬 Share
            </button>
            <button className="pill-btn" onClick={handleCopyLink} title="Copy public link">
              🔗 Copy Link
            </button>
            {team.confirmationPdf && (
              <button className="pill-btn" onClick={handleDownloadConfirmation} title="Download confirmation PDF">
                📄 Confirmation
              </button>
            )}
          </div>
        </div>

        <div className="team-details-layout">
          <aside className="team-overview-panel">
            <div className="team-hero-card">
              <div className="team-hero-top">
                <div className="team-emblem">
                  {team.logo ? (
                    <img src={buildLogoUrl(team.logo)} alt={`${team.name} logo`} />
                  ) : (
                    <span>{team.name.charAt(0)}</span>
                  )}
                </div>
                <div className="team-hero-meta">
                  <span className="team-id-chip">{team.teamId}</span>
                  <h2>{team.name}</h2>
                  <p>{team.city || 'Location TBA'}</p>
                </div>
              </div>
              {teamTags.length > 0 && (
                <div className="team-tag-row">
                  {teamTags.map((tag, idx) => (
                    <span key={idx} className="team-tag">{tag}</span>
                  ))}
                </div>
              )}
              {tournament?.status && (
                <div className="team-status-chip" data-status={tournament.status?.toLowerCase()}>
                  {tournament.status}
                </div>
              )}
              <div className="team-progress-card">
                <div className="progress-heading">
                  <p>Budget Usage</p>
                  <strong>{budgetUsed}%</strong>
                </div>
                <div className="progress-bar">
                  <span style={{ width: `${budgetUsed}%` }} />
                </div>
                <div className="progress-stats">
                  <div>
                    <span>Spent</span>
                    <strong>₹{totalSpent.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Balance</span>
                    <strong>₹{budgetBalance.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="team-contact-card">
              <h3>Team Contacts</h3>
              <div className="contact-list">
                {contactItems.map(item => (
                  <div key={item.label} className="contact-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
              <div className="contact-actions">
                <button className="outline-btn" onClick={handleShareWhatsApp}>Share Profile</button>
                <button className="outline-btn" onClick={handleCopyLink}>Copy Link</button>
              </div>
            </div>

            {team.confirmationPdf && (
              <div className="team-download-card">
                <h3>Documents</h3>
                <p>Official confirmation slip for this team.</p>
                <button className="primary-btn" onClick={handleDownloadConfirmation}>
                  Download PDF
                </button>
              </div>
            )}
          </aside>

          <main className="team-content-panel">
            <section className="metrics-grid">
              <div className="metric-card">
                <span>Total Budget</span>
                <strong>₹{team.budget?.toLocaleString() || '0'}</strong>
                <p>Allocated for auction</p>
              </div>
              <div className="metric-card">
                <span>Players Purchased</span>
                <strong>{purchasedPlayers.length}</strong>
                <p>With average ₹{avgPrice.toFixed(0)}</p>
              </div>
              <div className="metric-card">
                <span>Guest Players</span>
                <strong>{guestPlayers.length}</strong>
                <p>Approved additions</p>
              </div>
              <div className="metric-card">
                <span>Tournament Sport</span>
                <strong>{tournament?.sport || 'N/A'}</strong>
                <p>{tournament?.location || 'Location TBA'}</p>
              </div>
            </section>

            <section className="info-panels">
              {infoSections.map(section => (
                <div className="info-panel" key={section.title}>
                  <div className="panel-heading">
                    <h3>{section.title}</h3>
                  </div>
                  <div className="panel-grid">
                    {section.items.map(item => (
                      <div className="panel-item" key={item.label}>
                        <span>{item.label}</span>
                        {item.accent ? (
                          <strong className="status-pill" data-status={item.status}>
                            {item.value}
                          </strong>
                        ) : (
                          <strong>{item.value}</strong>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {timelineEntries.length > 0 && (
              <section className="timeline-section">
                <div className="panel-heading">
                  <h3>Journey</h3>
                  <p>Key updates for this team</p>
                </div>
                <div className="timeline">
                  {timelineEntries.map((entry, index) => (
                    <div key={entry.label} className="timeline-entry">
                      <div className="timeline-node" />
                      <div className="timeline-body">
                        <span>{entry.date}</span>
                        <strong>{entry.label}</strong>
                        <p>{entry.description}</p>
                      </div>
                      {index !== timelineEntries.length - 1 && <span className="timeline-connector" />}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {purchasedPlayers.length > 0 && (
              <section className="players-section">
                <div className="panel-heading">
                  <h3>Purchased Players</h3>
                  <span>{purchasedPlayers.length} listed</span>
                </div>
                <div className="players-grid">
                  {purchasedPlayers.map((player) => (
                    <div key={player._id} className="player-card">
                      {player.photo ? (
                        <img
                          src={buildPhotoUrl(player.photo)}
                          alt={player.name}
                          className="player-photo"
                        />
                      ) : (
                        <div className="player-photo-placeholder">
                          <span>{player.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="player-info">
                        <div className="player-name">{player.name}</div>
                        <div className="player-id">{player.playerId}</div>
                        <div className="player-role">{player.role || 'N/A'}</div>
                        <div className="player-price">₹{player.soldPrice?.toLocaleString() || '0'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {guestPlayers.length > 0 && (
              <section className="guest-players-section">
                <div className="panel-heading">
                  <h3>Guest Players</h3>
                  <span>{guestPlayers.length} approved</span>
                </div>
                <div className="guest-players-grid">
                  {guestPlayers.map((guest, index) => (
                    <div key={index} className="guest-player-card">
                      {guest.photo ? (
                        <img
                          src={buildPhotoUrl(guest.photo)}
                          alt={guest.name}
                          className="guest-photo"
                        />
                      ) : (
                        <div className="guest-photo-placeholder">
                          <span>{guest.name?.charAt(0) || 'G'}</span>
                        </div>
                      )}
                      <div className="guest-info">
                        <div className="guest-name">{guest.name}</div>
                        {guest.role && <div className="guest-role">{guest.role}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {isAdmin && isAuctionProTournament && (
              <section id="auction-pro" className="seat-panel">
                <div className="seat-hero">
                  <div>
                    <span className="seat-eyebrow">Auction Pro • Remote Seats</span>
                    <h3>Auction Pro Seats</h3>
                    <p>Distribute control codes, keep the console links handy, and lock in how your remote voters approve every bid.</p>
                  </div>
                  <div className="seat-hero-badge">
                    <span>Plan</span>
                    <strong>{tournamentPlan}</strong>
                  </div>
                </div>

                {seatPanel.loading ? (
                  <div className="seat-panel-loading">
                    <div className="loading-spinner" />
                    <p>Preparing seat console…</p>
                  </div>
                ) : (
                  <>
                    <div className="seat-credential-grid">
                      <div className="seat-credential-card" data-ready={Boolean(seatPanel.accessCode)}>
                        <div className="card-heading">
                          <span>Team Access Code</span>
                          <button type="button" disabled={!seatPanel.accessCode} onClick={handleCopyAccessCode}>
                            Copy
                          </button>
                        </div>
                        <strong>{seatPanel.accessCode || 'Generating…'}</strong>
                        <p>Share once with your on-site auctioneer to unlock remote seats.</p>
                      </div>
                      <div className="seat-credential-card seat-console-card" data-ready={Boolean(dashboardLink)}>
                        <div className="card-heading">
                          <span>Seat Console</span>
                          {dashboardLink ? (
                            <div className="seat-console-buttons">
                              <button type="button" onClick={() => window.open(dashboardLink, '_blank', 'noopener,noreferrer')}>
                                Open
                              </button>
                              <button type="button" onClick={handleCopyDashboardLink}>
                                Copy Link
                              </button>
                            </div>
                          ) : (
                            <small>Awaiting tournament link</small>
                          )}
                        </div>
                        <strong>{tournament?.code ? `/team-dashboard/${tournament.code}` : 'Not linked yet'}</strong>
                        <p>Live dashboard for strategists and remote captains.</p>
                      </div>
                    </div>

                    <div className="seat-stats-grid">
                      <div className="seat-stat-card">
                        <span>Seats live</span>
                        <strong>{seatInsights.active}</strong>
                        <p>{seatInsights.total} configured</p>
                      </div>
                      <div className="seat-stat-card">
                        <span>Voters ready</span>
                        <strong>{seatInsights.voters}</strong>
                        <p>{seatInsights.modeCopy}</p>
                      </div>
                      <div className="seat-stat-card">
                        <span>Lead seats</span>
                        <strong>{seatInsights.leads}</strong>
                        <p>Quorum {seatInsights.votersRequired} vote(s)</p>
                      </div>
                      <div className="seat-stat-card">
                        <span>Pending invites</span>
                        <strong>{seatInsights.pending}</strong>
                        <p>{seatInsights.active === seatInsights.total ? 'All seats active' : 'Need activation'}</p>
                      </div>
                    </div>

                    <div className="seat-policy-card">
                      <div className="seat-policy-header">
                        <div>
                          <span>Voting policy</span>
                          <h4>Control how bids are approved</h4>
                          <p>Fine-tune quorum, modes, and override behaviour.</p>
                        </div>
                        <button type="button" onClick={handlePolicySave}>
                          Save Policy
                        </button>
                      </div>
                      <div className="seat-policy-grid">
                        <label>
                          Mode
                          <select
                            value={policyForm.mode}
                            onChange={(e) => setPolicyForm((prev) => ({ ...prev, mode: e.target.value }))}
                          >
                            <option value="single">Single Controller</option>
                            <option value="any">Any Seat</option>
                            <option value="majority">Majority</option>
                            <option value="unanimous">Unanimous</option>
                          </select>
                        </label>
                        <label>
                          Votes Required
                          <input
                            type="number"
                            min="1"
                            value={policyForm.votersRequired || 1}
                            onChange={(e) => setPolicyForm((prev) => ({ ...prev, votersRequired: Number(e.target.value) }))}
                          />
                        </label>
                        <label className="seat-toggle">
                          <input
                            type="checkbox"
                            checked={policyForm.allowDynamicQuorum !== false}
                            onChange={(e) => setPolicyForm((prev) => ({ ...prev, allowDynamicQuorum: e.target.checked }))}
                          />
                          Dynamic quorum
                        </label>
                        <label className="seat-toggle">
                          <input
                            type="checkbox"
                            checked={policyForm.allowLeadOverride !== false}
                            onChange={(e) => setPolicyForm((prev) => ({ ...prev, allowLeadOverride: e.target.checked }))}
                          />
                          Lead override
                        </label>
                      </div>
                      <p className="seat-policy-hint">Changes go live instantly inside the Auction Pro Console.</p>
                    </div>

                    <div className="seat-table-card">
                      <div className="seat-table-heading">
                        <div>
                          <span>Seat roster</span>
                          <strong>{seatInsights.total} seats</strong>
                        </div>
                        <button type="button" className="seat-refresh-btn" onClick={fetchSeatPanel}>
                          Refresh
                        </button>
                      </div>
                      <div className="seat-table-wrapper">
                        {seatPanel.seats?.length ? (
                          <table className="seat-table">
                            <thead>
                              <tr>
                                <th>Seat</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Voter</th>
                                <th>Lead</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {seatPanel.seats.map((seat) => (
                                <tr key={seat.id}>
                                  <td>
                                    <div className="seat-name">{seat.label}</div>
                                    <div className="seat-email">{seat.email || '—'}</div>
                                  </td>
                                  <td>{seat.role}</td>
                                  <td>
                                    <span className="seat-status-pill" data-status={(seat.status || '').toLowerCase()}>
                                      {seat.status}
                                    </span>
                                  </td>
                                  <td>{seat.isVoter ? 'Yes' : 'No'}</td>
                                  <td>{seat.isLead ? 'Yes' : 'No'}</td>
                                  <td>
                                    <div className="seat-action-stack">
                                      <button
                                        type="button"
                                        data-variant="reset"
                                        onClick={() => handleResetSeatPin(seat.id)}
                                      >
                                        Reset PIN
                                      </button>
                                      <button
                                        type="button"
                                        data-variant="toggle"
                                        data-state={seat.status === 'Disabled' ? 'enable' : 'disable'}
                                        onClick={() => handleToggleSeatStatus(seat)}
                                      >
                                        {seat.status === 'Disabled' ? 'Enable' : 'Disable'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p>No seats created yet. Use the form below to invite team members.</p>
                        )}
                      </div>
                    </div>

                    <form className="seat-form seat-form-card" onSubmit={handleCreateSeat}>
                      <div className="seat-form-header">
                        <div>
                          <span>Create seat</span>
                          <h4>Generate secure remote access</h4>
                          <p>Each seat gets a unique code and PIN instantly.</p>
                        </div>
                        <button type="submit">Create Seat</button>
                      </div>
                      <div className="seat-form-grid">
                        <label>
                          Seat Label
                          <input
                            type="text"
                            value={seatForm.label}
                            onChange={(e) => handleSeatFormChange('label', e.target.value)}
                            placeholder="e.g., Captain Desk"
                          />
                        </label>
                        <label>
                          Email (optional)
                          <input
                            type="email"
                            value={seatForm.email}
                            onChange={(e) => handleSeatFormChange('email', e.target.value)}
                            placeholder="name@team.com"
                          />
                        </label>
                        <label>
                          Role
                          <select
                            value={seatForm.role}
                            onChange={(e) => handleSeatFormChange('role', e.target.value)}
                          >
                            <option value="Lead">Lead</option>
                            <option value="Strategist">Strategist</option>
                            <option value="Finance">Finance</option>
                            <option value="Analyst">Analyst</option>
                            <option value="Viewer">Viewer</option>
                          </select>
                        </label>
                        <label className="seat-checkbox">
                          <input
                            type="checkbox"
                            checked={seatForm.isVoter}
                            onChange={(e) => handleSeatFormChange('isVoter', e.target.checked)}
                          />
                          Can vote
                        </label>
                        <label className="seat-checkbox">
                          <input
                            type="checkbox"
                            checked={seatForm.isLead}
                            onChange={(e) => handleSeatFormChange('isLead', e.target.checked)}
                          />
                          Lead seat
                        </label>
                      </div>
                      {seatMessage && <p className="seat-message">{seatMessage}</p>}
                    </form>
                  </>
                )}
              </section>
            )}

            <div className="team-details-footer">
              <button className="outline-btn" onClick={handleBack}>
                Back to Teams
              </button>
              {tournament?.code && (
                <button
                  className="primary-btn"
                  onClick={() => navigate(`/tournament/${tournament.code}/teams`)}
                >
                  View All Teams
                </button>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default TeamDetailsPage;

