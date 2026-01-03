import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useAppLogo } from '../hooks/useAppLogo';
import './SuperAdminSidebar.css';

const SuperAdminSidebar = ({ visible = true, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logoUrl } = useAppLogo();

  const handleLogout = () => {
    if (!window.confirm('Are you sure you want to logout?')) return;

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    navigate('/', { replace: true });
    window.location.replace('/');
  };

  const navGroups = useMemo(
    () => [
      {
        title: 'Overview',
        items: [
          {
            id: 'overview',
            label: 'Dashboard',
            icon: '📊',
            description: 'Overview & statistics',
            path: '/dashboard/superadmin'
          }
        ]
      },
      {
        title: 'Operations',
        items: [
          {
            id: 'tournaments',
            label: 'Tournaments',
            icon: '🏆',
            description: 'Manage tournaments',
            path: '/dashboard/superadmin/tournaments'
          },
          {
            id: 'users',
            label: 'Users',
            icon: '👥',
            description: 'User management',
            path: '/dashboard/superadmin/users'
          }
        ]
      },
      {
        title: 'Platform',
        items: [
          {
            id: 'reports',
            label: 'Reports',
            icon: '📋',
            description: 'Analytics & reports',
            path: '/dashboard/superadmin/reports'
          },
          {
            id: 'audit',
            label: 'Audit Logs',
            icon: '🕵️',
            description: 'System activity trail',
            path: '/dashboard/superadmin/audit'
          },
          {
            id: 'settings',
            label: 'Settings',
            icon: '⚙️',
            description: 'Preferences & security',
            path: '/dashboard/superadmin/settings'
          }
        ]
      }
    ],
    []
  );

  const [isMobileSidebar, setIsMobileSidebar] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 1024 : false
  );

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setIsMobileSidebar(window.innerWidth <= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavClick = () => {
    if (isMobileSidebar && onClose) {
      onClose();
    }
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  // Check if a path is active (exact match for root, starts with for others)
  const isActiveRoute = (path) => {
    if (path === '/dashboard/superadmin') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  // Flatten all nav items for horizontal display
  const allNavItems = useMemo(() => {
    return navGroups.flatMap(group => group.items);
  }, [navGroups]);

  return (
    <header className={`super-admin-banner ${visible ? 'visible' : 'hidden'} theme-light`}>
      <div className="banner-container">
        {/* Logo Section */}
        <div className="banner-logo-section">
          <div className="logo-container">
            {logoUrl ? (
              <img src={logoUrl} alt="App Logo" className="logo-image" />
            ) : (
              <img src="/logo192.png" alt="PlayLive Logo" className="logo-image" />
            )}
            <div className="logo-text">
              <h3>PlayLive</h3>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="banner-nav">
          {allNavItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={handleNavClick}
              className={`banner-nav-item ${isActiveRoute(item.path) ? 'active' : ''}`}
              title={item.description}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Section */}
        <div className="banner-user-section">
          <div className="user-info">
            <div className="user-details">
              <span className="user-name">Super Admin</span>
              <span className="user-role">Administrator</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="logout-btn"
            title="Logout"
          >
            <span className="logout-icon">🚪</span>
            <span className="logout-label">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default SuperAdminSidebar;
