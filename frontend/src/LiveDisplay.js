import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from './utils/apiConfig';
// QR Code will be generated using canvas or alternative method
import './styles-live-display.css';

function LiveDisplay() {
  const { tournamentCode } = useParams();
  const [tournament, setTournament] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [auctionStatus, setAuctionStatus] = useState('stopped');
  const [currentBid, setCurrentBid] = useState(0);
  const [leadingTeam, setLeadingTeam] = useState(null);
  const [timer, setTimer] = useState(30);
  const [isConnected, setIsConnected] = useState(false);
  const [commentary, setCommentary] = useState('');
  const [soldAnimation, setSoldAnimation] = useState(null);
  const [reconnected, setReconnected] = useState(false);
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
  const [soundEnabled] = useState(true);
  const [broadcastMode, setBroadcastMode] = useState('auction'); // 'auction', 'fixtures', 'grouping'
  const [fixturesData, setFixturesData] = useState(null);
  const [isFixturesAnimating, setIsFixturesAnimating] = useState(false);
  const [fixturesAnimationProgress, setFixturesAnimationProgress] = useState(0);
  const [groupingData, setGroupingData] = useState(null);
  const [isGroupingAnimating, setIsGroupingAnimating] = useState(false);
  const [groupingAnimationProgress, setGroupingAnimationProgress] = useState(0);
  const [allTeamsForAnimation, setAllTeamsForAnimation] = useState([]);
  const [groupingWheelTeams, setGroupingWheelTeams] = useState([]);
  const [groupingSelectedTeam, setGroupingSelectedTeam] = useState(null);
  const [groupingSpinDelay, setGroupingSpinDelay] = useState(3000);
  const [groupingCurrentGroups, setGroupingCurrentGroups] = useState([]);
  const [groupingTimerCountdown, setGroupingTimerCountdown] = useState(0);
  const [groupingTimerActive, setGroupingTimerActive] = useState(false);
  const groupingTimerIntervalRef = useRef(null);
  const groupingTimerTimeoutRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [teamSlideshowData, setTeamSlideshowData] = useState([]);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [isSlideshowActive, setIsSlideshowActive] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  // Dark theme removed - always use bright theme
  const theme = 'bright';
  const [displayView] = useState('main'); // Always 'main' - bid history view removed
  const [isNextPlayerAnimating, setIsNextPlayerAnimating] = useState(false);
  const [playerSwitchAnimation, setPlayerSwitchAnimation] = useState('idle'); // 'idle', 'fadeOut', 'spinWheel', 'fadeIn'
  const [isBannerHidden, setIsBannerHidden] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  
  const socketRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const currentPlayerRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const soldAnimationTimeoutRef = useRef(null);
  const containerRef = useRef(null);
  const nextPlayerWheelRef = useRef(null);
  const nextPlayerAnimationRef = useRef(null);
  const nextPlayerDataRef = useRef(null);
  const nextPlayerAnimationTimeoutRef = useRef(null);
  const fadeOutTimeoutRef = useRef(null);
  const fetchAbortControllerRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const fetchPendingRef = useRef(false);
  const fetchDebounceTimeoutRef = useRef(null);
  const isFirstConnectionRef = useRef(true);
  const lastReconnectionMessageTimeRef = useRef(0);
  const reconnectionMessageTimeoutRef = useRef(null);
  const groupingWheelRef = useRef(null);
  const groupingAnimationRef = useRef(null);

  // Initialize Web Audio API
  useEffect(() => {
    if (typeof window !== 'undefined' && window.AudioContext) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Sound effects
  const playSound = useCallback((type) => {
    if (!soundEnabled || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    switch (type) {
      case 'bid':
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
        break;
      case 'sold':
        // Applause-like sound
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 600 + (i * 100);
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
          }, i * 100);
        }
        break;
      case 'unsold':
        oscillator.frequency.value = 300;
        oscillator.type = 'sawtooth';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
        break;
      case 'clapping':
        // Clapping/applause sound using multiple oscillators
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            // Random frequencies for clapping effect
            osc.frequency.value = 400 + Math.random() * 200;
            osc.type = 'square';
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
          }, i * 50);
        }
        break;
      case 'timer':
        oscillator.frequency.value = 1000;
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.1);
        break;
      default:
        break;
    }
  }, [soundEnabled]);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    const element = containerRef.current;
    const doc = document;
    const isActive = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

    if (!isActive && element) {
      const request = element.requestFullscreen
        || element.webkitRequestFullscreen
        || element.mozRequestFullScreen
        || element.msRequestFullscreen;
      if (request) {
        request.call(element);
      }
    } else {
      const exit = doc.exitFullscreen
        || doc.webkitExitFullscreen
        || doc.mozCancelFullScreen
        || doc.msExitFullscreen;
      if (exit) {
        exit.call(doc);
      }
    }
  }, []);

  // Dark theme toggle removed


  useEffect(() => {
    if (typeof document === 'undefined') return;
    const doc = document;
    const updateState = () => {
      const active = doc.fullscreenElement
        || doc.webkitFullscreenElement
        || doc.mozFullScreenElement
        || doc.msFullscreenElement;
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
    updateState();

    return () => {
      events.forEach((eventName) => doc.removeEventListener(eventName, updateState));
    };
  }, []);

  // Keep a simple ticking clock for the banner
  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  // Keyboard shortcut for fullscreen (Ctrl+F)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const handleKeyDown = (event) => {
      // Check for Ctrl+F (or Cmd+F on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleFullscreen]);

  // Enhanced confetti animation
  const triggerConfetti = useCallback(() => {
    const confettiContainer = document.getElementById('confetti-container');
    if (!confettiContainer) return;
    
    const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#ffd700', '#00ff88', '#ff1493', '#00bfff', '#ff8c00'];
    const shapes = ['circle', 'square', 'triangle'];
    
    // Create falling confetti particles (120 particles)
    for (let i = 0; i < 120; i++) {
      const confetti = document.createElement('div');
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      confetti.className = `confetti-piece ${shape}`;
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.animationDelay = Math.random() * 0.5 + 's';
      confetti.style.animationDuration = (Math.random() * 2 + 3) + 's';
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      if (shape === 'triangle') {
        confetti.style.borderBottomColor = color;
      } else {
        confetti.style.backgroundColor = color;
      }
      
      confettiContainer.appendChild(confetti);
      
      setTimeout(() => confetti.remove(), 5000);
    }
    
    // Create burst effect at center
    const burstContainer = document.createElement('div');
    burstContainer.style.position = 'fixed';
    burstContainer.style.top = '50%';
    burstContainer.style.left = '50%';
    burstContainer.style.transform = 'translate(-50%, -50%)';
    burstContainer.style.width = '200px';
    burstContainer.style.height = '200px';
    burstContainer.style.pointerEvents = 'none';
    burstContainer.style.zIndex = '10000';
    document.body.appendChild(burstContainer);
    
    for (let i = 0; i < 60; i++) {
      const particle = document.createElement('div');
      particle.style.position = 'absolute';
      particle.style.width = '8px';
      particle.style.height = '8px';
      particle.style.borderRadius = '50%';
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      particle.style.left = '50%';
      particle.style.top = '50%';
      
      const angle = (Math.PI * 2 * i) / 60;
      const distance = 100 + Math.random() * 50;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      
      particle.style.animation = `confetti-burst 1s ease-out forwards`;
      particle.style.animationDelay = Math.random() * 0.2 + 's';
      particle.style.transform = `translate(${x}px, ${y}px)`;
      
      burstContainer.appendChild(particle);
    }
    
    setTimeout(() => {
      burstContainer.remove();
    }, 2000);
  }, []);


  // Start fixtures animation
  const startFixturesAnimation = useCallback((onComplete) => {
    const duration = tournament?.auctionAdvancedSettings?.animationSettings?.fixturesAnimationDuration || 4000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      setFixturesAnimationProgress(progress * 100);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete
        if (onComplete) {
          setTimeout(() => {
            onComplete();
          }, 500);
        }
      }
    };

    animate();
  }, [tournament]);

  // Trigger grouping confetti
  const triggerGroupingConfetti = useCallback(() => {
    const confettiContainer = document.getElementById('confetti-container');
    if (!confettiContainer) return;
    
    const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#ffd700', '#00ff88', '#ff1493', '#00bfff', '#ff8c00'];
    
    for (let i = 0; i < 150; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-piece';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.animationDelay = Math.random() * 0.5 + 's';
      confetti.style.animationDuration = (Math.random() * 2 + 3) + 's';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confettiContainer.appendChild(confetti);
      setTimeout(() => confetti.remove(), 5000);
    }
  }, []);

  // Start grouping wheel animation
  const startGroupingWheelAnimation = useCallback((teams, onComplete) => {
    const duration = 3000; // 3 seconds
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Update progress
      setGroupingAnimationProgress(progress * 100);

      if (progress < 1) {
        groupingAnimationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete - ensure animation state is cleared
        setIsGroupingAnimating(false);
        setGroupingAnimationProgress(100);
        if (onComplete) {
          setTimeout(() => {
            onComplete();
            triggerGroupingConfetti();
          }, 300);
        }
      }
    };

    // Clear any existing animation
    if (groupingAnimationRef.current) {
      cancelAnimationFrame(groupingAnimationRef.current);
    }

    animate();
  }, [triggerGroupingConfetti]);

  // Fetch grouping data
  const fetchGroupingData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/api/grouping/${tournamentCode}/groups`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setGroupingData({
          groups: response.data.groups || []
        });
        setGroupingCurrentGroups(response.data.groups || []);
      }
    } catch (error) {
      console.error('Error fetching grouping data:', error);
    }
  }, [tournamentCode]);

  // Handle wheel spin complete
  const handleWheelSpinComplete = useCallback(() => {
    triggerGroupingConfetti();
    playSound('clapping');
    // Keep groups visible after spin completes
    setTimeout(() => {
      setIsGroupingAnimating(false);
      // Clear wheel state after showing result
      setTimeout(() => {
        setGroupingSelectedTeam(null);
        setGroupingWheelTeams([]);
        // Fetch updated groups
        fetchGroupingData();
      }, 3000);
    }, 2000);
  }, [triggerGroupingConfetti, playSound, fetchGroupingData]);


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

  // Fetch current auction state with debouncing and request cancellation
  const fetchCurrentState = useCallback(async (immediate = false) => {
    // Cancel any pending fetch
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }

    // If a fetch is already pending and not immediate, debounce it
    if (fetchPendingRef.current && !immediate) {
      // Clear existing debounce timeout
      if (fetchDebounceTimeoutRef.current) {
        clearTimeout(fetchDebounceTimeoutRef.current);
      }
      
      // Set new debounce timeout (500ms minimum between requests)
      fetchDebounceTimeoutRef.current = setTimeout(() => {
        fetchCurrentState(true);
      }, 500);
      return;
    }

    // Throttle: minimum 500ms between requests
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    if (timeSinceLastFetch < 500 && !immediate) {
      fetchDebounceTimeoutRef.current = setTimeout(() => {
        fetchCurrentState(true);
      }, 500 - timeSinceLastFetch);
      return;
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    fetchAbortControllerRef.current = abortController;
    fetchPendingRef.current = true;
    lastFetchTimeRef.current = Date.now();

    try {
      const [liveRes, teamsRes, summaryRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/auctions/live/${tournamentCode}`, {
          signal: abortController.signal
        }),
        axios.get(`${API_BASE_URL}/api/auctions/live-teams/${tournamentCode}`, {
          signal: abortController.signal
        }),
        axios.get(`${API_BASE_URL}/api/auctions/live-summary/${tournamentCode}`, {
          signal: abortController.signal
        }).catch(() => ({ data: { summary: null } }))
      ]);

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      setTournament(liveRes.data.tournament);
      const status = normalizeStatus(liveRes.data.auctionStatus || liveRes.data.status);
      setAuctionStatus(status);
      setCurrentPlayer(status === 'completed' ? null : liveRes.data.currentPlayer);
      setCurrentBid(liveRes.data.currentBid || liveRes.data.currentPlayer?.currentBid || 0);
      setLeadingTeam(liveRes.data.highestBidderName || liveRes.data.currentPlayer?.currentBidTeamName || null);
      
      // Set teams data
      if (teamsRes.data.success && teamsRes.data.teams) {
        setTeams(teamsRes.data.teams);
      }
      
      // Set summary data
      if (summaryRes && summaryRes.data && summaryRes.data.summary) {
        setSummary(summaryRes.data.summary);
      }
      
      setReconnected(false);
    } catch (err) {
      // Ignore abort errors
      if (err.name === 'AbortError' || err.name === 'CanceledError' || abortController.signal.aborted) {
        return;
      }
      console.error('Error fetching current state:', err);
      if (err.response?.status === 403 || err.response?.data?.message?.includes('locked')) {
        setAuctionStatus('locked');
      }
    } finally {
      fetchPendingRef.current = false;
      if (fetchAbortControllerRef.current === abortController) {
        fetchAbortControllerRef.current = null;
      }
    }
  }, [tournamentCode, normalizeStatus]);

  // Fetch teams data with debouncing
  const fetchTeamsData = useCallback(async (immediate = false) => {
    // Throttle: minimum 500ms between requests
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    if (timeSinceLastFetch < 500 && !immediate) {
      // Debounce: if fetchCurrentState is already pending, skip this call
      // since fetchCurrentState already fetches teams data
      if (fetchPendingRef.current) {
        return;
      }
      return;
    }

    lastFetchTimeRef.current = Date.now();

    try {
      const teamsRes = await axios.get(`${API_BASE_URL}/api/auctions/live-teams/${tournamentCode}`);
      if (teamsRes.data.success && teamsRes.data.teams) {
        setTeams(teamsRes.data.teams);
      }
    } catch (err) {
      // Ignore abort/cancel errors
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        return;
      }
      console.error('Error fetching teams data:', err);
    }
  }, [tournamentCode]);

  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  // Socket connection
  useEffect(() => {
    fetchCurrentState(true); // Immediate fetch on mount

    // Clean up existing socket if it exists
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Connect without auth token for public display mode
    // Force new connection to ensure clean initialization
    // Try polling first, then upgrade to websocket if available (more reliable)
    const newSocket = io(API_BASE_URL, {
      transports: ['polling', 'websocket'], // Try polling first for better reliability
      upgrade: true, // Allow upgrade from polling to websocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      timeout: 20000,
      forceNew: true, // Force new connection for proper reinitialization
      auth: {
        token: null // No token for public display
      }
    });
    
    socketRef.current = newSocket;

    const guard = (handler) => (payload = {}) => {
      if (payload.tournamentCode && payload.tournamentCode !== tournamentCode) return;
      handler(payload);
    };

    newSocket.on('connect', () => {
      const transport = newSocket.io.engine.transport.name;
      console.log(`Socket.io connected successfully to display mode (transport: ${transport})`);
      setIsConnected(true);
      
      // Only show reconnection message if it's not the first connection and enough time has passed
      const now = Date.now();
      const timeSinceLastMessage = now - lastReconnectionMessageTimeRef.current;
      const cooldownPeriod = 5000; // 5 seconds cooldown between messages
      
      if (!isFirstConnectionRef.current && timeSinceLastMessage >= cooldownPeriod) {
        setReconnected(true);
        lastReconnectionMessageTimeRef.current = now;
        
        // Clear any existing timeout
        if (reconnectionMessageTimeoutRef.current) {
          clearTimeout(reconnectionMessageTimeoutRef.current);
        }
        
        // Hide message after 2 seconds (reduced from 3)
        reconnectionMessageTimeoutRef.current = setTimeout(() => {
          setReconnected(false);
        }, 2000);
      } else {
        // First connection - don't show message
        isFirstConnectionRef.current = false;
      }
      
      // Immediate fetch on connect - important to get latest state
      fetchCurrentState(true);
      
      // Join as display mode
      newSocket.emit('join-display', { tournamentCode, mode: 'spectator' });
    });

    // Listen for transport upgrades (polling -> websocket)
    newSocket.io.on('upgrade', () => {
      const transport = newSocket.io.engine.transport.name;
      console.log(`Socket.io transport upgraded to: ${transport}`);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket.io disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Socket.io reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      
      // Only show reconnection message if enough time has passed since last message
      const now = Date.now();
      const timeSinceLastMessage = now - lastReconnectionMessageTimeRef.current;
      const cooldownPeriod = 5000; // 5 seconds cooldown between messages
      
      if (timeSinceLastMessage >= cooldownPeriod) {
        setReconnected(true);
        lastReconnectionMessageTimeRef.current = now;
        
        // Clear any existing timeout
        if (reconnectionMessageTimeoutRef.current) {
          clearTimeout(reconnectionMessageTimeoutRef.current);
        }
        
        // Hide message after 2 seconds (reduced from 3)
        reconnectionMessageTimeoutRef.current = setTimeout(() => {
          setReconnected(false);
        }, 2000);
      }
      
      // Re-fetch state and rejoin on reconnect
      fetchCurrentState(true);
      newSocket.emit('join-display', { tournamentCode, mode: 'spectator' });
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Socket.io reconnection attempt', attemptNumber);
    });

    newSocket.on('reconnect_error', (error) => {
      console.warn('Socket.io reconnection error:', error.message || error);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('Socket.io reconnection failed after all attempts');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      setIsConnected(false);
      const errorMessage = error.message || String(error);
      // Filter out expected WebSocket fallback errors - these are normal when socket.io
      // tries websocket first and falls back to polling
      const isExpectedFallbackError = 
        errorMessage.includes('WebSocket is closed') || 
        errorMessage.includes('closed before the connection is established') ||
        errorMessage.includes('websocket error') ||
        errorMessage.includes('transport unknown');
      
      // Only log unexpected errors
      if (!isExpectedFallbackError) {
        console.warn('Display socket connection error:', errorMessage);
      }
    });

    // Multi-screen sync events
    newSocket.on('sync:display', guard((payload) => {
      if (payload.type === 'update') {
        if (payload.currentPlayer) setCurrentPlayer(payload.currentPlayer);
        if (payload.currentBid !== undefined) setCurrentBid(payload.currentBid);
        if (payload.leadingTeam) setLeadingTeam(payload.leadingTeam);
        if (payload.timer !== undefined) setTimer(payload.timer);
      }
    }));

    newSocket.on('player:next', guard((payload) => {
      // Clear sold animation when next player is loaded
      if (soldAnimationTimeoutRef.current) {
        clearTimeout(soldAnimationTimeoutRef.current);
        soldAnimationTimeoutRef.current = null;
      }
      setSoldAnimation(null);
      
      if (payload.player) {
        // Clear any existing animation and timeout
        if (nextPlayerAnimationRef.current) {
          cancelAnimationFrame(nextPlayerAnimationRef.current);
          nextPlayerAnimationRef.current = null;
        }
        if (nextPlayerAnimationTimeoutRef.current) {
          clearTimeout(nextPlayerAnimationTimeoutRef.current);
          nextPlayerAnimationTimeoutRef.current = null;
        }
        if (fadeOutTimeoutRef.current) {
          clearTimeout(fadeOutTimeoutRef.current);
          fadeOutTimeoutRef.current = null;
        }
        
        // Skip animation - directly show the new player
        setIsNextPlayerAnimating(false);
        setPlayerSwitchAnimation('idle');
        setCurrentPlayer(payload.player);
        setCurrentBid(0);
        setLeadingTeam(null);
      } else {
        // No player data
        setCurrentPlayer(payload.player);
        setCurrentBid(0);
        setLeadingTeam(null);
      }
      if (payload.timerSeconds !== undefined) setTimer(payload.timerSeconds || 30);
      // Debounced fetch - not critical for immediate update
      fetchCurrentState();
      playSound('bid');
    }));

    newSocket.on('bid:update', guard((payload) => {
      if (currentPlayerRef.current && currentPlayerRef.current._id === payload.playerId) {
        setCurrentBid(payload.bidAmount);
        setLeadingTeam(payload.teamName);
        if (payload.timerSeconds !== undefined) setTimer(payload.timerSeconds || 30);
        playSound('bid');
        setCommentary(`${payload.teamName} bids ₹${payload.bidAmount.toLocaleString('en-IN')}!`);
      }
      // Debounced fetch - bid updates are frequent, no need for immediate fetch
      // fetchCurrentState already fetches teams data, so no need for fetchTeamsData
      fetchCurrentState();
    }));

    newSocket.on('player:sold', guard((payload) => {
      setSoldAnimation({
        playerName: payload.playerName,
        teamName: payload.teamName,
        price: payload.soldPrice
      });
      triggerConfetti();
      playSound('sold');
      setCommentary(`🎉 ${payload.playerName} sold to ${payload.teamName} for ₹${payload.soldPrice.toLocaleString('en-IN')}!`);
      
      // Clear any existing timeout - popup stays visible until next player loads
      if (soldAnimationTimeoutRef.current) {
        clearTimeout(soldAnimationTimeoutRef.current);
        soldAnimationTimeoutRef.current = null;
      }
      
      // Immediate fetch for critical event - player sold is important
      fetchCurrentState(true);
    }));

    newSocket.on('player:unsold', guard(() => {
      playSound('unsold');
      setCommentary('Player marked as unsold');
      // Debounced fetch - not critical
      fetchCurrentState();
    }));

    newSocket.on('auction:start', guard(() => {
      setAuctionStatus('running');
      setTimer(30);
      // Immediate fetch for critical event
      fetchCurrentState(true);
      playSound('bid');
    }));

    newSocket.on('auction:pause', guard(() => {
      setAuctionStatus('paused');
    }));

    newSocket.on('auction:resume', guard(() => {
      setAuctionStatus('running');
      setTimer(30);
      // Debounced fetch - not critical
      fetchCurrentState();
    }));

    newSocket.on('auction:last-call-started', guard((payload = {}) => {
      setAuctionStatus('running');
      if (payload.timerSeconds !== undefined) {
        setTimer(payload.timerSeconds || 10);
      }
      // Debounced fetch - not critical
      fetchCurrentState();
    }));

    newSocket.on('auction:last-call-withdrawn', guard((payload = {}) => {
      setAuctionStatus('running');
      if (payload.timerSeconds !== undefined) {
        setTimer(payload.timerSeconds || 30);
      }
      // Debounced fetch - not critical
      fetchCurrentState();
    }));

    newSocket.on('auction:end', guard((payload = {}) => {
      setAuctionStatus('completed');
      setCurrentPlayer(null);
      triggerConfetti();
      // Immediate fetch for critical event
      fetchCurrentState(true);
    }));

    newSocket.on('sound:play', guard((payload) => {
      if (payload.sound) {
        playSound(payload.sound);
      }
    }));

    newSocket.on('commentary:update', guard((payload) => {
      if (payload.text) {
        setCommentary(payload.text);
      }
    }));

    // Fixture generation events
    newSocket.on('fixtures:generated', guard(async (payload) => {
      try {
        // Fetch the generated fixtures
        const fixturesRes = await axios.get(
          `${API_BASE_URL}/api/fixtures/${tournamentCode}`
        );
        
        if (fixturesRes.data.success && fixturesRes.data.matches) {
          setFixturesData({
            matches: fixturesRes.data.matches,
            fixtureType: payload.fixtureType,
            matchCount: payload.matchCount
          });
          setBroadcastMode('fixtures');
          setIsFixturesAnimating(true);
          setFixturesAnimationProgress(0);
          
          // Start fixture animation
          startFixturesAnimation(() => {
            setIsFixturesAnimating(false);
          });
        }
      } catch (err) {
        console.error('Error fetching fixtures:', err);
      }
    }));

    // Grouping team picked event (for wheel animation)
    newSocket.on('grouping:team-picked', guard(async (payload) => {
      if (payload.tournamentCode === tournamentCode) {
        setBroadcastMode('grouping');
        setIsGroupingAnimating(true);
        
        // Clear any existing timers
        if (groupingTimerIntervalRef.current) {
          clearInterval(groupingTimerIntervalRef.current);
          groupingTimerIntervalRef.current = null;
        }
        if (groupingTimerTimeoutRef.current) {
          clearTimeout(groupingTimerTimeoutRef.current);
          groupingTimerTimeoutRef.current = null;
        }
        
        // Fetch available teams and update state
        try {
          const token = localStorage.getItem('token');
          const pickingStateRes = await axios.get(
            `${API_BASE_URL}/api/grouping/${tournamentCode}/picking-state`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          if (pickingStateRes.data.success && pickingStateRes.data.initialized) {
            setGroupingSelectedTeam(payload.team._id);
            setGroupingSpinDelay(payload.spinDelay || 3000);
            
            // Update groups display
            setGroupingCurrentGroups(pickingStateRes.data.groups || []);
            
            // Store group name for display
            setGroupingData({
              groupName: payload.groupName,
              selectedTeam: payload.team
            });

            // Start timer animation
            const countdownSeconds = Math.ceil((payload.spinDelay || 3000) / 1000);
            setGroupingTimerCountdown(countdownSeconds);
            setGroupingTimerActive(true);
            setGroupingSelectedTeam(null); // Hide team during countdown

            // Countdown interval
            let currentCount = countdownSeconds;
            groupingTimerIntervalRef.current = setInterval(() => {
              currentCount -= 1;
              setGroupingTimerCountdown(currentCount);
              
              if (currentCount <= 0) {
                clearInterval(groupingTimerIntervalRef.current);
                groupingTimerIntervalRef.current = null;
                
                // Show selected team
                setGroupingSelectedTeam(payload.team._id);
                
                // Play sound and trigger confetti
                playSound('clapping');
                
                // Hide timer and show team for 2 seconds, then refresh
                groupingTimerTimeoutRef.current = setTimeout(() => {
                  setGroupingTimerActive(false);
                  setGroupingTimerCountdown(0);
                  setIsGroupingAnimating(false);
                  setGroupingSelectedTeam(null);
                  handleWheelSpinComplete();
                }, 2000);
              }
            }, 1000);
          }
        } catch (error) {
          console.error('Error fetching picking state:', error);
          // Fallback: use the team from payload
          setGroupingSelectedTeam(payload.team._id);
          setGroupingSpinDelay(payload.spinDelay || 3000);
          setGroupingData({
            groupName: payload.groupName,
            selectedTeam: payload.team
          });
          
          // Start timer even on fallback
          const countdownSeconds = Math.ceil((payload.spinDelay || 3000) / 1000);
          setGroupingTimerCountdown(countdownSeconds);
          setGroupingTimerActive(true);
          setGroupingSelectedTeam(null);

          let currentCount = countdownSeconds;
          groupingTimerIntervalRef.current = setInterval(() => {
            currentCount -= 1;
            setGroupingTimerCountdown(currentCount);
            
            if (currentCount <= 0) {
              clearInterval(groupingTimerIntervalRef.current);
              groupingTimerIntervalRef.current = null;
              setGroupingSelectedTeam(payload.team._id);
              playSound('clapping');
              
              groupingTimerTimeoutRef.current = setTimeout(() => {
                setGroupingTimerActive(false);
                setGroupingTimerCountdown(0);
                setIsGroupingAnimating(false);
                setGroupingSelectedTeam(null);
                handleWheelSpinComplete();
              }, 2000);
            }
          }, 1000);
        }
      }
    }));

    // Grouping broadcast events
    newSocket.on('grouping:broadcast', guard((payload) => {
      // Collect all teams from groups for animation
      const allTeams = [];
      if (payload.groups && payload.groups.length > 0) {
        payload.groups.forEach(group => {
          if (group.teams && group.teams.length > 0) {
            allTeams.push(...group.teams);
          }
        });
      }
      
      setAllTeamsForAnimation(allTeams);
      setGroupingData(payload);
      setBroadcastMode('grouping');
      setIsGroupingAnimating(true);
      setGroupingAnimationProgress(0);
      
      // Start grouping animation (no wheel, just progress)
      startGroupingWheelAnimation(allTeams, () => {
        setIsGroupingAnimating(false);
        // Ensure groupingData is preserved for display
        setGroupingData(payload);
      });
    }));

    // End grouping broadcast event
    newSocket.on('grouping:end-broadcast', guard((payload) => {
      // Stop the grouping animation
      if (groupingAnimationRef.current) {
        cancelAnimationFrame(groupingAnimationRef.current);
        groupingAnimationRef.current = null;
      }
      setIsGroupingAnimating(false);
      setBroadcastMode('auction'); // Return to auction mode
      setGroupingData(null);
      setAllTeamsForAnimation([]);
      setGroupingAnimationProgress(0);
    }));

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (soldAnimationTimeoutRef.current) {
        clearTimeout(soldAnimationTimeoutRef.current);
      }
      // Cleanup animation refs
      if (nextPlayerAnimationRef.current) {
        cancelAnimationFrame(nextPlayerAnimationRef.current);
        nextPlayerAnimationRef.current = null;
      }
      if (nextPlayerAnimationTimeoutRef.current) {
        clearTimeout(nextPlayerAnimationTimeoutRef.current);
        nextPlayerAnimationTimeoutRef.current = null;
      }
      // Cancel any pending fetch requests
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
        fetchAbortControllerRef.current = null;
      }
      if (fetchDebounceTimeoutRef.current) {
        clearTimeout(fetchDebounceTimeoutRef.current);
        fetchDebounceTimeoutRef.current = null;
      }
      if (reconnectionMessageTimeoutRef.current) {
        clearTimeout(reconnectionMessageTimeoutRef.current);
        reconnectionMessageTimeoutRef.current = null;
      }
      // Cleanup grouping animation
      if (groupingAnimationRef.current) {
        cancelAnimationFrame(groupingAnimationRef.current);
        groupingAnimationRef.current = null;
      }
      // Reset first connection flag on cleanup
      isFirstConnectionRef.current = true;
      lastReconnectionMessageTimeRef.current = 0;
    };
  }, [tournamentCode, fetchCurrentState, playSound, triggerConfetti, startFixturesAnimation, startGroupingWheelAnimation, broadcastMode, currentPlayer, tournament]);

  // Timer countdown
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    // Only run timer if timer is enabled in settings
    const timerEnabled = tournament?.auctionAdvancedSettings?.timerEnabled !== false;
    if (auctionStatus === 'running' && timer > 0 && timerEnabled) {
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            playSound('timer');
            return 0;
          }
          if (prev <= 5) {
            playSound('timer');
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [auctionStatus, timer, playSound, tournament?.auctionAdvancedSettings?.timerEnabled]);

  // Auto-refresh fallback (with longer interval to prevent resource exhaustion)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isConnected && !fetchPendingRef.current) {
        fetchCurrentState(true);
      }
    }, 15000); // Every 15 seconds if disconnected (increased from 10s)

    return () => clearInterval(interval);
  }, [isConnected, fetchCurrentState]);

  // Scroll detection for hiding banner on mobile
  useEffect(() => {
    const handleScroll = () => {
      // Only apply on mobile screens (max-width: 768px)
      if (window.innerWidth > 768) {
        setIsBannerHidden(false);
        return;
      }

      const currentScrollY = window.scrollY || window.pageYOffset;
      const scrollThreshold = 50; // Minimum scroll distance to trigger hide/show

      if (currentScrollY > lastScrollYRef.current && currentScrollY > scrollThreshold) {
        // Scrolling down - hide banner
        setIsBannerHidden(true);
      } else if (currentScrollY < lastScrollYRef.current) {
        // Scrolling up - show banner
        setIsBannerHidden(false);
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Removed: Rotate between bid history and team budget views
  // Bid history view rotation has been removed as requested

  const getPlayerPhotoUrl = (photo) => {
    if (!photo) return `${API_BASE_URL}/default-photo.png`;
    if (photo.startsWith('http://') || photo.startsWith('https://')) return photo;
    if (photo.startsWith('/')) return `${API_BASE_URL}${photo}`;
    return `${API_BASE_URL}/${photo}`;
  };

  // Format player ID by removing leading zeros
  // 001 → 01, 018 → 18
  const formatPlayerId = (playerId) => {
    if (!playerId) return 'N/A';
    
    // Extract the numeric part
    let idPart = '';
    if (playerId.includes('-')) {
      idPart = playerId.split('-').pop();
    } else {
      // Remove any prefix (letters/numbers) and get the numeric part
      idPart = playerId.replace(/^[A-Z0-9]+-?/, '').replace(/^[A-Z]+/, '') || playerId.slice(-4);
    }
    
    // Remove all leading zeros
    let numericPart = idPart.replace(/^0+/, '');
    
    // If all zeros were removed and result is empty, return '00'
    if (numericPart === '') return '00';
    
    // If result is a single digit, pad it to 2 digits (001 → 1 → 01)
    // If result is already 2+ digits, keep as is (018 → 18)
    if (numericPart.length === 1) {
      return numericPart.padStart(2, '0');
    }
    
    return numericPart;
  };

  // Fetch all sold players and group by team
  const fetchTeamSlideshowData = useCallback(async () => {
    try {
      // Fetch both players and teams in parallel
      const [playersRes, teamsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/players/${tournamentCode}`),
        axios.get(`${API_BASE_URL}/api/auctions/live-teams/${tournamentCode}`)
      ]);
      
      if (playersRes.data.success && playersRes.data.players) {
        // Filter only sold players
        const soldPlayers = playersRes.data.players.filter(p => p.auctionStatus === 'Sold' && p.soldTo);
        
        // Get teams data
        const teamsData = teamsRes.data.success && teamsRes.data.teams ? teamsRes.data.teams : teams;
        
        // Group players by team
        const teamMap = new Map();
        
        soldPlayers.forEach(player => {
          const teamId = String(player.soldTo);
          if (!teamMap.has(teamId)) {
            // Find team info from teams data
            const teamInfo = teamsData.find(t => String(t._id) === teamId);
            if (teamInfo) {
              teamMap.set(teamId, {
                _id: teamInfo._id,
                name: teamInfo.name,
                logo: teamInfo.logo,
                players: []
              });
            } else {
              // If team not found, create basic entry
              teamMap.set(teamId, {
                _id: teamId,
                name: player.soldToName || 'Unknown Team',
                logo: null,
                players: []
              });
            }
          }
          teamMap.get(teamId).players.push({
            _id: player._id,
            name: player.name,
            photo: player.photo,
            playerId: player.playerId,
            role: player.role,
            soldPrice: player.soldPrice
          });
        });
        
        // Convert map to array and sort by team name
        const teamSlideshowArray = Array.from(teamMap.values())
          .filter(team => team.players.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setTeamSlideshowData(teamSlideshowArray);
        setIsSlideshowActive(teamSlideshowArray.length > 0);
        setCurrentTeamIndex(0);
      }
    } catch (err) {
      console.error('Error fetching team slideshow data:', err);
    }
  }, [tournamentCode, teams]);

  // Check if all players are sold and fetch slideshow data
  useEffect(() => {
    const allPlayersSold = summary && summary.totalPlayers > 0 && (
      summary.remaining === 0 || 
      summary.auctioned === summary.totalPlayers
    );
    
    if (allPlayersSold && teamSlideshowData.length === 0) {
      fetchTeamSlideshowData();
    } else if (!allPlayersSold) {
      // Reset slideshow when auction is not completed
      setTeamSlideshowData([]);
      setIsSlideshowActive(false);
      setCurrentTeamIndex(0);
    }
  }, [summary, fetchTeamSlideshowData, teamSlideshowData.length]);

  // Auto-advance slideshow
  useEffect(() => {
    if (!isSlideshowActive || teamSlideshowData.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentTeamIndex(prev => (prev + 1) % teamSlideshowData.length);
    }, 5000); // Change team every 5 seconds
    
    return () => clearInterval(interval);
  }, [isSlideshowActive, teamSlideshowData.length]);

  const getTournamentLogoUrl = (logo) => {
    if (!logo) return null;
    if (logo.startsWith('http://') || logo.startsWith('https://')) return logo;
    if (logo.startsWith('uploads')) {
      return `${API_BASE_URL}/${logo}`;
    }
    if (logo.startsWith('/')) {
      return `${API_BASE_URL}${logo}`;
    }
    return `${API_BASE_URL}/${logo}`;
  };

  const appLogoUrl = `${process.env.PUBLIC_URL || ''}/logo512.png`;

  const renderAppLogo = () => (
    <div className="live-display-logo">
      <img src={appLogoUrl} alt="PlayLive" />
    </div>
  );

  // Grouping Display Mode
  if (broadcastMode === 'grouping' && groupingData) {
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

    return (
      <div ref={containerRef} className={`live-display-container grouping-display ${theme}-theme`}>
        {/* Timer Animation Phase */}
        {isGroupingAnimating && groupingTimerActive && (
          <div className="grouping-wheel-live-container">
            <div className="grouping-wheel-live-header">
              <h1 className="grouping-wheel-live-title">🎯 PICKING TEAM</h1>
              <h2 className="grouping-wheel-live-subtitle">{tournament?.name || 'Tournament'}</h2>
              {groupingData?.groupName && (
                <h3 className="grouping-wheel-live-group">Group {groupingData.groupName}</h3>
              )}
            </div>
            <div className="grouping-timer-live-content">
              {groupingTimerCountdown > 0 ? (
                <div className="grouping-timer-countdown">
                  <div className="timer-number">{groupingTimerCountdown}</div>
                  <div className="timer-label">Picking Team...</div>
                </div>
              ) : groupingSelectedTeam && groupingData?.selectedTeam ? (
                <div className="grouping-selected-team-live">
                  <div className="selected-team-logo-large-live">
                    <img
                      src={buildLogoUrl(groupingData.selectedTeam.logo)}
                      alt={groupingData.selectedTeam.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = 'flex';
                        }
                      }}
                    />
                    <div 
                      className="selected-team-logo-placeholder-large-live"
                      style={{ display: groupingData.selectedTeam.logo ? 'none' : 'flex' }}
                    >
                      {groupingData.selectedTeam.name?.charAt(0) || '?'}
                    </div>
                  </div>
                  <div className="selected-team-name-live">{groupingData.selectedTeam.name}</div>
                  {groupingData.selectedTeam.city && (
                    <div className="selected-team-city-live">📍 {groupingData.selectedTeam.city}</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Grouping Animation Phase - Progress Bar (for broadcast mode) */}
        {isGroupingAnimating && allTeamsForAnimation.length > 0 && !groupingSelectedTeam && (
          <div className="grouping-wheel-animation-container">
            <div className="grouping-wheel-animation-header">
              <h1 className="grouping-wheel-title">🎯 GROUPING IN PROGRESS</h1>
              <h2 className="grouping-wheel-subtitle">{tournament?.name || 'Tournament'}</h2>
              <div className="grouping-progress-bar">
                <div 
                  className="grouping-progress-fill" 
                  style={{ width: `${groupingAnimationProgress}%` }}
                ></div>
              </div>
              <div className="grouping-progress-text">
                {Math.round(groupingAnimationProgress)}% Complete
              </div>
            </div>
          </div>
        )}

        {/* Final Groups Display - Show after animation completes or when groups are available */}
        {!isGroupingAnimating && (groupingData?.groups?.length > 0 || groupingCurrentGroups.length > 0) && !groupingSelectedTeam && (
          <div className="grouping-final-display">
            <div className="grouping-broadcast-header">
              <h1 className="grouping-broadcast-title">🎯 TEAM GROUPING</h1>
              <h2 className="grouping-broadcast-subtitle">{tournament?.name || 'Tournament'}</h2>
            </div>
            <div className="grouping-broadcast-content">
              {(groupingData?.groups || groupingCurrentGroups).map((group, index) => (
                <div key={group.name} className="grouping-broadcast-group" style={{ animationDelay: `${index * 0.2}s` }}>
                  <div className="grouping-broadcast-group-header">
                    <h3 className="grouping-broadcast-group-name">GROUP {group.name}</h3>
                    <span className="grouping-broadcast-group-count">{group.teams?.length || 0} Teams</span>
                  </div>
                  <div className="grouping-broadcast-teams">
                    {group.teams && group.teams.map((team, teamIndex) => (
                      <div 
                        key={team._id || teamIndex} 
                        className="grouping-broadcast-team"
                        style={{ animationDelay: `${(index * 0.2) + (teamIndex * 0.1)}s` }}
                      >
                        <div className="grouping-broadcast-team-logo">
                          {team.logo ? (
                            <img 
                              src={buildLogoUrl(team.logo)} 
                              alt={team.name}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) {
                                  e.target.nextSibling.style.display = 'flex';
                                }
                              }}
                            />
                          ) : (
                            <div className="grouping-broadcast-team-placeholder">🏆</div>
                          )}
                        </div>
                        <div className="grouping-broadcast-team-info">
                          <div className="grouping-broadcast-team-name">{team.name}</div>
                          {team.city && (
                            <div className="grouping-broadcast-team-city">{team.city}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="grouping-broadcast-footer">
              <span>🎉 Groups Generated Successfully!</span>
            </div>
          </div>
        )}
        <div id="confetti-container" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10000 }}></div>
      </div>
    );
  }

  // Fixtures Display Mode
  if (broadcastMode === 'fixtures' && fixturesData) {
    return (
      <div ref={containerRef} className={`live-display-container fixtures-display ${theme}-theme`}>
        {/* Animation Phase */}
        {isFixturesAnimating && (
          <div className="fixtures-animation-container">
            <div className="fixtures-animation-header">
              <h1 className="fixtures-animation-title">🎯 GENERATING FIXTURES</h1>
              <h2 className="fixtures-animation-subtitle">{tournament?.name || 'Tournament'}</h2>
              <div className="fixtures-progress-bar">
                <div 
                  className="fixtures-progress-fill" 
                  style={{ width: `${fixturesAnimationProgress}%` }}
                ></div>
              </div>
              <div className="fixtures-progress-text">
                {Math.round(fixturesAnimationProgress)}% Complete
              </div>
              <div className="fixtures-animation-icon">⚽</div>
            </div>
          </div>
        )}

        {/* Final Fixtures Display */}
        {!isFixturesAnimating && (
          <div className="fixtures-final-display">
            <div className="fixtures-broadcast-header">
              <h1 className="fixtures-broadcast-title">📋 MATCH FIXTURES</h1>
              <h2 className="fixtures-broadcast-subtitle">{tournament?.name || 'Tournament'}</h2>
              <div className="fixtures-stats">
                <span>Total Matches: {fixturesData.matches.length}</span>
                <span>Type: {fixturesData.fixtureType || 'N/A'}</span>
              </div>
            </div>
            <div className="fixtures-broadcast-content">
              {(() => {
                // Group matches by round
                const matchesByRound = {};
                fixturesData.matches.forEach(match => {
                  if (!matchesByRound[match.round]) {
                    matchesByRound[match.round] = [];
                  }
                  matchesByRound[match.round].push(match);
                });
                const rounds = Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b));
                
                return rounds.map((round, roundIndex) => (
                  <div key={round} className="fixtures-round-section" style={{ animationDelay: `${roundIndex * 0.3}s` }}>
                    <h3 className="fixtures-round-header">Round {round}</h3>
                    <div className="fixtures-matches-grid">
                      {matchesByRound[round].map((match, matchIndex) => (
                        <div 
                          key={match._id || matchIndex} 
                          className="fixtures-match-card"
                          style={{ animationDelay: `${(roundIndex * 0.3) + (matchIndex * 0.1)}s` }}
                        >
                          <div className="fixtures-match-number">Match #{match.matchNo}</div>
                          <div className="fixtures-match-teams">
                            <div className={`fixtures-match-team ${match.teamABye ? 'bye' : ''}`}>
                              {match.teamA ? (
                                <>
                                  {match.teamA.logo && (
                                    <img 
                                      src={match.teamA.logo.startsWith('http') ? match.teamA.logo : `${API_BASE_URL}/${match.teamA.logo}`} 
                                      alt={match.teamA.name}
                                      className="fixtures-team-logo"
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  )}
                                  <span>{match.teamA.name}</span>
                                </>
                              ) : (
                                <span className="fixtures-bye">BYE</span>
                              )}
                            </div>
                            <div className="fixtures-vs">VS</div>
                            <div className={`fixtures-match-team ${match.teamBBye ? 'bye' : ''}`}>
                              {match.teamB ? (
                                <>
                                  {match.teamB.logo && (
                                    <img 
                                      src={match.teamB.logo.startsWith('http') ? match.teamB.logo : `${API_BASE_URL}/${match.teamB.logo}`} 
                                      alt={match.teamB.name}
                                      className="fixtures-team-logo"
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  )}
                                  <span>{match.teamB.name}</span>
                                </>
                              ) : (
                                <span className="fixtures-bye">BYE</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
            <div className="fixtures-broadcast-footer">
              <span>🎉 Fixtures Generated Successfully!</span>
            </div>
          </div>
        )}
        {renderAppLogo()}
      </div>
    );
  }

  // Post-auction completion screen - show slideshow if all players sold
  if (auctionStatus === 'completed' || (summary && summary.totalPlayers > 0 && (summary.remaining === 0 || summary.auctioned === summary.totalPlayers))) {
    // If slideshow is active, show full-page slideshow
    if (isSlideshowActive && teamSlideshowData.length > 0) {
      const currentTeam = teamSlideshowData[currentTeamIndex];
      return (
        <div ref={containerRef} className={`live-display-container team-slideshow-fullpage ${theme}-theme`}>
          {/* Completion Message */}
          <div className="team-slideshow-completion-message-fullpage">
            <div className="completion-message-tournament-logo">
              {tournament?.logo ? (
                <img 
                  src={(() => {
                    const logo = tournament.logo;
                    if (!logo) return null;
                    if (logo.startsWith('http://') || logo.startsWith('https://')) return logo;
                    if (logo.startsWith('uploads')) {
                      return `${API_BASE_URL}/${logo}`;
                    }
                    if (logo.startsWith('/')) {
                      return `${API_BASE_URL}${logo}`;
                    }
                    return `${API_BASE_URL}/${logo}`;
                  })()}
                  alt={tournament?.name || 'Tournament Logo'}
                  onError={(e) => {
                    console.error('Failed to load tournament logo:', tournament.logo);
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) {
                      e.target.nextSibling.style.display = 'flex';
                    }
                  }}
                  onLoad={() => {
                    console.log('Tournament logo loaded successfully:', tournament.logo);
                  }}
                />
              ) : null}
              <div className="completion-message-tournament-logo-placeholder" style={{ display: tournament?.logo ? 'none' : 'flex' }}>
                🏆
              </div>
            </div>
            <div className="completion-message-text-content">
              {tournament?.name && (
                <h2 className="completion-message-tournament-name">{tournament.name}</h2>
              )}
              <h1 className="completion-message-title-fullpage">Auction Completed - All Players Sold</h1>
            </div>
          </div>
          
          {/* Side by Side Layout */}
          <div className="team-slideshow-fullpage-content">
            {/* Left Side - Team Info */}
            <div className="team-slideshow-left-panel">
              <div className="team-slideshow-header-fullpage">
                <div className="team-slideshow-logo-fullpage">
                  {currentTeam.logo ? (
                    <img 
                      src={currentTeam.logo.startsWith('http') ? currentTeam.logo : `${API_BASE_URL}/${currentTeam.logo}`}
                      alt={currentTeam.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="team-slideshow-logo-placeholder-fullpage" style={{ display: currentTeam.logo ? 'none' : 'flex' }}>
                    🏆
                  </div>
                </div>
                <h2 className="team-slideshow-name-fullpage">{currentTeam.name}</h2>
              </div>
            </div>
            
            {/* Right Side - Players Grid */}
            <div className="team-slideshow-right-panel">
              <div className="team-slideshow-players-fullpage">
                {currentTeam.players.map((player, index) => (
                  <div 
                    key={player._id || index} 
                    className="team-slideshow-player-card-fullpage"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="team-slideshow-player-image-fullpage">
                      {player.photo ? (
                        <img
                          src={getPlayerPhotoUrl(player.photo)}
                          alt={player.name}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="team-slideshow-player-placeholder-fullpage" style={{ display: player.photo ? 'none' : 'flex' }}>
                        👤
                      </div>
                    </div>
                            <div className="team-slideshow-player-name-fullpage">{player.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="team-slideshow-footer-fullpage">
            {renderAppLogo()}
            <p className="team-slideshow-footer-text">💙 Powered by PlayLive</p>
          </div>
        </div>
      );
    }
    
    // Fallback to original completed screen
    return (
      <div ref={containerRef} className={`live-display-container completed ${theme}-theme`}>
        <div className="live-display-completed">
          <div className="completed-header">
            <span className="completed-icon">🏁</span>
            <h1>AUCTION COMPLETED</h1>
            <span className="completed-icon">🏁</span>
          </div>
          <p className="completed-subtitle">
            See final results at PlayLive.com
          </p>
          <div className="completed-footer">
            <p>💙 Powered by PlayLive</p>
          </div>
        </div>
        {renderAppLogo()}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`live-display-container ${theme}-theme`}>
      <div id="confetti-container" className="confetti-container"></div>
      
      {/* Reconnection message */}
      {reconnected && (
        <div className="reconnection-message">
          ✅ Reconnected to live auction
        </div>
      )}

      {/* Main Content */}
      <div className="live-display-main">
        {/* Top Banner */}
        <div className={`live-display-top-banner ${isBannerHidden ? 'banner-hidden' : ''}`}>
          <div className="banner-left">
            <div className="banner-clock" aria-label="Current time">
              {formattedTime}
            </div>
          </div>
          <div className="banner-center">
            {tournament?.logo ? (
              <img 
                src={getTournamentLogoUrl(tournament.logo)}
                alt={tournament?.name || 'Tournament Logo'}
                className="tournament-logo-banner"
                onError={(e) => {
                  console.error('Failed to load tournament logo:', tournament.logo, 'URL:', getTournamentLogoUrl(tournament.logo));
                  e.target.style.display = 'none';
                }}
                onLoad={() => {
                  console.log('Tournament logo loaded successfully:', tournament.logo);
                }}
              />
            ) : (
              <div className="tournament-logo-placeholder"></div>
            )}
            <h1 className="tournament-name">{tournament?.name || 'Live Auction'}</h1>
          </div>
          <div className="banner-controls">
            {canFullscreen && (
              <button
                className="fullscreen-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? '⤓' : '⤢'}
              </button>
            )}
          </div>
        </div>

        {/* Two Column Layout */}
        {displayView === 'main' && (
        <div className="live-display-content-grid">
          {/* Left Side - Current Bid & Player Details */}
          <div className="live-display-left-panel">
            {/* Current Bid Details */}
            <div className="current-bid-section">
              {currentPlayer ? (
                <>
                  <div className="bid-amount-large">
                    ₹{currentBid.toLocaleString('en-IN') || (currentPlayer.basePrice || 0).toLocaleString('en-IN')}
                  </div>
                  {leadingTeam && (
                    <div className="leading-team-info">
                      <span className="leading-label">🏆 Leading:</span>
                      <span className="leading-team-name">{leadingTeam}</span>
                    </div>
                  )}
                  {auctionStatus === 'running' && tournament?.auctionAdvancedSettings?.timerEnabled !== false && (
                    <div className={`timer-display-inline ${timer <= 5 ? 'urgent' : ''}`}>
                      <span className="timer-label-inline">Time:</span>
                      <span className="timer-value-inline">{timer}s</span>
                    </div>
                  )}
                </>
              ) : (() => {
                // Check if all players are sold
                const allPlayersSold = summary && summary.totalPlayers > 0 && (
                  summary.remaining === 0 || 
                  summary.auctioned === summary.totalPlayers
                );
                
                // Only show "Waiting for auction to begin..." if not all players are sold
                if (allPlayersSold) {
                  return null;
                }
                
                return (
                  <div className="no-bid-info">
                    <p>Waiting for auction to begin...</p>
                  </div>
                );
              })()}
            </div>

            {/* Player Details Section - Moved from right panel */}
            {(() => {
              if (currentPlayer) {
                return (
                  <div className="player-details-section">
                    <div className="player-name-container">
                      <h2 className="player-name-large">{currentPlayer.name}</h2>
                    </div>
                    <div className="player-info-cards">
                      <div className="info-card">
                        <div className="info-card-icon">⚽</div>
                        <div className="info-card-content">
                          <span className="info-card-label">Role</span>
                          <span className="info-card-value">{currentPlayer.role || 'Player'}</span>
                        </div>
                      </div>
                      {currentPlayer.city && (
                        <div className="info-card">
                          <div className="info-card-icon">📍</div>
                          <div className="info-card-content">
                            <span className="info-card-label">City</span>
                            <span className="info-card-value">{currentPlayer.city}</span>
                          </div>
                        </div>
                      )}
                      {currentPlayer.state && (
                        <div className="info-card">
                          <div className="info-card-icon">🗺️</div>
                          <div className="info-card-content">
                            <span className="info-card-label">State</span>
                            <span className="info-card-value">{currentPlayer.state}</span>
                          </div>
                        </div>
                      )}
                      {currentPlayer.age && (
                        <div className="info-card">
                          <div className="info-card-icon">🎂</div>
                          <div className="info-card-content">
                            <span className="info-card-label">Age</span>
                            <span className="info-card-value">{currentPlayer.age} years</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Right Side - Player Image Only */}
          <div className="live-display-right-panel">
            {(() => {
              // Check if all players are sold
              const allPlayersSold = summary && summary.totalPlayers > 0 && (
                summary.remaining === 0 || 
                summary.auctioned === summary.totalPlayers
              );
              
              // If all players are sold but slideshow not ready, show loading message
              if (allPlayersSold && !isSlideshowActive) {
                // Show loading or waiting message while fetching slideshow data
                return (
                  <div className="player-content-wrapper auction-completed-section">
                    <div className="auction-completed-animation">
                      <div className="auction-completed-icon">🎉</div>
                      <h2 className="auction-completed-title">Auction Completed</h2>
                      <p className="auction-completed-message">All Player Sold</p>
                      <div className="auction-completed-app-info">
                        <div className="app-info-logo">
                          {renderAppLogo()}
                        </div>
                        <p className="app-info-text">💙 Powered by PlayLive</p>
                        <p className="app-info-details">Live Auction System</p>
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Otherwise show player image only
              return currentPlayer ? (
              /* Show current player image when no sold animation */
              <div className={`player-content-wrapper ${playerSwitchAnimation === 'fadeOut' ? 'fade-out' : ''} ${playerSwitchAnimation === 'fadeIn' ? 'fade-in slide-zoom' : ''}`}>
                {/* Player Image */}
                {currentPlayer.photo ? (
                  <div className="player-image-wrapper">
                    <img
                      src={getPlayerPhotoUrl(currentPlayer.photo)}
                      alt={currentPlayer.name}
                      className="player-image-large"
                      onError={(e) => {
                        e.target.src = `${API_BASE_URL}/default-photo.png`;
                      }}
                    />
                    <div className="player-id-badge">
                      {formatPlayerId(currentPlayer.playerId)}
                    </div>
                  </div>
                ) : (
                  <div className="player-image-wrapper">
                    <div className="player-image-placeholder">
                      <span className="placeholder-icon">👤</span>
                    </div>
                    <div className="player-id-badge">
                      {formatPlayerId(currentPlayer.playerId)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-player-section">
                <div className="no-player-icon">⏳</div>
                <p className="no-player-text">Waiting for auction to begin...</p>
              </div>
            );
            })()}
          </div>
        </div>
        )}

        {/* Footer */}
        <div className="live-display-footer">
          <div className="footer-left">
            {renderAppLogo()}
          </div>
          <div className="footer-center">
            {summary?.lastSoldPlayer ? (
              <div className="last-sold-footer-info">
                <span className="last-sold-footer-label">Last Sold:</span>
                <span className="last-sold-footer-name">{summary.lastSoldPlayer.name}</span>
                {summary.lastSoldPlayer.playerId && (
                  <>
                    <span className="last-sold-footer-separator">#</span>
                    <span className="last-sold-footer-id">
                      {formatPlayerId(summary.lastSoldPlayer.playerId)}
                    </span>
                  </>
                )}
                <span className="last-sold-footer-separator">→</span>
                <span className="last-sold-footer-team">{summary.lastSoldPlayer.soldToName || 'N/A'}</span>
                <span className="last-sold-footer-separator">•</span>
                <span className="last-sold-footer-price">₹{Number(summary.lastSoldPlayer.soldPrice || 0).toLocaleString('en-IN')}</span>
              </div>
            ) : (
              <div className="last-sold-footer-info">
                <span className="last-sold-footer-placeholder">No player sold yet</span>
              </div>
            )}
          </div>
          <div className="footer-right">
            <p className="footer-branding">💙 Powered by PlayLive</p>
            <p className="footer-app-details">Live Auction System</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveDisplay;

