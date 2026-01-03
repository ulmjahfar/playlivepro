import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SuperAdminSidebar from './components/SuperAdminSidebar';
import TournamentCreate from './TournamentCreate';
import './styles-tournament-create-simple.css';
import './styles-super-admin-dashboard.css';
import './styles-dashboard.css';

function TournamentCreatePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [allDataLoaded, setAllDataLoaded] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [activeSection, setActiveSection] = useState('tournaments');

  // Authentication check
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

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const handleSectionChange = useCallback(
    (section) => {
      if (section === 'tournaments') {
        navigate('/dashboard/superadmin');
        return;
      }
      setActiveSection(section);
      if (isMobile) {
        setSidebarVisible(false);
      }
    },
    [isMobile, navigate]
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

  const handleClose = () => {
    navigate('/dashboard/superadmin');
  };

  const handleSuccess = () => {
    // This will be called when the user clicks "Done" in the success popup
    // Navigate back to dashboard
    navigate('/dashboard/superadmin');
  };

  const handleTournamentSuccess = () => {
    // This is called immediately after tournament creation
    // The success popup will show, and user clicks "Done" which calls onSuccess
    // No navigation here, let the success popup handle it
  };

  // Loading state
  if (!allDataLoaded) {
    return (
      <div className="super-admin-dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
          <div style={{ fontSize: '18px', color: '#94a3b8' }}>Loading...</div>
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

      {/* Main Content */}
      <main className={`simple-main-content ${!sidebarVisible && isMobile ? 'sidebar-hidden' : ''}`}>
        <div className="simple-form-wrapper">
          <TournamentCreate
            isPageMode={true}
            onClose={handleClose}
            onSuccess={handleSuccess}
            onTournamentSuccess={handleTournamentSuccess}
          />
        </div>
      </main>
    </div>
  );
}

export default TournamentCreatePage;

