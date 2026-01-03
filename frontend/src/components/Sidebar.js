import React from 'react';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ activeSection, setActiveSection, visible = true }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleMenuItemClick = (section) => {
    setActiveSection(section);
    // Close sidebar on mobile after selecting a menu item
    if (window.innerWidth <= 768) {
      setTimeout(() => {
        // Use a timeout to ensure the section change is processed first
        // This will be handled by the parent component's visibility logic
      }, 100);
    }
  };

  const menuItems = [
    {
      id: '',
      label: ' ',
      icon: '📊',
      description: 'Dashboard'
    },
    {
      id: '',
      label: '',
      icon: '🏆',
      description: 'Tournaments'
    },
    {
      id: '',
      label: ' ',
      icon: '👨‍💼',
        description: 'Tournament Admins'
    },

    {
      id: '',
      label: ' ',
      icon: '🔗',
      description: 'Registration Links'
          
    },
    
    {
      id: '',
      label: ' ',
      icon: '🛠️',
      description  : 'System Status'
      },

      {
      id: '',
      label: ' ',
      icon: '👥',
      description: 'User Management'
      },
      
      {
      id: '',
      label: ' ',
      icon: '📝',
      description: 'Activity Logs'
      
    },
    {
      id: '',
      label: '',
      icon: '📋',
      description: 'Reports'
      
    },
    {
      id: '',
      label: '',
      icon: '⚙️',
      description : 'Settings'
      
    }
  
    
  ];

  return (
    <div className={`sidebar ${visible ? 'visible' : 'hidden'}`}>
      {/* App Logo */}
      <div className="sidebar-header">
        <img src="/logo192.png" alt="App Logo" className="sidebar-logo" />
        <h3 className="sidebar-app-name">Tournament Management System</h3>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
            title={item.description}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            <span className="nav-description">{item.description}</span>
          </button>
        ))}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="nav-item logout-btn"
          title="Logout"
        >
          <span className="nav-icon">🚪</span>
          <span className="nav-label">Logout</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <span className="user-role">Super Admin</span>
        </div>
        <div className="version-info">
          <small>v1.0.0</small>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
