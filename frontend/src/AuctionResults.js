import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-auction-results.css';

function AuctionResults() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [sortConfig, setSortConfig] = useState({ key: 'soldPrice', direction: 'desc' });
  const [filterRole, setFilterRole] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDirectAssignModal, setShowDirectAssignModal] = useState(false);
  const [selectedPlayerForAssign, setSelectedPlayerForAssign] = useState(null);
  const [assignTeamId, setAssignTeamId] = useState('');
  const [assignPrice, setAssignPrice] = useState('');
  const [assignIsGift, setAssignIsGift] = useState(false);
  const [showEditPlayerModal, setShowEditPlayerModal] = useState(false);
  const [selectedPlayerForEdit, setSelectedPlayerForEdit] = useState(null);
  const [editTeamId, setEditTeamId] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editBypassBalance, setEditBypassBalance] = useState(false);

  const fetchTournament = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/tournaments/${code}`);
      setTournament(res.data.tournament);
    } catch (err) {
      console.error('Error fetching tournament:', err);
    }
  }, [code]);

  const fetchPlayers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/players/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const playersData = res.data.players || [];
      console.log('Fetched players:', playersData.length);
      console.log('Players by status:', {
        Sold: playersData.filter(p => p.auctionStatus === 'Sold' || p.auctionStatus === 'sold').length,
        Unsold: playersData.filter(p => p.auctionStatus === 'Unsold' || p.auctionStatus === 'unsold').length,
        Pending: playersData.filter(p => p.auctionStatus === 'Pending' || p.auctionStatus === 'pending').length,
        Withdrawn: playersData.filter(p => p.auctionStatus === 'Withdrawn' || p.auctionStatus === 'withdrawn').length,
        All: playersData.map(p => p.auctionStatus)
      });
      setPlayers(playersData);
    } catch (err) {
      console.error('Error fetching players:', err);
      console.error('Error details:', err.response?.data);
    }
  }, [code]);

  const fetchTeams = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/auctions/teams/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setTeams(res.data.teams || []);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  }, [code]);

  // Add body class to hide superadmin banner on this page
  useEffect(() => {
    document.body.classList.add('auction-results-page-active');
    return () => {
      document.body.classList.remove('auction-results-page-active');
    };
  }, []);

  // Handle URL query parameter for tab
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'history', 'sold', 'unsold', 'withdrawn', 'pending', 'teams', 'financial'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    const newSearchParams = new URLSearchParams(searchParams);
    if (tabId === 'overview') {
      newSearchParams.delete('tab');
    } else {
      newSearchParams.set('tab', tabId);
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  // Force Auction handler
  const handleForceAuction = async (playerId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/pending/force-auction/${playerId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player put in force auction (quota bypass enabled)');
      // Refresh data
      await Promise.all([fetchPlayers(), fetchTeams()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to put player in force auction');
    }
  };

  // Direct Assign handlers
  const handleOpenDirectAssign = (player) => {
    setSelectedPlayerForAssign(player);
    setAssignPrice(player.basePrice?.toString() || '0');
    setAssignTeamId('');
    setAssignIsGift(false);
    setShowDirectAssignModal(true);
  };

  const handleDirectAssign = async () => {
    if (!selectedPlayerForAssign) return;
    if (!assignTeamId) {
      toast.error('Please select a team');
      return;
    }
    const price = assignIsGift ? 0 : parseFloat(assignPrice);
    if (!assignIsGift && (isNaN(price) || price < 0)) {
      toast.error('Please enter a valid price');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/api/auctions/${code}/pending/direct-assign/${selectedPlayerForAssign._id}`,
        { teamId: assignTeamId, price },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Player directly assigned to team');
      setShowDirectAssignModal(false);
      setSelectedPlayerForAssign(null);
      setAssignTeamId('');
      setAssignPrice('');
      setAssignIsGift(false);
      // Refresh data
      await Promise.all([fetchPlayers(), fetchTeams()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign player');
    }
  };

  // Edit player handlers
  const handleOpenEditPlayer = (player) => {
    setSelectedPlayerForEdit(player);
    setEditTeamId(String(player.soldTo || ''));
    setEditPrice(String(player.soldPrice || '0'));
    setEditBypassBalance(false);
    setShowEditPlayerModal(true);
  };

  const handleUpdatePlayer = async () => {
    if (!selectedPlayerForEdit) return;
    if (!editTeamId) {
      toast.error('Please select a team');
      return;
    }
    const price = parseFloat(editPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid price');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/api/auctions/${code}/update-sold-player/${selectedPlayerForEdit._id}`,
        { 
          teamId: String(editTeamId), 
          price: price,
          bypassBalanceCheck: editBypassBalance
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Player details updated successfully');
      setShowEditPlayerModal(false);
      setSelectedPlayerForEdit(null);
      setEditTeamId('');
      setEditPrice('');
      setEditBypassBalance(false);
      // Refresh data
      await Promise.all([fetchPlayers(), fetchTeams()]);
    } catch (err) {
      console.error('Update player error:', err);
      console.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update player';
      toast.error(errorMessage);
    }
  };

  const handleRevokeSale = async (playerId) => {
    if (!window.confirm('Are you sure you want to revoke this sale? This will refund the team and move the player to withdrawn status.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/api/auctions/${code}/revoke-sale/${playerId}`,
        { reason: 'Sale revoked from auction results page' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Sale revoked successfully');
      // Refresh data
      await Promise.all([fetchPlayers(), fetchTeams()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke sale');
    }
  };

  const handleMoveWithdrawnToAvailable = async (playerId) => {
    if (!window.confirm('Are you sure you want to move this player back to the available list?')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/api/auctions/${code}/withdrawn/${playerId}/to-available`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Withdrawn player moved to available list');
      // Refresh data
      await Promise.all([fetchPlayers(), fetchTeams()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to move player to available');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTournament(), fetchPlayers(), fetchTeams()]);
      setLoading(false);
    };
    loadData();
  }, [fetchTournament, fetchPlayers, fetchTeams]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalPlayers = players.length;
    // Handle case-insensitive matching for auctionStatus
    const soldPlayers = players.filter(p => {
      const status = String(p.auctionStatus || '').toLowerCase();
      return status === 'sold';
    });
    const unsoldPlayers = players.filter(p => {
      const status = String(p.auctionStatus || '').toLowerCase();
      return status === 'unsold';
    });
    const withdrawnPlayers = players.filter(p => {
      const status = String(p.auctionStatus || '').toLowerCase();
      return status === 'withdrawn';
    });
    const pendingPlayers = players.filter(p => {
      const status = String(p.auctionStatus || '').toLowerCase();
      return status === 'pending';
    });
    // Calculate total sold value - ensure we only count valid sold prices
    const totalSoldValue = soldPlayers.reduce((sum, p) => {
      const price = Number(p.soldPrice) || 0;
      return sum + price;
    }, 0);
    const avgPrice = soldPlayers.length > 0 ? totalSoldValue / soldPlayers.length : 0;
    const highestBid = soldPlayers.length > 0 ? Math.max(...soldPlayers.map(p => Number(p.soldPrice) || 0)) : 0;
    const highestBidPlayer = soldPlayers.find(p => (p.soldPrice || 0) === highestBid);

    return {
      totalPlayers,
      soldPlayers: soldPlayers.length,
      unsoldPlayers: unsoldPlayers.length,
      withdrawnPlayers: withdrawnPlayers.length,
      pendingPlayers: pendingPlayers.length,
      totalSoldValue,
      avgPrice,
      highestBid,
      highestBidPlayer
    };
  }, [players]);

  // Filter and sort players
  const getFilteredPlayers = (status) => {
    let filtered = players.filter(p => p.auctionStatus === status);
    
    if (filterRole) {
      filtered = filtered.filter(p => p.role === filterRole);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.playerId?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      switch (sortConfig.key) {
        case 'soldPrice':
          aValue = a.soldPrice || 0;
          bValue = b.soldPrice || 0;
          break;
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'playerId':
          aValue = a.playerId || '';
          bValue = b.playerId || '';
          break;
        case 'soldAt':
          aValue = a.soldAt ? new Date(a.soldAt).getTime() : 0;
          bValue = b.soldAt ? new Date(b.soldAt).getTime() : 0;
          break;
        default:
          return 0;
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
  };

  const handleExportPDF = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/api/auctions/${code}/report`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${code}_Auction_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/api/reports/players/excel/${code}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${code}_Auction_Results.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting Excel:', err);
      alert('Failed to export Excel. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="auction-results-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <h3>Loading Auction Results...</h3>
          <p>Please wait while we fetch the data</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="auction-results-page">
        <div className="error-state">
          <h3>Tournament Not Found</h3>
          <p>The tournament you're looking for doesn't exist.</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">Go to Dashboard</button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: '📊 Overview', count: null },
    { id: 'history', label: '📜 History', count: stats.soldPlayers },
    { id: 'sold', label: '✅ Sold', count: stats.soldPlayers },
    { id: 'unsold', label: '❌ Unsold', count: stats.unsoldPlayers },
    { id: 'withdrawn', label: '🚫 Withdrawn', count: stats.withdrawnPlayers },
    { id: 'pending', label: '⏳ Pending', count: stats.pendingPlayers },
    { id: 'teams', label: '👥 Teams', count: teams.length },
    { id: 'financial', label: '💰 Financial', count: null }
  ];

  return (
    <div className="auction-results-page">
      {/* Header */}
      <div className="results-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="page-title">🏆 Auction Results</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="results-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
            {tab.count !== null && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-section">
            <div className="section-card">
              <h2 className="section-title">📈 Auction Summary</h2>
              <div className="summary-grid">
                <div className="summary-item">
                  <div className="summary-label">Total Players Registered</div>
                  <div className="summary-value">{stats.totalPlayers}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-label">Players Sold</div>
                  <div className="summary-value success">{stats.soldPlayers}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-label">Players Unsold</div>
                  <div className="summary-value warning">{stats.unsoldPlayers}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-label">Players Withdrawn</div>
                  <div className="summary-value error">{stats.withdrawnPlayers}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-label">Players Pending</div>
                  <div className="summary-value info">{stats.pendingPlayers}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-label">Total Auction Value</div>
                  <div className="summary-value primary">{formatCurrency(stats.totalSoldValue)}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-label">Average Price</div>
                  <div className="summary-value">{formatCurrency(stats.avgPrice)}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-label">Highest Bid</div>
                  <div className="summary-value primary">
                    {stats.highestBidPlayer ? (
                      <>
                        {formatCurrency(stats.highestBid)} - {stats.highestBidPlayer.name}
                      </>
                    ) : (
                      'N/A'
                    )}
                  </div>
                </div>
              </div>
            </div>

            {stats.highestBidPlayer && (
              <div className="section-card highlight-card">
                <h3 className="section-title">🏆 Highest Bid Player</h3>
                <div className="highlight-content">
                  <div className="highlight-name">{stats.highestBidPlayer.name}</div>
                  <div className="highlight-details">
                    <span>Sold to: {stats.highestBidPlayer.soldToName || 'N/A'}</span>
                    <span>Price: {formatCurrency(stats.highestBidPlayer.soldPrice)}</span>
                    <span>Role: {stats.highestBidPlayer.role || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <HistorySection
            players={players}
            teams={teams}
            formatCurrency={formatCurrency}
            onEdit={handleOpenEditPlayer}
            onRevoke={handleRevokeSale}
          />
        )}

        {/* Sold Players Tab */}
        {activeTab === 'sold' && (
          <PlayersTable
            players={getFilteredPlayers('Sold')}
            title="✅ Sold Players"
            sortConfig={sortConfig}
            onSort={handleSort}
            filterRole={filterRole}
            onFilterRole={setFilterRole}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            formatCurrency={formatCurrency}
            showTeam={true}
          />
        )}

        {/* Unsold Players Tab */}
        {activeTab === 'unsold' && (
          <PlayersTable
            players={getFilteredPlayers('Unsold')}
            title="❌ Unsold Players"
            sortConfig={sortConfig}
            onSort={handleSort}
            filterRole={filterRole}
            onFilterRole={setFilterRole}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            formatCurrency={formatCurrency}
            showTeam={false}
          />
        )}

        {/* Withdrawn Players Tab */}
        {activeTab === 'withdrawn' && (
          <PlayersTable
            players={getFilteredPlayers('Withdrawn')}
            title="🚫 Withdrawn Players"
            sortConfig={sortConfig}
            onSort={handleSort}
            filterRole={filterRole}
            onFilterRole={setFilterRole}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            formatCurrency={formatCurrency}
            showTeam={false}
            showReason={true}
            onMoveToAvailable={handleMoveWithdrawnToAvailable}
          />
        )}

        {/* Pending Players Tab */}
        {activeTab === 'pending' && (
          <PendingPlayersSection
            players={getFilteredPlayers('Pending')}
            teams={teams}
            sortConfig={sortConfig}
            onSort={handleSort}
            filterRole={filterRole}
            onFilterRole={setFilterRole}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            formatCurrency={formatCurrency}
            onForceAuction={handleForceAuction}
            onDirectAssign={handleOpenDirectAssign}
          />
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <TeamsSection
            teams={teams}
            players={players}
            formatCurrency={formatCurrency}
          />
        )}

        {/* Financial Tab */}
        {activeTab === 'financial' && (
          <FinancialSection
            stats={stats}
            teams={teams}
            players={players}
            formatCurrency={formatCurrency}
          />
        )}
      </div>

      {/* Direct Assignment Modal */}
      {showDirectAssignModal && selectedPlayerForAssign && (
        <div className="modal-overlay" onClick={() => setShowDirectAssignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>📋 Direct Assign Player</h3>
              <button onClick={() => setShowDirectAssignModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px' }}>
                <div style={{ 
                  padding: '12px', 
                  background: 'rgba(59, 130, 246, 0.08)', 
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  color: '#1e293b'
                }}>
                  <div><strong>Player:</strong> {selectedPlayerForAssign.name}</div>
                  <div><strong>Role:</strong> {selectedPlayerForAssign.role || 'N/A'}</div>
                  <div><strong>Base Price:</strong> ₹{selectedPlayerForAssign.basePrice?.toLocaleString() || '0'}</div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#475569' }}>
                  Select Team *
                </label>
                <select
                  value={assignTeamId}
                  onChange={(e) => {
                    setAssignTeamId(e.target.value);
                    const selectedTeam = teams.find(t => String(t._id) === String(e.target.value));
                    if (selectedTeam) {
                      const balance = selectedTeam.currentBalance || selectedTeam.budgetBalance || 0;
                      if (parseFloat(assignPrice) > balance) {
                        setAssignPrice(Math.min(parseFloat(assignPrice) || 0, balance).toString());
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    background: '#ffffff',
                    color: '#1e293b',
                    fontSize: '14px'
                  }}
                >
                  <option value="">-- Select Team --</option>
                  {teams.map((team) => {
                    const isFull = team.isQuotaFull || team.remainingPlayers === 0;
                    const balance = team.currentBalance || team.budgetBalance || 0;
                    const balanceFormatted = balance.toLocaleString('en-IN', { maximumFractionDigits: 0 });
                    return (
                      <option key={team._id} value={team._id}>
                        {team.name} {isFull ? `(FULL - ${team.playersBought || 0}/${team.maxPlayers || 16})` : `(${team.playersBought || 0}/${team.maxPlayers || 16})`} | Balance: ₹{balanceFormatted}
                      </option>
                    );
                  })}
                </select>
                {assignTeamId && (() => {
                  const selectedTeam = teams.find(t => String(t._id) === String(assignTeamId));
                  if (!selectedTeam) return null;
                  
                  const isFull = selectedTeam.isQuotaFull || selectedTeam.remainingPlayers === 0;
                  const balance = selectedTeam.currentBalance || selectedTeam.budgetBalance || 0;
                  const balanceFormatted = balance.toLocaleString('en-IN', { maximumFractionDigits: 0 });
                  
                  return (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{
                        padding: '10px',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '6px',
                        color: '#1e293b',
                        fontSize: '13px'
                      }}>
                        💰 <strong>Team Balance:</strong> ₹{balanceFormatted}
                      </div>
                      {isFull && (
                        <div style={{
                          padding: '10px',
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          borderRadius: '6px',
                          color: 'var(--admin-accent-warning, #f59e0b)',
                          fontSize: '13px'
                        }}>
                          ⚠️ This team is at full quota. Assignment will bypass quota limit.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="assignIsGift"
                    checked={assignIsGift}
                    onChange={(e) => {
                      setAssignIsGift(e.target.checked);
                      if (e.target.checked) {
                        setAssignPrice('0');
                      } else {
                        setAssignPrice(selectedPlayerForAssign.basePrice?.toString() || '0');
                      }
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label 
                    htmlFor="assignIsGift" 
                    style={{ 
                      cursor: 'pointer', 
                      fontWeight: '500', 
                      color: '#475569',
                      fontSize: '14px',
                      userSelect: 'none'
                    }}
                  >
                    🎁 Assign as Gift/Free (₹0)
                  </label>
                </div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#475569' }}>
                  Price (₹) {!assignIsGift && '*'}
                </label>
                <input
                  type="number"
                  value={assignPrice}
                  onChange={(e) => setAssignPrice(e.target.value)}
                  min="0"
                  step="100"
                  disabled={assignIsGift}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    background: assignIsGift ? '#f1f5f9' : '#ffffff',
                    color: assignIsGift ? '#94a3b8' : '#1e293b',
                    fontSize: '14px',
                    cursor: assignIsGift ? 'not-allowed' : 'text'
                  }}
                  placeholder={assignIsGift ? "Free (Gift)" : "Enter price"}
                />
                {assignIsGift && (
                  <div style={{
                    marginTop: '8px',
                    padding: '10px',
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '6px',
                    color: '#16a34a',
                    fontSize: '13px'
                  }}>
                    ✓ Player will be assigned for free (₹0)
                  </div>
                )}
                {assignTeamId && assignPrice && !assignIsGift && (() => {
                  const selectedTeam = teams.find(t => String(t._id) === String(assignTeamId));
                  const price = parseFloat(assignPrice);
                  if (!isNaN(price) && selectedTeam) {
                    const balance = selectedTeam.currentBalance || selectedTeam.budgetBalance || 0;
                    if (price > balance) {
                      return (
                        <div style={{
                          marginTop: '8px',
                          padding: '10px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '6px',
                          color: 'var(--admin-accent-error, #ef4444)',
                          fontSize: '13px'
                        }}>
                          ⚠️ Team balance insufficient. Available: ₹{balance.toLocaleString()}
                        </div>
                      );
                    }
                  }
                  return null;
                })()}
              </div>

              <div style={{ 
                padding: '12px',
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#475569'
              }}>
                <strong style={{ color: '#1e293b' }}>Note:</strong> This will directly assign the player to the selected team, bypassing quota limits if necessary. {assignIsGift && 'The player will be assigned as a gift (₹0).'}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  className="btn-action btn-history"
                  onClick={() => {
                    setShowDirectAssignModal(false);
                    setSelectedPlayerForAssign(null);
                    setAssignTeamId('');
                    setAssignPrice('');
                    setAssignIsGift(false);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn-action btn-sold"
                  onClick={handleDirectAssign}
                  disabled={!assignTeamId || (!assignIsGift && !assignPrice)}
                  style={{
                    opacity: (!assignTeamId || (!assignIsGift && !assignPrice)) ? 0.5 : 1,
                    cursor: (!assignTeamId || (!assignIsGift && !assignPrice)) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {assignIsGift ? '🎁 Assign as Gift' : 'Assign Player'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {showEditPlayerModal && selectedPlayerForEdit && (
        <div className="modal-overlay" onClick={() => setShowEditPlayerModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>✏️ Edit Sold Player</h3>
              <button onClick={() => setShowEditPlayerModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px' }}>
                <div style={{ 
                  padding: '12px', 
                  background: 'rgba(59, 130, 246, 0.08)', 
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  color: '#1e293b'
                }}>
                  <div><strong>Player:</strong> {selectedPlayerForEdit.name}</div>
                  <div><strong>Role:</strong> {selectedPlayerForEdit.role || 'N/A'}</div>
                  <div><strong>Current Team:</strong> {selectedPlayerForEdit.soldToName || 'N/A'}</div>
                  <div><strong>Current Price:</strong> ₹{selectedPlayerForEdit.soldPrice?.toLocaleString() || '0'}</div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#475569' }}>
                  Change Team *
                </label>
                <select
                  value={editTeamId}
                  onChange={(e) => {
                    setEditTeamId(e.target.value);
                    const selectedTeam = teams.find(t => String(t._id) === String(e.target.value));
                    if (selectedTeam) {
                      const balance = selectedTeam.currentBalance || selectedTeam.budgetBalance || 0;
                      if (parseFloat(editPrice) > balance) {
                        setEditPrice(Math.min(parseFloat(editPrice) || 0, balance).toString());
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    background: '#ffffff',
                    color: '#1e293b',
                    fontSize: '14px'
                  }}
                >
                  <option value="">-- Select Team --</option>
                  {teams.map((team) => {
                    const isFull = team.isQuotaFull || team.remainingPlayers === 0;
                    const isCurrentTeam = String(team._id) === String(selectedPlayerForEdit.soldTo);
                    return (
                      <option key={team._id} value={team._id}>
                        {team.name} {isCurrentTeam ? '(Current)' : ''} {isFull ? `(FULL - ${team.playersBought || 0}/${team.maxPlayers || 16})` : `(${team.playersBought || 0}/${team.maxPlayers || 16})`}
                      </option>
                    );
                  })}
                </select>
                {editTeamId && (() => {
                  const selectedTeam = teams.find(t => String(t._id) === String(editTeamId));
                  const isFull = selectedTeam?.isQuotaFull || selectedTeam?.remainingPlayers === 0;
                  const isCurrentTeam = String(editTeamId) === String(selectedPlayerForEdit.soldTo);
                  if (isFull && !isCurrentTeam) {
                    return (
                      <div style={{
                        marginTop: '8px',
                        padding: '10px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '6px',
                        color: '#f59e0b',
                        fontSize: '13px'
                      }}>
                        ⚠️ This team is at full quota. Change will bypass quota limit.
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#475569' }}>
                  Change Price (₹) *
                </label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  min="0"
                  step="100"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    background: '#ffffff',
                    color: '#1e293b',
                    fontSize: '14px'
                  }}
                  placeholder="Enter price"
                />
                {editTeamId && editPrice && (() => {
                  const selectedTeam = teams.find(t => String(t._id) === String(editTeamId));
                  const price = parseFloat(editPrice);
                  if (!isNaN(price) && selectedTeam) {
                    const balance = selectedTeam.currentBalance || selectedTeam.budgetBalance || 0;
                    const currentPrice = selectedPlayerForEdit.soldPrice || 0;
                    const priceDiff = price - currentPrice;
                    const newBalance = balance - priceDiff;
                    
                    if (newBalance < 0) {
                      return (
                        <div style={{
                          marginTop: '8px',
                          padding: '10px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '6px',
                          color: '#ef4444',
                          fontSize: '13px'
                        }}>
                          ⚠️ Team balance insufficient. Available: ₹{balance.toLocaleString()}, Price difference: ₹{priceDiff.toLocaleString()}
                        </div>
                      );
                    }
                  }
                  return null;
                })()}
              </div>

              {editTeamId && editPrice && (() => {
                const selectedTeam = teams.find(t => String(t._id) === String(editTeamId));
                const price = parseFloat(editPrice);
                if (!isNaN(price) && selectedTeam) {
                  const balance = selectedTeam.currentBalance || selectedTeam.budgetBalance || 0;
                  const currentPrice = selectedPlayerForEdit.soldPrice || 0;
                  const isCurrentTeam = String(editTeamId) === String(selectedPlayerForEdit.soldTo);
                  const priceDiff = isCurrentTeam ? (price - currentPrice) : price;
                  const newBalance = isCurrentTeam ? (balance - priceDiff) : (balance - price);
                  
                  if (newBalance < 0) {
                    return (
                      <div style={{
                        marginBottom: '16px',
                        padding: '12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        fontSize: '13px'
                      }}>
                        <div style={{ color: '#ef4444', marginBottom: '10px' }}>
                          ⚠️ Team balance insufficient. Available: ₹{balance.toLocaleString()}, Required: ₹{isCurrentTeam ? priceDiff.toLocaleString() : price.toLocaleString()}
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#ef4444' }}>
                          <input
                            type="checkbox"
                            checked={editBypassBalance}
                            onChange={(e) => setEditBypassBalance(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>Bypass balance check (Admin override)</span>
                        </label>
                      </div>
                    );
                  }
                }
                return null;
              })()}

              <div style={{ 
                padding: '12px',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#475569'
              }}>
                <strong style={{ color: '#1e293b' }}>Note:</strong> This will update the player's team and/or price. The team balances will be recalculated automatically.
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  className="btn-action btn-history"
                  onClick={() => {
                    setShowEditPlayerModal(false);
                    setSelectedPlayerForEdit(null);
                    setEditTeamId('');
                    setEditPrice('');
                    setEditBypassBalance(false);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn-action btn-sold"
                  onClick={handleUpdatePlayer}
                  disabled={!editTeamId || !editPrice}
                  style={{
                    opacity: (!editTeamId || !editPrice) ? 0.5 : 1,
                    cursor: (!editTeamId || !editPrice) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Update Player
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Players Table Component
function PlayersTable({ players, title, sortConfig, onSort, filterRole, onFilterRole, searchQuery, onSearch, formatCurrency, showTeam, showReason, onMoveToAvailable }) {
  const roles = [...new Set(players.map(p => p.role).filter(Boolean))];

  return (
    <div className="section-card">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <div className="section-controls">
          <input
            type="text"
            placeholder="🔍 Search players..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="search-input"
          />
          {roles.length > 0 && (
            <select
              value={filterRole}
              onChange={(e) => onFilterRole(e.target.value)}
              className="filter-select"
            >
              <option value="">All Roles</option>
              {roles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {players.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No players found</h3>
          <p>There are no players in this category.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="results-table">
            <thead>
              <tr>
                <th onClick={() => onSort('name')} className="sortable">
                  Player Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => onSort('playerId')} className="sortable">
                  Player ID {sortConfig.key === 'playerId' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                {showTeam && (
                  <th>Team</th>
                )}
                {showTeam && (
                  <th onClick={() => onSort('soldPrice')} className="sortable">
                    Price {sortConfig.key === 'soldPrice' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                )}
                {!showTeam && (
                  <th>Base Price</th>
                )}
                {showTeam && (
                  <th onClick={() => onSort('soldAt')} className="sortable">
                    Sold At {sortConfig.key === 'soldAt' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                )}
                {showReason && (
                  <th>Reason</th>
                )}
                {onMoveToAvailable && (
                  <th>Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {players.map(player => (
                <tr key={player._id}>
                  <td>
                    <div className="player-name-cell">
                      <span className="player-name">{player.name}</span>
                    </div>
                  </td>
                  <td>
                    {player.playerId && (() => {
                      // Remove tournament code prefix (e.g., "PLTC002-001" -> "001")
                      const displayId = player.playerId.includes('-') 
                        ? player.playerId.split('-').slice(1).join('-')
                        : player.playerId;
                      return <span className="player-id">{displayId}</span>;
                    })() || 'N/A'}
                  </td>
                  {showTeam && (
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="team-badge">{player.soldToName || 'N/A'}</span>
                        {player.transactionType === 'DirectAssign' && (
                          <span style={{
                            fontSize: '11px',
                            color: '#8b5cf6',
                            background: 'rgba(139, 92, 246, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            width: 'fit-content'
                          }}>📋 Direct Assign</span>
                        )}
                        {player.transactionType === 'ForceAuction' && (
                          <span style={{
                            fontSize: '11px',
                            color: '#f59e0b',
                            background: 'rgba(245, 158, 11, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            width: 'fit-content'
                          }}>🚀 Force Auction</span>
                        )}
                      </div>
                    </td>
                  )}
                  {showTeam && (
                    <td className="price-cell">{formatCurrency(player.soldPrice)}</td>
                  )}
                  {!showTeam && (
                    <td>{formatCurrency(player.basePrice)}</td>
                  )}
                  {showTeam && (
                    <td>
                      {player.soldAt ? new Date(player.soldAt).toLocaleString() : 'N/A'}
                    </td>
                  )}
                  {showReason && (
                    <td>{player.withdrawalReason || 'N/A'}</td>
                  )}
                  {onMoveToAvailable && (
                    <td>
                      <button
                        onClick={() => onMoveToAvailable(player._id)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          background: '#22c55e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                        title="Move player back to available list"
                      >
                        ✅ Move to Available
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer">
            <div className="table-count">Showing {players.length} player{players.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Teams Section Component
function TeamsSection({ teams, players, formatCurrency }) {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [enlargedImage, setEnlargedImage] = useState(null);
  
  const teamStats = teams.map(team => {
    // Use accurate data from API (computeTeamSnapshots) if available
    const playersBought = team.playersBought || 0;
    const totalSpent = team.totalSpent || 0;
    const currentBalance = team.currentBalance || 0;
    const budget = team.budget || 0;
    
    // Calculate derived stats
    const avgPrice = playersBought > 0 ? totalSpent / playersBought : 0;
    
    // Get highest bid from players data for accuracy
    const teamPlayers = players.filter(p => p.auctionStatus === 'Sold' && String(p.soldTo) === String(team._id));
    const highestBid = teamPlayers.length > 0 ? Math.max(...teamPlayers.map(p => p.soldPrice || 0), 0) : 0;

    return {
      ...team,
      playersCount: playersBought,
      totalSpent,
      avgPrice,
      highestBid,
      balance: currentBalance,
      budget
    };
  }).sort((a, b) => b.totalSpent - a.totalSpent);

  const handleTeamClick = (team) => {
    setSelectedTeam(team);
  };

  const handleCloseModal = () => {
    setSelectedTeam(null);
  };

  // Get players for selected team
  const teamPlayers = selectedTeam
    ? players.filter(p => {
        const status = String(p.auctionStatus || '').toLowerCase();
        return status === 'sold' && String(p.soldTo) === String(selectedTeam._id);
      })
    : [];

  const buildPhotoUrl = (photo) => {
    if (!photo) return null;
    if (photo.startsWith('http')) return photo;
    return `${API_BASE_URL}/${photo}`;
  };

  const buildLogoUrl = (logo) => {
    if (!logo) return `${API_BASE_URL}/default-logo.png`;
    if (logo.startsWith('http')) return logo;
    return `${API_BASE_URL}/${logo}`;
  };

  return (
    <>
      <div className="section-card">
        <h2 className="section-title">👥 Team Performance</h2>
        <div className="table-container">
          <table className="results-table">
            <thead>
              <tr>
                <th>Team Name</th>
                <th>Players Bought</th>
                <th>Total Spent</th>
                <th>Average Price</th>
                <th>Highest Bid</th>
                <th>Budget</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {teamStats.map(team => (
                <tr 
                  key={team._id} 
                  onClick={() => handleTeamClick(team)}
                  style={{ cursor: 'pointer' }}
                  className="team-row-clickable"
                >
                  <td>
                    <div className="team-name-cell">
                      {team.logo && (
                        <img src={team.logo.startsWith('http') ? team.logo : `${API_BASE_URL}/${team.logo}`} 
                             alt={team.name} className="team-logo-small" />
                      )}
                      <span>{team.name}</span>
                    </div>
                  </td>
                  <td>{team.playersCount}</td>
                  <td className="price-cell">{formatCurrency(team.totalSpent)}</td>
                  <td>{formatCurrency(team.avgPrice)}</td>
                  <td>{formatCurrency(team.highestBid)}</td>
                  <td>{formatCurrency(team.budget)}</td>
                  <td className={team.balance >= 0 ? 'balance-positive' : 'balance-negative'}>
                    {formatCurrency(team.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Players Modal */}
      {selectedTeam && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content team-players-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                {selectedTeam.logo && (
                  <img 
                    src={buildLogoUrl(selectedTeam.logo)} 
                    alt={selectedTeam.name} 
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0 }}>{selectedTeam.name} - Player Roster</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                    {teamPlayers.length} {teamPlayers.length === 1 ? 'player' : 'players'} • Total Spent: {formatCurrency(selectedTeam.totalSpent)}
                  </p>
                </div>
              </div>
              <button onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              {teamPlayers.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <div className="empty-icon">👥</div>
                  <h3>No players yet</h3>
                  <p>This team hasn't purchased any players yet.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="results-table team-players-table">
                    <thead>
                      <tr>
                        <th>Photo</th>
                        <th>Player Name</th>
                        <th>Player ID</th>
                        <th>Role</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamPlayers.map((player) => {
                        const photoUrl = buildPhotoUrl(player.photo);
                        const playerInitial = player.name?.charAt(0) || 'P';
                        const displayId = player.playerId && (() => {
                          return player.playerId.includes('-') 
                            ? player.playerId.split('-').slice(1).join('-')
                            : player.playerId;
                        })() || 'N/A';
                        return (
                          <tr key={player._id}>
                            <td>
                              <div 
                                className="team-player-table-photo-wrapper"
                                onClick={() => {
                                  if (photoUrl) {
                                    setEnlargedImage({ url: photoUrl, name: player.name });
                                  }
                                }}
                                style={{ cursor: photoUrl ? 'pointer' : 'default' }}
                                title={photoUrl ? 'Click to enlarge' : ''}
                              >
                                {photoUrl ? (
                                  <img
                                    src={photoUrl}
                                    alt={player.name}
                                    className="team-player-table-photo"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      const placeholder = e.target.nextElementSibling;
                                      if (placeholder) placeholder.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div 
                                  className="team-player-table-photo-placeholder"
                                  style={{ display: photoUrl ? 'none' : 'flex' }}
                                >
                                  <span>{playerInitial}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="player-name-cell">
                                <span className="player-name">{player.name || 'N/A'}</span>
                              </div>
                            </td>
                            <td>
                              <span className="player-id">{displayId}</span>
                            </td>
                            <td>
                              <span className="team-player-role-badge">{player.role || 'N/A'}</span>
                            </td>
                            <td className="price-cell">{formatCurrency(player.soldPrice)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Image Modal */}
      {enlargedImage && (
        <div 
          className="modal-overlay image-enlarge-overlay" 
          onClick={() => setEnlargedImage(null)}
          style={{ zIndex: 10000 }}
        >
          <div 
            className="enlarged-image-container"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="close-enlarged-image"
              onClick={() => setEnlargedImage(null)}
            >
              ×
            </button>
            <img 
              src={enlargedImage.url} 
              alt={enlargedImage.name}
              className="enlarged-player-image"
            />
            <div className="enlarged-image-name">{enlargedImage.name}</div>
          </div>
        </div>
      )}
    </>
  );
}

// Financial Section Component
function FinancialSection({ stats, teams, players, formatCurrency }) {
  // Use accurate data from API (computeTeamSnapshots)
  const totalBudget = teams.reduce((sum, team) => sum + (team.budget || 0), 0);
  // Use totalSpent from teams API for accuracy (aggregated from database)
  const totalSpentFromTeams = teams.reduce((sum, team) => sum + (team.totalSpent || 0), 0);
  // Fallback to stats if teams data not available
  const totalSpent = totalSpentFromTeams > 0 ? totalSpentFromTeams : stats.totalSoldValue;
  const totalRemaining = teams.reduce((sum, team) => sum + (team.currentBalance || 0), 0);
  const utilizationRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const roleDistribution = {};
  players.filter(p => p.auctionStatus === 'Sold').forEach(player => {
    const role = player.role || 'Unknown';
    if (!roleDistribution[role]) {
      roleDistribution[role] = { count: 0, total: 0 };
    }
    roleDistribution[role].count++;
    roleDistribution[role].total += Number(player.soldPrice) || 0;
  });

  return (
    <div className="financial-section">
      <div className="section-card">
        <h2 className="section-title">💰 Financial Summary</h2>
        <div className="financial-grid">
          <div className="financial-card">
            <div className="financial-label">Total Budget</div>
            <div className="financial-value">{formatCurrency(totalBudget)}</div>
          </div>
          <div className="financial-card">
            <div className="financial-label">Total Spent</div>
            <div className="financial-value spent">{formatCurrency(totalSpent)}</div>
          </div>
          <div className="financial-card">
            <div className="financial-label">Total Remaining</div>
            <div className="financial-value remaining">{formatCurrency(totalRemaining)}</div>
          </div>
          <div className="financial-card">
            <div className="financial-label">Budget Utilization</div>
            <div className="financial-value">{utilizationRate.toFixed(1)}%</div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(utilizationRate, 100)}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-card">
        <h2 className="section-title">📊 Role-wise Distribution</h2>
        <div className="table-container">
          <table className="results-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Players Sold</th>
                <th>Total Value</th>
                <th>Average Price</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(roleDistribution)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([role, data]) => (
                  <tr key={role}>
                    <td>{role}</td>
                    <td>{data.count}</td>
                    <td className="price-cell">{formatCurrency(data.total)}</td>
                    <td>{formatCurrency(data.total / data.count)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Pending Players Section Component
function PendingPlayersSection({ players, teams, sortConfig, onSort, filterRole, onFilterRole, searchQuery, onSearch, formatCurrency, onForceAuction, onDirectAssign }) {
  const roles = [...new Set(players.map(p => p.role).filter(Boolean))];

  return (
    <div className="section-card">
      <div className="section-header">
        <h2 className="section-title">⏳ Pending Players</h2>
        <div className="section-controls">
          <input
            type="text"
            placeholder="🔍 Search players..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="search-input"
          />
          {roles.length > 0 && (
            <select
              value={filterRole}
              onChange={(e) => onFilterRole(e.target.value)}
              className="filter-select"
            >
              <option value="">All Roles</option>
              {roles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {players.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No pending players</h3>
          <p>There are no players in the pending list.</p>
        </div>
      ) : (
        <>
          <div style={{ 
            marginBottom: '16px', 
            padding: '12px', 
            background: 'rgba(245, 158, 11, 0.08)', 
            borderRadius: '8px',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            fontSize: '14px',
            color: '#92400e'
          }}>
            ⚠️ <strong style={{ color: '#78350f' }}>Note:</strong> These players are pending assignment. You can use <strong style={{ color: '#78350f' }}>Force Auction</strong> to put them back in auction (bypassing quota) or <strong style={{ color: '#78350f' }}>Direct Assign</strong> to manually assign them to a team.
          </div>
          <div className="table-container">
            <table className="results-table">
              <thead>
                <tr>
                  <th onClick={() => onSort('name')} className="sortable">
                    Player Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => onSort('role')} className="sortable">
                    Role {sortConfig.key === 'role' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Base Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map(player => (
                  <tr key={player._id}>
                    <td>
                      <div className="player-name-cell">
                        <span className="player-name">{player.name}</span>
                      </div>
                    </td>
                    <td>
                      {player.playerId && (() => {
                        // Remove tournament code prefix (e.g., "PLTC002-001" -> "001")
                        const displayId = player.playerId.includes('-') 
                          ? player.playerId.split('-').slice(1).join('-')
                          : player.playerId;
                        return <span className="player-id">{displayId}</span>;
                      })() || 'N/A'}
                    </td>
                    <td>{formatCurrency(player.basePrice)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => onForceAuction(player._id)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            background: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                          title="Put player back in auction with quota bypass"
                        >
                          🚀 Force Auction
                        </button>
                        <button
                          onClick={() => onDirectAssign(player)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            background: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                          title="Directly assign player to a team"
                        >
                          📋 Direct Assign
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <div className="table-count">Showing {players.length} player{players.length !== 1 ? 's' : ''}</div>
          </div>
        </>
      )}
    </div>
  );
}

// History Section Component
function HistorySection({ players, teams, formatCurrency, onEdit, onRevoke }) {
  // Get all sold players sorted by soldAt time (chronological order)
  const historyPlayers = players
    .filter(p => {
      const status = String(p.auctionStatus || '').toLowerCase();
      return status === 'sold' && p.soldAt;
    })
    .sort((a, b) => {
      const timeA = new Date(a.soldAt).getTime();
      const timeB = new Date(b.soldAt).getTime();
      return timeB - timeA; // Most recent first
    });

  return (
    <div className="section-card">
      <h2 className="section-title">📜 Auction History</h2>
      <p style={{ marginBottom: '20px', color: '#64748b', fontSize: '14px' }}>
        Chronological list of all players sold during the auction (most recent first). Click Edit to modify player details.
      </p>
      
      {historyPlayers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No auction history</h3>
          <p>No players have been sold yet.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="results-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player Name</th>
                <th>Player ID</th>
                <th>Team</th>
                <th>Price</th>
                <th>Sold At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {historyPlayers.map((player, index) => (
                <tr key={player._id}>
                  <td style={{ fontWeight: '600', color: '#64748b' }}>{historyPlayers.length - index}</td>
                  <td>
                    <div className="player-name-cell">
                      <span className="player-name">{player.name}</span>
                    </div>
                  </td>
                  <td>
                    {player.playerId && (() => {
                      // Remove tournament code prefix (e.g., "PLTC002-001" -> "001")
                      const displayId = player.playerId.includes('-') 
                        ? player.playerId.split('-').slice(1).join('-')
                        : player.playerId;
                      return <span className="player-id">{displayId}</span>;
                    })() || 'N/A'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span className="team-badge">{player.soldToName || 'N/A'}</span>
                      {player.transactionType === 'DirectAssign' && (
                        <span style={{
                          fontSize: '11px',
                          color: '#8b5cf6',
                          background: 'rgba(139, 92, 246, 0.1)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          width: 'fit-content'
                        }}>📋 Direct Assign</span>
                      )}
                      {player.transactionType === 'ForceAuction' && (
                        <span style={{
                          fontSize: '11px',
                          color: '#f59e0b',
                          background: 'rgba(245, 158, 11, 0.1)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          width: 'fit-content'
                        }}>🚀 Force Auction</span>
                      )}
                    </div>
                  </td>
                  <td className="price-cell">{formatCurrency(player.soldPrice)}</td>
                  <td>
                    {player.soldAt ? new Date(player.soldAt).toLocaleString() : 'N/A'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => onEdit(player)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                        title="Edit player details"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => onRevoke(player._id)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                        title="Revoke sale and refund team"
                      >
                        🚫 Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer">
            <div className="table-count">Showing {historyPlayers.length} player{historyPlayers.length !== 1 ? 's' : ''} in auction history</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuctionResults;
