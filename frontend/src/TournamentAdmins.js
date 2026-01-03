import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-admin-modern.css';

function TournamentAdmins() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });
  const [passwordVisible, setPasswordVisible] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddManagerModal, setShowAddManagerModal] = useState(false);
  const [showAddControllerModal, setShowAddControllerModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [managers, setManagers] = useState([]);
  const [controllers, setControllers] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: ''
  });
  const [managerFormData, setManagerFormData] = useState({
    name: '',
    email: '',
    mobile: ''
  });
  const [controllerFormData, setControllerFormData] = useState({
    name: '',
    email: '',
    mobile: ''
  });

  const normalizedRole = (user?.role || '').toString().toLowerCase();
  const isSuperAdmin = ['superadmin', 'super_admin'].includes(normalizedRole);

  // Helper function to generate default values for auto-creation
  const generateDefaultUserData = (type, tournamentCode, counter = 1) => {
    const typeMap = {
      admin: { namePrefix: 'Tournament Admin', emailPrefix: 'admin' },
      manager: { namePrefix: 'Tournament Manager', emailPrefix: 'manager' },
      controller: { namePrefix: 'Auction Controller', emailPrefix: 'controller' }
    };

    const config = typeMap[type] || typeMap.manager;
    const name = counter === 1 
      ? config.namePrefix 
      : `${config.namePrefix} ${counter}`;
    const email = counter === 1
      ? `${config.emailPrefix}.${tournamentCode}@playlive.com`
      : `${config.emailPrefix}.${tournamentCode}.${counter}@playlive.com`;

    return {
      name,
      email,
      mobile: ''
    };
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch tournament details
      const tournamentRes = await axios.get(
        `${API_BASE_URL}/api/tournaments/${code}`,
        { headers }
      );
      setTournament(tournamentRes.data.tournament);

      const tournamentId = tournamentRes.data.tournament._id;

      // Fetch all admins (only SuperAdmin can see all admins)
      if (isSuperAdmin) {
        try {
          const adminsRes = await axios.get(
            `${API_BASE_URL}/api/users/admins`,
            { headers, params: { limit: 100 } }
          );

          // Filter admins by tournament ID
          const tournamentAdmins = (adminsRes.data.admins || []).filter(admin => 
            admin.tournamentId?._id?.toString() === tournamentId.toString() ||
            admin.tournamentId?.toString() === tournamentId.toString()
          );
          setAdmins(tournamentAdmins);
        } catch (err) {
          console.error('Error fetching admins:', err);
          // If tournament has an adminId, fetch that admin
          if (tournamentRes.data.tournament.adminId) {
            const adminId = tournamentRes.data.tournament.adminId._id || tournamentRes.data.tournament.adminId;
            try {
              const adminRes = await axios.get(
                `${API_BASE_URL}/api/users/${adminId}`,
                { headers }
              );
              setAdmins([adminRes.data.user]);
            } catch {
              setAdmins([]);
            }
          }
        }
      } else {
        // For tournament admin, show only their own details
        const tournamentAdminId = tournamentRes.data.tournament.adminId?._id || tournamentRes.data.tournament.adminId;
        if (tournamentAdminId) {
          try {
            const adminRes = await axios.get(
              `${API_BASE_URL}/api/users/${tournamentAdminId}`,
              { headers }
            );
            setAdmins([adminRes.data.user]);
          } catch {
            setAdmins([]);
          }
        }
      }

      // Fetch managers for this tournament
      try {
        const managersRes = await axios.get(
          `${API_BASE_URL}/api/users/managers`,
          { headers, params: { tournamentId, limit: 100 } }
        );
        setManagers(managersRes.data.managers || []);
      } catch (err) {
        console.error('Error fetching managers:', err);
        setManagers([]);
      }

      // Fetch controllers for this tournament
      try {
        const controllersRes = await axios.get(
          `${API_BASE_URL}/api/users/controllers`,
          { headers, params: { tournamentId, limit: 100 } }
        );
        setControllers(controllersRes.data.controllers || []);
      } catch (err) {
        console.error('Error fetching controllers:', err);
        setControllers([]);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load tournament admins');
    } finally {
      setLoading(false);
    }
  }, [code, isSuperAdmin]);

  // Authentication check
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
          toast.error('You do not have access to this page');
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

    fetchData();
  }, [navigate, code, fetchData]);

  const handleAddAdmin = async (userData = null, retryCount = 0) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Auto-generate values if not provided
      let dataToSend;
      if (userData) {
        dataToSend = { ...userData, tournamentId: tournament._id };
      } else {
        const generatedData = generateDefaultUserData('admin', tournament.code, retryCount + 1);
        dataToSend = { ...generatedData, tournamentId: tournament._id };
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/users/admins`,
        dataToSend,
        { headers }
      );

      const adminData = res.data.admin || {};
      const username = adminData.username || 'N/A';
      const password = adminData.plainPassword || adminData.password || 'N/A';
      
      toast.success(`Admin created successfully! Username: ${username}, Password: ${password}`);
      setShowAddModal(false);
      setFormData({ name: '', email: '', mobile: '' });
      fetchData();
    } catch (err) {
      console.error('Error creating admin:', err);
      const errorMessage = err.response?.data?.message || 'Failed to create admin';
      
      // If email already exists and we're auto-generating, retry with incremented counter
      if (errorMessage.includes('email already exists') && !userData && retryCount < 10) {
        return handleAddAdmin(null, retryCount + 1);
      }
      
      toast.error(errorMessage);
    }
  };

  const handleAddManager = async (userData = null, retryCount = 0) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Auto-generate values if not provided
      let dataToSend;
      if (userData) {
        dataToSend = { ...userData, tournamentId: tournament._id };
      } else {
        const generatedData = generateDefaultUserData('manager', tournament.code, retryCount + 1);
        dataToSend = { ...generatedData, tournamentId: tournament._id };
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/users/managers`,
        dataToSend,
        { headers }
      );

      const managerData = res.data.manager || {};
      const username = managerData.username || 'N/A';
      const password = managerData.plainPassword || managerData.password || 'N/A';

      toast.success(`Manager created successfully! Username: ${username}, Password: ${password}`);
      setShowAddManagerModal(false);
      setManagerFormData({ name: '', email: '', mobile: '' });
      fetchData();
    } catch (err) {
      console.error('Error creating manager:', err);
      const errorMessage = err.response?.data?.message || 'Failed to create manager';
      
      // If email already exists and we're auto-generating, retry with incremented counter
      if (errorMessage.includes('email already exists') && !userData && retryCount < 10) {
        return handleAddManager(null, retryCount + 1);
      }
      
      toast.error(errorMessage);
    }
  };

  const handleAddController = async (userData = null, retryCount = 0) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Auto-generate values if not provided
      let dataToSend;
      if (userData) {
        dataToSend = { ...userData, tournamentId: tournament._id };
      } else {
        const generatedData = generateDefaultUserData('controller', tournament.code, retryCount + 1);
        dataToSend = { ...generatedData, tournamentId: tournament._id };
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/users/controllers`,
        dataToSend,
        { headers }
      );

      const controllerData = res.data.controller || {};
      const username = controllerData.username || 'N/A';
      const password = controllerData.plainPassword || controllerData.password || 'N/A';

      toast.success(`Controller created successfully! Username: ${username}, Password: ${password}`);
      setShowAddControllerModal(false);
      setControllerFormData({ name: '', email: '', mobile: '' });
      fetchData();
    } catch (err) {
      console.error('Error creating controller:', err);
      const errorMessage = err.response?.data?.message || 'Failed to create controller';
      
      // If email already exists and we're auto-generating, retry with incremented counter
      if (errorMessage.includes('email already exists') && !userData && retryCount < 10) {
        return handleAddController(null, retryCount + 1);
      }
      
      toast.error(errorMessage);
    }
  };

  const handleEditAdmin = (admin) => {
    setSelectedAdmin(admin);
    setFormData({
      name: admin.name || '',
      email: admin.email || '',
      mobile: admin.mobile || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateAdmin = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.put(
        `${API_BASE_URL}/api/users/admins/${selectedAdmin._id}`,
        {
          ...formData,
          status: selectedAdmin.status || 'Active'
        },
        { headers }
      );

      toast.success('Admin updated successfully');
      setShowEditModal(false);
      setSelectedAdmin(null);
      setFormData({ name: '', email: '', mobile: '' });
      fetchData();
    } catch (err) {
      console.error('Error updating admin:', err);
      toast.error(err.response?.data?.message || 'Failed to update admin');
    }
  };

  const handleResetPassword = async (adminId) => {
    if (!window.confirm('Are you sure you want to reset this admin\'s password?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const res = await axios.put(
        `${API_BASE_URL}/api/users/reset-password/${adminId}`,
        {},
        { headers }
      );

      toast.success(`Password reset successfully. New password: ${res.data.newPassword}`);
      fetchData();
    } catch (err) {
      console.error('Error resetting password:', err);
      toast.error(err.response?.data?.message || 'Failed to reset password');
    }
  };

  const togglePasswordVisibility = (adminId) => {
    setPasswordVisible(prev => ({
      ...prev,
      [adminId]: !prev[adminId]
    }));
  };

  const copyToClipboard = async (text, label) => {
    if (!text || text === 'N/A') {
      toast.error('Nothing to copy');
      return;
    }

    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard!`);
        return;
      }

      // Fallback to older method
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          toast.success(`${label} copied to clipboard!`);
        } else {
          throw new Error('Copy command failed');
        }
      } catch (err) {
        // If execCommand fails, show the text in an alert as last resort
        toast.info(`${label}: ${text}`);
      } finally {
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Show the text in a toast as fallback
      toast.info(`${label}: ${text}`);
    }
  };

  const shareOnWhatsApp = (adminData, roleType = 'Admin') => {
    const roleLabel = roleType === 'Admin' ? 'Tournament Admin' : roleType === 'Manager' ? 'Tournament Manager' : 'Auction Controller';
    const name = adminData.name || adminData.username || 'Unknown';
    const username = adminData.username || 'N/A';
    const email = adminData.email || 'N/A';
    const mobile = adminData.mobile || 'N/A';
    const password = adminData.plainPassword || adminData.password || 'N/A';
    const tournamentName = tournament?.name || code;
    const baseUrl = window.location?.origin || '';
    const loginUrl = `${baseUrl}/login/tournament-admin`;

    let message = `*${roleLabel} Credentials*\n\n`;
    message += `Tournament: ${tournamentName}\n`;
    message += `Name: ${name}\n`;
    message += `Username: ${username}\n`;
    message += `Email: ${email}\n`;
    if (mobile !== 'N/A') {
      message += `Mobile: ${mobile}\n`;
    }
    if (password !== 'N/A') {
      message += `Password: ${password}\n`;
    }
    message += `\n🔗 Login Page: ${loginUrl}\n`;
    message += `\nPlease keep these credentials secure.\n\n`;
    message += `Powered by PlayLive 🎮`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    toast.success('Opening WhatsApp...');
  };

  const shareAllCredentialsOnWhatsApp = () => {
    const tournamentName = tournament?.name || code;
    const baseUrl = window.location?.origin || '';
    const loginUrl = `${baseUrl}/login/tournament-admin`;

    let message = `*All Tournament Credentials*\n\n`;
    message += `🏆 Tournament: ${tournamentName}\n`;
    message += `🏷️ Code: ${code}\n\n`;
    message += `═══════════════════════\n\n`;

    // Tournament Admins Section
    if (admins.length > 0) {
      message += `*1️⃣ TOURNAMENT ADMINS*\n\n`;
      admins.forEach((admin, index) => {
        const name = admin.name || admin.username || 'Unknown';
        const username = admin.username || 'N/A';
        const email = admin.email || 'N/A';
        const mobile = admin.mobile || 'N/A';
        const password = admin.plainPassword || admin.password || 'N/A';
        
        message += `${index + 1}. ${name}\n`;
        message += `   Username: ${username}\n`;
        message += `   Email: ${email}\n`;
        if (mobile !== 'N/A') {
          message += `   Mobile: ${mobile}\n`;
        }
        if (password !== 'N/A') {
          message += `   Password: ${password}\n`;
        }
        message += `\n`;
      });
      message += `\n`;
    }

    // Tournament Managers Section
    if (managers.length > 0) {
      message += `*2️⃣ TOURNAMENT MANAGERS*\n\n`;
      managers.forEach((manager, index) => {
        const name = manager.name || manager.username || 'Unknown';
        const username = manager.username || 'N/A';
        const email = manager.email || 'N/A';
        const mobile = manager.mobile || 'N/A';
        const password = manager.plainPassword || manager.password || 'N/A';
        
        message += `${index + 1}. ${name}\n`;
        message += `   Username: ${username}\n`;
        message += `   Email: ${email}\n`;
        if (mobile !== 'N/A') {
          message += `   Mobile: ${mobile}\n`;
        }
        if (password !== 'N/A') {
          message += `   Password: ${password}\n`;
        }
        message += `\n`;
      });
      message += `\n`;
    }

    // Auction Controllers Section
    if (controllers.length > 0) {
      message += `*3️⃣ AUCTION CONTROLLERS*\n\n`;
      controllers.forEach((controller, index) => {
        const name = controller.name || controller.username || 'Unknown';
        const username = controller.username || 'N/A';
        const email = controller.email || 'N/A';
        const mobile = controller.mobile || 'N/A';
        const password = controller.plainPassword || controller.password || 'N/A';
        
        message += `${index + 1}. ${name}\n`;
        message += `   Username: ${username}\n`;
        message += `   Email: ${email}\n`;
        if (mobile !== 'N/A') {
          message += `   Mobile: ${mobile}\n`;
        }
        if (password !== 'N/A') {
          message += `   Password: ${password}\n`;
        }
        message += `\n`;
      });
      message += `\n`;
    }

    message += `═══════════════════════\n\n`;
    message += `🔗 Login Page: ${loginUrl}\n\n`;
    message += `⚠️ Please keep these credentials secure.\n\n`;
    message += `Powered by PlayLive 🎮`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    toast.success('Opening WhatsApp with all credentials...');
  };

  if (loading) {
    return (
      <div className="admins-page-container">
        <div className="admins-loading">
          <div className="admins-spinner"></div>
          <p className="admins-loading-text">Loading tournament admins...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admins-page-container">
      {/* Header Section */}
      <div className="admins-header">
        <div className="admins-header-content">
          <div className="admins-header-text">
            <h1 className="admins-title">
              <span className="admins-title-icon">👥</span>
              Tournament Admins
            </h1>
            <p className="admins-subtitle">
              Manage administrators for <strong>{tournament?.name || code}</strong>
            </p>
          </div>
          {(isSuperAdmin || normalizedRole === 'tournamentadmin') && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {isSuperAdmin && (admins.length > 0 || managers.length > 0 || controllers.length > 0) && (
                <button
                  className="admins-add-btn"
                  onClick={shareAllCredentialsOnWhatsApp}
                  style={{ backgroundColor: '#25d366', color: '#fff' }}
                  title="Share all credentials via WhatsApp"
                >
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="https://www.w3.org/2000/svg">
                    <path d="M8 1C4.134 1 1 4.134 1 8C1 9.5 1.5 10.866 2.3 12L1 15L4.134 13.7C5.466 14.5 6.7 14.866 8 14.866C11.866 14.866 15 11.732 15 7.866C15 4 11.866 1 8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5.5 5.5C5.5 5.5 5.8 6.2 6 6.5C6.2 6.8 6.5 7.1 6.5 7.5C6.5 7.9 6.2 8.2 5.8 8.5C5.4 8.8 5 9.1 5 9.5C5 9.9 5.3 10.2 5.7 10.5C6.1 10.8 6.5 11.1 7 11.3C7.5 11.5 8 11.5 8.5 11.3C9 11.1 9.5 10.8 10 10.3C10.5 9.8 11 9.2 11.2 8.7C11.4 8.2 11.4 7.7 11.2 7.2C11 6.7 10.7 6.3 10.3 6C9.9 5.7 9.4 5.5 9 5.5C8.6 5.5 8.2 5.7 7.8 6C7.4 6.3 7 6.6 6.6 6.8C6.2 7 5.8 7.1 5.5 6.8C5.2 6.5 5.3 6.1 5.5 5.5Z" stroke="currentColor" strokeWidth="1.2" fill="currentColor"/>
                  </svg>
                  Share All Credentials
                </button>
              )}
              <button
                className="admins-add-btn"
                onClick={() => handleAddAdmin()}
                style={{ display: isSuperAdmin ? 'flex' : 'none' }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="https://www.w3.org/2000/svg">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Add Admin
              </button>
              <button
                className="admins-add-btn"
                onClick={() => handleAddManager()}
                style={{ backgroundColor: '#6366f1' }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="https://www.w3.org/2000/svg">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Add Manager
              </button>
              <button
                className="admins-add-btn"
                onClick={() => handleAddController()}
                style={{ backgroundColor: '#10b981' }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="https://www.w3.org/2000/svg">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Add Controller
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {(admins.length > 0 || managers.length > 0 || controllers.length > 0) && (
        <div className="admins-stats">
          <div className="admins-stat-card">
            <div className="admins-stat-icon">👥</div>
            <div className="admins-stat-content">
              <div className="admins-stat-value">{admins.length}</div>
              <div className="admins-stat-label">Total Admins</div>
            </div>
          </div>
          <div className="admins-stat-card">
            <div className="admins-stat-icon">👨‍💼</div>
            <div className="admins-stat-content">
              <div className="admins-stat-value">{managers.length}</div>
              <div className="admins-stat-label">Total Managers</div>
            </div>
          </div>
          <div className="admins-stat-card">
            <div className="admins-stat-icon">🎮</div>
            <div className="admins-stat-content">
              <div className="admins-stat-value">{controllers.length}</div>
              <div className="admins-stat-label">Total Controllers</div>
            </div>
          </div>
          <div className="admins-stat-card">
            <div className="admins-stat-icon">✓</div>
            <div className="admins-stat-content">
              <div className="admins-stat-value">
                {admins.filter(a => a.status === 'Active').length + managers.filter(m => m.status === 'Active').length + controllers.filter(c => c.status === 'Active').length}
              </div>
              <div className="admins-stat-label">Active</div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {admins.length === 0 && managers.length === 0 && controllers.length === 0 ? (
        <div className="admins-empty-state">
          <div className="admins-empty-icon">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="https://www.w3.org/2000/svg">
              <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="admins-empty-title">No Admins Found</h3>
          <p className="admins-empty-description">
            {isSuperAdmin
              ? 'This tournament doesn\'t have any admins assigned yet. Add your first admin to get started.'
              : 'Admin information is not available.'}
          </p>
          {isSuperAdmin && (
            <button
              className="admins-add-btn"
              onClick={() => handleAddAdmin()}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="https://www.w3.org/2000/svg">
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add First Admin
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Admins Section */}
          {admins.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: 'var(--text-primary)' }}>Tournament Admins</h2>
              <div className="admins-grid">
                {admins.map((admin, index) => (
                  <div key={admin._id} className="admins-card" style={{ animationDelay: `${index * 0.1}s` }}>
                    {/* Card Header */}
                    <div className="admins-card-header">
                      <div className="admins-card-avatar">
                        {(admin.name || admin.username || 'A').charAt(0).toUpperCase()}
                      </div>
                      <div className="admins-card-info">
                        <h3 className="admins-card-name">{admin.name || admin.username || 'Unknown'}</h3>
                        <p className="admins-card-role">{admin.role || 'Tournament Admin'}</p>
                      </div>
                      {admin.status && (
                        <span className={`admins-status-badge ${admin.status.toLowerCase()}`}>
                          {admin.status === 'Active' ? '✓' : '○'} {admin.status}
                        </span>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="admins-card-body">
                      <div className="admins-detail-item">
                        <div className="admins-detail-label">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 8C9.65685 8 11 6.65685 11 5C11 3.34315 9.65685 2 8 2C6.34315 2 5 3.34315 5 5C5 6.65685 6.34315 8 8 8Z" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M2 13.3333C2 11.1242 3.79086 9.33333 6 9.33333H10C12.2091 9.33333 14 11.1242 14 13.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Username
                        </div>
                        <div className="admins-detail-value">
                          <span>{admin.username || 'N/A'}</span>
                          <button
                            className="admins-copy-btn"
                            onClick={() => copyToClipboard(admin.username, 'Username')}
                            title="Copy username"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M5.5 4.5V2.5C5.5 1.94772 5.94772 1.5 6.5 1.5H11.5C12.0523 1.5 12.5 1.94772 12.5 2.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H9.5M5.5 4.5H4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H8.5C9.05228 14.5 9.5 14.0523 9.5 13.5V12.5M5.5 4.5C5.5 4.94772 5.94772 5.5 6.5 5.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="admins-detail-item">
                        <div className="admins-detail-label">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2.5 4.5L8 9.5L13.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Email
                        </div>
                        <div className="admins-detail-value">
                          <span>{admin.email || 'N/A'}</span>
                          <button
                            className="admins-copy-btn"
                            onClick={() => copyToClipboard(admin.email, 'Email')}
                            title="Copy email"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M5.5 4.5V2.5C5.5 1.94772 5.94772 1.5 6.5 1.5H11.5C12.0523 1.5 12.5 1.94772 12.5 2.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H9.5M5.5 4.5H4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H8.5C9.05228 14.5 9.5 14.0523 9.5 13.5V12.5M5.5 4.5C5.5 4.94772 5.94772 5.5 6.5 5.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      {admin.mobile && (
                        <div className="admins-detail-item">
                          <div className="admins-detail-label">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M11.5 1.5H4.5C3.94772 1.5 3.5 1.94772 3.5 2.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H11.5C12.0523 14.5 12.5 14.0523 12.5 13.5V2.5C12.5 1.94772 12.0523 1.5 11.5 1.5Z" stroke="currentColor" strokeWidth="1.5"/>
                            </svg>
                            Mobile
                          </div>
                          <div className="admins-detail-value">
                            <span>{admin.mobile}</span>
                            <button
                              className="admins-copy-btn"
                              onClick={() => copyToClipboard(admin.mobile, 'Mobile')}
                              title="Copy mobile"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M5.5 4.5V2.5C5.5 1.94772 5.94772 1.5 6.5 1.5H11.5C12.0523 1.5 12.5 1.94772 12.5 2.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H9.5M5.5 4.5H4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H8.5C9.05228 14.5 9.5 14.0523 9.5 13.5V12.5M5.5 4.5C5.5 4.94772 5.94772 5.5 6.5 5.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}

                      {isSuperAdmin && admin.plainPassword && (
                        <div className="admins-detail-item">
                          <div className="admins-detail-label">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M4 7.5V5.5C4 3.567 5.567 2 7.5 2H8.5C10.433 2 12 3.567 12 5.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              <rect x="2.5" y="7.5" width="11" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                              <path d="M8 10.5V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            Password
                          </div>
                          <div className="admins-detail-value">
                            <span className={passwordVisible[admin._id] ? '' : 'admins-password-hidden'}>
                              {passwordVisible[admin._id] ? admin.plainPassword : '••••••••'}
                            </span>
                            <button
                              className="admins-copy-btn"
                              onClick={() => togglePasswordVisibility(admin._id)}
                              title={passwordVisible[admin._id] ? 'Hide password' : 'Show password'}
                            >
                              {passwordVisible[admin._id] ? (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <path d="M1.5 8C1.5 8 3.5 4 8 4C12.5 4 14.5 8 14.5 8C14.5 8 12.5 12 8 12C3.5 12 1.5 8 1.5 8Z" stroke="currentColor" strokeWidth="1.5"/>
                                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
                                </svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <path d="M2.5 2.5L13.5 13.5M6.5 6.5C6.18624 6.81064 6 7.22593 6 7.66667C6 8.55119 6.71573 9.26667 7.6 9.26667C8.04074 9.26667 8.45603 9.08043 8.76667 8.76667M11.5 10.5C12.163 10.1055 12.7145 9.56524 13.1 8.93333C13.5 8.26667 13.5 7.73333 13.1 7.06667C12.7145 6.43476 12.163 5.89453 11.5 5.5M1.5 8C1.5 8 3.5 4 8 4C8.66667 4 9.3 4.13333 9.86667 4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                  <path d="M6.5 9.5L4.5 11.5M9.5 6.5L11.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                              )}
                            </button>
                            <button
                              className="admins-copy-btn"
                              onClick={() => copyToClipboard(admin.plainPassword, 'Password')}
                              title="Copy password"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M5.5 4.5V2.5C5.5 1.94772 5.94772 1.5 6.5 1.5H11.5C12.0523 1.5 12.5 1.94772 12.5 2.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H9.5M5.5 4.5H4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H8.5C9.05228 14.5 9.5 14.0523 9.5 13.5V12.5M5.5 4.5C5.5 4.94772 5.94772 5.5 6.5 5.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="admins-detail-item">
                        <div className="admins-detail-label">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2.5 4.5H13.5M4.5 2.5V6.5M11.5 2.5V6.5M3.5 4.5H2.5C1.94772 4.5 1.5 4.94772 1.5 5.5V13.5C1.5 14.0523 1.94772 14.5 2.5 14.5H13.5C14.0523 14.5 14.5 14.0523 14.5 13.5V5.5C14.5 4.94772 14.0523 4.5 13.5 4.5H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Created
                        </div>
                        <div className="admins-detail-value">
                          <span>{admin.createdAt ? new Date(admin.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          }) : 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    {isSuperAdmin && (
                      <div className="admins-card-actions">
                        <button
                          className="admins-action-btn admins-action-edit"
                          onClick={() => handleEditAdmin(admin)}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M11.5 2.5L13.5 4.5L5.5 12.5H3.5V10.5L11.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Edit
                        </button>
                        <button
                          className="admins-action-btn admins-action-reset"
                          onClick={() => handleResetPassword(admin._id)}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 2.5V5.5M8 10.5V13.5M13.5 8H10.5M5.5 8H2.5M11.5 4.5L9.5 6.5M6.5 9.5L4.5 11.5M11.5 11.5L9.5 9.5M6.5 6.5L4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Reset
                        </button>
                        <button
                          className="admins-action-btn admins-action-credentials"
                          onClick={() => navigate(`/tournament/${admin.tournamentId?.code || code}/credentials`)}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M3.5 4.5H12.5C13.0523 4.5 13.5 4.94772 13.5 5.5V11.5C13.5 12.0523 13.0523 12.5 12.5 12.5H3.5C2.94772 12.5 2.5 12.0523 2.5 11.5V5.5C2.5 4.94772 2.94772 4.5 3.5 4.5Z" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M5.5 7.5H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Credentials
                        </button>
                        <button
                          className="admins-action-btn admins-action-whatsapp"
                          onClick={() => shareOnWhatsApp(admin, 'Admin')}
                          title="Share credentials via WhatsApp"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 1C4.134 1 1 4.134 1 8C1 9.5 1.5 10.866 2.3 12L1 15L4.134 13.7C5.466 14.5 6.7 14.866 8 14.866C11.866 14.866 15 11.732 15 7.866C15 4 11.866 1 8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M5.5 5.5C5.5 5.5 5.8 6.2 6 6.5C6.2 6.8 6.5 7.1 6.5 7.5C6.5 7.9 6.2 8.2 5.8 8.5C5.4 8.8 5 9.1 5 9.5C5 9.9 5.3 10.2 5.7 10.5C6.1 10.8 6.5 11.1 7 11.3C7.5 11.5 8 11.5 8.5 11.3C9 11.1 9.5 10.8 10 10.3C10.5 9.8 11 9.2 11.2 8.7C11.4 8.2 11.4 7.7 11.2 7.2C11 6.7 10.7 6.3 10.3 6C9.9 5.7 9.4 5.5 9 5.5C8.6 5.5 8.2 5.7 7.8 6C7.4 6.3 7 6.6 6.6 6.8C6.2 7 5.8 7.1 5.5 6.8C5.2 6.5 5.3 6.1 5.5 5.5Z" stroke="currentColor" strokeWidth="1.2" fill="currentColor"/>
                          </svg>
                          Share
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Managers Section */}
          {managers.length > 0 && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: 'var(--text-primary)' }}>Tournament Managers</h2>
              <div className="admins-grid">
                {managers.map((manager, index) => (
                  <div key={manager._id} className="admins-card" style={{ animationDelay: `${(admins.length + index) * 0.1}s` }}>
                    <div className="admins-card-header">
                      <div className="admins-card-avatar">
                        {(manager.name || manager.username || 'M').charAt(0).toUpperCase()}
                      </div>
                      <div className="admins-card-info">
                        <h3 className="admins-card-name">{manager.name || manager.username || 'Unknown'}</h3>
                        <p className="admins-card-role">Tournament Manager</p>
                      </div>
                      {manager.status && (
                        <span className={`admins-status-badge ${manager.status.toLowerCase()}`}>
                          {manager.status === 'Active' ? '✓' : '○'} {manager.status}
                        </span>
                      )}
                    </div>
                    <div className="admins-card-body">
                      <div className="admins-detail-item">
                        <div className="admins-detail-label">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 8C9.65685 8 11 6.65685 11 5C11 3.34315 9.65685 2 8 2C6.34315 2 5 3.34315 5 5C5 6.65685 6.34315 8 8 8Z" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M2 13.3333C2 11.1242 3.79086 9.33333 6 9.33333H10C12.2091 9.33333 14 11.1242 14 13.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Username
                        </div>
                        <div className="admins-detail-value">
                          <span>{manager.username || 'N/A'}</span>
                          <button
                            className="admins-copy-btn"
                            onClick={() => copyToClipboard(manager.username, 'Username')}
                            title="Copy username"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M5.5 4.5V2.5C5.5 1.94772 5.94772 1.5 6.5 1.5H11.5C12.0523 1.5 12.5 1.94772 12.5 2.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H9.5M5.5 4.5H4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H8.5C9.05228 14.5 9.5 14.0523 9.5 13.5V12.5M5.5 4.5C5.5 4.94772 5.94772 5.5 6.5 5.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="admins-detail-item">
                        <div className="admins-detail-label">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2.5 4.5L8 9.5L13.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Email
                        </div>
                        <div className="admins-detail-value">
                          <span>{manager.email || 'N/A'}</span>
                          <button
                            className="admins-copy-btn"
                            onClick={() => copyToClipboard(manager.email, 'Email')}
                            title="Copy email"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M5.5 4.5V2.5C5.5 1.94772 5.94772 1.5 6.5 1.5H11.5C12.0523 1.5 12.5 1.94772 12.5 2.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H9.5M5.5 4.5H4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H8.5C9.05228 14.5 9.5 14.0523 9.5 13.5V12.5M5.5 4.5C5.5 4.94772 5.94772 5.5 6.5 5.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      {manager.mobile && (
                        <div className="admins-detail-item">
                          <div className="admins-detail-label">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M11.5 1.5H4.5C3.94772 1.5 3.5 1.94772 3.5 2.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H11.5C12.0523 14.5 12.5 14.0523 12.5 13.5V2.5C12.5 1.94772 12.0523 1.5 11.5 1.5Z" stroke="currentColor" strokeWidth="1.5"/>
                            </svg>
                            Mobile
                          </div>
                          <div className="admins-detail-value">
                            <span>{manager.mobile}</span>
                            <button
                              className="admins-copy-btn"
                              onClick={() => copyToClipboard(manager.mobile, 'Mobile')}
                              title="Copy mobile"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M5.5 4.5V2.5C5.5 1.94772 5.94772 1.5 6.5 1.5H11.5C12.0523 1.5 12.5 1.94772 12.5 2.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H9.5M5.5 4.5H4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H8.5C9.05228 14.5 9.5 14.0523 9.5 13.5V12.5M5.5 4.5C5.5 4.94772 5.94772 5.5 6.5 5.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                      {(isSuperAdmin || normalizedRole === 'tournamentadmin') && manager.plainPassword && (
                        <div className="admins-detail-item">
                          <div className="admins-detail-label">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M4 7.5V5.5C4 3.567 5.567 2 7.5 2H8.5C10.433 2 12 3.567 12 5.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              <rect x="2.5" y="7.5" width="11" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                              <path d="M8 10.5V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            Password
                          </div>
                          <div className="admins-detail-value">
                            <span className={passwordVisible[manager._id] ? '' : 'admins-password-hidden'}>
                              {passwordVisible[manager._id] ? manager.plainPassword : '••••••••'}
                            </span>
                            <button
                              className="admins-copy-btn"
                              onClick={() => togglePasswordVisibility(manager._id)}
                              title={passwordVisible[manager._id] ? 'Hide password' : 'Show password'}
                            >
                              {passwordVisible[manager._id] ? (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <path d="M1.5 8C1.5 8 3.5 4 8 4C12.5 4 14.5 8 14.5 8C14.5 8 12.5 12 8 12C3.5 12 1.5 8 1.5 8Z" stroke="currentColor" strokeWidth="1.5"/>
                                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
                                </svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <path d="M2.5 2.5L13.5 13.5M6.5 6.5C6.18624 6.81064 6 7.22593 6 7.66667C6 8.55119 6.71573 9.26667 7.6 9.26667C8.04074 9.26667 8.45603 9.08043 8.76667 8.76667M11.5 10.5C12.163 10.1055 12.7145 9.56524 13.1 8.93333C13.5 8.26667 13.5 7.73333 13.1 7.06667C12.7145 6.43476 12.163 5.89453 11.5 5.5M1.5 8C1.5 8 3.5 4 8 4C8.66667 4 9.3 4.13333 9.86667 4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                  <path d="M6.5 9.5L4.5 11.5M9.5 6.5L11.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                              )}
                            </button>
                            <button
                              className="admins-copy-btn"
                              onClick={() => copyToClipboard(manager.plainPassword, 'Password')}
                              title="Copy password"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M5.5 4.5V2.5C5.5 1.94772 5.94772 1.5 6.5 1.5H11.5C12.0523 1.5 12.5 1.94772 12.5 2.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H9.5M5.5 4.5H4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H8.5C9.05228 14.5 9.5 14.0523 9.5 13.5V12.5M5.5 4.5C5.5 4.94772 5.94772 5.5 6.5 5.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="admins-detail-item">
                        <div className="admins-detail-label">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2.5 4.5H13.5M4.5 2.5V6.5M11.5 2.5V6.5M3.5 4.5H2.5C1.94772 4.5 1.5 4.94772 1.5 5.5V13.5C1.5 14.0523 1.94772 14.5 2.5 14.5H13.5C14.0523 14.5 14.5 14.0523 14.5 13.5V5.5C14.5 4.94772 14.0523 4.5 13.5 4.5H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Created
                        </div>
                        <div className="admins-detail-value">
                          <span>{manager.createdAt ? new Date(manager.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          }) : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    {/* Card Actions for Managers */}
                    {(isSuperAdmin || normalizedRole === 'tournamentadmin') && (
                      <div className="admins-card-actions">
                        <button
                          className="admins-action-btn admins-action-whatsapp"
                          onClick={() => shareOnWhatsApp(manager, 'Manager')}
                          title="Share credentials via WhatsApp"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 1C4.134 1 1 4.134 1 8C1 9.5 1.5 10.866 2.3 12L1 15L4.134 13.7C5.466 14.5 6.7 14.866 8 14.866C11.866 14.866 15 11.732 15 7.866C15 4 11.866 1 8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M5.5 5.5C5.5 5.5 5.8 6.2 6 6.5C6.2 6.8 6.5 7.1 6.5 7.5C6.5 7.9 6.2 8.2 5.8 8.5C5.4 8.8 5 9.1 5 9.5C5 9.9 5.3 10.2 5.7 10.5C6.1 10.8 6.5 11.1 7 11.3C7.5 11.5 8 11.5 8.5 11.3C9 11.1 9.5 10.8 10 10.3C10.5 9.8 11 9.2 11.2 8.7C11.4 8.2 11.4 7.7 11.2 7.2C11 6.7 10.7 6.3 10.3 6C9.9 5.7 9.4 5.5 9 5.5C8.6 5.5 8.2 5.7 7.8 6C7.4 6.3 7 6.6 6.6 6.8C6.2 7 5.8 7.1 5.5 6.8C5.2 6.5 5.3 6.1 5.5 5.5Z" stroke="currentColor" strokeWidth="1.2" fill="currentColor"/>
                          </svg>
                          Share
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controllers Section */}
          {controllers.length > 0 && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: 'var(--text-primary)' }}>Auction Controllers</h2>
              <div className="admins-grid">
                {controllers.map((controller, index) => (
                  <div key={controller._id} className="admins-card" style={{ animationDelay: `${(admins.length + managers.length + index) * 0.1}s` }}>
                    <div className="admins-card-header">
                      <div className="admins-card-avatar">
                        {(controller.name || controller.username || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div className="admins-card-info">
                        <h3 className="admins-card-name">{controller.name || controller.username || 'Unknown'}</h3>
                        <p className="admins-card-role">Auction Controller</p>
                      </div>
                      {controller.status && (
                        <span className={`admins-status-badge ${controller.status.toLowerCase()}`}>
                          {controller.status === 'Active' ? '✓' : '○'} {controller.status}
                        </span>
                      )}
                    </div>
                    <div className="admins-card-body">
                      <div className="admins-detail-item">
                        <div className="admins-detail-label">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 8C9.65685 8 11 6.65685 11 5C11 3.34315 9.65685 2 8 2C6.34315 2 5 3.34315 5 5C5 6.65685 6.34315 8 8 8Z" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M2 13.3333C2 11.1242 3.79086 9.33333 6 9.33333H10C12.2091 9.33333 14 11.1242 14 13.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Username
                        </div>
                        <div className="admins-detail-value">
                          <span>{controller.username || 'N/A'}</span>
                          <button
                            className="admins-copy-btn"
                            onClick={() => copyToClipboard(controller.username, 'Username')}
                            title="Copy username"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M5.5 4.5V2.5C5.5 1.94772 5.94772 1.5 6.5 1.5H11.5C12.0523 1.5 12.5 1.94772 12.5 2.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H9.5M5.5 4.5H4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H8.5C9.05228 14.5 9.5 14.0523 9.5 13.5V12.5M5.5 4.5C5.5 4.94772 5.94772 5.5 6.5 5.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="admins-detail-item">
                        <div className="admins-detail-label">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2.5 4.5L8 9.5L13.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Email
                        </div>
                        <div className="admins-detail-value">
                          <span>{controller.email || 'N/A'}</span>
                          <button
                            className="admins-copy-btn"
                            onClick={() => copyToClipboard(controller.email, 'Email')}
                            title="Copy email"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M5.5 4.5V2.5C5.5 1.94772 5.94772 1.5 6.5 1.5H11.5C12.0523 1.5 12.5 1.94772 12.5 2.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H9.5M5.5 4.5H4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H8.5C9.05228 14.5 9.5 14.0523 9.5 13.5V12.5M5.5 4.5C5.5 4.94772 5.94772 5.5 6.5 5.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      {controller.mobile && (
                        <div className="admins-detail-item">
                          <div className="admins-detail-label">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M11.5 1.5H4.5C3.94772 1.5 3.5 1.94772 3.5 2.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H11.5C12.0523 14.5 12.5 14.0523 12.5 13.5V2.5C12.5 1.94772 12.0523 1.5 11.5 1.5Z" stroke="currentColor" strokeWidth="1.5"/>
                            </svg>
                            Mobile
                          </div>
                          <div className="admins-detail-value">
                            <span>{controller.mobile}</span>
                            <button
                              className="admins-copy-btn"
                              onClick={() => copyToClipboard(controller.mobile, 'Mobile')}
                              title="Copy mobile"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M5.5 4.5V2.5C5.5 1.94772 5.94772 1.5 6.5 1.5H11.5C12.0523 1.5 12.5 1.94772 12.5 2.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H9.5M5.5 4.5H4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H8.5C9.05228 14.5 9.5 14.0523 9.5 13.5V12.5M5.5 4.5C5.5 4.94772 5.94772 5.5 6.5 5.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                      {(isSuperAdmin || normalizedRole === 'tournamentadmin') && controller.plainPassword && (
                        <div className="admins-detail-item">
                          <div className="admins-detail-label">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M4 7.5V5.5C4 3.567 5.567 2 7.5 2H8.5C10.433 2 12 3.567 12 5.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              <rect x="2.5" y="7.5" width="11" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                              <path d="M8 10.5V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            Password
                          </div>
                          <div className="admins-detail-value">
                            <span className={passwordVisible[controller._id] ? '' : 'admins-password-hidden'}>
                              {passwordVisible[controller._id] ? controller.plainPassword : '••••••••'}
                            </span>
                            <button
                              className="admins-copy-btn"
                              onClick={() => togglePasswordVisibility(controller._id)}
                              title={passwordVisible[controller._id] ? 'Hide password' : 'Show password'}
                            >
                              {passwordVisible[controller._id] ? (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <path d="M1.5 8C1.5 8 3.5 4 8 4C12.5 4 14.5 8 14.5 8C14.5 8 12.5 12 8 12C3.5 12 1.5 8 1.5 8Z" stroke="currentColor" strokeWidth="1.5"/>
                                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
                                </svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <path d="M2.5 2.5L13.5 13.5M6.5 6.5C6.18624 6.81064 6 7.22593 6 7.66667C6 8.55119 6.71573 9.26667 7.6 9.26667C8.04074 9.26667 8.45603 9.08043 8.76667 8.76667M11.5 10.5C12.163 10.1055 12.7145 9.56524 13.1 8.93333C13.5 8.26667 13.5 7.73333 13.1 7.06667C12.7145 6.43476 12.163 5.89453 11.5 5.5M1.5 8C1.5 8 3.5 4 8 4C8.66667 4 9.3 4.13333 9.86667 4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                  <path d="M6.5 9.5L4.5 11.5M9.5 6.5L11.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                              )}
                            </button>
                            <button
                              className="admins-copy-btn"
                              onClick={() => copyToClipboard(controller.plainPassword, 'Password')}
                              title="Copy password"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M5.5 4.5V2.5C5.5 1.94772 5.94772 1.5 6.5 1.5H11.5C12.0523 1.5 12.5 1.94772 12.5 2.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H9.5M5.5 4.5H4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H8.5C9.05228 14.5 9.5 14.0523 9.5 13.5V12.5M5.5 4.5C5.5 4.94772 5.94772 5.5 6.5 5.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="admins-detail-item">
                        <div className="admins-detail-label">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2.5 4.5H13.5M4.5 2.5V6.5M11.5 2.5V6.5M3.5 4.5H2.5C1.94772 4.5 1.5 4.94772 1.5 5.5V13.5C1.5 14.0523 1.94772 14.5 2.5 14.5H13.5C14.0523 14.5 14.5 14.0523 14.5 13.5V5.5C14.5 4.94772 14.0523 4.5 13.5 4.5H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Created
                        </div>
                        <div className="admins-detail-value">
                          <span>{controller.createdAt ? new Date(controller.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          }) : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    {/* Card Actions for Controllers */}
                    {(isSuperAdmin || normalizedRole === 'tournamentadmin') && (
                      <div className="admins-card-actions">
                        <button
                          className="admins-action-btn admins-action-whatsapp"
                          onClick={() => shareOnWhatsApp(controller, 'Controller')}
                          title="Share credentials via WhatsApp"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 1C4.134 1 1 4.134 1 8C1 9.5 1.5 10.866 2.3 12L1 15L4.134 13.7C5.466 14.5 6.7 14.866 8 14.866C11.866 14.866 15 11.732 15 7.866C15 4 11.866 1 8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M5.5 5.5C5.5 5.5 5.8 6.2 6 6.5C6.2 6.8 6.5 7.1 6.5 7.5C6.5 7.9 6.2 8.2 5.8 8.5C5.4 8.8 5 9.1 5 9.5C5 9.9 5.3 10.2 5.7 10.5C6.1 10.8 6.5 11.1 7 11.3C7.5 11.5 8 11.5 8.5 11.3C9 11.1 9.5 10.8 10 10.3C10.5 9.8 11 9.2 11.2 8.7C11.4 8.2 11.4 7.7 11.2 7.2C11 6.7 10.7 6.3 10.3 6C9.9 5.7 9.4 5.5 9 5.5C8.6 5.5 8.2 5.7 7.8 6C7.4 6.3 7 6.6 6.6 6.8C6.2 7 5.8 7.1 5.5 6.8C5.2 6.5 5.3 6.1 5.5 5.5Z" stroke="currentColor" strokeWidth="1.2" fill="currentColor"/>
                          </svg>
                          Share
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="admins-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="admins-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admins-modal-header">
              <div className="admins-modal-header-content">
                <h3 className="admins-modal-title">Add New Admin</h3>
                <p className="admins-modal-subtitle">Create a new tournament administrator</p>
              </div>
              <button
                className="admins-modal-close"
                onClick={() => setShowAddModal(false)}
                aria-label="Close modal"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="admins-modal-body">
              <div className="admins-form-group">
                <label className="admins-form-label">
                  <span>Name</span>
                  <span className="admins-form-required">*</span>
                </label>
                <input
                  type="text"
                  className="admins-form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter admin name"
                />
              </div>
              <div className="admins-form-group">
                <label className="admins-form-label">
                  <span>Email</span>
                  <span className="admins-form-required">*</span>
                </label>
                <input
                  type="email"
                  className="admins-form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@example.com"
                />
              </div>
              <div className="admins-form-group">
                <label className="admins-form-label">Mobile</label>
                <input
                  type="tel"
                  className="admins-form-input"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>
            </div>
            <div className="admins-modal-footer">
              <button
                className="admins-modal-btn-cancel"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                className="admins-modal-btn-primary"
                onClick={() => handleAddAdmin(formData)}
                disabled={!formData.name || !formData.email}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Create Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {showEditModal && selectedAdmin && (
        <div className="admins-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="admins-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admins-modal-header">
              <div className="admins-modal-header-content">
                <h3 className="admins-modal-title">Edit Admin</h3>
                <p className="admins-modal-subtitle">Update administrator information</p>
              </div>
              <button
                className="admins-modal-close"
                onClick={() => setShowEditModal(false)}
                aria-label="Close modal"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="admins-modal-body">
              <div className="admins-form-group">
                <label className="admins-form-label">
                  <span>Name</span>
                  <span className="admins-form-required">*</span>
                </label>
                <input
                  type="text"
                  className="admins-form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter admin name"
                />
              </div>
              <div className="admins-form-group">
                <label className="admins-form-label">
                  <span>Email</span>
                  <span className="admins-form-required">*</span>
                </label>
                <input
                  type="email"
                  className="admins-form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@example.com"
                />
              </div>
              <div className="admins-form-group">
                <label className="admins-form-label">Mobile</label>
                <input
                  type="tel"
                  className="admins-form-input"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>
              <div className="admins-form-group">
                <label className="admins-form-label">Status</label>
                <select
                  className="admins-form-input"
                  value={selectedAdmin.status || 'Active'}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setSelectedAdmin({ ...selectedAdmin, status: newStatus });
                    setFormData({ ...formData, status: newStatus });
                  }}
                >
                  <option value="Active">Active</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>
            </div>
            <div className="admins-modal-footer">
              <button
                className="admins-modal-btn-cancel"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button
                className="admins-modal-btn-primary"
                onClick={handleUpdateAdmin}
                disabled={!formData.name || !formData.email}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M16.5 5.5L7.5 14.5L3.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Update Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Manager Modal */}
      {showAddManagerModal && (
        <div className="admins-modal-overlay" onClick={() => setShowAddManagerModal(false)}>
          <div className="admins-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admins-modal-header">
              <div className="admins-modal-header-content">
                <h3 className="admins-modal-title">Add New Manager</h3>
                <p className="admins-modal-subtitle">Create a new tournament manager</p>
              </div>
              <button
                className="admins-modal-close"
                onClick={() => setShowAddManagerModal(false)}
                aria-label="Close modal"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="admins-modal-body">
              <div className="admins-form-group">
                <label className="admins-form-label">
                  <span>Name</span>
                  <span className="admins-form-required">*</span>
                </label>
                <input
                  type="text"
                  className="admins-form-input"
                  value={managerFormData.name}
                  onChange={(e) => setManagerFormData({ ...managerFormData, name: e.target.value })}
                  placeholder="Enter manager name"
                />
              </div>
              <div className="admins-form-group">
                <label className="admins-form-label">
                  <span>Email</span>
                  <span className="admins-form-required">*</span>
                </label>
                <input
                  type="email"
                  className="admins-form-input"
                  value={managerFormData.email}
                  onChange={(e) => setManagerFormData({ ...managerFormData, email: e.target.value })}
                  placeholder="manager@example.com"
                />
              </div>
              <div className="admins-form-group">
                <label className="admins-form-label">Mobile</label>
                <input
                  type="tel"
                  className="admins-form-input"
                  value={managerFormData.mobile}
                  onChange={(e) => setManagerFormData({ ...managerFormData, mobile: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>
            </div>
            <div className="admins-modal-footer">
              <button
                className="admins-modal-btn-cancel"
                onClick={() => setShowAddManagerModal(false)}
              >
                Cancel
              </button>
              <button
                className="admins-modal-btn-primary"
                onClick={() => handleAddManager(managerFormData)}
                disabled={!managerFormData.name || !managerFormData.email}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Create Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Controller Modal */}
      {showAddControllerModal && (
        <div className="admins-modal-overlay" onClick={() => setShowAddControllerModal(false)}>
          <div className="admins-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admins-modal-header">
              <div className="admins-modal-header-content">
                <h3 className="admins-modal-title">Add New Controller</h3>
                <p className="admins-modal-subtitle">Create a new auction controller</p>
              </div>
              <button
                className="admins-modal-close"
                onClick={() => setShowAddControllerModal(false)}
                aria-label="Close modal"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="admins-modal-body">
              <div className="admins-form-group">
                <label className="admins-form-label">
                  <span>Name</span>
                  <span className="admins-form-required">*</span>
                </label>
                <input
                  type="text"
                  className="admins-form-input"
                  value={controllerFormData.name}
                  onChange={(e) => setControllerFormData({ ...controllerFormData, name: e.target.value })}
                  placeholder="Enter controller name"
                />
              </div>
              <div className="admins-form-group">
                <label className="admins-form-label">
                  <span>Email</span>
                  <span className="admins-form-required">*</span>
                </label>
                <input
                  type="email"
                  className="admins-form-input"
                  value={controllerFormData.email}
                  onChange={(e) => setControllerFormData({ ...controllerFormData, email: e.target.value })}
                  placeholder="controller@example.com"
                />
              </div>
              <div className="admins-form-group">
                <label className="admins-form-label">Mobile</label>
                <input
                  type="tel"
                  className="admins-form-input"
                  value={controllerFormData.mobile}
                  onChange={(e) => setControllerFormData({ ...controllerFormData, mobile: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>
            </div>
            <div className="admins-modal-footer">
              <button
                className="admins-modal-btn-cancel"
                onClick={() => setShowAddControllerModal(false)}
              >
                Cancel
              </button>
              <button
                className="admins-modal-btn-primary"
                onClick={() => handleAddController(controllerFormData)}
                disabled={!controllerFormData.name || !controllerFormData.email}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Create Controller
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer App Info */}
      <footer style={{
        marginTop: '48px',
        padding: '24px',
        textAlign: 'center',
        borderTop: '1px solid rgba(0, 0, 0, 0.1)',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
      }}>
        <img 
          src="/logo192.png" 
          alt="PlayLive" 
          style={{ width: '32px', height: '32px', objectFit: 'contain' }}
        />
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
          💙 Powered by <strong>PlayLive</strong> — Tournament Made Simple
        </p>
      </footer>
    </div>
  );
}

export default TournamentAdmins;

