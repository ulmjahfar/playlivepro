import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import ImageUploadCrop from './components/ImageUploadCrop';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-admin-modern.css';
import './styles-tournament-players.css';

// Helper function to get player timestamp value
const getPlayerTimestampValue = (player) => {
  if (!player) return null;
  return (
    player.updatedAt ||
    player.createdAt ||
    player.registeredAt ||
    player.registrationDate ||
    player.created_on ||
    null
  );
};

// Helper function to format recent dates
const formatRecentDate = (timestamp) => {
  if (!timestamp) return 'Just added';
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return 'Just added';
  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parsed);
};

// Helper function to extract player number
const extractPlayerNumber = (playerId) => {
  if (!playerId) return '';
  const match = String(playerId).match(/-(\d+)$/);
  return match ? match[1] : playerId;
};

function RegisteredPlayers() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [filters, setFilters] = useState({ search: '', role: '', city: '' });
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedImageModal, setSelectedImageModal] = useState(null);
  const [photoEditorPlayer, setPhotoEditorPlayer] = useState(null);
  const [photoEditorSaving, setPhotoEditorSaving] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', mobile: '', city: '', role: '', remarks: '' });
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editReceipt, setEditReceipt] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('registeredPlayersViewMode') || 'table';
    } catch {
      return 'table';
    }
  });
  const pageSize = 50;

  const getAssetUrl = useCallback((asset) => {
    if (!asset) return null;
    if (asset.startsWith('http')) return asset;
    if (asset.startsWith('/')) return `${API_BASE_URL}${asset}`;
    if (asset.startsWith('uploads/')) return `${API_BASE_URL}/${asset}`;
    return `${API_BASE_URL}/uploads/${asset}`;
  }, []);

  const fetchTournament = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTournament(res.data.tournament);
    } catch (err) {
      console.error(err);
    }
  }, [code]);

  const fetchPlayers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/players/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlayers(res.data.players || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching players:', err);
      toast.error('Failed to load players');
    }
  }, [code]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([fetchTournament(), fetchPlayers()]);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [fetchTournament, fetchPlayers]);

  // Apply filters
  useEffect(() => {
    let filtered = players.filter(player => {
      const matchesSearch = !filters.search ||
        player.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        player.playerId?.toLowerCase().includes(filters.search.toLowerCase()) ||
        player.city?.toLowerCase().includes(filters.search.toLowerCase());
      const matchesRole = !filters.role || player.role === filters.role;
      const matchesCity = !filters.city || player.city === filters.city;
      return matchesSearch && matchesRole && matchesCity;
    });

    // Sort by playerId
    filtered.sort((a, b) => {
      const aId = (a.playerId || '').toString().toLowerCase();
      const bId = (b.playerId || '').toString().toLowerCase();
      return aId.localeCompare(bId);
    });

    setFilteredPlayers(filtered);
    setCurrentPage(1);
  }, [players, filters]);

  // Calculate stats
  const stats = useMemo(() => ({
    total: players.length
  }), [players]);

  const totalSlots = tournament?.playerPoolSize 
    ? Number(tournament.playerPoolSize) 
    : (tournament?.maxPlayers ? Number(tournament.maxPlayers) : null);
  const remainingSlots = totalSlots !== null ? Math.max(totalSlots - stats.total, 0) : null;

  const uniqueCitiesCount = useMemo(() => {
    if (!players?.length) return 0;
    return new Set(players.map((player) => player.city).filter(Boolean)).size;
  }, [players]);

  const uniqueRolesCount = useMemo(() => {
    if (!players?.length) return 0;
    return new Set(players.map((player) => player.role).filter(Boolean)).size;
  }, [players]);

  const playersWithPhotos = useMemo(() => {
    if (!players?.length) return 0;
    return players.filter((player) => player.photo).length;
  }, [players]);

  const photoCompleteness = useMemo(() => {
    if (!players?.length) return 0;
    return Math.round((playersWithPhotos / players.length) * 100);
  }, [players, playersWithPhotos]);

  const roleDistribution = useMemo(() => {
    if (!players?.length) return [];
    const counts = players.reduce((acc, player) => {
      const role = player.role?.trim() || 'Role TBD';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([role, count]) => ({
        role,
        count,
        percent: Math.round((count / players.length) * 100)
      }))
      .sort((a, b) => b.count - a.count);
  }, [players]);

  const cityHighlights = useMemo(() => {
    if (!players?.length) return [];
    const counts = players.reduce((acc, player) => {
      const city = player.city?.trim() || 'City TBD';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([city, count]) => ({
        city,
        count,
        percent: Math.round((count / players.length) * 100)
      }))
      .sort((a, b) => b.count - a.count);
  }, [players]);

  const recentPlayers = useMemo(() => {
    if (!players?.length) return [];
    return [...players]
      .sort((a, b) => {
        const aTime = new Date(getPlayerTimestampValue(a) || 0).getTime();
        const bTime = new Date(getPlayerTimestampValue(b) || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [players]);

  const summaryCards = useMemo(() => {
    const cards = [
      {
        key: 'registered',
        label: 'Registered Players',
        value: stats.total.toLocaleString(),
        sub: totalSlots ? `of ${totalSlots.toLocaleString()} slots` : null,
        tone: 'primary'
      }
    ];

    if (totalSlots !== null) {
      cards.push({
        key: 'remaining',
        label: 'Slots Remaining',
        value: remainingSlots.toLocaleString(),
        sub: remainingSlots === 0 ? 'All slots filled' : 'Space left for new players',
        tone: remainingSlots === 0 ? 'alert' : 'success'
      });
    } else {
      cards.push({
        key: 'open',
        label: 'Registration Capacity',
        value: 'Unlimited',
        sub: 'No maximum set',
        tone: 'primary'
      });
    }

    cards.push({
      key: 'cities',
      label: 'Cities Represented',
      value: uniqueCitiesCount.toLocaleString(),
      sub: uniqueCitiesCount === 1 ? 'Single city' : 'Diverse player base',
      tone: 'primary'
    });

    cards.push({
      key: 'roles',
      label: 'Roles Covered',
      value: uniqueRolesCount.toLocaleString(),
      sub: uniqueRolesCount ? 'Role diversity among players' : 'No role info yet',
      tone: 'primary'
    });

    if (players.length > 0) {
      cards.push({
        key: 'photos',
        label: 'Photos Uploaded',
        value: `${photoCompleteness}%`,
        sub: `${playersWithPhotos} of ${players.length} players`,
        tone: photoCompleteness >= 80 ? 'success' : photoCompleteness >= 50 ? 'primary' : 'alert'
      });
    }

    return cards;
  }, [remainingSlots, stats.total, totalSlots, uniqueCitiesCount, uniqueRolesCount, players.length, playersWithPhotos, photoCompleteness]);

  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return null;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(lastUpdated);
  }, [lastUpdated]);

  const insightsAvailable = roleDistribution.length > 0 || cityHighlights.length > 0 || recentPlayers.length > 0;
  const pageClassName = `tournaments-admin-page players-admin players-theme-light players-dynamic-mode`;

  // Save view mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('registeredPlayersViewMode', viewMode);
    } catch (e) {
      console.error('Failed to save view mode:', e);
    }
  }, [viewMode]);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: '', role: '', city: '' });
  }, []);

  const handleExportExcel = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/reports/players/excel/${code}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `players_${code}.xlsx`);
      document.body.appendChild(link);
      link.click();
      toast.success('Excel exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Error exporting Excel');
    }
  }, [code]);

  const handleEditPlayer = (player) => {
    setEditingPlayer(player);
    setEditForm({
      name: player.name,
      mobile: player.mobile,
      city: player.city,
      role: player.role,
      remarks: player.remarks || ''
    });
    setEditPhotoUrl('');
    setEditReceipt(null);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;
    if (name === 'name' || name === 'city') {
      processedValue = value.toUpperCase();
    }
    setEditForm({ ...editForm, [name]: processedValue });
  };

  const handleEditReceiptChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 2 * 1024 * 1024) {
      toast.error('Receipt size exceeds 2MB limit.');
      return;
    }
    setEditReceipt(file);
  };

  const handleUpdatePlayer = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const data = new FormData();
      Object.keys(editForm).forEach(key => data.append(key, editForm[key]));
      if (editPhotoUrl) data.append('photoUrl', editPhotoUrl);
      if (editReceipt) data.append('receipt', editReceipt);

      await axios.put(`${API_BASE_URL}/api/players/${editingPlayer.playerId}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player updated successfully!');
      setEditingPlayer(null);
      fetchPlayers();
    } catch (err) {
      console.error(err);
      toast.error('Error updating player.');
    }
  };

  const handleDeletePlayer = async (playerId) => {
    if (!window.confirm('Are you sure you want to delete this player?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/players/${playerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player deleted successfully!');
      fetchPlayers();
    } catch (err) {
      console.error(err);
      toast.error('Error deleting player.');
    }
  };

  const getRoleOptions = () => {
    if (!tournament) return [];
    if (tournament.sport === 'Cricket') return ['Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'];
    if (tournament.sport === 'Football') return ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];
    if (tournament.sport === 'Volleyball') return ['Setter', 'Attacker', 'Blocker', 'Libero'];
    if (tournament.sport === 'Basketball') return ['Point Guard', 'Center', 'Forward', 'Shooting Guard'];
    return [];
  };

  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
  const paginatedPlayers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPlayers.slice(start, start + pageSize);
  }, [filteredPlayers, currentPage, pageSize]);

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRefresh = async () => {
    await fetchPlayers();
  };

  const handleOpenPhotoEditor = useCallback((player) => {
    setPhotoEditorSaving(false);
    setPhotoEditorPlayer(player);
  }, []);

  const handleClosePhotoEditor = useCallback(() => {
    setPhotoEditorPlayer(null);
  }, []);

  const finalizePhotoUpdate = useCallback(
    async (player, uploadResult) => {
      if (!player || !uploadResult?.url) {
        toast.error('Upload did not return a usable photo URL.');
        return;
      }

      setPhotoEditorSaving(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.put(
          `${API_BASE_URL}/api/players/${player.playerId}`,
          { photoUrl: uploadResult.url },
          { headers }
        );
        const updatedPlayer = response.data?.player;

        if (updatedPlayer) {
          setPlayers((prev) =>
            prev.map((existing) => (existing._id === updatedPlayer._id ? updatedPlayer : existing))
          );
        } else {
          await fetchPlayers();
        }

        toast.success(`${player.name}'s photo updated`);
        setPhotoEditorPlayer(null);
      } catch (error) {
        console.error('Failed to update player photo:', error);
        const message = error.response?.data?.message || 'Failed to update player photo';
        toast.error(message);
      } finally {
        setPhotoEditorSaving(false);
      }
    },
    [fetchPlayers]
  );

  const handlePhotoUploadComplete = useCallback(
    (uploadResult) => {
      if (!photoEditorPlayer) {
        toast.error('Select a player before applying an upload.');
        return;
      }
      finalizePhotoUpdate(photoEditorPlayer, uploadResult);
    },
    [photoEditorPlayer, finalizePhotoUpdate]
  );

  if (isLoading) {
    return (
      <div className="players-loading">
        <div className="players-loading__card">
          <span className="players-loading__icon">⏳</span>
          <h3>Loading player directory…</h3>
          <p>Fetching the latest registrations and profile details.</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="players-empty">
        <h3>⚠️ Tournament Not Found</h3>
        <p>Unable to load tournament data. Please check your connection and try again.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ 
        padding: '24px',
        maxWidth: '100vw',
        boxSizing: 'border-box'
      }}>
        <div className={pageClassName} style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <section className="surface-card players-actions">
          <div className="players-actions__group">
            <button
              type="button"
              className="admin-btn subtle"
              onClick={handleRefresh}
            >
              Refresh data
            </button>
            <button
              type="button"
              className="admin-btn subtle"
              onClick={handleExportExcel}
            >
              Export Excel
            </button>
          </div>
        </section>

        <section className="surface-card players-metrics">
          {summaryCards.map((card) => {
            const iconMap = {
              registered: '👥',
              remaining: '📊',
              open: '♾️',
              cities: '📍',
              roles: '⚽',
              photos: '📸'
            };
            return (
              <article key={card.key} className={`metric-tile tone-${card.tone || 'primary'}`}>
                <div className="metric-tile__icon">{iconMap[card.key] || '📈'}</div>
                <span className="metric-tile__label">{card.label}</span>
                <span className="metric-tile__value">{card.value}</span>
                {card.sub && <span className="metric-tile__sub">{card.sub}</span>}
              </article>
            );
          })}
        </section>

        {insightsAvailable && (
          <section className="surface-card players-insights">
            {roleDistribution.length > 0 && (
              <article className="insight-card" style={{ padding: '8px' }}>
                <header className="insight-card__header" style={{ padding: '0 0 4px 0', marginBottom: '4px' }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', marginBottom: '0' }}>Role coverage</p>
                  </div>
                  <span className="insight-pill" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>{stats.total.toLocaleString()} total</span>
                </header>
                <div className="insight-card__body" style={{ padding: 0 }}>
                  {roleDistribution.slice(0, 4).map((role) => (
                    <div key={role.role} className="insight-progress" style={{ marginBottom: '4px' }}>
                      <div className="insight-progress__meta" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>
                        <span>{role.role}</span>
                        <span>{role.count} · {role.percent}%</span>
                      </div>
                      <div className="insight-progress__track" style={{ height: '4px' }}>
                        <span className="insight-progress__bar" style={{ width: `${role.percent}%`, height: '4px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {cityHighlights.length > 0 && (
              <article className="insight-card" style={{ padding: '8px' }}>
                <header className="insight-card__header" style={{ padding: '0 0 4px 0', marginBottom: '4px' }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', marginBottom: '0' }}>CITY MIX</p>
                  </div>
                  <span className="insight-pill muted" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>{uniqueCitiesCount} cities</span>
                </header>
                <div className="insight-card__body" style={{ padding: 0 }}>
                  <table className="city-mix-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', backgroundColor: '#ffffff' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>City</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Players</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cityHighlights.slice(0, 5).map((city) => (
                        <tr key={city.city} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)', backgroundColor: '#ffffff' }}>
                          <td style={{ padding: '4px 8px', fontWeight: '600', fontSize: '0.8rem', backgroundColor: '#ffffff', color: '#111827' }}>{city.city}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: '#111827', fontSize: '0.8rem', backgroundColor: '#ffffff' }}>{city.count}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: '#111827', fontSize: '0.8rem', backgroundColor: '#ffffff' }}>{city.percent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {recentPlayers.length > 0 && (
              <article className="insight-card" style={{ padding: '8px' }}>
                <header className="insight-card__header" style={{ padding: '0 0 4px 0', marginBottom: '4px' }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', marginBottom: '0' }}>LATEST ACTIVITY</p>
                  </div>
                  {formattedLastUpdated && <span className="insight-pill muted" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>Synced {formattedLastUpdated}</span>}
                </header>
                <div className="insight-card__body" style={{ padding: 0 }}>
                  <table className="recent-activity-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', backgroundColor: '#ffffff' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Player ID</th>
                        <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>City</th>
                        <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPlayers.map((player) => (
                        <tr key={player._id} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)', backgroundColor: '#ffffff' }}>
                          <td style={{ padding: '4px 8px', fontWeight: '600', fontSize: '0.8rem', backgroundColor: '#ffffff', color: '#111827' }}>{player.name}</td>
                          <td style={{ padding: '4px 8px', color: '#111827', fontSize: '0.8rem', backgroundColor: '#ffffff' }}>{extractPlayerNumber(player.playerId)}</td>
                          <td style={{ padding: '4px 8px', color: '#111827', fontSize: '0.8rem', backgroundColor: '#ffffff' }}>{player.city || 'City TBD'}</td>
                          <td style={{ padding: '4px 8px', color: '#111827', fontSize: '0.8rem', backgroundColor: '#ffffff' }}>{formatRecentDate(getPlayerTimestampValue(player))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            )}
          </section>
        )}

        <section className="surface-card players-workspace">
          <header className="workspace-header">
            <div className="workspace-header__top">
              <div className="workspace-header__titles">
                <h2>Registered players</h2>
                <span>{filteredPlayers.length} match{filteredPlayers.length === 1 ? '' : 'es'} · total {stats.total}</span>
              </div>
            </div>
            <div className="simple-filters-bar">
              <div className="view-switch" style={{ marginRight: '12px' }}>
                <button
                  type="button"
                  className={viewMode === 'table' ? 'is-active' : ''}
                  onClick={() => setViewMode('table')}
                  title="Table View"
                >
                  📊 Table
                </button>
                <button
                  type="button"
                  className={viewMode === 'card' ? 'is-active' : ''}
                  onClick={() => setViewMode('card')}
                  title="Card View"
                >
                  🎴 Card
                </button>
              </div>
              <label className="simple-search-input">
                <span className="simple-search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search by name, city, or ID"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                />
              </label>
              <select
                className="simple-filter-select"
                value={filters.role}
                onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="">All roles</option>
                {getRoleOptions().map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <select
                className="simple-filter-select"
                value={filters.city}
                onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))}
              >
                <option value="">All cities</option>
                {[...new Set(players.map((p) => p.city).filter(Boolean))].map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              {(filters.search || filters.role || filters.city) && (
                <button
                  type="button"
                  className="simple-filter-clear"
                  onClick={handleClearFilters}
                >
                  Clear
                </button>
              )}
            </div>
          </header>

          <div className="workspace-body">
            {filteredPlayers.length === 0 ? (
              <div className="workspace-empty">
                <h3>No players found</h3>
                <p>
                  {players.length === 0
                    ? 'No players registered yet.'
                    : 'No players match the current filters. Try adjusting your search.'}
                </p>
              </div>
            ) : viewMode === 'table' ? (
              <>
                <div className="table-responsive-wrapper">
                <table className="players-table-simple">
                  <thead>
                    <tr>
                      <th>Photo</th>
                      <th>Player ID</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>City</th>
                      <th>Mobile</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPlayers.map((player) => {
                      const photoUrl = player.photo ? getAssetUrl(player.photo) : null;
                      return (
                        <tr key={player._id}>
                          <td>
                            <div 
                              className="table-player-photo"
                              onClick={() => photoUrl && setSelectedImageModal(player)}
                              style={{ cursor: photoUrl ? 'pointer' : 'default' }}
                            >
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt={player.name}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextSibling) {
                                      e.target.nextSibling.style.display = 'flex';
                                    }
                                  }}
                                />
                              ) : null}
                              <div className="table-photo-placeholder" style={{ display: photoUrl ? 'none' : 'flex' }}>
                                👤
                              </div>
                            </div>
                          </td>
                          <td>{extractPlayerNumber(player.playerId) || player.playerId}</td>
                          <td>{player.name}</td>
                          <td>{player.role || 'N/A'}</td>
                          <td>{player.city || 'N/A'}</td>
                          <td>{player.mobile || 'N/A'}</td>
                          <td>
                            <div className="table-actions">
                              <button
                                className="table-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const receiptUrl = player.receipt ? getAssetUrl(player.receipt) : null;
                                  if (receiptUrl) {
                                    window.open(receiptUrl, '_blank', 'noopener,noreferrer');
                                  } else {
                                    toast.info('No receipt available for this player');
                                  }
                                }}
                                title={player.receipt ? "View payment receipt" : "No receipt available"}
                                disabled={!player.receipt}
                                style={{ opacity: player.receipt ? 1 : 0.5, cursor: player.receipt ? 'pointer' : 'not-allowed' }}
                              >
                                🧾
                              </button>
                              <button
                                className="table-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPhotoEditor(player);
                                }}
                                title="Update Photo"
                              >
                                📸
                              </button>
                              <button
                                className="table-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditPlayer(player);
                                }}
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                className="table-btn table-btn-danger"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Are you sure you want to delete ${player.name}? This action cannot be undone.`)) {
                                    await handleDeletePlayer(player.playerId);
                                  }
                                }}
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </>
            ) : (
              <div className="player-card-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
                padding: '16px 0'
              }}>
                {paginatedPlayers.map((player) => {
                  const photoUrl = player.photo ? getAssetUrl(player.photo) : null;
                  const receiptUrl = player.receipt ? getAssetUrl(player.receipt) : null;
                  
                  return (
                    <div
                      key={player._id}
                      className="player-card"
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '20px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                      onClick={() => setSelectedPlayer(player)}
                    >
                      {/* Player Photo */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (photoUrl) setSelectedImageModal(player);
                        }}
                        style={{
                          width: '120px',
                          height: '120px',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          margin: '0 auto',
                          cursor: photoUrl ? 'pointer' : 'default',
                          backgroundColor: '#f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          border: '2px solid #e5e7eb'
                        }}
                      >
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={player.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div style={{ display: photoUrl ? 'none' : 'flex', fontSize: '56px' }}>
                          👤
                        </div>
                      </div>

                      {/* Player Information */}
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <h3 style={{
                          margin: '0 0 12px 0',
                          fontSize: '1.25rem',
                          fontWeight: '600',
                          color: '#111827'
                        }}>
                          {player.name}
                        </h3>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          fontSize: '0.875rem',
                          color: '#6b7280'
                        }}>
                          <div>
                            <strong style={{ color: '#374151' }}>ID:</strong> {extractPlayerNumber(player.playerId) || player.playerId}
                          </div>
                          <div>
                            <strong style={{ color: '#374151' }}>Role:</strong> {player.role || 'N/A'}
                          </div>
                          <div>
                            <strong style={{ color: '#374151' }}>City:</strong> {player.city || 'N/A'}
                          </div>
                          <div>
                            <strong style={{ color: '#374151' }}>Mobile:</strong> {player.mobile || 'N/A'}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{
                        display: 'flex',
                        gap: '10px',
                        justifyContent: 'center',
                        marginTop: 'auto',
                        paddingTop: '12px',
                        borderTop: '1px solid #e5e7eb'
                      }}>
                        <button
                          className="table-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (receiptUrl) {
                              window.open(receiptUrl, '_blank', 'noopener,noreferrer');
                            } else {
                              toast.info('No receipt available for this player');
                            }
                          }}
                          title={player.receipt ? "View payment receipt" : "No receipt available"}
                          disabled={!player.receipt}
                          style={{ 
                            flex: 1,
                            opacity: player.receipt ? 1 : 0.5, 
                            cursor: player.receipt ? 'pointer' : 'not-allowed',
                            padding: '12px 16px',
                            fontSize: '18px',
                            minHeight: '44px'
                          }}
                        >
                          🧾
                        </button>
                        <button
                          className="table-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPhotoEditor(player);
                          }}
                          title="Update Photo"
                          style={{ 
                            flex: 1,
                            padding: '12px 16px',
                            fontSize: '18px',
                            minHeight: '44px'
                          }}
                        >
                          📸
                        </button>
                        <button
                          className="table-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPlayer(player);
                          }}
                          title="Edit"
                          style={{ 
                            flex: 1,
                            padding: '12px 16px',
                            fontSize: '18px',
                            minHeight: '44px'
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          className="table-btn table-btn-danger"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm(`Are you sure you want to delete ${player.name}? This action cannot be undone.`)) {
                              await handleDeletePlayer(player.playerId);
                            }
                          }}
                          title="Delete"
                          style={{ 
                            flex: 1,
                            padding: '12px 16px',
                            fontSize: '18px',
                            minHeight: '44px'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  Previous
                </button>
                <div className="pagination-status">
                  Page {currentPage} of {totalPages}
                  <span className="pagination-count"> ({filteredPlayers.length} players)</span>
                </div>
                <button
                  className="pagination-btn"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </section>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImageModal && selectedImageModal.photo && (
        <div className="player-image-modal-overlay" onClick={() => setSelectedImageModal(null)}>
          <div className="player-image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="player-image-modal-close" onClick={() => setSelectedImageModal(null)} aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <img 
              src={getAssetUrl(selectedImageModal.photo)} 
              alt={selectedImageModal.name}
              className="player-image-modal-image"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <div className="player-image-modal-name">{selectedImageModal.name}</div>
          </div>
        </div>
      )}

      {/* Photo Editor Modal */}
      {photoEditorPlayer && (
        <div className="modal-overlay photo-editor-overlay" onClick={handleClosePhotoEditor}>
          <div className="modal-content photo-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ flex: 1 }}>
                <h3>Update player photo</h3>
                <div
                  className="photo-editor-summary"
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted, #4b5563)'
                  }}
                >
                  <strong>{photoEditorPlayer.name}</strong>
                  <span> · {photoEditorPlayer.playerId}</span>
                </div>
              </div>
              <button
                className="modal-close"
                onClick={handleClosePhotoEditor}
                aria-label="Close modal"
                disabled={photoEditorSaving}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <ImageUploadCrop
                key={photoEditorPlayer._id}
                aspect={3 / 4}
                uploadType="playerPhoto"
                uploadPath={`${API_BASE_URL}/api/players/upload-photo`}
                initialImage={photoEditorPlayer.photo ? getAssetUrl(photoEditorPlayer.photo) : undefined}
                previewShape="square"
                onUploadComplete={handlePhotoUploadComplete}
                onError={(message) => toast.error(message)}
              />
              {photoEditorSaving && (
                <div
                  className="photo-editor-status"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginTop: '1rem'
                  }}
                >
                  <span className="loading-spinner" aria-hidden="true" />
                  <span>Saving optimized image to player profile…</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedPlayer && (
        <div className="modal player-view-modal" onClick={() => setSelectedPlayer(null)}>
          <div className="modal-content player-view-content" onClick={(e) => e.stopPropagation()}>
            <button className="player-view-close" onClick={() => setSelectedPlayer(null)} aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            
            <div className="player-view-header">
              <div className="player-view-image-container">
                {selectedPlayer.photo ? (
                  <div className="player-view-image-wrapper">
                    <img src={getAssetUrl(selectedPlayer.photo)} alt={selectedPlayer.name} className="player-view-image" />
                    <div className="player-view-image-overlay"></div>
                  </div>
                ) : (
                  <div className="player-view-image-placeholder">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>No Photo</span>
                  </div>
                )}
              </div>
              <div className="player-view-title-section">
                <h2 className="player-view-name">{selectedPlayer.name}</h2>
                <div className="player-view-badge">
                  <span className="player-view-id">ID: {selectedPlayer.playerId}</span>
                </div>
              </div>
            </div>

            <div className="player-view-body">
              <div className="player-view-details-grid">
                <div className="player-view-detail-item">
                  <div className="player-view-detail-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                  <div className="player-view-detail-content">
                    <span className="player-view-detail-label">Role</span>
                    <span className="player-view-detail-value">{selectedPlayer.role}</span>
                  </div>
                </div>

                <div className="player-view-detail-item">
                  <div className="player-view-detail-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                  </div>
                  <div className="player-view-detail-content">
                    <span className="player-view-detail-label">City</span>
                    <span className="player-view-detail-value">{selectedPlayer.city}</span>
                  </div>
                </div>

                <div className="player-view-detail-item">
                  <div className="player-view-detail-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                  </div>
                  <div className="player-view-detail-content">
                    <span className="player-view-detail-label">Mobile</span>
                    <span className="player-view-detail-value">{selectedPlayer.mobile}</span>
                  </div>
                </div>

                {selectedPlayer.remarks && (
                  <div className="player-view-detail-item player-view-detail-item-full">
                    <div className="player-view-detail-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </div>
                    <div className="player-view-detail-content">
                      <span className="player-view-detail-label">Remarks</span>
                      <span className="player-view-detail-value">{selectedPlayer.remarks}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="player-view-actions">
              <button 
                onClick={() => window.open(`/player-card/${selectedPlayer.playerId}`, '_blank')} 
                className="player-view-btn player-view-btn-primary"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                View Full Card
              </button>
              <button 
                onClick={() => { setSelectedPlayer(null); handleEditPlayer(selectedPlayer); }} 
                className="player-view-btn player-view-btn-secondary"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit Player
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPlayer && (
        <div className="modal" onClick={() => setEditingPlayer(null)}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
            <span className="close" onClick={() => setEditingPlayer(null)}>&times;</span>
            <h2>Edit Player: {editingPlayer.name}</h2>
            <form onSubmit={handleUpdatePlayer} className="edit-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-player-name">Player Name *</label>
                  <input
                    id="edit-player-name"
                    type="text"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-player-mobile">Mobile Number *</label>
                  <input
                    id="edit-player-mobile"
                    type="tel"
                    name="mobile"
                    value={editForm.mobile}
                    onChange={handleEditFormChange}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-player-city">Place / City *</label>
                  <input
                    id="edit-player-city"
                    type="text"
                    name="city"
                    value={editForm.city}
                    onChange={handleEditFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-player-role">Playing Role *</label>
                  <select id="edit-player-role" name="role" value={editForm.role} onChange={handleEditFormChange} required>
                    <option value="">Select Game Role</option>
                    {getRoleOptions().map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="edit-player-photo">Player Photo (Optional)</label>
                <ImageUploadCrop
                  label=""
                  placeholder="Tap to upload, crop & optimize player portrait"
                  aspect={3 / 4}
                  uploadType="playerPhoto"
                  uploadPath={`${API_BASE_URL}/api/players/upload-photo`}
                  initialImage={getAssetUrl(editingPlayer?.photo)}
                  onComplete={(url) => {
                    if (!url) return;
                    setEditPhotoUrl(url);
                    toast.success('Photo optimized and ready to save.');
                  }}
                  onError={(message) => {
                    setEditPhotoUrl('');
                    toast.error(message || 'Failed to process photo.');
                  }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-player-receipt">Payment Receipt (Optional, Max 2MB)</label>
                <input
                  id="edit-player-receipt"
                  type="file"
                  name="receipt"
                  accept="image/*,.pdf"
                  onChange={handleEditReceiptChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-player-remarks">Remarks</label>
                <textarea
                  id="edit-player-remarks"
                  name="remarks"
                  value={editForm.remarks}
                  onChange={handleEditFormChange}
                  rows="3"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingPlayer(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Player</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default RegisteredPlayers;
