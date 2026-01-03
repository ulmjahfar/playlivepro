import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useParams } from 'react-router-dom';
import { copyToClipboard } from './utils/clipboard';
import { API_BASE_URL } from './utils/apiConfig';
import GroupingSummary from './components/GroupingSummary';
import './styles-live-auction.css';
import './styles-super-admin-dashboard.css';

function LiveAuction() {
  const { tournamentCode } = useParams();
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
  const [completionSummary, setCompletionSummary] = useState(null);
  const [auctionEndedAt, setAuctionEndedAt] = useState(null);
  const [history, setHistory] = useState([]);
  const [timer, setTimer] = useState(30);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showTeamDetails, setShowTeamDetails] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showBidHistory, setShowBidHistory] = useState(false);
  const [bidHistory, setBidHistory] = useState([]);
  const [showPlayerImageModal, setShowPlayerImageModal] = useState(false);
  const [selectedPlayerDetails, setSelectedPlayerDetails] = useState(null);
  const [showPlayerDetailsModal, setShowPlayerDetailsModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [showTeamReport, setShowTeamReport] = useState(false);
  const [teamDetailsData, setTeamDetailsData] = useState(null);
  const [teamPlayers, setTeamPlayers] = useState([]);
  const [loadingTeamDetails, setLoadingTeamDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('live');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [showTeamComparison, setShowTeamComparison] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [nextPlayerTimer, setNextPlayerTimer] = useState(null);
  const [nextPlayerData, setNextPlayerData] = useState(null);
  const [unsoldPlayers, setUnsoldPlayers] = useState([]);
  const [pendingPlayers, setPendingPlayers] = useState([]);
  const [totalPlayers, setTotalPlayers] = useState([]);
  const [bidwisePlayers, setBidwisePlayers] = useState([]);
  const [loadingUnsold, setLoadingUnsold] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingTotal, setLoadingTotal] = useState(false);
  const [loadingBidwise, setLoadingBidwise] = useState(false);
  const [completionActiveTab, setCompletionActiveTab] = useState('summary');
  const [completionPlayers, setCompletionPlayers] = useState([]);
  const [completionTeams, setCompletionTeams] = useState([]);
  const [loadingCompletionPlayers, setLoadingCompletionPlayers] = useState(false);
  const [loadingCompletionTeams, setLoadingCompletionTeams] = useState(false);
  const [selectedCompletionTeam, setSelectedCompletionTeam] = useState(null);
  const [completionTeamDetails, setCompletionTeamDetails] = useState(null);
  const [completionTeamPlayers, setCompletionTeamPlayers] = useState([]);
  const [loadingCompletionTeamDetails, setLoadingCompletionTeamDetails] = useState(false);
  const [selectedCompletionPlayerImage, setSelectedCompletionPlayerImage] = useState(null);
  const normalizedTournamentCode = useMemo(() => {
    const stateCode = (tournament?.code || '').toString().trim().toUpperCase();
    const paramCode = (tournamentCode || '').toString().trim().toUpperCase();
    return stateCode || paramCode;
  }, [tournament, tournamentCode]);
  const soundEnabledRef = useRef(true);
  const currentPlayerRef = useRef(null);
  const refreshIntervalRef = useRef(null);
  const socketRef = useRef(null);
  const notificationTimeoutRef = useRef(null);
  const isConnectingRef = useRef(false);
  const nextPlayerTimerIntervalRef = useRef(null);
  const nextPlayerDataRef = useRef(null);
  const activeTabRef = useRef('live');

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

  // Keep refs in sync with state
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Fetch initial data with loading state
  const fetchLiveData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [liveRes, teamsRes, summaryRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/auctions/live/${tournamentCode}`),
        axios.get(`${API_BASE_URL}/api/auctions/live-teams/${tournamentCode}`),
        axios.get(`${API_BASE_URL}/api/auctions/live-summary/${tournamentCode}`),
        axios.get(`${API_BASE_URL}/api/auctions/live-history/${tournamentCode}`)
      ]);

      setTournament(liveRes.data.tournament);
      setCompletionSummary(liveRes.data.completionSummary || null);
      setAuctionEndedAt(liveRes.data.auctionEndedAt || null);
      const nextStatus = normalizeStatus(liveRes.data.auctionStatus || liveRes.data.status);
      setAuctionStatus(nextStatus);
      setCurrentPlayer(nextStatus === 'completed' ? null : liveRes.data.currentPlayer);
      setTeams(teamsRes.data.teams || []);
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
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching live data:', err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [tournamentCode, normalizeStatus]);

  // Fetch unsold players list
  const fetchUnsoldList = useCallback(async () => {
    setLoadingUnsold(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auctions/live-unsold/${tournamentCode}`);
      setUnsoldPlayers(res.data.players || []);
    } catch (err) {
      console.error('Error fetching unsold players:', err);
      setUnsoldPlayers([]);
    } finally {
      setLoadingUnsold(false);
    }
  }, [tournamentCode]);

  // Fetch pending players list
  const fetchPendingList = useCallback(async () => {
    setLoadingPending(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auctions/live-pending/${tournamentCode}`);
      setPendingPlayers(res.data.players || []);
    } catch (err) {
      console.error('Error fetching pending players:', err);
      setPendingPlayers([]);
    } finally {
      setLoadingPending(false);
    }
  }, [tournamentCode]);

  // Fetch total players list - fetches ALL players without limit
  const fetchTotalList = useCallback(async () => {
    if (!tournamentCode) return;
    setLoadingTotal(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auctions/live-total/${tournamentCode}`);
      const players = res.data.players || [];
      setTotalPlayers(players);
      console.log(`✅ Fetched ${players.length} total players from backend`);
    } catch (err) {
      console.error('Error fetching total players:', err);
      setTotalPlayers([]);
    } finally {
      setLoadingTotal(false);
    }
  }, [tournamentCode]);

  // Fetch bidwise players list
  const fetchBidwiseList = useCallback(async () => {
    setLoadingBidwise(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auctions/live-bidwise/${tournamentCode}`);
      setBidwisePlayers(res.data.players || []);
    } catch (err) {
      console.error('Error fetching bidwise players:', err);
      setBidwisePlayers([]);
    } finally {
      setLoadingBidwise(false);
    }
  }, [tournamentCode]);

  // Fetch players for completion view
  const fetchCompletionPlayers = useCallback(async () => {
    if (!tournamentCode) return;
    setLoadingCompletionPlayers(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auctions/live-history/${tournamentCode}`);
      setCompletionPlayers(res.data.players || []);
    } catch (err) {
      console.error('Error fetching completion players:', err);
      setCompletionPlayers([]);
    } finally {
      setLoadingCompletionPlayers(false);
    }
  }, [tournamentCode]);

  // Fetch teams for completion view
  const fetchCompletionTeams = useCallback(async () => {
    if (!tournamentCode) return;
    setLoadingCompletionTeams(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auctions/live-teams/${tournamentCode}`);
      setCompletionTeams(res.data.teams || []);
    } catch (err) {
      console.error('Error fetching completion teams:', err);
      setCompletionTeams([]);
    } finally {
      setLoadingCompletionTeams(false);
    }
  }, [tournamentCode]);

  // Fetch team details for completion view
  const fetchCompletionTeamDetails = useCallback(async (teamId) => {
    if (!tournamentCode || !teamId) return;
    setLoadingCompletionTeamDetails(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auctions/live-team-details/${tournamentCode}/${teamId}`);
      setCompletionTeamDetails(response.data.team);
      setCompletionTeamPlayers(response.data.players || []);
    } catch (error) {
      console.error('Error fetching completion team details:', error);
      // Fallback to team data from teams list
      const team = completionTeams.find(t => t._id === teamId);
      if (team) {
        setCompletionTeamDetails(team);
        setCompletionTeamPlayers([]);
      }
    } finally {
      setLoadingCompletionTeamDetails(false);
    }
  }, [tournamentCode, completionTeams]);

  // Handle team card click in completion view
  const handleCompletionTeamClick = useCallback((teamId) => {
    setSelectedCompletionTeam(teamId);
    fetchCompletionTeamDetails(teamId);
  }, [fetchCompletionTeamDetails]);

  // Close team details in completion view
  const handleCloseCompletionTeamDetails = useCallback(() => {
    setSelectedCompletionTeam(null);
    setCompletionTeamDetails(null);
    setCompletionTeamPlayers([]);
  }, []);

  // Fetch data for active tab
  const fetchTabData = useCallback((tab) => {
    switch (tab) {
      case 'unsold':
        fetchUnsoldList();
        break;
      case 'pending':
        fetchPendingList();
        break;
      case 'total':
        fetchTotalList();
        break;
      case 'bidwise':
        fetchBidwiseList();
        break;
      case 'history':
        fetchTotalList();
        break;
      default:
        break;
    }
  }, [fetchUnsoldList, fetchPendingList, fetchTotalList, fetchBidwiseList]);

  // Refresh all tabs data after actions
  const refreshAllTabs = useCallback(() => {
    // Refresh main live data
    fetchLiveData(true);
    // Refresh all tab-specific data
    fetchUnsoldList();
    fetchPendingList();
    fetchTotalList();
    fetchBidwiseList();
  }, [fetchLiveData, fetchUnsoldList, fetchPendingList, fetchTotalList, fetchBidwiseList]);

  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
    if (currentPlayer?.bidHistory) {
      setBidHistory(currentPlayer.bidHistory.slice().reverse());
    }
  }, [currentPlayer]);

  // Socket connection and real-time updates
  useEffect(() => {
    fetchLiveData();
    // Also fetch total players list on initial load
    fetchTotalList();

    // Clean up existing socket if it exists
    if (socketRef.current) {
      const oldSocket = socketRef.current;
      socketRef.current = null; // Clear ref first to prevent race conditions
      
      // Check if socket is still connecting
      const isConnecting = oldSocket.io && oldSocket.io.readyState === 'opening';
      
      if (isConnecting) {
        // If still connecting, wait for it to complete or fail before disconnecting
        const cleanupAfterConnection = () => {
          try {
            oldSocket.removeAllListeners();
            oldSocket.disconnect();
          } catch (e) {
            // Ignore errors during cleanup
          }
        };
        
        // Wait for connection attempt to complete
        oldSocket.once('connect', cleanupAfterConnection);
        oldSocket.once('connect_error', cleanupAfterConnection);
        
        // Fallback timeout in case events don't fire
        setTimeout(cleanupAfterConnection, 500);
      } else {
        // Already connected or disconnected, cleanup immediately
        try {
          oldSocket.removeAllListeners();
          oldSocket.disconnect();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No authentication token found for socket connection');
      return;
    }

    isConnectingRef.current = true;
    const newSocket = io(API_BASE_URL, {
      transports: ['polling', 'websocket'], // Try polling first (more reliable), then upgrade to websocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true, // Always create a new connection to avoid reuse issues
      auth: {
        token: token
      }
    });
    
    socketRef.current = newSocket;

    const guard = (handler) => (payload = {}) => {
      if (payload.tournamentCode && payload.tournamentCode !== tournamentCode) return;
      handler(payload);
    };

    newSocket.on('connect', () => {
      console.log('Socket connected successfully');
      isConnectingRef.current = false;
      setIsConnected(true);
      refreshAllTabs();
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      isConnectingRef.current = false;
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      isConnectingRef.current = false;
      setIsConnected(false);
      
      // Log connection errors for debugging
      const errorMessage = error.message || String(error);
      const isPrematureCloseError = errorMessage.includes('WebSocket is closed') ||
        errorMessage.includes('closed before the connection is established') ||
        errorMessage.includes('xhr poll error');
      
      if (isPrematureCloseError) {
        // Log but don't show to user - this is often a cleanup side effect
        console.warn('WebSocket connection closed prematurely (likely during cleanup):', errorMessage);
      } else {
        console.error('Socket connection error:', error);
        // Only show user-facing errors for significant issues
        if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Network')) {
          console.warn('Server may be unreachable. Check network connection and server status.');
        }
      }
      
      // Handle authentication errors gracefully
      if (error.message === 'Authentication error') {
        setNotification({ 
          type: 'error', 
          message: 'Authentication failed. Please refresh the page or log in again.' 
        });
      }
    });

    newSocket.on('auction:start', guard(() => {
      setAuctionStatus('running');
      setTimer(30);
      refreshAllTabs();
      if (soundEnabledRef.current) playSound('start');
    }));

    newSocket.on('player:next', guard((payload) => {
      if (payload.player) {
        // Clear any existing timer
        if (nextPlayerTimerIntervalRef.current) {
          clearInterval(nextPlayerTimerIntervalRef.current);
          nextPlayerTimerIntervalRef.current = null;
        }
        
        // Store player data in ref and state, start 3-second countdown
        const playerData = payload.player;
        nextPlayerDataRef.current = playerData;
        setNextPlayerData(playerData);
        setNextPlayerTimer(3);
        
        // Start countdown interval
        let countdown = 3;
        nextPlayerTimerIntervalRef.current = setInterval(() => {
          countdown -= 1;
          if (countdown <= 0) {
            // Countdown complete - show player
            if (nextPlayerTimerIntervalRef.current) {
              clearInterval(nextPlayerTimerIntervalRef.current);
              nextPlayerTimerIntervalRef.current = null;
            }
            const playerToShow = nextPlayerDataRef.current;
            if (playerToShow) {
              setCurrentPlayer(playerToShow);
              nextPlayerDataRef.current = null;
            }
            setNextPlayerData(null);
            setNextPlayerTimer(null);
          } else {
            setNextPlayerTimer(countdown);
          }
        }, 1000);
      } else {
        // No player data - set immediately
        setCurrentPlayer(payload.player);
      }
      setAuctionStatus('running');
      setTimer(payload.timerSeconds || 30);
      refreshAllTabs();
      if (soundEnabledRef.current) playSound('next');
    }));

    newSocket.on('bid:update', guard((payload) => {
      if (currentPlayerRef.current && currentPlayerRef.current._id === payload.playerId) {
        setCurrentPlayer((prev) => ({
          ...prev,
          currentBid: payload.bidAmount,
          bidHistory: payload.bidHistory || prev.bidHistory
        }));
        setTimer(payload.timerSeconds || 30);
        if (soundEnabledRef.current) playSound('bid');
      }
      refreshAllTabs();
    }));

    newSocket.on('auction:pause', guard(() => {
      setAuctionStatus('paused');
      refreshAllTabs();
    }));

    newSocket.on('auction:resume', guard(() => {
      setAuctionStatus('running');
      setTimer(30);
      refreshAllTabs();
    }));

    newSocket.on('auction:stop', guard(() => {
      setAuctionStatus('stopped');
      setCurrentPlayer(null);
      refreshAllTabs();
    }));

    newSocket.on('player:sold', guard((payload) => {
      if (payload.player) {
        showNotification({
          type: 'sold',
          player: payload.player,
          team: payload.team || payload.soldToName,
          price: payload.price || payload.soldPrice || payload.player.soldPrice
        });
        if (soundEnabledRef.current) playSound('sold');
      }
      refreshAllTabs();
    }));

    newSocket.on('player:withdrawn', guard((payload) => {
      showNotification({
        type: 'withdrawn',
        player: payload.name || 'Player',
        reason: payload.reason || 'Unavailable for tournament'
      });
      setCurrentPlayer(null);
      setAuctionStatus('stopped');
      refreshAllTabs();
    }));

    newSocket.on('player:pending', guard(() => {
      refreshAllTabs();
    }));

    newSocket.on('player:unsold', guard((payload) => {
      showNotification({
        type: 'unsold',
        player: payload.playerName || 'Player',
        message: `❌ ${payload.playerName || 'Player'} marked as UNSOLD. Awaiting next player...`
      });
      setCurrentPlayer(null);
      setAuctionStatus('stopped');
      refreshAllTabs();
    }));

    newSocket.on('auction:end', guard((payload = {}) => {
      setAuctionStatus('completed');
      setCompletionSummary(payload.summary || null);
      setAuctionEndedAt(payload.completedAt || new Date().toISOString());
      setCurrentPlayer(null);
      setNotification({
        type: 'success',
        message: payload.message || 'Auction completed successfully!'
      });
      refreshAllTabs();
    }));

    newSocket.on('auction:update-balance', guard(() => {
      refreshAllTabs();
    }));

    newSocket.on('auction:update', guard(() => {
      refreshAllTabs();
    }));

    return () => {
      // Only cleanup if component is actually unmounting or tournamentCode changes
      isConnectingRef.current = false;
      if (socketRef.current) {
        const socket = socketRef.current;
        socketRef.current = null; // Clear ref first
        
        // Check if socket is still connecting
        const isConnecting = socket.io && socket.io.readyState === 'opening';
        
        if (isConnecting) {
          // Wait for connection attempt to complete
          const cleanupAfterConnection = () => {
            try {
              socket.removeAllListeners();
              socket.disconnect();
            } catch (e) {
              // Ignore errors during cleanup
            }
          };
          socket.once('connect', cleanupAfterConnection);
          socket.once('connect_error', cleanupAfterConnection);
          setTimeout(cleanupAfterConnection, 500); // Fallback timeout
        } else {
          // Already connected or disconnected, cleanup immediately
          try {
            socket.removeAllListeners();
            socket.disconnect();
          } catch (e) {
            // Ignore errors during cleanup
          }
        }
      }
      
      // Cleanup next player timer
      if (nextPlayerTimerIntervalRef.current) {
        clearInterval(nextPlayerTimerIntervalRef.current);
        nextPlayerTimerIntervalRef.current = null;
      }
    };
  }, [tournamentCode, refreshAllTabs]); // Removed activeTab to avoid recreating socket

  // Auto-refresh polling
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    const interval = auctionStatus === 'running' ? 2000 : 5000;
    
    refreshIntervalRef.current = setInterval(() => {
      refreshAllTabs();
    }, interval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [auctionStatus, refreshAllTabs]);

  // Fetch data when active tab changes
  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  // Also fetch totalPlayers on initial load to ensure all players are available
  useEffect(() => {
    if (tournamentCode) {
      fetchTotalList();
    }
  }, [tournamentCode, fetchTotalList]);

  // Timer countdown
  useEffect(() => {
    let interval;
    // Only run timer if timer is enabled in settings
    const timerEnabled = tournament?.auctionAdvancedSettings?.timerEnabled !== false;
    if (auctionStatus === 'running' && timer > 0 && timerEnabled) {
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
  }, [auctionStatus, timer, tournament?.auctionAdvancedSettings?.timerEnabled]);

  // Real-time clock
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

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

  const getCurrentBidder = () => {
    if (!currentPlayer || !currentPlayer.bidHistory || currentPlayer.bidHistory.length === 0) return null;
    const lastBid = currentPlayer.bidHistory[currentPlayer.bidHistory.length - 1];
    return teams.find(t => t._id === lastBid.bidder);
  };

  // Calculate player value for MVP sorting
  const getPlayerValue = (player) => {
    if (player.auctionStatus === 'Sold' && player.soldPrice) return player.soldPrice;
    if (player.auctionStatus === 'Pending' && player.currentBid) return player.currentBid;
    if (player.currentBid && player.currentBid > 0) return player.currentBid;
    return player.basePrice || 0;
  };

  const getTeamBudgets = () => {
    return teams.map(team => {
      // Use backend-computed values for accuracy
      const totalSpent = team.totalSpent || team.budgetUsed || 0;
      const playersBought = team.playersBought || 0;
      const budget = team.budget || 100000;
      const remaining = team.budgetBalance || team.currentBalance || Math.max(0, budget - totalSpent);
      const maxBid = team.maxBid || team.maxPossibleBid || 0;
      // Calculate players need: Priority: team.maxPlayers (from backend) > tournament.maxPlayers > 16
      const maxPlayersForTeam = team?.maxPlayers ?? tournament?.maxPlayers ?? 16;
      const playersNeed = Math.max(maxPlayersForTeam - playersBought, 0);
      
      return {
        ...team,
        spent: totalSpent,
        remaining: remaining,
        maxBid: Math.max(0, maxBid),
        playersBought: playersBought,
        playersNeed: playersNeed
      };
    }).sort((a, b) => b.remaining - a.remaining);
  };

  const handleViewDetails = async (teamId) => {
    setSelectedTeam(teamId);
    setShowTeamDetails(true);
    setLoadingTeamDetails(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auctions/live-team-details/${tournamentCode}/${teamId}`);
      setTeamDetailsData(response.data.team);
      setTeamPlayers(response.data.players || []);
    } catch (error) {
      console.error('Error fetching team details:', error);
      // Fallback to team data from teams list
      const team = teams.find(t => t._id === teamId);
      if (team) {
        setTeamDetailsData(team);
        // Get players from history
        const teamPlayersFromHistory = history.filter(p => 
          p.auctionStatus === 'Sold' && p.soldToName === team.name
        );
        setTeamPlayers(teamPlayersFromHistory);
      }
    } finally {
      setLoadingTeamDetails(false);
    }
  };

  const handleCloseDetails = () => {
    setShowTeamDetails(false);
    setSelectedTeam(null);
    setTeamDetailsData(null);
    setTeamPlayers([]);
  };

  const handlePrintTeam = async (teamId, e) => {
    // Prevent the card click event from firing
    if (e) {
      e.stopPropagation();
    }

    try {
      // Always fetch fresh team details for printing
      let teamData;
      let players;
      
      try {
        const response = await axios.get(`${API_BASE_URL}/api/auctions/live-team-details/${tournamentCode}/${teamId}`);
        teamData = response.data.team;
        players = response.data.players || [];
      } catch (error) {
        console.error('Error fetching team details for print:', error);
        // Fallback to team data from teams list
        const team = teams.find(t => t._id === teamId);
        if (team) {
          teamData = team;
          // Get players from history
          players = history.filter(p => 
            p.auctionStatus === 'Sold' && p.soldToName === team.name
          );
        } else {
          alert('Unable to load team details for printing. Please try again.');
          return;
        }
      }

      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to print team details');
        return;
      }

      // Build HTML content for printing
      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${teamData.name} - Team Details</title>
            <style>
              @media print {
                @page {
                  margin: 5mm;
                  size: landscape;
                }
                body {
                  margin: 0;
                  padding: 5px;
                  font-family: Arial, sans-serif;
                }
                .print-header {
                  margin-bottom: 5px;
                  padding-bottom: 3px;
                  border-bottom: none;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 8px;
                  flex-wrap: nowrap;
                }
                .print-header h1 {
                  font-size: 12px;
                  margin: 0;
                  line-height: 1.2;
                  white-space: nowrap;
                }
                .print-header .tournament-info {
                  font-size: 8px;
                  color: #666;
                  margin: 0;
                  line-height: 1.3;
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  flex-wrap: nowrap;
                }
                .print-header .tournament-info div {
                  white-space: nowrap;
                }
                .print-logo {
                  max-width: 30px;
                  max-height: 30px;
                  margin: 0;
                  flex-shrink: 0;
                }
                .players-section {
                  margin-top: 5px;
                }
                .players-section h2 {
                  font-size: 12px;
                  padding-bottom: 3px;
                  margin-bottom: 5px;
                  border-bottom: none;
                }
                .players-grid {
                  grid-template-columns: repeat(6, 1fr);
                  gap: 3px;
                  margin-top: 5px;
                }
                .player-card {
                  padding: 4px 3px;
                  border-radius: 3px;
                  min-height: 130px;
                  border-width: 1.5px;
                }
                .player-card-photo,
                .player-card-photo-placeholder {
                  width: 65px;
                  height: 65px;
                  margin: 0 auto 3px;
                  border-radius: 3px;
                  border-width: 1.5px;
                }
                .player-card-photo-placeholder {
                  font-size: 28px;
                }
                .player-card-id {
                  font-size: 8px;
                  margin-bottom: 1px;
                }
                .player-card-name {
                  font-size: 10px;
                  margin-bottom: 2px;
                  line-height: 1.1;
                }
                .player-card-role {
                  padding: 1px 5px;
                  font-size: 7px;
                  margin-bottom: 2px;
                }
                .player-card-city {
                  font-size: 8px;
                  margin-bottom: 2px;
                  line-height: 1.2;
                }
                .player-card-price {
                  font-size: 11px;
                  margin-top: 1px;
                }
                .print-footer {
                  display: none;
                }
              }
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                color: #333;
              }
              .print-header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: none;
                padding-bottom: 20px;
              }
              .print-header h1 {
                margin: 0;
                font-size: 28px;
                color: #333;
              }
              .print-header .tournament-info {
                font-size: 12px;
                color: #666;
                margin-top: 8px;
                line-height: 1.6;
              }
              .print-logo {
                max-width: 100px;
                max-height: 100px;
                margin-bottom: 10px;
              }
              .players-section {
                margin-top: 30px;
              }
              .players-section h2 {
                border-bottom: none;
                padding-bottom: 10px;
                margin-bottom: 20px;
              }
              .players-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 8px;
                margin-top: 20px;
                align-items: start;
              }
              .player-card {
                border: 2px solid #333;
                border-radius: 6px;
                padding: 12px 10px;
                text-align: center;
                page-break-inside: avoid;
                background: #fff;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: space-between;
                min-height: 180px;
                box-sizing: border-box;
              }
              .player-card-photo {
                width: 100px;
                height: 100px;
                object-fit: cover;
                border-radius: 4px;
                margin: 0 auto 8px;
                display: block;
                border: 2px solid #333;
                flex-shrink: 0;
              }
              .player-card-photo-placeholder {
                width: 100px;
                height: 100px;
                background: #f0f0f0;
                border: 2px solid #333;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 40px;
                margin: 0 auto 8px;
                flex-shrink: 0;
              }
              .player-card-id {
                font-size: 11px;
                font-weight: 600;
                color: #666;
                margin-bottom: 4px;
                letter-spacing: 0.5px;
              }
              .player-card-name {
                font-size: 14px;
                font-weight: 700;
                color: #1a1a1a;
                margin-bottom: 6px;
                line-height: 1.2;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .player-card-role {
                display: inline-block;
                background: #333;
                color: white;
                padding: 3px 10px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: 600;
                margin-bottom: 6px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
              }
              .player-card-city {
                font-size: 11px;
                color: #666;
                margin-bottom: 6px;
                line-height: 1.3;
              }
              .player-card-price {
                font-size: 16px;
                font-weight: 700;
                color: #dc2626;
                margin-top: auto;
                padding-top: 4px;
              }
              .no-players {
                text-align: center;
                padding: 40px;
                color: #666;
                font-style: italic;
              }
              .print-footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 2px solid #333;
                text-align: center;
                color: #666;
                font-size: 12px;
              }
            </style>
          </head>
          <body>
            <div class="print-header">
              ${teamData.logo ? `<img src="${getTeamLogoUrl(teamData.logo)}" alt="${teamData.name}" class="print-logo" onerror="this.style.display='none'">` : ''}
              <h1>${teamData.name} PLAYERS</h1>
              <div class="tournament-info">
                ${tournament?.name ? `<span><strong>Tournament:</strong> ${tournament.name}</span>` : ''}
                ${tournament?.location || tournament?.venue || tournament?.city ? `<span><strong>Location:</strong> ${tournament.location || tournament.venue || tournament.city}</span>` : ''}
              </div>
            </div>

            <div class="players-section">
              ${players.length > 0 ? `
                <div class="players-grid">
                  ${players.map((player) => {
                    const getPlayerIdOnly = (playerId) => {
                      if (!playerId) return 'N/A';
                      if (playerId.includes('-')) {
                        return playerId.split('-').pop();
                      }
                      return playerId.replace(/^[A-Z0-9]+-?/, '').replace(/^[A-Z]+/, '') || playerId.slice(-4);
                    };
                    const photoUrl = getPlayerPhotoUrl(player.photo);
                    return `
                      <div class="player-card">
                        ${photoUrl ? `<img src="${photoUrl}" alt="${player.name}" class="player-card-photo" onerror="this.style.display='none'">` : '<div class="player-card-photo-placeholder">👤</div>'}
                        <div class="player-card-id">#${getPlayerIdOnly(player.playerId)}</div>
                        <div class="player-card-name">${(player.name || 'N/A').toUpperCase()}</div>
                        ${player.role ? `<div class="player-card-role">${player.role.toUpperCase()}</div>` : ''}
                        ${player.city ? `<div class="player-card-city">📍 ${player.city}</div>` : ''}
                        <div class="player-card-price">₹${(player.soldPrice || 0).toLocaleString()}</div>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : `
                <div class="no-players">No players bought yet</div>
              `}
            </div>

            <div class="print-footer">
              <p>Generated from PlayLive Auction System</p>
              <p>${new Date().toLocaleString()}</p>
            </div>
          </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Wait for images to load, then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          // Optionally close the window after printing
          // printWindow.close();
        }, 500);
      };
    } catch (error) {
      console.error('Error printing team details:', error);
      alert('Failed to print team details. Please try again.');
    }
  };

  const getImageUrl = (imagePath, defaultImage = null) => {
    const fallback = defaultImage || `${API_BASE_URL}/default-photo.png`;
    if (!imagePath) {
      return fallback;
    }
    if (typeof imagePath !== 'string') {
      return fallback;
    }
    const trimmed = imagePath.trim();
    if (!trimmed) {
      return fallback;
    }
    if (trimmed.startsWith('data:')) {
      return trimmed;
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    const normalized = trimmed.replace(/\\/g, '/');
    if (normalized.startsWith('/')) {
      return `${API_BASE_URL}${normalized}`;
    }
    if (normalized.startsWith('uploads/')) {
      return `${API_BASE_URL}/${normalized}`;
    }
    if (normalized.startsWith('assets/')) {
      return `/${normalized}`;
    }
    if (normalized.startsWith('public/')) {
      return `/${normalized.replace(/^public\//, '')}`;
    }
    return `${API_BASE_URL}/${normalized.replace(/^\/+/, '')}`;
  };

  const getPlayerPhotoUrl = (photo) => {
    return getImageUrl(photo, `${API_BASE_URL}/default-photo.png`);
  };

  const getTeamLogoUrl = (logo) => {
    return getImageUrl(logo, `${API_BASE_URL}/default-logo.png`);
  };

  const totalSpent = useMemo(() => {
    return history
      .filter(p => p.auctionStatus === 'Sold' && p.soldPrice)
      .reduce((sum, p) => sum + p.soldPrice, 0);
  }, [history]);
  const averageBid = useMemo(() => {
    const soldPlayers = history.filter(p => p.auctionStatus === 'Sold' && p.soldPrice);
    if (soldPlayers.length === 0) return 0;
    const total = soldPlayers.reduce((sum, p) => sum + p.soldPrice, 0);
    return Math.round(total / soldPlayers.length);
  }, [history]);

  const designVariant = useMemo(() => {
    if (normalizedTournamentCode === 'ULL2025') {
      const tournamentName = tournament?.name || 'Ultra Legends League 2025';
      return {
        key: 'ull2025',
        wrapperClass: 'theme-ull2025',
        hero: {
          strapline: tournament?.seasonLabel || 'Season 2025 • Ultra Legends League',
          headline: `${tournamentName} Live Auction`,
          subheading:
            tournament?.tagline ||
            'The biggest bidding night of the season. Witness franchises lock in the legends.',
          badge:
            tournament?.venue ||
            tournament?.city ||
            (tournament?.sport ? `${tournament.sport} Auction` : 'Premier Auction Night')
        }
      };
    }
    return null;
  }, [normalizedTournamentCode, tournament]);

  const heroVenue = useMemo(() => {
    return tournament?.venue || tournament?.city || tournament?.state || tournament?.country || 'India';
  }, [tournament]);

  const heroStats = useMemo(() => {
    const totalPlayers = summary?.totalPlayers || 0;
    const soldPlayers = summary?.auctioned || 0;
    const playersRemaining =
      summary?.remaining ?? (totalPlayers ? Math.max(totalPlayers - soldPlayers, 0) : 0);
    const completion = totalPlayers ? Math.round((soldPlayers / totalPlayers) * 100) : null;

    return [
      {
        label: 'Teams',
        value: teams && teams.length ? teams.length : '—',
        helper: teams && teams.length ? `${teams.length === 1 ? 'Franchise' : 'Franchises'} engaged` : 'Awaiting activation'
      },
      {
        label: 'Players Sold',
        value: soldPlayers,
        helper: completion !== null ? `${completion}% of roster set` : null
      },
      {
        label: 'Purse Spent',
        value: `₹${(totalSpent || 0).toLocaleString('en-IN')}`,
        helper: null
      },
      {
        label: 'Players Remaining',
        value: playersRemaining,
        helper: null
      }
    ];
  }, [teams, summary, totalSpent, averageBid]);

  const topBidder = useMemo(() => {
    const bidders = summary?.topBidders;
    if (Array.isArray(bidders) && bidders.length > 0) {
      return bidders[0];
    }
    return null;
  }, [summary]);

  const heroHighlights = useMemo(() => {
    const highlights = [];

    if (summary?.mostExpensivePlayer) {
      const pricey = summary.mostExpensivePlayer;
      highlights.push({
        icon: '🏅',
        label: 'Top Sale',
        title: pricey.name || 'Player',
        meta: `₹${Number(pricey.soldPrice || 0).toLocaleString('en-IN')} • ${pricey.soldToName || '—'}`
      });
    }

    if (topBidder) {
      const spend =
        Number(
          topBidder.totalSpend ??
          topBidder.totalBidAmount ??
          topBidder.totalAmount ??
          topBidder.amount ??
          topBidder.value ??
          0
        );
      highlights.push({
        icon: '🔥',
        label: 'Leading Purse',
        title: topBidder.teamName || topBidder.name || 'Top Bidder',
        meta: `₹${spend.toLocaleString('en-IN')} committed`
      });
    }

    if (summary?.lastSoldPlayer) {
      const last = summary.lastSoldPlayer;
      highlights.push({
        icon: '⏱️',
        label: 'Last Sold',
        title: last.name || 'Player',
        meta: `${last.soldToName || '—'} • ₹${Number(last.soldPrice || 0).toLocaleString('en-IN')}`
      });
    }

    if (highlights.length === 0 && summary?.nextPlayerUp?.name) {
      highlights.push({
        icon: '🎯',
        label: 'On Deck',
        title: summary.nextPlayerUp.name,
        meta: summary.nextPlayerUp.role || ''
      });
    }

    return highlights;
  }, [summary, topBidder]);

  const heroStatusLabel = useMemo(() => {
    switch (auctionStatus) {
      case 'running':
        return 'Live Now';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      case 'locked':
        return 'Locked';
      case 'stopped':
        return 'Standby';
      default:
        return 'Awaiting Start';
    }
  }, [auctionStatus]);

  const formattedLastUpdate = useMemo(() => {
    if (!lastUpdate) return null;
    try {
      return lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch (err) {
      return lastUpdate.toLocaleTimeString();
    }
  }, [lastUpdate]);

  const pageClassName = useMemo(() => {
    return [
      'live-auction-page',
      isFullscreen ? 'fullscreen' : '',
      designVariant?.wrapperClass || ''
    ].filter(Boolean).join(' ');
  }, [isFullscreen, designVariant]);

  const showNotification = (data) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setNotification(data);
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const closeNotification = () => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setNotification(null);
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const sharePage = async () => {
    const pageUrl = window.location.href;
    const tournamentName = tournament?.name || 'Live Auction';
    const currentTournamentCode = tournament?.code || tournamentCode || '';
    const statusText = auctionStatus === 'running' ? '🔴 LIVE' : auctionStatus === 'paused' ? '⏸️ Paused' : '⏹️ Stopped';
    
    // Create WhatsApp share message
    const shareMessage = `🏏 *${tournamentName}* - Live Auction\n\n` +
      `${statusText} Watch the live player auction in real-time!\n\n` +
      `📊 Tournament: ${tournamentName}\n` +
      `🆔 Code: ${currentTournamentCode}\n\n` +
      `🔗 Join the auction: ${pageUrl}\n\n` +
      `📱 Powered by PlayLive - Your Premier Cricket Auction Platform\n` +
      `#CricketAuction #PlayLive #LiveAuction`;

    // Encode the message for WhatsApp URL
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    
    // Try WhatsApp share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${tournamentName} - Live Auction`,
          text: shareMessage,
          url: pageUrl
        });
        return;
      } catch (error) {
        // User cancelled or share failed - try WhatsApp URL
        if (error.name === 'AbortError') {
          return; // User cancelled, don't do anything
        }
      }
    }
    
    // Fallback: Open WhatsApp Web/App with pre-filled message
    try {
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('WhatsApp share failed:', error);
      // Final fallback: Copy to clipboard
      const success = await copyToClipboard(pageUrl);
      if (success) {
        setNotification({ type: 'success', message: 'Link copied to clipboard! You can paste it in WhatsApp.' });
      } else {
        setNotification({ type: 'error', message: 'Failed to share. Please copy the link manually.' });
      }
    }
  };

  // eslint-disable-next-line no-unused-vars
  function getTotalSpent() {
    return history
      .filter(p => p.auctionStatus === 'Sold' && p.soldPrice)
      .reduce((sum, p) => sum + p.soldPrice, 0);
  }

  const completionData = useMemo(() => {
    if (completionSummary) {
      return {
        tournamentName: completionSummary.tournamentName || tournament?.name || '',
        tournamentCode: completionSummary.tournamentCode || tournament?.code || tournamentCode,
        totalTeams: completionSummary.totalTeams ?? teams.length,
        playersSold: completionSummary.playersSold ?? 0,
        unsoldPlayers: completionSummary.unsoldPlayers ?? 0,
        withdrawnPlayers: completionSummary.withdrawnPlayers ?? 0,
        pendingConvertedToUnsold: completionSummary.pendingConvertedToUnsold ?? 0,
        totalPlayers: completionSummary.totalPlayers ?? summary.totalPlayers
      };
    }
    return {
      tournamentName: tournament?.name || '',
      tournamentCode: tournament?.code || tournamentCode,
      totalTeams: teams.length,
      playersSold: summary.auctioned || 0,
      unsoldPlayers: summary.remaining || 0,
      withdrawnPlayers: 0,
      pendingConvertedToUnsold: 0,
      totalPlayers: summary.totalPlayers || 0
    };
  }, [completionSummary, summary, teams, tournament, tournamentCode]);

  const completedTimeLabel = useMemo(() => {
    if (!auctionEndedAt) return null;
    const date = new Date(auctionEndedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }, [auctionEndedAt]);

  // Confetti animation on completion
  const triggerConfetti = useCallback(() => {
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'confetti-container';
    confettiContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `;
    document.body.appendChild(confettiContainer);

    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe', '#ffd700', '#00ff88'];
    
    for (let i = 0; i < 200; i++) {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: absolute;
        left: ${Math.random() * 100}%;
        top: -10px;
        width: ${Math.random() * 10 + 5}px;
        height: ${Math.random() * 10 + 5}px;
        background-color: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        animation: confetti-fall ${Math.random() * 3 + 2}s linear forwards;
        animation-delay: ${Math.random() * 0.5}s;
      `;
      confettiContainer.appendChild(confetti);
    }

    // Add CSS animation if not already present
    if (!document.getElementById('confetti-styles')) {
      const style = document.createElement('style');
      style.id = 'confetti-styles';
      style.textContent = `
        @keyframes confetti-fall {
          to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => {
      confettiContainer.remove();
    }, 5000);
  }, []);

  useEffect(() => {
    if (auctionStatus === 'completed' && completionSummary) {
      triggerConfetti();
    }
  }, [auctionStatus, completionSummary, triggerConfetti]);

  // Fetch data when completion tab is clicked
  useEffect(() => {
    if (auctionStatus === 'completed') {
      if (completionActiveTab === 'players' && completionPlayers.length === 0 && !loadingCompletionPlayers) {
        fetchCompletionPlayers();
      }
      if (completionActiveTab === 'teams' && completionTeams.length === 0 && !loadingCompletionTeams) {
        fetchCompletionTeams();
      }
    }
  }, [auctionStatus, completionActiveTab, completionPlayers.length, completionTeams.length, loadingCompletionPlayers, loadingCompletionTeams, fetchCompletionPlayers, fetchCompletionTeams]);

  // Sort completion players by player ID
  const sortedCompletionPlayers = useMemo(() => {
    if (!completionPlayers || completionPlayers.length === 0) return [];
    
    const getPlayerIdNumber = (playerId) => {
      if (!playerId) return 0;
      const str = String(playerId);
      // Extract numeric part after last dash (e.g., "PLTC003-1" -> 1)
      if (str.includes('-')) {
        const parts = str.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        return isNaN(num) ? 0 : num;
      }
      // Try to extract numeric part from the end
      const match = str.match(/\d+$/);
      if (match) {
        return parseInt(match[0], 10);
      }
      // If no numeric part found, use 0
      return 0;
    };

    return [...completionPlayers].sort((a, b) => {
      const aNum = getPlayerIdNumber(a.playerId);
      const bNum = getPlayerIdNumber(b.playerId);
      return aNum - bNum;
    });
  }, [completionPlayers]);

  if (auctionStatus === 'completed') {
    const showTabs = completedTimeLabel; // Show tabs if auction closed time is public

    const formatCurrency = (amount) => {
      if (!amount && amount !== 0) return '₹0';
      return `₹${Number(amount).toLocaleString('en-IN')}`;
    };

    const getPlayerIdOnly = (playerId) => {
      if (!playerId) return 'N/A';
      if (playerId.includes('-')) {
        return playerId.split('-').pop();
      }
      // Remove tournament code prefix (e.g., PLTC001-001 -> 001)
      return playerId.replace(/^[A-Z0-9]+-?/, '').replace(/^[A-Z]+/, '') || playerId.slice(-4);
    };

    return (
      <div className="live-complete-wrapper">
        <div className="live-complete-card">
          <div className="live-complete-heading">
            <span role="img" aria-label="finish flag">🏁</span>
            <h1>AUCTION CLOSED</h1>
            <span role="img" aria-label="finish flag">🏁</span>
          </div>
          <p className="live-complete-subtitle">🎉 Thank you for joining the PlayLive Auction!</p>
          
          {showTabs && (
            <div className="live-complete-tabs" style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '10px',
              borderBottom: '2px solid #e0e0e0',
              paddingBottom: '8px'
            }}>
              <button
                onClick={() => setCompletionActiveTab('summary')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: completionActiveTab === 'summary' ? '#4CAF50' : '#f0f0f0',
                  color: completionActiveTab === 'summary' ? 'white' : '#333',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  fontWeight: completionActiveTab === 'summary' ? 'bold' : 'normal',
                  transition: 'all 0.3s',
                  fontSize: '14px'
                }}
              >
                📊 Summary
              </button>
              <button
                onClick={() => setCompletionActiveTab('players')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: completionActiveTab === 'players' ? '#4CAF50' : '#f0f0f0',
                  color: completionActiveTab === 'players' ? 'white' : '#333',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  fontWeight: completionActiveTab === 'players' ? 'bold' : 'normal',
                  transition: 'all 0.3s',
                  fontSize: '14px'
                }}
              >
                👥 Players
              </button>
              <button
                onClick={() => setCompletionActiveTab('teams')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: completionActiveTab === 'teams' ? '#4CAF50' : '#f0f0f0',
                  color: completionActiveTab === 'teams' ? 'white' : '#333',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  fontWeight: completionActiveTab === 'teams' ? 'bold' : 'normal',
                  transition: 'all 0.3s',
                  fontSize: '14px'
                }}
              >
                🏆 Teams
              </button>
            </div>
          )}

          {completionActiveTab === 'summary' && (
            <>
              <div className="live-complete-summary">
                <div className="live-complete-item wide">
                  <span className="label">Tournament</span>
                  <span className="value">{completionData.tournamentName}</span>
                  <span className="hint">#{completionData.tournamentCode}</span>
                </div>
                <div className="live-complete-item">
                  <span className="label">Total Teams</span>
                  <span className="value">{completionData.totalTeams}</span>
                </div>
                <div className="live-complete-item">
                  <span className="label">Players Sold</span>
                  <span className="value accent-green">{completionData.playersSold}</span>
                </div>
                <div className="live-complete-item">
                  <span className="label">Unsold Players</span>
                  <span className="value accent-red">{completionData.unsoldPlayers}</span>
                </div>
                <div className="live-complete-item">
                  <span className="label">Withdrawn</span>
                  <span className="value">{completionData.withdrawnPlayers}</span>
                </div>
                <div className="live-complete-item">
                  <span className="label">Pending → Unsold</span>
                  <span className="value accent-amber">{completionData.pendingConvertedToUnsold}</span>
                </div>
              </div>
              {completedTimeLabel && (
                <div className="live-complete-meta">
                  Completed on <strong>{completedTimeLabel}</strong>
                </div>
              )}
            </>
          )}

          {completionActiveTab === 'players' && (
            <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', marginTop: '10px' }}>
              {loadingCompletionPlayers ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ fontSize: '18px', color: '#666' }}>Loading players...</div>
                </div>
              ) : completionPlayers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  No players found
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '10px',
                  padding: '5px'
                }}>
                  {sortedCompletionPlayers.map((player) => (
                    <div
                      key={player._id || player.playerId}
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        padding: '10px',
                        background: '#fff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      {player.photo && (
                        <img
                          src={`${API_BASE_URL}/${player.photo}`}
                          alt={player.name}
                          onClick={() => setSelectedCompletionPlayerImage({
                            photo: `${API_BASE_URL}/${player.photo}`,
                            name: player.name,
                            player: player
                          })}
                          style={{
                            width: '100%',
                            height: '140px',
                            objectFit: 'cover',
                            borderRadius: '5px',
                            marginBottom: '8px',
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      <div style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        color: '#666',
                        marginBottom: '4px',
                        textAlign: 'center',
                        padding: '2px 6px',
                        background: '#f0f0f0',
                        borderRadius: '3px',
                        display: 'inline-block',
                        width: '100%'
                      }}>
                        ID: #{getPlayerIdOnly(player.playerId)}
                      </div>
                      <div style={{ fontWeight: 'bold', marginBottom: '3px', fontSize: '14px' }}>{player.name}</div>
                      {player.role && (
                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>
                          {player.role}
                        </div>
                      )}
                      {player.city && (
                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>
                          {player.city}
                        </div>
                      )}
                      {player.auctionStatus === 'Sold' && player.soldPrice && (
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#4CAF50', marginTop: '3px' }}>
                          {formatCurrency(player.soldPrice)}
                        </div>
                      )}
                      {player.auctionStatus === 'Sold' && player.soldToName && (
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>
                          → {player.soldToName}
                        </div>
                      )}
                      <div style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        display: 'inline-block',
                        marginTop: '3px',
                        background: player.auctionStatus === 'Sold' ? '#d4edda' : 
                                   player.auctionStatus === 'Unsold' ? '#f8d7da' : '#fff3cd',
                        color: player.auctionStatus === 'Sold' ? '#155724' : 
                               player.auctionStatus === 'Unsold' ? '#721c24' : '#856404'
                      }}>
                        {player.auctionStatus || 'Available'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {completionActiveTab === 'teams' && (
            <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', marginTop: '10px' }}>
              {loadingCompletionTeams ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ fontSize: '18px', color: '#666' }}>Loading teams...</div>
                </div>
              ) : completionTeams.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  No teams found
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '12px',
                  padding: '5px'
                }}>
                  {completionTeams.map((team) => (
                    <div
                      key={team._id}
                      onClick={() => handleCompletionTeamClick(team._id)}
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        padding: '12px',
                        background: '#fff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-5px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                      }}
                    >
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '8px',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#f0f0f0',
                        margin: '0 auto 10px',
                        border: '2px solid #e0e0e0',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                        {team.logo ? (
                          <img
                            src={getTeamLogoUrl(team.logo)}
                            alt={team.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block'
                            }}
                            onError={(e) => {
                              console.error('Failed to load team logo:', team.logo, 'URL:', getTeamLogoUrl(team.logo));
                              const parent = e.target.parentElement;
                              if (parent) {
                                parent.innerHTML = '<span style="font-size: 32px;">🏆</span>';
                              }
                            }}
                            onLoad={() => {
                              console.log('Team logo loaded successfully:', team.name, team.logo);
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: '32px' }}>🏆</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px', textAlign: 'center' }}>
                        {team.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', textAlign: 'center' }}>
                        Players: {team.playersBought || 0}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', textAlign: 'center' }}>
                        Spent: {formatCurrency(team.totalSpent || 0)}
                      </div>
                      {team.budget && (
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', textAlign: 'center' }}>
                          Budget: {formatCurrency(team.budget)}
                        </div>
                      )}
                      {team.currentBalance !== undefined && (
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: team.currentBalance >= 0 ? '#4CAF50' : '#f44336',
                          marginTop: '6px',
                          textAlign: 'center'
                        }}>
                          Balance: {formatCurrency(team.currentBalance)}
                        </div>
                      )}
                      <div style={{
                        marginTop: '8px',
                        padding: '6px',
                        background: '#f5f5f5',
                        borderRadius: '5px',
                        fontSize: '11px',
                        color: '#666',
                        textAlign: 'center'
                      }}>
                        Click to view details →
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Team Details Modal for Completion View */}
          {selectedCompletionTeam && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}
              onClick={handleCloseCompletionTeamDetails}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  maxWidth: '900px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  position: 'relative',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {loadingCompletionTeamDetails ? (
                  <div style={{ padding: '60px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', color: '#666' }}>Loading team details...</div>
                  </div>
                ) : completionTeamDetails ? (
                  <>
                    <div style={{
                      padding: '30px',
                      borderBottom: '2px solid #e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      position: 'sticky',
                      top: 0,
                      background: '#fff',
                      zIndex: 1
                    }}>
                      <button
                        onClick={handleCloseCompletionTeamDetails}
                        style={{
                          position: 'absolute',
                          top: '20px',
                          right: '20px',
                          background: '#f0f0f0',
                          border: 'none',
                          borderRadius: '50%',
                          width: '40px',
                          height: '40px',
                          cursor: 'pointer',
                          fontSize: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#666'
                        }}
                      >
                        ×
                      </button>
                      {completionTeamDetails.logo ? (
                        <img
                          src={getTeamLogoUrl(completionTeamDetails.logo)}
                          alt={completionTeamDetails.name}
                          style={{
                            width: '100px',
                            height: '100px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '2px solid #e0e0e0'
                          }}
                          onError={(e) => {
                            e.target.src = `${API_BASE_URL}/default-logo.png`;
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100px',
                          height: '100px',
                          borderRadius: '8px',
                          background: '#f0f0f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '40px',
                          border: '2px solid #e0e0e0'
                        }}>
                          🏆
                        </div>
                      )}
                      <div>
                        <h2 style={{ margin: 0, fontSize: '28px', color: '#333' }}>
                          {completionTeamDetails.name}
                        </h2>
                        <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
                          Team Summary
                        </p>
                      </div>
                    </div>

                    <div style={{ padding: '30px' }}>
                      {/* Team Statistics */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '20px',
                        marginBottom: '30px'
                      }}>
                        <div style={{
                          padding: '20px',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0'
                        }}>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Total Budget</div>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
                            {formatCurrency(completionTeamDetails.budget || 0)}
                          </div>
                        </div>
                        <div style={{
                          padding: '20px',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0'
                        }}>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Total Spent</div>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f44336' }}>
                            {formatCurrency(completionTeamDetails.totalSpent || completionTeamDetails.budgetUsed || 0)}
                          </div>
                        </div>
                        <div style={{
                          padding: '20px',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0'
                        }}>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Balance</div>
                          <div style={{
                            fontSize: '24px',
                            fontWeight: 'bold',
                            color: (completionTeamDetails.budgetBalance || completionTeamDetails.currentBalance || 0) >= 0 ? '#4CAF50' : '#f44336'
                          }}>
                            {formatCurrency(completionTeamDetails.budgetBalance || completionTeamDetails.currentBalance || 0)}
                          </div>
                        </div>
                        <div style={{
                          padding: '20px',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0'
                        }}>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Players Bought</div>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
                            {completionTeamDetails.playersBought || completionTeamPlayers.length || 0}
                          </div>
                        </div>
                        {completionTeamDetails.highestBid && (
                          <div style={{
                            padding: '20px',
                            background: '#f8f9fa',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0'
                          }}>
                            <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Highest Bid</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff9800' }}>
                              {formatCurrency(completionTeamDetails.highestBid)}
                            </div>
                          </div>
                        )}
                        {completionTeamDetails.avgPrice && (
                          <div style={{
                            padding: '20px',
                            background: '#f8f9fa',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0'
                          }}>
                            <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Average Price</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
                              {formatCurrency(completionTeamDetails.avgPrice)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Players List */}
                      {completionTeamPlayers.length > 0 && (
                        <div>
                          <h3 style={{ marginBottom: '20px', fontSize: '20px', color: '#333' }}>
                            Players ({completionTeamPlayers.length})
                          </h3>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: '15px'
                          }}>
                            {completionTeamPlayers.map((player) => (
                              <div
                                key={player._id || player.playerId}
                                style={{
                                  border: '1px solid #ddd',
                                  borderRadius: '8px',
                                  padding: '15px',
                                  background: '#fff',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                              >
                                {player.photo && (
                                  <img
                                    src={`${API_BASE_URL}/${player.photo}`}
                                    alt={player.name}
                                    onClick={() => setSelectedCompletionPlayerImage({
                                      photo: `${API_BASE_URL}/${player.photo}`,
                                      name: player.name,
                                      player: player
                                    })}
                                    style={{
                                      width: '100%',
                                      height: '120px',
                                      objectFit: 'cover',
                                      borderRadius: '5px',
                                      marginBottom: '10px',
                                      cursor: 'pointer',
                                      transition: 'transform 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.transform = 'scale(1.05)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.transform = 'scale(1)';
                                    }}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                )}
                                <div style={{
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  color: '#666',
                                  marginBottom: '6px',
                                  textAlign: 'center',
                                  padding: '2px 6px',
                                  background: '#f0f0f0',
                                  borderRadius: '3px',
                                  display: 'inline-block',
                                  width: '100%'
                                }}>
                                  ID: #{getPlayerIdOnly(player.playerId)}
                                </div>
                                <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '14px' }}>
                                  {player.name}
                                </div>
                                {player.role && (
                                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                                    {player.role}
                                  </div>
                                )}
                                {player.soldPrice && (
                                  <div style={{
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    color: '#4CAF50',
                                    marginTop: '5px'
                                  }}>
                                    {formatCurrency(player.soldPrice)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '60px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', color: '#666' }}>Unable to load team details</div>
                    <button
                      onClick={handleCloseCompletionTeamDetails}
                      style={{
                        marginTop: '20px',
                        padding: '10px 20px',
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="live-complete-note">
            📄 Final results & highlights will be published shortly on PlayLive.com
          </div>
          <footer className="live-complete-footer">💙 Powered by PlayLive.com</footer>
        </div>

        {/* Player Image Modal for Completion View */}
        {selectedCompletionPlayerImage && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              zIndex: 10001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              cursor: 'pointer'
            }}
            onClick={() => setSelectedCompletionPlayerImage(null)}
          >
            <div
              style={{
                position: 'relative',
                maxWidth: '90vw',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedCompletionPlayerImage(null)}
                style={{
                  position: 'absolute',
                  top: '-50px',
                  right: '0',
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  cursor: 'pointer',
                  fontSize: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#333',
                  fontWeight: 'bold',
                  zIndex: 1,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                ×
              </button>
              <img
                src={selectedCompletionPlayerImage.photo}
                alt={selectedCompletionPlayerImage.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '85vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                }}
                onError={(e) => {
                  e.target.src = `${API_BASE_URL}/default-logo.png`;
                }}
              />
              {selectedCompletionPlayerImage.name && (
                <div style={{
                  marginTop: '20px',
                  color: '#fff',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                }}>
                  {selectedCompletionPlayerImage.name}
                </div>
              )}
              {selectedCompletionPlayerImage.player?.role && (
                <div style={{
                  marginTop: '10px',
                  color: '#fff',
                  fontSize: '18px',
                  textAlign: 'center',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                }}>
                  {selectedCompletionPlayerImage.player.role}
                </div>
              )}
              {selectedCompletionPlayerImage.player?.soldPrice && (
                <div style={{
                  marginTop: '10px',
                  color: '#4CAF50',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                }}>
                  {formatCurrency(selectedCompletionPlayerImage.player.soldPrice)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Check if auction is disabled
  const isAuctionDisabled = tournament?.auctionEnabled === false;

  return (
    <div className={pageClassName}>
      {isAuctionDisabled && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '60px 40px',
            maxWidth: '600px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ fontSize: '80px', marginBottom: '24px' }}>🔒</div>
            <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '32px', fontWeight: 'bold', color: '#212529' }}>
              Auction Not Started
            </h2>
            <p style={{ marginBottom: '32px', color: '#6c757d', lineHeight: '1.8', fontSize: '18px' }}>
              Auction features are disabled by the admin.
              <br />
              <br />
              The broadcast will resume once auction is enabled.
            </p>
            <div style={{
              padding: '16px',
              backgroundColor: '#f8d7da',
              borderRadius: '8px',
              border: '1px solid #dc3545',
              color: '#721c24',
              fontSize: '14px'
            }}>
              ⚠️ No player info, no bids, no animation available
            </div>
          </div>
        </div>
      )}
      {/* Animated Background */}
      <div className="animated-bg" style={{ opacity: isAuctionDisabled ? 0.2 : 1 }}>
        <div className="bg-gradient"></div>
        <div className="particles">
          {[...Array(30)].map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`
            }}></div>
          ))}
        </div>
      </div>

      {designVariant?.key === 'ull2025' && (
        <section className="ull2025-hero">
          <div className="ull2025-hero__surface">
            <div className="ull2025-hero__lead">
              <div className="ull2025-hero__badge">{designVariant.hero.strapline}</div>
              <h1 className="ull2025-hero__headline">{designVariant.hero.headline}</h1>
              <p className="ull2025-hero__description">
                {designVariant.hero.subheading || `Broadcast live from ${heroVenue}.`}
              </p>
              <div className="ull2025-hero__meta-row">
                <span className={`ull2025-hero__status status-${auctionStatus}`}>
                  {heroStatusLabel}
                </span>
                {formattedLastUpdate && (
                  <span className="ull2025-hero__update">Updated {formattedLastUpdate}</span>
                )}
                {heroVenue && (
                  <span className="ull2025-hero__venue">{heroVenue}</span>
                )}
              </div>
              <div className="ull2025-hero__stats">
                {heroStats.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="ull2025-hero__stat">
                    <span className="ull2025-hero__stat-label">{item.label}</span>
                    <span className="ull2025-hero__stat-value">{item.value}</span>
                    {item.helper && (
                      <span className="ull2025-hero__stat-helper">{item.helper}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="ull2025-hero__poster">
              <div className="ull2025-hero__poster-frame">
                {tournament?.logo ? (
                  <img
                    src={getTeamLogoUrl(tournament.logo)}
                    alt={`${tournament?.name || 'Tournament'} logo`}
                    onError={(e) => {
                      e.target.src = `${API_BASE_URL}/default-logo.png`;
                    }}
                  />
                ) : (
                  <div className="ull2025-hero__poster-placeholder">
                    <span>{normalizedTournamentCode || 'ULL2025'}</span>
                  </div>
                )}
              </div>
              <div className="ull2025-hero__poster-note">
                <span>{designVariant.hero.badge}</span>
                <span>Code • {normalizedTournamentCode || '—'}</span>
              </div>
              {summary?.nextPlayerUp?.name && (
                <div className="ull2025-hero__next-player">
                  <span className="label">Next Up</span>
                  <span className="value">{summary.nextPlayerUp.name}</span>
                  {summary.nextPlayerUp.role && (
                    <span className="helper">{summary.nextPlayerUp.role}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          {heroHighlights.length > 0 && (
            <div className="ull2025-hero__highlights">
              {heroHighlights.map((highlight, index) => (
                <div key={`${highlight.label}-${index}`} className="ull2025-highlight-card">
                  <span className="ull2025-highlight-card__icon">{highlight.icon}</span>
                  <div className="ull2025-highlight-card__content">
                    <span className="ull2025-highlight-card__label">{highlight.label}</span>
                    <span className="ull2025-highlight-card__title">{highlight.title}</span>
                    {highlight.meta && (
                      <span className="ull2025-highlight-card__meta">{highlight.meta}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Top Control Bar with Tabs */}
      <div className="top-control-bar">
        <div className="control-left">
          <div className="tournament-logo-section">
            {tournament?.logo && (
              <img 
                src={getImageUrl(tournament.logo)} 
                alt="Tournament Logo" 
                className="tournament-logo-small"
              />
            )}
            <div className="tournament-info-compact">
              <h1 className="tournament-title-compact">{tournament?.name || 'Live Auction'}</h1>
              <div className="tournament-meta-compact">
                <span>{tournament?.code}</span>
                <span className="meta-separator">•</span>
                <span>{tournament?.sport || 'Cricket'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="control-center">
          {/* Tab Navigation */}
          <div className="live-tab-navigation">
            <button 
              className={`live-tab-btn ${activeTab === 'live' ? 'active' : ''}`}
              onClick={() => setActiveTab('live')}
            >
              <span className="tab-icon">🎯</span>
              <span className="tab-text">Live Auction</span>
            </button>
            <button 
              className={`live-tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
              onClick={() => setActiveTab('teams')}
            >
              <span className="tab-icon">👥</span>
              <span className="tab-text">Teams</span>
            </button>
            <button 
              className={`live-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <span className="tab-icon">👤</span>
              <span className="tab-text">Player</span>
            </button>
          </div>
        </div>
        <div className="control-right">
          <button 
            className="control-btn whatsapp-share-btn"
            onClick={sharePage}
            title="Share on WhatsApp"
          >
            💬
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="live-progress-container">
        <div className="progress-bar-wrapper">
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ 
                width: `${summary.totalPlayers > 0 ? (summary.auctioned / summary.totalPlayers) * 100 : 0}%`,
                animation: 'progressShine 2s ease-in-out infinite'
              }}
            ></div>
          </div>
        </div>
        <div className="progress-info">
          <div className="progress-info-left">
            <span className="progress-percentage">
              {summary.totalPlayers > 0 ? Math.round((summary.auctioned / summary.totalPlayers) * 100) : 0}%
            </span>
            <span className="progress-count">
              {summary.auctioned} / {summary.totalPlayers} Players
            </span>
          </div>
          {/* Player Count - Only show on History Tab */}
          {activeTab === 'history' && (
            <span className="progress-player-count">
              {(() => {
                let count = 0;
                if (historyFilter === 'all') {
                  count = totalPlayers.length > 0 ? totalPlayers.length : (history.length + pendingPlayers.length);
                } else if (historyFilter === 'sold') {
                  count = totalPlayers.filter(p => p.auctionStatus === 'Sold').length;
                } else if (historyFilter === 'pending') {
                  count = [...pendingPlayers, ...totalPlayers].filter(p => p.auctionStatus === 'Pending').length;
                } else if (historyFilter === 'unsold') {
                  count = totalPlayers.filter(p => p.auctionStatus === 'Unsold').length;
                } else if (historyFilter === 'mvp') {
                  // MVP shows only sold players
                  count = totalPlayers.filter(p => p.auctionStatus === 'Sold').length;
                } else if (historyFilter === 'available') {
                  // Available filter: Count players with Available status (excluding current player)
                  const allPlayersSource = totalPlayers.length > 0 ? totalPlayers : [...history, ...pendingPlayers];
                  count = allPlayersSource.filter(p => {
                    const status = p.auctionStatus;
                    const isCurrentPlayer = currentPlayer && (
                      currentPlayer._id === p._id || 
                      (currentPlayer._id && p._id && currentPlayer._id.toString() === p._id.toString())
                    );
                    return status === 'Available' && !isCurrentPlayer;
                  }).length;
                } else if (historyFilter === 'history') {
                  // History filter: Show players from history array
                  count = history.length;
                }
                return `Showing ${count} players`;
              })()}
            </span>
          )}
        </div>
        {/* Filter Buttons - Only show on History Tab */}
        {activeTab === 'history' && (
          <div className="progress-filters">
            <button 
              className={`filter-btn ${historyFilter === 'all' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('all')}
            >
              All
            </button>
            <button 
              className={`filter-btn ${historyFilter === 'sold' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('sold')}
            >
              Sold
            </button>
            <button 
              className={`filter-btn ${historyFilter === 'available' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('available')}
            >
              Available
            </button>
            <button 
              className={`filter-btn ${historyFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('pending')}
            >
              Pending
            </button>
            <button 
              className={`filter-btn ${historyFilter === 'unsold' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('unsold')}
            >
              Unsold
            </button>
            <button 
              className={`filter-btn ${historyFilter === 'mvp' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('mvp')}
            >
              MVP
            </button>
            <button 
              className={`filter-btn ${historyFilter === 'history' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('history')}
            >
              History
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="live-main-content">
        {/* Live Auction Tab - Three Column Layout */}
        {activeTab === 'live' && (
          <div className="live-auction-tab-simple">
            {(() => {
              // Check if all players are sold
              const allPlayersSold = summary && summary.totalPlayers > 0 && (
                summary.remaining === 0 || 
                summary.auctioned === summary.totalPlayers
              );
              
              // If all players are sold, show completion message instead of current player
              if (allPlayersSold) {
                const appLogoUrl = `${process.env.PUBLIC_URL || ''}/logo512.png`;
                return (
                  <div className="live-auction-three-column">
                    <div className="live-auction-col live-auction-col-current">
                      <div className="live-auction-simple-container">
                        <div className="auction-completed-section">
                          <div className="auction-completed-animation">
                            <div className="auction-completed-icon">🎉</div>
                            <h2 className="auction-completed-title">Auction Completed</h2>
                            <p className="auction-completed-message">All Player Sold</p>
                            <div className="auction-completed-app-info">
                              <div className="app-info-logo">
                                <img src={appLogoUrl} alt="PlayLive" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                              </div>
                              <p className="app-info-text">💙 Powered by PlayLive</p>
                              <p className="app-info-details">Live Auction System</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Otherwise show normal player content (only if not all players sold)
              return null;
            })()}
            
            {(() => {
              // Check if all players are sold - if so, don't show player content
              const allPlayersSold = summary && summary.totalPlayers > 0 && (
                summary.remaining === 0 || 
                summary.auctioned === summary.totalPlayers
              );
              
              if (allPlayersSold) {
                return null;
              }
              
              return currentPlayer ? (
              <div className="live-auction-three-column">
                {/* Part 1 - Current Player Section */}
                <div className="live-auction-col live-auction-col-current">
                  <div className="live-auction-simple-container">
                    {/* Player Info Section */}
                    <div className="simple-player-section">
                      <div 
                        className="simple-player-photo"
                        onClick={() => setShowPlayerImageModal(true)}
                        style={{ cursor: 'pointer' }}
                      >
                        <img 
                          src={getPlayerPhotoUrl(currentPlayer.photo)} 
                          alt={currentPlayer.name}
                          onError={(e) => {
                            e.target.src = `${API_BASE_URL}/default-photo.png`;
                          }}
                        />
                      </div>
                      <div className="simple-player-info">
                        <h2 className="simple-player-name">{currentPlayer.name}</h2>
                        <div className="simple-player-meta">
                          <span className="simple-badge">#{
                            currentPlayer.playerId 
                              ? currentPlayer.playerId.includes('-') 
                                ? currentPlayer.playerId.split('-').pop() 
                                : currentPlayer.playerId.replace(/^[A-Z0-9]+-?/, '').replace(/^[A-Z]+/, '') || currentPlayer.playerId.slice(-4)
                              : 'N/A'
                          }</span>
                          <span className="simple-badge">{currentPlayer.role || 'Player'}</span>
                          {currentPlayer.city && <span className="simple-badge">📍 {currentPlayer.city}</span>}
                        </div>
                        <div className="simple-base-price">
                          Base: ₹{currentPlayer.basePrice?.toLocaleString() || '0'}
                        </div>
                      </div>
                    </div>

                    {/* Current Bid Section */}
                    <div className="simple-bid-section">
                      <div className="simple-bid-amount">
                        ₹{(currentPlayer.currentBid || currentPlayer.basePrice || 0).toLocaleString()}
                      </div>
                      {getCurrentBidder() && (
                        <div className="simple-current-bidder">
                          <img 
                            src={getTeamLogoUrl(getCurrentBidder().logo)} 
                            alt={getCurrentBidder().name}
                            className="simple-bidder-logo"
                          />
                          <span className="simple-bidder-name">{getCurrentBidder().name}</span>
                        </div>
                      )}
                      {auctionStatus === 'running' && tournament?.auctionAdvancedSettings?.timerEnabled !== false && (
                        <div className="simple-timer">
                          <div className="simple-timer-bar">
                            <div 
                              className="simple-timer-fill"
                              style={{ width: `${(timer / 30) * 100}%` }}
                            ></div>
                          </div>
                          <div className={`simple-timer-text ${timer <= 5 ? 'urgent' : ''}`}>
                            {timer}s
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Stats Footer */}
                    <div className="simple-stats-footer">
                      <div className="simple-stat-item">
                        <span className="simple-stat-label">Total</span>
                        <span className="simple-stat-value">{summary?.totalPlayers || 0}</span>
                      </div>
                      <div className="simple-stat-item">
                        <span className="simple-stat-label">Sold</span>
                        <span className="simple-stat-value">{summary?.auctioned || 0}</span>
                      </div>
                      <div className="simple-stat-item">
                        <span className="simple-stat-label">Remaining</span>
                        <span className="simple-stat-value">{summary?.remaining || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Part 2 - Bid History Section */}
                <div className="live-auction-col live-auction-col-bids">
                  <div className="recent-bids-panel">
                    <h3 className="recent-bids-title">Bid History</h3>
                    <div className="recent-bids-list">
                      {bidHistory && bidHistory.length > 0 ? (
                        bidHistory.slice(0, 20).map((bid, idx) => {
                          const team = teams.find(t => t._id === bid.bidder || t.name === bid.teamName);
                          return (
                            <div key={idx} className="recent-bid-item">
                              <div className="recent-bid-rank">#{bidHistory.length - idx}</div>
                              {team?.logo && (
                                <img 
                                  src={getTeamLogoUrl(team.logo)} 
                                  alt={team?.name}
                                  className="recent-bid-team-logo"
                                />
                              )}
                              <div className="recent-bid-info">
                                <div className="recent-bid-team-name">{team?.name || bid.teamName || 'Unknown'}</div>
                                <div className="recent-bid-time">
                                  {bid.bidTime 
                                    ? new Date(bid.bidTime).toLocaleTimeString('en-IN', { 
                                        hour: '2-digit', 
                                        minute: '2-digit', 
                                        second: '2-digit',
                                        hour12: true 
                                      })
                                    : bid.timestamp
                                      ? new Date(bid.timestamp).toLocaleTimeString('en-IN', { 
                                          hour: '2-digit', 
                                          minute: '2-digit', 
                                          second: '2-digit',
                                          hour12: true 
                                        })
                                      : '—'
                                  }
                                </div>
                              </div>
                              <div className="recent-bid-amount">
                                ₹{bid.bidAmount?.toLocaleString() || bid.amount?.toLocaleString() || '0'}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="no-bids-message">
                          <p>No bids yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Part 3 - Last Sold Player Section */}
                <div className="live-auction-col live-auction-col-last-sold">
                  {summary?.lastSoldPlayer ? (
                    <div className="last-sold-player-panel">
                      <h3 className="last-sold-title">Last Sold Player</h3>
                      <div className="last-sold-player-card">
                        <div className="last-sold-player-photo">
                          <img 
                            src={getPlayerPhotoUrl(summary.lastSoldPlayer.photo)} 
                            alt={summary.lastSoldPlayer.name}
                            onError={(e) => {
                              e.target.src = `${API_BASE_URL}/default-photo.png`;
                            }}
                          />
                        </div>
                        <div className="last-sold-player-info">
                          <div className="last-sold-player-name">{summary.lastSoldPlayer.name}</div>
                          <div className="last-sold-player-meta">
                            {summary.lastSoldPlayer.playerId && (
                              <span className="last-sold-badge">#{summary.lastSoldPlayer.playerId.includes('-') 
                                ? summary.lastSoldPlayer.playerId.split('-').pop() 
                                : summary.lastSoldPlayer.playerId.replace(/^[A-Z0-9]+-?/, '').replace(/^[A-Z]+/, '') || summary.lastSoldPlayer.playerId.slice(-4)}</span>
                            )}
                            {summary.lastSoldPlayer.role && (
                              <span className="last-sold-badge">{summary.lastSoldPlayer.role}</span>
                            )}
                            {summary.lastSoldPlayer.city && (
                              <span className="last-sold-badge">📍 {summary.lastSoldPlayer.city}</span>
                            )}
                          </div>
                          {summary.lastSoldPlayer.basePrice && (
                            <div className="last-sold-base-price">
                              Base: ₹{summary.lastSoldPlayer.basePrice.toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="last-sold-sale-info">
                          <div className="last-sold-team">
                            {(() => {
                              const soldTeam = teams.find(t => 
                                t._id === summary.lastSoldPlayer.soldTo || 
                                t.name === summary.lastSoldPlayer.soldToName
                              );
                              return soldTeam ? (
                                <>
                                  {soldTeam.logo && (
                                    <img 
                                      src={getTeamLogoUrl(soldTeam.logo)} 
                                      alt={soldTeam.name}
                                      className="last-sold-team-logo"
                                    />
                                  )}
                                  <span className="last-sold-team-name">{soldTeam.name || summary.lastSoldPlayer.soldToName}</span>
                                </>
                              ) : (
                                <span className="last-sold-team-name">{summary.lastSoldPlayer.soldToName || 'Unknown Team'}</span>
                              );
                            })()}
                          </div>
                          <div className="last-sold-price">
                            ₹{summary.lastSoldPlayer.soldPrice?.toLocaleString() || '0'}
                          </div>
                          {summary.lastSoldPlayer.soldAt && (
                            <div className="last-sold-time">
                              {new Date(summary.lastSoldPlayer.soldAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="last-sold-player-panel">
                      <h3 className="last-sold-title">Last Sold Player</h3>
                      <div className="no-last-sold-message">
                        <p>No players sold yet</p>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              ) : null;
            })()}
            
            {(() => {
              // Check if all players are sold - if so, don't show waiting message
              const allPlayersSold = summary && summary.totalPlayers > 0 && (
                summary.remaining === 0 || 
                summary.auctioned === summary.totalPlayers
              );
              
              if (allPlayersSold) {
                return null;
              }
              
              return !currentPlayer ? (
              <div className="live-auction-three-column">
                {/* Part 1 - Waiting Message */}
                <div className="live-auction-col live-auction-col-current">
                  <div className="simple-waiting-container">
                    <div className="simple-waiting">
                      <div className="simple-waiting-icon">⏳</div>
                      <h3>Waiting for auction to begin...</h3>
                    </div>
                    {/* Quick Stats Footer - Always Show */}
                    <div className="simple-stats-footer">
                      <div className="simple-stat-item">
                        <span className="simple-stat-label">Total</span>
                        <span className="simple-stat-value">{summary?.totalPlayers || 0}</span>
                      </div>
                      <div className="simple-stat-item">
                        <span className="simple-stat-label">Sold</span>
                        <span className="simple-stat-value">{summary?.auctioned || 0}</span>
                      </div>
                      <div className="simple-stat-item">
                        <span className="simple-stat-label">Remaining</span>
                        <span className="simple-stat-value">{summary?.remaining || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Part 2 - Empty/Bid History Placeholder */}
                <div className="live-auction-col live-auction-col-bids">
                  <div className="recent-bids-panel">
                    <h3 className="recent-bids-title">Bid History</h3>
                    <div className="recent-bids-list">
                      <div className="no-bids-message">
                        <p>Waiting for bids...</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Part 3 - Last Sold Player */}
                <div className="live-auction-col live-auction-col-last-sold">
                  {summary?.lastSoldPlayer ? (
                    <div className="last-sold-player-panel">
                      <h3 className="last-sold-title">Last Sold Player</h3>
                      <div className="last-sold-player-card">
                        <div className="last-sold-player-photo">
                          <img 
                            src={getPlayerPhotoUrl(summary.lastSoldPlayer.photo)} 
                            alt={summary.lastSoldPlayer.name}
                            onError={(e) => {
                              e.target.src = `${API_BASE_URL}/default-photo.png`;
                            }}
                          />
                        </div>
                        <div className="last-sold-player-info">
                          <div className="last-sold-player-name">{summary.lastSoldPlayer.name}</div>
                          <div className="last-sold-player-meta">
                            {summary.lastSoldPlayer.playerId && (
                              <span className="last-sold-badge">#{summary.lastSoldPlayer.playerId.includes('-') 
                                ? summary.lastSoldPlayer.playerId.split('-').pop() 
                                : summary.lastSoldPlayer.playerId.replace(/^[A-Z0-9]+-?/, '').replace(/^[A-Z]+/, '') || summary.lastSoldPlayer.playerId.slice(-4)}</span>
                            )}
                            {summary.lastSoldPlayer.role && (
                              <span className="last-sold-badge">{summary.lastSoldPlayer.role}</span>
                            )}
                            {summary.lastSoldPlayer.city && (
                              <span className="last-sold-badge">📍 {summary.lastSoldPlayer.city}</span>
                            )}
                          </div>
                          {summary.lastSoldPlayer.basePrice && (
                            <div className="last-sold-base-price">
                              Base: ₹{summary.lastSoldPlayer.basePrice.toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="last-sold-sale-info">
                          <div className="last-sold-team">
                            {(() => {
                              const soldTeam = teams.find(t => 
                                t._id === summary.lastSoldPlayer.soldTo || 
                                t.name === summary.lastSoldPlayer.soldToName
                              );
                              return soldTeam ? (
                                <>
                                  {soldTeam.logo && (
                                    <img 
                                      src={getTeamLogoUrl(soldTeam.logo)} 
                                      alt={soldTeam.name}
                                      className="last-sold-team-logo"
                                    />
                                  )}
                                  <span className="last-sold-team-name">{soldTeam.name || summary.lastSoldPlayer.soldToName}</span>
                                </>
                              ) : (
                                <span className="last-sold-team-name">{summary.lastSoldPlayer.soldToName || 'Unknown Team'}</span>
                              );
                            })()}
                          </div>
                          <div className="last-sold-price">
                            ₹{summary.lastSoldPlayer.soldPrice?.toLocaleString() || '0'}
                          </div>
                          {summary.lastSoldPlayer.soldAt && (
                            <div className="last-sold-time">
                              {new Date(summary.lastSoldPlayer.soldAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="last-sold-player-panel">
                      <h3 className="last-sold-title">Last Sold Player</h3>
                      <div className="no-last-sold-message">
                        <p>No players sold yet</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              ) : null;
            })()}
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="teams-tab-content">
            <div className="teams-tab-header">
              <h2>Teams</h2>
              <button 
                className={`compare-toggle-btn ${showTeamComparison ? 'active' : ''}`}
                onClick={() => setShowTeamComparison(!showTeamComparison)}
              >
                {showTeamComparison ? 'Hide' : 'Show'} Comparison
              </button>
            </div>

            {/* Grouping Summary Section */}
            <GroupingSummary tournamentCode={tournamentCode} teams={teams} />
            
            {!showTeamComparison ? (
              <div className="teams-grid-view">
                {getTeamBudgets().map((team) => {
                  return (
                    <div 
                      key={team._id} 
                      className="team-card-view"
                      onClick={() => handleViewDetails(team._id)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      <button
                        className="team-card-print-btn"
                        onClick={(e) => handlePrintTeam(team._id, e)}
                        title="Print Team Details"
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'rgba(255, 255, 255, 0.9)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '30px',
                          height: '30px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          zIndex: 10,
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 6 2 18 2 18 9"></polyline>
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                          <rect x="6" y="14" width="12" height="8"></rect>
                        </svg>
                      </button>
                      {team.logo && (
                        <img 
                          src={getTeamLogoUrl(team.logo)} 
                          alt={team.name}
                          className="team-card-logo"
                        />
                      )}
                      <h3 className="team-card-name">{team.name}</h3>
                      <div className="team-card-stats">
                        <div className="team-stat-item">
                          <span>Players:</span>
                          <span>{team.playersBought || 0}</span>
                        </div>
                        <div className="team-stat-item">
                          <span>Spent:</span>
                          <span>₹{team.spent?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="team-stat-item">
                          <span>Remaining:</span>
                          <span>₹{team.remaining?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="team-stat-item">
                          <span>Max Bid:</span>
                          <span>₹{team.maxBid?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="team-stat-item">
                          <span>Player Need:</span>
                          <span>{team.playersNeed || 0}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="teams-comparison-table-container">
                <table className="teams-comparison-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      {getTeamBudgets().map(team => (
                        <th key={team._id} className="team-column">
                          <div className="comparison-team-header">
                            {team.logo && (
                              <img 
                                src={getTeamLogoUrl(team.logo)} 
                                alt={team.name}
                                className="comparison-team-logo"
                              />
                            )}
                            <span>{team.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="stat-label">Players</td>
                      {getTeamBudgets().map(team => (
                        <td key={team._id} className="stat-value">{team.playersBought || 0}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="stat-label">Spent</td>
                      {getTeamBudgets().map(team => (
                        <td key={team._id} className="stat-value gold">₹{team.spent?.toLocaleString() || '0'}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="stat-label">Remaining</td>
                      {getTeamBudgets().map(team => (
                        <td key={team._id} className="stat-value">₹{team.remaining?.toLocaleString() || '0'}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="stat-label">Max Bid</td>
                      {getTeamBudgets().map(team => (
                        <td key={team._id} className="stat-value">{team.maxBid?.toLocaleString() || '0'}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Player Tab */}
        {activeTab === 'history' && (
          <div className="history-tab-content">
            <div className="history-header">
              {/* Header removed - content moved to progress bar */}
            </div>
            {loadingTotal && totalPlayers.length === 0 ? (
              <div className="loading-message">Loading all players...</div>
            ) : (
            <div className="history-grid-simple">
              {(() => {
                let filteredPlayers = [];
                
                // Helper function to extract numeric part of player ID for sorting
                const getPlayerIdNumber = (playerId) => {
                  if (!playerId) return 0;
                  const str = String(playerId);
                  // Extract numeric part after last dash (e.g., "PLTC003-1" -> 1)
                  if (str.includes('-')) {
                    const parts = str.split('-');
                    const num = parseInt(parts[parts.length - 1], 10);
                    return isNaN(num) ? 0 : num;
                  }
                  // If no dash, try to parse the whole string as number
                  const num = parseInt(str, 10);
                  return isNaN(num) ? 0 : num;
                };
                
                // Always prioritize totalPlayers as it contains ALL players
                const allPlayersSource = totalPlayers.length > 0 ? totalPlayers : [...history, ...pendingPlayers];
                
                if (historyFilter === 'all') {
                  // Use totalPlayers as primary source (contains all players)
                  // Combine with history and pendingPlayers to ensure we have latest data
                  const allPlayersMap = new Map();
                  [...totalPlayers, ...history, ...pendingPlayers].forEach(player => {
                    if (player._id && !allPlayersMap.has(player._id.toString())) {
                      allPlayersMap.set(player._id.toString(), player);
                    }
                  });
                  filteredPlayers = Array.from(allPlayersMap.values());
                } else if (historyFilter === 'sold') {
                  // Use totalPlayers to get all sold players
                  filteredPlayers = allPlayersSource.filter(p => p.auctionStatus === 'Sold');
                } else if (historyFilter === 'pending') {
                  // Combine pendingPlayers and totalPlayers for pending status
                  const pendingMap = new Map();
                  [...pendingPlayers, ...allPlayersSource].forEach(player => {
                    if (player.auctionStatus === 'Pending' && player._id && !pendingMap.has(player._id.toString())) {
                      pendingMap.set(player._id.toString(), player);
                    }
                  });
                  filteredPlayers = Array.from(pendingMap.values());
                } else if (historyFilter === 'unsold') {
                  // Use totalPlayers to get all unsold players
                  filteredPlayers = allPlayersSource.filter(p => p.auctionStatus === 'Unsold');
                } else if (historyFilter === 'mvp') {
                  // MVP filter: Show only sold players sorted by value (highest first)
                  filteredPlayers = allPlayersSource.filter(p => p.auctionStatus === 'Sold');
                  // Sort by soldPrice in descending order (highest value first), then by player ID
                  filteredPlayers.sort((a, b) => {
                    const valueA = a.soldPrice || 0;
                    const valueB = b.soldPrice || 0;
                    // Primary sort: by price (descending)
                    if (valueB !== valueA) {
                      return valueB - valueA;
                    }
                    // Secondary sort: by player ID (ascending)
                    const aNum = getPlayerIdNumber(a.playerId);
                    const bNum = getPlayerIdNumber(b.playerId);
                    return aNum - bNum;
                  });
                } else if (historyFilter === 'available') {
                  // Available filter: Show only players with Available status (not sold, pending, unsold, or in auction)
                  filteredPlayers = allPlayersSource.filter(p => {
                    const status = p.auctionStatus;
                    // Exclude current player (if it's in auction)
                    const isCurrentPlayer = currentPlayer && (
                      currentPlayer._id === p._id || 
                      (currentPlayer._id && p._id && currentPlayer._id.toString() === p._id.toString())
                    );
                    // Only show players with Available status, excluding InAuction and current player
                    return status === 'Available' && !isCurrentPlayer;
                  });
                } else if (historyFilter === 'history') {
                  // History filter: Show players from history array
                  filteredPlayers = history;
                  // Sort by most recent first (using the most recent timestamp available)
                  filteredPlayers.sort((a, b) => {
                    if (!a || !b) return 0;
                    // Get the most recent timestamp for each player
                    const getMostRecentTimestamp = (player) => {
                      if (player.soldAt) return new Date(player.soldAt).getTime();
                      if (player.updatedAt) return new Date(player.updatedAt).getTime();
                      if (player.unsoldAt) return new Date(player.unsoldAt).getTime();
                      if (player.pendingAt) return new Date(player.pendingAt).getTime();
                      if (player.registeredAt) return new Date(player.registeredAt).getTime();
                      return 0;
                    };
                    const aTime = getMostRecentTimestamp(a);
                    const bTime = getMostRecentTimestamp(b);
                    // Sort descending (most recent first)
                    return bTime - aTime;
                  });
                }
                
                // Sort all filtered players by player ID (extract numeric part for proper numeric sorting)
                // Note: MVP and History filters are already sorted above, so skip sorting for them
                if (historyFilter !== 'mvp' && historyFilter !== 'history') {
                  filteredPlayers.sort((a, b) => {
                    if (!a || !b) return 0;
                    const aNum = getPlayerIdNumber(a.playerId);
                    const bNum = getPlayerIdNumber(b.playerId);
                    return aNum - bNum;
                  });
                }
                
                // Debug log
                if (filteredPlayers.length === 0 && totalPlayers.length > 0) {
                  console.warn(`⚠️ No players found for filter "${historyFilter}" but totalPlayers has ${totalPlayers.length} players`);
                }
                
                return filteredPlayers.map((player, idx) => {
                  const soldTeam = teams.find(t => t._id === player.soldTo || t.name === player.soldToName);
                  const currentBidTeam = teams.find(t => t._id === player.currentBidTeam || t.name === player.currentBidTeamName);
                  const isPending = player.auctionStatus === 'Pending';
                  // Only mark as ongoing if this player is the actual current player
                  // Check by _id match to ensure only ONE player is marked as ongoing
                  const isCurrentPlayer = currentPlayer && (
                    currentPlayer._id === player._id || 
                    (currentPlayer._id && player._id && currentPlayer._id.toString() === player._id.toString())
                  );
                  // Only mark as ongoing if it's the actual current player
                  // Don't rely on auctionStatus === 'InAuction' alone as it might be stale
                  const isOngoing = isCurrentPlayer;
                  
                  // Determine status
                  let status = 'available';
                  let statusText = 'Available';
                  if (isOngoing) {
                    status = 'ongoing';
                    statusText = 'Ongoing';
                  } else if (player.auctionStatus === 'Sold') {
                    status = 'sold';
                    statusText = 'Sold';
                  } else if (isPending || player.auctionStatus === 'Pending') {
                    status = 'pending';
                    statusText = 'Pending';
                  } else if (player.auctionStatus === 'Unsold') {
                    status = 'unsold';
                    statusText = 'Unsold';
                  }
                  
                  // Extract player ID without tournament code
                  const getPlayerIdOnly = (playerId) => {
                    if (!playerId) return 'N/A';
                    if (playerId.includes('-')) {
                      return playerId.split('-').pop();
                    }
                    // Remove tournament code prefix (e.g., PLTC001-001 -> 001)
                    return playerId.replace(/^[A-Z0-9]+-?/, '').replace(/^[A-Z]+/, '') || playerId.slice(-4);
                  };
                  
                  return (
                    <div 
                      key={player._id || idx} 
                      className={`history-card-simple status-${status}`}
                      onClick={() => {
                        setSelectedPlayerDetails(player);
                        setShowPlayerDetailsModal(true);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Player ID Badge - Top Right */}
                      <div className="history-card-player-id">
                        #{getPlayerIdOnly(player.playerId)}
                      </div>
                      
                      {/* Status Badge */}
                      <div className={`history-card-status-badge status-${status}`}>
                        {statusText}
                      </div>
                      
                      <div className="history-simple-image">
                        <img 
                          src={getPlayerPhotoUrl(player.photo)} 
                          alt={player.name}
                          onError={(e) => {
                            e.target.src = `${API_BASE_URL}/default-photo.png`;
                          }}
                        />
                      </div>
                      
                      <div className="history-card-player-name">{player.name}</div>
                      
                      {status === 'sold' && soldTeam ? (
                        <>
                          <div className="history-simple-team">
                            {soldTeam.logo && (
                              <img 
                                src={getTeamLogoUrl(soldTeam.logo)} 
                                alt={soldTeam.name}
                                className="history-team-logo"
                              />
                            )}
                            <span className="history-team-name">{soldTeam.name || player.soldToName}</span>
                          </div>
                          <div className="history-simple-price">
                            ₹{player.soldPrice?.toLocaleString() || '0'}
                          </div>
                        </>
                      ) : status === 'pending' && currentBidTeam ? (
                        <>
                          <div className="history-simple-team">
                            {currentBidTeam.logo && (
                              <img 
                                src={getTeamLogoUrl(currentBidTeam.logo)} 
                                alt={currentBidTeam.name}
                                className="history-team-logo"
                              />
                            )}
                            <span className="history-team-name">{currentBidTeam.name || player.currentBidTeamName}</span>
                          </div>
                          <div className="history-simple-price pending">
                            ₹{player.currentBid?.toLocaleString() || '0'}
                          </div>
                        </>
                      ) : status === 'ongoing' ? (
                        <>
                          <div className="history-simple-team">
                            <span className="history-ongoing-text">In Auction</span>
                          </div>
                          <div className="history-simple-price ongoing">
                            ₹{player.currentBid?.toLocaleString() || player.basePrice?.toLocaleString() || '0'}
                          </div>
                        </>
                      ) : status === 'unsold' ? (
                        <>
                          <div className="history-simple-team">
                            <span className="history-unsold-text">Unsold</span>
                          </div>
                          <div className="history-simple-price unsold">
                            -
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="history-simple-team">
                            <span className="history-available-text">Available</span>
                          </div>
                          <div className="history-simple-price available">
                            ₹{player.basePrice?.toLocaleString() || '0'}
                          </div>
                        </>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
            )}
          </div>
        )}

        {/* Unsold Tab */}
        {activeTab === 'unsold' && (
          <div className="unsold-tab-content">
            <div className="unsold-header">
              <h2>Unsold Players</h2>
              <div className="unsold-count">{unsoldPlayers.length} players</div>
            </div>
            {loadingUnsold ? (
              <div className="loading-message">Loading unsold players...</div>
            ) : (
              <div className="unsold-list-scrollable">
                {unsoldPlayers.length > 0 ? (
                  unsoldPlayers.map((player, idx) => (
                    <div key={player._id || idx} className="unsold-item-card">
                      <div className="unsold-rank-badge">#{idx + 1}</div>
                      <div className="unsold-player-photo">
                        <img 
                          src={getPlayerPhotoUrl(player.photo)} 
                          alt={player.name}
                          onError={(e) => {
                            e.target.src = `${API_BASE_URL}/default-photo.png`;
                          }}
                        />
                      </div>
                      <div className="unsold-player-details">
                        <div className="unsold-player-name">{player.name}</div>
                        <div className="unsold-player-meta">
                          <span>ID: {player.playerId || 'N/A'}</span>
                          <span>•</span>
                          <span>{player.role || 'N/A'}</span>
                          {player.city && (
                            <>
                              <span>•</span>
                              <span>{player.city}</span>
                            </>
                          )}
                        </div>
                        <div className="unsold-base-price">
                          Base: ₹{player.basePrice?.toLocaleString() || '0'}
                        </div>
                        {player.unsoldAt && (
                          <div className="unsold-timestamp">
                            Unsold: {new Date(player.unsoldAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="unsold-status-badge">❌ Unsold</div>
                    </div>
                  ))
                ) : (
                  <div className="no-players-message">No unsold players</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pending Tab */}
        {activeTab === 'pending' && (
          <div className="pending-tab-content">
            <div className="pending-header">
              <h2>Pending Players</h2>
              <div className="pending-count">{pendingPlayers.length} players</div>
            </div>
            {loadingPending ? (
              <div className="loading-message">Loading pending players...</div>
            ) : (
              <div className="pending-list-scrollable">
                {pendingPlayers.length > 0 ? (
                  pendingPlayers.map((player, idx) => (
                    <div key={player._id || idx} className="pending-item-card">
                      <div className="pending-rank-badge">#{idx + 1}</div>
                      <div className="pending-player-photo">
                        <img 
                          src={getPlayerPhotoUrl(player.photo)} 
                          alt={player.name}
                          onError={(e) => {
                            e.target.src = `${API_BASE_URL}/default-photo.png`;
                          }}
                        />
                      </div>
                      <div className="pending-player-details">
                        <div className="pending-player-name">{player.name}</div>
                        <div className="pending-player-meta">
                          <span>ID: {player.playerId || 'N/A'}</span>
                          <span>•</span>
                          <span>{player.role || 'N/A'}</span>
                          {player.city && (
                            <>
                              <span>•</span>
                              <span>{player.city}</span>
                            </>
                          )}
                        </div>
                        <div className="pending-base-price">
                          Base: ₹{player.basePrice?.toLocaleString() || '0'}
                        </div>
                        {player.currentBid > 0 && (
                          <div className="pending-current-bid">
                            Current Bid: ₹{player.currentBid.toLocaleString()}
                            {player.currentBidTeamName && (
                              <span className="pending-bidder"> • {player.currentBidTeamName}</span>
                            )}
                          </div>
                        )}
                        {player.pendingAt && (
                          <div className="pending-timestamp">
                            Pending since: {new Date(player.pendingAt).toLocaleString()}
                          </div>
                        )}
                        {player.bidHistory && player.bidHistory.length > 0 && (
                          <button 
                            className="btn-view-bid-history"
                            onClick={() => {
                              setCurrentPlayer(player);
                              setBidHistory(player.bidHistory.slice().reverse());
                              setShowBidHistory(true);
                            }}
                          >
                            View Bid History ({player.bidHistory.length})
                          </button>
                        )}
                      </div>
                      <div className="pending-status-badge">⏳ Pending</div>
                    </div>
                  ))
                ) : (
                  <div className="no-players-message">No pending players</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Total Tab */}
        {activeTab === 'total' && (
          <div className="total-tab-content">
            <div className="total-header">
              <h2>All Players</h2>
              <div className="total-count">{totalPlayers.length} players</div>
            </div>
            {loadingTotal ? (
              <div className="loading-message">Loading all players...</div>
            ) : (
              <div className="total-list-scrollable">
                {totalPlayers.length > 0 ? (
                  totalPlayers.map((player, idx) => {
                    const statusClass = player.auctionStatus?.toLowerCase() || 'available';
                    const statusIcon = {
                      'sold': '✅',
                      'unsold': '❌',
                      'pending': '⏳',
                      'withdrawn': '🚫',
                      'available': '🟢',
                      'inauction': '🔄'
                    }[statusClass] || '⚪';
                    
                    return (
                      <div key={player._id || idx} className={`total-item-card status-${statusClass}`}>
                        <div className="total-rank-badge">#{idx + 1}</div>
                        <div className="total-player-photo">
                          <img 
                            src={getPlayerPhotoUrl(player.photo)} 
                            alt={player.name}
                            onError={(e) => {
                              e.target.src = `${API_BASE_URL}/default-photo.png`;
                            }}
                          />
                        </div>
                        <div className="total-player-details">
                          <div className="total-player-name">{player.name}</div>
                          <div className="total-player-meta">
                            <span>ID: {player.playerId || 'N/A'}</span>
                            <span>•</span>
                            <span>{player.role || 'N/A'}</span>
                            {player.city && (
                              <>
                                <span>•</span>
                                <span>{player.city}</span>
                              </>
                            )}
                          </div>
                          <div className="total-base-price">
                            Base: ₹{player.basePrice?.toLocaleString() || '0'}
                          </div>
                          {player.soldPrice && (
                            <div className="total-sold-price">
                              Sold: ₹{player.soldPrice.toLocaleString()} to {player.soldToName || 'N/A'}
                            </div>
                          )}
                          {player.soldAt && (
                            <div className="total-timestamp">
                              Sold: {new Date(player.soldAt).toLocaleString()}
                            </div>
                          )}
                          {player.unsoldAt && (
                            <div className="total-timestamp">
                              Unsold: {new Date(player.unsoldAt).toLocaleString()}
                            </div>
                          )}
                          {player.pendingAt && (
                            <div className="total-timestamp">
                              Pending: {new Date(player.pendingAt).toLocaleString()}
                            </div>
                          )}
                          {player.registeredAt && !player.soldAt && !player.unsoldAt && !player.pendingAt && (
                            <div className="total-timestamp">
                              Registered: {new Date(player.registeredAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className={`total-status-badge status-${statusClass}`}>
                          {statusIcon} {player.auctionStatus || 'Available'}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="no-players-message">No players found</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bidwise Tab */}
        {activeTab === 'bidwise' && (
          <div className="bidwise-tab-content">
            <div className="bidwise-header">
              <h2>Bidwise List</h2>
              <div className="bidwise-count">{bidwisePlayers.length} players with bids</div>
            </div>
            {loadingBidwise ? (
              <div className="loading-message">Loading bidwise players...</div>
            ) : (
              <div className="bidwise-list-scrollable">
                {bidwisePlayers.length > 0 ? (
                  bidwisePlayers.map((player, idx) => {
                    const highestBid = player.highestBid || player.currentBid || 0;
                    const lastBid = player.bidHistory && player.bidHistory.length > 0
                      ? player.bidHistory[player.bidHistory.length - 1]
                      : null;
                    
                    return (
                      <div key={player._id || idx} className="bidwise-item-card">
                        <div className="bidwise-rank-badge">#{idx + 1}</div>
                        <div className="bidwise-player-photo">
                          <img 
                            src={getPlayerPhotoUrl(player.photo)} 
                            alt={player.name}
                            onError={(e) => {
                              e.target.src = `${API_BASE_URL}/default-photo.png`;
                            }}
                          />
                        </div>
                        <div className="bidwise-player-details">
                          <div className="bidwise-player-name">{player.name}</div>
                          <div className="bidwise-player-meta">
                            <span>ID: {player.playerId || 'N/A'}</span>
                            <span>•</span>
                            <span>{player.role || 'N/A'}</span>
                            {player.city && (
                              <>
                                <span>•</span>
                                <span>{player.city}</span>
                              </>
                            )}
                          </div>
                          <div className="bidwise-base-price">
                            Base: ₹{player.basePrice?.toLocaleString() || '0'}
                          </div>
                          <div className="bidwise-highest-bid">
                            Highest Bid: ₹{highestBid.toLocaleString()}
                          </div>
                          {lastBid && (
                            <div className="bidwise-last-bid">
                              Last Bid: ₹{lastBid.bidAmount?.toLocaleString() || '0'}
                              {lastBid.teamName && (
                                <span className="bidwise-bidder"> • {lastBid.teamName}</span>
                              )}
                              {lastBid.bidTime && (
                                <span className="bidwise-time"> • {new Date(lastBid.bidTime).toLocaleTimeString()}</span>
                              )}
                            </div>
                          )}
                          {player.currentBidTeamName && (
                            <div className="bidwise-current-bidder">
                              Current Bidder: {player.currentBidTeamName}
                            </div>
                          )}
                          <div className={`bidwise-status status-${player.auctionStatus?.toLowerCase() || 'available'}`}>
                            Status: {player.auctionStatus || 'Available'}
                          </div>
                          {player.bidHistory && player.bidHistory.length > 0 && (
                            <button 
                              className="btn-view-bid-history"
                              onClick={() => {
                                setCurrentPlayer(player);
                                setBidHistory(player.bidHistory.slice().reverse());
                                setShowBidHistory(true);
                              }}
                            >
                              View Full Bid History ({player.bidHistory.length} bids)
                            </button>
                          )}
                        </div>
                        <div className="bidwise-bid-amount">
                          <div className="bidwise-amount-label">Highest Bid</div>
                          <div className="bidwise-amount-value">₹{highestBid.toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="no-players-message">No players with bids</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>


      {/* Player Image Modal */}
      {showPlayerImageModal && currentPlayer && (
        <div className="player-image-modal" onClick={() => setShowPlayerImageModal(false)}>
          <div className="player-image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="player-image-close-btn" onClick={() => setShowPlayerImageModal(false)}>×</button>
            <img 
              src={getPlayerPhotoUrl(currentPlayer.photo)} 
              alt={currentPlayer.name}
              className="player-image-fullsize"
              onError={(e) => {
                e.target.src = `${API_BASE_URL}/default-photo.png`;
              }}
            />
            <div className="player-image-name">{currentPlayer.name}</div>
          </div>
        </div>
      )}

      {/* Bid History Modal */}
      {showBidHistory && currentPlayer && (
        <div className="bid-history-modal" onClick={() => setShowBidHistory(false)}>
          <div className="bid-history-content" onClick={(e) => e.stopPropagation()}>
            <div className="bid-history-header">
              <h3>Bid History - {currentPlayer.name}</h3>
              <button className="close-btn" onClick={() => setShowBidHistory(false)}>×</button>
            </div>
            <div className="bid-history-list">
              {bidHistory.length > 0 ? (
                bidHistory.map((bid, idx) => {
                  const team = teams.find(t => t._id === bid.bidder);
                  return (
                    <div key={idx} className="bid-history-item">
                      <div className="bid-rank">#{bidHistory.length - idx}</div>
                      <img 
                        src={getTeamLogoUrl(team?.logo)} 
                        alt={team?.name}
                        className="bid-team-logo"
                      />
                      <div className="bid-info">
                        <span className="bid-team-name">{team?.name || 'Unknown'}</span>
                        <span className="bid-time">
                          {bid.bidTime 
                            ? new Date(bid.bidTime).toLocaleTimeString('en-IN', { 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                second: '2-digit',
                                hour12: true 
                              })
                            : bid.timestamp
                              ? new Date(bid.timestamp).toLocaleTimeString('en-IN', { 
                                  hour: '2-digit', 
                                  minute: '2-digit', 
                                  second: '2-digit',
                                  hour12: true 
                                })
                              : '—'
                          }
                        </span>
                      </div>
                      <div className="bid-amount-history">₹{bid.bidAmount?.toLocaleString()}</div>
                    </div>
                  );
                })
              ) : (
                <div className="no-bids">No bids yet</div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Footer - Simplified */}
      <footer className="live-footer-simple">
        <p>PlayLive • Last updated: {lastUpdate.toLocaleTimeString()}</p>
      </footer>

      {/* Team Details Modal - Custom Design */}
      {showTeamDetails && selectedTeam && (
        <div className="team-details-modal-overlay" onClick={handleCloseDetails}>
          <div className="team-details-modal" onClick={(e) => e.stopPropagation()}>
            {loadingTeamDetails ? (
              <div className="team-details-loading">Loading team details...</div>
            ) : teamDetailsData ? (
              <>
                <div className="team-details-header">
                  <button className="team-details-close" onClick={handleCloseDetails}>×</button>
                  <button 
                    className="team-details-print" 
                    onClick={() => handlePrintTeam(selectedTeam)}
                    title="Print Team Details"
                    style={{
                      position: 'absolute',
                      top: '20px',
                      right: '50px',
                      background: '#333',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#555';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#333';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9"></polyline>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                      <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                    Print
                  </button>
                  <div className="team-details-title-section">
                    <img 
                      src={getTeamLogoUrl(teamDetailsData.logo)} 
                      alt={teamDetailsData.name}
                      className="team-details-logo"
                      onError={(e) => {
                        e.target.src = `${API_BASE_URL}/default-logo.png`;
                      }}
                    />
                    <div>
                      <h2>{teamDetailsData.name} PLAYERS</h2>
                      {auctionStatus === 'running' && (
                        <div className="team-details-status">
                          <span className="status-dot-live"></span>
                          <span>LIVE</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="team-details-content">
                  {/* Budget Summary */}
                  <div className="team-details-budget-section">
                    <div className="budget-summary-card">
                      <div className="budget-summary-row">
                        <span className="budget-label-large">Total Budget</span>
                        <span className="budget-value-large">₹{(teamDetailsData.budget || 100000).toLocaleString()}</span>
                      </div>
                      <div className="budget-summary-row">
                        <span className="budget-label-large">Spent Amount</span>
                        <span className="budget-value-large spent">₹{(teamDetailsData.totalSpent || teamDetailsData.budgetUsed || 0).toLocaleString()}</span>
                      </div>
                      <div className="budget-summary-row">
                        <span className="budget-label-large">Balance</span>
                        <span className="budget-value-large balance">₹{(teamDetailsData.budgetBalance || teamDetailsData.currentBalance || 0).toLocaleString()}</span>
                      </div>
                      <div className="budget-summary-row highlight-row">
                        <span className="budget-label-large">Maximum Call</span>
                        <span className="budget-value-large highlight-value">₹{(teamDetailsData.maxBid || teamDetailsData.maxPossibleBid || 0).toLocaleString()}</span>
                      </div>
                      {teamDetailsData.playersBought !== undefined && (
                        <div className="budget-summary-row">
                          <span className="budget-label-large">Players Bought</span>
                          <span className="budget-value-large">{teamDetailsData.playersBought || teamPlayers.length}</span>
                        </div>
                      )}
                      <div className="budget-summary-row">
                        <span className="budget-label-large">Players Need</span>
                        <span className="budget-value-large players-need">
                          {(() => {
                            // Priority: teamDetailsData.maxPlayers (from backend) > tournament.maxPlayers > 16
                            const maxPlayersForTeam = teamDetailsData?.maxPlayers ?? tournament?.maxPlayers ?? 16;
                            const playersBought = teamDetailsData?.playersBought ?? teamPlayers.length ?? 0;
                            const playersNeed = Math.max(maxPlayersForTeam - playersBought, 0);
                            return playersNeed;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Players Section */}
                  <div className="team-details-players-section">
                    <div className="players-section-header">
                      <h3>Players Bought ({teamPlayers.length})</h3>
                      {teamDetailsData.playersByRole && Object.keys(teamDetailsData.playersByRole).length > 0 && (
                        <div className="players-role-summary">
                          {Object.entries(teamDetailsData.playersByRole).map(([role, count]) => (
                            <span key={role} className="role-badge">
                              {role}: {count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {teamPlayers.length > 0 ? (
                      <div className="team-players-table-container">
                        <table className="team-players-table">
                          <thead>
                            <tr>
                              <th>Photo</th>
                              <th>Player ID</th>
                              <th>Name</th>
                              <th>Role</th>
                              <th>City</th>
                              <th>Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamPlayers.map((player, idx) => {
                              // Extract player ID without tournament code
                              const getPlayerIdOnly = (playerId) => {
                                if (!playerId) return 'N/A';
                                if (playerId.includes('-')) {
                                  return playerId.split('-').pop();
                                }
                                return playerId.replace(/^[A-Z0-9]+-?/, '').replace(/^[A-Z]+/, '') || playerId.slice(-4);
                              };
                              
                              return (
                                <tr 
                                  key={player._id || idx}
                                  className="team-player-row"
                                  onClick={() => {
                                    setSelectedPlayerDetails(player);
                                    setShowPlayerDetailsModal(true);
                                  }}
                                >
                                  <td className="team-player-photo-cell">
                                    <div className="team-player-photo-small">
                                      <img 
                                        src={getPlayerPhotoUrl(player.photo)} 
                                        alt={player.name}
                                        onError={(e) => {
                                          e.target.src = `${API_BASE_URL}/default-photo.png`;
                                        }}
                                      />
                                    </div>
                                  </td>
                                  <td className="team-player-id-cell">
                                    #{getPlayerIdOnly(player.playerId)}
                                  </td>
                                  <td className="team-player-name-cell">
                                    {player.name}
                                  </td>
                                  <td className="team-player-role-cell">
                                    {player.role || 'N/A'}
                                  </td>
                                  <td className="team-player-city-cell">
                                    {player.city || 'N/A'}
                                  </td>
                                  <td className="team-player-price-cell">
                                    ₹{(player.soldPrice || 0).toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="no-players-message">No players bought yet</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="team-details-error">Unable to load team details</div>
            )}
          </div>
        </div>
      )}

      {/* Player Sold Notification Popup */}
      {notification && notification.type === 'sold' && (
        <div className="sold-notification-overlay" onClick={closeNotification}>
          <div className="sold-notification-popup" onClick={(e) => e.stopPropagation()}>
            <button className="notification-close" onClick={closeNotification}>×</button>
            <div className="notification-content">
              <div className="notification-icon">🎉</div>
              <h3 className="notification-title">PLAYER SOLD!</h3>
              <div className="notification-player">
                <div className="notification-player-photo">
                  <img 
                    src={getPlayerPhotoUrl(notification.player?.photo)} 
                    alt={notification.player?.name || 'Player'}
                    onError={(e) => {
                      e.target.src = `${API_BASE_URL}/default-photo.png`;
                    }}
                  />
                </div>
                <div className="notification-player-info">
                  <h4>{notification.player?.name || 'Player'}</h4>
                  <p className="notification-player-role">{notification.player?.role || ''}</p>
                </div>
              </div>
              <div className="notification-details">
                <div className="notification-detail-item">
                  <span className="detail-label">Sold To</span>
                  <span className="detail-value team-name">{notification.team || notification.player?.soldToName || 'Team'}</span>
                </div>
                <div className="notification-detail-item">
                  <span className="detail-label">Price</span>
                  <span className="detail-value price">₹{notification.price?.toLocaleString() || notification.player?.soldPrice?.toLocaleString() || '0'}</span>
                </div>
              </div>
              <div className="notification-footer">
                <span className="notification-time">Just now</span>
              </div>
            </div>
            <div className="notification-progress-bar"></div>
          </div>
        </div>
      )}

      {/* Player Unsold Notification Popup */}
      {notification && notification.type === 'unsold' && (
        <div className="sold-notification-overlay" onClick={closeNotification}>
          <div className="sold-notification-popup unsold-notification" onClick={(e) => e.stopPropagation()}>
            <button className="notification-close" onClick={closeNotification}>×</button>
            <div className="notification-content">
              <div className="notification-icon">❌</div>
              <h3 className="notification-title">PLAYER MARKED UNSOLD</h3>
              <div className="notification-message">
                <p>{notification.message || `❌ ${notification.player || 'Player'} marked as UNSOLD.`}</p>
                <p className="notification-submessage">🟢 Moving to Next Player...</p>
              </div>
              <div className="notification-footer">
                <span className="notification-time">Just now</span>
              </div>
            </div>
            <div className="notification-progress-bar"></div>
          </div>
        </div>
      )}

      {/* Player Details Modal */}
      {showPlayerDetailsModal && selectedPlayerDetails && (
        <div className="player-details-modal" onClick={() => setShowPlayerDetailsModal(false)}>
          <div className="player-details-content" onClick={(e) => e.stopPropagation()}>
            <div className="player-details-header">
              <h3>Player Details</h3>
              <button className="close-btn" onClick={() => setShowPlayerDetailsModal(false)}>×</button>
            </div>
            
            <div className="player-details-body">
              {/* Player Photo and Basic Info */}
              <div className="player-details-top">
                <div className="player-details-photo">
                  <img 
                    src={getPlayerPhotoUrl(selectedPlayerDetails.photo)} 
                    alt={selectedPlayerDetails.name}
                    onError={(e) => {
                      e.target.src = `${API_BASE_URL}/default-photo.png`;
                    }}
                  />
                </div>
                <div className="player-details-info">
                  <h2>{selectedPlayerDetails.name}</h2>
                  <div className="player-details-meta">
                    <span className="player-id-display">ID: #{selectedPlayerDetails.playerId || 'N/A'}</span>
                    <span className="player-role">{selectedPlayerDetails.role || 'N/A'}</span>
                    {selectedPlayerDetails.city && (
                      <span className="player-city">{selectedPlayerDetails.city}</span>
                    )}
                  </div>
                  <div className="player-status-display">
                    <span className={`status-badge-large status-${(() => {
                      if (selectedPlayerDetails.auctionStatus === 'Sold') return 'sold';
                      if (selectedPlayerDetails.auctionStatus === 'Pending') return 'pending';
                      if (selectedPlayerDetails.auctionStatus === 'Unsold') return 'unsold';
                      if (selectedPlayerDetails.auctionStatus === 'InAuction' || (currentPlayer && currentPlayer._id === selectedPlayerDetails._id)) return 'ongoing';
                      return 'available';
                    })()}`}>
                      {(() => {
                        if (selectedPlayerDetails.auctionStatus === 'Sold') return 'SOLD';
                        if (selectedPlayerDetails.auctionStatus === 'Pending') return 'PENDING';
                        if (selectedPlayerDetails.auctionStatus === 'Unsold') return 'UNSOLD';
                        if (selectedPlayerDetails.auctionStatus === 'InAuction' || (currentPlayer && currentPlayer._id === selectedPlayerDetails._id)) return 'ONGOING';
                        return 'AVAILABLE';
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Price Information */}
              <div className="player-details-pricing">
                <div className="price-item">
                  <span className="price-label">Base Price</span>
                  <span className="price-value">₹{selectedPlayerDetails.basePrice?.toLocaleString() || '0'}</span>
                </div>
                {selectedPlayerDetails.auctionStatus === 'Sold' && (
                  <>
                    <div className="price-item">
                      <span className="price-label">Sold Price</span>
                      <span className="price-value sold">₹{selectedPlayerDetails.soldPrice?.toLocaleString() || '0'}</span>
                    </div>
                    {selectedPlayerDetails.soldToName && (
                      <div className="price-item">
                        <span className="price-label">Sold To</span>
                        <span className="price-value">
                          {(() => {
                            const soldTeam = teams.find(t => t._id === selectedPlayerDetails.soldTo || t.name === selectedPlayerDetails.soldToName);
                            return soldTeam ? (
                              <span className="team-name-with-logo">
                                {soldTeam.logo && (
                                  <img src={getTeamLogoUrl(soldTeam.logo)} alt={soldTeam.name} className="team-logo-small" />
                                )}
                                {soldTeam.name || selectedPlayerDetails.soldToName}
                              </span>
                            ) : selectedPlayerDetails.soldToName;
                          })()}
                        </span>
                      </div>
                    )}
                    {selectedPlayerDetails.soldAt && (
                      <div className="price-item">
                        <span className="price-label">Sold At</span>
                        <span className="price-value">
                          {new Date(selectedPlayerDetails.soldAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {(selectedPlayerDetails.auctionStatus === 'Pending' || selectedPlayerDetails.currentBid) && (
                  <div className="price-item">
                    <span className="price-label">Current Bid</span>
                    <span className="price-value pending">₹{selectedPlayerDetails.currentBid?.toLocaleString() || selectedPlayerDetails.basePrice?.toLocaleString() || '0'}</span>
                  </div>
                )}
              </div>

              {/* Bid History */}
              <div className="player-details-bid-history">
                <h4>Bid History</h4>
                <div className="bid-history-list-detailed">
                  {selectedPlayerDetails.bidHistory && selectedPlayerDetails.bidHistory.length > 0 ? (
                    selectedPlayerDetails.bidHistory
                      .slice()
                      .reverse()
                      .map((bid, idx) => {
                        const team = teams.find(t => t._id === bid.bidder || t._id === bid.teamId);
                        return (
                          <div key={idx} className="bid-history-item-detailed">
                            <div className="bid-rank-detailed">#{selectedPlayerDetails.bidHistory.length - idx}</div>
                            {team?.logo && (
                              <img 
                                src={getTeamLogoUrl(team.logo)} 
                                alt={team.name}
                                className="bid-team-logo-detailed"
                              />
                            )}
                            <div className="bid-info-detailed">
                              <span className="bid-team-name-detailed">{team?.name || bid.teamName || 'Unknown Team'}</span>
                              <span className="bid-time-detailed">
                                {bid.bidTime || bid.timestamp
                                  ? new Date(bid.bidTime || bid.timestamp).toLocaleString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit', 
                                      minute: '2-digit', 
                                      second: '2-digit',
                                      hour12: true 
                                    })
                                  : '—'
                                }
                              </span>
                            </div>
                            <div className="bid-amount-detailed">₹{bid.bidAmount?.toLocaleString() || bid.amount?.toLocaleString() || '0'}</div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="no-bids-detailed">No bids placed yet</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveAuction;
