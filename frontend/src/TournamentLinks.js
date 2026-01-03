import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { copyToClipboard } from './utils/clipboard';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-admin-modern.css';
import './styles-registration-links.css';

function TournamentLinks() {
  const [tournament, setTournament] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingPlayerRegistration, setIsUpdatingPlayerRegistration] = useState(false);
  const [isUpdatingTeamRegistration, setIsUpdatingTeamRegistration] = useState(false);
  const [copiedLinks, setCopiedLinks] = useState({});
  const [customLinks, setCustomLinks] = useState([]);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [linkForm, setLinkForm] = useState({ title: '', url: '', description: '', icon: '🔗', category: 'Custom', order: 0 });
  const [isSavingLink, setIsSavingLink] = useState(false);
  const navigate = useNavigate();
  const { code } = useParams();

  useEffect(() => {
    if (tournament?.name) {
      document.title = `Tournament Links - ${tournament.name}`;
    } else {
      document.title = 'Tournament Links';
    }
    return () => {
      document.title = 'Tournament Dashboard';
    };
  }, [tournament]);

  const fetchCustomLinks = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tournaments/${code}/custom-links`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomLinks(res.data.customLinks || []);
    } catch (err) {
      console.error('Error fetching custom links:', err);
      // Don't show error toast if it's just a 404 or permission issue
      if (err.response?.status !== 404 && err.response?.status !== 403) {
        toast.error('Failed to load custom links');
      }
    }
  }, [code]);

  const fetchTournament = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTournament(res.data.tournament);
    } catch (err) {
      console.error('Error fetching tournament:', err);
      toast.error('Failed to load tournament information');
    }
  }, [code]);

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
          toast.error('You do not have access to this page');
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

    const loadTournament = async () => {
      setIsLoading(true);
      await fetchTournament();
      await fetchCustomLinks();
      setIsLoading(false);
    };
    loadTournament();

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
  }, [navigate, code, fetchCustomLinks, fetchTournament]);

  const baseUrl = window.location.origin;

  // Only include links that actually exist as routes
  const links = useMemo(() => {
    if (!tournament || !code) return {};
    return {
      // Registration Links
      playerRegistration: tournament.registrationLink || `${baseUrl}/register/${code}`,
      teamRegistration: tournament.teamRegistrationLink || `${baseUrl}/register/team/${code}`,
      
      // Live/Auction Links
      liveDisplay: `${baseUrl}/tournament/${code}/live`,
      liveAuction: `${baseUrl}/live/${code}`,
      liveStream: tournament.liveStreamUrl || `${baseUrl}/tournament/${code}/stream`,
      
      // Competition & Results
      schedule: `${baseUrl}/tournament/${code}/schedule`,
      auctionResults: `${baseUrl}/auction-results/${code}`,
      registeredPlayers: `${baseUrl}/registered-players/${code}`,
      
      // Admin Links
      overview: `${baseUrl}/tournament/${code}/overview`,
      players: `${baseUrl}/tournament/${code}/players`,
      teams: `${baseUrl}/tournament/${code}/teams`,
      broadcast: `${baseUrl}/tournament/${code}/broadcast`,
      auctionAdmin: `${baseUrl}/tournament/${code}/auction`,
      
      // Team Dashboard
      teamDashboard: `${baseUrl}/team-dashboard/${code}`
    };
  }, [tournament, code, baseUrl]);

  const copyLink = async (linkKey, link, label) => {
    if (!link) {
      toast.error('Link is not available yet');
      return;
    }
    const success = await copyToClipboard(link);
    if (success) {
      setCopiedLinks(prev => ({ ...prev, [linkKey]: true }));
      setTimeout(() => {
        setCopiedLinks(prev => ({ ...prev, [linkKey]: false }));
      }, 2000);
      toast.success(`${label} link copied!`);
    } else {
      toast.error('Failed to copy link');
    }
  };

  const openLink = (link, label) => {
    if (!link) {
      toast.error('Link is not available yet');
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const shareOnWhatsApp = (message, link) => {
    if (!link) {
      toast.error('Link is not available yet');
      return;
    }
    const text = `${message}\n${link}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const shareOnTwitter = (message, link) => {
    if (!link) {
      toast.error('Link is not available yet');
      return;
    }
    const text = `${message} ${link}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
  };

  const shareOnFacebook = (link) => {
    if (!link) {
      toast.error('Link is not available yet');
      return;
    }
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
    window.open(facebookUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTogglePlayerRegistration = async () => {
    if (!tournament) return;
    setIsUpdatingPlayerRegistration(true);
    try {
      const token = localStorage.getItem('token');
      const currentStatus = getPlayerRegistrationStatus();
      const endpoint =
        currentStatus === 'Active'
          ? `${API_BASE_URL}/api/tournaments/${code}/close-registration`
          : `${API_BASE_URL}/api/tournaments/${code}/reopen-registration`;

      const response = await axios.put(
        endpoint,
        { scope: 'player' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(response.data?.message || 'Player registration updated successfully');
      await fetchTournament();
    } catch (err) {
      console.error('Error updating player registration status:', err);
      toast.error('Could not update player registration status');
    } finally {
      setIsUpdatingPlayerRegistration(false);
    }
  };

  const handleToggleTeamRegistration = async () => {
    if (!tournament) return;
    setIsUpdatingTeamRegistration(true);
    try {
      const token = localStorage.getItem('token');
      const currentStatus = getTeamRegistrationStatus();
      const endpoint =
        currentStatus === 'Active'
          ? `${API_BASE_URL}/api/tournaments/${code}/close-registration`
          : `${API_BASE_URL}/api/tournaments/${code}/reopen-registration`;

      const response = await axios.put(
        endpoint,
        { scope: 'team' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(response.data?.message || 'Team registration updated successfully');
      await fetchTournament();
    } catch (err) {
      console.error('Error updating team registration status:', err);
      toast.error('Could not update team registration status');
    } finally {
      setIsUpdatingTeamRegistration(false);
    }
  };

  const getPlayerRegistrationStatus = () => {
    if (!tournament) return 'Not Started';
    const now = new Date();
    const start = tournament.registrationStartDate ? new Date(tournament.registrationStartDate) : null;
    const end = tournament.registrationEndDate ? new Date(tournament.registrationEndDate) : null;

    if (start && now < start) return 'Not Started';
    if (end && now > end) return 'Closed';

    return tournament.playerRegistrationEnabled ? 'Active' : 'Closed';
  };

  const getTeamRegistrationStatus = () => {
    if (!tournament) return 'Not Started';
    return tournament.teamRegistrationEnabled ? 'Active' : 'Closed';
  };

  const getAuctionStatus = () => {
    if (!tournament) return 'Not Started';
    return tournament.auctionState?.status || tournament.auctionStatus || 'Not Started';
  };

  const statusBadge = (status, type = 'default') => {
    const normalized = (status || 'Not Started').toLowerCase().replace(/\s+/g, '-');
    const statusConfig = {
      'active': { emoji: '🟢', class: 'active' },
      'running': { emoji: '🟢', class: 'active' },
      'upcoming': { emoji: '🔵', class: 'upcoming' },
      'closed': { emoji: '🔴', class: 'closed' },
      'completed': { emoji: '✅', class: 'completed' },
      'end': { emoji: '🏁', class: 'completed' },
      'not-started': { emoji: '🟡', class: 'not-started' },
      'notstarted': { emoji: '🟡', class: 'not-started' },
      'paused': { emoji: '⏸️', class: 'paused' }
    };
    
    const config = statusConfig[normalized] || { emoji: '⚪', class: 'default' };
    return (
      <span className={`status-badge ${config.class}`}>
        {config.emoji} {status}
      </span>
    );
  };

  const formatDate = (value) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (err) {
      return value;
    }
  };

  const handleAddLink = () => {
    setEditingLink(null);
    setLinkForm({ title: '', url: '', description: '', icon: '🔗', category: 'Custom', order: customLinks.length });
    setShowAddLinkModal(true);
  };

  const handleEditLink = (link) => {
    setEditingLink(link);
    setLinkForm({
      title: link.title,
      url: link.url,
      description: link.description || '',
      icon: link.icon || '🔗',
      category: link.category || 'Custom',
      order: link.order || 0
    });
    setShowAddLinkModal(true);
  };

  const handleDeleteLink = async (linkId) => {
    if (!window.confirm('Are you sure you want to delete this custom link?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/tournaments/${code}/custom-links/${linkId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Custom link deleted successfully');
      await fetchCustomLinks();
    } catch (err) {
      console.error('Error deleting custom link:', err);
      toast.error('Failed to delete custom link');
    }
  };

  const handleSaveLink = async (e) => {
    e.preventDefault();
    setIsSavingLink(true);

    try {
      const token = localStorage.getItem('token');
      const url = editingLink
        ? `${API_BASE_URL}/api/tournaments/${code}/custom-links/${editingLink._id}`
        : `${API_BASE_URL}/api/tournaments/${code}/custom-links`;

      const method = editingLink ? 'put' : 'post';
      await axios[method](url, linkForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(editingLink ? 'Custom link updated successfully' : 'Custom link added successfully');
      setShowAddLinkModal(false);
      setEditingLink(null);
      setLinkForm({ title: '', url: '', description: '', icon: '🔗', category: 'Custom', order: 0 });
      await fetchCustomLinks();
    } catch (err) {
      console.error('Error saving custom link:', err);
      toast.error(err.response?.data?.message || 'Failed to save custom link');
    } finally {
      setIsSavingLink(false);
    }
  };

  const LinkCard = ({ icon, title, description, link, linkKey, status, actions, category = 'default' }) => {
    if (!link) return null;
    
    return (
      <div className={`link-list-item link-list-item-${category}`} style={{ 
        padding: '8px', 
        border: '1px solid #e0e0e0', 
        borderRadius: '4px',
        backgroundColor: '#fff',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div className="link-item-main" style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '6px' }}>
          <div className="link-item-icon" style={{ fontSize: '18px', marginRight: '8px' }}>{icon}</div>
          <div className="link-item-text" style={{ flex: 1 }}>
            <div className="link-item-title-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <h3 style={{ margin: 0, fontSize: '14px' }}>{title}</h3>
              {status && statusBadge(status)}
            </div>
            {description && <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>{description}</p>}
          </div>
        </div>

        <div className="link-item-link" style={{ marginBottom: '6px' }}>
          <div className="link-display-inline" style={{ display: 'flex', gap: '4px' }}>
            <input
              type="text"
              value={link}
              readOnly
              className="link-input-inline"
              aria-label={`${title} link`}
              style={{ 
                flex: 1, 
                padding: '4px 8px', 
                border: '1px solid #ddd', 
                borderRadius: '3px',
                fontSize: '12px'
              }}
            />
            <button
              className={`btn-inline btn-copy-inline ${copiedLinks[linkKey] ? 'copied' : ''}`}
              onClick={() => copyLink(linkKey, link, title)}
              title="Copy link"
              style={{ 
                padding: '4px 8px', 
                border: '1px solid #ddd', 
                borderRadius: '3px',
                backgroundColor: copiedLinks[linkKey] ? '#4caf50' : '#f5f5f5',
                cursor: 'pointer'
              }}
            >
              {copiedLinks[linkKey] ? '✓' : '📋'}
            </button>
          </div>
        </div>

        <div className="link-item-actions" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button 
            className="btn-inline btn-primary-inline" 
            onClick={() => openLink(link, title)}
            title="Open in new tab"
            style={{ 
              padding: '4px 8px', 
              border: '1px solid #007bff', 
              borderRadius: '3px',
              backgroundColor: '#007bff',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🌐 Open
          </button>
          <button
            className="btn-inline btn-ghost-inline"
            onClick={() => shareOnWhatsApp(`Check out ${title} for ${tournament?.name || 'this tournament'}!`, link)}
            title="Share on WhatsApp"
            style={{ 
              padding: '4px 8px', 
              border: '1px solid #ddd', 
              borderRadius: '3px',
              backgroundColor: '#f5f5f5',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            💬
          </button>
          <button
            className="btn-inline btn-ghost-inline"
            onClick={() => shareOnTwitter(`Check out ${title} for ${tournament?.name || 'this tournament'}!`, link)}
            title="Share on Twitter"
            style={{ 
              padding: '4px 8px', 
              border: '1px solid #ddd', 
              borderRadius: '3px',
              backgroundColor: '#f5f5f5',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🐦
          </button>
          <button
            className="btn-inline btn-ghost-inline"
            onClick={() => shareOnFacebook(link)}
            title="Share on Facebook"
            style={{ 
              padding: '4px 8px', 
              border: '1px solid #ddd', 
              borderRadius: '3px',
              backgroundColor: '#f5f5f5',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📘
          </button>
        </div>

        {actions && (
          <div className="link-item-controls" style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #e0e0e0' }}>
            {actions}
          </div>
        )}
      </div>
    );
  };


  if (isLoading) {
    return (
      <div className="tournament-links loading-state">
        <div className="loading-spinner"></div>
        <h3>Loading Tournament Data</h3>
        <p>Please wait while we load the tournament information.</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="tournament-links error-state">
        <h3>⚠️ Tournament Not Found</h3>
        <p>We could not fetch details for this tournament. Please try again later.</p>
      </div>
    );
  }

  const playerStatus = getPlayerRegistrationStatus();
  const teamStatus = getTeamRegistrationStatus();
  const auctionStatus = getAuctionStatus();

  return (
    <div className="tournament-links" style={{ padding: '5px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '10px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '20px', marginBottom: '3px' }}>🔗 Tournament Links</h1>
        <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>Share and manage tournament links</p>
      </header>

      <div className="links-content">
        {/* Registration Links */}
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '6px', paddingBottom: '5px', borderBottom: '1px solid #e0e0e0' }}>
            📝 Registration
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
          <LinkCard
            icon="🧍‍♂️"
            title="Player Registration"
            description="Public link for players to register"
            link={links.playerRegistration}
            linkKey="playerRegistration"
            status={playerStatus}
            category="registration"
            actions={
              <button
                className={`btn ${playerStatus === 'Active' ? 'btn-danger' : 'btn-success'}`}
                onClick={handleTogglePlayerRegistration}
                disabled={isUpdatingPlayerRegistration}
                style={{ fontSize: '12px', padding: '4px 8px' }}
              >
                {isUpdatingPlayerRegistration
                  ? 'Updating...'
                  : playerStatus === 'Active'
                    ? 'Close Registration'
                    : 'Open Registration'}
              </button>
            }
          />
          
          <LinkCard
            icon="🏳️"
            title="Team Registration"
            description="Public link for teams to register"
            link={links.teamRegistration}
            linkKey="teamRegistration"
            status={teamStatus}
            category="registration"
            actions={
              <button
                className={`btn ${teamStatus === 'Active' ? 'btn-danger' : 'btn-success'}`}
                onClick={handleToggleTeamRegistration}
                disabled={isUpdatingTeamRegistration}
                style={{ fontSize: '12px', padding: '4px 8px' }}
              >
                {isUpdatingTeamRegistration
                  ? 'Updating...'
                  : teamStatus === 'Active'
                    ? 'Close Registration'
                    : 'Open Registration'}
              </button>
            }
          />
          </div>
        </div>

        {/* Live & Streaming */}
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '6px', paddingBottom: '5px', borderBottom: '1px solid #e0e0e0' }}>
            🎥 Live Events
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
          <LinkCard
            icon="🖥️"
            title="Live Display"
            description="Public live display view"
            link={links.liveDisplay}
            linkKey="liveDisplay"
            status={auctionStatus}
            category="live"
          />
          
          <LinkCard
            icon="📺"
            title="Live Stream"
            description="Watch the tournament live"
            link={links.liveStream}
            linkKey="liveStream"
            category="live"
          />
          
          <LinkCard
            icon="⚡"
            title="Live Auction Control"
            description="Live auction control panel"
            link={links.liveAuction}
            linkKey="liveAuction"
            status={auctionStatus}
            category="live"
          />
          </div>
        </div>

        {/* Competition & Results */}
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '6px', paddingBottom: '5px', borderBottom: '1px solid #e0e0e0' }}>
            🏆 Competition & Results
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
          <LinkCard
            icon="📅"
            title="Tournament Schedule"
            description="View tournament schedule"
            link={links.schedule}
            linkKey="schedule"
            category="reports"
          />
          
          <LinkCard
            icon="🎯"
            title="Auction Results"
            description="View auction results"
            link={links.auctionResults}
            linkKey="auctionResults"
            category="reports"
          />
          
          <LinkCard
            icon="👥"
            title="Registered Players"
            description="View all registered players"
            link={links.registeredPlayers}
            linkKey="registeredPlayers"
            category="reports"
          />
          </div>
        </div>

        {/* Admin Links */}
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '6px', paddingBottom: '5px', borderBottom: '1px solid #e0e0e0' }}>
            ⚙️ Administration
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
          <LinkCard
            icon="📊"
            title="Tournament Overview"
            description="View tournament dashboard"
            link={links.overview}
            linkKey="overview"
            category="admin"
          />
          
          <LinkCard
            icon="👤"
            title="Players Management"
            description="Manage tournament players"
            link={links.players}
            linkKey="players"
            category="admin"
          />
          
          <LinkCard
            icon="👥"
            title="Teams Management"
            description="Manage tournament teams"
            link={links.teams}
            linkKey="teams"
            category="admin"
          />
          
          <LinkCard
            icon="📡"
            title="Broadcast"
            description="Manage tournament broadcasts"
            link={links.broadcast}
            linkKey="broadcast"
            category="admin"
          />
          
          <LinkCard
            icon="🎯"
            title="Auction Admin"
            description="Manage auction settings"
            link={links.auctionAdmin}
            linkKey="auctionAdmin"
            status={auctionStatus}
            category="admin"
          />
          </div>
        </div>

        {/* Team Dashboard */}
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '6px', paddingBottom: '5px', borderBottom: '1px solid #e0e0e0' }}>
            🏠 Team Resources
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
          <LinkCard
            icon="📋"
            title="Team Dashboard"
            description="Team dashboard for managing activities"
            link={links.teamDashboard}
            linkKey="teamDashboard"
            category="team"
          />
          </div>
        </div>

        {/* Custom Links */}
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '6px', paddingBottom: '5px', borderBottom: '1px solid #e0e0e0' }}>
            ⭐ Custom Links
          </h2>
          {customLinks.length === 0 ? (
            <div style={{ padding: '6px', textAlign: 'center', color: '#666' }}>
              <p style={{ margin: 0, fontSize: '12px' }}>No custom links added yet. Click the button below to add your first custom link.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
              {customLinks.map((link) => (
                <div key={link._id} className="link-list-item link-list-item-custom" style={{ 
                  padding: '8px', 
                  border: '1px solid #e0e0e0', 
                  borderRadius: '4px',
                  backgroundColor: '#fff',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div className="link-item-main">
                    <div className="link-item-icon">{link.icon || '🔗'}</div>
                    <div className="link-item-text">
                      <div className="link-item-title-row">
                        <h3>{link.title}</h3>
                      </div>
                      {link.description && <p>{link.description}</p>}
                    </div>
                  </div>

                  <div className="link-item-link">
                    <div className="link-display-inline">
                      <input
                        type="text"
                        value={link.url}
                        readOnly
                        className="link-input-inline"
                        aria-label={`${link.title} link`}
                      />
                      <button
                        className={`btn-inline btn-copy-inline ${copiedLinks[`custom-${link._id}`] ? 'copied' : ''}`}
                        onClick={() => copyLink(`custom-${link._id}`, link.url, link.title)}
                        title="Copy link"
                      >
                        {copiedLinks[`custom-${link._id}`] ? '✓' : '📋'}
                      </button>
                    </div>
                  </div>

                  <div className="link-item-actions">
                    <button 
                      className="btn-inline btn-primary-inline" 
                      onClick={() => openLink(link.url, link.title)}
                      title="Open in new tab"
                    >
                      🌐 Open
                    </button>
                    <button
                      className="btn-inline btn-ghost-inline"
                      onClick={() => shareOnWhatsApp(`Check out ${link.title} for ${tournament?.name || 'this tournament'}!`, link.url)}
                      title="Share on WhatsApp"
                    >
                      💬
                    </button>
                    <button
                      className="btn-inline btn-ghost-inline"
                      onClick={() => shareOnTwitter(`Check out ${link.title} for ${tournament?.name || 'this tournament'}!`, link.url)}
                      title="Share on Twitter"
                    >
                      🐦
                    </button>
                    <button
                      className="btn-inline btn-ghost-inline"
                      onClick={() => shareOnFacebook(link.url)}
                      title="Share on Facebook"
                    >
                      📘
                    </button>
                  </div>

                  <div className="link-item-controls">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleEditLink(link)}
                      title="Edit link"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteLink(link._id)}
                      title="Delete link"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: '6px', textAlign: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={handleAddLink}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              ➕ Add Custom Link
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Custom Link Modal */}
      {showAddLinkModal && (
        <div className="modal-overlay" onClick={() => setShowAddLinkModal(false)}>
          <div className="modal-content link-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingLink ? 'Edit Custom Link' : 'Add Custom Link'}</h3>
              <button className="modal-close" onClick={() => setShowAddLinkModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveLink} className="link-form">
              <div className="form-group">
                <label htmlFor="link-title">Title *</label>
                <input
                  type="text"
                  id="link-title"
                  value={linkForm.title}
                  onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
                  required
                  placeholder="e.g., Official Website"
                />
              </div>

              <div className="form-group">
                <label htmlFor="link-url">URL *</label>
                <input
                  type="url"
                  id="link-url"
                  value={linkForm.url}
                  onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                  required
                  placeholder="https://example.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="link-description">Description</label>
                <textarea
                  id="link-description"
                  value={linkForm.description}
                  onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
                  placeholder="Optional description of the link"
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="link-icon">Icon</label>
                  <input
                    type="text"
                    id="link-icon"
                    value={linkForm.icon}
                    onChange={(e) => setLinkForm({ ...linkForm, icon: e.target.value })}
                    placeholder="🔗"
                    maxLength="2"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="link-category">Category</label>
                  <input
                    type="text"
                    id="link-category"
                    value={linkForm.category}
                    onChange={(e) => setLinkForm({ ...linkForm, category: e.target.value })}
                    placeholder="Custom"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="link-order">Order</label>
                  <input
                    type="number"
                    id="link-order"
                    value={linkForm.order}
                    onChange={(e) => setLinkForm({ ...linkForm, order: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddLinkModal(false)}
                  disabled={isSavingLink}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSavingLink}
                >
                  {isSavingLink ? 'Saving...' : (editingLink ? 'Update Link' : 'Add Link')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default TournamentLinks;
