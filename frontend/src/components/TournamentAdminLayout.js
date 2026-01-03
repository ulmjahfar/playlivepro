import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAppLogo } from '../hooks/useAppLogo';
import { API_BASE_URL } from '../utils/apiConfig';
import '../styles-admin-unified-theme.css';
import './TournamentAdminLayout.css';
import '../styles-dynamic-mode.css';
import '../styles-tournament-fullwidth.css';

function TournamentAdminLayout({ children, fullSize = false, hideSidebar = false, hideHeader = false, noLayoutClasses = false }) {
  // Sidebar removed - navigation moved to header
  const [tournament, setTournament] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [quickStats, setQuickStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [favoriteItems, setFavoriteItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('favoriteSidebarItems') || '[]');
    } catch {
      return [];
    }
  });
  const searchInputRef = useRef(null);
  const profileMenuRef = useRef(null);
  const notificationsRef = useRef(null);
  const quickActionsRef = useRef(null);
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { code } = useParams();
  const { logoUrl } = useAppLogo();
  const normalizedRoleKey = (user?.role || '')
    .toString()
    .trim()
    .replace(/[\s_]/g, '')
    .toLowerCase();
  const isSuperAdmin = normalizedRoleKey === 'superadmin';
  const isTournamentManager = normalizedRoleKey === 'tournamentmanager';
  const isAuctionController = normalizedRoleKey === 'auctioncontroller';

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchQuickStats = useCallback(async () => {
    if (!code) return;
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [playersRes, teamsRes, auctionRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/players/${code}`, { headers }).catch(() => ({ data: { players: [] } })),
        axios.get(`${API_BASE_URL}/api/teams/${code}`, { headers }).catch(() => ({ data: { teams: [] } })),
        axios.get(`${API_BASE_URL}/api/auctions/summary/${code}`, { headers }).catch(() => ({ data: { summary: null } }))
      ]);

      const players = playersRes.data.players || [];
      const teams = teamsRes.data.teams || [];
      const auctionSummary = auctionRes.data.summary;

      setQuickStats({
        players: players.length,
        teams: teams.length,
        auctionProgress: auctionSummary ? Math.round((auctionSummary.soldPlayers / auctionSummary.totalPlayers) * 100) : 0,
        totalBids: auctionSummary?.totalBids || 0,
        averageBid: auctionSummary?.averageBid || 0,
        registeredToday: players.filter(p => {
          const registered = new Date(p.createdAt);
          const today = new Date();
          return registered.toDateString() === today.toDateString();
        }).length
      });
    } catch (err) {
      console.error('Error fetching quick stats:', err);
    }
  }, [code]);

  const fetchNotifications = useCallback(async () => {
    if (!code) return;
    try {
      const mockNotifications = [
        { id: 1, type: 'info', message: 'New player registration pending approval', time: '5m ago', read: false },
        { id: 2, type: 'success', message: 'Auction completed successfully', time: '1h ago', read: false },
        { id: 3, type: 'warning', message: 'Team registration deadline approaching', time: '2h ago', read: true },
      ];
      setNotifications(mockNotifications);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [code]);

  useEffect(() => {
    if (tournament) {
      fetchQuickStats();
      fetchNotifications();
      const interval = setInterval(() => {
        fetchQuickStats();
        fetchNotifications();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [tournament, fetchQuickStats, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (quickActionsRef.current && !quickActionsRef.current.contains(event.target)) {
        setShowQuickActions(false);
      }
    };

    if (showProfileMenu || showNotifications || showQuickActions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu, showNotifications, showQuickActions]);

  const handleNavClick = useCallback((path) => {
    navigate(path);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  }, [navigate, isMobile]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShowKeyboardShortcuts(!showKeyboardShortcuts);
      }
      if (e.key === 'Escape') {
        setShowProfileMenu(false);
        setShowNotifications(false);
        setShowQuickActions(false);
        setShowKeyboardShortcuts(false);
        setMobileMenuOpen(false);
        setShowSearch(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showKeyboardShortcuts]);

  const fetchTournament = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTournament(res.data.tournament);
    } catch (err) {
      console.error('Error fetching tournament:', err);
      toast.error('Failed to load tournament data');
    }
  }, [code]);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (!token || !storedUser) {
        navigate('/login/tournament-admin', { replace: true });
        return false;
      }
      
      let parsedUser;
      try {
        parsedUser = JSON.parse(storedUser);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login/tournament-admin', { replace: true });
        return false;
      }
      
      const allowedRoles = new Set(['tournamentadmin', 'superadmin', 'tournamentmanager', 'auctioncontroller']);
      const normalizedRoleKey = (parsedUser?.role || '')
        .toString()
        .trim()
        .replace(/[\s_]/g, '')
        .toLowerCase();
          
      if (!parsedUser || !parsedUser.role || !allowedRoles.has(normalizedRoleKey)) {
        navigate('/login/tournament-admin', { replace: true });
        return false;
      }
      
      return true;
    };

    if (!checkAuth()) {
      return;
    }
    
    fetchTournament();

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
  }, [navigate, code, fetchTournament]);

  useEffect(() => {
    if (!tournament) return;
    const updateCountdown = () => {
      const now = new Date();
      let targetDate;
      if (tournament.status === 'Upcoming' && tournament.startDate) {
        targetDate = new Date(tournament.startDate);
      } else if (tournament.status === 'Active' && tournament.endDate) {
        targetDate = new Date(tournament.endDate);
      } else {
        setCountdown('');
        return;
      }
      const diff = targetDate - now;
      if (diff <= 0) {
        setCountdown('Event Started');
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [tournament]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tournamentCode');
    navigate('/');
    toast.success('Logged out successfully');
  }, [navigate]);

  const getStatusBadge = () => {
    if (!tournament) return { text: 'Loading...', class: 'upcoming' };
    if (tournament.status === 'Active') return { text: 'Active', class: 'active' };
    if (tournament.status === 'Upcoming') return { text: 'Upcoming', class: 'upcoming' };
    return { text: 'Completed', class: 'completed' };
  };

  const isActiveRoute = (path) => {
    return location.pathname === path;
  };

  const sidebarSections = [
    {
      id: 'main',
      label: 'Main',
      items: [
        { 
          icon: '🏠', 
          label: 'Dashboard', 
          path: `/tournament/${code}/overview`, 
          shortcut: '1',
          description: 'Overview and statistics',
          badge: null
        },
        { 
          icon: '👥', 
          label: 'Players', 
          path: `/tournament/${code}/players`, 
          shortcut: '2',
          description: 'Manage players and registrations',
          badge: quickStats?.players > 0 ? quickStats.players : null
        },
        { 
          icon: '⚽', 
          label: 'Teams', 
          path: `/tournament/${code}/teams`, 
          shortcut: '3',
          description: 'Team management',
          badge: quickStats?.teams > 0 ? quickStats.teams : null
        },
        { 
          icon: '📦', 
          label: 'Grouping', 
          path: `/tournament/${code}/grouping`, 
          shortcut: 'G',
          description: 'Team grouping and league stage',
          badge: null
        },
        { 
          icon: '🎤', 
          label: 'Auction', 
          path: `/tournament/${code}/auction`, 
          shortcut: '4',
          description: 'Live auction management',
          badge: quickStats?.auctionProgress > 0 ? `${quickStats.auctionProgress}%` : null,
          highlight: quickStats?.auctionProgress > 0 && quickStats.auctionProgress < 100
        },
      ]
    },
    {
      id: 'analytics',
      label: 'Analytics & Tools',
      items: [
        { 
          icon: '📊', 
          label: 'Reports', 
          path: `/tournament/${code}/report`, 
          shortcut: '5',
          description: 'View detailed reports',
          badge: null
        },
        { 
          icon: '🔗', 
          label: 'Links', 
          path: `/tournament/${code}/links`, 
          shortcut: '7',
          description: 'Registration and share links',
          badge: null
        },
        { 
          icon: '📋', 
          label: 'Schedule', 
          path: `/tournament/${code}/schedule`, 
          shortcut: '8',
          description: 'Tournament schedule',
          badge: null
        },
      ]
    },
    {
      id: 'settings',
      label: 'Configuration',
      items: [
        { 
          icon: '⚙️', 
          label: 'Settings', 
          path: `/tournament/${code}/settings`, 
          shortcut: 'S',
          description: 'Tournament settings and preferences',
          badge: null
        },
        { 
          icon: '👨‍💼', 
          label: 'Admins', 
          path: `/tournament/${code}/admins`, 
          shortcut: '0',
          description: 'Manage administrators',
          badge: null
        },
      ]
    }
  ];

  const filteredSections = sidebarSections.map(section => {
    if (isTournamentManager) {
      const allowedPaths = [
        `/tournament/${code}/overview`,
        `/tournament/${code}/players`,
        `/tournament/${code}/teams`,
        `/tournament/${code}/report`
      ];
      return {
        ...section,
        items: section.items.filter(item => allowedPaths.includes(item.path))
      };
    }
    if (isAuctionController) {
      const allowedPaths = [
        `/tournament/${code}/overview`,
        `/tournament/${code}/auction`,
        `/tournament/${code}/settings`
      ];
      return {
        ...section,
        items: section.items.filter(item => {
          const itemPath = item.path;
          return allowedPaths.includes(itemPath) || (itemPath.startsWith('/tournament/') && itemPath.includes('/auction'));
        })
      };
    }
    return section;
  }).filter(section => section.items.length > 0);
  
  const allSidebarItems = filteredSections.flatMap(section => section.items);

  const favoriteItemsList = allSidebarItems.filter(item => 
    favoriteItems.includes(item.path)
  );

  const toggleFavorite = (path) => {
    setFavoriteItems(prev => {
      const newFavorites = prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path];
      localStorage.setItem('favoriteSidebarItems', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  const statusBadge = getStatusBadge();
  const modeClass = 'mode-dynamic';
  const showSimpleHeader = !fullSize && !hideHeader;
  const defaultHeaderHeight = showSimpleHeader ? 72 : 0;
  const currentHeaderOffset = defaultHeaderHeight;
  const mainMarginTop = defaultHeaderHeight;

  return (
    <div
      className={noLayoutClasses ? '' : `tournament-admin-layout tournament-admin-modern ${modeClass}`}
      style={{ '--header-offset': `${currentHeaderOffset}px`, '--hero-height': '0px' }}
    >
      {/* Header */}
      {showSimpleHeader && (
        <header className="admin-header admin-header--dynamic admin-header--white">
          <div className="admin-header__content">
            <div className="admin-header__left">
              {isMobile && (
                <button
                  className="admin-header__menu-btn"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? '✕' : '☰'}
                </button>
              )}
              <span className={`admin-header__status ${statusBadge.class}`}>
                {statusBadge.text}
              </span>
              <div className="admin-header__tournament">
                {tournament?.logo && (
                  <div className="admin-header__logo">
                    <img 
                      src={tournament.logo.startsWith('http') ? tournament.logo : `${API_BASE_URL}${tournament.logo.startsWith('/') ? '' : '/'}${tournament.logo}`} 
                      alt={tournament?.name || 'Tournament'} 
                    />
                  </div>
                )}
                <div className="admin-header__info">
                  <h1 className="admin-header__title">{tournament?.name || 'Tournament'}</h1>
                </div>
              </div>
            </div>
            <div className="admin-header__center">
              <div className="admin-top-nav admin-top-nav--inline">
                {filteredSections.map(section =>
                  section.items.map(item => (
                    <button
                      key={item.path}
                      className={`admin-top-nav__item ${isActiveRoute(item.path) ? 'active' : ''}`}
                      onClick={() => handleNavClick(item.path)}
                      title={item.description || item.label}
                    >
                      <span className="admin-top-nav__icon">{item.icon}</span>
                      <span className="admin-top-nav__label">{item.label}</span>
                      {item.badge && (
                        <span className="admin-top-nav__badge">{item.badge}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="admin-header__right">
              <div className="admin-header__user-info">
                <span className="admin-header__user-name">{user?.username || user?.name || 'Admin'}</span>
              </div>
              <button
                type="button"
                className="admin-header__logout-btn"
                onClick={handleLogout}
                title="Logout"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main
        className={`admin-main admin-main--dynamic ${fullSize ? 'auction-pro-fullsize' : ''}`}
        style={{ 
          marginTop: `${mainMarginTop}px`,
          marginLeft: '0',
          marginRight: '0',
          width: '100%',
          maxWidth: '100%',
          transition: 'none'
        }}
      >

        {showSearch && (
          <div className="search-container" style={{ marginBottom: '24px', maxWidth: '400px' }}>
            <span className="search-icon">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Search... (⌘K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  setShowSearch(false);
                  e.target.blur();
                }
              }}
            />
          </div>
        )}

        {showQuickActions && (
          <div className="quick-actions-panel" ref={quickActionsRef}>
            <div className="quick-actions-header">
              <h3>Quick Actions</h3>
              <button onClick={() => setShowQuickActions(false)} className="close-btn">✕</button>
            </div>
            <div className="quick-actions-grid">
              <button 
                className="quick-action-btn"
                onClick={() => { navigate(`/tournament/${code}/players`); setShowQuickActions(false); }}
              >
                <span className="action-icon">➕</span>
                <span className="action-label">Add Player</span>
              </button>
              <button 
                className="quick-action-btn"
                onClick={() => { navigate(`/tournament/${code}/teams`); setShowQuickActions(false); }}
              >
                <span className="action-icon">⚽</span>
                <span className="action-label">Add Team</span>
              </button>
              <button 
                className="quick-action-btn"
                onClick={() => { navigate(`/tournament/${code}/report`); setShowQuickActions(false); }}
              >
                <span className="action-icon">📊</span>
                <span className="action-label">View Reports</span>
              </button>
              <button 
                className="quick-action-btn"
                onClick={() => { navigate(`/tournament/${code}/auction`); setShowQuickActions(false); }}
              >
                <span className="action-icon">🎤</span>
                <span className="action-label">Start Auction</span>
              </button>
              <button 
                className="quick-action-btn"
                onClick={() => { navigate(`/tournament/${code}/links`); setShowQuickActions(false); }}
              >
                <span className="action-icon">🔗</span>
                <span className="action-label">Share Links</span>
              </button>
            </div>
          </div>
        )}

        {children}
      </main>

      {isMobile && (
        <nav className="mobile-nav mobile-nav--dynamic">
          {allSidebarItems.slice(0, 5).map((item) => (
            <button
              key={item.path}
              className={`mobile-nav-item ${isActiveRoute(item.path) ? 'active' : ''}`}
              onClick={() => handleNavClick(item.path)}
              title={item.label}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && (
                <span className="mobile-nav-badge">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>
      )}

      {showKeyboardShortcuts && (
        <div className="modal-overlay" onClick={() => setShowKeyboardShortcuts(false)}>
          <div className="modal-content keyboard-shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Keyboard Shortcuts</h3>
              <button className="modal-close" onClick={() => setShowKeyboardShortcuts(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="shortcuts-grid">
                <div className="shortcut-item">
                  <div className="shortcut-keys">
                    <kbd>⌘</kbd> + <kbd>K</kbd>
                  </div>
                  <div className="shortcut-description">Search</div>
                </div>
                <div className="shortcut-item">
                  <div className="shortcut-keys">
                    <kbd>⌘</kbd> + <kbd>/</kbd>
                  </div>
                  <div className="shortcut-description">Show shortcuts</div>
                </div>
                <div className="shortcut-item">
                  <div className="shortcut-keys">
                    <kbd>Esc</kbd>
                  </div>
                  <div className="shortcut-description">Close modals</div>
                </div>
                <div className="shortcut-item">
                  <div className="shortcut-keys">
                    <kbd>1</kbd> - <kbd>9</kbd>, <kbd>0</kbd>
                  </div>
                  <div className="shortcut-description">Navigate sections</div>
                </div>
                <div className="shortcut-item">
                  <div className="shortcut-keys">
                    <kbd>N</kbd>
                  </div>
                  <div className="shortcut-description">Notifications</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TournamentAdminLayout;
