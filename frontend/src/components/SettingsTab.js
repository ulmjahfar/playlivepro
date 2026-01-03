import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import ImageUploadCrop from './ImageUploadCrop';
import { API_BASE_URL } from '../utils/apiConfig';
import '../styles-settings.css';

// Tier-related constants
const TIER_ORDER = ['Standard', 'AuctionPro'];

const DEFAULT_FEATURE_DEFINITIONS = [
  {
    id: 'tournament_core',
    name: 'Tournament Creation',
    defaultTier: 'Standard',
    category: 'TournamentManagement',
    description: 'Create and manage tournaments, schedules, and structures.',
    icon: '🏆'
  },
  {
    id: 'basic_dashboard',
    name: 'Basic Dashboard',
    defaultTier: 'Standard',
    category: 'TournamentManagement',
    description: 'Overview dashboard with essential metrics.',
    icon: '📊'
  },
  {
    id: 'registration_player',
    name: 'Player Registration',
    defaultTier: 'Standard',
    category: 'Registration',
    description: 'Digitised player registration workflow.',
    icon: '🧍'
  },
  {
    id: 'registration_team',
    name: 'Team Registration',
    defaultTier: 'Standard',
    category: 'Registration',
    description: 'Team onboarding and roster capture.',
    icon: '👥'
  },
  {
    id: 'file_uploads',
    name: 'File Uploads',
    defaultTier: 'Standard',
    category: 'Registration',
    description: 'Collect photos, receipts, and documents.',
    icon: '📂'
  },
  {
    id: 'player_list_export',
    name: 'Player List Export',
    defaultTier: 'Standard',
    category: 'Reports',
    description: 'Download player master data.',
    icon: '📋'
  },
  {
    id: 'notifications_email',
    name: 'Email Alerts',
    defaultTier: 'Standard',
    category: 'Notifications',
    description: 'System emails for admins and players.',
    icon: '📧'
  },
  {
    id: 'system_notifications',
    name: 'System Notifications',
    defaultTier: 'Standard',
    category: 'Notifications',
    description: 'In-app notifications and alerts.',
    icon: '🔔'
  },
  {
    id: 'guest_players',
    name: 'Guest Players',
    defaultTier: 'Standard',
    category: 'Registration',
    description: 'Allow guest or replacement players.',
    icon: '🎟️'
  },
  {
    id: 'auction_live',
    name: 'Live Auction',
    defaultTier: 'Standard',
    category: 'Auction',
    description: 'Socket powered live auction room.',
    icon: '🔥'
  },
  {
    id: 'finance_tracker',
    name: 'Finance Tracker',
    defaultTier: 'Standard',
    category: 'Finance',
    description: 'Fund allocation and spend tracking.',
    icon: '📊'
  },
  {
    id: 'broadcast_mode',
    name: 'Broadcast Mode',
    defaultTier: 'Standard',
    category: 'Broadcast',
    description: 'TV-style broadcast overlays and scenes.',
    icon: '🎥'
  },
  {
    id: 'notifications_whatsapp',
    name: 'WhatsApp Alerts',
    defaultTier: 'Standard',
    category: 'Notifications',
    description: 'Automated WhatsApp alerts for teams.',
    icon: '💬'
  },
  {
    id: 'auction_pro_remote_bidding',
    name: 'Auction Pro Remote Bidding',
    defaultTier: 'AuctionPro',
    category: 'Auction',
    description: 'Secure remote bidding console with seat-level access.',
    icon: '🛰️'
  },
  {
    id: 'auction_pro_multi_seat',
    name: 'Multi-seat Team Console',
    defaultTier: 'AuctionPro',
    category: 'Auction',
    description: 'Coordinate captains, analysts, and finance seats with voting policies.',
    icon: '👥'
  },
  {
    id: 'auction_pro_insights',
    name: 'Auction Pro Insights',
    defaultTier: 'AuctionPro',
    category: 'Analytics',
    description: 'Consensus telemetry, seat health, and bidding diagnostics.',
    icon: '📡'
  }
];

const DEFAULT_TIER_CONFIGS = [
  {
    tier: 'Standard',
    features: ['tournament_core', 'basic_dashboard', 'registration_player', 'registration_team', 'file_uploads', 'player_list_export', 'notifications_email', 'system_notifications', 'guest_players', 'auction_live', 'finance_tracker', 'broadcast_mode', 'notifications_whatsapp'],
    metadata: {
      displayName: 'Standard',
      description: 'Premium broadcast, automation, and analytics package.'
    }
  },
  {
    tier: 'AuctionPro',
    features: [
      'tournament_core',
      'basic_dashboard',
      'registration_player',
      'registration_team',
      'file_uploads',
      'player_list_export',
      'notifications_email',
      'system_notifications',
      'guest_players',
      'auction_live',
      'finance_tracker',
      'broadcast_mode',
      'notifications_whatsapp',
      'auction_pro_remote_bidding',
      'auction_pro_multi_seat',
      'auction_pro_insights'
    ],
    metadata: {
      displayName: 'Auction Pro',
      description: 'Remote multi-seat bidding with consensus controls, telemetry, and pro tooling.'
    }
  }
];

// Removed unused CATEGORY_LABELS constant

const FEATURE_ICON_MAP = DEFAULT_FEATURE_DEFINITIONS.reduce((acc, feature) => {
  acc[feature.id] = feature.icon || '⚙️';
  return acc;
}, {});

