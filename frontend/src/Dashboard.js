import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SuperAdminSidebar from './components/SuperAdminSidebar';
import DashboardOverview from './components/DashboardOverview';
import TournamentsTab from './components/TournamentsTab';
import ReportsTab from './components/ReportsTab';
import SettingsTab from './components/SettingsTab';
import { useTournaments } from './hooks/useTournaments';
import './styles-super-admin-dashboard.css';
import './styles-dashboard.css';
import './styles-profile.css';

const SECTION_TITLES = {
  overview: 'Dashboard Overview',
  tournaments: 'Tournaments',
  reports: 'Reports',
  settings: 'Settings'
};

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [activeSection, setActiveSection] = useState('overview');
  const [allDataLoaded, setAllDataLoaded] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const { tournaments, loading: tournamentsLoading, stats, refetch: refetchTournaments } = useTournaments();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    // Check both token and user exist
    if (!token || !storedUser) {
      navigate('/', { replace: true });
      return;
    }
    
    // Parse and set user
    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setAllDataLoaded(true);
    } catch {
      // Invalid user data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const syncUserFromStorage = () => {
      try {
        const stored = localStorage.getItem('user');
        setUser(stored ? JSON.parse(stored) : null);
      } catch {
        setUser(null);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncUserFromStorage();
      }
    };

    window.addEventListener('pageshow', syncUserFromStorage);
    window.addEventListener('focus', syncUserFromStorage);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pageshow', syncUserFromStorage);
      window.removeEventListener('focus', syncUserFromStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Handle window resize for responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarVisible(true);
      } else {
        setSidebarVisible(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handler functions
  const handleTournamentSuccess = () => {
    refetchTournaments();
  };

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const handleSectionChange = useCallback(
    (section) => {
      if (!SECTION_TITLES[section]) return;
      setActiveSection(section);
      if (isMobile) {
        setSidebarVisible(false);
      }
    },
    [isMobile]
  );

  useEffect(() => {
    const handleSuperAdminNavigate = (event) => {
      if (typeof event.detail === 'string') {
        handleSectionChange(event.detail);
      }
    };
    window.addEventListener('superadmin:navigate', handleSuperAdminNavigate);
    return () => window.removeEventListener('superadmin:navigate', handleSuperAdminNavigate);
  }, [handleSectionChange]);

  // Loading state
  if (!allDataLoaded) {
    return (
      <div className="super-admin-dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
          <div style={{ fontSize: '18px', color: '#94a3b8' }}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  // Access control
  if (!user || user?.role !== 'SuperAdmin') {
    return (
      <div className="super-admin-dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="content-section" style={{ maxWidth: '600px', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '20px' }}>Access Denied</h2>
          <p style={{ color: '#94a3b8', marginBottom: '20px' }}>
            You don't have permission to access this page. This is a Super Admin only area.
          </p>
          <button 
            className="section-action"
            onClick={() => navigate('/login/super-admin')}
          >
            Go to Super Admin Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="super-admin-dashboard">
      <SuperAdminSidebar 
        activeSection={activeSection} 
        setActiveSection={handleSectionChange} 
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
      />

      {/* Header Bar */}
      <header className={`dashboard-header-bar ${!sidebarVisible && isMobile ? 'sidebar-hidden' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            className="menu-toggle-btn"
            onClick={toggleSidebar}
            title="Toggle navigation"
            style={{ display: isMobile ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center' }}
          >
            ☰
          </button>
          <div className="header-title" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
            <span className="header-label" style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a78bfa', fontWeight: 600 }}>Super Admin</span>
            <strong style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff', textShadow: '0 2px 8px rgba(99, 102, 241, 0.3)' }}>{SECTION_TITLES[activeSection] || 'Dashboard'}</strong>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`dashboard-main-content ${!sidebarVisible && isMobile ? 'sidebar-hidden' : ''}`}>
        {activeSection === 'overview' && (
          <DashboardOverview
            tournaments={tournaments}
            loading={tournamentsLoading}
            stats={stats}
            onTournamentSuccess={handleTournamentSuccess}
          />
        )}

        {activeSection === 'tournaments' && (
          <TournamentsTab
            tournaments={tournaments}
            loading={tournamentsLoading}
            onTournamentSuccess={handleTournamentSuccess}
          />
        )}
        {activeSection === 'reports' && <ReportsTab />}

        {activeSection === 'settings' && (
          <SettingsTab
            stats={stats}
            tournaments={tournaments}
          />
        )}
      </main>
    </div>
  );
}

export default Dashboard;
