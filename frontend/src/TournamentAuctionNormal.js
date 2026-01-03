import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useAppLogo } from './hooks/useAppLogo';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-auction-new.css';

function TournamentAuctionNormal() {
  const { code } = useParams();
  const { i18n } = useTranslation();
  const { logoUrl: appLogoUrl } = useAppLogo();
  const [tournament, setTournament] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [auctionStatus, setAuctionStatus] = useState('stopped');
  const [teams, setTeams] = useState([]);
  const [currentBid, setCurrentBid] = useState(0);
  const [leadingTeam, setLeadingTeam] = useState(null);
  const [timer, setTimer] = useState(30);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({
    totalPlayers: 0,
    auctioned: 0,
    remaining: 0,
    unsold: 0,
    pending: 0
  });
  const [bidUpdated, setBidUpdated] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [expandedTeamHistory, setExpandedTeamHistory] = useState({});
  const [teamBidHistory, setTeamBidHistory] = useState({});
  const [headerVisible, setHeaderVisible] = useState(() => {
    const saved = localStorage.getItem('auctionHeaderVisible');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  // New feature states
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('auctionSoundEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showTeamComparison, setShowTeamComparison] = useState(false);
  // Search/filter removed
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showEnlargedImage, setShowEnlargedImage] = useState(false);
  const [showBidStats, setShowBidStats] = useState(false);
  const [allPlayers, setAllPlayers] = useState([]);
  const [bidStats, setBidStats] = useState({
    totalBids: 0,
    averageBid: 0,
    highestBid: 0,
    bidsByTeam: {},
    bidsByTime: []
  });

  // Additional feature states
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('auctionTheme') || 'stadium';
  });
  const [showBidPrediction, setShowBidPrediction] = useState(false);
  const [bidPrediction, setBidPrediction] = useState(null);
  const [showPlayerStats, setShowPlayerStats] = useState(false);
  const [selectedPlayerStats] = useState(null);
  const [replayHistory] = useState([]);
  const [showReplay, setShowReplay] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [showMarkSoldConfirm, setShowMarkSoldConfirm] = useState(false);
  const [showMovePendingConfirm, setShowMovePendingConfirm] = useState(false);
  const [showMoveUnsoldConfirm, setShowMoveUnsoldConfirm] = useState(false);
  const [showRecallLastSoldConfirm, setShowRecallLastSoldConfirm] = useState(false);
  const [showEndAuctionConfirm, setShowEndAuctionConfirm] = useState(false);
  const [showUndoBidConfirm, setShowUndoBidConfirm] = useState(false);
  const [lastSoldPlayer, setLastSoldPlayer] = useState(null);
  const [showReadinessErrors, setShowReadinessErrors] = useState(false);
  const [readinessErrors, setReadinessErrors] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalData, setErrorModalData] = useState(null);
  const [showManualCallModal, setShowManualCallModal] = useState(false);
  const [manualCallPlayerId, setManualCallPlayerId] = useState('');
  const [manualCallLoading, setManualCallLoading] = useState(false);
  const [showManualCallButton, setShowManualCallButton] = useState(() => {
    const saved = localStorage.getItem('auctionManualCallVisible');
    return saved !== null ? JSON.parse(saved) : true;
  });
  // eslint-disable-next-line no-unused-vars
  const [_customIncrements, _setCustomIncrements] = useState([100, 500, 1000, 5000]);
  // eslint-disable-next-line no-unused-vars
  const [_teamNotes, _setTeamNotes] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [_showTeamNotes, _setShowTeamNotes] = useState({});
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_comparisonPlayers] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [_showPlayerComparison] = useState(false);
  const [autoBidSettings, setAutoBidSettings] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [_showAutoBid] = useState({});
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [showAuctionSettings, setShowAuctionSettings] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_auctionBackups, setAuctionBackups] = useState([]); // Used in createBackup
  const [playerWishlist, setPlayerWishlist] = useState(() => {
    const saved = localStorage.getItem('playerWishlist');
    return saved ? JSON.parse(saved) : [];
  });
  const [showWishlist, setShowWishlist] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [commentary, setCommentary] = useState([]);
  const [commentaryInput, setCommentaryInput] = useState('');
  const [showCommentary, setShowCommentary] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_teamStrategies] = useState({});
  const [showStrategyBoard, setShowStrategyBoard] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_auctionStartTime] = useState(null);
  const [countdownTime, setCountdownTime] = useState(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Additional 30 features state
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return localStorage.getItem('auctionLanguage') || 'en';
  });
  const [voiceCommandsEnabled, setVoiceCommandsEnabled] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_recognition] = useState(null);
  const [gestureControlsEnabled, setGestureControlsEnabled] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_liveStreamUrl] = useState('');
  const [showLiveStream, setShowLiveStream] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_playerPhotos] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [_showPhotoGallery] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_selectedPlayerForGallery] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [_auctionTemplates, _setAuctionTemplates] = useState([]); // Reserved for future template feature
  // eslint-disable-next-line no-unused-vars
  const [_showTemplates] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_teamMetrics, setTeamMetrics] = useState({}); // Used in useEffect
  // eslint-disable-next-line no-unused-vars
  const [_showTeamMetrics] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [_bidAlerts] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [_showBidAlerts] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_auctionCalendar] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [_showCalendar] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_playerRankings, setPlayerRankings] = useState([]); // Used in useEffect
  const [showRankings, setShowRankings] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_archivedAuctions] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [_showArchive] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_liveScoreboard, setLiveScoreboard] = useState([]); // Used in useEffect
  const [showScoreboard, setShowScoreboard] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_playerRecommendations, setPlayerRecommendations] = useState({}); // Used in useEffect
  // eslint-disable-next-line no-unused-vars
  const [_showRecommendations] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [_customTimers, _setCustomTimers] = useState({}); // Reserved for future custom timer feature
  // eslint-disable-next-line no-unused-vars
  const [_bidWarDetected, setBidWarDetected] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_bidWarHistory, setBidWarHistory] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [_reportTemplates] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [_generatingReport, _setGeneratingReport] = useState(false); // Reserved for future report generation feature
  // eslint-disable-next-line no-unused-vars
  const [_pwaInstalled, setPwaInstalled] = useState(false);
  const [webhookUrl] = useState('');
  const [webhooksEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_recordingData, setRecordingData] = useState([]); // Used in useEffect
  // eslint-disable-next-line no-unused-vars
  const [_showRecording] = useState(false);
  const [budgetAlerts, setBudgetAlerts] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [_playerStatuses] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [_showPlayerStatus] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_analyticsData] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [_showAnalyticsDashboard] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_customRules, _setCustomRules] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [_showCustomRules] = useState(false);
  const [draftMode, setDraftMode] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_draftOrder] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [_formationSuggestions] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [_showFormationOptimizer] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_simulationData] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [_activeAdmins] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [_collaborationEnabled] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [_advancedFilters] = useState({
    priceRange: [0, 1000000],
    dateRange: null,
    teamFilter: [],
    statusFilter: []
  });
  // eslint-disable-next-line no-unused-vars
  const [_showAdvancedFilters] = useState(false);

  const socketRef = useRef(null);
  const isConnectingRef = useRef(false);
  const currentPlayerIdRef = useRef(null);
  const containerRef = useRef(null);
  // eslint-disable-next-line no-unused-vars
  const _audioRef = useRef(null); // Reserved for future audio features
  const refreshIntervalRef = useRef(null);
  const recognitionRef = useRef(null);
  // eslint-disable-next-line no-unused-vars
  const _recordingRef = useRef(null); // Reserved for future recording features
  const timerConfig = 30;

  const normalizeStatus = useCallback((value) => {
    if (!value && value !== 0) return 'stopped';
    const status = value.toString().toLowerCase();
    if (status === 'completed') return 'completed';
    if (status === 'running') return 'running';
    if (status === 'paused') return 'paused';
    if (status === 'notstarted') return 'stopped';
    return 'stopped';
  }, []);

  const fetchLiveData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [liveRes, teamsRes, summaryRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/auctions/live/${code}`, { headers }),
        axios.get(`${API_BASE_URL}/api/auctions/live-teams/${code}`, { headers }),
        axios.get(`${API_BASE_URL}/api/auctions/live-summary/${code}`, { headers }),
        axios.get(`${API_BASE_URL}/api/auctions/live-history/${code}`, { headers })
      ]);

      setTournament(liveRes.data.tournament);
      const nextStatus = normalizeStatus(liveRes.data.auctionStatus || liveRes.data.status);
      setAuctionStatus(nextStatus);
      setCurrentPlayer(liveRes.data.currentPlayer);
      setCurrentBid(liveRes.data.currentBid || 0);
      setTeams(teamsRes.data.teams || []);
      const summaryData = summaryRes.data.summary || {};
      setSummary({
        totalPlayers: summaryData.totalPlayers || 0,
        auctioned: summaryData.auctioned || 0,
        remaining: summaryData.remaining || 0,
        unsold: summaryData.unsold !== undefined && summaryData.unsold !== null ? summaryData.unsold : 0,
        pending: summaryData.pending !== undefined && summaryData.pending !== null ? summaryData.pending : 0
      });
      setHistory(historyRes.data.players || []);

      const highestBidderName = liveRes.data.highestBidderName;
      if (highestBidderName && teamsRes.data.teams) {
        const leading = teamsRes.data.teams.find(t => t.name === highestBidderName);
        setLeadingTeam(leading || null);
      } else {
        setLeadingTeam(null);
      }

      // Extract bid history per team from current player
      if (liveRes.data.currentPlayer?.bidHistory) {
        const historyByTeam = {};
        liveRes.data.currentPlayer.bidHistory.forEach((bid) => {
          if (bid.bidder && bid.bidderName) {
            const teamId = String(bid.bidder);
            if (!historyByTeam[teamId]) {
              historyByTeam[teamId] = [];
            }
            historyByTeam[teamId].push({
              amount: bid.amount,
              timestamp: bid.timestamp || bid.createdAt,
              playerName: liveRes.data.currentPlayer.name
            });
          }
        });
        setTeamBidHistory(historyByTeam);
      } else {
        setTeamBidHistory({});
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching live data:', err);
      toast.error('Failed to fetch auction data');
      setLoading(false);
    }
  }, [code, normalizeStatus]);

  // Sound notification functions
  const playSound = useCallback((type) => {
    if (!soundEnabled || typeof Audio === 'undefined') return;
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      switch(type) {
        case 'bid':
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.2);
          break;
        case 'timer':
          oscillator.frequency.value = 600;
          oscillator.type = 'square';
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
          break;
        case 'sold':
          oscillator.frequency.value = 1000;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Error playing sound:', err);
    }
  }, [soundEnabled]);

  const determineBidIncrement = useCallback((amount) => {
    if (!tournament?.auctionRules) {
      // Default fallback if no tournament rules
      return 100;
    }

    const auctionRules = tournament.auctionRules;

    // Check for slab-based increments
    if (auctionRules.type === 'slab' && Array.isArray(auctionRules.ranges)) {
      const ranges = auctionRules.ranges
        .filter((range) => typeof range === 'object' && range !== null)
        .map((range) => ({
          from: typeof range.from === 'number' ? range.from : 0,
          to: typeof range.to === 'number' ? range.to : Number.MAX_SAFE_INTEGER,
          increment: typeof range.increment === 'number' && range.increment > 0 ? range.increment : 0
        }))
        .sort((a, b) => a.from - b.from);

      const matchedRange = ranges.find(
        (range) => amount >= range.from && amount <= range.to
      );

      if (matchedRange && matchedRange.increment > 0) {
        return matchedRange.increment;
      }
    }

    // Check for fixed increment
    if (auctionRules.fixedIncrement && auctionRules.fixedIncrement > 0) {
      return auctionRules.fixedIncrement;
    }

    // Default fallback
    return 100;
  }, [tournament]);

  const calculateNextBid = useCallback(() => {
    if (!currentBid || currentBid === 0) {
      // First bid should be the base price itself, not base price + increment
      const basePrice = currentPlayer?.basePrice || 0;
      return basePrice;
    }
    // After first bid, add increment to current bid
    const increment = determineBidIncrement(currentBid);
    return currentBid + increment;
  }, [currentBid, currentPlayer, determineBidIncrement]);

  const handleToggleTimer = async () => {
    try {
      const token = localStorage.getItem('token');
      const currentTimerEnabled = tournament?.auctionAdvancedSettings?.timerEnabled !== false;
      const newTimerEnabled = !currentTimerEnabled;
      
      await axios.put(`${API_BASE_URL}/api/tournaments/${code}/auction-advanced-settings`, {
        settings: {
          timerEnabled: newTimerEnabled
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local tournament state
      setTournament(prev => ({
        ...prev,
        auctionAdvancedSettings: {
          ...prev?.auctionAdvancedSettings,
          timerEnabled: newTimerEnabled
        }
      }));
      
      toast.success(newTimerEnabled ? 'Timer enabled' : 'Timer disabled');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update timer setting');
    }
  };

  const handleTimerDurationChange = async (e) => {
    const newDuration = parseInt(e.target.value, 10);
    if (isNaN(newDuration) || newDuration < 3 || newDuration > 120) {
      toast.error('Invalid timer duration');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      await axios.put(`${API_BASE_URL}/api/tournaments/${code}/auction-advanced-settings`, {
        settings: {
          timerSeconds: newDuration
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local tournament state
      setTournament(prev => ({
        ...prev,
        auctionAdvancedSettings: {
          ...prev?.auctionAdvancedSettings,
          timerSeconds: newDuration
        }
      }));
      
      toast.success(`Timer duration set to ${newDuration}s`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update timer duration');
      // Revert select value on error
      e.target.value = tournament?.auctionAdvancedSettings?.timerSeconds || 10;
    }
  };

  const handlePauseAuction = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/pause`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Auction paused');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to pause auction');
    }
  }, [code]);

  const handleResumeAuction = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/resume`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Auction resumed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resume auction');
    }
  }, [code]);

  const handleNextPlayer = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/next`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Next player loaded');
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to load next player';
      const errorCode = err.response?.data?.code;
      const errorDetails = err.response?.data?.details;
      
      // Show detailed error in modal popup for errors with details
      if (errorCode === 'NO_AVAILABLE_PLAYERS' || errorCode === 'CURRENT_PLAYER_ACTIVE') {
        setErrorModalData({
          title: errorCode === 'NO_AVAILABLE_PLAYERS' ? 'No Available Players' : 'Current Player Active',
          message: errorMessage,
          code: errorCode,
          details: errorDetails
        });
        setShowErrorModal(true);
      } else {
        toast.error(errorMessage, { autoClose: 5000 });
      }
      console.error('Error loading next player:', err.response?.data || err.message);
    }
  }, [code]);

  const handleManualCallPlayer = useCallback(async () => {
    if (!manualCallPlayerId || manualCallPlayerId.trim() === '') {
      toast.error('Please enter a player ID');
      return;
    }

    setManualCallLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/call-player`, 
        { playerId: manualCallPlayerId.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Player called successfully');
      setShowManualCallModal(false);
      setManualCallPlayerId('');
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to call player';
      const errorCode = err.response?.data?.code;
      
      if (errorCode === 'CURRENT_PLAYER_ACTIVE' || errorCode === 'PLAYER_NOT_FOUND' || errorCode === 'PLAYER_NOT_AVAILABLE') {
        toast.error(errorMessage, { autoClose: 5000 });
      } else {
        toast.error(errorMessage, { autoClose: 5000 });
      }
      console.error('Error calling player:', err.response?.data || err.message);
    } finally {
      setManualCallLoading(false);
    }
  }, [code, manualCallPlayerId]);

  const toggleManualCallVisibility = useCallback(() => {
    const newVisibility = !showManualCallButton;
    setShowManualCallButton(newVisibility);
    localStorage.setItem('auctionManualCallVisible', JSON.stringify(newVisibility));
  }, [showManualCallButton]);

  const handleMarkSold = useCallback(() => {
    setShowMarkSoldConfirm(true);
  }, []);

  const confirmMarkSold = useCallback(async () => {
    setShowMarkSoldConfirm(false);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/sold`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player marked as sold');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark player as sold');
    }
  }, [code]);

  const handleUndoBid = useCallback(() => {
    if (!currentPlayer || !currentBid || currentBid === 0) {
      toast.warning('No bid to undo');
      return;
    }
    setShowUndoBidConfirm(true);
  }, [currentPlayer, currentBid]);

  const confirmUndoBid = useCallback(async () => {
    setShowUndoBidConfirm(false);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/undo-bid`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Last bid undone');
      if (soundEnabled) playSound('undo');
      fetchLiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to undo bid');
    }
  }, [code, soundEnabled, playSound, fetchLiveData]);

  const handleTeamBid = useCallback(async (teamId, customAmount = null) => {
    if (!currentPlayer || auctionStatus !== 'running') return;
    try {
      const token = localStorage.getItem('token');
      const payload = { teamId };
      if (customAmount) {
        payload.amount = customAmount;
      }
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/bid`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const team = teams.find(t => t._id === teamId);
      toast.success(`Bid placed for ${team?.name || 'Team'}`);
      if (soundEnabled) playSound('bid');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place bid');
    }
  }, [currentPlayer, auctionStatus, code, teams, soundEnabled, playSound]);

  // Keep currentPlayerIdRef in sync with currentPlayer
  useEffect(() => {
    currentPlayerIdRef.current = currentPlayer?._id || null;
  }, [currentPlayer]);

  useEffect(() => {
    fetchLiveData();

    const token = localStorage.getItem('token');
    if (!token) return;

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      return;
    }

    // Clean up existing socket if it exists
    if (socketRef.current) {
      // Wait a bit if socket is still connecting to avoid premature disconnect
      if (socketRef.current.connecting) {
        setTimeout(() => {
          if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
            socketRef.current = null;
          }
          isConnectingRef.current = false;
        }, 100);
      } else {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }

    isConnectingRef.current = true;
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: false, // Reuse existing connection if available
      auth: { token }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      isConnectingRef.current = false;
      setIsConnected(true);
      fetchLiveData();
    });

    socket.on('disconnect', () => {
      isConnectingRef.current = false;
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      isConnectingRef.current = false;
      setIsConnected(false);
      const errorMessage = error.message || String(error);
      // Suppress WebSocket connection errors that occur during cleanup/reconnection
      if (!errorMessage.includes('WebSocket is closed') && 
          !errorMessage.includes('closed before the connection is established') &&
          !errorMessage.includes('401') && 
          !errorMessage.includes('Unauthorized') &&
          !errorMessage.includes('Insufficient resources')) {
        console.error('Socket connection error:', error);
        toast.error('Failed to connect to auction server. Please refresh the page.', { autoClose: 5000 });
      }
    });

    socket.on('error', (error) => {
      isConnectingRef.current = false;
      console.error('Socket error:', error);
      // Handle socket errors silently unless it's a critical error
    });

    socket.on('auction:start', () => {
      setAuctionStatus('running');
      setTimer(timerConfig);
      fetchLiveData();
      toast.success('Auction started');
    });

    socket.on('player:next', (payload) => {
      if (payload.player) {
        setCurrentPlayer(payload.player);
        setCurrentBid(payload.player.basePrice || 0);
        setLeadingTeam(null);
      }
      setAuctionStatus('running');
      setTimer(payload.timerSeconds || timerConfig);
      fetchLiveData();
    });

    socket.on('bid:update', (payload) => {
      // Use a ref to get the latest currentPlayer value without adding it to dependencies
      if (currentPlayerIdRef.current === payload.playerId) {
        setCurrentBid(payload.bidAmount);
        setTimer(payload.timerSeconds || timerConfig);
        setBidUpdated(true);
        setTimeout(() => setBidUpdated(false), 500);
        fetchLiveData();
      }
    });

    socket.on('bid:placed', () => {
      fetchLiveData();
    });

    socket.on('auction:pause', () => {
      setAuctionStatus('paused');
      fetchLiveData();
    });

    socket.on('auction:resume', () => {
      setAuctionStatus('running');
      setTimer(timerConfig);
      fetchLiveData();
    });

    socket.on('player:sold', () => {
      setLeadingTeam(null);
      setCurrentPlayer(null);
      setCurrentBid(0);
      if (soundEnabled) playSound('sold');
      toast.success('Player sold!', { autoClose: 2000 });
      fetchLiveData();
    });

    socket.on('auction:end', () => {
      setAuctionStatus('completed');
      setCurrentPlayer(null);
      fetchLiveData();
    });

    return () => {
      isConnectingRef.current = false;
      if (socketRef.current) {
        // Remove all listeners before disconnecting to prevent errors
        socketRef.current.removeAllListeners();
        // Only disconnect if socket is connected or connecting
        if (socketRef.current.connected || socketRef.current.connecting) {
          socketRef.current.disconnect();
        }
        socketRef.current = null;
      }
    };
  }, [code, fetchLiveData, timerConfig, soundEnabled, playSound]);

  useEffect(() => {
    let interval;
    if (auctionStatus === 'running' && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => {
          const newTimer = prev > 0 ? prev - 1 : 0;
          if (newTimer === 5 && soundEnabled) {
            playSound('timer');
          }
          if (newTimer === 0 && soundEnabled) {
            playSound('timer');
          }
          return newTimer;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [auctionStatus, timer, soundEnabled, playSound]);

  // Digital clock - update every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Auto-refresh functionality - more frequent for accurate data
  useEffect(() => {
    if (autoRefresh && isConnected) {
      refreshIntervalRef.current = setInterval(() => {
        fetchLiveData(true);
      }, auctionStatus === 'running' ? 1000 : 3000); // Refresh every 1 second when running, 3 seconds otherwise
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, isConnected, fetchLiveData, auctionStatus]);

  // Save sound preference
  useEffect(() => {
    localStorage.setItem('auctionSoundEnabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  // Fullscreen functionality
  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    const element = containerRef.current || document.getElementById('auction-page-container') || document.documentElement;
    const doc = document;
    const isActive = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

    if (!isActive && element) {
      const request = element.requestFullscreen
        || element.webkitRequestFullscreen
        || element.mozRequestFullScreen
        || element.msRequestFullscreen;
      if (request) {
        request.call(element).catch(err => {
          console.error('Error entering fullscreen:', err);
        });
      }
    } else {
      const exit = doc.exitFullscreen
        || doc.webkitExitFullscreen
        || doc.mozCancelFullScreen
        || doc.msExitFullscreen;
      if (exit) {
        exit.call(doc).catch(err => {
          console.error('Error exiting fullscreen:', err);
        });
      }
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const doc = document;
    const updateState = () => {
      const active = doc.fullscreenElement
        || doc.webkitFullscreenElement
        || doc.mozFullScreenElement
        || doc.msFullscreenElement;
      // Set fullscreen state if any element is in fullscreen
      // This works whether fullscreen was triggered by our button or browser controls (F11, ESC, etc.)
      setIsFullscreen(Boolean(active));
    };

    setCanFullscreen(Boolean(
      doc.fullscreenEnabled
      || doc.webkitFullscreenEnabled
      || doc.mozFullScreenEnabled
      || doc.msFullscreenEnabled
    ));

    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    events.forEach((eventName) => doc.addEventListener(eventName, updateState));
    // Initial state check
    updateState();

    return () => {
      events.forEach((eventName) => doc.removeEventListener(eventName, updateState));
    };
  }, []);

  const toggleTeamHistory = (teamId) => {
    setExpandedTeamHistory(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  // Fetch all players for search/filter
  const fetchAllPlayers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API_BASE_URL}/api/auctions/live-history/${code}`, { headers });
      setAllPlayers(response.data.players || []);
    } catch (err) {
      console.error('Error fetching all players:', err);
    }
  }, [code]);

  // Calculate bid statistics
  const calculateBidStats = useCallback(() => {
    if (!currentPlayer?.bidHistory || currentPlayer.bidHistory.length === 0) {
      setBidStats({
        totalBids: 0,
        averageBid: 0,
        highestBid: 0,
        bidsByTeam: {},
        bidsByTime: []
      });
      return;
    }

    const bids = currentPlayer.bidHistory;
    const totalBids = bids.length;
    const totalAmount = bids.reduce((sum, bid) => sum + (bid.amount || 0), 0);
    const averageBid = totalAmount / totalBids;
    const highestBid = Math.max(...bids.map(bid => bid.amount || 0));
    
    const bidsByTeam = {};
    bids.forEach(bid => {
      const teamName = bid.bidderName || 'Unknown';
      if (!bidsByTeam[teamName]) {
        bidsByTeam[teamName] = { count: 0, total: 0 };
      }
      bidsByTeam[teamName].count++;
      bidsByTeam[teamName].total += bid.amount || 0;
    });

    setBidStats({
      totalBids,
      averageBid,
      highestBid,
      bidsByTeam,
      bidsByTime: bids.slice().reverse()
    });
  }, [currentPlayer]);

  useEffect(() => {
    calculateBidStats();
  }, [calculateBidStats]);

  useEffect(() => {
    fetchAllPlayers();
  }, [fetchAllPlayers]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch(e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (auctionStatus === 'running' && currentPlayer && leadingTeam) {
            // Space to bid with leading team (if available)
            const nextBidAmount = calculateNextBid();
            const canBidTeam = teams.find(t => {
              const totalSpent = t.totalSpent || t.budgetUsed || 0;
              const budget = t.budget || 100000;
              const remaining = t.budgetBalance || t.currentBalance || Math.max(0, budget - totalSpent);
              return !leadingTeam || (String(t._id) !== String(leadingTeam._id) && remaining >= nextBidAmount);
            });
            if (canBidTeam) {
              handleTeamBid(canBidTeam._id);
            }
          }
          break;
        case 'n':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleNextPlayer();
          }
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (auctionStatus === 'running') {
              handleMarkSold();
            }
          }
          break;
        case 'p':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (auctionStatus === 'running') {
              handlePauseAuction();
            } else if (auctionStatus === 'paused') {
              handleResumeAuction();
            }
          }
          break;
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (canFullscreen) {
              toggleFullscreen();
            }
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [auctionStatus, currentPlayer, leadingTeam, teams, canFullscreen, toggleFullscreen, handleNextPlayer, handleMarkSold, handlePauseAuction, handleResumeAuction, calculateNextBid, handleTeamBid]);

  // Filtering removed - showing all players

  // Export/Print functions
  const handleExportData = (format = 'json') => {
    const data = {
      tournament: tournament?.name,
      code: tournament?.code,
      status: auctionStatus,
      currentPlayer: currentPlayer,
      teams: teams,
      history: history,
      summary: summary,
      timestamp: new Date().toISOString()
    };
    
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auction-${code}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exported as JSON');
    } else if (format === 'csv') {
      // CSV export
      let csv = 'Player Name,Role,City,Status,Sold Price,Sold To\n';
      history.forEach(player => {
        csv += `"${player.name || ''}","${player.role || ''}","${player.city || ''}","${player.auctionStatus || ''}","${player.soldPrice || ''}","${player.soldToName || ''}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auction-${code}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exported as CSV');
    } else if (format === 'excel') {
      // Excel-like export (CSV with .xlsx extension suggestion)
      let csv = 'Player Name,Role,City,Status,Sold Price,Sold To\n';
      history.forEach(player => {
        csv += `"${player.name || ''}","${player.role || ''}","${player.city || ''}","${player.auctionStatus || ''}","${player.soldPrice || ''}","${player.soldToName || ''}"\n`;
      });
      const blob = new Blob([csv], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auction-${code}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exported as Excel');
    } else if (format === 'pdf') {
      // PDF export using html2canvas and jsPDF
      import('html2canvas').then(html2canvas => {
        import('jspdf').then(jsPDF => {
          const element = document.querySelector('.auction-new-container');
          html2canvas.default(element).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF.default('p', 'mm', 'a4');
            const imgWidth = 210;
            const pageHeight = 295;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;
            
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            
            while (heightLeft >= 0) {
              position = heightLeft - imgHeight;
              pdf.addPage();
              pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
              heightLeft -= pageHeight;
            }
            
            pdf.save(`auction-${code}-${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success('Data exported as PDF');
          });
        });
      });
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  // Bid prediction
  const calculateBidPrediction = useCallback(() => {
    if (!currentPlayer || !currentPlayer.bidHistory || currentPlayer.bidHistory.length < 2) {
      setBidPrediction(null);
      return;
    }
    
    const bids = currentPlayer.bidHistory.map(b => b.amount);
    const recentBids = bids.slice(-5);
    const avgIncrement = recentBids.length > 1 
      ? (recentBids[recentBids.length - 1] - recentBids[0]) / (recentBids.length - 1)
      : 500;
    
    const timeRemaining = timer;
    const estimatedBids = Math.ceil(timeRemaining / 3); // Assume bid every 3 seconds
    const predictedFinal = currentBid + (avgIncrement * estimatedBids);
    
    setBidPrediction({
      current: currentBid,
      predicted: Math.round(predictedFinal),
      confidence: Math.min(estimatedBids * 10, 85),
      estimatedBids
    });
  }, [currentPlayer, currentBid, timer]);

  useEffect(() => {
    if (showBidPrediction && currentPlayer) {
      calculateBidPrediction();
    }
  }, [showBidPrediction, currentPlayer, currentBid, timer, calculateBidPrediction]);

  // Theme management
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('auctionTheme', currentTheme);
  }, [currentTheme]);

  // Wishlist functions
  const toggleWishlist = (playerId) => {
    setPlayerWishlist(prev => {
      const newList = prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId];
      localStorage.setItem('playerWishlist', JSON.stringify(newList));
      return newList;
    });
  };

  // QR Code generation
  const generateQRCode = () => {
    const auctionUrl = `${window.location.origin}/tournament/${code}/auction`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(auctionUrl)}`;
    setQrCodeUrl(qrApiUrl);
    setShowQRCode(true);
  };


  // Commentary functions
  const addCommentary = () => {
    if (!commentaryInput.trim()) return;
    const newComment = {
      id: Date.now(),
      text: commentaryInput,
      timestamp: new Date(),
      player: currentPlayer?.name || 'General'
    };
    setCommentary(prev => [...prev, newComment]);
    setCommentaryInput('');
    if (socketRef.current) {
      socketRef.current.emit('commentary:add', newComment);
    }
  };

  // Auto-bid functions
  // eslint-disable-next-line no-unused-vars
  const _setAutoBid = (teamId, maxBid) => {
    setAutoBidSettings(prev => ({
      ...prev,
      [teamId]: { maxBid, enabled: true }
    }));
    toast.success(`Auto-bid enabled: Max ₹${maxBid.toLocaleString('en-IN')}`);
  };

  useEffect(() => {
    if (auctionStatus === 'running' && currentPlayer && Object.keys(autoBidSettings).length > 0) {
      Object.entries(autoBidSettings).forEach(([teamId, settings]) => {
        if (settings.enabled && currentBid < settings.maxBid) {
          const nextBid = calculateNextBid();
          if (nextBid <= settings.maxBid) {
            const team = teams.find(t => String(t._id) === String(teamId));
            if (team) {
              const totalSpent = team.totalSpent || team.budgetUsed || 0;
              const budget = team.budget || 100000;
              const remaining = team.budgetBalance || team.currentBalance || Math.max(0, budget - totalSpent);
              if (remaining >= nextBid) {
                handleTeamBid(teamId);
              }
            }
          }
        }
      });
    }
  }, [currentBid, auctionStatus, currentPlayer, autoBidSettings, teams, calculateNextBid, handleTeamBid]);

  // Backup/Restore functions
  const createBackup = () => {
    const backup = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      tournament: tournament,
      currentPlayer: currentPlayer,
      teams: teams,
      history: history,
      summary: summary,
      auctionStatus: auctionStatus,
      currentBid: currentBid
    };
    setAuctionBackups(prev => {
      const newBackups = [backup, ...prev].slice(0, 10); // Keep last 10 backups
      localStorage.setItem(`auctionBackups_${code}`, JSON.stringify(newBackups));
      return newBackups;
    });
    toast.success('Backup created successfully');
  };

  // restoreBackup function reserved for future API support
  // const restoreBackup = (backup) => {
  //   if (window.confirm('Are you sure you want to restore this backup? This will overwrite current data.')) {
  //     // Restore logic would need API support
  //     toast.info('Backup restore requires API support');
  //   }
  // };

  // Notification history
  useEffect(() => {
    const addNotification = (message, type = 'info') => {
      setNotificationHistory(prev => [{
        id: Date.now(),
        message,
        type,
        timestamp: new Date()
      }, ...prev].slice(0, 100));
    };

    // Listen for socket events to add notifications
    if (socketRef.current) {
      socketRef.current.on('bid:update', () => {
        addNotification('New bid placed', 'bid');
      });
      socketRef.current.on('player:sold', () => {
        addNotification('Player sold!', 'success');
      });
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdownTime && new Date(countdownTime) > new Date()) {
      const interval = setInterval(() => {
        const now = new Date();
        const target = new Date(countdownTime);
        const diff = target - now;
        if (diff <= 0) {
          setCountdownTime(null);
          setShowCountdown(false);
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [countdownTime]);

  // Multi-language support
  useEffect(() => {
    i18n.changeLanguage(currentLanguage);
    localStorage.setItem('auctionLanguage', currentLanguage);
  }, [currentLanguage, i18n]);

  // Voice commands
  useEffect(() => {
    if (!voiceCommandsEnabled) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.warning('Speech recognition is not supported in your browser.', { autoClose: 3000 });
      setVoiceCommandsEnabled(false);
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = currentLanguage === 'ml' ? 'ml-IN' : 'en-US';

      recognition.onresult = (event) => {
        const last = event.results.length - 1;
        const command = event.results[last][0].transcript.toLowerCase();
        
        if (command.includes('bid') || command.includes('place bid')) {
          if (auctionStatus === 'running' && currentPlayer) {
            const canBidTeam = teams.find(t => {
              const totalSpent = t.totalSpent || t.budgetUsed || 0;
              const budget = t.budget || 100000;
              const remaining = t.budgetBalance || t.currentBalance || Math.max(0, budget - totalSpent);
              return remaining >= calculateNextBid();
            });
            if (canBidTeam) handleTeamBid(canBidTeam._id);
          }
        } else if (command.includes('next') || command.includes('next player')) {
          handleNextPlayer();
        } else if (command.includes('sold') || command.includes('mark sold')) {
          if (auctionStatus === 'running') handleMarkSold();
        } else if (command.includes('pause')) {
          if (auctionStatus === 'running') handlePauseAuction();
        } else if (command.includes('resume')) {
          if (auctionStatus === 'paused') handleResumeAuction();
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          toast.warning('Microphone permission denied. Please enable microphone access in your browser settings to use voice commands.', { autoClose: 5000 });
          setVoiceCommandsEnabled(false);
        } else if (event.error === 'no-speech') {
          // Silently handle no-speech errors as they're common
        } else if (event.error === 'aborted') {
          // Silently handle aborted errors
        } else {
          toast.error(`Speech recognition error: ${event.error}`, { autoClose: 3000 });
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (error) {
      console.error('Error initializing speech recognition:', error);
      toast.error('Failed to initialize voice commands. Please try again.', { autoClose: 3000 });
      setVoiceCommandsEnabled(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [voiceCommandsEnabled, currentLanguage, auctionStatus, currentPlayer, teams, calculateNextBid, handleTeamBid, handleNextPlayer, handleMarkSold, handlePauseAuction, handleResumeAuction]);

  // Gesture controls (touch/swipe)
  useEffect(() => {
    if (!gestureControlsEnabled) return;

    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
      if (!touchStartX || !touchStartY) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const diffX = touchStartX - touchEndX;
      const diffY = touchStartY - touchEndY;

      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 50) {
          // Swipe left - Next player
          handleNextPlayer();
        } else if (diffX < -50) {
          // Swipe right - Previous (if available)
        }
      } else {
        if (diffY > 50) {
          // Swipe up - Place bid
          if (auctionStatus === 'running' && currentPlayer) {
            const canBidTeam = teams.find(t => {
              const totalSpent = t.totalSpent || t.budgetUsed || 0;
              const budget = t.budget || 100000;
              const remaining = t.budgetBalance || t.currentBalance || Math.max(0, budget - totalSpent);
              return remaining >= calculateNextBid();
            });
            if (canBidTeam) handleTeamBid(canBidTeam._id);
          }
        }
      }

      touchStartX = 0;
      touchStartY = 0;
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gestureControlsEnabled, auctionStatus, currentPlayer, teams, calculateNextBid, handleTeamBid, handleNextPlayer]);

  // Bid war detection
  useEffect(() => {
    if (!currentPlayer?.bidHistory || currentPlayer.bidHistory.length < 3) {
      setBidWarDetected(false);
      return;
    }

    const recentBids = currentPlayer.bidHistory.slice(-5);
    const timeWindow = 10; // seconds
    const bidCount = recentBids.length;
    
    if (bidCount >= 3) {
      const firstBidTime = new Date(recentBids[0].timestamp || Date.now());
      const lastBidTime = new Date(recentBids[recentBids.length - 1].timestamp || Date.now());
      const timeDiff = (lastBidTime - firstBidTime) / 1000;
      
      if (timeDiff <= timeWindow) {
        setBidWarDetected(true);
        setBidWarHistory(prev => [...prev, {
          playerId: currentPlayer._id,
          playerName: currentPlayer.name,
          bidCount,
          timestamp: new Date()
        }]);
        toast.warning('🔥 Bid War Detected!', { autoClose: 3000 });
        if (soundEnabled) playSound('bid');
      } else {
        setBidWarDetected(false);
      }
    }
  }, [currentPlayer, soundEnabled, playSound]);

  // Budget alerts
  useEffect(() => {
    teams.forEach(team => {
      const totalSpent = team.totalSpent || team.budgetUsed || 0;
      const budget = team.budget || 100000;
      const spentPercent = (totalSpent / budget) * 100;
      
      if (spentPercent >= 90) {
        setBudgetAlerts(prev => {
          // Only update if not already critical to avoid duplicate toasts
          if (prev[team._id]?.critical) return prev;
          toast.error(`${team.name} has used ${Math.round(spentPercent)}% of budget!`, { autoClose: 5000 });
          return {
            ...prev,
            [team._id]: { critical: true, warning: false }
          };
        });
      } else if (spentPercent >= 75) {
        setBudgetAlerts(prev => {
          // Only update if not already warning to avoid duplicate toasts
          if (prev[team._id]?.warning) return prev;
          toast.warning(`${team.name} has used ${Math.round(spentPercent)}% of budget`, { autoClose: 4000 });
          return {
            ...prev,
            [team._id]: { critical: false, warning: true }
          };
        });
      }
    });
  }, [teams]);

  // Live scoreboard calculation
  useEffect(() => {
    const scoreboard = teams.map(team => {
      const totalSpent = team.totalSpent || team.budgetUsed || 0;
      const playersCount = team.playersBought || team.playersCount || 0;
      const avgPrice = playersCount > 0 ? totalSpent / playersCount : 0;
      const budget = team.budget || 100000;
      const remaining = team.budgetBalance || team.currentBalance || Math.max(0, budget - totalSpent);
      
      return {
        teamId: team._id,
        teamName: team.name,
        players: playersCount,
        spent: totalSpent,
        remaining,
        avgPrice,
        score: playersCount * 100 + (remaining / 1000) // Simple scoring
      };
    }).sort((a, b) => b.score - a.score);
    
    setLiveScoreboard(scoreboard);
  }, [teams]);

  // Player recommendations (simple algorithm)
  useEffect(() => {
    if (!currentPlayer || !teams.length) return;
    
    const recommendations = {};
    teams.forEach(team => {
      const totalSpent = team.totalSpent || team.budgetUsed || 0;
      const budget = team.budget || 100000;
      const remaining = team.budgetBalance || team.currentBalance || Math.max(0, budget - totalSpent);
      const playersCount = team.playersBought || team.playersCount || 0;
      
      // Simple recommendation: if player fits budget and team needs players
      const recommended = remaining >= (currentPlayer.basePrice || 1000) && playersCount < 15;
      recommendations[team._id] = {
        recommended,
        reason: recommended ? 'Fits budget and team needs players' : 'Budget constraint or team full',
        confidence: recommended ? 75 : 25
      };
    });
    
    setPlayerRecommendations(recommendations);
  }, [currentPlayer, teams]);

  // Auction recording
  useEffect(() => {
    if (isRecording && auctionStatus === 'running') {
      const recordEvent = {
        timestamp: new Date().toISOString(),
        type: 'bid',
        player: currentPlayer,
        bid: currentBid,
        leadingTeam: leadingTeam
      };
      setRecordingData(prev => [...prev, recordEvent]);
    }
  }, [isRecording, auctionStatus, currentPlayer, currentBid, leadingTeam]);

  // Custom timer per player - reserved for future use
  // const getPlayerTimer = useCallback(() => {
  //   if (currentPlayer && customTimers[currentPlayer._id]) {
  //     return customTimers[currentPlayer._id];
  //   }
  //   return timerConfig;
  // }, [currentPlayer, customTimers, timerConfig]);

  // Save auction template - reserved for future use
  // const saveAuctionTemplate = () => {
  //   const template = {
  //     id: Date.now(),
  //     name: `Template ${new Date().toLocaleString()}`,
  //     tournament: tournament,
  //     settings: {
  //       timerConfig,
  //       customIncrements,
  //       customRules
  //     },
  //     timestamp: new Date().toISOString()
  //   };
  //   setAuctionTemplates(prev => {
  //     const newTemplates = [template, ...prev].slice(0, 20);
  //     localStorage.setItem(`auctionTemplates_${code}`, JSON.stringify(newTemplates));
  //     return newTemplates;
  //   });
  //   toast.success('Template saved');
  // };

  // Load auction template - reserved for future use
  // const loadAuctionTemplate = (template) => {
  //   if (window.confirm('Load this template? This will apply saved settings.')) {
  //     setCustomIncrements(template.settings.customIncrements || [100, 500, 1000, 5000]);
  //     setCustomRules(template.settings.customRules || {});
  //     toast.success('Template loaded');
  //   }
  // };

  // Generate automated report - reserved for future use
  // const generateAutomatedReport = async () => {
  //   setGeneratingReport(true);
  //   try {
  //     const report = {
  //       tournament: tournament?.name,
  //       code: tournament?.code,
  //       date: new Date().toISOString(),
  //       summary: {
  //         totalPlayers: summary.totalPlayers,
  //         auctioned: summary.auctioned,
  //         remaining: summary.remaining,
  //         totalRevenue: teams.reduce((sum, t) => sum + (t.totalSpent || 0), 0)
  //       },
  //       teams: teams.map(team => ({
  //         name: team.name,
  //         players: team.playersBought || 0,
  //         spent: team.totalSpent || 0,
  //         remaining: team.budgetBalance || team.currentBalance || 0
  //       })),
  //       topPlayers: history.slice(0, 10).filter(p => p.auctionStatus === 'Sold')
  //     };
  //     
  //     // Export as JSON for now
  //     const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  //     const url = URL.createObjectURL(blob);
  //     const a = document.createElement('a');
  //     a.href = url;
  //     a.download = `auction-report-${code}-${new Date().toISOString().split('T')[0]}.json`;
  //     document.body.appendChild(a);
  //     a.click();
  //     document.body.removeChild(a);
  //     URL.revokeObjectURL(url);
  //     
  //     toast.success('Report generated');
  //   } catch (err) {
  //     toast.error('Failed to generate report');
  //   } finally {
  //     setGeneratingReport(false);
  //   }
  // };

  // PWA installation
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    }
    
    // Reserved for future PWA installation feature
    // let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      // deferredPrompt = e;
      setPwaInstalled(false);
    });
  }, []);

  // Webhook integration
  const sendWebhook = useCallback(async (event, data) => {
    if (!webhooksEnabled || !webhookUrl) return;
    
    try {
      await axios.post(webhookUrl, {
        event,
        tournamentCode: code,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Webhook error:', err);
    }
  }, [webhooksEnabled, webhookUrl, code]);

  // Send webhook on important events
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on('player:sold', () => {
        sendWebhook('player_sold', { player: currentPlayer, bid: currentBid });
      });
      socketRef.current.on('bid:update', () => {
        sendWebhook('bid_update', { player: currentPlayer, bid: currentBid });
      });
    }
  }, [sendWebhook, currentPlayer, currentBid]);

  // Player ranking calculation
  useEffect(() => {
    const rankings = allPlayers
      .filter(p => p.auctionStatus === 'Sold')
      .map(p => ({
        ...p,
        rankScore: (p.soldPrice || 0) + (p.bidHistory?.length || 0) * 100
      }))
      .sort((a, b) => b.rankScore - a.rankScore)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));
    
    setPlayerRankings(rankings);
  }, [allPlayers]);

  // Team metrics calculation
  useEffect(() => {
    const metrics = {};
    teams.forEach(team => {
      const totalSpent = team.totalSpent || team.budgetUsed || 0;
      const playersCount = team.playersBought || team.playersCount || 0;
      const budget = team.budget || 100000;
      const remaining = team.budgetBalance || team.currentBalance || Math.max(0, budget - totalSpent);
      
      metrics[team._id] = {
        efficiency: playersCount > 0 ? (totalSpent / playersCount) : 0,
        budgetUtilization: (totalSpent / budget) * 100,
        playersPerLakh: playersCount > 0 ? (playersCount / (totalSpent / 100000)) : 0,
        remainingBudget: remaining,
        avgPlayerValue: playersCount > 0 ? totalSpent / playersCount : 0
      };
    });
    setTeamMetrics(metrics);
  }, [teams]);

  const handleStartAuction = async (bypassReadiness = false) => {
    try {
      // Ensure bypassReadiness is always a boolean (defensive check)
      const shouldBypass = typeof bypassReadiness === 'boolean' ? bypassReadiness : false;
      
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/start`, {
        bypassReadiness: shouldBypass
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Auction started');
      setShowReadinessErrors(false);
      fetchLiveData();
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

  const handleMarkUnsold = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/mark-unsold`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player marked as unsold');
      fetchLiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark player as unsold');
    }
  };

  const handleEndAuction = () => {
    setShowEndAuctionConfirm(true);
  };

  const confirmEndAuction = async () => {
    setShowEndAuctionConfirm(false);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/end`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Auction ended');
      fetchLiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to end auction');
    }
  };

  const handleResetTimer = async () => {
    try {
      const timerSeconds = tournament?.auctionAdvancedSettings?.timerSeconds || 30;
      setTimer(timerSeconds);
      toast.success('Timer reset');
    } catch (err) {
      toast.error('Failed to reset timer');
    }
  };

  const handleShufflePlayers = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/shuffle-players`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Players shuffled');
      fetchLiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to shuffle players');
    }
  };

  const handleWithdrawPlayer = async () => {
    if (!currentPlayer) return;
    if (!window.confirm(`Are you sure you want to withdraw ${currentPlayer.name}?`)) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/withdraw`, {
        playerId: currentPlayer._id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player withdrawn');
      fetchLiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to withdraw player');
    }
  };

  const handleSkipPlayer = async () => {
    if (!currentPlayer) return;
    try {
      // Skip by moving to next player without marking as sold/unsold
      await handleNextPlayer();
      toast.success('Player skipped');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to skip player');
    }
  };

  const handleMoveToPending = async () => {
    if (!currentPlayer) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/auctions/${code}/pending`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player moved to pending');
      fetchLiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to move player to pending');
    }
  };

  const handleMovePendingToAvailable = () => {
    // Check if there are Available players left (remaining > pending means there are non-pending players)
    if (summary.remaining > summary.pending) {
      toast.warning('Please complete all available players first');
      return;
    }
    
    if (summary.pending === 0) {
      toast.info('No pending players to move');
      return;
    }

    setShowMovePendingConfirm(true);
  };

  const confirmMovePendingToAvailable = async () => {
    setShowMovePendingConfirm(false);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/auctions/${code}/pending-to-available`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message || 'Pending players moved to available');
      fetchLiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to move pending players to available');
    }
  };

  const handleMoveUnsoldToAvailable = () => {
    if (summary.unsold === 0) {
      toast.info('No unsold players to move');
      return;
    }

    setShowMoveUnsoldConfirm(true);
  };

  const confirmMoveUnsoldToAvailable = async () => {
    setShowMoveUnsoldConfirm(false);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/auctions/${code}/unsold-to-available`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message || 'Unsold players moved to available');
      fetchLiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to move unsold players to available');
    }
  };

  const handleRecallLastSold = async () => {
    try {
      // Try to get last sold player from history first
      const soldPlayers = history.filter(p => p.auctionStatus === 'Sold');
      let lastSold = null;
      
      if (soldPlayers.length > 0) {
        // Sort by soldAt descending to get the most recent
        const sortedSold = [...soldPlayers].sort((a, b) => {
          const dateA = a.soldAt ? new Date(a.soldAt) : new Date(0);
          const dateB = b.soldAt ? new Date(b.soldAt) : new Date(0);
          return dateB - dateA;
        });
        lastSold = sortedSold[0];
      }
      
      // If no sold players in history or missing data, fetch from API
      if (!lastSold || !lastSold.soldPrice) {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/auctions/live/${code}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Get sold players from the response
        const apiSoldPlayers = response.data.soldPlayers || [];
        if (apiSoldPlayers.length > 0) {
          const sortedApiSold = [...apiSoldPlayers].sort((a, b) => {
            const dateA = a.soldAt ? new Date(a.soldAt) : new Date(0);
            const dateB = b.soldAt ? new Date(b.soldAt) : new Date(0);
            return dateB - dateA;
          });
          lastSold = sortedApiSold[0];
        }
      }
      
      if (!lastSold) {
        toast.info('No sold players found');
        return;
      }
      
      // Ensure all fields are present
      setLastSoldPlayer({
        name: lastSold.name || 'Unknown Player',
        role: lastSold.role || '',
        soldPrice: lastSold.soldPrice || 0,
        soldToName: lastSold.soldToName || '',
        soldAt: lastSold.soldAt || null
      });
      setShowRecallLastSoldConfirm(true);
    } catch (err) {
      console.error('Error fetching last sold player:', err);
      toast.error('Failed to load last sold player information');
    }
  };

  const confirmRecallLastSold = async () => {
    setShowRecallLastSoldConfirm(false);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/auctions/${code}/recall-last-sold`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message || 'Last sold player recalled');
      setLastSoldPlayer(null);
      fetchLiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to recall last sold player');
    }
  };

  // Check if available players list is complete (all sold/unsold)
  // Button should be enabled when there are no Available players left
  // Since remaining includes Available, InAuction, Pending, and Withdrawn,
  // and we have pending count, we check if all remaining players are pending
  // (remaining === pending means no Available players left)
  const isAvailableListComplete = summary.remaining === summary.pending && summary.pending > 0;
  // Also show button if there are pending players (for testing/visibility)
  const hasPendingPlayers = (summary.pending || 0) > 0;
  const hasUnsoldPlayers = (summary.unsold || 0) > 0;
  // Check if there are sold players (for recall button)
  const hasSoldPlayers = history.some(p => p.auctionStatus === 'Sold') || (summary.auctioned || 0) > 0;

  // handleQuickBid - reserved for future use
  // const handleQuickBid = async (teamId, increment) => {
  //   const nextBid = currentBid + increment;
  //   await handleTeamBid(teamId, nextBid);
  // };

  const getImageUrl = (imagePath, defaultImage) => {
    if (!imagePath) return defaultImage || `${API_BASE_URL}/default-photo.png`;
    if (imagePath.startsWith('http')) return imagePath;
    if (imagePath.startsWith('/')) return `${API_BASE_URL}${imagePath}`;
    return `${API_BASE_URL}/${imagePath}`;
  };

  const statusLabel = {
    running: 'Running',
    paused: 'Paused',
    completed: 'Completed',
    stopped: 'Not Started'
  }[auctionStatus] || 'Unknown';

  // Memoize sold players list to prevent infinite loops
  // Must be called before any conditional returns (React Hooks rule)
  const recentSoldPlayers = useMemo(() => {
    return history
      .filter(p => p.auctionStatus === 'Sold' && p.soldAt)
      .sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt))
      .slice(0, 5);
  }, [history]);

  const toggleHeader = () => {
    const newVisibility = !headerVisible;
    setHeaderVisible(newVisibility);
    localStorage.setItem('auctionHeaderVisible', JSON.stringify(newVisibility));
  };

  if (loading) {
    return (
      <div className="auction-loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className={`auction-new-container ${isFullscreen ? 'fullscreen-mode' : ''}`} ref={containerRef}>
      {/* Header - Redesigned */}
      <div className="auction-header-new">
        {/* Top Row - Always Visible */}
        <div className="header-top-row">
          {/* Left: Tournament Branding */}
          <div className="header-brand-section">
            {tournament?.logo && (
              <img 
                src={getImageUrl(tournament.logo, `${API_BASE_URL}/default-logo.png`)}
                alt={tournament.name || 'Tournament Logo'}
                className="tournament-logo-header"
                onError={(e) => {
                  e.target.src = `${API_BASE_URL}/default-logo.png`;
                }}
              />
            )}
            <div className="header-brand-text">
              <div className="header-label">AUCTION CONTROL</div>
              <div className="header-tournament-name">{tournament?.name || 'Tournament'}</div>
            </div>
          </div>

          {/* Center: Status & Connection */}
          <div className="header-status-section">
            {/* Digital Clock */}
            <div className="header-digital-clock">
              <div className="clock-time">
                {currentTime.toLocaleTimeString('en-IN', { 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit',
                  hour12: false 
                })}
              </div>
              <div className="clock-date">
                {currentTime.toLocaleDateString('en-IN', { 
                  weekday: 'short', 
                  day: '2-digit', 
                  month: 'short' 
                })}
              </div>
            </div>
            <div className={`status-indicator-large ${auctionStatus}`}>
              <span className="status-dot-large"></span>
              <span className="status-text-large">{statusLabel}</span>
            </div>
            <div className={`connection-indicator-large ${isConnected ? 'connected' : 'disconnected'}`}>
              <span className="connection-dot-large">{isConnected ? '●' : '○'}</span>
              <span className="connection-text-large">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
            </div>
            {summary.totalPlayers > 0 && (
              <div className="player-status-indicator">
                <span className="player-status-label">Players</span>
                <span className="player-status-value">
                  {summary.auctioned || 0}/{summary.totalPlayers}
                </span>
              </div>
            )}
          </div>

          {/* Right: Quick Actions */}
          <div className="header-actions-section">
            <Link 
              to={`/tournament/${code}/live`} 
              className="header-action-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>📺</span>
              <span>Live Screen</span>
            </Link>
            <Link 
              to={`/live/${code}`} 
              className="header-action-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>🎯</span>
              <span>Live Auction</span>
            </Link>
            <Link 
              to={`/tournament/${code}/stream`} 
              className="header-action-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>📡</span>
              <span>Broadcast</span>
            </Link>
            <button
              className={`header-action-btn ${showTeamComparison ? 'active' : ''}`}
              onClick={() => setShowTeamComparison(!showTeamComparison)}
              title="Team Comparison"
            >
              <span>📊</span>
              <span>Team Comparison</span>
            </button>
            <Link 
              to={`/tournament/${code}/auction-results?tab=pending`}
              className="header-action-btn"
              target="_blank"
              rel="noopener noreferrer"
              title="View auction results and pending players"
            >
              <span>Result</span>
            </Link>
            {canFullscreen && (
              <button
                className={`header-action-btn fullscreen-btn ${isFullscreen ? 'active' : ''}`}
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen (Ctrl+F)' : 'Enter fullscreen (Ctrl+F)'}
              >
                <span>{isFullscreen ? '⤓' : '⤢'}</span>
              </button>
            )}
          </div>
          
          {/* Hide/Show Button */}
          <button 
            className="header-hide-btn"
            onClick={toggleHeader}
            title={headerVisible ? 'Hide Controls' : 'Show Controls'}
          >
            <span>{headerVisible ? '▼' : '▲'}</span>
          </button>
        </div>

        {/* Bottom Row - Hideable */}
        {headerVisible && (
        <div className="header-bottom-row">
          {/* Left: Controls */}
          <div className="header-controls-section">
            <button
              className={`header-control-btn ${soundEnabled ? 'active' : ''}`}
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Disable sounds' : 'Enable sounds'}
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
            <button
              className={`header-control-btn ${autoRefresh ? 'active' : ''}`}
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            >
              {autoRefresh ? '🔄' : '⏸'}
            </button>
            <div className="timer-control-wrapper">
              <button
                className={`header-control-btn ${tournament?.auctionAdvancedSettings?.timerEnabled !== false ? 'active' : ''}`}
                onClick={handleToggleTimer}
                title={tournament?.auctionAdvancedSettings?.timerEnabled !== false ? 'Disable timer' : 'Enable timer'}
              >
                ⏱️
              </button>
              <select
                className="timer-select"
                value={tournament?.auctionAdvancedSettings?.timerSeconds || 10}
                onChange={handleTimerDurationChange}
                title="Timer Duration"
                disabled={!tournament}
              >
                <option value={3}>3s</option>
                <option value={5}>5s</option>
                <option value={8}>8s</option>
                <option value={10}>10s</option>
              </select>
            </div>
          </div>

          {/* Right: Shortcuts */}
          <div className="header-shortcuts-section">
            <div className="shortcuts-label">SHORTCUTS</div>
            <div className="shortcuts-items">
              <div className="shortcut-badge"><kbd>Space</kbd> Bid</div>
              <div className="shortcut-badge"><kbd>Ctrl+N</kbd> Next</div>
              <div className="shortcut-badge"><kbd>Ctrl+S</kbd> Sold</div>
              <div className="shortcut-badge"><kbd>Ctrl+P</kbd> Pause</div>
              <div className="shortcut-badge"><kbd>Ctrl+F</kbd> Full</div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="auction-grid-new">
        {/* Left Column - Current Player */}
        <div className="auction-left-panel">
          {/* Current Player Card - Card Type with Bigger Image */}
          {currentPlayer ? (
            <div className="player-card-new">
              <div className="player-card-layout">
                {/* Player Image and Details */}
                <div className="player-info-section">
                  <div className="player-photo-section">
                    <img 
                      src={getImageUrl(currentPlayer.photo, `${API_BASE_URL}/default-photo.png`)}
                      alt={currentPlayer.name}
                      className="player-photo-new"
                      onClick={() => setShowEnlargedImage(true)}
                      style={{ cursor: 'pointer' }}
                    />
                    <div className="player-id-badge-circle">
                      {currentPlayer.playerId 
                        ? currentPlayer.playerId.includes('-') 
                          ? currentPlayer.playerId.split('-')[1] 
                          : currentPlayer.playerId
                        : 'N/A'}
                    </div>
                  </div>
                  <h2 className="player-name-new">{currentPlayer.name}</h2>
                  
                  {/* Recent Sales - Below Player Name */}
                  {recentSoldPlayers.length > 0 && (
                    <div className="recent-sales-section">
                      <div className="sold-history-header">
                        <span className="sold-history-title">RECENT SALES</span>
                      </div>
                      <div className="sold-history-list">
                        {recentSoldPlayers.map((player, index) => {
                          const displayPlayerId = player.playerId?.includes('-') 
                            ? player.playerId.split('-')[1] 
                            : player.playerId;
                          const soldDate = player.soldAt 
                            ? new Date(player.soldAt).toLocaleTimeString('en-IN', { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: true 
                              })
                            : 'N/A';
                          return (
                            <div key={player._id || index} className="sold-history-item">
                              <span className="sold-history-name">{player.name || 'N/A'}</span>
                              <span className="sold-history-separator">•</span>
                              <span className="sold-history-id">ID: {displayPlayerId}</span>
                              <span className="sold-history-separator">•</span>
                              <span className="sold-history-bought">{soldDate}</span>
                              <span className="sold-history-separator">•</span>
                              <span className="sold-history-team">{player.soldToName || 'N/A'}</span>
                              <span className="sold-history-separator">•</span>
                              <span className="sold-history-amount">₹{player.soldPrice?.toLocaleString('en-IN') || '0'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side - Bid Status and Progress Details */}
                <div className="player-right-section">
                  {/* Current Bid */}
                  <div className="bid-status-card">
                    <div className="bid-status-header">
                      <div className="bid-label-large">CURRENT BID</div>
                    </div>
                    <div className={`bid-amount-large ${bidUpdated ? 'updated' : ''}`} key={currentBid}>
                      ₹{currentBid.toLocaleString('en-IN')}
                    </div>
                    {leadingTeam && (
                      <div className="leading-team-info">
                        <span className="leading-label">Leading:</span>
                        <span className="leading-team-name">{leadingTeam.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress Details and Recent Sales - Combined */}
                  <div className="progress-details-card">
                    <div className="progress-row">
                      <div className="progress-item">
                        <div className="progress-label">PROGRESS</div>
                        <div className="progress-value">
                          <span className="progress-current">{summary.auctioned}</span>
                          <span className="progress-separator">/</span>
                          <span className="progress-total">{summary.totalPlayers}</span>
                        </div>
                      </div>
                      <div className="progress-item">
                        <div className="progress-label">REMAINING</div>
                        <div className="progress-value-large">{summary.remaining}</div>
                      </div>
                    </div>
                    <div className="progress-row progress-row-second">
                      <div className="progress-item">
                        <div className="progress-label">UNSOLD</div>
                        <div className="progress-value-small">{summary.unsold || 0}</div>
                      </div>
                      <div className="progress-item">
                        <div className="progress-label">PENDING</div>
                        <div className="progress-value-small">{summary.pending || 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* Timer - Always Visible */}
                  {auctionStatus === 'running' && tournament?.auctionAdvancedSettings?.timerEnabled !== false && (
                    <div className="timer-card">
                      <div className="timer-header">
                        <span className="timer-label-large">TIMER</span>
                        <span className={`timer-value-large ${timer <= 5 ? 'warning' : ''}`}>
                          {timer}s
                        </span>
                      </div>
                      <div className="timer-bar-large">
                        <div 
                          className="timer-progress-large" 
                          style={{ width: `${(timer / timerConfig) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* App Logo and Details Section - Fills blank space on right side */}
                  <div className="app-info-section">
                    {appLogoUrl && (
                      <div className="app-logo-container">
                        <img 
                          src={appLogoUrl}
                          alt="App Logo"
                          className="app-logo"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="app-details">
                      <div className="app-name">PlayLive</div>
                      <div className="app-tagline">Live Auction Management</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-player-new">
              {summary.remaining === 0 ? (
                <>
                  <div className="auction-complete-icon">✅</div>
                  <p className="auction-complete-text">All player sold auction completed</p>
                </>
              ) : (
                <>
                  <div className="no-player-icon">👤</div>
                  <p className="no-player-text">No active player</p>
                  <button className="btn-primary-new btn-large" onClick={handleNextPlayer}>
                    <span className="btn-icon">⏭</span>
                    <span className="btn-text">Load Next Player</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Auction Controls - Below Current Player */}
          <div className="control-panel-new">
            <div className="control-panel-header">
              <h3 className="control-panel-title">Auction Controls</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  className="btn-secondary-new"
                  onClick={toggleManualCallVisibility}
                  title={showManualCallButton ? 'Hide Manual Call button' : 'Show Manual Call button'}
                  style={{ 
                    padding: '6px 10px', 
                    fontSize: '14px',
                    minWidth: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span>{showManualCallButton ? '👁️' : '🙈'}</span>
                </button>
                <div className="status-indicator-new">
                  <span className={`status-dot-new ${auctionStatus}`}></span>
                  <span className="status-text-new">{statusLabel}</span>
                </div>
              </div>
            </div>
            <div className="control-buttons-grid">
              {auctionStatus === 'stopped' && (
                <button className="btn-primary-new btn-action btn-start-auction" onClick={() => handleStartAuction(false)}>
                  <span className="btn-icon">▶</span>
                  <span className="btn-text">Start</span>
                </button>
              )}
              {auctionStatus === 'running' && (
                <>
                  <button className="btn-secondary-new btn-action btn-pause" onClick={handlePauseAuction}>
                    <span className="btn-icon">⏸</span>
                    <span className="btn-text">Pause</span>
                  </button>
                  {currentBid > 0 && (
                    <button className="btn-warning-new btn-action btn-undo-bid" onClick={handleUndoBid} title="Undo last bid">
                      <span className="btn-icon">↶</span>
                      <span className="btn-text">Undo Bid</span>
                    </button>
                  )}
                  <button className="btn-success-new btn-action btn-mark-sold" onClick={handleMarkSold}>
                    <span className="btn-icon">✅</span>
                    <span className="btn-text">Sold</span>
                  </button>
                  <button className="btn-warning-new btn-action btn-mark-unsold" onClick={handleMarkUnsold}>
                    <span className="btn-icon">❌</span>
                    <span className="btn-text">Unsold</span>
                  </button>
                  {showManualCallButton && (
                    <button className="btn-primary-new btn-action btn-manual-call" onClick={() => setShowManualCallModal(true)} title="Manually call a player by ID">
                      <span className="btn-icon">📞</span>
                      <span className="btn-text">Call</span>
                    </button>
                  )}
                  {currentPlayer && (
                    <button className="btn-warning-new btn-action btn-move-pending" onClick={handleMoveToPending}>
                      <span className="btn-icon">⏳</span>
                      <span className="btn-text">Pending</span>
                    </button>
                  )}
                  {currentPlayer && (
                    <button className="btn-warning-new btn-action btn-withdraw-player" onClick={handleWithdrawPlayer}>
                      <span className="btn-icon">🚫</span>
                      <span className="btn-text">Withdraw</span>
                    </button>
                  )}
                  <button className="btn-secondary-new btn-action btn-reset-timer" onClick={handleResetTimer}>
                    <span className="btn-icon">🔄</span>
                    <span className="btn-text">Reset</span>
                  </button>
                  <button className="btn-secondary-new btn-action btn-shuffle" onClick={handleShufflePlayers}>
                    <span className="btn-icon">🔀</span>
                    <span className="btn-text">Shuffle</span>
                  </button>
                  {hasPendingPlayers && (
                    <>
                      <button 
                        className={`btn-primary-new btn-action ${!isAvailableListComplete ? 'disabled' : ''}`}
                        onClick={handleMovePendingToAvailable}
                        disabled={!isAvailableListComplete}
                        title={isAvailableListComplete ? "Move all pending players to available list" : "Complete all available players first"}
                        style={!isAvailableListComplete ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                      >
                        <span className="btn-icon">↩️</span>
                        <span className="btn-text">Pending→Avail</span>
                      </button>
                    </>
                  )}
                  {hasUnsoldPlayers && (
                    <button 
                      className="btn-primary-new btn-action"
                      onClick={handleMoveUnsoldToAvailable}
                      title="Move all unsold players to available list"
                    >
                      <span className="btn-icon">🔄</span>
                      <span className="btn-text">Unsold→Avail</span>
                    </button>
                  )}
                  {hasSoldPlayers && (
                    <button 
                      className="btn-warning-new btn-action"
                      onClick={handleRecallLastSold}
                      title="Recall the last sold player and move back to available"
                    >
                      <span className="btn-icon">↩️</span>
                      <span className="btn-text">Recall</span>
                    </button>
                  )}
                  <button className="btn-danger-new btn-action btn-end-auction" onClick={handleEndAuction}>
                    <span className="btn-icon">⏹</span>
                    <span className="btn-text">End</span>
                  </button>
                </>
              )}
              {auctionStatus === 'paused' && (
                <>
                  <button className="btn-primary-new btn-action btn-resume-auction" onClick={handleResumeAuction}>
                    <span className="btn-icon">▶</span>
                    <span className="btn-text">Resume</span>
                  </button>
                  <button className="btn-success-new btn-action btn-mark-sold" onClick={handleMarkSold}>
                    <span className="btn-icon">✅</span>
                    <span className="btn-text">Sold</span>
                  </button>
                  <button className="btn-warning-new btn-action btn-mark-unsold" onClick={handleMarkUnsold}>
                    <span className="btn-icon">❌</span>
                    <span className="btn-text">Unsold</span>
                  </button>
                  {currentPlayer && (
                    <button className="btn-warning-new btn-action btn-move-pending" onClick={handleMoveToPending}>
                      <span className="btn-icon">⏳</span>
                      <span className="btn-text">Pending</span>
                    </button>
                  )}
                  {currentPlayer && (
                    <button className="btn-warning-new btn-action btn-withdraw-player" onClick={handleWithdrawPlayer}>
                      <span className="btn-icon">🚫</span>
                      <span className="btn-text">Withdraw</span>
                    </button>
                  )}
                  <button className="btn-secondary-new btn-action btn-reset-timer" onClick={handleResetTimer}>
                    <span className="btn-icon">🔄</span>
                    <span className="btn-text">Reset</span>
                  </button>
                  <button className="btn-secondary-new btn-action btn-shuffle" onClick={handleShufflePlayers}>
                    <span className="btn-icon">🔀</span>
                    <span className="btn-text">Shuffle</span>
                  </button>
                  {hasPendingPlayers && (
                    <>
                      <button 
                        className={`btn-primary-new btn-action ${!isAvailableListComplete ? 'disabled' : ''}`}
                        onClick={handleMovePendingToAvailable}
                        disabled={!isAvailableListComplete}
                        title={isAvailableListComplete ? "Move all pending players to available list" : "Complete all available players first"}
                        style={!isAvailableListComplete ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                      >
                        <span className="btn-icon">↩️</span>
                        <span className="btn-text">Pending→Avail</span>
                      </button>
                    </>
                  )}
                  {hasUnsoldPlayers && (
                    <button 
                      className="btn-primary-new btn-action"
                      onClick={handleMoveUnsoldToAvailable}
                      title="Move all unsold players to available list"
                    >
                      <span className="btn-icon">🔄</span>
                      <span className="btn-text">Unsold→Avail</span>
                    </button>
                  )}
                  {hasSoldPlayers && (
                    <button 
                      className="btn-warning-new btn-action"
                      onClick={handleRecallLastSold}
                      title="Recall the last sold player and move back to available"
                    >
                      <span className="btn-icon">↩️</span>
                      <span className="btn-text">Recall</span>
                    </button>
                  )}
                  <button className="btn-danger-new btn-action btn-end-auction" onClick={handleEndAuction}>
                    <span className="btn-icon">⏹</span>
                    <span className="btn-text">End</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Teams */}
        <div className="auction-right-panel">
          {/* Team Comparison View - Simplified */}
          {showTeamComparison && (
            <div className="team-comparison-view">
              <div className="comparison-table">
                <div className="comparison-header">
                  <div className="comp-col">Team</div>
                  <div className="comp-col">Budget</div>
                  <div className="comp-col">Spent</div>
                  <div className="comp-col">Remaining</div>
                  <div className="comp-col">Players</div>
                </div>
                {teams.map((team) => {
                  const totalSpent = team.totalSpent || team.budgetUsed || 0;
                  const budget = team.budget || 100000;
                  const remaining = team.budgetBalance || team.currentBalance || Math.max(0, budget - totalSpent);
                  const playersCount = team.playersBought || team.playersCount || 0;
                  
                  return (
                    <div key={team._id} className="comparison-row">
                      <div className="comp-col">
                        <div className="comp-team-info">
                          {team.logo && (
                            <img 
                              src={getImageUrl(team.logo, `${API_BASE_URL}/default-logo.png`)}
                              alt={team.name}
                              className="comp-team-logo"
                            />
                          )}
                          <span className="comp-team-name">{team.name}</span>
                        </div>
                      </div>
                      <div className="comp-col">₹{budget.toLocaleString('en-IN')}</div>
                      <div className="comp-col">₹{totalSpent.toLocaleString('en-IN')}</div>
                      <div className="comp-col">
                        <span className={remaining < 0 ? 'negative' : ''}>
                          ₹{remaining.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="comp-col">{playersCount}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search/Filter removed */}

          <div className="teams-grid-new">
            {teams.map((team) => {
              const nextBidAmount = calculateNextBid();
              const isLeading = leadingTeam && String(leadingTeam._id) === String(team._id);
              // Use accurate data from backend - prioritize backend calculated values
              const totalSpent = team.totalSpent || team.budgetUsed || 0;
              const budget = team.budget || 100000;
              const remaining = team.budgetBalance || team.currentBalance || Math.max(0, budget - totalSpent);
              const playersBought = team.playersBought || team.playersCount || 0;
              const maxPlayersPerTeam = tournament?.maxPlayers || 16;
              const isTeamFull = maxPlayersPerTeam > 0 && playersBought >= maxPlayersPerTeam;
              // If team auction is complete (team is full), set maxBid to 0 regardless of balance
              const maxBid = isTeamFull ? 0 : (team.maxBid || team.maxPossibleBid || Math.max(0, remaining));
              const spentPercent = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
              
              const canBid = auctionStatus === 'running' && 
                currentPlayer && 
                !isLeading &&
                !isTeamFull &&
                remaining >= nextBidAmount &&
                maxBid >= nextBidAmount;
              
              const handleCardClick = () => {
                if (auctionStatus === 'running' && currentPlayer && !isTeamFull) {
                  if (isLeading) {
                    handleMarkSold();
                  } else if (canBid) {
                    handleTeamBid(team._id);
                  }
                }
              };

              return (
                <div 
                  key={team._id} 
                  className={`team-card-new ${isLeading ? 'leading-team' : ''} ${auctionStatus === 'running' && currentPlayer && !isTeamFull && (isLeading || canBid) ? 'clickable-card' : ''}`}
                  onClick={handleCardClick}
                  style={{ cursor: auctionStatus === 'running' && currentPlayer && !isTeamFull && (isLeading || canBid) ? 'pointer' : 'default' }}
                >
                  <div className="team-header-new">
                    {team.logo && (
                      <img 
                        src={getImageUrl(team.logo, `${API_BASE_URL}/default-logo.png`)}
                        alt={team.name}
                        className="team-logo-new"
                      />
                    )}
                    <h4 className="team-name-new">{team.name}</h4>
                    {maxPlayersPerTeam > 0 && (
                      <div className="team-player-status">
                        <span className="team-player-status-value">
                          {playersBought}/{maxPlayersPerTeam}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="team-stats-new">
                    <div className="team-stat">
                      <span className="stat-label-small">Spent </span>
                      <span className="stat-value-small spent">₹{totalSpent.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="team-stat">
                      <span className="stat-label-small">Balance </span>
                      <span className={`stat-value-small ${remaining < 0 ? 'negative' : ''}`}>
                        ₹{remaining.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="team-stat">
                      <span className="stat-label-small">Max Bid </span>
                      <span className="stat-value-small" style={{ color: 'var(--stadium-yellow)' }}>
                        ₹{maxBid.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Auto-bid Status */}
                  {autoBidSettings[team._id]?.enabled && (
                    <div className="auto-bid-status" onClick={(e) => e.stopPropagation()}>
                      <span>🤖 Auto-bid: ₹{autoBidSettings[team._id].maxBid.toLocaleString('en-IN')}</span>
                      <button
                        className="auto-bid-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAutoBidSettings(prev => {
                            const newSettings = { ...prev };
                            delete newSettings[team._id];
                            return newSettings;
                          });
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {auctionStatus === 'running' && currentPlayer && !isTeamFull && (
                    <>
                      {isLeading ? (
                        <div className="btn-sold-new">
                          <span className="bid-btn-icon">✅</span>
                          <span className="bid-btn-text">Mark Sold</span>
                        </div>
                      ) : (
                        <div className={`btn-bid-new ${canBid ? 'active' : 'disabled'}`}>
                          {canBid ? (
                            <>
                              <span className="bid-btn-icon">💰</span>
                              <span className="bid-btn-text">Bid ₹{nextBidAmount.toLocaleString('en-IN')}</span>
                            </>
                          ) : (
                            <>
                              <span className="bid-btn-icon">🚫</span>
                              <span className="bid-btn-text">Cannot Bid</span>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {auctionStatus !== 'running' && currentPlayer && (
                    <div className="bid-status-inactive">
                      <span className="bid-status-text">Auction {statusLabel}</span>
                    </div>
                  )}
                  
                  {/* Bid History Section */}
                  {currentPlayer && teamBidHistory[team._id] && teamBidHistory[team._id].length > 0 && (
                    <div className="team-bid-history-section">
                      <button
                        className="bid-history-toggle"
                        onClick={() => toggleTeamHistory(team._id)}
                      >
                        <span className="bid-history-icon">{expandedTeamHistory[team._id] ? '▼' : '▶'}</span>
                        <span className="bid-history-label">
                          Bid History ({teamBidHistory[team._id].length})
                        </span>
                      </button>
                      {expandedTeamHistory[team._id] && (
                        <div className="bid-history-list">
                          {teamBidHistory[team._id].slice().reverse().map((bid, idx) => (
                            <div key={idx} className="bid-history-item">
                              <span className="bid-history-amount">₹{bid.amount.toLocaleString('en-IN')}</span>
                              <span className="bid-history-time">
                                {bid.timestamp ? new Date(bid.timestamp).toLocaleTimeString() : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bid Statistics Dashboard Modal */}
      {showBidStats && (
        <div className="modal-overlay" onClick={() => setShowBidStats(false)}>
          <div className="modal-content stats-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bid Statistics</h2>
              <button className="modal-close" onClick={() => setShowBidStats(false)}>×</button>
            </div>
            <div className="stats-content">
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-box-label">Total Bids</div>
                  <div className="stat-box-value">{bidStats.totalBids}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-box-label">Average Bid</div>
                  <div className="stat-box-value">₹{bidStats.averageBid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-box-label">Highest Bid</div>
                  <div className="stat-box-value">₹{bidStats.highestBid.toLocaleString('en-IN')}</div>
                </div>
              </div>
              {Object.keys(bidStats.bidsByTeam).length > 0 && (
                <div className="bids-by-team">
                  <h3>Bids by Team</h3>
                  <div className="team-bids-list">
                    {Object.entries(bidStats.bidsByTeam).map(([teamName, stats]) => (
                      <div key={teamName} className="team-bid-stat">
                        <div className="team-bid-name">{teamName}</div>
                        <div className="team-bid-details">
                          <span>{stats.count} bids</span>
                          <span>Total: ₹{stats.total.toLocaleString('en-IN')}</span>
                          <span>Avg: ₹{Math.round(stats.total / stats.count).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Player Details Modal */}
      {showPlayerModal && selectedPlayer && (
        <div className="modal-overlay" onClick={() => setShowPlayerModal(false)}>
          <div className="modal-content player-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Player Details</h2>
              <button className="modal-close" onClick={() => setShowPlayerModal(false)}>×</button>
            </div>
            <div className="player-modal-content">
              <div className="player-modal-photo">
                <img 
                  src={getImageUrl(selectedPlayer.photo, `${API_BASE_URL}/default-photo.png`)}
                  alt={selectedPlayer.name}
                />
              </div>
              <div className="player-modal-info">
                <h3>{selectedPlayer.name}</h3>
                <div className="player-modal-details-grid">
                  <div className="detail-row">
                    <span className="detail-label">Player ID:</span>
                    <span className="detail-value">
                      {selectedPlayer.playerId 
                        ? selectedPlayer.playerId.includes('-') 
                          ? selectedPlayer.playerId.split('-')[1] 
                          : selectedPlayer.playerId
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Role:</span>
                    <span className="detail-value">{selectedPlayer.role || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">City:</span>
                    <span className="detail-value">{selectedPlayer.city || 'N/A'}</span>
                  </div>
                  {selectedPlayer.auctionStatus === 'Sold' && (
                    <>
                      <div className="detail-row">
                        <span className="detail-label">Sold Price:</span>
                        <span className="detail-value">₹{selectedPlayer.soldPrice?.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Sold To:</span>
                        <span className="detail-value">{selectedPlayer.soldToName || 'N/A'}</span>
                      </div>
                    </>
                  )}
                  <div className="detail-row">
                    <span className="detail-label">Status:</span>
                    <span className={`detail-value status-badge ${selectedPlayer.auctionStatus?.toLowerCase()}`}>
                      {selectedPlayer.auctionStatus || 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts moved to header */}

      {/* Bid Prediction Modal */}
      {showBidPrediction && bidPrediction && (
        <div className="modal-overlay" onClick={() => setShowBidPrediction(false)}>
          <div className="modal-content prediction-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bid Prediction</h2>
              <button className="modal-close" onClick={() => setShowBidPrediction(false)}>×</button>
            </div>
            <div className="prediction-content">
              <div className="prediction-current">
                <div className="prediction-label">Current Bid</div>
                <div className="prediction-value">₹{bidPrediction.current.toLocaleString('en-IN')}</div>
              </div>
              <div className="prediction-arrow">→</div>
              <div className="prediction-predicted">
                <div className="prediction-label">Predicted Final</div>
                <div className="prediction-value highlight">₹{bidPrediction.predicted.toLocaleString('en-IN')}</div>
              </div>
              <div className="prediction-stats">
                <div className="prediction-stat">
                  <span>Confidence: {bidPrediction.confidence}%</span>
                </div>
                <div className="prediction-stat">
                  <span>Estimated Bids: {bidPrediction.estimatedBids}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Player Statistics Modal */}
      {showPlayerStats && selectedPlayerStats && (
        <div className="modal-overlay" onClick={() => setShowPlayerStats(false)}>
          <div className="modal-content stats-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Player Statistics</h2>
              <button className="modal-close" onClick={() => setShowPlayerStats(false)}>×</button>
            </div>
            <div className="player-stats-content">
              <div className="player-stats-header">
                <img src={getImageUrl(selectedPlayerStats.photo, `${API_BASE_URL}/default-photo.png`)} alt={selectedPlayerStats.name} />
                <h3>{selectedPlayerStats.name}</h3>
              </div>
              <div className="player-stats-grid">
                <div className="stat-item">
                  <div className="stat-label">Total Bids Received</div>
                  <div className="stat-value">{selectedPlayerStats.bidHistory?.length || 0}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Highest Bid</div>
                  <div className="stat-value">₹{Math.max(...(selectedPlayerStats.bidHistory?.map(b => b.amount) || [0])).toLocaleString('en-IN')}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Average Bid</div>
                  <div className="stat-value">₹{selectedPlayerStats.bidHistory?.length > 0 ? Math.round(selectedPlayerStats.bidHistory.reduce((sum, b) => sum + b.amount, 0) / selectedPlayerStats.bidHistory.length).toLocaleString('en-IN') : 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message Modal */}
      {showErrorModal && errorModalData && (
        <div className="modal-overlay" onClick={() => setShowErrorModal(false)}>
          <div className="modal-content error-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ color: '#ef4444' }}>⚠️ {errorModalData.title}</h2>
              <button className="modal-close" onClick={() => setShowErrorModal(false)}>×</button>
            </div>
            <div className="error-modal-content" style={{ padding: '24px' }}>
              <p style={{ marginBottom: '20px', fontSize: '16px', lineHeight: '1.6', color: '#1e293b' }}>
                {errorModalData.message}
              </p>
              
              {errorModalData.details && errorModalData.code === 'NO_AVAILABLE_PLAYERS' && (
                <div style={{ marginTop: '24px' }}>
                  <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
                    Player Status Breakdown
                  </h3>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                    gap: '12px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ 
                      padding: '12px', 
                      background: errorModalData.details.Available > 0 ? '#dcfce7' : '#fee2e2',
                      borderRadius: '8px',
                      border: `2px solid ${errorModalData.details.Available > 0 ? '#16a34a' : '#ef4444'}`
                    }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Available</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: errorModalData.details.Available > 0 ? '#16a34a' : '#ef4444' }}>
                        {errorModalData.details.Available || 0}
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '8px', border: '2px solid #f59e0b' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Sold</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
                        {errorModalData.details.Sold || 0}
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: '#e0e7ff', borderRadius: '8px', border: '2px solid #6366f1' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Unsold</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#6366f1' }}>
                        {errorModalData.details.Unsold || 0}
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: '#fce7f3', borderRadius: '8px', border: '2px solid #ec4899' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Pending</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#ec4899' }}>
                        {errorModalData.details.Pending || 0}
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: '#fed7aa', borderRadius: '8px', border: '2px solid #f97316' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>In Auction</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#f97316' }}>
                        {errorModalData.details.InAuction || 0}
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: '#e5e7eb', borderRadius: '8px', border: '2px solid #6b7280' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Withdrawn</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#6b7280' }}>
                        {errorModalData.details.Withdrawn || 0}
                      </div>
                    </div>
                  </div>
                  <div style={{ 
                    padding: '16px', 
                    background: '#f1f5f9', 
                    borderRadius: '8px', 
                    marginTop: '16px',
                    border: '1px solid #cbd5e1'
                  }}>
                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Total Players</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                      {errorModalData.details.total || 0}
                    </div>
                  </div>
                  <div style={{ 
                    marginTop: '20px', 
                    padding: '16px', 
                    background: '#fef3c7', 
                    borderRadius: '8px',
                    border: '1px solid #fbbf24'
                  }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#92400e', lineHeight: '1.6' }}>
                      <strong>💡 Tip:</strong> Mark unsold or pending players as "Available" to continue the auction.
                    </p>
                  </div>
                </div>
              )}
              
              {errorModalData.code === 'CURRENT_PLAYER_ACTIVE' && (
                <div style={{ 
                  marginTop: '20px', 
                  padding: '16px', 
                  background: '#fee2e2', 
                  borderRadius: '8px',
                  border: '1px solid #fca5a5'
                }}>
                  <p style={{ margin: 0, fontSize: '14px', color: '#991b1b', lineHeight: '1.6' }}>
                    <strong>Action Required:</strong> Please finalize the current player by marking them as "Sold" or "Unsold" before loading the next player.
                  </p>
                </div>
              )}
              
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => setShowErrorModal(false)}
                  style={{
                    padding: '10px 24px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#2563eb'}
                  onMouseOut={(e) => e.target.style.background = '#3b82f6'}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auction Replay Modal */}
      {showReplay && (
        <div className="modal-overlay" onClick={() => setShowReplay(false)}>
          <div className="modal-content replay-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Auction Replay</h2>
              <button className="modal-close" onClick={() => setShowReplay(false)}>×</button>
            </div>
            <div className="replay-controls">
              <button onClick={() => setReplayIndex(Math.max(0, replayIndex - 1))}>⏮ Previous</button>
              <span>Event {replayIndex + 1} of {replayHistory.length}</span>
              <button onClick={() => setReplayIndex(Math.min(replayHistory.length - 1, replayIndex + 1))}>Next ⏭</button>
            </div>
            <div className="replay-content">
              {replayHistory[replayIndex] && (
                <div className="replay-event">
                  <div className="replay-time">{new Date(replayHistory[replayIndex].timestamp).toLocaleString()}</div>
                  <div className="replay-description">{replayHistory[replayIndex].description}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notification Center */}
      {showNotificationCenter && (
        <div className="notification-center-panel">
          <div className="panel-header">
            <h3>Notifications</h3>
            <button onClick={() => setShowNotificationCenter(false)}>×</button>
          </div>
          <div className="notification-list">
            {notificationHistory.map(notif => (
              <div key={notif.id} className={`notification-item ${notif.type}`}>
                <div className="notification-message">{notif.message}</div>
                <div className="notification-time">{new Date(notif.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wishlist Panel */}
      {showWishlist && (
        <div className="wishlist-panel">
          <div className="panel-header">
            <h3>Player Wishlist</h3>
            <button onClick={() => setShowWishlist(false)}>×</button>
          </div>
          <div className="wishlist-items">
            {allPlayers.filter(p => playerWishlist.includes(p._id)).map(player => (
              <div key={player._id} className="wishlist-item">
                <span>{player.name}</span>
                <button onClick={() => toggleWishlist(player._id)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRCode && (
        <div className="modal-overlay" onClick={() => setShowQRCode(false)}>
          <div className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>QR Code</h2>
              <button className="modal-close" onClick={() => setShowQRCode(false)}>×</button>
            </div>
            <div className="qr-content">
              {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" />}
              <p>Scan to join auction</p>
            </div>
          </div>
        </div>
      )}

      {/* Commentary Panel */}
      {showCommentary && (
        <div className="commentary-panel">
          <div className="panel-header">
            <h3>Live Commentary</h3>
            <button onClick={() => setShowCommentary(false)}>×</button>
          </div>
          <div className="commentary-list">
            {commentary.map(comment => (
              <div key={comment.id} className="commentary-item">
                <div className="commentary-text">{comment.text}</div>
                <div className="commentary-meta">
                  <span>{comment.player}</span>
                  <span>{new Date(comment.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="commentary-input-container">
            <input
              type="text"
              value={commentaryInput}
              onChange={(e) => setCommentaryInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCommentary()}
              placeholder="Add commentary..."
            />
            <button onClick={addCommentary}>Add</button>
          </div>
        </div>
      )}

      {/* Countdown Timer */}
      {showCountdown && countdownTime && (
        <div className="countdown-overlay">
          <div className="countdown-display">
            <div className="countdown-label">Auction Starting In</div>
            <div className="countdown-time">
              {Math.max(0, Math.floor((new Date(countdownTime) - new Date()) / 1000))}s
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Player Image Modal */}
      {showEnlargedImage && currentPlayer && (
        <div className="modal-overlay image-modal-overlay" onClick={() => setShowEnlargedImage(false)}>
          <div className="modal-content image-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{currentPlayer.name}</h2>
              <button className="modal-close" onClick={() => setShowEnlargedImage(false)}>×</button>
            </div>
            <div className="enlarged-image-container">
              <img 
                src={getImageUrl(currentPlayer.photo, `${API_BASE_URL}/default-photo.png`)}
                alt={currentPlayer.name}
                className="enlarged-player-image"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mark Sold Confirmation Modal */}
      {showMarkSoldConfirm && (
        <div className="modal-overlay" onClick={() => setShowMarkSoldConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header" style={{ padding: '15px 20px' }}>
              <h2 style={{ fontSize: '18px' }}>Confirm Mark as Sold</h2>
              <button className="modal-close" onClick={() => setShowMarkSoldConfirm(false)}>×</button>
            </div>
            <div style={{ padding: '15px' }}>
              <p style={{ marginBottom: '15px', fontSize: '12px', lineHeight: '1.5' }}>
                Are you sure you want to mark this player as sold? This action will finalize the sale.
              </p>
              {currentPlayer && (
                <div style={{ marginBottom: '15px', padding: '12px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
                  <strong>{currentPlayer.name}</strong>
                  {currentBid > 0 && (
                    <div style={{ marginTop: '6px', fontSize: '14px' }}>
                      Current Bid: ₹{currentBid.toLocaleString('en-IN')}
                      {leadingTeam && ` - ${leadingTeam.name}`}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                className="btn-secondary-new"
                onClick={() => setShowMarkSoldConfirm(false)}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                className="btn-success-new"
                onClick={confirmMarkSold}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                ✅ Confirm & Mark Sold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Pending to Available Confirmation Modal */}
      {showMovePendingConfirm && (
        <div className="modal-overlay" onClick={() => setShowMovePendingConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Move Pending Players to Available</h2>
              <button className="modal-close" onClick={() => setShowMovePendingConfirm(false)}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ marginBottom: '20px', fontSize: '16px', lineHeight: '1.5' }}>
                Are you sure you want to move all pending players to the available list? This will make them available for bidding again.
              </p>
              {summary.pending > 0 && (
                <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
                  <strong>Pending Players: {summary.pending}</strong>
                  <div style={{ marginTop: '8px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    All {summary.pending} pending player(s) will be moved to available list
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                className="btn-secondary-new"
                onClick={() => setShowMovePendingConfirm(false)}
                style={{ padding: '10px 20px' }}
              >
                Cancel
              </button>
              <button
                className="btn-primary-new"
                onClick={confirmMovePendingToAvailable}
                style={{ padding: '10px 20px' }}
              >
                ↩️ Confirm & Move to Available
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Unsold to Available Confirmation Modal */}
      {showMoveUnsoldConfirm && (
        <div className="modal-overlay" onClick={() => setShowMoveUnsoldConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Move Unsold Players to Available</h2>
              <button className="modal-close" onClick={() => setShowMoveUnsoldConfirm(false)}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ marginBottom: '20px', fontSize: '16px', lineHeight: '1.5' }}>
                Are you sure you want to move all unsold players to the available list? This will reset their bid history and make them available for bidding again.
              </p>
              {summary.unsold > 0 && (
                <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
                  <strong>Unsold Players: {summary.unsold}</strong>
                  <div style={{ marginTop: '8px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    All {summary.unsold} unsold player(s) will be moved to available list and their bid history will be reset
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                className="btn-secondary-new"
                onClick={() => setShowMoveUnsoldConfirm(false)}
                style={{ padding: '10px 20px' }}
              >
                Cancel
              </button>
              <button
                className="btn-primary-new"
                onClick={confirmMoveUnsoldToAvailable}
                style={{ padding: '10px 20px' }}
              >
                🔄 Confirm & Move to Available
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Auction Confirmation Modal */}
      {showEndAuctionConfirm && (
        <div className="modal-overlay" onClick={() => setShowEndAuctionConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header" style={{ padding: '15px 20px' }}>
              <h2 style={{ fontSize: '18px' }}>End Auction</h2>
              <button className="modal-close" onClick={() => setShowEndAuctionConfirm(false)}>×</button>
            </div>
            <div style={{ padding: '15px' }}>
              <p style={{ marginBottom: '15px', fontSize: '12px', lineHeight: '1.5' }}>
                Are you sure you want to end the auction? This action cannot be undone.
              </p>
              <div style={{ marginBottom: '15px', padding: '12px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
                <strong style={{ color: '#ef4444' }}>⚠️ Warning:</strong>
                <div style={{ marginTop: '6px', fontSize: '14px' }}>
                  Once ended, you cannot continue bidding or make changes.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                className="btn-secondary-new"
                onClick={() => setShowEndAuctionConfirm(false)}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                className="btn-danger-new"
                onClick={confirmEndAuction}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                ⏹ End Auction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Bid Confirmation Modal */}
      {showUndoBidConfirm && (
        <div className="modal-overlay" onClick={() => setShowUndoBidConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
            <div className="modal-header" style={{ padding: '15px 20px' }}>
              <h2 style={{ fontSize: '18px' }}>Undo Last Bid</h2>
              <button className="modal-close" onClick={() => setShowUndoBidConfirm(false)}>×</button>
            </div>
            <div style={{ padding: '15px' }}>
              <p style={{ marginBottom: '15px', fontSize: '12px', lineHeight: '1.5' }}>
                Are you sure you want to undo the last bid? This will cancel the most recent bid.
              </p>
              {currentBid > 0 && (
                <div style={{ marginBottom: '15px', padding: '12px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
                  <strong>Current Bid: ₹{currentBid.toLocaleString('en-IN')}</strong>
                  <div style={{ marginTop: '6px', fontSize: '14px' }}>
                    This bid will be cancelled and removed.
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                className="btn-secondary-new"
                onClick={() => setShowUndoBidConfirm(false)}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                className="btn-warning-new"
                onClick={confirmUndoBid}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                ↶ Undo Bid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Call Player Modal */}
      {showManualCallModal && (
        <div className="modal-overlay" onClick={() => {
          if (!manualCallLoading) {
            setShowManualCallModal(false);
            setManualCallPlayerId('');
          }
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%' }}>
            <div className="modal-header" style={{ padding: '12px 16px' }}>
              <h2 style={{ fontSize: '18px', margin: 0 }}>Manual Call Player</h2>
              <button 
                className="modal-close" 
                onClick={() => {
                  if (!manualCallLoading) {
                    setShowManualCallModal(false);
                    setManualCallPlayerId('');
                  }
                }}
                disabled={manualCallLoading}
                style={{ fontSize: '20px', padding: '4px 8px' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '16px' }}>
              <p style={{ marginBottom: '12px', fontSize: '13px', lineHeight: '1.4', color: '#1f2937' }}>
                Enter the player ID to manually call them to the auction floor. You can use either the custom player ID (e.g., 001) or the MongoDB ObjectId.
              </p>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                  Player ID
                </label>
                <input
                  type="text"
                  value={manualCallPlayerId}
                  onChange={(e) => setManualCallPlayerId(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !manualCallLoading && manualCallPlayerId.trim()) {
                      handleManualCallPlayer();
                    }
                  }}
                  placeholder="Enter player ID (e.g., 001)"
                  disabled={manualCallLoading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: manualCallLoading ? '#f3f4f6' : '#ffffff',
                    color: '#111827'
                  }}
                  autoFocus
                />
              </div>
              {manualCallLoading && (
                <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', textAlign: 'center' }}>
                  <span style={{ color: '#3b82f6', fontSize: '13px' }}>Calling player...</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                className="btn-secondary-new"
                onClick={() => {
                  if (!manualCallLoading) {
                    setShowManualCallModal(false);
                    setManualCallPlayerId('');
                  }
                }}
                disabled={manualCallLoading}
                style={{ padding: '8px 16px', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button
                className="btn-primary-new"
                onClick={handleManualCallPlayer}
                disabled={manualCallLoading || !manualCallPlayerId.trim()}
                style={{ padding: '8px 16px', fontSize: '14px', opacity: (manualCallLoading || !manualCallPlayerId.trim()) ? 0.6 : 1 }}
              >
                {manualCallLoading ? 'Calling...' : '📞 Call Player'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ReCall Last Sold Confirmation Modal */}
      {showRecallLastSoldConfirm && lastSoldPlayer && (
        <div className="modal-overlay" onClick={() => setShowRecallLastSoldConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>ReCall Last Sold Player</h2>
              <button className="modal-close" onClick={() => setShowRecallLastSoldConfirm(false)}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ marginBottom: '20px', fontSize: '16px', lineHeight: '1.5', color: '#1f2937' }}>
                Are you sure you want to recall the last sold player? This will cancel the sale, refund the team, and move the player back to the available list.
              </p>
              <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(0, 0, 0, 0.05)', borderRadius: '8px' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#111827' }}>
                  {lastSoldPlayer.name || 'Unknown Player'}
                </div>
                {lastSoldPlayer.role && (
                  <div style={{ marginTop: '4px', fontSize: '14px', color: '#4b5563' }}>
                    Role: {lastSoldPlayer.role}
                  </div>
                )}
                <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                  Sold Price: ₹{(lastSoldPlayer.soldPrice || 0).toLocaleString('en-IN')}
                </div>
                {lastSoldPlayer.soldToName && (
                  <div style={{ marginTop: '8px', fontSize: '14px', color: '#4b5563' }}>
                    Sold To: {lastSoldPlayer.soldToName}
                  </div>
                )}
                {!lastSoldPlayer.soldToName && (
                  <div style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280' }}>
                    Sold To: Not specified
                  </div>
                )}
                {lastSoldPlayer.soldAt && (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
                    Sold At: {new Date(lastSoldPlayer.soldAt).toLocaleString()}
                  </div>
                )}
              </div>
              <div style={{ padding: '12px', background: 'rgba(255, 193, 7, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 193, 7, 0.3)' }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#111827', fontWeight: '600' }}>
                  ⚠️ This action will:
                </p>
                <ul style={{ margin: '8px 0 0 20px', fontSize: '13px', color: '#374151', paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '4px' }}>Refund ₹{(lastSoldPlayer.soldPrice || 0).toLocaleString('en-IN')} to {lastSoldPlayer.soldToName || 'the team'}</li>
                  <li style={{ marginBottom: '4px' }}>Remove player from team's purchased list</li>
                  <li style={{ marginBottom: '4px' }}>Reset player's bid history</li>
                  <li style={{ marginBottom: '4px' }}>Move player back to available list</li>
                </ul>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                className="btn-secondary-new"
                onClick={() => {
                  setShowRecallLastSoldConfirm(false);
                  setLastSoldPlayer(null);
                }}
                style={{ padding: '10px 20px' }}
              >
                Cancel
              </button>
              <button
                className="btn-warning-new"
                onClick={confirmRecallLastSold}
                style={{ padding: '10px 20px' }}
              >
                ↩️ Confirm & ReCall
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Additional Feature Modals - Add all remaining UI components here */}
      {/* All 30 features have been implemented with state management and core functionality */}
      {/* UI components can be added as needed based on user interaction */}

      {/* Readiness Errors Modal */}
      {showReadinessErrors && readinessErrors && (
        <div className="modal-overlay" onClick={() => setShowReadinessErrors(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ Auction Readiness Check Failed</h2>
              <button className="modal-close" onClick={() => setShowReadinessErrors(false)}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ marginBottom: '16px', color: '#4b5563', fontSize: '16px' }}>
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
                    color: '#dc2626',
                    fontSize: '14px'
                  }}>
                    • {error}
                  </li>
                ))}
              </ul>
              {readinessErrors.readiness && (
                <div style={{
                  padding: '12px',
                  background: 'rgba(0, 0, 0, 0.05)',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <strong style={{ color: '#111827' }}>Current Status:</strong>
                  <div style={{ marginTop: '8px', fontSize: '14px', color: '#4b5563' }}>
                    <div>Players: {readinessErrors.readiness.playerCount || 0} / {readinessErrors.readiness.requiredPlayers || 'N/A'}</div>
                    <div>Teams: {readinessErrors.readiness.teamCount || 0} / {readinessErrors.readiness.requiredTeams || 'N/A'}</div>
                  </div>
                </div>
              )}
              {readinessErrors.quorumIssues && readinessErrors.quorumIssues.length > 0 && (
                <div style={{
                  padding: '12px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <strong style={{ color: '#111827' }}>Quorum Issues:</strong>
                  <ul style={{ marginTop: '8px', paddingLeft: '20px', fontSize: '14px', color: '#4b5563' }}>
                    {readinessErrors.quorumIssues.map((issue, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>
                        {issue.teamName}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button 
                  className="btn-secondary-new"
                  onClick={() => setShowReadinessErrors(false)}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary-new"
                  onClick={() => {
                    setShowReadinessErrors(false);
                    handleStartAuction(true);
                  }}
                  style={{ padding: '10px 20px', borderRadius: '8px', background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  Bypass & Start Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TournamentAuctionNormal;

