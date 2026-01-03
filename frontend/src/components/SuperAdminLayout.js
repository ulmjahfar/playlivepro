import React, { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import SuperAdminSidebar from './SuperAdminSidebar';
import '../styles-super-admin-dashboard.css';

const SuperAdminLayout = () => {
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
  const [sidebarVisible] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!token || !storedUser) {
      navigate('/', { replace: true });
      return;
    }
    
    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setAllDataLoaded(true);
    } catch {
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

  const handleCloseSidebar = () => {
    // Banner is always visible, no close action needed
  };

  // Loading state
  if (!allDataLoaded) {
    return (
      <div className="super-admin-dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner-modern"></div>
          <div style={{ fontSize: '18px', color: '#94a3b8', marginTop: '20px' }}>Loading dashboard...</div>
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
        visible={sidebarVisible}
        onClose={handleCloseSidebar}
      />

      {/* Main Content */}
      <main className="dashboard-main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default SuperAdminLayout;

