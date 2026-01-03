import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-stream.css';

function TournamentStream() {
  const { code } = useParams();
  const [tournament, setTournament] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [auctionStatus, setAuctionStatus] = useState('stopped');
  const [currentBid, setCurrentBid] = useState(0);
  const [leadingTeam, setLeadingTeam] = useState(null);
  const [leadingTeamData, setLeadingTeamData] = useState(null);
  const [timer, setTimer] = useState(30);
  const [isConnected, setIsConnected] = useState(false);
  const [teams, setTeams] = useState([]);
  const [summary, setSummary] = useState(null);
  const [soldAnimation, setSoldAnimation] = useState(null);
  const [unsoldAnimation, setUnsoldAnimation] = useState(null);
  const [reconnected, setReconnected] = useState(false);
  const [soundEnabled] = useState(true);
  const [streamUrl, setStreamUrl] = useState(null);
  const [videoMode, setVideoMode] = useState('overlay'); // 'overlay', 'pip', 'side', 'none'
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  
  // View mode system
  const [viewMode, setViewMode] = useState('playerPresentation');
  const [headerVisible, setHeaderVisible] = useState(true);
  const [bidHistory, setBidHistory] = useState([]);
  const [callCount, setCallCount] = useState(0);
  const [groupingData, setGroupingData] = useState(null);
  const [groupingMode, setGroupingMode] = useState('wheel'); // 'wheel', 'slot', 'shuffle'
  const [isGroupingAnimating, setIsGroupingAnimating] = useState(false);
  
  const socketRef = useRef(null);
  const currentPlayerRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const soldAnimationTimeoutRef = useRef(null);
  const headerTimeoutRef = useRef(null);
  const groupingWheelRef = useRef(null);
  const groupingAnimationRef = useRef(null);
  const groupingSlotRefs = useRef([]);
  const groupingCardRefs = useRef([]);

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

  // Confetti animation
  const triggerConfetti = useCallback(() => {
    const confettiContainer = document.getElementById('stream-confetti-container');
    if (!confettiContainer) return;
    
    for (let i = 0; i < 100; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'stream-confetti-piece';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.animationDelay = Math.random() * 2 + 's';
      confetti.style.backgroundColor = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#ffd700'][Math.floor(Math.random() * 6)];
      confettiContainer.appendChild(confetti);
      
      setTimeout(() => confetti.remove(), 4000);
    }
  }, []);

  // Header auto-hide logic
  const showHeader = useCallback(() => {
    setHeaderVisible(true);
    if (headerTimeoutRef.current) {
      clearTimeout(headerTimeoutRef.current);
    }
    headerTimeoutRef.current = setTimeout(() => {
      setHeaderVisible(false);
    }, 5000);
  }, []);

  useEffect(() => {
    showHeader();
    return () => {
      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }
    };
  }, [showHeader, currentPlayer, currentBid, soldAnimation]);

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

  // Helper functions
  const getPlayerPhotoUrl = (photo) => {
    if (!photo) return `${API_BASE_URL}/default-photo.png`;
    if (photo.startsWith('http://') || photo.startsWith('https://')) return photo;
    if (photo.startsWith('/')) return `${API_BASE_URL}${photo}`;
    return `${API_BASE_URL}/${photo}`;
  };

  const getTeamLogoUrl = (logo) => {
    if (!logo) return `${API_BASE_URL}/default-logo.png`;
    if (logo.startsWith('http://') || logo.startsWith('https://')) return logo;
    if (logo.startsWith('/')) return `${API_BASE_URL}${logo}`;
    return `${API_BASE_URL}/${logo}`;
  };

  const formatDateTime = () => {
    const now = new Date();
    const date = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return { date, time };
  };

  // Fetch current auction state
  const fetchCurrentState = useCallback(async () => {
    try {
      const [liveRes, teamsRes, summaryRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/auctions/live/${code}`),
        axios.get(`${API_BASE_URL}/api/auctions/live-teams/${code}`),
        axios.get(`${API_BASE_URL}/api/auctions/live-summary/${code}`).catch(() => ({ data: { summary: null } }))
      ]);

      setTournament(liveRes.data.tournament);
      const status = normalizeStatus(liveRes.data.auctionStatus || liveRes.data.status);
      setAuctionStatus(status);
      setCurrentPlayer(status === 'completed' ? null : liveRes.data.currentPlayer);
      setCurrentBid(liveRes.data.currentBid || liveRes.data.currentPlayer?.currentBid || 0);
      setLeadingTeam(liveRes.data.highestBidderName || liveRes.data.currentPlayer?.currentBidTeamName || null);
      
      // Set teams data
      if (teamsRes.data.success && teamsRes.data.teams) {
        setTeams(teamsRes.data.teams);
        
        // Find leading team data
        if (liveRes.data.highestBidderName) {
          const team = teamsRes.data.teams.find(t => t.name === liveRes.data.highestBidderName);
          if (team) setLeadingTeamData(team);
        }
      }
      
      // Set summary data
      if (summaryRes && summaryRes.data && summaryRes.data.summary) {
        setSummary(summaryRes.data.summary);
      }
      
      // Check for stream URL
      if (liveRes.data.tournament?.streamUrl || liveRes.data.tournament?.liveStreamUrl) {
        setStreamUrl(liveRes.data.tournament.streamUrl || liveRes.data.tournament.liveStreamUrl);
      }
      
      // Build bid history from current player
      if (liveRes.data.currentPlayer?.bidHistory && Array.isArray(liveRes.data.currentPlayer.bidHistory)) {
        const history = liveRes.data.currentPlayer.bidHistory
          .slice(-5)
          .map(bid => ({
            teamName: bid.teamName || 'Unknown',
            amount: bid.bidAmount || 0,
            time: bid.bidTime || new Date()
          }));
        setBidHistory(history);
      }
      
      setReconnected(false);
    } catch (err) {
      console.error('Error fetching current state:', err);
      if (err.response?.status === 403 || err.response?.data?.message?.includes('locked')) {
        setAuctionStatus('locked');
      }
    }
  }, [code, normalizeStatus]);

  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  // Team grouping animations
  const startWheelAnimation = useCallback((teams, onComplete) => {
    const wheel = groupingWheelRef.current;
    if (!wheel) return;
    
    setIsGroupingAnimating(true);
    let rotation = 0;
    const duration = 3500;
    const startTime = Date.now();
    const totalRotations = 8;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      rotation = 360 * totalRotations * (1 - easeOut);
      
      if (wheel) {
        wheel.style.transform = `rotate(${rotation}deg)`;
      }
      
      if (progress < 1) {
        groupingAnimationRef.current = requestAnimationFrame(animate);
      } else {
        setIsGroupingAnimating(false);
        if (onComplete) {
          setTimeout(() => {
            onComplete();
            triggerConfetti();
          }, 300);
        }
      }
    };
    
    if (groupingAnimationRef.current) {
      cancelAnimationFrame(groupingAnimationRef.current);
    }
    animate();
  }, [triggerConfetti]);

  const startSlotAnimation = useCallback((teams, groups, onComplete) => {
    setIsGroupingAnimating(true);
    const reels = groupingSlotRefs.current;
    const duration = 2500;
    
    reels.forEach((reel, index) => {
      if (!reel) return;
      setTimeout(() => {
        reel.classList.add('spinning');
        setTimeout(() => {
          reel.classList.remove('spinning');
          if (index === reels.length - 1) {
            setIsGroupingAnimating(false);
            if (onComplete) {
              setTimeout(() => {
                onComplete();
                triggerConfetti();
              }, 300);
            }
          }
        }, duration + (index * 200));
      }, index * 200);
    });
  }, [triggerConfetti]);

  const startCardAnimation = useCallback((teams, groups, onComplete) => {
    setIsGroupingAnimating(true);
    const cards = groupingCardRefs.current;
    const cardDuration = 1500;
    const cardDelay = 50;
    
    cards.forEach((card, index) => {
      if (!card) return;
      setTimeout(() => {
        card.classList.add('flying');
        const targetGroup = Math.floor(index / (teams.length / groups.length));
        card.style.setProperty('--target-x', `${targetGroup * (100 / groups.length)}%`);
      }, index * cardDelay);
    });
    
    setTimeout(() => {
      setIsGroupingAnimating(false);
      if (onComplete) {
        setTimeout(() => {
          onComplete();
          triggerConfetti();
        }, 300);
      }
    }, teams.length * cardDelay + cardDuration);
  }, [triggerConfetti]);

  // Socket connection
  useEffect(() => {
    fetchCurrentState();

    if (socketRef.current) {
      const oldSocket = socketRef.current;
      socketRef.current = null;
      
      const isConnecting = oldSocket.io && oldSocket.io.readyState === 'opening';
      
      if (isConnecting) {
        const cleanupAfterConnection = () => {
          try {
            oldSocket.removeAllListeners();
            oldSocket.disconnect();
          } catch (e) {}
        };
        oldSocket.once('connect', cleanupAfterConnection);
        oldSocket.once('connect_error', cleanupAfterConnection);
        setTimeout(cleanupAfterConnection, 500);
      } else {
        try {
          oldSocket.removeAllListeners();
          oldSocket.disconnect();
        } catch (e) {}
      }
    }

    const newSocket = io(API_BASE_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      forceNew: true,
      auth: { token: null }
    });
    
    socketRef.current = newSocket;

    const guard = (handler) => (payload = {}) => {
      if (payload.tournamentCode && payload.tournamentCode !== code) return;
      handler(payload);
    };

    newSocket.on('connect', () => {
      setIsConnected(true);
      setReconnected(true);
      setTimeout(() => setReconnected(false), 3000);
      fetchCurrentState();
      newSocket.emit('join-display', { tournamentCode: code, mode: 'spectator' });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      setIsConnected(false);
      const errorMessage = error.message || String(error);
      if (!errorMessage.includes('WebSocket is closed') && 
          !errorMessage.includes('closed before the connection is established')) {
        console.warn('Display socket connection error:', errorMessage);
      }
    });

    newSocket.on('sync:display', guard((payload) => {
      if (payload.type === 'update') {
        if (payload.currentPlayer) setCurrentPlayer(payload.currentPlayer);
        if (payload.currentBid !== undefined) setCurrentBid(payload.currentBid);
        if (payload.leadingTeam) setLeadingTeam(payload.leadingTeam);
        if (payload.timer !== undefined) setTimer(payload.timer);
      }
    }));

    newSocket.on('player:next', guard((payload) => {
      if (payload.player) {
        setCurrentPlayer(payload.player);
        setCurrentBid(0);
        setLeadingTeam(null);
        setLeadingTeamData(null);
        setBidHistory([]);
        setCallCount(0);
        setViewMode('playerPresentation');
        showHeader();
      }
      if (payload.timerSeconds !== undefined) setTimer(payload.timerSeconds || 30);
      fetchCurrentState();
      playSound('bid');
    }));

    newSocket.on('bid:update', guard((payload) => {
      if (currentPlayerRef.current && currentPlayerRef.current._id === payload.playerId) {
        setCurrentBid(payload.bidAmount);
        setLeadingTeam(payload.teamName);
        
        // Update bid history
        setBidHistory(prev => {
          const newHistory = [...prev, {
            teamName: payload.teamName,
            amount: payload.bidAmount,
            time: new Date()
          }].slice(-5);
          return newHistory;
        });
        
        // Find leading team data
        const team = teams.find(t => t.name === payload.teamName);
        if (team) setLeadingTeamData(team);
        
        if (payload.timerSeconds !== undefined) setTimer(payload.timerSeconds || 30);
        
        // Switch to live bidding view
        if (viewMode === 'playerPresentation') {
          setViewMode('liveBidding');
        }
        
        // Update call count based on timer
        if (payload.timerSeconds <= 10) {
          setCallCount(3); // Final call
        } else if (payload.timerSeconds <= 20) {
          setCallCount(2); // Second call
        } else {
          setCallCount(1); // First call
        }
        
        playSound('bid');
        showHeader();
      }
      fetchCurrentState();
    }));

    newSocket.on('player:sold', guard((payload) => {
      setSoldAnimation({
        playerName: payload.playerName,
        teamName: payload.teamName,
        price: payload.soldPrice,
        teamLogo: payload.teamLogo
      });
      setViewMode('soldAnimation');
      triggerConfetti();
      playSound('sold');
      showHeader();
      
      if (soldAnimationTimeoutRef.current) {
        clearTimeout(soldAnimationTimeoutRef.current);
      }
      soldAnimationTimeoutRef.current = setTimeout(() => {
        setSoldAnimation(null);
        setViewMode('playerPresentation');
      }, 4000);
      
      fetchCurrentState();
    }));

    newSocket.on('player:unsold', guard((payload) => {
      setUnsoldAnimation({
        playerName: payload.playerName || currentPlayerRef.current?.name || 'Player'
      });
      setViewMode('unsoldAnimation');
      playSound('unsold');
      showHeader();
      
      setTimeout(() => {
        setUnsoldAnimation(null);
        setViewMode('playerPresentation');
      }, 3000);
      
      fetchCurrentState();
    }));

    newSocket.on('grouping:broadcast', guard((payload) => {
      setGroupingData(payload);
      setGroupingMode(payload.mode || 'wheel');
      setViewMode('teamGrouping');
      showHeader();
      
      const allTeams = [];
      if (payload.groups && payload.groups.length > 0) {
        payload.groups.forEach(group => {
          if (group.teams && group.teams.length > 0) {
            allTeams.push(...group.teams);
          }
        });
      }
      
      setIsGroupingAnimating(true);
      
      const onComplete = () => {
        setIsGroupingAnimating(false);
      };
      
      if (payload.mode === 'slot') {
        startSlotAnimation(allTeams, payload.groups, onComplete);
      } else if (payload.mode === 'shuffle' || payload.mode === 'cards') {
        startCardAnimation(allTeams, payload.groups, onComplete);
      } else {
        startWheelAnimation(allTeams, onComplete);
      }
    }));

    newSocket.on('auction:start', guard(() => {
      setAuctionStatus('running');
      setTimer(30);
      setViewMode('playerPresentation');
      fetchCurrentState();
      playSound('bid');
      showHeader();
    }));

    newSocket.on('auction:pause', guard(() => {
      setAuctionStatus('paused');
    }));

    newSocket.on('auction:resume', guard(() => {
      setAuctionStatus('running');
      setTimer(30);
      fetchCurrentState();
      showHeader();
    }));

    newSocket.on('auction:end', guard((payload = {}) => {
      setAuctionStatus('completed');
      setCurrentPlayer(null);
      setViewMode('finalResults');
      triggerConfetti();
      fetchCurrentState();
    }));

    return () => {
      if (socketRef.current) {
        const socket = socketRef.current;
        socketRef.current = null;
        
        const isConnecting = socket.io && socket.io.readyState === 'opening';
        
        if (isConnecting) {
          const cleanupAfterConnection = () => {
            try {
              socket.removeAllListeners();
              socket.disconnect();
            } catch (e) {}
          };
          socket.once('connect', cleanupAfterConnection);
          socket.once('connect_error', cleanupAfterConnection);
          setTimeout(cleanupAfterConnection, 500);
        } else {
          try {
            socket.removeAllListeners();
            socket.disconnect();
          } catch (e) {}
        }
      }
      if (soldAnimationTimeoutRef.current) {
        clearTimeout(soldAnimationTimeoutRef.current);
      }
      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }
      if (groupingAnimationRef.current) {
        cancelAnimationFrame(groupingAnimationRef.current);
      }
    };
  }, [code, fetchCurrentState, playSound, triggerConfetti, showHeader, viewMode, teams, startWheelAnimation, startSlotAnimation, startCardAnimation]);

  // Timer countdown
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    if (auctionStatus === 'running' && timer > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            playSound('timer');
            return 0;
          }
          if (prev <= 5) {
            playSound('timer');
            setCallCount(3);
          } else if (prev <= 10) {
            setCallCount(2);
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
  }, [auctionStatus, timer, playSound]);

  // Auto-refresh fallback
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isConnected) {
        fetchCurrentState();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected, fetchCurrentState]);

  // Render video iframe with proper URL handling
  const renderVideoStream = () => {
    if (!streamUrl || videoMode === 'none') return null;
    
    // Convert YouTube URL to embed format
    let embedUrl = streamUrl;
    if (streamUrl.includes('youtube.com/watch')) {
      const videoId = streamUrl.split('v=')[1]?.split('&')[0];
      if (videoId) {
        embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isVideoMuted ? 1 : 0}`;
      }
    } else if (streamUrl.includes('youtu.be/')) {
      const videoId = streamUrl.split('youtu.be/')[1]?.split('?')[0];
      if (videoId) {
        embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isVideoMuted ? 1 : 0}`;
      }
    } else if (streamUrl.includes('facebook.com')) {
      // Facebook Live embed handling
      embedUrl = streamUrl;
    }
    
    return (
      <iframe
        src={embedUrl}
        title="Live Stream"
        className={`stream-video-iframe stream-video-${videoMode}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  };

  // Post-auction completion screen
  if (auctionStatus === 'completed' && viewMode === 'finalResults') {
    return (
      <div className="tournament-stream-container completed">
        <div id="stream-confetti-container" className="stream-confetti-container"></div>
        {renderVideoStream() && videoMode === 'overlay' && (
          <div className="stream-video-background">{renderVideoStream()}</div>
        )}
        <div className="stream-final-results">
          <div className="stream-final-results-header">
            <h1>AUCTION COMPLETED</h1>
            <p>Final Results</p>
          </div>
          <div className="stream-final-results-content">
            {teams.map((team, index) => (
              <div key={team._id || index} className="stream-final-team-card">
                <div className="stream-final-team-header">
                  {team.logo && (
                    <img src={getTeamLogoUrl(team.logo)} alt={team.name} className="stream-final-team-logo" />
                  )}
                  <h3>{team.name}</h3>
                </div>
                <div className="stream-final-team-stats">
                  <div className="stream-final-stat">
                    <span className="stream-final-stat-label">Players</span>
                    <span className="stream-final-stat-value">{team.playersBought || 0}</span>
                  </div>
                  <div className="stream-final-stat">
                    <span className="stream-final-stat-label">Total Spent</span>
                    <span className="stream-final-stat-value">₹{(team.totalSpent || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="stream-final-stat">
                    <span className="stream-final-stat-label">Remaining</span>
                    <span className="stream-final-stat-value">₹{(team.remaining || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="stream-final-footer">
            <p>💙 Powered by PlayLive</p>
          </div>
        </div>
      </div>
    );
  }

  const dateTime = formatDateTime();

  return (
    <div className="tournament-stream-container">
      <div id="stream-confetti-container" className="stream-confetti-container"></div>
      
      {/* Video Background/Overlay */}
      {renderVideoStream() && videoMode === 'overlay' && (
        <div className="stream-video-background">{renderVideoStream()}</div>
      )}
      
      {/* Reconnection message */}
      {reconnected && (
        <div className="stream-reconnection-message">
          ✅ Reconnected to live stream
        </div>
      )}

      {/* Auto-hiding Header Bar */}
      <div className={`stream-header-overlay ${headerVisible ? 'visible' : 'hidden'}`}>
        <div className="stream-header-content">
          {tournament?.logo && (
            <img 
              src={getTeamLogoUrl(tournament.logo)} 
              alt="Tournament Logo" 
              className="stream-header-logo"
            />
          )}
          <div className="stream-header-center">
            <h2 className="stream-header-title">{tournament?.name || 'Live Auction'}</h2>
          </div>
          <div className="stream-header-right">
            <span className="stream-header-date">{dateTime.date}</span>
            <span className="stream-header-venue">{tournament?.venue || tournament?.location || ''}</span>
          </div>
        </div>
      </div>

      {/* Main Display Zone */}
      <div className="stream-main-display">
        {/* Player Presentation View */}
        {viewMode === 'playerPresentation' && currentPlayer && (
          <div className="stream-view stream-view-player-presentation">
            <div className="stream-player-card-left">
              <div className="stream-player-photo-wrapper">
                <img
                  src={getPlayerPhotoUrl(currentPlayer.photo)}
                  alt={currentPlayer.name}
                  className="stream-player-photo-large"
                  onError={(e) => {
                    e.target.src = `${API_BASE_URL}/default-photo.png`;
                  }}
                />
                <div className="stream-player-photo-glow"></div>
              </div>
            </div>
            <div className="stream-player-card-right">
              <h1 className="stream-player-name-large">{currentPlayer.name}</h1>
              <div className="stream-player-info-grid">
                <div className="stream-player-info-item">
                  <span className="stream-player-info-label">Role</span>
                  <span className="stream-player-info-value">{currentPlayer.role || 'Player'}</span>
                </div>
                <div className="stream-player-info-item">
                  <span className="stream-player-info-label">Player ID</span>
                  <span className="stream-player-info-value">#{currentPlayer.playerId}</span>
                </div>
                <div className="stream-player-info-item">
                  <span className="stream-player-info-label">City</span>
                  <span className="stream-player-info-value">{currentPlayer.city || 'N/A'}</span>
                </div>
                <div className="stream-player-info-item">
                  <span className="stream-player-info-label">Mobile</span>
                  <span className="stream-player-info-value">{currentPlayer.mobile || 'N/A'}</span>
                </div>
              </div>
              <div className="stream-player-base-price-large">
                Base Price: ₹{(currentPlayer.basePrice || 0).toLocaleString('en-IN')}
              </div>
              {currentPlayer.registeredAt && (
                <div className="stream-player-badge">From Team Registration Form</div>
              )}
              
              {/* Bid Timeline Bar */}
              {bidHistory.length > 0 && (
                <div className="stream-bid-timeline">
                  <div className="stream-bid-timeline-label">Recent Bids</div>
                  <div className="stream-bid-timeline-items">
                    {bidHistory.map((bid, index) => (
                      <div key={index} className="stream-bid-timeline-item">
                        <span className="stream-bid-timeline-team">{bid.teamName}</span>
                        <span className="stream-bid-timeline-amount">₹{bid.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Bidding View */}
        {viewMode === 'liveBidding' && currentPlayer && (
          <div className="stream-view stream-view-live-bidding">
            <div className="stream-bidding-left">
              <div className="stream-player-card-compact">
                <img
                  src={getPlayerPhotoUrl(currentPlayer.photo)}
                  alt={currentPlayer.name}
                  className="stream-player-photo-compact"
                  onError={(e) => {
                    e.target.src = `${API_BASE_URL}/default-photo.png`;
                  }}
                />
                <div className="stream-player-name-compact">{currentPlayer.name}</div>
              </div>
            </div>
            <div className="stream-bidding-right">
              <div className="stream-bidding-panel">
                <div className="stream-current-bid-large">
                  <div className="stream-bid-label">Current Highest Bid</div>
                  <div className="stream-bid-amount-flip">₹{currentBid.toLocaleString('en-IN')}</div>
                </div>
                {leadingTeamData && (
                  <div className="stream-leading-team-display">
                    {leadingTeamData.logo && (
                      <img 
                        src={getTeamLogoUrl(leadingTeamData.logo)} 
                        alt={leadingTeamData.name}
                        className="stream-leading-team-logo"
                      />
                    )}
                    <span className="stream-leading-team-name">{leadingTeamData.name}</span>
                  </div>
                )}
                <div className="stream-call-indicator">
                  {callCount === 1 && <span className="stream-call-text stream-call-first">First Call</span>}
                  {callCount === 2 && <span className="stream-call-text stream-call-second">Second Call</span>}
                  {callCount === 3 && <span className="stream-call-text stream-call-final">Final Call</span>}
                </div>
                <div className={`stream-timer-circle ${timer <= 5 ? 'urgent' : timer <= 10 ? 'warning' : 'normal'}`}>
                  <svg className="stream-timer-svg" viewBox="0 0 120 120">
                    <circle
                      className="stream-timer-circle-bg"
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="8"
                    />
                    <circle
                      className="stream-timer-circle-progress"
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke={timer <= 5 ? '#ef4444' : timer <= 10 ? '#fbbf24' : '#10b981'}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(timer / 30) * 339.29} 339.29`}
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                  <div className="stream-timer-value-circle">{timer}s</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sold Animation */}
        {viewMode === 'soldAnimation' && soldAnimation && (
          <div className="stream-view stream-view-sold">
            <div className="stream-sold-content">
              <h1 className="stream-sold-title">PLAYER SOLD</h1>
              <div className="stream-sold-player-name">{soldAnimation.playerName}</div>
              {soldAnimation.teamLogo && (
                <div className="stream-sold-team-logo-explosion">
                  <img 
                    src={getTeamLogoUrl(soldAnimation.teamLogo)} 
                    alt={soldAnimation.teamName}
                    className="stream-sold-logo"
                  />
                </div>
              )}
              <div className="stream-sold-team-name">{soldAnimation.teamName}</div>
              <div className="stream-sold-price">
                <span className="stream-sold-price-label">Sold For</span>
                <span className="stream-sold-price-value">₹{soldAnimation.price.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Unsold Animation */}
        {viewMode === 'unsoldAnimation' && unsoldAnimation && (
          <div className="stream-view stream-view-unsold">
            <div className="stream-unsold-content">
              <div className="stream-unsold-icon">❌</div>
              <h1 className="stream-unsold-title">NO BIDS RECEIVED</h1>
              <div className="stream-unsold-player-name">{unsoldAnimation.playerName}</div>
              <div className="stream-unsold-message">Moved to unsold list</div>
            </div>
          </div>
        )}

        {/* Team Grouping View */}
        {viewMode === 'teamGrouping' && groupingData && (
          <div className="stream-view stream-view-grouping">
            {groupingMode === 'wheel' && (
              <div className="stream-grouping-wheel-container">
                <div className="stream-grouping-wheel" ref={groupingWheelRef}>
                  {groupingData.groups && groupingData.groups.map((group, groupIndex) => (
                    group.teams && group.teams.map((team, teamIndex) => {
                      const angle = (360 / (groupingData.groups.reduce((sum, g) => sum + (g.teams?.length || 0), 0))) * (groupIndex * (group.teams?.length || 0) + teamIndex);
                      return (
                        <div
                          key={team._id || `${groupIndex}-${teamIndex}`}
                          className="stream-wheel-team"
                          style={{
                            transform: `rotate(${angle}deg) translateY(-200px) rotate(-${angle}deg)`
                          }}
                        >
                          {team.logo ? (
                            <img src={getTeamLogoUrl(team.logo)} alt={team.name} className="stream-wheel-team-logo" />
                          ) : (
                            <div className="stream-wheel-team-placeholder">{team.name.charAt(0)}</div>
                          )}
                          <div className="stream-wheel-team-name">{team.name}</div>
                        </div>
                      );
                    })
                  ))}
                </div>
                <div className="stream-grouping-summary">
                  {groupingData.groups && groupingData.groups.map((group, index) => (
                    <div key={index} className="stream-group-item">
                      <h3>{group.name}</h3>
                      <div className="stream-group-teams">
                        {group.teams && group.teams.map(team => (
                          <span key={team._id} className="stream-group-team-name">{team.name}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {groupingMode === 'slot' && (
              <div className="stream-grouping-slot-container">
                {groupingData.groups && groupingData.groups.map((group, index) => (
                  <div key={index} className="stream-slot-column">
                    <div className="stream-slot-group-label">{group.name}</div>
                    <div 
                      className="stream-slot-reel"
                      ref={el => groupingSlotRefs.current[index] = el}
                    >
                      <div className="stream-slot-reel-content">
                        {group.teams && group.teams.map((team, teamIndex) => (
                          <div key={team._id || teamIndex} className="stream-slot-team">
                            {team.logo && (
                              <img src={getTeamLogoUrl(team.logo)} alt={team.name} />
                            )}
                            <span>{team.name}</span>
                          </div>
                        ))}
                        {group.teams && group.teams.map((team, teamIndex) => (
                          <div key={`dup-${team._id || teamIndex}`} className="stream-slot-team">
                            {team.logo && (
                              <img src={getTeamLogoUrl(team.logo)} alt={team.name} />
                            )}
                            <span>{team.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {(groupingMode === 'shuffle' || groupingMode === 'cards') && (
              <div className="stream-grouping-cards-container">
                {groupingData.groups && groupingData.groups.reduce((allTeams, group) => {
                  if (group.teams) allTeams.push(...group.teams);
                  return allTeams;
                }, []).map((team, index) => (
                  <div
                    key={team._id || index}
                    className="stream-card-shuffle"
                    ref={el => groupingCardRefs.current[index] = el}
                  >
                    <div className="stream-card-front">
                      {team.logo ? (
                        <img src={getTeamLogoUrl(team.logo)} alt={team.name} />
                      ) : (
                        <div className="stream-card-placeholder">{team.name.charAt(0)}</div>
                      )}
                      <div className="stream-card-name">{team.name}</div>
                    </div>
                  </div>
                ))}
                <div className="stream-grouping-cards-summary">
                  {groupingData.groups && groupingData.groups.map((group, index) => (
                    <div key={index} className="stream-card-group">
                      <h3>{group.name}</h3>
                      {group.teams && group.teams.map(team => (
                        <span key={team._id} className="stream-card-group-team">{team.name}</span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Team Comparison View */}
        {viewMode === 'teamComparison' && (
          <div className="stream-view stream-view-comparison">
            <h2 className="stream-comparison-title">Team Comparison</h2>
            <div className="stream-comparison-grid">
              {teams.map((team, index) => (
                <div key={team._id || index} className="stream-comparison-team-card">
                  {team.logo && (
                    <img src={getTeamLogoUrl(team.logo)} alt={team.name} className="stream-comparison-team-logo" />
                  )}
                  <h3>{team.name}</h3>
                  <div className="stream-comparison-stats">
                    <div className="stream-comparison-stat">
                      <span>Players: {team.playersBought || 0}</span>
                    </div>
                    <div className="stream-comparison-stat">
                      <span>Spent: ₹{(team.totalSpent || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="stream-comparison-stat">
                      <span>Remaining: ₹{(team.remaining || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Waiting State */}
        {!currentPlayer && viewMode === 'playerPresentation' && (
          <div className="stream-view stream-view-waiting">
            <div className="stream-waiting-content">
              <div className="stream-waiting-icon">⏳</div>
              <h2>Waiting for auction to begin...</h2>
            </div>
          </div>
        )}
      </div>

      {/* Video Picture-in-Picture or Side-by-Side */}
      {renderVideoStream() && (videoMode === 'pip' || videoMode === 'side') && (
        <div className={`stream-video-${videoMode}`}>
          {renderVideoStream()}
          <button 
            className="stream-video-mute-btn"
            onClick={() => setIsVideoMuted(!isVideoMuted)}
            title={isVideoMuted ? 'Unmute' : 'Mute'}
          >
            {isVideoMuted ? '🔇' : '🔊'}
          </button>
        </div>
      )}
    </div>
  );
}

export default TournamentStream;
