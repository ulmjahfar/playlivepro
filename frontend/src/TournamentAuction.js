import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { toast } from 'react-toastify';
import TournamentAdminLayout from './components/TournamentAdminLayout';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-auction.css';

function TournamentAuction() {
  const { code } = useParams();
  const [tournament, setTournament] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [auctionStatus, setAuctionStatus] = useState('stopped');
  const [teams, setTeams] = useState([]);
  const [summary, setSummary] = useState({
    totalPlayers: 0,
    auctioned: 0,
    remaining: 0,
    topBidders: [],
    mostExpensivePlayer: null,
    lastSoldPlayer: null,
    nextPlayerUp: null
  });
  const [history, setHistory] = useState([]);
  const [timer, setTimer] = useState(30);
  const [currentBid, setCurrentBid] = useState(0);
  const [leadingTeam, setLeadingTeam] = useState(null);
  const [activeTab, setActiveTab] = useState('auction');
  const [viewMode, setViewMode] = useState('grid');
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBidHistory, setShowBidHistory] = useState(false);
  const [bidHistory, setBidHistory] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [timerConfig, setTimerConfig] = useState(30);
  const [lastCallTimer, setLastCallTimer] = useState(10);
  const [showReadinessErrors, setShowReadinessErrors] = useState(false);
  const [readinessErrors, setReadinessErrors] = useState(null);
  const [showPreStartWarning, setShowPreStartWarning] = useState(false);
  const [preStartWarnings, setPreStartWarnings] = useState([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [showPostAuctionSummary, setShowPostAuctionSummary] = useState(false);
  const [showPlayerDetail, setShowPlayerDetail] = useState(false);
  const [selectedPlayerDetail, setSelectedPlayerDetail] = useState(null);
  const [showTeamBidHistory, setShowTeamBidHistory] = useState(false);
  const [selectedTeamForHistory, setSelectedTeamForHistory] = useState(null);
  const [eventLog, setEventLog] = useState([]);
  const [recentBids, setRecentBids] = useState([]);
  const [autoTimerEnabled, setAutoTimerEnabled] = useState(false);
  const [autoNextEnabled, setAutoNextEnabled] = useState(false);
  const [voiceAnnouncerEnabled, setVoiceAnnouncerEnabled] = useState(false);
  const [autoTimeoutAction, setAutoTimeoutAction] = useState('pending');
  const [showDirectAssignModal, setShowDirectAssignModal] = useState(false);
  const [selectedPlayerForAssign, setSelectedPlayerForAssign] = useState(null);
  const [assignTeamId, setAssignTeamId] = useState('');
  const [assignPrice, setAssignPrice] = useState('');

  const socketRef = useRef(null);
  const currentPlayerRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const soundEnabledRef = useRef(true);

  const normalizeStatus = useCallback((value) => {
    if (!value && value !== 0) return 'stopped';
    const status = value.toString().toLowerCase();
    if (status === 'completed') return 'completed';
    if (status === 'running') return 'running';
    if (status === 'paused') return 'paused';
    if (status === 'locked') return 'locked';
    if (status === 'notstarted') return 'stopped';
    return 'stopped';
  }, []);

  // Fetch live data
  const fetchLiveData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [liveRes, teamsRes, summaryRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/auctions/live/${code}`, { headers }),
        axios.get(`${API_BASE_URL}/api/auctions/live-teams/${code}`, { headers }),
        axios.get(`${API_BASE_URL}/api/auctions/live-summary/${code}`, { headers }),
        axios.get(`${API_BASE_URL}/api/auctions/live-history/${code}`, { headers })
      ]);

      const teamsData = teamsRes.data.teams || [];
      setTeams(teamsData);
      
      setTournament(liveRes.data.tournament);
      const nextStatus = normalizeStatus(liveRes.data.auctionStatus || liveRes.data.status);
      setAuctionStatus(nextStatus);
      setCurrentPlayer(nextStatus === 'completed' ? null : liveRes.data.currentPlayer);
      setCurrentBid(liveRes.data.currentBid || 0);
      // Find leading team from teams array
      const highestBidderName = liveRes.data.highestBidderName;
      if (highestBidderName && teamsData.length > 0) {
        const leading = teamsData.find(t => t.name === highestBidderName);
        setLeadingTeam(leading || null);
      } else {
        setLeadingTeam(null);
      }
      setSummary(summaryRes.data.summary || {
        totalPlayers: 0,
        auctioned: 0,
        remaining: 0,
        topBidders: [],
        mostExpensivePlayer: null,
        lastSoldPlayer: null,
        nextPlayerUp: null
      });
      setHistory(historyRes.data.players || []);
      if (liveRes.data.currentPlayer?.bidHistory) {
        setBidHistory(liveRes.data.currentPlayer.bidHistory.slice().reverse());
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching live data:', err);
      setError(err.response?.data?.message || 'Failed to fetch auction data');
      toast.error('Failed to fetch auction data');
    } finally {
      if (!silent) setIsRefreshing(false);
      setLoading(false);
    }
  }, [code, normalizeStatus]);

  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
    if (currentPlayer?.bidHistory) {
      setBidHistory(currentPlayer.bidHistory.slice().reverse());
    }
  }, [currentPlayer]);

  // WebSocket connection
  useEffect(() => {
    fetchLiveData();

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No authentication token found for socket connection');
      return;
    }

    const newSocket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      auth: { token }
    });

    socketRef.current = newSocket;

    const guard = (handler) => (payload = {}) => {
      if (payload.tournamentCode && payload.tournamentCode !== code) return;
      handler(payload);
    };

    newSocket.on('connect', () => {
      setIsConnected(true);
      fetchLiveData(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('auction:start', guard(() => {
      setAuctionStatus('running');
      setTimer(timerConfig);
      fetchLiveData(true);
      if (soundEnabledRef.current) playSound('start');
      toast.success('Auction started');
    }));

    newSocket.on('player:next', guard((payload) => {
      if (payload.player) {
        setCurrentPlayer(payload.player);
      }
      setAuctionStatus('running');
      setTimer(payload.timerSeconds || timerConfig);
      fetchLiveData(true);
      if (soundEnabledRef.current) playSound('next');
    }));

    newSocket.on('bid:update', guard((payload) => {
      if (currentPlayerRef.current && currentPlayerRef.current._id === payload.playerId) {
        setCurrentPlayer((prev) => ({
          ...prev,
          currentBid: payload.bidAmount,
          bidHistory: payload.bidHistory || prev.bidHistory
        }));
        setCurrentBid(payload.bidAmount);
        setTimer(payload.timerSeconds || timerConfig);
        if (soundEnabledRef.current) playSound('bid');
      }
      fetchLiveData(true);
    }));

    newSocket.on('auction:pause', guard(() => {
      setAuctionStatus('paused');
      fetchLiveData(true);
      toast.info('Auction paused');
    }));

    newSocket.on('auction:resume', guard(() => {
      setAuctionStatus('running');
      setTimer(timerConfig);
      fetchLiveData(true);
      toast.info('Auction resumed');
    }));

    newSocket.on('auction:stop', guard(() => {
      setAuctionStatus('stopped');
      setCurrentPlayer(null);
      fetchLiveData(true);
      toast.info('Auction stopped');
    }));

    newSocket.on('player:sold', guard((payload) => {
      fetchLiveData(true);
      if (soundEnabledRef.current) playSound('sold');
      toast.success(`Player sold to ${payload.teamName || payload.soldToName} for ₹${payload.soldPrice || payload.price || 0}`);
    }));

    newSocket.on('player:unsold', guard(() => {
      fetchLiveData(true);
      if (soundEnabledRef.current) playSound('unsold');
      toast.info('Player marked as unsold');
    }));

    newSocket.on('player:pending', guard(() => {
      fetchLiveData(true);
      toast.info('Player moved to pending');
    }));

    newSocket.on('auction:end', guard(() => {
      setAuctionStatus('completed');
      setCurrentPlayer(null);
      fetchLiveData(true);
      toast.success('Auction completed');
    }));

    newSocket.on('auction:update', guard(() => {
      fetchLiveData(true);
    }));

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [code, fetchLiveData, timerConfig]);

  // Timer countdown
  useEffect(() => {
    let interval;
    if (auctionStatus === 'running' && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            if (soundEnabledRef.current) playSound('warning');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [auctionStatus, timer]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Sound effects
  const playSound = (type) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      switch(type) {
        case 'bid':
          oscillator.frequency.value = 800;
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
          break;
        case 'sold':
          oscillator.frequency.value = 1000;
          gainNode.gain.value = 0.2;
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.2);
          break;
        case 'warning':
          oscillator.frequency.value = 400;
          gainNode.gain.value = 0.15;
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.15);
          break;
        default:
          oscillator.frequency.value = 600;
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
      }
    } catch (e) {
      // Audio not supported
    }
  };

  // Check readiness before starting auction
  const checkReadinessBeforeStart = async () => {
    const warnings = [];
    
    // Check if registration is still open
    if (tournament?.playerRegistrationEnabled || tournament?.teamRegistrationEnabled) {
      const openRegistrations = [];
      if (tournament.playerRegistrationEnabled) {
        openRegistrations.push('Player registration');
      }
      if (tournament.teamRegistrationEnabled) {
        openRegistrations.push('Team registration');
      }
      warnings.push(`${openRegistrations.join(' and ')} ${openRegistrations.length > 1 ? 'are' : 'is'} still open. Please close registration before starting the auction.`);
    }
    
    // Check quorum for AuctionPro plan
    if (tournament?.plan === 'AuctionPro' && teams.length > 0) {
      try {
        // Fetch full team data with seats to check quorum
        const token = localStorage.getItem('token');
        const teamsRes = await axios.get(`${API_BASE_URL}/api/teams/${code}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const fullTeams = teamsRes.data.teams || [];
        
        // Check quorum for each team
        const quorumIssues = [];
        let hasSeatsData = false;
        
        fullTeams.forEach(team => {
          // Check if seats data is available (seats might not be included by default)
          if (team.seats !== undefined) {
            hasSeatsData = true;
            if (Array.isArray(team.seats) && team.seats.length > 0) {
              const activeVoters = team.seats.filter(seat => seat.isVoter && seat.status === 'Active');
              const required = team.seatPolicy?.votersRequired || 1;
              
              if (activeVoters.length < required) {
                quorumIssues.push(`${team.name}: needs ${required} active voter(s) but only ${activeVoters.length} ready`);
              }
            } else if (team.seatPolicy) {
              // Team has seat policy but no seats configured
              quorumIssues.push(`${team.name}: no seats configured`);
            }
          }
        });
        
        if (quorumIssues.length > 0) {
          warnings.push(`Seat quorum incomplete: ${quorumIssues.join('; ')}`);
        } else if (!hasSeatsData && fullTeams.length > 0) {
          // If we can't access seats data, show a general warning
          warnings.push('Unable to verify seat quorum from team data. Please ensure all teams have the required active voter seats configured before starting the auction.');
        }
      } catch (err) {
        // If we can't fetch team data, show a general warning
        console.warn('Could not fetch team data for quorum check:', err);
        warnings.push('Unable to verify seat quorum. Please ensure all teams have the required active voter seats configured.');
      }
    }
    
    return warnings;
  };

  // API Actions
  const handleStartAuction = async (bypassReadiness = false) => {
    // Check readiness before making API call
    if (!bypassReadiness) {
      const warnings = await checkReadinessBeforeStart();
      if (warnings.length > 0) {
        setPreStartWarnings(warnings);
        setShowPreStartWarning(true);
        return;
      }
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/auctions/${code}/start`, {
        bypassReadiness
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Auction started');
      fetchLiveData(true);
      setShowPreStartWarning(false);
    } catch (err) {
      console.error('Error starting auction:', err);
      
      // Handle 409 Conflict (readiness check failures)
      if (err.response?.status === 409) {
        const errorData = err.response.data;
        
        // Build error message for toast popup
        let errorMessage = errorData?.message || 'Auction cannot start. Please check readiness requirements.';
        
        // Add details to the message if available
        if (errorData?.details?.errors && Array.isArray(errorData.details.errors)) {
          const errorList = errorData.details.errors.join(' • ');
          errorMessage = `${errorMessage}\n\n${errorList}`;
        }
        
        // Show toast popup with error message
        toast.error(errorMessage, {
          position: "top-center",
          autoClose: 8000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          style: {
            whiteSpace: 'pre-line',
            maxWidth: '500px'
          }
        });
        
        // Also show detailed readiness errors in a modal
        if (errorData?.details) {
          setReadinessErrors(errorData.details);
          setShowReadinessErrors(true);
          console.log('Readiness check failed:', errorData.details);
        } else {
          console.warn('409 error without details:', errorData);
        }
      } else if (err.response?.status === 401) {
        toast.error('Authentication failed. Please log in again.');
      } else if (err.response?.status === 403) {
        toast.error('You do not have permission to start the auction.');
      } else if (err.response?.status >= 500) {
        toast.error('Server error. Please try again later.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to start auction');
      }
    }
  };

  const handlePauseAuction = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/pause`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Auction paused');
      fetchLiveData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to pause auction');
    }
  };

  const handleResumeAuction = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/resume`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Auction resumed');
      fetchLiveData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resume auction');
    }
  };

  const handleEndAuction = async () => {
    if (!window.confirm('Are you sure you want to end the auction? This will mark all pending players as unsold.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/end`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Auction ended');
      fetchLiveData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to end auction');
    }
  };

  const handleNextPlayer = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/next`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Next player loaded');
      fetchLiveData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load next player');
    }
  };

  const handleMarkSold = async () => {
    if (!currentPlayer) {
      toast.error('No active player');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/sold`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player marked as sold');
      fetchLiveData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark player as sold');
    }
  };

  const handleMarkUnsold = async () => {
    if (!currentPlayer) {
      toast.error('No active player');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/mark-unsold`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player marked as unsold');
      fetchLiveData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark player as unsold');
    }
  };

  const handleMarkPending = async () => {
    if (!currentPlayer) {
      toast.error('No active player');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/pending`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player moved to pending');
      fetchLiveData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to move player to pending');
    }
  };

  const handleLastCall = async () => {
    if (!currentPlayer) {
      toast.error('No active player');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/last-call/start`, {
        timerSeconds: lastCallTimer
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Last call activated');
      fetchLiveData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to activate last call');
    }
  };

  const handleOpenViewer = () => {
    const viewerUrl = `${window.location.origin}/live/${code}`;
    window.open(viewerUrl, '_blank');
  };

  const getImageUrl = (imagePath, defaultImage = null) => {
    const fallback = defaultImage || `${API_BASE_URL}/default-photo.png`;
    if (!imagePath) return fallback;
    if (typeof imagePath !== 'string') return fallback;
    const trimmed = imagePath.trim();
    if (!trimmed) return fallback;
    if (trimmed.startsWith('data:')) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const normalized = trimmed.replace(/\\/g, '/');
    if (normalized.startsWith('/')) return `${API_BASE_URL}${normalized}`;
    if (normalized.startsWith('uploads/')) return `${API_BASE_URL}/${normalized}`;
    return `${API_BASE_URL}/${normalized.replace(/^\/+/, '')}`;
  };

  const getPlayerPhotoUrl = (photo) => getImageUrl(photo, `${API_BASE_URL}/default-photo.png`);
  const getTeamLogoUrl = (logo) => getImageUrl(logo, `${API_BASE_URL}/default-logo.png`);

  const getTotalSpent = () => {
    return history
      .filter(p => p.auctionStatus === 'Sold' && p.soldPrice)
      .reduce((sum, p) => sum + p.soldPrice, 0);
  };

  const getAverageBid = () => {
    const soldPlayers = history.filter(p => p.auctionStatus === 'Sold' && p.soldPrice);
    if (soldPlayers.length === 0) return 0;
    const total = soldPlayers.reduce((sum, p) => sum + p.soldPrice, 0);
    return Math.round(total / soldPlayers.length);
  };

  const getTeamBudgets = () => {
    const teamSpends = {};
    history.filter(p => p.auctionStatus === 'Sold').forEach(player => {
      const teamName = player.soldToName || 'Unknown';
      teamSpends[teamName] = (teamSpends[teamName] || 0) + player.soldPrice;
    });

    return teams.map(team => {
      // Use backend data if available, otherwise calculate from history
      const spent = team.totalSpent || teamSpends[team.name] || 0;
      const budget = team.budget || team.budgetBalance || 100000;
      const remaining = team.currentBalance || team.budgetBalance || (budget - spent);
      const maxBid = team.maxBid || team.maxPossibleBid || (remaining > 0 ? remaining - ((16 - (team.playersBought || 0)) * 1000) : 0);
      return {
        ...team,
        spent,
        remaining,
        maxBid: Math.max(0, maxBid),
        // Preserve quota information from backend
        isQuotaFull: team.isQuotaFull,
        remainingPlayers: team.remainingPlayers,
        playersBought: team.playersBought,
        maxPlayers: team.maxPlayers || tournament?.maxPlayers || 16
      };
    }).sort((a, b) => b.remaining - a.remaining);
  };

  const statusLabel = useMemo(() => {
    switch (auctionStatus) {
      case 'running': return 'Running';
      case 'paused': return 'Paused';
      case 'completed': return 'Completed';
      case 'locked': return 'Locked';
      case 'stopped': return 'Not Started';
      default: return 'Unknown';
    }
  }, [auctionStatus]);

  if (loading) {
    return (
      <TournamentAdminLayout>
        <div className="auction-loading">
          <div className="loading-spinner"></div>
          <p>Loading auction data...</p>
        </div>
      </TournamentAdminLayout>
    );
  }

  if (error && !tournament) {
    return (
      <TournamentAdminLayout>
        <div className="auction-error">
          <h3>Error Loading Auction</h3>
          <p>{error}</p>
          <button onClick={() => fetchLiveData()}>Retry</button>
        </div>
      </TournamentAdminLayout>
    );
  }

  // Calculate stats for dashboard
  const pendingCount = history.filter(p => p.auctionStatus === 'Pending').length;
  const soldCount = history.filter(p => p.auctionStatus === 'Sold').length;
  const unsoldCount = history.filter(p => p.auctionStatus === 'Unsold').length;
  const totalSpent = getTotalSpent();

  // Get recent bids from current player's bid history
  useEffect(() => {
    if (currentPlayer?.bidHistory && currentPlayer.bidHistory.length > 0) {
      const recent = currentPlayer.bidHistory
        .slice(-10)
        .reverse()
        .map(bid => ({
          teamName: bid.teamName || teams.find(t => t._id === bid.bidder)?.name || 'Unknown',
          amount: bid.bidAmount || bid.amount || 0,
          timestamp: bid.timestamp || new Date()
        }));
      setRecentBids(recent);
    } else {
      setRecentBids([]);
    }
  }, [currentPlayer, teams]);

  // Update event log from auction logs
  useEffect(() => {
    if (tournament?.auctionState?.logs && Array.isArray(tournament.auctionState.logs)) {
      const logs = tournament.auctionState.logs.slice(-50).reverse();
      setEventLog(logs);
    }
  }, [tournament]);

  const handleWithdraw = async () => {
    if (!withdrawReason.trim()) {
      toast.error('Please provide a withdrawal reason');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/withdraw`, {
        reason: withdrawReason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player withdrawn');
      setShowWithdrawModal(false);
      setWithdrawReason('');
      fetchLiveData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to withdraw player');
    }
  };

  const handleDownloadReport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/auctions/${code}/report`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${code}_Auction_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Report downloaded');
    } catch (err) {
      toast.error('Failed to download report');
    }
  };

  const handleReauction = async (playerId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/reauction/${playerId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player moved back to auction');
      fetchLiveData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to re-auction player');
    }
  };

  const handleForceAuction = async (playerId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/pending/force-auction/${playerId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player put in force auction (quota bypass enabled)');
      fetchLiveData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to put player in force auction');
    }
  };

  const handleOpenDirectAssign = (player) => {
    setSelectedPlayerForAssign(player);
    setAssignPrice(player.basePrice?.toString() || '0');
    setAssignTeamId('');
    setShowDirectAssignModal(true);
  };

  const handleDirectAssign = async () => {
    if (!selectedPlayerForAssign) return;
    if (!assignTeamId) {
      toast.error('Please select a team');
      return;
    }
    const price = parseFloat(assignPrice);
    if (isNaN(price) || price < 0) {
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
      fetchLiveData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign player');
    }
  };

  const handleRevokeSale = async (playerId) => {
    if (!window.confirm('Are you sure you want to revoke this sale? This will move the player back to auction.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/revoke-sale/${playerId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Sale revoked');
      fetchLiveData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke sale');
    }
  };

  return (
    <TournamentAdminLayout>
      <div className="tournament-auction-page">
        {/* Top Header Bar */}
        <div className="auction-top-header">
          <div className="header-left-section">
            <div className="tournament-code-badge">{code}</div>
            <div className="tournament-name-header">{tournament?.name || 'Auction Control'}</div>
            <div className="header-meta">
              {tournament?.venue && <span className="meta-item">📍 {tournament.venue}</span>}
              {tournament?.auctionState?.currentRound && (
                <span className="meta-item">Round {tournament.auctionState.currentRound}</span>
              )}
              <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                {isConnected ? '🟢 Live' : '🔴 Offline'}
              </span>
            </div>
          </div>
          <div className="header-right-section">
            <div className={`auction-status-badge status-${auctionStatus}`}>
              <span className="status-dot"></span>
              {statusLabel}
            </div>
            {tournament?.auctionState?.stage && (
              <div className="stage-indicator">Stage: {tournament.auctionState.stage}</div>
            )}
            <button 
              className="btn-header btn-refresh"
              onClick={() => fetchLiveData()}
              disabled={isRefreshing}
              title="Refresh data"
            >
              {isRefreshing ? '⏳' : '🔄'} Refresh
            </button>
            <button 
              className="btn-header btn-report"
              onClick={handleDownloadReport}
              title="Download report"
            >
              📄 Report
            </button>
            <button 
              className="btn-header"
              onClick={() => setActiveTab('pending')}
              style={{
                backgroundColor: pendingCount > 0 ? '#f59e0b' : '#6b7280',
                color: 'white',
                fontWeight: '500',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '14px'
              }}
              title={pendingCount > 0 ? `View and manage ${pendingCount} pending player${pendingCount > 1 ? 's' : ''}` : 'View pending players'}
            >
              Result
            </button>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="stats-dashboard">
          <div className="stat-box">
            <div className="stat-label">Teams</div>
            <div className="stat-value">{teams.length}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Sold Players</div>
            <div className="stat-value">{soldCount}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Pending Players</div>
            <div className="stat-value">{pendingCount}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Unsold Players</div>
            <div className="stat-value">{unsoldCount}</div>
          </div>
          <div className="stat-box stat-highlight">
            <div className="stat-label">Total Spent</div>
            <div className="stat-value">₹{totalSpent.toLocaleString()}</div>
          </div>
          <div className="stat-box stat-highlight">
            <div className="stat-label">Timer</div>
            <div className="stat-value timer-countdown">{timer}s</div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="settings-panel">
            <h3>Timer Settings</h3>
            <div className="setting-item">
              <label>Default Timer (seconds)</label>
              <input 
                type="number" 
                value={timerConfig} 
                onChange={(e) => setTimerConfig(Number(e.target.value))}
                min="10"
                max="120"
              />
            </div>
            <div className="setting-item">
              <label>Last Call Timer (seconds)</label>
              <input 
                type="number" 
                value={lastCallTimer} 
                onChange={(e) => setLastCallTimer(Number(e.target.value))}
                min="5"
                max="30"
              />
            </div>
            <button onClick={() => setShowSettings(false)}>Close</button>
          </div>
        )}

        {/* Tabs */}
        <div className="auction-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', overflowX: 'auto' }}>
          <button 
            className={`tab-btn ${activeTab === 'auction' ? 'active' : ''}`}
            onClick={() => setActiveTab('auction')}
          >
            Auction
          </button>
          <button 
            className={`tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
            onClick={() => setActiveTab('teams')}
          >
            Teams
          </button>
          <button 
            className={`tab-btn ${activeTab === 'statistics' ? 'active' : ''}`}
            onClick={() => setActiveTab('statistics')}
          >
            Statistics
          </button>
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </div>

        {/* Auction Tab - Two Column Layout */}
        {activeTab === 'auction' && (
          <div className="auction-tab-content">
            <div className="auction-main-layout">
              {/* Left Column - Current Player & Controls */}
              <div className="auction-left-column">
                {/* Current Player Card */}
                {currentPlayer ? (
                  <div 
                    className="current-player-card glass-card"
                    onClick={() => {
                      setSelectedPlayerDetail(currentPlayer);
                      setShowPlayerDetail(true);
                    }}
                  >
                    <img 
                      src={getPlayerPhotoUrl(currentPlayer.photo)} 
                      alt={currentPlayer.name}
                      onError={(e) => {
                        e.target.src = `${API_BASE_URL}/default-photo.png`;
                      }}
                    />
                    <div className="player-info-main">
                      <h2 className="player-name-gradient">{currentPlayer.name}</h2>
                      <div className="player-badges">
                        <span className="badge badge-id">#{currentPlayer.playerId || 'N/A'}</span>
                        <span className="badge badge-role">{currentPlayer.role || 'Player'}</span>
                      </div>
                      <div className="player-price-info">
                        <div className="price-row">
                          <span className="price-label">Base Price:</span>
                          <span className="price-value">₹{currentPlayer.basePrice?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="price-row">
                          <span className="price-label">Current Bid:</span>
                          <span className="price-value highlight">₹{currentBid.toLocaleString()}</span>
                        </div>
                        {leadingTeam && (
                          <div className="price-row">
                            <span className="price-label">Highest Bidder:</span>
                            <span className="price-value">{leadingTeam.name}</span>
                          </div>
                        )}
                        <div className="price-row">
                          <span className="price-label">Next Bid:</span>
                          <span className="price-value">₹{(currentBid + 1000).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="timer-display-main">
                        <div className="timer-label">Time Remaining</div>
                        <div className={`timer-countdown-large ${timer <= 5 ? 'urgent' : ''}`}>
                          {timer}s
                        </div>
                        {currentPlayer.bidHistory && currentPlayer.bidHistory.length > 0 && 
                         currentPlayer.bidHistory[currentPlayer.bidHistory.length - 1]?.bidder === leadingTeam?._id && (
                          <div className="warning-badge">⚠️ Last bidder cannot bid again</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-player-card glass-card">
                    <p>No active player</p>
                  </div>
                )}

                {/* Control Panel */}
                <div className="control-panel glass-card" style={{ maxHeight: 'none', overflow: 'visible' }}>
                  {/* Session Control */}
                  <div className="control-section" style={{ marginBottom: '12px' }}>
                    <h3 className="section-title" style={{ fontSize: '14px', marginBottom: '8px' }}>Session Control</h3>
                    <div className="control-buttons-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                      {auctionStatus === 'stopped' && (
                        <button className="btn-control btn-primary" onClick={() => handleStartAuction(false)}>
                          ▶️ Start
                        </button>
                      )}
                      {auctionStatus === 'running' && (
                        <>
                          <button className="btn-control btn-warning" onClick={handlePauseAuction}>
                            ⏸️ Pause
                          </button>
                          <button className="btn-control btn-danger" onClick={handleEndAuction}>
                            ⏹️ End Round
                          </button>
                        </>
                      )}
                      {auctionStatus === 'paused' && (
                        <>
                          <button className="btn-control btn-primary" onClick={handleResumeAuction}>
                            ▶️ Resume
                          </button>
                          <button className="btn-control btn-danger" onClick={handleEndAuction}>
                            ⏹️ End Round
                          </button>
                        </>
                      )}
                      {auctionStatus === 'completed' && (
                        <button className="btn-control btn-primary" onClick={() => {
                          toast.info('Round 2 functionality coming soon');
                        }}>
                          🔄 Round 2
                        </button>
                      )}
                      {tournament?.isLocked && (
                        <button className="btn-control btn-warning" onClick={async () => {
                          try {
                            const token = localStorage.getItem('token');
                            await axios.post(`${API_BASE_URL}/api/tournaments/${code}/unlock`, {}, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            toast.success('Tournament unlocked');
                            fetchLiveData(true);
                          } catch (err) {
                            toast.error('Failed to unlock tournament');
                          }
                        }}>
                          🔓 Unlock
                        </button>
                      )}
                      <button className="btn-control btn-secondary" onClick={handleOpenViewer}>
                        📺 Display
                      </button>
                    </div>
                  </div>

                  {/* Player Actions */}
                  <div className="control-section" style={{ marginBottom: '12px' }}>
                    <h3 className="section-title" style={{ fontSize: '14px', marginBottom: '8px' }}>Player Actions</h3>
                    <div className="control-buttons-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                      <button 
                        className="btn-control btn-secondary" 
                        onClick={handleNextPlayer}
                        disabled={!currentPlayer}
                      >
                        ➡️ Next Player
                      </button>
                      <button 
                        className="btn-control btn-warning" 
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('token');
                            await axios.post(`${API_BASE_URL}/api/auctions/${code}/stop`, {}, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            toast.success('Auction stopped');
                            fetchLiveData(true);
                          } catch (err) {
                            toast.error('Failed to stop auction');
                          }
                        }}
                        disabled={!currentPlayer}
                      >
                        ⏹️ Stop
                      </button>
                    </div>
                  </div>

                  {/* Outcome Actions */}
                  <div className="control-section" style={{ marginBottom: '0' }}>
                    <h3 className="section-title" style={{ fontSize: '14px', marginBottom: '8px' }}>Outcome Actions</h3>
                    <div className="control-buttons-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', width: '100%' }}>
                      <button 
                        className="btn-control btn-success" 
                        onClick={handleMarkSold}
                        disabled={!currentPlayer || currentBid === 0}
                      >
                        ✅ Sold
                      </button>
                      <button 
                        className="btn-control btn-warning" 
                        onClick={handleMarkPending}
                        disabled={!currentPlayer || currentBid !== 0}
                      >
                        ⏳ Pending
                      </button>
                      <button 
                        className="btn-control btn-danger" 
                        onClick={handleMarkUnsold}
                        disabled={!currentPlayer || (currentPlayer.bidHistory && currentPlayer.bidHistory.length > 0)}
                      >
                        ❌ Unsold
                      </button>
                      <button 
                        className="btn-control btn-danger" 
                        onClick={() => setShowWithdrawModal(true)}
                        disabled={!currentPlayer}
                      >
                        🚫 Withdraw
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Teams & Activity */}
              <div className="auction-right-column">
                {/* Teams Panel */}
                <div className="teams-panel glass-card">
                  <h3 className="section-title">Teams</h3>
                  <div className="teams-list">
                    {getTeamBudgets().map((team) => {
                      const isLeading = leadingTeam?._id === team._id;
                      const isLastBidder = currentPlayer?.bidHistory && 
                        currentPlayer.bidHistory.length > 0 &&
                        currentPlayer.bidHistory[currentPlayer.bidHistory.length - 1]?.bidder === team._id;
                      const canBid = currentPlayer && 
                        auctionStatus === 'running' && 
                        !isLastBidder && 
                        team.maxBid >= (currentBid + 1000);
                      
                      return (
                        <div 
                          key={team._id} 
                          className={`team-item ${isLeading ? 'leading' : ''} ${isLastBidder ? 'last-bidder' : ''}`}
                          onClick={() => {
                            setSelectedTeamForHistory(team);
                            setShowTeamBidHistory(true);
                          }}
                        >
                          <div className="team-header-item">
                            {team.logo && (
                              <img 
                                src={getTeamLogoUrl(team.logo)} 
                                alt={team.name}
                                className="team-logo-small"
                                onError={(e) => {
                                  e.target.src = `${API_BASE_URL}/default-logo.png`;
                                }}
                              />
                            )}
                            <div className="team-info-item">
                              <div className="team-name-item">{team.name}</div>
                              <div className="team-balance">Balance: ₹{team.remaining?.toLocaleString() || '0'}</div>
                            </div>
                          </div>
                          <div className="team-stats-item">
                            <div className="team-stat">Players: {team.playersBought || 0}</div>
                            <div className={`team-stat ${team.maxBid < (currentBid + 1000) ? 'warning' : ''}`}>
                              Max Bid: ₹{team.maxBid?.toLocaleString() || '0'}
                            </div>
                          </div>
                          <button 
                            className={`btn-bid ${canBid ? '' : 'disabled'}`}
                            disabled={!canBid}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle bid - would need to call API
                              toast.info('Bid functionality via API');
                            }}
                          >
                            Bid
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Bids */}
                <div className="recent-bids-panel glass-card">
                  <h3 className="section-title">Recent Bids</h3>
                  <div className="bids-list">
                    {recentBids.length > 0 ? (
                      recentBids.map((bid, idx) => (
                        <div key={idx} className="bid-item">
                          <span className="bid-team-name">{bid.teamName}</span>
                          <span className="bid-amount">₹{bid.amount.toLocaleString()}</span>
                          <span className="bid-time">{new Date(bid.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="no-bids">No recent bids</div>
                    )}
                  </div>
                </div>

                {/* Event Log */}
                <div className="event-log-panel glass-card">
                  <h3 className="section-title">Event Log</h3>
                  <div className="event-log-list">
                    {eventLog.length > 0 ? (
                      eventLog.map((log, idx) => (
                        <div key={idx} className={`event-item event-${log.type || 'info'}`}>
                          <span className="event-time">{new Date(log.timestamp || Date.now()).toLocaleTimeString()}</span>
                          <span className="event-message">{log.message || log}</span>
                        </div>
                      ))
                    ) : (
                      <div className="no-events">No events yet</div>
                    )}
                  </div>
                </div>

                {/* Budget Overview */}
                <div className="budget-overview-panel glass-card">
                  <h3 className="section-title">Budget Overview</h3>
                  <div className="budget-list">
                    {getTeamBudgets().map((team) => {
                      const spentPercent = team.budget ? (team.spent / team.budget) * 100 : 0;
                      const budgetStatus = spentPercent < 50 ? 'healthy' : spentPercent < 80 ? 'moderate' : 'critical';
                      
                      return (
                        <div key={team._id} className="budget-item">
                          <div className="budget-header">
                            <span className="budget-team-name">{team.name}</span>
                            <span className="budget-players">{team.playersBought || 0} players</span>
                          </div>
                          <div className="budget-bar-container">
                            <div className={`budget-bar budget-${budgetStatus}`} style={{ width: `${Math.min(spentPercent, 100)}%` }}></div>
                          </div>
                          <div className="budget-details">
                            <span>₹{team.spent?.toLocaleString() || '0'} / ₹{team.budget?.toLocaleString() || '0'}</span>
                            <span>Remaining: ₹{team.remaining?.toLocaleString() || '0'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="teams-tab-content">
            <div className="teams-header">
              <h2>Teams</h2>
              <div className="view-toggle">
                <button 
                  className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  Grid
                </button>
                <button 
                  className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  List
                </button>
              </div>
            </div>
            <div className={`teams-container ${viewMode}`}>
              {getTeamBudgets().map((team) => (
                <div key={team._id} className="team-card">
                  <div className="team-logo">
                    <img 
                      src={getTeamLogoUrl(team.logo)} 
                      alt={team.name}
                      onError={(e) => {
                        e.target.src = `${API_BASE_URL}/default-logo.png`;
                      }}
                    />
                  </div>
                  <div className="team-info">
                    <h3>{team.name}</h3>
                    {(team.isQuotaFull || team.remainingPlayers === 0) && (
                      <div style={{
                        padding: '4px 8px',
                        background: 'rgba(245, 158, 11, 0.2)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#f59e0b',
                        marginBottom: '8px',
                        fontWeight: '500'
                      }}>
                        ⚠️ QUOTA FULL
                      </div>
                    )}
                    <div className="team-stats">
                      <div className="stat-item">
                        <label>Budget</label>
                        <span>₹{team.budget?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="stat-item">
                        <label>Spent</label>
                        <span>₹{team.spent?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="stat-item">
                        <label>Remaining</label>
                        <span className={team.remaining < 0 ? 'negative' : ''}>
                          ₹{team.remaining?.toLocaleString() || '0'}
                        </span>
                      </div>
                      <div className="stat-item">
                        <label>Players</label>
                        <span style={{ 
                          color: (team.isQuotaFull || team.remainingPlayers === 0) ? '#f59e0b' : 'inherit',
                          fontWeight: (team.isQuotaFull || team.remainingPlayers === 0) ? '600' : 'normal'
                        }}>
                          {team.playersBought || 0} / {team.maxPlayers || tournament?.maxPlayers || 16}
                        </span>
                      </div>
                      <div className="stat-item">
                        <label>Max Bid</label>
                        <span>₹{team.maxBid?.toLocaleString() || '0'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'statistics' && (
          <div className="statistics-tab-content">
            <h2>Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Progress</h3>
                <div className="stat-value">{summary.auctioned} / {summary.totalPlayers}</div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(summary.auctioned / summary.totalPlayers) * 100}%` }}
                  ></div>
                </div>
                <p>{summary.remaining} remaining</p>
              </div>
              <div className="stat-card">
                <h3>Total Spent</h3>
                <div className="stat-value">₹{getTotalSpent().toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <h3>Average Bid</h3>
                <div className="stat-value">₹{getAverageBid().toLocaleString()}</div>
              </div>
              {summary.mostExpensivePlayer && (
                <div className="stat-card">
                  <h3>Most Expensive</h3>
                  <div className="stat-value">{summary.mostExpensivePlayer.name}</div>
                  <p>₹{summary.mostExpensivePlayer.soldPrice?.toLocaleString()} - {summary.mostExpensivePlayer.soldToName}</p>
                </div>
              )}
              {summary.lastSoldPlayer && (
                <div className="stat-card">
                  <h3>Last Sold</h3>
                  <div className="stat-value">{summary.lastSoldPlayer.name}</div>
                  <p>₹{summary.lastSoldPlayer.soldPrice?.toLocaleString()} - {summary.lastSoldPlayer.soldToName}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="history-tab-content">
            <h2>Recent Sales</h2>
            <div className="history-list">
              {history.slice(0, 50).map((player, idx) => (
                <div key={idx} className={`history-item ${player.auctionStatus === 'Sold' ? 'sold' : 'unsold'}`}>
                  <div className="history-rank">{idx + 1}</div>
                  <div className="history-player-photo">
                    <img 
                      src={getPlayerPhotoUrl(player.photo)} 
                      alt={player.name}
                      onError={(e) => {
                        e.target.src = `${API_BASE_URL}/default-photo.png`;
                      }}
                    />
                  </div>
                  <div className="history-player-info">
                    <h4>{player.name}</h4>
                    <p>{player.role} • {player.city || 'N/A'}</p>
                  </div>
                  <div className="history-status">
                    {player.auctionStatus === 'Sold' ? (
                      <>
                        <span className="sold-to">{player.soldToName}</span>
                        <span className="sold-price">₹{player.soldPrice?.toLocaleString()}</span>
                      </>
                    ) : (
                      <span className="unsold-badge">Unsold</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Players Tab */}
        {activeTab === 'pending' && (
          <div className="pending-tab-content">
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px',
              padding: '0 10px'
            }}>
              <h2 style={{ margin: 0 }}>
                ⏳ Pending Players
                {pendingCount > 0 && (
                  <span style={{
                    marginLeft: '12px',
                    fontSize: '18px',
                    color: '#f59e0b',
                    fontWeight: 'normal'
                  }}>
                    ({pendingCount} {pendingCount === 1 ? 'player' : 'players'})
                  </span>
                )}
              </h2>
              {pendingCount > 0 && (
                <div style={{
                  padding: '8px 16px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#f59e0b'
                }}>
                  ⚠️ All teams may be at full quota. Use Force Auction or Direct Assign to bypass quota limits.
                </div>
              )}
            </div>

            {pendingCount === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--admin-text-secondary)'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <h3 style={{ marginBottom: '8px' }}>No Pending Players</h3>
                <p>All players have been processed. Great job!</p>
              </div>
            ) : (
              <div className="pending-players-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px',
                padding: '0 10px'
              }}>
                {history.filter(p => p.auctionStatus === 'Pending').map((player) => (
                  <div 
                    key={player._id} 
                    className="player-card-small glass-card"
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    onClick={() => {
                      setSelectedPlayerDetail(player);
                      setShowPlayerDetail(true);
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                      <img 
                        src={getPlayerPhotoUrl(player.photo)} 
                        alt={player.name}
                        className="player-photo-small"
                        style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '8px',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          e.target.src = `${API_BASE_URL}/default-photo.png`;
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: 'var(--admin-text-secondary)',
                          marginBottom: '4px'
                        }}>
                          #{player.playerId}
                        </div>
                        <div style={{ 
                          fontSize: '16px', 
                          fontWeight: '600',
                          marginBottom: '4px',
                          color: 'var(--admin-text-primary)'
                        }}>
                          {player.name}
                        </div>
                        <div style={{ 
                          fontSize: '13px', 
                          color: 'var(--admin-text-secondary)',
                          marginBottom: '4px'
                        }}>
                          {player.role || 'N/A'}
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: '500',
                          color: '#4CAF50'
                        }}>
                          ₹{player.basePrice?.toLocaleString() || '0'}
                        </div>
                      </div>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      gap: '8px',
                      marginTop: '12px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                      paddingTop: '12px'
                    }}>
                      <button 
                        className="btn-reauction"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleForceAuction(player._id);
                        }}
                        style={{ 
                          flex: 1,
                          fontSize: '12px', 
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'rgba(59, 130, 246, 0.2)',
                          color: '#3b82f6',
                          cursor: 'pointer',
                          fontWeight: '500',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                        }}
                      >
                        🚀 Force Auction
                      </button>
                      <button 
                        className="btn-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDirectAssign(player);
                        }}
                        style={{ 
                          flex: 1,
                          fontSize: '12px', 
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#4CAF50',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: '500',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#45a049';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#4CAF50';
                        }}
                      >
                        📋 Direct Assign
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Player Lists Section */}
        <div className="player-lists-section">
          <div className="player-lists-grid">
            {/* Pending Players */}
            <div className="player-list-card glass-card">
              <h3 className="list-title">Pending Players</h3>
              <div className="players-grid">
                {history.filter(p => p.auctionStatus === 'Pending').slice(0, 12).map((player) => (
                  <div key={player._id} className="player-card-small">
                    <img 
                      src={getPlayerPhotoUrl(player.photo)} 
                      alt={player.name}
                      className="player-photo-small"
                      onError={(e) => {
                        e.target.src = `${API_BASE_URL}/default-photo.png`;
                      }}
                    />
                    <div className="player-info-small">
                      <div className="player-id-small">#{player.playerId}</div>
                      <div className="player-role-small">{player.role}</div>
                      <div className="player-name-small">{player.name}</div>
                      <div className="player-price-small">₹{player.basePrice?.toLocaleString() || '0'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                      <button 
                        className="btn-reauction"
                        onClick={() => handleForceAuction(player._id)}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                      >
                        Force Auction
                      </button>
                      <button 
                        className="btn-action"
                        onClick={() => handleOpenDirectAssign(player)}
                        style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#4CAF50' }}
                      >
                        Direct Assign
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sold Players */}
            <div className="player-list-card glass-card">
              <h3 className="list-title">Sold Players</h3>
              <div className="players-grid">
                {history.filter(p => p.auctionStatus === 'Sold').slice(0, 12).map((player) => (
                  <div key={player._id} className="player-card-small">
                    <img 
                      src={getPlayerPhotoUrl(player.photo)} 
                      alt={player.name}
                      className="player-photo-small"
                      onError={(e) => {
                        e.target.src = `${API_BASE_URL}/default-photo.png`;
                      }}
                    />
                    <div className="player-info-small">
                      <div className="player-id-small">#{player.playerId}</div>
                      <div className="player-team-small">{player.soldToName}</div>
                      <div className="player-name-small">{player.name}</div>
                      <div className="player-price-small sold">₹{player.soldPrice?.toLocaleString() || '0'}</div>
                    </div>
                    <button 
                      className="btn-revoke"
                      onClick={() => handleRevokeSale(player._id)}
                    >
                      Revoke Sale
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Unsold Players */}
            <div className="player-list-card glass-card">
              <h3 className="list-title">Unsold Players</h3>
              <div className="players-grid">
                {history.filter(p => p.auctionStatus === 'Unsold').slice(0, 12).map((player) => (
                  <div key={player._id} className="player-card-small">
                    <img 
                      src={getPlayerPhotoUrl(player.photo)} 
                      alt={player.name}
                      className="player-photo-small"
                      onError={(e) => {
                        e.target.src = `${API_BASE_URL}/default-photo.png`;
                      }}
                    />
                    <div className="player-info-small">
                      <div className="player-id-small">#{player.playerId}</div>
                      <div className="player-role-small">{player.role}</div>
                      <div className="player-name-small">{player.name}</div>
                      <div className="player-price-small">₹{player.basePrice?.toLocaleString() || '0'}</div>
                    </div>
                    <button 
                      className="btn-reauction"
                      onClick={() => handleReauction(player._id)}
                    >
                      Re-auction
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Withdrawn Players */}
            <div className="player-list-card glass-card">
              <h3 className="list-title">Withdrawn Players</h3>
              <div className="players-grid">
                {history.filter(p => p.auctionStatus === 'Withdrawn').slice(0, 12).map((player) => (
                  <div key={player._id} className="player-card-small">
                    <img 
                      src={getPlayerPhotoUrl(player.photo)} 
                      alt={player.name}
                      className="player-photo-small"
                      onError={(e) => {
                        e.target.src = `${API_BASE_URL}/default-photo.png`;
                      }}
                    />
                    <div className="player-info-small">
                      <div className="player-id-small">#{player.playerId}</div>
                      <div className="player-name-small">{player.name}</div>
                      <div className="player-reason-small">{player.withdrawalReason || 'N/A'}</div>
                      <div className="player-time-small">
                        {player.withdrawnAt ? new Date(player.withdrawnAt).toLocaleString() : 'N/A'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Settings Panel */}
        {showSettings && (
          <div className="advanced-settings-panel glass-card">
            <h3>Advanced Settings</h3>
            <div className="settings-grid">
              <div className="setting-item">
                <label>
                  <input 
                    type="checkbox" 
                    checked={autoTimerEnabled}
                    onChange={(e) => setAutoTimerEnabled(e.target.checked)}
                  />
                  Auto Timer
                </label>
                {autoTimerEnabled && (
                  <>
                    <input 
                      type="number" 
                      value={timerConfig} 
                      onChange={(e) => setTimerConfig(Number(e.target.value))}
                      min="10"
                      max="120"
                      placeholder="Seconds"
                    />
                    <select 
                      value={autoTimeoutAction}
                      onChange={(e) => setAutoTimeoutAction(e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="unsold">Unsold</option>
                    </select>
                  </>
                )}
              </div>
              <div className="setting-item">
                <label>
                  <input 
                    type="checkbox" 
                    checked={voiceAnnouncerEnabled}
                    onChange={(e) => setVoiceAnnouncerEnabled(e.target.checked)}
                  />
                  Voice Announcer
                </label>
              </div>
              <div className="setting-item">
                <label>
                  <input 
                    type="checkbox" 
                    checked={autoNextEnabled}
                    onChange={(e) => setAutoNextEnabled(e.target.checked)}
                  />
                  Auto-Next
                </label>
              </div>
              <div className="setting-item">
                <label>
                  <input 
                    type="checkbox" 
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                  />
                  Sound Alerts
                </label>
              </div>
            </div>
            <button onClick={() => setShowSettings(false)}>Close</button>
          </div>
        )}

        {/* Bid History Modal */}
        {showBidHistory && (
          <div className="modal-overlay" onClick={() => setShowBidHistory(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Bid History</h3>
                <button onClick={() => setShowBidHistory(false)}>×</button>
              </div>
              <div className="modal-body">
                {bidHistory.length > 0 ? (
                  <div className="bid-history-list">
                    {bidHistory.map((bid, idx) => (
                      <div key={idx} className="bid-history-item">
                        <span className="bid-team">{bid.teamName || 'Team'}</span>
                        <span className="bid-amount">₹{bid.amount?.toLocaleString() || '0'}</span>
                        <span className="bid-time">{new Date(bid.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No bids yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Withdraw Confirmation Modal */}
        {showWithdrawModal && (
          <div className="modal-overlay" onClick={() => setShowWithdrawModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Withdraw Player</h3>
                <button onClick={() => setShowWithdrawModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <p>Please provide a reason for withdrawal:</p>
                <textarea
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="Enter withdrawal reason..."
                  rows={4}
                  className="withdraw-textarea"
                />
                <div className="modal-actions">
                  <button onClick={() => setShowWithdrawModal(false)}>Cancel</button>
                  <button onClick={handleWithdraw} className="btn-danger">Confirm Withdraw</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Post-Auction Summary Modal */}
        {showPostAuctionSummary && auctionStatus === 'completed' && (
          <div className="modal-overlay" onClick={() => setShowPostAuctionSummary(false)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Post-Auction Summary</h3>
                <button onClick={() => setShowPostAuctionSummary(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="summary-grid">
                  <div className="summary-item">
                    <div className="summary-label">Teams</div>
                    <div className="summary-value">{teams.length}</div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-label">Sold</div>
                    <div className="summary-value">{soldCount}</div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-label">Unsold</div>
                    <div className="summary-value">{unsoldCount}</div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-label">Withdrawn</div>
                    <div className="summary-value">{history.filter(p => p.auctionStatus === 'Withdrawn').length}</div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-label">Total Spent</div>
                    <div className="summary-value">₹{totalSpent.toLocaleString()}</div>
                  </div>
                </div>
                <div className="modal-actions">
                  <button onClick={handleDownloadReport}>Download Report</button>
                  <button onClick={() => setShowPostAuctionSummary(false)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Bid History Modal */}
        {showTeamBidHistory && selectedTeamForHistory && (
          <div className="modal-overlay" onClick={() => setShowTeamBidHistory(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Bid History - {selectedTeamForHistory.name}</h3>
                <button onClick={() => setShowTeamBidHistory(false)}>×</button>
              </div>
              <div className="modal-body">
                {currentPlayer?.bidHistory && currentPlayer.bidHistory.length > 0 ? (
                  <div className="bid-history-list">
                    {currentPlayer.bidHistory
                      .filter(bid => bid.bidder === selectedTeamForHistory._id || bid.teamName === selectedTeamForHistory.name)
                      .map((bid, idx) => (
                        <div key={idx} className="bid-history-item">
                          <span className={`bid-status ${bid.won ? 'won' : 'lost'}`}>
                            {bid.won ? '✓ Won' : '✗ Lost'}
                          </span>
                          <span className="bid-amount">₹{bid.bidAmount?.toLocaleString() || bid.amount?.toLocaleString() || '0'}</span>
                          <span className="bid-time">{new Date(bid.timestamp).toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p>No bid history for this team</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Player Detail Popup */}
        {showPlayerDetail && selectedPlayerDetail && (
          <div className="modal-overlay" onClick={() => setShowPlayerDetail(false)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Player Details</h3>
                <button onClick={() => setShowPlayerDetail(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="player-detail-content">
                  <div className="player-photo-full">
                    <img 
                      src={getPlayerPhotoUrl(selectedPlayerDetail.photo)} 
                      alt={selectedPlayerDetail.name}
                      onError={(e) => {
                        e.target.src = `${API_BASE_URL}/default-photo.png`;
                      }}
                    />
                  </div>
                  <div className="player-detail-info">
                    <h2>{selectedPlayerDetail.name}</h2>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">Player ID:</span>
                        <span className="detail-value">#{selectedPlayerDetail.playerId || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Role:</span>
                        <span className="detail-value">{selectedPlayerDetail.role || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">City:</span>
                        <span className="detail-value">{selectedPlayerDetail.city || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Mobile:</span>
                        <span className="detail-value">{selectedPlayerDetail.mobile || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Base Price:</span>
                        <span className="detail-value">₹{selectedPlayerDetail.basePrice?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Current Bid:</span>
                        <span className="detail-value">₹{selectedPlayerDetail.currentBid?.toLocaleString() || currentBid.toLocaleString()}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Auction Status:</span>
                        <span className="detail-value">{selectedPlayerDetail.auctionStatus || 'N/A'}</span>
                      </div>
                    </div>
                    {selectedPlayerDetail.bidHistory && selectedPlayerDetail.bidHistory.length > 0 && (
                      <div className="bid-history-section">
                        <h4>Complete Bid History</h4>
                        <div className="bid-history-list">
                          {selectedPlayerDetail.bidHistory.map((bid, idx) => {
                            const team = teams.find(t => t._id === bid.bidder || t.name === bid.teamName);
                            return (
                              <div key={idx} className="bid-history-item">
                                <span className="bid-team">{team?.name || bid.teamName || 'Unknown'}</span>
                                <span className="bid-amount">₹{bid.bidAmount?.toLocaleString() || bid.amount?.toLocaleString() || '0'}</span>
                                <span className="bid-time">{new Date(bid.timestamp).toLocaleString()}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pre-Start Warning Modal */}
        {showPreStartWarning && preStartWarnings.length > 0 && (
          <div className="modal-overlay" onClick={() => setShowPreStartWarning(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>⚠️ Auction Readiness Warning</h3>
                <button onClick={() => setShowPreStartWarning(false)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '16px', color: 'var(--admin-text-secondary)' }}>
                  The following issues were detected before starting the auction:
                </p>
                <ul style={{ 
                  listStyle: 'none', 
                  padding: 0, 
                  margin: '0 0 20px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {preStartWarnings.map((warning, idx) => (
                    <li key={idx} style={{
                      padding: '12px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '8px',
                      color: 'var(--admin-accent-warning, #f59e0b)'
                    }}>
                      • {warning}
                    </li>
                  ))}
                </ul>
                <div style={{ 
                  padding: '12px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '14px',
                  color: 'var(--admin-text-secondary)'
                }}>
                  <strong>Note:</strong> You can still proceed to start the auction, but it's recommended to resolve these issues first.
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn-action btn-history"
                    onClick={() => setShowPreStartWarning(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn-action btn-sold"
                    onClick={() => {
                      setShowPreStartWarning(false);
                      handleStartAuction(true);
                    }}
                  >
                    Proceed Anyway
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Readiness Errors Modal */}
        {showReadinessErrors && readinessErrors && (
          <div className="modal-overlay" onClick={() => setShowReadinessErrors(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>⚠️ Auction Readiness Check Failed</h3>
                <button onClick={() => setShowReadinessErrors(false)}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '16px', color: 'var(--admin-text-secondary)' }}>
                  The auction cannot start until the following issues are resolved:
                </p>
                <ul style={{ 
                  listStyle: 'none', 
                  padding: 0, 
                  margin: '0 0 20px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {readinessErrors.errors?.map((error, idx) => (
                    <li key={idx} style={{
                      padding: '12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      color: 'var(--admin-accent-danger)'
                    }}>
                      • {error}
                    </li>
                  ))}
                </ul>
                {readinessErrors.readiness && (
                  <div style={{
                    padding: '12px',
                    background: 'var(--admin-bg-secondary)',
                    borderRadius: '8px',
                    marginBottom: '16px'
                  }}>
                    <strong>Current Status:</strong>
                    <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--admin-text-secondary)' }}>
                      <div>Players: {readinessErrors.readiness.playerCount || 0} / {readinessErrors.readiness.requiredPlayers || 'N/A'}</div>
                      <div>Teams: {readinessErrors.readiness.teamCount || 0} / {readinessErrors.readiness.requiredTeams || 'N/A'}</div>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn-action btn-history"
                    onClick={() => setShowReadinessErrors(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn-action btn-sold"
                    onClick={() => {
                      setShowReadinessErrors(false);
                      handleStartAuction(true);
                    }}
                  >
                    Bypass & Start Anyway
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
                    background: 'rgba(59, 130, 246, 0.1)', 
                    borderRadius: '8px',
                    marginBottom: '16px'
                  }}>
                    <div><strong>Player:</strong> {selectedPlayerForAssign.name}</div>
                    <div><strong>Role:</strong> {selectedPlayerForAssign.role || 'N/A'}</div>
                    <div><strong>Base Price:</strong> ₹{selectedPlayerForAssign.basePrice?.toLocaleString() || '0'}</div>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    Select Team *
                  </label>
                  <select
                    value={assignTeamId}
                    onChange={(e) => {
                      setAssignTeamId(e.target.value);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--admin-text-primary)',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">-- Select Team --</option>
                    {teams.map((team) => {
                      const isFull = team.isQuotaFull || team.remainingPlayers === 0;
                      return (
                        <option key={team._id} value={team._id}>
                          {team.name} {isFull ? `(FULL - ${team.playersBought || 0}/${team.maxPlayers || 16})` : `(${team.playersBought || 0}/${team.maxPlayers || 16})`}
                        </option>
                      );
                    })}
                  </select>
                  {assignTeamId && (() => {
                    const selectedTeam = teams.find(t => t._id === assignTeamId);
                    const isFull = selectedTeam?.isQuotaFull || selectedTeam?.remainingPlayers === 0;
                    return isFull ? (
                      <div style={{
                        marginTop: '8px',
                        padding: '10px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '6px',
                        color: 'var(--admin-accent-warning, #f59e0b)',
                        fontSize: '13px'
                      }}>
                        ⚠️ This team is at full quota. Assignment will bypass quota limit.
                      </div>
                    ) : null;
                  })()}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    value={assignPrice}
                    onChange={(e) => setAssignPrice(e.target.value)}
                    min="0"
                    step="100"
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--admin-text-primary)',
                      fontSize: '14px'
                    }}
                    placeholder="Enter price"
                  />
                  {assignTeamId && assignPrice && (() => {
                    const selectedTeam = teams.find(t => t._id === assignTeamId);
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
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  color: 'var(--admin-text-secondary)'
                }}>
                  <strong>Note:</strong> This will directly assign the player to the selected team, bypassing quota limits if necessary.
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn-action btn-history"
                    onClick={() => {
                      setShowDirectAssignModal(false);
                      setSelectedPlayerForAssign(null);
                      setAssignTeamId('');
                      setAssignPrice('');
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn-action btn-sold"
                    onClick={handleDirectAssign}
                    disabled={!assignTeamId || !assignPrice}
                    style={{
                      opacity: (!assignTeamId || !assignPrice) ? 0.5 : 1,
                      cursor: (!assignTeamId || !assignPrice) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Assign Player
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TournamentAdminLayout>
  );
}

export default TournamentAuction;