const SettingsTab = ({ stats, tournaments }) => {
  const [activeSubTab, setActiveSubTab] = useState('profile');
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [profileForm, setProfileForm] = useState({
    name: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).username : '',
    email: localStorage.getItem('user') ? (JSON.parse(localStorage.getItem('user')).email || '') : '',
    mobile: '+91 9744251422',
    profilePicture: null
  });
  
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetStep, setResetStep] = useState(1);
  const [resetProgress, setResetProgress] = useState(0);
  const [resetStatus, setResetStatus] = useState('');
  
  const [autoDeleteSettings, setAutoDeleteSettings] = useState({
    autoDeleteEnabled: false,
    autoDeleteDays: 45
  });
  const [autoDeleteLoading, setAutoDeleteLoading] = useState(false);
  const [autoDeleteMessage, setAutoDeleteMessage] = useState('');
  
  // App Logo state
  const [appLogo, setAppLogo] = useState(null);
  const [appLogoLoading, setAppLogoLoading] = useState(false);
  const [appLogoMessage, setAppLogoMessage] = useState('');
  const [appLogoFile, setAppLogoFile] = useState(null);

  // Tier state
  const [featureDefinitions, setFeatureDefinitions] = useState(DEFAULT_FEATURE_DEFINITIONS);
  const [tierConfigs, setTierConfigs] = useState(DEFAULT_TIER_CONFIGS);
  const [tierError, setTierError] = useState('');
  const [activeTierEditor, setActiveTierEditor] = useState(TIER_ORDER[0]);
  const [tierDrafts, setTierDrafts] = useState({});
  const [featureSearch, setFeatureSearch] = useState('');
  const [tierSaveState, setTierSaveState] = useState({ type: '', message: '' });
  const [tierSaving, setTierSaving] = useState(false);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
      return {};
    }
  }, []);
  
  const isSuperAdmin = user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN';

  // Load auto-delete settings and app logo
  useEffect(() => {
    if (isSuperAdmin) {
      const loadAutoDeleteSettings = async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get(`${API_BASE_URL}/api/auto-delete/settings`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data.success) {
            setAutoDeleteSettings(res.data.settings);
          }
        } catch (err) {
          console.error('Error loading auto-delete settings:', err);
        }
      };
      
      const loadAppLogo = async () => {
        try {
          const res = await axios.get(`${API_BASE_URL}/api/auto-delete/app-logo`);
          if (res.data.success && res.data.logoUrl) {
            setAppLogo(res.data.logoUrl);
          }
        } catch (err) {
          console.error('Error loading app logo:', err);
        }
      };
      
      loadAutoDeleteSettings();
      loadAppLogo();
    }
  }, [isSuperAdmin]);

  // Load tier data
  useEffect(() => {
    let ignore = false;
    const loadTierData = async () => {
      if (!isSuperAdmin) {
        setTierConfigs(DEFAULT_TIER_CONFIGS);
        setFeatureDefinitions(DEFAULT_FEATURE_DEFINITIONS);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
      setTierConfigs(DEFAULT_TIER_CONFIGS);
      setFeatureDefinitions(DEFAULT_FEATURE_DEFINITIONS);
      return;
    }

    try {
        const headers = { Authorization: `Bearer ${token}` };
        const [definitionsRes, tiersRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/features/definitions`, { headers }),
          axios.get(`${API_BASE_URL}/api/features/tier-configs`, { headers })
        ]);
        if (ignore) return;

        const definitions = definitionsRes.data?.features || [];
        const tiers = tiersRes.data?.tiers || [];

        setFeatureDefinitions(definitions.length ? definitions : DEFAULT_FEATURE_DEFINITIONS);
        setTierConfigs(tiers.length ? tiers : DEFAULT_TIER_CONFIGS);
        setTierError('');
      } catch (error) {
        if (ignore) return;
        console.error('Failed to load tier configuration', error);
        setTierError('Unable to load tier configuration from server. Showing default tier matrix.');
        setFeatureDefinitions(DEFAULT_FEATURE_DEFINITIONS);
        setTierConfigs(DEFAULT_TIER_CONFIGS);
      } finally {
        // Cleanup handled by ignore flag
      }
    };

    loadTierData();
    return () => { ignore = true; };
  }, [isSuperAdmin]);

  const normalizePlan = useCallback((plan) => {
    if (!plan) return 'Standard';
    const compact = plan.toString().replace(/\s+/g, '').toLowerCase();
    if (compact === 'standard') return 'Standard';
    if (compact === 'auctionpro') return 'AuctionPro';
    return plan;
  }, []);

  const formatPlan = useCallback(
    (plan) => {
      const key = normalizePlan(plan);
      const tierConfig = tierConfigs.find((tier) => tier.tier === key);
      if (tierConfig?.metadata?.displayName) {
        return tierConfig.metadata.displayName;
      }
      return key || 'Standard';
    },
    [normalizePlan, tierConfigs]
  );

  const featureById = useMemo(() => {
    const map = {};
    (featureDefinitions || []).forEach((feature) => {
      if (feature?.id) {
        map[feature.id] = feature;
      }
    });
    return map;
  }, [featureDefinitions]);

  const tierSummaryData = useMemo(() => {
    // Filter out Lite and LitePlus tiers
    const filteredTiers = (tierConfigs || []).filter(
      (tier) => tier.tier !== 'Lite' && tier.tier !== 'LitePlus'
    );
    
    const data = filteredTiers.map((tier) => {
      const label = formatPlan(tier.tier);
      const features = tier.features || [];
      const highlight = features.slice(0, 4).map((featureId) => ({
        id: featureId,
        name: featureById[featureId]?.name || featureId,
        icon: FEATURE_ICON_MAP[featureId] || '✅'
      }));
      return {
        tier: tier.tier,
        label,
        description: tier.metadata?.description || '',
        featureCount: features.length,
        highlight
      };
    });

    return data.sort((a, b) => {
      const indexA = TIER_ORDER.indexOf(a.tier);
      const indexB = TIER_ORDER.indexOf(b.tier);
      if (indexA === -1 && indexB === -1) {
        return a.label.localeCompare(b.label);
      }
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [tierConfigs, featureById, formatPlan]);

  const sortedTierConfigs = useMemo(() => {
    // Filter out Lite and LitePlus tiers
    const tiers = [...(tierConfigs || [])].filter(
      (tier) => tier.tier !== 'Lite' && tier.tier !== 'LitePlus'
    );
    return tiers.sort((a, b) => {
      const indexA = TIER_ORDER.indexOf(a.tier);
      const indexB = TIER_ORDER.indexOf(b.tier);
      if (indexA === -1 && indexB === -1) {
        return a.tier.localeCompare(b.tier);
      }
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [tierConfigs]);

  useEffect(() => {
    const drafts = {};
    (tierConfigs || []).forEach((tier) => {
      drafts[tier.tier] = [...(tier.features || [])];
    });
    setTierDrafts(drafts);
    setActiveTierEditor((prev) => {
      if (tierConfigs.some((tier) => tier.tier === prev)) {
        return prev;
      }
      return tierConfigs[0]?.tier || 'Standard';
    });
  }, [tierConfigs]);

  const activeTierFeatures = useMemo(() => {
    return tierDrafts[activeTierEditor] || [];
  }, [tierDrafts, activeTierEditor]);
  
  const persistedTierFeatures = useMemo(() => {
    return tierConfigs.find((tier) => tier.tier === activeTierEditor)?.features || [];
  }, [tierConfigs, activeTierEditor]);

  const hasTierChanges = useMemo(() => {
    if (!persistedTierFeatures.length && !activeTierFeatures.length) {
      return false;
    }
    return persistedTierFeatures.join('|') !== activeTierFeatures.join('|');
  }, [persistedTierFeatures, activeTierFeatures]);

  const handleTierEditorTabChange = (tierKey) => {
    setActiveTierEditor(tierKey);
    setFeatureSearch('');
    setTierSaveState({ type: '', message: '' });
  };

  const availableFeatures = useMemo(() => {
    const searchValue = featureSearch.trim().toLowerCase();
    return (featureDefinitions || [])
      .filter((feature) => {
        if (!feature?.id) return false;
        if ((tierDrafts[activeTierEditor] || []).includes(feature.id)) return false;
        if (!searchValue) return true;
        const haystack = `${feature.name} ${feature.category || ''} ${feature.description || ''}`.toLowerCase();
        return haystack.includes(searchValue);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [featureDefinitions, tierDrafts, activeTierEditor, featureSearch]);

  const selectedFeatureDetails = useMemo(() => {
    return (tierDrafts[activeTierEditor] || []).map((featureId) => {
      const feature = featureById[featureId];
      return {
        id: featureId,
        name: feature?.name || featureId,
        description: feature?.description || 'No description available.',
        category: feature?.category || 'Uncategorized',
        icon: feature?.icon || FEATURE_ICON_MAP[featureId] || '🧩'
      };
    });
  }, [tierDrafts, activeTierEditor, featureById]);

  const activeTierMetadata = useMemo(() => {
    return (
      tierConfigs.find((tier) => tier.tier === activeTierEditor)?.metadata ||
      DEFAULT_TIER_CONFIGS.find((tier) => tier.tier === activeTierEditor)?.metadata ||
      {}
    );
  }, [tierConfigs, activeTierEditor]);

  const activeTierLabel = useMemo(() => formatPlan(activeTierEditor), [formatPlan, activeTierEditor]);

  const handleTierFeatureAdd = (featureId) => {
    setTierDrafts((prev) => {
      const current = prev[activeTierEditor] || [];
      if (current.includes(featureId)) return prev;
      return { ...prev, [activeTierEditor]: [...current, featureId] };
    });
  };

  const handleTierFeatureRemove = (featureId) => {
    setTierDrafts((prev) => {
      const current = prev[activeTierEditor] || [];
      return { ...prev, [activeTierEditor]: current.filter((id) => id !== featureId) };
    });
  };

  const handleResetTierDraft = () => {
    const original = tierConfigs.find((tier) => tier.tier === activeTierEditor);
    setTierDrafts((prev) => ({
      ...prev,
      [activeTierEditor]: [...(original?.features || [])]
    }));
    setFeatureSearch('');
    setTierSaveState({ type: '', message: '' });
  };

  const handleSaveTierFeatures = async () => {
    if (!isSuperAdmin) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setTierSaveState({ type: 'error', message: 'Missing authentication token.' });
      return;
    }

    setTierSaving(true);
    setTierSaveState({ type: '', message: '' });
    try {
      const tierKey = activeTierEditor;
      const metadata =
        tierConfigs.find((tier) => tier.tier === tierKey)?.metadata ||
        DEFAULT_TIER_CONFIGS.find((tier) => tier.tier === tierKey)?.metadata ||
        {};

      const payload = {
        features: tierDrafts[tierKey] || [],
        metadata
      };

      const res = await axios.put(
        `${API_BASE_URL}/api/features/tier-configs/${tierKey}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.data?.success || !res.data?.tierConfig) {
        throw new Error(res.data?.message || 'Failed to update tier configuration.');
      }

      const updatedTier = res.data.tierConfig;
      setTierConfigs((prev) => {
        const exists = prev.some((tier) => tier.tier === updatedTier.tier);
        if (exists) {
          return prev.map((tier) => (tier.tier === updatedTier.tier ? updatedTier : tier));
        }
        return [...prev, updatedTier];
      });
      setTierDrafts((prev) => ({
        ...prev,
        [updatedTier.tier]: [...(updatedTier.features || [])]
      }));
      setTierSaveState({ type: 'success', message: `${updatedTier.tier} tier updated successfully.` });
    } catch (error) {
      setTierSaveState({
        type: 'error',
        message: error.response?.data?.message || error.message || 'Unable to save tier.'
      });
    } finally {
      setTierSaving(false);
      setTimeout(() => {
        setTierSaveState((prev) => ({ ...prev, message: '' }));
      }, 5000);
    }
  };

  // Profile handlers
  const handleEditProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/auth/update-profile`, {
        email: profileForm.email,
        mobile: profileForm.mobile
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      // Update local storage
      const updatedUser = { ...user, email: profileForm.email };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      alert('✅ Profile updated successfully');
      setShowEditProfileModal(false);
    } catch (err) {
      alert('❌ Error updating profile: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      alert('❌ Passwords do not match');
      return;
    }
    if (passwordForm.new.length < 6) {
      alert('❌ Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/auth/change-password`, {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.new
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('✅ Password changed successfully');
      setShowChangePasswordModal(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (err) {
      alert('❌ Error: ' + (err.response?.data?.message || 'Failed to change password'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetSystem = async () => {
    if (resetConfirmText !== 'RESET ALL USERS') {
      alert('Confirmation text does not match. Please type "RESET ALL USERS" exactly.');
      return;
    }

    setResetStep(2);
    setResetProgress(0);
    setResetStatus('Starting system reset...');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/auth/full-reset`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        const progressSteps = [
          { progress: 10, status: 'Deleting tournaments...' },
          { progress: 30, status: 'Deleting players...' },
          { progress: 50, status: 'Deleting teams...' },
          { progress: 70, status: 'Deleting users...' },
          { progress: 90, status: 'Clearing uploaded files...' },
          { progress: 100, status: 'Reset complete!' }
        ];

        for (const step of progressSteps) {
          await new Promise(resolve => setTimeout(resolve, 500));
          setResetProgress(step.progress);
          setResetStatus(step.status);
        }

        setResetStep(3);
      } else {
        alert('❌ Error: ' + (response.data.message || 'System reset failed'));
        setShowResetModal(false);
        setResetStep(1);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error resetting system';
      alert('❌ Error: ' + errorMessage);
      setShowResetModal(false);
      setResetStep(1);
    }
  };

  const handleAutoDeleteSettingsChange = async () => {
    setAutoDeleteLoading(true);
    setAutoDeleteMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(
        `${API_BASE_URL}/api/auto-delete/settings`,
        autoDeleteSettings,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setAutoDeleteMessage('✅ Auto-delete settings saved successfully');
        setAutoDeleteSettings(res.data.settings);
      }
    } catch (err) {
      setAutoDeleteMessage('❌ Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setAutoDeleteLoading(false);
      setTimeout(() => setAutoDeleteMessage(''), 5000);
    }
  };

  const handleAppLogoUpload = async () => {
    if (!appLogoFile) {
      setAppLogoMessage('❌ Please select a logo file');
      setTimeout(() => setAppLogoMessage(''), 3000);
      return;
    }

    setAppLogoLoading(true);
    setAppLogoMessage('');
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('logo', appLogoFile);

      const res = await axios.put(
        `${API_BASE_URL}/api/auto-delete/app-logo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (res.data.success) {
        setAppLogo(res.data.logoUrl);
        setAppLogoFile(null);
        setAppLogoMessage('✅ App logo updated successfully');
        // Refresh the page to update logo throughout the app
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err) {
      setAppLogoMessage('❌ Error: ' + (err.response?.data?.message || err.message || 'Failed to upload logo'));
    } finally {
      setAppLogoLoading(false);
      setTimeout(() => setAppLogoMessage(''), 5000);
    }
  };

  const handleAppLogoDelete = async () => {
    if (!window.confirm('Are you sure you want to delete the app logo?')) {
      return;
    }

    setAppLogoLoading(true);
    setAppLogoMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.delete(
        `${API_BASE_URL}/api/auto-delete/app-logo`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setAppLogo(null);
        setAppLogoFile(null);
        setAppLogoMessage('✅ App logo deleted successfully');
        // Refresh the page to update logo throughout the app
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err) {
      setAppLogoMessage('❌ Error: ' + (err.response?.data?.message || err.message || 'Failed to delete logo'));
    } finally {
      setAppLogoLoading(false);
      setTimeout(() => setAppLogoMessage(''), 5000);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  // Helper function to format bytes
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper function for relative time
  const getRelativeTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Maintenance mode handler
  const handleMaintenanceToggle = async () => {
    setMaintenanceLoading(true);
    setMaintenanceMessage('');
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      setMaintenanceMode(prev => ({ ...prev, enabled: !prev.enabled }));
      setMaintenanceMessage(maintenanceMode.enabled ? '✅ Maintenance mode disabled' : '✅ Maintenance mode enabled');
    } catch (err) {
      setMaintenanceMessage('❌ Failed to update maintenance mode');
    } finally {
      setMaintenanceLoading(false);
      setTimeout(() => setMaintenanceMessage(''), 3000);
    }
  };

  // Revoke session handler
  const handleRevokeSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to revoke this session?')) return;
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      alert('Failed to revoke session');
    }
  };

  // SMTP config handler
  const handleSaveSmtpConfig = async () => {
    setSmtpLoading(true);
    setSmtpMessage('');
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSmtpMessage('✅ SMTP configuration saved successfully');
    } catch (err) {
      setSmtpMessage('❌ Failed to save SMTP configuration');
    } finally {
      setSmtpLoading(false);
      setTimeout(() => setSmtpMessage(''), 5000);
    }
  };

  // SMTP test handler
  const handleTestSmtp = async () => {
    setSmtpTestLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('✅ Test email sent successfully!');
    } catch (err) {
      alert('❌ Failed to send test email');
    } finally {
      setSmtpTestLoading(false);
    }
  };

  // Notification preferences handler
  const handleSaveNotificationPrefs = async () => {
    setNotifLoading(true);
    setNotifMessage('');
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      setNotifMessage('✅ Notification preferences saved');
    } catch (err) {
      setNotifMessage('❌ Failed to save preferences');
    } finally {
      setNotifLoading(false);
      setTimeout(() => setNotifMessage(''), 3000);
    }
  };

  // Create backup handler
  const handleCreateBackup = async () => {
    setBackupLoading(true);
    setBackupMessage('');
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const newBackup = {
        id: Date.now(),
        name: `backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_manual.zip`,
        size: Math.floor(Math.random() * 50 + 130) * 1024 * 1024,
        date: new Date(),
        type: 'manual'
      };
      setBackupList(prev => [newBackup, ...prev]);
      setBackupMessage('✅ Backup created successfully');
    } catch (err) {
      setBackupMessage('❌ Failed to create backup');
    } finally {
      setBackupLoading(false);
      setTimeout(() => setBackupMessage(''), 5000);
    }
  };

  // Delete backup handler
  const handleDeleteBackup = async (backupId) => {
    if (!window.confirm('Are you sure you want to delete this backup?')) return;
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setBackupList(prev => prev.filter(b => b.id !== backupId));
    } catch (err) {
      alert('Failed to delete backup');
    }
  };

  // Save scheduled backup settings
  const handleSaveScheduledBackup = async () => {
    setBackupLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      setBackupMessage('✅ Scheduled backup settings saved');
    } catch (err) {
      setBackupMessage('❌ Failed to save settings');
    } finally {
      setBackupLoading(false);
      setTimeout(() => setBackupMessage(''), 3000);
    }
  };

  const totalTeams = tournaments?.reduce((acc, t) => acc + (t.teams?.length || 0), 0) || 0;
  const totalPlayers = tournaments?.reduce((acc, t) => acc + (t.players?.length || 0), 0) || 0;

  // New state for additional features
  const [maintenanceMode, setMaintenanceMode] = useState({
    enabled: false,
    message: 'System is currently under maintenance. Please check back later.'
  });
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  const [storageData] = useState({
    total: 10 * 1024 * 1024 * 1024, // 10GB
    used: 4.5 * 1024 * 1024 * 1024,
    uploads: 2.1 * 1024 * 1024 * 1024,
    database: 1.8 * 1024 * 1024 * 1024,
    backups: 0.6 * 1024 * 1024 * 1024
  });

  const [loginActivity] = useState([
    { id: 1, device: 'Chrome on Windows', ip: '192.168.1.105', location: 'Mumbai, IN', time: new Date(Date.now() - 1000 * 60 * 5), status: 'success' },
    { id: 2, device: 'Safari on iPhone', ip: '192.168.1.108', location: 'Mumbai, IN', time: new Date(Date.now() - 1000 * 60 * 60 * 2), status: 'success' },
    { id: 3, device: 'Firefox on MacOS', ip: '103.45.67.89', location: 'Delhi, IN', time: new Date(Date.now() - 1000 * 60 * 60 * 24), status: 'failed' },
    { id: 4, device: 'Chrome on Android', ip: '192.168.1.110', location: 'Mumbai, IN', time: new Date(Date.now() - 1000 * 60 * 60 * 48), status: 'success' }
  ]);

  const [activeSessions, setActiveSessions] = useState([
    { id: 1, device: 'Chrome on Windows', ip: '192.168.1.105', location: 'Mumbai, IN', lastActive: new Date(), current: true },
    { id: 2, device: 'Safari on iPhone', ip: '192.168.1.108', location: 'Mumbai, IN', lastActive: new Date(Date.now() - 1000 * 60 * 30), current: false }
  ]);

  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'PlayLive'
  });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpMessage, setSmtpMessage] = useState('');
  const [smtpTestLoading, setSmtpTestLoading] = useState(false);

  const [notificationPrefs, setNotificationPrefs] = useState({
    tournamentCreated: { email: true, inApp: true },
    playerRegistered: { email: false, inApp: true },
    teamRegistered: { email: false, inApp: true },
    auctionStarted: { email: true, inApp: true },
    auctionEnded: { email: true, inApp: true },
    systemAlerts: { email: true, inApp: true }
  });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');

  const [backupList, setBackupList] = useState([
    { id: 1, name: 'backup_2025_01_15_auto.zip', size: 156 * 1024 * 1024, date: new Date(2025, 0, 15), type: 'auto' },
    { id: 2, name: 'backup_2025_01_10_manual.zip', size: 142 * 1024 * 1024, date: new Date(2025, 0, 10), type: 'manual' },
    { id: 3, name: 'backup_2025_01_05_auto.zip', size: 138 * 1024 * 1024, date: new Date(2025, 0, 5), type: 'auto' }
  ]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [scheduledBackup, setScheduledBackup] = useState({
    enabled: true,
    frequency: 'weekly',
    time: '02:00',
    retention: 5
  });

  const [themeSettings, setThemeSettings] = useState({
    primaryColor: '#14b8a6',
    accentColor: '#06b6d4',
    darkMode: true
  });

  const subTabs = [
    { id: 'profile', label: 'Profile & Security', icon: '🔐' },
    { id: 'system', label: 'System Controls', icon: '⚙️' },
    { id: 'branding', label: 'Branding', icon: '🎨' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'backup', label: 'Backup & Data', icon: '💾' },
    { id: 'tier-management', label: 'Tier Management', icon: '🎚️' }
  ];

  return (
    <>
      <div className="modern-settings-container">
        {/* Modern Tab Navigation */}
        <div className="modern-settings-nav">
          {subTabs.map(tab => (
            <button
              key={tab.id}
              className={`modern-nav-item ${activeSubTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveSubTab(tab.id)}
            >
              <span className="modern-nav-icon">{tab.icon}</span>
              <span className="modern-nav-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Profile & Security Tab */}
        {activeSubTab === 'profile' && (
          <div className="modern-settings-content">
            {/* Quick Stats */}
            <div className="modern-stats-grid">
              <div className="modern-stat-card">
                <div className="stat-icon-wrapper">
                  <span className="stat-icon-large">🏆</span>
                </div>
                <div className="stat-info">
                  <div className="stat-value-large">{stats?.total || 0}</div>
                  <div className="stat-label-small">Tournaments</div>
                </div>
              </div>
              <div className="modern-stat-card">
                <div className="stat-icon-wrapper">
                  <span className="stat-icon-large">👥</span>
                </div>
                <div className="stat-info">
                  <div className="stat-value-large">{totalTeams}</div>
                  <div className="stat-label-small">Teams</div>
                </div>
              </div>
              <div className="modern-stat-card">
                <div className="stat-icon-wrapper">
                  <span className="stat-icon-large">👤</span>
                </div>
                <div className="stat-info">
                  <div className="stat-value-large">{totalPlayers}</div>
                  <div className="stat-label-small">Players</div>
                </div>
              </div>
            </div>

            {/* Profile Card */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Profile Information</h3>
                <button 
                  className="modern-btn-icon"
                  onClick={() => setShowEditProfileModal(true)}
                  title="Edit Profile"
                >
                  ✏️
                </button>
              </div>
              <div className="modern-card-body">
                <div className="profile-display-grid">
                  <div className="profile-avatar-section">
                    <div className="modern-avatar">
                      {profileForm.profilePicture ? (
                        <img src={URL.createObjectURL(profileForm.profilePicture)} alt="Profile" />
                      ) : (
                        <div className="avatar-placeholder">{profileForm.name?.charAt(0)?.toUpperCase() || 'A'}</div>
                      )}
                    </div>
                    <p className="profile-name">{profileForm.name || 'Super Admin'}</p>
                    <p className="profile-role">Super Administrator</p>
                  </div>
                  <div className="profile-details-section">
                    <div className="detail-row">
                      <span className="detail-label">Email</span>
                      <span className="detail-value">{profileForm.email || 'Not set'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Mobile</span>
                      <span className="detail-value">{profileForm.mobile || 'Not set'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Role</span>
                      <span className="detail-value">Super Admin</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Account Status</span>
                      <span className="detail-value status-active">Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Card */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Security Settings</h3>
              </div>
              <div className="modern-card-body">
                <div className="security-actions">
                  <button 
                    className="modern-btn-secondary"
                    onClick={() => setShowChangePasswordModal(true)}
                  >
                    <span>🔑</span>
                    <span>Change Password</span>
                  </button>
                  <button 
                    className="modern-btn-secondary"
                    onClick={handleLogout}
                  >
                    <span>🚪</span>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Login Activity Card */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Login Activity</h3>
                <span className="modern-badge">Recent</span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Monitor recent login attempts to your account. Suspicious activity will be highlighted.
                </p>
                <div className="activity-timeline">
                  {loginActivity.map((activity) => (
                    <div key={activity.id} className={`activity-item ${activity.status}`}>
                      <div className="activity-icon">
                        {activity.status === 'success' ? '✓' : '✕'}
                      </div>
                      <div className="activity-details">
                        <div className="activity-header">
                          <span className="activity-device">{activity.device}</span>
                          <span className={`activity-status-badge ${activity.status}`}>
                            {activity.status === 'success' ? 'Successful' : 'Failed'}
                          </span>
                        </div>
                        <div className="activity-meta">
                          <span>📍 {activity.location}</span>
                          <span>🌐 {activity.ip}</span>
                          <span>🕐 {getRelativeTime(activity.time)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Active Sessions Card */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Active Sessions</h3>
                <span className="modern-badge">{activeSessions.length} Active</span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Manage your active sessions across all devices. You can revoke access to any session.
                </p>
                <div className="sessions-list">
                  {activeSessions.map((session) => (
                    <div key={session.id} className={`session-card ${session.current ? 'current' : ''}`}>
                      <div className="session-icon">
                        {session.device.includes('iPhone') || session.device.includes('Android') ? '📱' : '💻'}
                      </div>
                      <div className="session-details">
                        <div className="session-header">
                          <span className="session-device">{session.device}</span>
                          {session.current && <span className="current-badge">Current Session</span>}
                        </div>
                        <div className="session-meta">
                          <span>📍 {session.location}</span>
                          <span>🌐 {session.ip}</span>
                          <span>🕐 {session.current ? 'Active now' : getRelativeTime(session.lastActive)}</span>
                        </div>
                      </div>
                      {!session.current && (
                        <button
                          className="session-revoke-btn"
                          onClick={() => handleRevokeSession(session.id)}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* System Settings Tab */}
        {activeSubTab === 'system' && (
          <div className="modern-settings-content">
            {/* Maintenance Mode Card */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Maintenance Mode</h3>
                <span className={`modern-badge ${maintenanceMode.enabled ? 'danger' : ''}`}>
                  {maintenanceMode.enabled ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Enable maintenance mode to temporarily restrict access to the system. Users will see a maintenance message instead of the normal interface.
                </p>
                <div className="setting-toggle-group">
                  <div className="toggle-wrapper">
                    <label className="modern-toggle">
                      <input
                        type="checkbox"
                        checked={maintenanceMode.enabled}
                        onChange={handleMaintenanceToggle}
                        disabled={maintenanceLoading}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <div className="toggle-label-group">
                      <span className="toggle-label">Enable Maintenance Mode</span>
                      <span className="toggle-description">When enabled, only Super Admins can access the system</span>
                    </div>
                  </div>
                </div>
                {maintenanceMode.enabled && (
                  <div className="form-group-modern">
                    <label className="modern-label">Maintenance Message</label>
                    <textarea
                      className="modern-input modern-textarea"
                      value={maintenanceMode.message}
                      onChange={(e) => setMaintenanceMode(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Enter the message users will see..."
                      rows={3}
                    />
                  </div>
                )}
                {maintenanceMessage && (
                  <div className={`message-banner ${maintenanceMessage.includes('✅') ? 'success' : 'error'}`}>
                    {maintenanceMessage}
                  </div>
                )}
              </div>
            </div>

            {/* Storage Monitor Card */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Storage Monitor</h3>
                <span className="modern-badge">
                  {Math.round((storageData.used / storageData.total) * 100)}% Used
                </span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Monitor your system's storage usage across uploads, database, and backups.
                </p>
                <div className="storage-overview">
                  <div className="storage-main-bar">
                    <div className="storage-bar-container">
                      <div 
                        className="storage-bar-fill"
                        style={{ width: `${(storageData.used / storageData.total) * 100}%` }}
                      >
                        <span className="storage-bar-text">
                          {formatBytes(storageData.used)} / {formatBytes(storageData.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="storage-breakdown">
                    <div className="storage-item">
                      <div className="storage-item-header">
                        <span className="storage-item-icon">📁</span>
                        <span className="storage-item-label">Uploads</span>
                      </div>
                      <div className="storage-item-bar">
                        <div 
                          className="storage-item-fill uploads"
                          style={{ width: `${(storageData.uploads / storageData.total) * 100}%` }}
                        ></div>
                      </div>
                      <span className="storage-item-value">{formatBytes(storageData.uploads)}</span>
                    </div>
                    <div className="storage-item">
                      <div className="storage-item-header">
                        <span className="storage-item-icon">🗄️</span>
                        <span className="storage-item-label">Database</span>
                      </div>
                      <div className="storage-item-bar">
                        <div 
                          className="storage-item-fill database"
                          style={{ width: `${(storageData.database / storageData.total) * 100}%` }}
                        ></div>
                      </div>
                      <span className="storage-item-value">{formatBytes(storageData.database)}</span>
                    </div>
                    <div className="storage-item">
                      <div className="storage-item-header">
                        <span className="storage-item-icon">💾</span>
                        <span className="storage-item-label">Backups</span>
                      </div>
                      <div className="storage-item-bar">
                        <div 
                          className="storage-item-fill backups"
                          style={{ width: `${(storageData.backups / storageData.total) * 100}%` }}
                        ></div>
                      </div>
                      <span className="storage-item-value">{formatBytes(storageData.backups)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Auto Delete Settings */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Auto-Delete System</h3>
                <span className="modern-badge">Automated</span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Automatically delete completed tournament data after a specified number of days. 
                  This helps manage storage and keeps your system clean.
                </p>
                <div className="setting-toggle-group">
                  <div className="toggle-wrapper">
                    <label className="modern-toggle">
                      <input
                        type="checkbox"
                        checked={autoDeleteSettings.autoDeleteEnabled}
                        onChange={(e) => setAutoDeleteSettings({ ...autoDeleteSettings, autoDeleteEnabled: e.target.checked })}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <div className="toggle-label-group">
                      <span className="toggle-label">Enable Auto-Delete</span>
                      <span className="toggle-description">When enabled, completed tournaments will be automatically deleted</span>
                    </div>
                  </div>
                </div>
                {autoDeleteSettings.autoDeleteEnabled && (
                  <div className="setting-options">
                    <label className="modern-label">Auto Delete After (Days)</label>
                    <div className="radio-group">
                      {[30, 45, 60, 90].map((days) => (
                        <label key={days} className="radio-option">
                          <input
                            type="radio"
                            name="autoDeleteDays"
                            value={days}
                            checked={autoDeleteSettings.autoDeleteDays === days}
                            onChange={(e) => setAutoDeleteSettings({ ...autoDeleteSettings, autoDeleteDays: parseInt(e.target.value) })}
                          />
                          <span>{days} Days {days === 45 && <span className="recommended-badge">Recommended</span>}</span>
                        </label>
                      ))}
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="autoDeleteDays"
                          value="custom"
                          checked={![30, 45, 60, 90].includes(autoDeleteSettings.autoDeleteDays)}
                          onChange={() => {}}
                        />
                        <span>Custom: </span>
                        <input
                          type="number"
                          min="7"
                          value={![30, 45, 60, 90].includes(autoDeleteSettings.autoDeleteDays) ? autoDeleteSettings.autoDeleteDays : ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val >= 7) {
                              setAutoDeleteSettings({ ...autoDeleteSettings, autoDeleteDays: val });
                            }
                          }}
                          placeholder="Days (min 7)"
                          className="custom-input"
                        />
                      </label>
                    </div>
                    <p className="setting-warning">⚠️ Minimum allowed: 7 days. All tournament data will be permanently deleted.</p>
                  </div>
                )}
                {autoDeleteMessage && (
                  <div className={`message-banner ${autoDeleteMessage.includes('✅') ? 'success' : 'error'}`}>
                    {autoDeleteMessage}
                  </div>
                )}
                <div className="card-actions">
                  <button
                    className="modern-btn-primary"
                    onClick={handleAutoDeleteSettingsChange}
                    disabled={autoDeleteLoading}
                  >
                    {autoDeleteLoading ? 'Saving...' : '💾 Save Settings'}
                  </button>
                </div>
              </div>
            </div>

            {/* System Reset */}
            <div className="modern-card danger-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">System Reset</h3>
                <span className="modern-badge danger">Danger Zone</span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Perform a complete factory reset of the entire PlayLive system. 
                  This will permanently delete all tournaments, users, teams, players, and uploaded files.
                </p>
                <div className="card-actions">
                  <button
                    className="modern-btn-danger"
                    onClick={() => setShowResetModal(true)}
                  >
                    🔥 Reset & Delete All Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Branding Tab */}
        {activeSubTab === 'branding' && (
          <div className="modern-settings-content">
            {/* App Logo Settings */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">App Logo</h3>
                <span className="modern-badge">Identity</span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Upload a custom logo that will be displayed throughout the entire application. 
                  This logo will appear in headers, sidebars, login pages, and all public-facing areas.
                </p>
                
                {/* Current Logo Preview */}
                {appLogo && (
                  <div className="logo-preview-section">
                    <label className="modern-label">Current Logo</label>
                    <div className="logo-preview">
                      <img src={appLogo} alt="App Logo" />
                    </div>
                  </div>
                )}

                {/* Logo Upload */}
                <div className="form-group-modern">
                  <label className="modern-label">Upload New Logo</label>
                  <ImageUploadCrop
                    onImageSelect={(file) => setAppLogoFile(file)}
                    aspectRatio={null}
                    maxWidth={512}
                    quality={90}
                    uploadType="app-logo"
                    placeholder="Click to upload app logo"
                    maxSizeMB={5}
                  />
                  <p className="setting-hint">
                    Recommended: Square or landscape logo, max 5MB. Supported formats: JPG, PNG, GIF, WebP, SVG
                  </p>
                </div>

                {appLogoMessage && (
                  <div className={`message-banner ${appLogoMessage.includes('✅') ? 'success' : 'error'}`}>
                    {appLogoMessage}
                  </div>
                )}

                <div className="card-actions">
                  <button
                    className="modern-btn-primary"
                    onClick={handleAppLogoUpload}
                    disabled={appLogoLoading || !appLogoFile}
                  >
                    {appLogoLoading ? 'Uploading...' : '📤 Upload Logo'}
                  </button>
                  {appLogo && (
                    <button
                      className="modern-btn-secondary"
                      onClick={handleAppLogoDelete}
                      disabled={appLogoLoading}
                    >
                      🗑️ Delete Logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Theme Customization */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Theme Customization</h3>
                <span className="modern-badge">Appearance</span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Customize the look and feel of your PlayLive instance. Changes will apply across the entire application.
                </p>
                
                <div className="theme-options-grid">
                  <div className="theme-option-card">
                    <div className="form-group-modern">
                      <label className="modern-label">Primary Color</label>
                      <div className="color-picker-wrapper">
                        <input
                          type="color"
                          className="color-picker"
                          value={themeSettings.primaryColor}
                          onChange={(e) => setThemeSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        />
                        <input
                          type="text"
                          className="modern-input color-input"
                          value={themeSettings.primaryColor}
                          onChange={(e) => setThemeSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="theme-option-card">
                    <div className="form-group-modern">
                      <label className="modern-label">Accent Color</label>
                      <div className="color-picker-wrapper">
                        <input
                          type="color"
                          className="color-picker"
                          value={themeSettings.accentColor}
                          onChange={(e) => setThemeSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                        />
                        <input
                          type="text"
                          className="modern-input color-input"
                          value={themeSettings.accentColor}
                          onChange={(e) => setThemeSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="theme-presets">
                  <label className="modern-label">Quick Presets</label>
                  <div className="preset-buttons">
                    <button 
                      className="preset-btn teal"
                      onClick={() => setThemeSettings({ primaryColor: '#14b8a6', accentColor: '#06b6d4', darkMode: true })}
                    >
                      Teal Ocean
                    </button>
                    <button 
                      className="preset-btn purple"
                      onClick={() => setThemeSettings({ primaryColor: '#8b5cf6', accentColor: '#a78bfa', darkMode: true })}
                    >
                      Purple Dream
                    </button>
                    <button 
                      className="preset-btn orange"
                      onClick={() => setThemeSettings({ primaryColor: '#f97316', accentColor: '#fb923c', darkMode: true })}
                    >
                      Sunset Glow
                    </button>
                    <button 
                      className="preset-btn green"
                      onClick={() => setThemeSettings({ primaryColor: '#22c55e', accentColor: '#4ade80', darkMode: true })}
                    >
                      Forest Green
                    </button>
                  </div>
                </div>

                <div className="card-actions">
                  <button className="modern-btn-primary">
                    💾 Save Theme Settings
                  </button>
                  <button className="modern-btn-secondary">
                    🔄 Reset to Default
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeSubTab === 'notifications' && (
          <div className="modern-settings-content">
            {/* SMTP Configuration */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Email Configuration (SMTP)</h3>
                <span className="modern-badge">Outgoing Mail</span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Configure SMTP settings for sending emails. This is required for email notifications, password resets, and system alerts.
                </p>
                
                <div className="smtp-form-grid">
                  <div className="form-group-modern">
                    <label className="modern-label">SMTP Host</label>
                    <input
                      type="text"
                      className="modern-input"
                      value={smtpConfig.host}
                      onChange={(e) => setSmtpConfig(prev => ({ ...prev, host: e.target.value }))}
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="form-group-modern">
                    <label className="modern-label">Port</label>
                    <input
                      type="number"
                      className="modern-input"
                      value={smtpConfig.port}
                      onChange={(e) => setSmtpConfig(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                      placeholder="587"
                    />
                  </div>
                  <div className="form-group-modern">
                    <label className="modern-label">Username</label>
                    <input
                      type="text"
                      className="modern-input"
                      value={smtpConfig.username}
                      onChange={(e) => setSmtpConfig(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="your-email@gmail.com"
                    />
                  </div>
                  <div className="form-group-modern">
                    <label className="modern-label">Password</label>
                    <input
                      type="password"
                      className="modern-input"
                      value={smtpConfig.password}
                      onChange={(e) => setSmtpConfig(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="••••••••••••"
                    />
                  </div>
                  <div className="form-group-modern">
                    <label className="modern-label">From Email</label>
                    <input
                      type="email"
                      className="modern-input"
                      value={smtpConfig.fromEmail}
                      onChange={(e) => setSmtpConfig(prev => ({ ...prev, fromEmail: e.target.value }))}
                      placeholder="noreply@playlive.com"
                    />
                  </div>
                  <div className="form-group-modern">
                    <label className="modern-label">From Name</label>
                    <input
                      type="text"
                      className="modern-input"
                      value={smtpConfig.fromName}
                      onChange={(e) => setSmtpConfig(prev => ({ ...prev, fromName: e.target.value }))}
                      placeholder="PlayLive"
                    />
                  </div>
                </div>

                <div className="setting-toggle-group" style={{ marginTop: '20px' }}>
                  <div className="toggle-wrapper">
                    <label className="modern-toggle">
                      <input
                        type="checkbox"
                        checked={smtpConfig.secure}
                        onChange={(e) => setSmtpConfig(prev => ({ ...prev, secure: e.target.checked }))}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <div className="toggle-label-group">
                      <span className="toggle-label">Use SSL/TLS</span>
                      <span className="toggle-description">Enable secure connection (recommended for port 465)</span>
                    </div>
                  </div>
                </div>

                {smtpMessage && (
                  <div className={`message-banner ${smtpMessage.includes('✅') ? 'success' : 'error'}`}>
                    {smtpMessage}
                  </div>
                )}

                <div className="card-actions">
                  <button
                    className="modern-btn-primary"
                    onClick={handleSaveSmtpConfig}
                    disabled={smtpLoading}
                  >
                    {smtpLoading ? 'Saving...' : '💾 Save Configuration'}
                  </button>
                  <button
                    className="modern-btn-secondary"
                    onClick={handleTestSmtp}
                    disabled={smtpTestLoading}
                  >
                    {smtpTestLoading ? 'Sending...' : '📧 Send Test Email'}
                  </button>
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Notification Preferences</h3>
                <span className="modern-badge">Alerts</span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Choose how you want to receive notifications for different events in the system.
                </p>
                
                <div className="notification-prefs-table">
                  <div className="notif-table-header">
                    <span className="notif-event-col">Event</span>
                    <span className="notif-toggle-col">Email</span>
                    <span className="notif-toggle-col">In-App</span>
                  </div>
                  {Object.entries(notificationPrefs).map(([key, value]) => (
                    <div key={key} className="notif-table-row">
                      <span className="notif-event-col">
                        {key === 'tournamentCreated' && '🏆 Tournament Created'}
                        {key === 'playerRegistered' && '👤 Player Registered'}
                        {key === 'teamRegistered' && '👥 Team Registered'}
                        {key === 'auctionStarted' && '🔥 Auction Started'}
                        {key === 'auctionEnded' && '🏁 Auction Ended'}
                        {key === 'systemAlerts' && '⚠️ System Alerts'}
                      </span>
                      <span className="notif-toggle-col">
                        <label className="modern-toggle small">
                          <input
                            type="checkbox"
                            checked={value.email}
                            onChange={(e) => setNotificationPrefs(prev => ({
                              ...prev,
                              [key]: { ...prev[key], email: e.target.checked }
                            }))}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </span>
                      <span className="notif-toggle-col">
                        <label className="modern-toggle small">
                          <input
                            type="checkbox"
                            checked={value.inApp}
                            onChange={(e) => setNotificationPrefs(prev => ({
                              ...prev,
                              [key]: { ...prev[key], inApp: e.target.checked }
                            }))}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </span>
                    </div>
                  ))}
                </div>

                {notifMessage && (
                  <div className={`message-banner ${notifMessage.includes('✅') ? 'success' : 'error'}`}>
                    {notifMessage}
                  </div>
                )}

                <div className="card-actions">
                  <button
                    className="modern-btn-primary"
                    onClick={handleSaveNotificationPrefs}
                    disabled={notifLoading}
                  >
                    {notifLoading ? 'Saving...' : '💾 Save Preferences'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Backup & Data Tab */}
        {activeSubTab === 'backup' && (
          <div className="modern-settings-content">
            {/* Manual Backup */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Create Backup</h3>
                <span className="modern-badge">Manual</span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Create a complete backup of your system including all tournaments, players, teams, and uploaded files.
                </p>
                
                {backupMessage && (
                  <div className={`message-banner ${backupMessage.includes('✅') ? 'success' : 'error'}`}>
                    {backupMessage}
                  </div>
                )}

                <div className="card-actions">
                  <button
                    className="modern-btn-primary"
                    onClick={handleCreateBackup}
                    disabled={backupLoading}
                  >
                    {backupLoading ? (
                      <>
                        <span className="spinner"></span>
                        Creating Backup...
                      </>
                    ) : (
                      '💾 Create Backup Now'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Scheduled Backups */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Scheduled Backups</h3>
                <span className={`modern-badge ${scheduledBackup.enabled ? '' : 'danger'}`}>
                  {scheduledBackup.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Configure automatic backups to run on a schedule. Backups are stored securely and can be restored at any time.
                </p>

                <div className="setting-toggle-group">
                  <div className="toggle-wrapper">
                    <label className="modern-toggle">
                      <input
                        type="checkbox"
                        checked={scheduledBackup.enabled}
                        onChange={(e) => setScheduledBackup(prev => ({ ...prev, enabled: e.target.checked }))}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <div className="toggle-label-group">
                      <span className="toggle-label">Enable Scheduled Backups</span>
                      <span className="toggle-description">Automatically create backups on a regular schedule</span>
                    </div>
                  </div>
                </div>

                {scheduledBackup.enabled && (
                  <div className="scheduled-backup-options">
                    <div className="backup-options-grid">
                      <div className="form-group-modern">
                        <label className="modern-label">Frequency</label>
                        <select
                          className="modern-input"
                          value={scheduledBackup.frequency}
                          onChange={(e) => setScheduledBackup(prev => ({ ...prev, frequency: e.target.value }))}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div className="form-group-modern">
                        <label className="modern-label">Time (24h)</label>
                        <input
                          type="time"
                          className="modern-input"
                          value={scheduledBackup.time}
                          onChange={(e) => setScheduledBackup(prev => ({ ...prev, time: e.target.value }))}
                        />
                      </div>
                      <div className="form-group-modern">
                        <label className="modern-label">Retention (# of backups)</label>
                        <input
                          type="number"
                          className="modern-input"
                          min="1"
                          max="30"
                          value={scheduledBackup.retention}
                          onChange={(e) => setScheduledBackup(prev => ({ ...prev, retention: parseInt(e.target.value) }))}
                        />
                      </div>
                    </div>
                    <div className="card-actions">
                      <button
                        className="modern-btn-primary"
                        onClick={handleSaveScheduledBackup}
                        disabled={backupLoading}
                      >
                        💾 Save Schedule
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Backup History */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Backup History</h3>
                <span className="modern-badge">{backupList.length} Backups</span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  View and manage your existing backups. You can download or restore from any backup.
                </p>
                
                <div className="backup-list">
                  {backupList.map((backup) => (
                    <div key={backup.id} className="backup-item">
                      <div className="backup-icon">
                        {backup.type === 'auto' ? '🔄' : '📦'}
                      </div>
                      <div className="backup-details">
                        <div className="backup-name">{backup.name}</div>
                        <div className="backup-meta">
                          <span>{formatBytes(backup.size)}</span>
                          <span>{backup.date.toLocaleDateString()}</span>
                          <span className={`backup-type-badge ${backup.type}`}>
                            {backup.type === 'auto' ? 'Scheduled' : 'Manual'}
                          </span>
                        </div>
                      </div>
                      <div className="backup-actions">
                        <button className="backup-action-btn download" title="Download">
                          ⬇️
                        </button>
                        <button className="backup-action-btn restore" title="Restore">
                          🔄
                        </button>
                        <button 
                          className="backup-action-btn delete" 
                          title="Delete"
                          onClick={() => handleDeleteBackup(backup.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Export Data */}
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Export Data</h3>
                <span className="modern-badge">Download</span>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Export your data in various formats for analysis or migration purposes.
                </p>
                
                <div className="export-options">
                  <div className="export-option">
                    <div className="export-info">
                      <span className="export-icon">🏆</span>
                      <div>
                        <span className="export-title">Tournaments</span>
                        <span className="export-desc">All tournament configurations and settings</span>
                      </div>
                    </div>
                    <div className="export-buttons">
                      <button className="export-btn">CSV</button>
                      <button className="export-btn">JSON</button>
                    </div>
                  </div>
                  <div className="export-option">
                    <div className="export-info">
                      <span className="export-icon">👤</span>
                      <div>
                        <span className="export-title">Players</span>
                        <span className="export-desc">Complete player registry with statistics</span>
                      </div>
                    </div>
                    <div className="export-buttons">
                      <button className="export-btn">CSV</button>
                      <button className="export-btn">JSON</button>
                    </div>
                  </div>
                  <div className="export-option">
                    <div className="export-info">
                      <span className="export-icon">👥</span>
                      <div>
                        <span className="export-title">Teams</span>
                        <span className="export-desc">Team rosters and configurations</span>
                      </div>
                    </div>
                    <div className="export-buttons">
                      <button className="export-btn">CSV</button>
                      <button className="export-btn">JSON</button>
                    </div>
                  </div>
                  <div className="export-option">
                    <div className="export-info">
                      <span className="export-icon">💰</span>
                      <div>
                        <span className="export-title">Auction Data</span>
                        <span className="export-desc">Bidding history and results</span>
                      </div>
                    </div>
                    <div className="export-buttons">
                      <button className="export-btn">CSV</button>
                      <button className="export-btn">JSON</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tier Management Tab */}
        {activeSubTab === 'tier-management' && (
          <div className="modern-settings-content">
            <div className="modern-card">
              <div className="modern-card-header">
                <h3 className="modern-card-title">Tier System Overview</h3>
              </div>
              <div className="modern-card-body">
                <p className="card-description">
                  Manage feature access across Standard and Auction Pro plans with per-tournament overrides.
                </p>
                {tierError && (
                  <div className="message-banner warning">{tierError}</div>
                )}
              </div>
            </div>

            {/* Tier Summary Cards */}
            <div className="tier-grid">
              {tierSummaryData.map((tier) => (
                <div key={tier.tier} className="tier-card-modern">
                  <div className="tier-card-header">
                    <span className={`tier-badge tier-badge-${tier.tier.toLowerCase()}`}>{tier.label}</span>
                    <span className="tier-count">{tier.featureCount} features</span>
                  </div>
                  <p className="tier-description">{tier.description}</p>
                  <div className="tier-features-preview">
                    {tier.highlight.map((feature) => (
                      <span key={feature.id} className="feature-chip">
                        <span>{feature.icon}</span>
                        {feature.name}
                      </span>
                    ))}
                    {tier.featureCount > tier.highlight.length && (
                      <span className="feature-chip more">
                        +{tier.featureCount - tier.highlight.length} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Tier Editor */}
            {isSuperAdmin && (
              <div className="modern-card tier-editor-card">
                <div className="modern-card-header">
                  <div>
                    <h3 className="modern-card-title">Edit Tier Features</h3>
                    <p className="modern-card-subtitle">
                      Toggle which features are available for each subscription tier. Changes apply instantly.
                    </p>
                  </div>
                  <span className="modern-badge">Super Admin</span>
                </div>

                <div className="tier-editor-tabs">
                  {sortedTierConfigs.map((tier) => (
                    <button
                      key={tier.tier}
                      className={`tier-editor-tab ${activeTierEditor === tier.tier ? 'active' : ''}`}
                      onClick={() => handleTierEditorTabChange(tier.tier)}
                    >
                      <span>{formatPlan(tier.tier)}</span>
                      <small>{tier.features?.length || 0} features</small>
                    </button>
                  ))}
                </div>

                <div className="tier-editor-info">
                  <div>
                    <h4>{activeTierLabel}</h4>
                    <p>{activeTierMetadata?.description || 'No description configured for this tier.'}</p>
                  </div>
                  <div className="tier-editor-stat">
                    <span className="stat-label">Total features</span>
                    <span className="stat-value">{activeTierFeatures.length}</span>
                  </div>
                </div>

                <div className="tier-editor-columns">
                  <div className="tier-editor-column">
                    <div className="tier-editor-column-header">
                      <h5>Enabled Features</h5>
                      <span>{activeTierFeatures.length}</span>
                    </div>
                    <div className="tier-feature-list">
                      {selectedFeatureDetails.length === 0 && (
                        <p className="tier-feature-empty">This tier does not have any features yet.</p>
                      )}
                      {selectedFeatureDetails.map((feature) => (
                        <div key={feature.id} className="tier-feature-pill active">
                          <div className="pill-details">
                            <span className="pill-icon">{feature.icon}</span>
                            <div>
                              <p className="pill-title">{feature.name}</p>
                              <p className="pill-meta">{feature.category}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="pill-action remove"
                            onClick={() => handleTierFeatureRemove(feature.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="tier-editor-column">
                    <div className="tier-editor-column-header">
                      <h5>Available Features</h5>
                      <span>{availableFeatures.length}</span>
                    </div>
                    <div className="tier-editor-search">
                      <input
                        type="text"
                        placeholder="Search feature name, category, description..."
                        value={featureSearch}
                        onChange={(e) => setFeatureSearch(e.target.value)}
                      />
                    </div>
                    <div className="tier-feature-list scrollable">
                      {availableFeatures.length === 0 && (
                        <p className="tier-feature-empty">No additional features match your search.</p>
                      )}
                      {availableFeatures.map((feature) => (
                        <div key={feature.id} className="tier-feature-pill">
                          <div className="pill-details">
                            <span className="pill-icon">{feature.icon || FEATURE_ICON_MAP[feature.id] || '🧩'}</span>
                            <div>
                              <p className="pill-title">{feature.name}</p>
                              <p className="pill-meta">{feature.category}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="pill-action add"
                            onClick={() => handleTierFeatureAdd(feature.id)}
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {tierSaveState.message && (
                  <div className={`message-banner ${tierSaveState.type === 'success' ? 'success' : 'error'}`}>
                    {tierSaveState.message}
                  </div>
                )}

                <div className="tier-editor-actions">
                  <button
                    type="button"
                    className="modern-btn-secondary"
                    onClick={handleResetTierDraft}
                    disabled={!hasTierChanges || tierSaving}
                  >
                    Reset Changes
                  </button>
                  <button
                    type="button"
                    className="modern-btn-primary"
                    onClick={handleSaveTierFeatures}
                    disabled={!hasTierChanges || tierSaving}
                  >
                    {tierSaving ? 'Saving...' : '💾 Save Tier'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="modern-modal-overlay" onClick={() => setShowEditProfileModal(false)}>
          <div className="modern-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modern-modal-header">
              <h3>Edit Profile</h3>
              <button className="modal-close" onClick={() => setShowEditProfileModal(false)}>×</button>
            </div>
            <form onSubmit={handleEditProfile} className="modern-modal-body">
              <div className="form-group-modern">
                <label className="modern-label">Name</label>
                <input
                  type="text"
                  className="modern-input"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group-modern">
                <label className="modern-label">Email</label>
                <input
                  type="email"
                  className="modern-input"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group-modern">
                <label className="modern-label">Mobile</label>
                <input
                  type="text"
                  className="modern-input"
                  value={profileForm.mobile}
                  onChange={(e) => setProfileForm({ ...profileForm, mobile: e.target.value })}
                  required
                />
              </div>
              <div className="form-group-modern">
                <label className="modern-label">Profile Picture</label>
                <ImageUploadCrop
                  onImageSelect={(file) => setProfileForm({ ...profileForm, profilePicture: file })}
                  aspectRatio={1}
                  maxWidth={512}
                  quality={80}
                  uploadType="admin-profile"
                  placeholder="Click to upload profile picture"
                  maxSizeMB={1}
                />
              </div>
              <div className="modern-modal-actions">
                <button type="button" className="modern-btn-secondary" onClick={() => setShowEditProfileModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="modern-btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="modern-modal-overlay" onClick={() => setShowChangePasswordModal(false)}>
          <div className="modern-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modern-modal-header">
              <h3>Change Password</h3>
              <button className="modal-close" onClick={() => setShowChangePasswordModal(false)}>×</button>
            </div>
            <form onSubmit={handleChangePassword} className="modern-modal-body">
              <div className="form-group-modern">
                <label className="modern-label">Current Password</label>
                <input
                  type="password"
                  className="modern-input"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  required
                />
              </div>
              <div className="form-group-modern">
                <label className="modern-label">New Password</label>
                <input
                  type="password"
                  className="modern-input"
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group-modern">
                <label className="modern-label">Confirm New Password</label>
                <input
                  type="password"
                  className="modern-input"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="modern-modal-actions">
                <button type="button" className="modern-btn-secondary" onClick={() => setShowChangePasswordModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="modern-btn-primary" disabled={loading}>
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset System Modal */}
      {showResetModal && (
        <div className="modern-modal-overlay" onClick={() => { if (resetStep === 1) setShowResetModal(false); }}>
          <div className="modern-modal danger-modal" onClick={(e) => e.stopPropagation()}>
            {resetStep === 1 && (
              <>
                <div className="modern-modal-header danger">
                  <h3>⚠️ Confirm Full System Reset</h3>
                  <button className="modal-close" onClick={() => setShowResetModal(false)}>×</button>
                </div>
                <div className="modern-modal-body">
                  <p className="warning-text">This will <strong>PERMANENTLY delete</strong>:</p>
                  <ul className="warning-list">
                    <li>All tournaments and tournament admins</li>
                    <li>All players and teams</li>
                    <li>All user accounts</li>
                    <li>All uploaded logos and player images</li>
                    <li>All auction data and reports</li>
                  </ul>
                  <p className="warning-text">This cannot be undone.</p>
                  <div className="form-group-modern">
                    <label className="modern-label">Type <strong>RESET ALL USERS</strong> to confirm:</label>
                    <input
                      type="text"
                      className="modern-input"
                      value={resetConfirmText}
                      onChange={(e) => setResetConfirmText(e.target.value)}
                      placeholder="Type here to confirm"
                    />
                  </div>
                  <div className="modern-modal-actions">
                    <button className="modern-btn-secondary" onClick={() => setShowResetModal(false)}>
                      Cancel
                    </button>
                    <button
                      className="modern-btn-danger"
                      disabled={resetConfirmText !== 'RESET ALL USERS'}
                      onClick={handleResetSystem}
                    >
                      🔥 Confirm & Delete Everything
                    </button>
                  </div>
                </div>
              </>
            )}
            {resetStep === 2 && (
              <>
                <div className="modern-modal-header">
                  <h3>🧹 Wiping Data Securely...</h3>
                </div>
                <div className="modern-modal-body">
                  <div className="progress-container-modern">
                    <div className="progress-bar-modern">
                      <div className="progress-fill-modern" style={{ width: `${resetProgress}%` }}></div>
                    </div>
                    <p className="progress-status">{resetStatus}</p>
                    <p className="progress-warning">Do not close this window until process completes.</p>
                  </div>
                </div>
              </>
            )}
            {resetStep === 3 && (
              <>
                <div className="modern-modal-header success">
                  <h3>✅ System Reset Complete!</h3>
                </div>
                <div className="modern-modal-body">
                  <p>All tournaments, players, and user accounts have been deleted.</p>
                  <p>The system has been restored to PlayLive's default configuration.</p>
                  <p><strong>Remaining User:</strong> 👑 Super Admin — {user?.email}</p>
                  <div className="modern-modal-actions">
                    <button className="modern-btn-primary" onClick={() => window.location.reload()}>
                      🔄 Restart Application
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsTab;
