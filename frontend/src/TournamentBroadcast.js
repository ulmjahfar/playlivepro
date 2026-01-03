import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-admin-modern.css';
import './styles-broadcast.css';

function TournamentBroadcast() {
  const [tournament, setTournament] = useState(null);
  const [user] = useState(JSON.parse(localStorage.getItem('user')));
  const navigate = useNavigate();
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  // OBS shareable link example: /tournament/${code}/broadcast?obs=1
  const obsParam = searchParams.get('obs');
  const obsMode = obsParam === '1' || (obsParam || '').toLowerCase() === 'true';
  
  // Auction state
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [teams, setTeams] = useState([]);
  const [auctionStatus, setAuctionStatus] = useState('stopped');
  const [timer, setTimer] = useState(0);
  const [currentBid, setCurrentBid] = useState(0);
  const [leadingTeam, setLeadingTeam] = useState(null);
  const [summary, setSummary] = useState({
    totalPlayers: 0,
    auctioned: 0,
    remaining: 0,
    topBidders: [],
    mostExpensivePlayer: null,
    lastSoldPlayer: null
  });
  
  // UI state
  const [theme, setTheme] = useState('playlive'); // 'playlive' or 'tv'
  const [isMuted, setIsMuted] = useState(false);
  const [videoSource, setVideoSource] = useState(''); // YouTube URL, RTMP, or WebRTC
  const [showVideoSettings, setShowVideoSettings] = useState(false);
  const [newsItems, setNewsItems] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [socketConnected, setSocketConnected] = useState(false);
  const [auctionCompleted, setAuctionCompleted] = useState(false);
  const [completionSummary, setCompletionSummary] = useState(null);
  const [reportPlayers, setReportPlayers] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState('summary');
  const [broadcastMode, setBroadcastMode] = useState('auction'); // 'auction', 'grouping'
  const [groupingData, setGroupingData] = useState(null);
  const [isGroupingAnimating, setIsGroupingAnimating] = useState(false);
  const [groupingAnimationProgress, setGroupingAnimationProgress] = useState(0);
  const [allTeamsForAnimation, setAllTeamsForAnimation] = useState([]);
  
  const socketRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const clockIntervalRef = useRef(null);
  const bidGlowRef = useRef(null);
  const newsTickerRef = useRef(null);
  const groupingWheelRef = useRef(null);
  const groupingAnimationRef = useRef(null);

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
  }, [navigate]);

  // Update clock every second
  useEffect(() => {
    clockIntervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, []);

  // Format date/time
  const formatDateTime = (date) => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const day = days[date.getDay()];
    const month = months[date.getMonth()];
    const dayNum = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const mins = minutes.toString().padStart(2, '0');
    return {
      date: `${month} ${dayNum} ${day}`,
      time: `${hours12}:${mins} ${ampm}`
    };
  };

  // Fetch tournament and auction data
  const fetchAuctionData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const [tournamentRes, liveRes, teamsRes, summaryRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/auctions/live/${code}`),
        axios.get(`${API_BASE_URL}/api/auctions/live-teams/${code}`),
        axios.get(`${API_BASE_URL}/api/auctions/live-summary/${code}`)
      ]);

      setTournament(tournamentRes.data.tournament);
      
      const status = liveRes.data.auctionStatus || liveRes.data.status || 'stopped';
      setAuctionStatus(status === 'running' ? 'running' : status === 'completed' ? 'completed' : 'stopped');
      setCurrentPlayer(liveRes.data.currentPlayer || null);
      const fetchedTeams = teamsRes.data.teams || [];
      setTeams(fetchedTeams);
      setSummary(summaryRes.data.summary || {
        totalPlayers: 0,
        auctioned: 0,
        remaining: 0,
        topBidders: [],
        mostExpensivePlayer: null,
        lastSoldPlayer: null
      });
      
      if (liveRes.data.currentPlayer) {
        setCurrentBid(liveRes.data.currentPlayer.currentBid || liveRes.data.currentPlayer.basePrice || 0);
        if (liveRes.data.timerSeconds !== undefined) {
          setTimer(liveRes.data.timerSeconds);
        } else if (status === 'running') {
          setTimer(30); // Default timer
        }
        if (liveRes.data.currentPlayer.soldTo) {
          const team = fetchedTeams.find(t => t._id === liveRes.data.currentPlayer.soldTo) || 
                       fetchedTeams.find(t => t.name === liveRes.data.currentPlayer.soldToName);
          setLeadingTeam(team || null);
        } else if (liveRes.data.currentPlayer.highestBidder) {
          const team = fetchedTeams.find(t => 
            t._id === liveRes.data.currentPlayer.highestBidder ||
            t.name === liveRes.data.currentPlayer.highestBidderName
          );
          setLeadingTeam(team || null);
        }
      } else {
        setCurrentBid(0);
        setLeadingTeam(null);
        setTimer(0);
      }
      
      if (status === 'completed') {
        setAuctionCompleted(true);
        setCompletionSummary(liveRes.data.completionSummary);
      }
    } catch (err) {
      console.error('Error fetching auction data:', err);
    }
  }, [code]);

  // Fetch report data (players) when auction is completed
  const fetchReportData = useCallback(async () => {
    if (!code) return;
    
    setReportLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [playersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/players/tournament/${code}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setReportPlayers(playersRes.data.players || []);
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setReportLoading(false);
    }
  }, [code]);

  // Trigger confetti effect when grouping completes
  const triggerGroupingConfetti = () => {
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'grouping-confetti-container';
    document.body.appendChild(confettiContainer);

    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe'];
    for (let i = 0; i < 150; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'grouping-confetti-particle';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = Math.random() * 0.5 + 's';
      confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
      confettiContainer.appendChild(confetti);
    }

    setTimeout(() => {
      confettiContainer.remove();
    }, 4000);
  };

  // Start grouping wheel animation
  const startGroupingWheelAnimation = useCallback((teams, onComplete) => {
    if (!teams || teams.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    const duration = 3500; // 3.5 seconds
    const startTime = Date.now();
    const totalRotations = 8; // 8 full rotations
    let rotation = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic function
      const easeOut = 1 - Math.pow(1 - progress, 3);
      rotation = 360 * totalRotations * (1 - easeOut);
      
      // Update progress
      setGroupingAnimationProgress(progress * 100);

      if (groupingWheelRef.current) {
        groupingWheelRef.current.style.transform = `rotate(${rotation}deg)`;
      }

      if (progress < 1) {
        groupingAnimationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
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
  }, []);

  // Socket.io connection
  // Load saved video source
  useEffect(() => {
    if (code) {
      const savedSource = localStorage.getItem(`broadcast_video_${code}`);
      if (savedSource) {
        setVideoSource(savedSource);
      }
    }
  }, [code]);

  useEffect(() => {
    if (!code) return;

    fetchAuctionData();

    const token = localStorage.getItem('token');
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      auth: { token: token }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join-auction', { tournamentCode: code });
      fetchAuctionData();
    });

    socket.on('disconnect', (reason) => {
      console.log('Broadcast socket disconnected:', reason);
      setSocketConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.warn('Broadcast socket connection error:', error.message || error);
      setSocketConnected(false);
    });

    const guard = (handler) => (payload = {}) => {
      if (payload.tournamentCode && payload.tournamentCode !== code) return;
      handler(payload);
    };

    socket.on('player:next', guard((payload) => {
      if (payload.player) {
        setCurrentPlayer(payload.player);
        setCurrentBid(payload.player.currentBid || payload.player.basePrice || 0);
        setTimer(payload.timerSeconds || 30);
        setLeadingTeam(null);
        addNewsItem(`🔄 NEXT PLAYER: ${payload.player.name || 'Player'} - ${payload.player.role || 'Player'}`, 'info');
      }
      setAuctionStatus('running');
      fetchAuctionData();
    }));

    socket.on('bid:update', guard((payload) => {
      if (currentPlayer && currentPlayer._id === payload.playerId) {
        setCurrentBid(payload.bidAmount || payload.currentBid || 0);
        if (payload.timerSeconds !== undefined) {
          setTimer(payload.timerSeconds);
        }
        
        // Find leading team
        if (payload.leadingTeamId || payload.highestBidder || payload.highestBidderName) {
          const team = teams.find(t => 
            t._id === payload.leadingTeamId || 
            t._id === payload.highestBidder ||
            t.name === payload.highestBidderName
          );
          if (team) setLeadingTeam(team);
        }
        
        // Glow effect on bid
        if (bidGlowRef.current) {
          bidGlowRef.current.classList.add('bid-glow');
          setTimeout(() => {
            if (bidGlowRef.current) bidGlowRef.current.classList.remove('bid-glow');
          }, 500);
        }
        
        addNewsItem(`💰 BID: ₹${payload.bidAmount || payload.currentBid || 0} by ${payload.highestBidderName || 'Team'}`, 'bid');
      }
      fetchAuctionData();
    }));

    socket.on('player:sold', guard((payload) => {
      const player = payload.player || currentPlayer;
      const price = payload.price || payload.soldPrice || player?.soldPrice || currentBid;
      const teamName = payload.team || payload.soldToName || leadingTeam?.name || 'Team';
      
      addNewsItem(`🔥 SOLD: ${player?.name || 'Player'} → ${teamName} for ₹${price}`, 'sold');
      setCurrentPlayer(null);
      setCurrentBid(0);
      setLeadingTeam(null);
      fetchAuctionData();
    }));

    socket.on('player:withdrawn', guard((payload) => {
      addNewsItem(`⚠️ WITHDRAWN: ${payload.name || payload.player?.name || 'Player'}`, 'withdrawn');
      setCurrentPlayer(null);
      fetchAuctionData();
    }));

    socket.on('player:unsold', guard((payload) => {
      addNewsItem(`❌ UNSOLD: ${payload.playerName || payload.name || 'Player'}`, 'unsold');
      setCurrentPlayer(null);
      fetchAuctionData();
    }));

    socket.on('auction:start', guard(() => {
      setAuctionStatus('running');
      addNewsItem('🚀 AUCTION STARTED', 'info');
      fetchAuctionData();
    }));

    socket.on('auction:pause', guard(() => {
      setAuctionStatus('paused');
      fetchAuctionData();
    }));

    socket.on('auction:resume', guard(() => {
      setAuctionStatus('running');
      fetchAuctionData();
    }));

    socket.on('auction:end', guard((payload) => {
      setAuctionStatus('completed');
      setAuctionCompleted(true);
      setCompletionSummary(payload.summary);
      addNewsItem('🏁 AUCTION COMPLETED', 'info');
      fetchAuctionData();
    }));

    socket.on('auction:update', guard(() => {
      fetchAuctionData();
    }));

    // Grouping broadcast events
    socket.on('grouping:broadcast', guard((payload) => {
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
      addNewsItem('🎯 TEAM GROUPING IN PROGRESS', 'info');
      
      // Start spinning wheel animation
      startGroupingWheelAnimation(allTeams, () => {
        setIsGroupingAnimating(false);
        addNewsItem('🎉 TEAM GROUPING COMPLETE', 'success');
      });
    }));

    // End grouping broadcast event
    socket.on('grouping:end-broadcast', guard((payload) => {
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
      addNewsItem('🛑 GROUPING ANIMATION ENDED', 'info');
    }));

    socket.on('grouping:updated', guard((payload) => {
      if (broadcastMode === 'grouping') {
        setGroupingData(payload);
      }
    }));

    // Fixture generation events
    socket.on('fixtures:generated', guard(async (payload) => {
      try {
        // Fetch the generated fixtures
        const token = localStorage.getItem('token');
        const fixturesRes = await axios.get(
          `${API_BASE_URL}/api/fixtures/${code}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (fixturesRes.data.success && fixturesRes.data.matches) {
          addNewsItem(`🎉 ${fixturesRes.data.matches.length} fixtures generated! Type: ${payload.fixtureType || 'N/A'}`, 'success');
          triggerGroupingConfetti();
        }
      } catch (err) {
        console.error('Error fetching fixtures:', err);
      }
    }));

    return () => {
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      // Cleanup animation refs
      if (groupingAnimationRef.current) {
        cancelAnimationFrame(groupingAnimationRef.current);
      }
    };
  }, [code, fetchAuctionData, currentPlayer, currentBid, leadingTeam, startGroupingWheelAnimation, broadcastMode]);

  // Timer countdown
  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    const timerEnabled = tournament?.auctionAdvancedSettings?.timerEnabled !== false;

    if (auctionStatus === 'running' && timer > 0 && timerEnabled) {
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [auctionStatus, timer, tournament?.auctionAdvancedSettings?.timerEnabled]);

  // Add news item to ticker
  const addNewsItem = (text, type = 'info') => {
    const item = { text, type, id: Date.now() };
    setNewsItems(prev => [...prev.slice(-19), item]); // Keep last 20 items
  };

  // Get top 3 teams by spending
  const getTopTeams = () => {
    return [...teams]
      .filter(t => t.totalSpent > 0)
      .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
      .slice(0, 3);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
  };

  // Get report statistics
  const getReportStats = () => {
    const soldPlayers = reportPlayers.filter(p => p.auctionStatus === 'Sold');
    const unsoldPlayers = reportPlayers.filter(p => p.auctionStatus === 'Unsold');
    const totalSoldValue = soldPlayers.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
    const avgPrice = soldPlayers.length > 0 ? totalSoldValue / soldPlayers.length : 0;
    const highestBid = soldPlayers.length > 0 ? Math.max(...soldPlayers.map(p => p.soldPrice || 0)) : 0;
    const highestBidPlayer = soldPlayers.find(p => (p.soldPrice || 0) === highestBid);

    return {
      totalPlayers: reportPlayers.length,
      soldPlayers: soldPlayers.length,
      unsoldPlayers: unsoldPlayers.length,
      totalSoldValue,
      avgPrice,
      highestBid,
      highestBidPlayer
    };
  };

  // Get team-wise players
  const getTeamWisePlayers = () => {
    const teamMap = {};
    teams.forEach(team => {
      const teamPlayers = reportPlayers.filter(
        p => p.auctionStatus === 'Sold' && String(p.soldTo) === String(team._id)
      );
      if (teamPlayers.length > 0) {
        teamMap[team._id] = {
          team,
          players: teamPlayers.sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0)),
          totalSpent: teamPlayers.reduce((sum, p) => sum + (p.soldPrice || 0), 0),
          count: teamPlayers.length
        };
      }
    });
    return Object.values(teamMap).sort((a, b) => b.totalSpent - a.totalSpent);
  };

  // Get top bid players
  const getTopBidPlayers = () => {
    return reportPlayers
      .filter(p => p.auctionStatus === 'Sold' && p.soldPrice)
      .sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0))
      .slice(0, 50); // Top 50
  };

  // Fetch report data when auction is completed
  useEffect(() => {
    if (auctionCompleted && code) {
      fetchReportData();
    }
  }, [auctionCompleted, code, fetchReportData]);

  useEffect(() => {
    if (user && user.role !== 'TOURNAMENT_ADMIN' && user.role !== 'SuperAdmin') {
      navigate('/');
      return;
    }
    if (tournament) {
      document.title = `Broadcast - ${tournament.name}`;
    } else {
      document.title = 'Tournament Broadcast';
    }
  }, [user, tournament, navigate]);

  if (!tournament) {
    return (
      <div className="broadcast-container">
        <div className="broadcast-loading">
          <h2>🔄 Loading Tournament Data...</h2>
        </div>
      </div>
    );
  }

  const dateTime = formatDateTime(currentTime);
  const topTeams = getTopTeams();
  const isLive = auctionStatus === 'running';
  const timerEnabled = tournament?.auctionAdvancedSettings?.timerEnabled !== false;

  // OBS-friendly output for streaming
  if (obsMode) {
    const isAuctionLive = auctionStatus === 'running';

    return (
      <div className={`broadcast-container obs-mode ${theme}-theme`}>
        <div className="obs-topbar">
          <div className="obs-topbar-left">
            <span className={`obs-live-badge ${isAuctionLive ? 'on' : 'off'}`}>
              {isAuctionLive ? '🔴 LIVE' : '⚪ OFFLINE'}
            </span>
            <span className="obs-title">
              {tournament?.name || 'Tournament'} – {tournament?.code || code}
            </span>
          </div>
          <div className="obs-topbar-right">
            <span>📅 {dateTime.date}</span>
            <span>🕓 {dateTime.time}</span>
            <span>📍 {tournament.location || tournament.name}</span>
          </div>
        </div>

        {!isAuctionLive && (
          <div className="obs-offline">
            <div className="obs-offline-card">
              <div className="obs-offline-title">Auction not live</div>
              <div className="obs-offline-subtitle">
                Start the auction to stream this feed. OBS URL: /tournament/{code}/broadcast?obs=1
              </div>
            </div>
          </div>
        )}

        {isAuctionLive && (
          <div className="obs-main">
            <div className="obs-video">
              <div className="video-wrapper">
                {videoSource ? (
                  videoSource.includes('youtube.com') || videoSource.includes('youtu.be') ? (
                    <iframe
                      src={
                        videoSource.includes('embed')
                          ? videoSource
                          : `https://www.youtube.com/embed/${videoSource.split('/').pop().split('?')[0]}`
                      }
                      title="Live Video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="video-embed"
                    />
                  ) : (
                    <video
                      src={videoSource}
                      autoPlay
                      muted={isMuted}
                      controls
                      className="video-element"
                    />
                  )
                ) : (
                  <div className="video-placeholder">
                    <div className="placeholder-content">
                      <div className="placeholder-icon">🎥</div>
                      <p>No live video currently available</p>
                      <p className="placeholder-subtitle">Configure video source in settings</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="obs-side">
              {currentPlayer ? (
                <div className="player-info-card obs-player-card">
                  <div className="player-photo-section">
                    {currentPlayer.photo ? (
                      <img
                        src={`${API_BASE_URL}/${currentPlayer.photo}`}
                        alt={currentPlayer.name}
                        className="player-photo player-photo-hd"
                        loading="eager"
                        onError={(e) => {
                          e.target.src = `${API_BASE_URL}/default-photo.png`;
                        }}
                      />
                    ) : (
                      <div className="player-photo-placeholder">
                        <span>{currentPlayer.name?.charAt(0) || 'P'}</span>
                      </div>
                    )}
                  </div>
                  <div className="player-details">
                    <div className="player-name">{currentPlayer.name || 'Player'}</div>
                    <div className="player-id">ID: {currentPlayer.playerId || currentPlayer._id?.slice(-8) || 'N/A'}</div>
                    <div className="player-role">Role: {currentPlayer.role || 'Player'}</div>
                    <div className="player-city">City: {currentPlayer.city || 'N/A'}</div>
                    {currentPlayer.mobile && (
                      <div className="player-mobile">Mobile: {currentPlayer.mobile}</div>
                    )}
                  </div>

                  <div className="bid-section">
                    <div className="base-price">
                      <span>Base Price:</span>
                      <strong>{formatCurrency(currentPlayer.basePrice || currentPlayer.baseAmount || 0)}</strong>
                    </div>
                    <div className="current-bid">
                      <span>Current Bid:</span>
                      <strong>{formatCurrency(currentBid)}</strong>
                    </div>
                    {leadingTeam && (
                      <div className="leading-team">
                        <span>Leading Team:</span>
                        <strong>{leadingTeam.name}</strong>
                      </div>
                    )}
                    {timerEnabled && (
                      <div className="timer-display">
                        <span className="timer-label">Time Remaining:</span>
                        <span className={`timer-value ${timer <= 10 ? 'timer-warning' : ''}`}>
                          {timer}s
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="obs-offline-card">
                  <div className="obs-offline-title">Waiting for player to present</div>
                  <div className="obs-offline-subtitle">Auction is live. Player details will appear here.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`broadcast-container ${theme}-theme`}>
      {/* Header */}
      <header className="broadcast-header">
        <div className="header-left">
          {tournament.logo && (
            <img 
              src={`${API_BASE_URL}/${tournament.logo}`} 
              alt="Tournament Logo" 
              className="tournament-logo-small"
            />
          )}
          <div>
            <div className="header-title">
              {isLive && <span className="live-badge">🔴 LIVE</span>}
              <span className="header-text">PLAYLIVE AUCTION – {tournament.code}</span>
            </div>
            <div className="header-subtitle">
              <span>📅 {dateTime.date}</span>
              <span>🕓 {dateTime.time}</span>
              <span>📍 {tournament.location || tournament.name}</span>
            </div>
          </div>
        </div>
        <div className="header-right">
          <button 
            className="video-settings-btn"
            onClick={() => setShowVideoSettings(!showVideoSettings)}
            title="Video Settings"
          >
            🎥 Video
          </button>
          <button 
            className="theme-toggle"
            onClick={() => setTheme(theme === 'playlive' ? 'tv' : 'playlive')}
            title="Toggle Theme"
          >
            🎨 {theme === 'playlive' ? 'TV Channel' : 'PlayLive'}
          </button>
        </div>
      </header>

      {/* Video Settings Modal */}
      {showVideoSettings && (
        <div className="video-settings-modal" onClick={() => setShowVideoSettings(false)}>
          <div className="video-settings-content" onClick={(e) => e.stopPropagation()}>
            <h3>🎥 Configure Video Source</h3>
            <div className="video-settings-form">
              <label>
                Video Source (YouTube URL, RTMP, or WebRTC):
                <input
                  type="text"
                  value={videoSource}
                  onChange={(e) => setVideoSource(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or rtmp://..."
                  className="video-source-input"
                />
              </label>
              <div className="video-settings-actions">
                <button 
                  className="btn-save"
                  onClick={() => {
                    localStorage.setItem(`broadcast_video_${code}`, videoSource);
                    setShowVideoSettings(false);
                  }}
                >
                  Save
                </button>
                <button 
                  className="btn-cancel"
                  onClick={() => setShowVideoSettings(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Split Screen */}
      <div className="broadcast-main">
        {/* Grouping Display Mode */}
        {broadcastMode === 'grouping' && groupingData && (
          <div className="broadcast-grouping-display">
            {/* Spinning Wheel Animation Phase */}
            {isGroupingAnimating && allTeamsForAnimation.length > 0 && (
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
                <div className="broadcast-wheel-container">
                  <div 
                    ref={groupingWheelRef}
                    className="broadcast-grouping-wheel"
                  >
                    {allTeamsForAnimation.map((team, index) => {
                      const angle = (360 / allTeamsForAnimation.length) * index;
                      return (
                        <div
                          key={team._id || index}
                          className="broadcast-wheel-team"
                          style={{
                            transform: `rotate(${angle}deg) translateY(-200px) rotate(${-angle}deg)`,
                            transformOrigin: 'center 200px'
                          }}
                        >
                          <div className="broadcast-wheel-team-logo">
                            {team.logo ? (
                              <img 
                                src={team.logo.startsWith('http') ? team.logo : `${API_BASE_URL}/${team.logo}`} 
                                alt={team.name}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className="broadcast-wheel-team-placeholder" style={{ display: team.logo ? 'none' : 'flex' }}>
                              🏆
                            </div>
                          </div>
                          <span className="broadcast-wheel-team-name">{team.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="broadcast-wheel-center">
                    <div className="broadcast-wheel-center-icon">🎯</div>
                    <div className="broadcast-wheel-center-text">GROUPING</div>
                  </div>
                </div>
              </div>
            )}

            {/* Final Groups Display */}
            {!isGroupingAnimating && (
              <div className="grouping-final-display">
                <div className="grouping-broadcast-header">
                  <h1 className="grouping-broadcast-title">🎯 TEAM GROUPING</h1>
                  <h2 className="grouping-broadcast-subtitle">{tournament?.name || 'Tournament'}</h2>
                </div>
                <div className="grouping-broadcast-content">
                  {groupingData.groups && groupingData.groups.map((group, index) => (
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
                                  src={team.logo.startsWith('http') ? team.logo : `${API_BASE_URL}/${team.logo}`} 
                                  alt={team.name} 
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
          </div>
        )}

        {/* Auction Display Mode */}
        {broadcastMode === 'auction' && (
          <>
            {/* Left: Video Feed */}
            <div className="broadcast-video-section">
          <div className="video-container">
            <div className="video-header">
              <span className="live-indicator">🔴 LIVE</span>
              <span className="video-title">{tournament.code} AUCTION STAGE</span>
            </div>
            <div className="video-wrapper">
              {videoSource ? (
                videoSource.includes('youtube.com') || videoSource.includes('youtu.be') ? (
                  <iframe
                    src={videoSource.includes('embed') ? videoSource : `https://www.youtube.com/embed/${videoSource.split('/').pop().split('?')[0]}`}
                    title="Live Video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="video-embed"
                  />
                ) : (
                  <video
                    src={videoSource}
                    autoPlay
                    muted={isMuted}
                    controls
                    className="video-element"
                  />
                )
              ) : (
                <div className="video-placeholder">
                  <div className="placeholder-content">
                    <div className="placeholder-icon">🎥</div>
                    <p>No live video currently available</p>
                    <p className="placeholder-subtitle">Configure video source in settings</p>
                  </div>
                </div>
              )}
            </div>
            <div className="video-footer">
              <span>🎙️ Commentator: {tournament.commentator || 'Live Commentary'}</span>
              <button 
                className="mute-button"
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Auction Feed */}
        <div className="broadcast-auction-section">
          {auctionCompleted ? (
            <AuctionReportView
              tournament={tournament}
              teams={teams}
              players={reportPlayers}
              loading={reportLoading}
              completionSummary={completionSummary}
              summary={summary}
              activeTab={activeReportTab}
              onTabChange={setActiveReportTab}
              formatCurrency={formatCurrency}
              getReportStats={getReportStats}
              getTeamWisePlayers={getTeamWisePlayers}
              getTopBidPlayers={getTopBidPlayers}
            />
          ) : currentPlayer ? (
            <>
              {/* Branding/Sponsor Area */}
              {tournament?.logo && (
                <div className="broadcast-branding">
                  <img 
                    src={`${API_BASE_URL}/${tournament.logo}`} 
                    alt={tournament.name}
                    className="broadcast-logo"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Main Player Info Card */}
              <div className="player-info-card">
                <div className="player-photo-section">
                  {currentPlayer.photo ? (
                    <img 
                      src={`${API_BASE_URL}/${currentPlayer.photo}`} 
                      alt={currentPlayer.name}
                      className="player-photo player-photo-hd"
                      loading="eager"
                      onError={(e) => {
                        e.target.src = `${API_BASE_URL}/default-photo.png`;
                      }}
                    />
                  ) : (
                    <div className="player-photo-placeholder">
                      <span>{currentPlayer.name?.charAt(0) || 'P'}</span>
                    </div>
                  )}
                </div>
                <div className="player-details">
                  <div className="player-name">{currentPlayer.name || 'Player'}</div>
                  <div className="player-id">ID: {currentPlayer.playerId || currentPlayer._id?.slice(-8) || 'N/A'}</div>
                  <div className="player-role">Role: {currentPlayer.role || 'Player'}</div>
                  <div className="player-city">City: {currentPlayer.city || 'N/A'}</div>
                  {currentPlayer.mobile && (
                    <div className="player-mobile">Mobile: {currentPlayer.mobile}</div>
                  )}
                </div>
                <div className="bid-section">
                  <div className="base-price">
                    <span className="label">Base Price:</span>
                    <span className="value">₹{currentPlayer.basePrice || 1000}</span>
                  </div>
                  <div className="current-bid" ref={bidGlowRef}>
                    <span className="label">Current Bid:</span>
                    <span className="value">₹{currentBid || 0}</span>
                  </div>
                  {leadingTeam && (
                    <div className="leading-team">
                      <span className="label">Leading:</span>
                      <span className="value">
                        {leadingTeam.logo && (
                          <img 
                            src={`${API_BASE_URL}/${leadingTeam.logo}`} 
                            alt={leadingTeam.name}
                            className="team-logo-small"
                          />
                        )}
                        {leadingTeam.name} 🏆
                      </span>
                    </div>
                  )}
                  {timerEnabled && (
                    <div className="timer-display">
                      <span className="timer-label">Time Remaining:</span>
                      <span className={`timer-value ${timer <= 10 ? 'timer-warning' : ''}`}>
                        {timer}s
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Bar */}
              <div className="status-bar">
                <span>🧍 {currentPlayer.name}</span>
                <span>💸 ₹{currentBid || 0}</span>
                {leadingTeam && <span>🏆 {leadingTeam.name}</span>}
                {timerEnabled && (
                  <span className={timer <= 10 ? 'timer-warning' : ''}>⏱️ {timer}s left</span>
                )}
              </div>

              {/* Additional Panels */}
              <div className="info-panels">
                <div className="info-panel">
                  <div className="panel-header">📊 Team Standings</div>
                  <div className="panel-content">
                    {topTeams.map((team, idx) => (
                      <div key={team._id || idx} className="team-standing">
                        {team.logo && (
                          <img 
                            src={`${API_BASE_URL}/${team.logo}`} 
                            alt={team.name}
                            className="team-logo-tiny"
                          />
                        )}
                        <span className="team-name">{team.name}</span>
                        <span className="team-spent">₹{team.totalSpent || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="info-panel">
                  <div className="panel-header">🏆 Highest Bid</div>
                  <div className="panel-content">
                    {summary.mostExpensivePlayer ? (
                      <div className="highest-bid">
                        <span>{summary.mostExpensivePlayer.name}</span>
                        <span>₹{summary.mostExpensivePlayer.soldPrice || 0}</span>
                      </div>
                    ) : (
                      <div className="no-data">No bids yet</div>
                    )}
                  </div>
                </div>

                <div className="info-panel">
                  <div className="panel-header">🔔 Recent Events</div>
                  <div className="panel-content">
                    {summary.lastSoldPlayer ? (
                      <div className="recent-event">
                        <span>{summary.lastSoldPlayer.name} SOLD</span>
                        <span>₹{summary.lastSoldPlayer.soldPrice || 0}</span>
                      </div>
                    ) : (
                      <div className="no-data">No recent events</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="auction-waiting">
              <div className="waiting-content">
                <div className="waiting-icon">⏳</div>
                <p>Waiting for next player...</p>
                <p className="waiting-subtitle">Auction Status: {auctionStatus}</p>
              </div>
            </div>
          )}
          </div>
          </>
        )}
      </div>

      {/* News Ticker */}
      <div className="news-ticker-container">
        <div className="news-ticker" ref={newsTickerRef}>
          <div className="ticker-label">🟢 LIVE UPDATE:</div>
          {newsItems.length > 0 ? (
            <div className="ticker-content">
              {newsItems.map((item, idx) => (
                <span 
                  key={item.id} 
                  className={`ticker-item ticker-${item.type}`}
                >
                  {item.text}
                </span>
              ))}
            </div>
          ) : (
            <div className="ticker-content">
              <span className="ticker-item">Auction broadcast ready...</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="broadcast-footer">
        <div className="footer-content">
          <span>🟣 Powered by PlayLive.com</span>
          <span>|</span>
          <span>{dateTime.date}</span>
          <span>|</span>
          <span>{dateTime.time}</span>
          {!socketConnected && <span className="connection-warning">| ⚠️ Disconnected</span>}
        </div>
      </footer>
    </div>
  );
}

// Auction Report View Component
function AuctionReportView({
  tournament,
  teams,
  players,
  loading,
  completionSummary,
  summary,
  activeTab,
  onTabChange,
  formatCurrency,
  getReportStats,
  getTeamWisePlayers,
  getTopBidPlayers
}) {
  const stats = getReportStats();
  const teamWiseData = getTeamWisePlayers();
  const topBidPlayers = getTopBidPlayers();

  if (loading) {
    return (
      <div className="auction-report-loading">
        <div className="loading-spinner"></div>
        <p>Loading auction report...</p>
      </div>
    );
  }

  return (
    <div className="auction-report-container">
      {/* Report Header */}
      <div className="report-header">
        <div className="report-title">
          <h2>🏁 AUCTION COMPLETED</h2>
          <p className="report-subtitle">{tournament?.name || 'Tournament'} - Final Report</p>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="report-tabs">
        <button
          className={`report-tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => onTabChange('summary')}
        >
          📊 Summary
        </button>
        <button
          className={`report-tab ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => onTabChange('teams')}
        >
          👥 Teams ({teamWiseData.length})
        </button>
        <button
          className={`report-tab ${activeTab === 'topbids' ? 'active' : ''}`}
          onClick={() => onTabChange('topbids')}
        >
          🏆 Top Bids ({topBidPlayers.length})
        </button>
        <button
          className={`report-tab ${activeTab === 'app' ? 'active' : ''}`}
          onClick={() => onTabChange('app')}
        >
          📱 App Details
        </button>
      </div>

      {/* Tab Content */}
      <div className="report-content">
        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="report-summary">
            <div className="summary-stats-grid">
              <div className="summary-stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <div className="stat-label">Total Players</div>
                  <div className="stat-value">{stats.totalPlayers}</div>
                </div>
              </div>
              <div className="summary-stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <div className="stat-label">Players Sold</div>
                  <div className="stat-value">{stats.soldPlayers}</div>
                </div>
              </div>
              <div className="summary-stat-card">
                <div className="stat-icon">❌</div>
                <div className="stat-info">
                  <div className="stat-label">Unsold</div>
                  <div className="stat-value">{stats.unsoldPlayers}</div>
                </div>
              </div>
              <div className="summary-stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <div className="stat-label">Total Value</div>
                  <div className="stat-value">{formatCurrency(stats.totalSoldValue)}</div>
                </div>
              </div>
              <div className="summary-stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-info">
                  <div className="stat-label">Average Price</div>
                  <div className="stat-value">{formatCurrency(stats.avgPrice)}</div>
                </div>
              </div>
              <div className="summary-stat-card">
                <div className="stat-icon">🏆</div>
                <div className="stat-info">
                  <div className="stat-label">Highest Bid</div>
                  <div className="stat-value">{formatCurrency(stats.highestBid)}</div>
                </div>
              </div>
            </div>

            {stats.highestBidPlayer && (
              <div className="highlight-card">
                <h3>🏆 Highest Bid Player</h3>
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

            {completionSummary && (
              <div className="completion-details">
                <h3>📋 Completion Details</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Total Teams:</span>
                    <span className="detail-value">{completionSummary.totalTeams || teams.length}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Players Sold:</span>
                    <span className="detail-value">{completionSummary.playersSold || stats.soldPlayers}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Unsold Players:</span>
                    <span className="detail-value">{completionSummary.unsoldPlayers || stats.unsoldPlayers}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="report-teams">
            <div className="teams-list">
              {teamWiseData.length === 0 ? (
                <div className="empty-state">
                  <p>No teams have purchased players yet.</p>
                </div>
              ) : (
                teamWiseData.map((teamData, idx) => (
                  <div key={teamData.team._id || idx} className="team-card">
                    <div className="team-card-header">
                      {teamData.team.logo && (
                        <img
                          src={`${API_BASE_URL}/${teamData.team.logo}`}
                          alt={teamData.team.name}
                          className="team-logo-medium"
                        />
                      )}
                      <div className="team-header-info">
                        <h3>{teamData.team.name}</h3>
                        <div className="team-stats">
                          <span>{teamData.count} Players</span>
                          <span>•</span>
                          <span>{formatCurrency(teamData.totalSpent)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="team-players-list">
                      {teamData.players.map((player, pIdx) => (
                        <div key={player._id || pIdx} className="team-player-item">
                          <div className="player-info">
                            {player.photo && (
                              <img
                                src={`${API_BASE_URL}/${player.photo}`}
                                alt={player.name}
                                className="player-thumb"
                              />
                            )}
                            <div className="player-details">
                              <span className="player-name">{player.name}</span>
                              <span className="player-role">{player.role || 'N/A'}</span>
                            </div>
                          </div>
                          <div className="player-price">{formatCurrency(player.soldPrice)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Top Bids Tab */}
        {activeTab === 'topbids' && (
          <div className="report-topbids">
            <div className="topbids-list">
              {topBidPlayers.length === 0 ? (
                <div className="empty-state">
                  <p>No players sold yet.</p>
                </div>
              ) : (
                topBidPlayers.map((player, idx) => (
                  <div key={player._id || idx} className="topbid-item">
                    <div className="topbid-rank">#{idx + 1}</div>
                    <div className="topbid-player">
                      {player.photo && (
                        <img
                          src={`${API_BASE_URL}/${player.photo}`}
                          alt={player.name}
                          className="player-thumb"
                        />
                      )}
                      <div className="topbid-info">
                        <div className="topbid-name">{player.name}</div>
                        <div className="topbid-details">
                          <span>{player.role || 'N/A'}</span>
                          <span>•</span>
                          <span>{player.soldToName || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="topbid-price">{formatCurrency(player.soldPrice)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* App Details Tab */}
        {activeTab === 'app' && (
          <div className="report-app">
            <div className="app-details-section">
              <div className="app-header">
                <h3>📱 PlayLive App</h3>
                <p className="app-tagline">Your Ultimate Sports Management Platform</p>
              </div>
              
              <div className="app-features">
                <div className="feature-card">
                  <div className="feature-icon">🏆</div>
                  <h4>Tournament Management</h4>
                  <p>Complete tournament organization and management tools</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">💰</div>
                  <h4>Live Auctions</h4>
                  <p>Real-time auction system with live bidding</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">📊</div>
                  <h4>Analytics & Reports</h4>
                  <p>Comprehensive statistics and detailed reports</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">👥</div>
                  <h4>Team Management</h4>
                  <p>Manage teams, players, and squad compositions</p>
                </div>
              </div>

              <div className="app-contact">
                <h4>📞 Contact Us</h4>
                <div className="contact-info">
                  <p>Website: <a href="https://playlive.com" target="_blank" rel="noopener noreferrer">www.playlive.com</a></p>
                  <p>Email: support@playlive.com</p>
                  <p>Phone: +91-XXXX-XXXXXX</p>
                </div>
              </div>

              <div className="app-ads">
                <h4>🎯 Special Offers</h4>
                <div className="ad-banner">
                  <div className="ad-content">
                    <h5>Upgrade to Premium</h5>
                    <p>Get access to advanced features and priority support</p>
                    <button className="ad-button">Learn More</button>
                  </div>
                </div>
                <div className="ad-banner">
                  <div className="ad-content">
                    <h5>Download Our Mobile App</h5>
                    <p>Manage your tournaments on the go</p>
                    <div className="app-badges">
                      <span className="app-badge">📱 iOS</span>
                      <span className="app-badge">🤖 Android</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="app-footer">
                <p>💙 Powered by PlayLive.com</p>
                <p className="copyright">© 2025 PlayLive. All rights reserved.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TournamentBroadcast;
