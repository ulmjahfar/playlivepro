import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../utils/apiConfig';
import '../styles-dashboard.css';
import '../styles-super-admin-dashboard.css';
import '../tournaments-admin-redesign.css';
import '../styles-tournaments-redesign-v2.css';
import '../styles-tournaments-light-v3.css';

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
    id: 'auto_player_id',
    name: 'Auto Player ID',
    defaultTier: 'Standard',
    category: 'Registration',
    description: 'Auto-generated IDs for players.',
    icon: '🆔'
  },
  {
    id: 'multilanguage_support',
    name: 'Multi-language Support',
    defaultTier: 'Standard',
    category: 'TournamentManagement',
    description: 'UI and registration forms in multiple languages.',
    icon: '🌐'
  },
  {
    id: 'branding_controls',
    name: 'Branding Controls',
    defaultTier: 'Standard',
    category: 'Branding',
    description: 'Custom logos, colours, and theming.',
    icon: '🎨'
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
    id: 'auction_random_picker',
    name: 'Random Player Picker',
    defaultTier: 'Standard',
    category: 'Auction',
    description: 'Smart randomiser for unsold players.',
    icon: '🎲'
  },
  {
    id: 'auction_bid_controller',
    name: 'Bid Controller Dashboard',
    defaultTier: 'Standard',
    category: 'Auction',
    description: 'Control increments, bids, and approvals.',
    icon: '🎛️'
  },
  {
    id: 'auction_increment_rules',
    name: 'Increment Rules',
    defaultTier: 'Standard',
    category: 'Auction',
    description: 'Slab and straight increment logic.',
    icon: '📈'
  },
  {
    id: 'auction_status_logic',
    name: 'Pending & Unsold Logic',
    defaultTier: 'Standard',
    category: 'Auction',
    description: 'Automated pending, unsold, and withdrawn flows.',
    icon: '⏳'
  },
  {
    id: 'auction_bid_restrictions',
    name: 'Bid Restrictions',
    defaultTier: 'Standard',
    category: 'Auction',
    description: 'No repeat team bid and validation rules.',
    icon: '🚫'
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
    id: 'team_fund_setup',
    name: 'Team Fund Setup',
    defaultTier: 'Standard',
    category: 'Finance',
    description: 'Configure budgets per team.',
    icon: '🏦'
  },
  {
    id: 'spend_summary',
    name: 'Spend Summary',
    defaultTier: 'Standard',
    category: 'Finance',
    description: 'Analyse spends and residual funds.',
    icon: '🧾'
  },
  {
    id: 'highest_bid_avg_price',
    name: 'Highest Bid & Avg Price',
    defaultTier: 'Standard',
    category: 'Analytics',
    description: 'Auction analytics for leadership teams.',
    icon: '📈'
  },
  {
    id: 'team_comparison',
    name: 'Team Comparison',
    defaultTier: 'Standard',
    category: 'Analytics',
    description: 'Compare squads, spend, and composition.',
    icon: '⚖️'
  },
  {
    id: 'reports_suite',
    name: 'PDF & Excel Exports',
    defaultTier: 'Standard',
    category: 'Reports',
    description: 'Bulk export rosters, auction, and finance data.',
    icon: '📄'
  },
  {
    id: 'player_card_export',
    name: 'Player Card Export',
    defaultTier: 'Standard',
    category: 'Reports',
    description: 'Generate player cards (25 per PDF page).',
    icon: '🪪'
  },
  {
    id: 'tournament_summary_report',
    name: 'Tournament Summary Report',
    defaultTier: 'Standard',
    category: 'Reports',
    description: 'One-click tournament executive summary.',
    icon: '📝'
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
    id: 'broadcast_split_screen',
    name: 'Split Screen Layout',
    defaultTier: 'Standard',
    category: 'Broadcast',
    description: 'Dynamic dual-screen broadcast views.',
    icon: '🖥️'
  },
  {
    id: 'broadcast_live_ticker',
    name: 'Live Ticker',
    defaultTier: 'Standard',
    category: 'Broadcast',
    description: 'Real-time ticker for scores and status.',
    icon: '📰'
  },
  {
    id: 'broadcast_leaderboard',
    name: 'Team Leaderboard',
    defaultTier: 'Standard',
    category: 'Broadcast',
    description: 'Live leaderboard with ranking logic.',
    icon: '🥇'
  },
  {
    id: 'broadcast_confetti',
    name: 'Confetti & Animations',
    defaultTier: 'Standard',
    category: 'Broadcast',
    description: 'Celebratory animations and scenes.',
    icon: '🎉'
  },
  {
    id: 'multi_screen_sync',
    name: 'Multi-screen Sync',
    defaultTier: 'Standard',
    category: 'Broadcast',
    description: 'Synchronise live feeds across screens.',
    icon: '🔄'
  },
  {
    id: 'voice_announcer',
    name: 'Voice Announcements',
    defaultTier: 'Standard',
    category: 'Broadcast',
    description: 'AI-powered voice and audio cues.',
    icon: '🎙️'
  },
  {
    id: 'auction_pro_remote_bidding',
    name: 'Auction Pro Remote Bidding',
    defaultTier: 'AuctionPro',
    category: 'Auction',
    description: 'Remote bidding console with secure seats and device locks.',
    icon: '🛰️'
  },
  {
    id: 'auction_pro_multi_seat',
    name: 'Multi-seat Team Console',
    defaultTier: 'AuctionPro',
    category: 'Auction',
    description: 'Coordinate captains, analysts, and finance roles with voting rules.',
    icon: '👥'
  },
  {
    id: 'auction_pro_insights',
    name: 'Auction Pro Insights',
    defaultTier: 'AuctionPro',
    category: 'Analytics',
    description: 'Live consensus telemetry, seat health, and bidding diagnostics.',
    icon: '📡'
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
    id: 'whatsapp_reports',
    name: 'WhatsApp Reports',
    defaultTier: 'Standard',
    category: 'Reports',
    description: 'Instantly share reports via WhatsApp.',
    icon: '📲'
  },
  {
    id: 'advanced_analytics',
    name: 'Advanced Analytics',
    defaultTier: 'Standard',
    category: 'Analytics',
    description: 'Deep insights, trends, and predictive analytics.',
    icon: '📊'
  },
  {
    id: 'auto_timer',
    name: 'Auto Timer',
    defaultTier: 'Standard',
    category: 'Auction',
    description: 'Automated timers and countdowns.',
    icon: '⏱️'
  },
  {
    id: 'sponsor_overlays',
    name: 'Sponsor Overlays',
    defaultTier: 'Standard',
    category: 'Branding',
    description: 'Sponsor-driven overlays and placements.',
    icon: '🪧'
  },
  {
    id: 'reports_auto_generation',
    name: 'Auto Report Builder',
    defaultTier: 'Standard',
    category: 'Reports',
    description: 'Scheduled report builds and automation.',
    icon: '🤖'
  }
];

const DEFAULT_TIER_CONFIGS = [
  {
    tier: 'Standard',
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
      'auto_player_id',
      'multilanguage_support',
      'branding_controls',
      'auction_live',
      'auction_random_picker',
      'auction_bid_controller',
      'auction_increment_rules',
      'auction_status_logic',
      'auction_bid_restrictions',
      'finance_tracker',
      'team_fund_setup',
      'spend_summary',
      'highest_bid_avg_price',
      'team_comparison',
      'reports_suite',
      'player_card_export',
      'tournament_summary_report',
      'broadcast_mode',
      'broadcast_split_screen',
      'broadcast_live_ticker',
      'broadcast_leaderboard',
      'broadcast_confetti',
      'multi_screen_sync',
      'voice_announcer',
      'notifications_whatsapp',
      'whatsapp_reports',
      'advanced_analytics',
      'auto_timer',
      'sponsor_overlays',
      'reports_auto_generation'
    ],
    metadata: {
      displayName: 'Standard',
      description: 'Premium broadcast, automation, and analytics package.'
    }
  }
];

const CATEGORY_LABELS = {
  TournamentManagement: 'Tournament Features',
  Registration: 'Player & Team Registration',
  Auction: 'Auction Suite',
  Finance: 'Finance',
  Analytics: 'Analytics',
  Reports: 'Reports & Export',
  Broadcast: 'Broadcast',
  Notifications: 'Notifications',
  Branding: 'Branding',
  AdminTools: 'Admin Tools'
};

const FEATURE_ICON_MAP = DEFAULT_FEATURE_DEFINITIONS.reduce((acc, feature) => {
  acc[feature.id] = feature.icon || '⚙️';
  return acc;
}, {});

const REPORT_FEATURE_IDS = [
  'reports_suite',
  'player_list_export',
  'player_card_export',
  'tournament_summary_report',
  'whatsapp_reports',
  'reports_auto_generation'
];

const FILTER_DEFAULTS = {
  sport: '',
  status: '',
  plan: '',
  feature: ''
};

const TOURNAMENT_MODE_META = {
  dynamic: {
    icon: '⚡',
    hint: 'Full experience with every module unlocked',
    tone: 'dynamic'
  },
  normal: {
    icon: '🧊',
    hint: 'Guided shell with simplified navigation',
    tone: 'normal'
  },
  hybrid: {
    icon: '🔀',
    hint: 'Mix of classic and pro layouts',
    tone: 'hybrid'
  },
  custom: {
    icon: '🛠️',
    hint: 'Custom configuration applied',
    tone: 'custom'
  }
};

const TournamentsTab = ({ tournaments, loading, onTournamentSuccess }) => {
  const navigate = useNavigate();
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [filters, setFilters] = useState(() => ({ ...FILTER_DEFAULTS }));
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingStatusFor, setEditingStatusFor] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [featureDefinitions, setFeatureDefinitions] = useState(DEFAULT_FEATURE_DEFINITIONS);
  const [tierConfigs, setTierConfigs] = useState(DEFAULT_TIER_CONFIGS);
  const [featureModalTournament, setFeatureModalTournament] = useState(null);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [featureModalSearch, setFeatureModalSearch] = useState('');
  const [openAuctionDropdown, setOpenAuctionDropdown] = useState(null);
  const [openActionsDropdown, setOpenActionsDropdown] = useState(null);
  const [openStatusDropdown, setOpenStatusDropdown] = useState(null);
  const itemsPerPage = 10;
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') {
      return 'cards';
    }
    const stored = window.localStorage?.getItem('tournamentsViewMode');
    if (stored === 'table' || stored === 'cards') {
      return stored;
    }
    return 'cards';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('tournamentsViewMode', viewMode);
  }, [viewMode]);
  const normalizePlan = useCallback((plan) => {
    if (!plan) return 'Standard';
    const compact = plan.toString().replace(/\s+/g, '').toLowerCase();
    if (compact === 'liteplus') return 'Standard'; // Map old LitePlus to Standard
    if (compact === 'standard') return 'Standard';
    if (compact === 'lite') return 'Standard'; // Map old Lite to Standard
    if (compact === 'auctionpro') return 'AuctionPro';
    if (compact === 'custom') return 'Custom';
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
  const getTournamentModeDetails = useCallback(() => ({
    label: 'Dynamic',
    key: 'dynamic',
    ...TOURNAMENT_MODE_META.dynamic
  }), []);
  const formatTimeline = useCallback((startDate, endDate) => {
    if (!startDate && !endDate) {
      return 'Schedule TBD';
    }
    const startLabel = startDate
      ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : null;
    const endLabel = endDate
      ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : null;

    if (startLabel && endLabel) {
      return `${startLabel} → ${endLabel}`;
    }
    if (startLabel) {
      return `${startLabel} onwards`;
    }
    return `Ends ${endLabel}`;
  }, []);
  const formatDate = useCallback((value) => {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not set';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  // Calculate auto-delete countdown and alerts
  const getAutoDeleteInfo = useCallback((tournament, systemSettings) => {
    if (!tournament.autoDeleteAt) {
      return { countdown: null, alert: null, daysRemaining: null };
    }

    const now = new Date();
    const deleteDate = new Date(tournament.autoDeleteAt);
    const diffTime = deleteDate - now;
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Check if auto-delete is enabled (system or tournament override)
    const isAutoDeleteEnabled = tournament.autoDeleteEnabled !== false && 
      (tournament.autoDeleteEnabled === true || systemSettings?.autoDeleteEnabled);

    if (!isAutoDeleteEnabled) {
      return { countdown: 'Disabled', alert: null, daysRemaining: null };
    }

    if (daysRemaining < 0) {
      return { countdown: 'Overdue', alert: 'critical', daysRemaining: 0 };
    }

    let alert = null;
    if (daysRemaining <= 1) {
      alert = 'critical'; // 1 day or less
    } else if (daysRemaining <= 3) {
      alert = 'warning'; // 2-3 days
    } else if (daysRemaining <= 7) {
      alert = 'info'; // 4-7 days
    }

    return {
      countdown: `${daysRemaining} Day${daysRemaining !== 1 ? 's' : ''}`,
      alert,
      daysRemaining
    };
  }, []);

  // State for system settings
  const [systemSettings, setSystemSettings] = useState(null);
  const showToast = useCallback((message, tone = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);
  const updateFilters = useCallback(
    (updater) => {
      setFilters((prev) => {
        const nextState = typeof updater === 'function' ? updater(prev) : updater;
        return nextState;
      });
      setCurrentPage(1);
    },
    [setFilters, setCurrentPage]
  );

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    },
    []
  );
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
      console.error('Failed to parse user from storage', error);
      return {};
    }
  }, []);
  const isSuperAdmin = user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN';

  // Load system settings
  useEffect(() => {
    if (isSuperAdmin) {
      const loadSettings = async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get(`${API_BASE_URL}/api/auto-delete/settings`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data.success) {
            setSystemSettings(res.data.settings);
          }
        } catch (err) {
          console.error('Error loading auto-delete settings:', err);
        }
      };
      loadSettings();
    }
  }, [isSuperAdmin]);

  // Close auction dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openAuctionDropdown && !event.target.closest('.auction-dropdown-container')) {
        setOpenAuctionDropdown(null);
      }
    };

    if (openAuctionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openAuctionDropdown]);

  // Close actions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openActionsDropdown && !event.target.closest('.actions-dropdown-container')) {
        setOpenActionsDropdown(null);
      }
    };

    if (openActionsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openActionsDropdown]);

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openStatusDropdown && !event.target.closest('.status-dropdown-container')) {
        setOpenStatusDropdown(null);
      }
    };

    if (openStatusDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openStatusDropdown]);

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
      } catch (error) {
        if (ignore) return;
        console.error('Failed to load tier configuration', error);
        setFeatureDefinitions(DEFAULT_FEATURE_DEFINITIONS);
        setTierConfigs(DEFAULT_TIER_CONFIGS);
      }
    };

    loadTierData();

    return () => {
      ignore = true;
    };
  }, [isSuperAdmin]);
  const tierFeatureMap = useMemo(() => {
    const map = {};
    (tierConfigs || []).forEach((tier) => {
      map[tier.tier] = Array.isArray(tier.features) ? tier.features : [];
    });
    return map;
  }, [tierConfigs]);
  const featureById = useMemo(() => {
    const map = {};
    (featureDefinitions || []).forEach((feature) => {
      if (feature?.id) {
        map[feature.id] = feature;
      }
    });
    return map;
  }, [featureDefinitions]);
  const allFeatureIds = useMemo(() => {
    const ids = new Set();
    (featureDefinitions || []).forEach((feature) => {
      if (feature?.id) ids.add(feature.id);
    });
    (tierConfigs || []).forEach((tier) => {
      (tier.features || []).forEach((featureId) => ids.add(featureId));
    });
    return Array.from(ids);
  }, [featureDefinitions, tierConfigs]);
  const orderedFeatureIds = useMemo(
    () =>
      [...allFeatureIds].sort((a, b) => {
        const featureA = featureById[a] || {};
        const featureB = featureById[b] || {};
        const categoryA = CATEGORY_LABELS[featureA.category] || featureA.category || '';
        const categoryB = CATEGORY_LABELS[featureB.category] || featureB.category || '';
        if (categoryA !== categoryB) {
          return categoryA.localeCompare(categoryB);
        }
        return (featureA.name || a).localeCompare(featureB.name || b);
      }),
    [allFeatureIds, featureById]
  );
  // featureFilterOptions is available for future use with feature-based filtering
  // const featureFilterOptions = useMemo(
  //   () =>
  //     orderedFeatureIds.map((featureId) => ({
  //       id: featureId,
  //       name: featureById[featureId]?.name || featureId
  //     })),
  //   [orderedFeatureIds, featureById]
  // );
  const resolvedFeaturesMap = useMemo(() => {
    const map = new Map();
    (tournaments || []).forEach((tournament) => {
      if (!tournament) return;
      const key = tournament._id || tournament.code;
      const planKey = normalizePlan(tournament.plan);
      const defaults = new Set(tierFeatureMap[planKey] || []);
      const rawOverrides = tournament.featureOverrides;
      let overrides = {};
      if (rawOverrides instanceof Map) {
        overrides = Object.fromEntries(rawOverrides.entries());
      } else if (rawOverrides && typeof rawOverrides === 'object') {
        overrides = { ...rawOverrides };
      }
      Object.entries(overrides).forEach(([featureId, value]) => {
        if (value === true) {
          defaults.add(featureId);
        } else if (value === false) {
          defaults.delete(featureId);
        }
      });
      map.set(key, {
        plan: planKey,
        features: Array.from(defaults),
        overrides,
        defaultFeatures: tierFeatureMap[planKey] || []
      });
    });
    return map;
  }, [tournaments, tierFeatureMap, normalizePlan]);
  const getResolvedFeaturesForTournament = useCallback(
    (tournament) => {
      if (!tournament) return [];
      const key = tournament._id || tournament.code;
      return resolvedFeaturesMap.get(key)?.features || [];
    },
    [resolvedFeaturesMap]
  );
  const getDefaultFeaturesForTournament = useCallback(
    (tournament) => {
      if (!tournament) return [];
      const key = tournament._id || tournament.code;
      const planKey = normalizePlan(tournament.plan);
      return resolvedFeaturesMap.get(key)?.defaultFeatures || tierFeatureMap[planKey] || [];
    },
    [normalizePlan, resolvedFeaturesMap, tierFeatureMap]
  );
  const getOverridesForTournament = useCallback(
    (tournament) => {
      if (!tournament) return {};
      const key = tournament._id || tournament.code;
      return resolvedFeaturesMap.get(key)?.overrides || {};
    },
    [resolvedFeaturesMap]
  );
  const resolvedFeatureSetGlobal = useMemo(() => {
    const set = new Set();
    resolvedFeaturesMap.forEach(({ features }) => {
      features.forEach((featureId) => set.add(featureId));
    });
    return set;
  }, [resolvedFeaturesMap]);
  const ensureReportsAccess = useCallback(() => {
    const hasReports = REPORT_FEATURE_IDS.some((featureId) => resolvedFeatureSetGlobal.has(featureId));
    if (!hasReports) {
      showToast('Reports feature is disabled for the current tier configuration. Enable it to export.', 'warning');
      return false;
    }
    return true;
  }, [resolvedFeatureSetGlobal, showToast]);
  const planFilterOptions = useMemo(
    () =>
      TIER_ORDER.filter((tier) => tierFeatureMap[tier])
        .map((tier) => ({
          id: tier,
          label: formatPlan(tier)
        })),
    [formatPlan, tierFeatureMap]
  );
  const modalFeaturesByCategory = useMemo(() => {
    const groups = {};
    orderedFeatureIds.forEach((featureId) => {
      const feature = featureById[featureId];
      const category = feature?.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(featureId);
    });
    return groups;
  }, [orderedFeatureIds, featureById]);
  const modalFeatureCategoryOrder = useMemo(
    () =>
      Object.keys(modalFeaturesByCategory).sort((a, b) => {
        const labelA = CATEGORY_LABELS[a] || a;
        const labelB = CATEGORY_LABELS[b] || b;
        return labelA.localeCompare(labelB);
      }),
    [modalFeaturesByCategory]
  );
  const modalFilteredFeaturesByCategory = useMemo(() => {
    const query = featureModalSearch.trim().toLowerCase();
    if (!query) {
      return modalFeaturesByCategory;
    }

    const filtered = {};
    Object.entries(modalFeaturesByCategory).forEach(([category, featureIds]) => {
      const matches = featureIds.filter((featureId) => {
        const feature = featureById[featureId] || {};
        const name = (feature.name || '').toLowerCase();
        const description = (feature.description || '').toLowerCase();
        const categoryLabel = (CATEGORY_LABELS[feature.category] || feature.category || '').toLowerCase();

        return (
          featureId.toLowerCase().includes(query) ||
          name.includes(query) ||
          description.includes(query) ||
          categoryLabel.includes(query)
        );
      });

      if (matches.length > 0) {
        filtered[category] = matches;
      }
    });

    return filtered;
  }, [modalFeaturesByCategory, featureById, featureModalSearch]);
  const tournamentStats = useMemo(() => {
    const items = Array.isArray(tournaments) ? tournaments : [];
    if (!items.length) {
      return {
        total: 0,
        active: 0,
        upcoming: 0,
        completed: 0,
        ended: 0,
        admins: 0,
        avgFeatureCount: 0,
        planDistribution: [],
        sportBreakdown: [],
        recent: [],
        needsAttention: 0
      };
    }

    const statusCounts = {
      Active: 0,
      Upcoming: 0,
      Completed: 0,
      End: 0
    };
    const planCounts = {};
    const sportCounts = {};
    let adminCount = 0;
    let featureAccumulator = 0;
    let needsAttention = 0;

    items.forEach((tournament) => {
      if (!tournament) return;

      const statusKey = tournament.status;
      if (statusKey && Object.prototype.hasOwnProperty.call(statusCounts, statusKey)) {
        statusCounts[statusKey] += 1;
      }

      const planKey = normalizePlan(tournament.plan || 'Standard');
      planCounts[planKey] = (planCounts[planKey] || 0) + 1;

      if (tournament.sport) {
        sportCounts[tournament.sport] = (sportCounts[tournament.sport] || 0) + 1;
      }

      if (tournament.adminId?.email) {
        adminCount += 1;
      } else {
        needsAttention += 1;
      }

      const featuresForTournament = getResolvedFeaturesForTournament(tournament);
      featureAccumulator += Array.isArray(featuresForTournament) ? featuresForTournament.length : 0;
    });

    const total = items.length;
    const avgFeatureCount = total ? Math.round(featureAccumulator / total) : 0;

    const planDistribution = Object.entries(planCounts)
      .map(([plan, count]) => ({
        plan,
        label: formatPlan(plan),
        count,
        ratio: Math.round((count / total) * 100)
      }))
      .sort((a, b) => {
        const indexA = TIER_ORDER.indexOf(a.plan);
        const indexB = TIER_ORDER.indexOf(b.plan);
        if (indexA === -1 && indexB === -1) {
          return a.label.localeCompare(b.label);
        }
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });

    const sportBreakdown = Object.entries(sportCounts)
      .map(([sport, count]) => ({
        sport,
        count,
        ratio: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const recent = [...items]
      .filter((item) => item?.createdAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4);

    return {
      total,
      active: statusCounts.Active,
      upcoming: statusCounts.Upcoming,
      completed: statusCounts.Completed,
      ended: statusCounts.End,
      admins: adminCount,
      avgFeatureCount,
      planDistribution,
      sportBreakdown,
      recent,
      needsAttention
    };
  }, [tournaments, normalizePlan, formatPlan, getResolvedFeaturesForTournament]);
  const heroTiles = useMemo(
    () => [
      {
        label: 'Live tournaments',
        value: tournamentStats.active,
        caption: 'Currently running across all sports'
      },
      {
        label: 'Launching soon',
        value: tournamentStats.upcoming,
        caption: 'Scheduled within the next phase'
      },
      {
        label: 'Admin setup pending',
        value: tournamentStats.needsAttention,
        caption: 'Missing credentials or owners'
      },
      {
        label: 'Avg features per tournament',
        value: tournamentStats.avgFeatureCount || 0,
        caption: 'Feature coverage across plans'
      }
    ],
    [tournamentStats]
  );
  const quickStatusSegments = useMemo(
    () => [
      {
        id: '',
        label: 'All states',
        emoji: '✨',
        value: tournamentStats.total
      },
      {
        id: 'Active',
        label: 'Active',
        emoji: '🟢',
        value: tournamentStats.active
      },
      {
        id: 'Upcoming',
        label: 'Upcoming',
        emoji: '⏳',
        value: tournamentStats.upcoming
      },
      {
        id: 'Completed',
        label: 'Completed',
        emoji: '🏁',
        value: tournamentStats.completed
      },
      {
        id: 'End',
        label: 'Ended',
        emoji: '🔴',
        value: tournamentStats.ended
      }
    ],
    [tournamentStats]
  );
  const autoDeleteStats = useMemo(() => {
    const stats = {
      critical: 0,
      warning: 0,
      info: 0,
      disabled: 0
    };
    (tournaments || []).forEach((tournament) => {
      const autoDeleteInfo = getAutoDeleteInfo(tournament, systemSettings);
      if (!autoDeleteInfo) {
        return;
      }
      if (autoDeleteInfo.countdown === 'Disabled') {
        stats.disabled += 1;
        return;
      }
      if (autoDeleteInfo.alert === 'critical') {
        stats.critical += 1;
      } else if (autoDeleteInfo.alert === 'warning') {
        stats.warning += 1;
      } else if (autoDeleteInfo.alert === 'info') {
        stats.info += 1;
      }
    });
    return stats;
  }, [tournaments, systemSettings, getAutoDeleteInfo]);
  const auctionReadyCount = useMemo(
    () => (tournaments || []).filter((tournament) => tournament?.auctionEnabled !== false).length,
    [tournaments]
  );
  const resetFilters = useCallback(() => {
    updateFilters(() => ({ ...FILTER_DEFAULTS }));
    setSearchQuery('');
    setCurrentPage(1);
  }, [updateFilters, setSearchQuery, setCurrentPage]);
  const handleStatusSegmentSelect = useCallback(
    (statusId) => {
      updateFilters((prev) => ({ ...prev, status: statusId }));
    },
    [updateFilters]
  );

  // Filtered and sorted tournaments
  const filteredTournaments = useMemo(() => {
    const normalizedPlanFilter = filters.plan ? normalizePlan(filters.plan) : '';
    const featureFilter = filters.feature;

    const sorted = [...(tournaments || [])]
      .filter(
        (t) =>
          (!filters.sport || t.sport === filters.sport) &&
          (!filters.status || t.status === filters.status) &&
          (!normalizedPlanFilter || normalizePlan(t.plan) === normalizedPlanFilter) &&
          (!searchQuery ||
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.code.toLowerCase().includes(searchQuery.toLowerCase())) &&
          (!featureFilter || getResolvedFeaturesForTournament(t).includes(featureFilter))
      )
      .sort((a, b) => {
        let aValue;
        let bValue;
        switch (sortConfig.key) {
          case 'name':
            aValue = (a.name || '').toLowerCase();
            bValue = (b.name || '').toLowerCase();
            break;
          case 'code':
            aValue = (a.code || '').toLowerCase();
            bValue = (b.code || '').toLowerCase();
            break;
          case 'sport':
            aValue = (a.sport || '').toLowerCase();
            bValue = (b.sport || '').toLowerCase();
            break;
          case 'plan':
            aValue = normalizePlan(a.plan || 'Standard');
            bValue = normalizePlan(b.plan || 'Standard');
            break;
          case 'mode':
            aValue = getTournamentModeDetails(a).label;
            bValue = getTournamentModeDetails(b).label;
            break;
          case 'location':
            aValue = (a.location || a.city || '').toLowerCase();
            bValue = (b.location || b.city || '').toLowerCase();
            break;
          case 'status':
            aValue = (a.status || '').toLowerCase();
            bValue = (b.status || '').toLowerCase();
            break;
          case 'auction':
            aValue = a.auctionEnabled !== false ? 1 : 0;
            bValue = b.auctionEnabled !== false ? 1 : 0;
            break;
          default:
            return 0;
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });

    return sorted;
  }, [
    tournaments,
    filters.sport,
    filters.status,
    filters.plan,
    filters.feature,
    searchQuery,
    sortConfig.key,
    sortConfig.direction,
    normalizePlan,
    getResolvedFeaturesForTournament,
    getTournamentModeDetails
  ]);

  const totalPages = Math.ceil(filteredTournaments.length / itemsPerPage);
  // summaryStats is available for future dashboard widgets
  // eslint-disable-next-line no-unused-vars
  const summaryStats = useMemo(() => {
    const stats = {
      total: filteredTournaments.length,
      active: 0,
      upcoming: 0,
      completed: 0,
      ended: 0
    };

    filteredTournaments.forEach((tournament) => {
      const status = (tournament.status || '').toLowerCase();
      if (status === 'active') stats.active += 1;
      else if (status === 'upcoming') stats.upcoming += 1;
      else if (status === 'completed') stats.completed += 1;
      else if (status === 'end') stats.ended += 1;
    });

    return stats;
  }, [filteredTournaments]);
  const paginatedTournaments = useMemo(
    () =>
      filteredTournaments.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      ),
    [filteredTournaments, currentPage, itemsPerPage]
  );
  const paginationRange = useMemo(() => {
    if (!filteredTournaments.length) {
      return { from: 0, to: 0 };
    }
    const from = (currentPage - 1) * itemsPerPage + 1;
    const to = Math.min(currentPage * itemsPerPage, filteredTournaments.length);
    return { from, to };
  }, [filteredTournaments.length, currentPage, itemsPerPage]);
  const buildTournamentLogoUrl = useCallback((logoPath) => {
    if (!logoPath) return '';
    if (typeof logoPath !== 'string') return '';
    if (/^https?:\/\//i.test(logoPath)) return logoPath;
    if (logoPath.startsWith('/')) {
      return `${API_BASE_URL}${logoPath}`;
    }
    return `${API_BASE_URL}/${logoPath}`;
  }, []);

  // Export functions
  const exportToExcel = () => {
    if (!filteredTournaments.length) {
    showToast('No tournaments available to export.', 'warning');
      return;
    }
    if (!ensureReportsAccess()) {
      return;
    }
    const csvContent = [
      ['Code', 'Tournament Name', 'Plan', 'Sport Type', 'Location', 'Participating Teams', 'Status', 'Admin Username'],
      ...filteredTournaments.map(t => [
        t.code,
        t.name,
        formatPlan(t.plan),
        t.sport,
        t.location || 'N/A',
        t.participatingTeams || 'N/A',
        t.status,
        t.adminId?.username || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'tournaments.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Excel export completed!');
  };

  const exportToPDF = () => {
    if (!filteredTournaments.length) {
      showToast('No tournaments available to export.', 'warning');
      return;
    }
    if (!ensureReportsAccess()) {
      return;
    }
    // Simple PDF export using browser print
    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>Tournaments Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          <h1>All Tournaments Report</h1>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Tournament Name</th>
                <th>Sport Type</th>
                <th>Plan</th>
                <th>Location</th>
                <th>Participating Teams</th>
                <th>Status</th>
                <th>Admin Username</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTournaments.map(t => `
                <tr>
                  <td>${t.code}</td>
                  <td>${t.name}</td>
                  <td>${t.sport}</td>
                  <td>${formatPlan(t.plan)}</td>
                  <td>${t.location || 'N/A'}</td>
                  <td>${t.participatingTeams || 'N/A'}</td>
                  <td>${t.status}</td>
                  <td>${t.adminId?.username || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
    showToast('PDF export initiated!');
  };

  const handleCreateTournament = () => navigate('/dashboard/superadmin/tournaments/create');
  // handleTournamentSuccess available for modal/form success callbacks
  // eslint-disable-next-line no-unused-vars
  const handleTournamentSuccess = () => onTournamentSuccess();

  const handleView = (code) => navigate(`/tournament/${code}/overview`);
  const handleEdit = (code) => navigate(`/edit-tournament/${code}`);
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this tournament?')) {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.delete(`${API_BASE_URL}/api/tournaments/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) {
          alert('Tournament deleted successfully');
          onTournamentSuccess();
        } else {
          alert('Failed to delete tournament: ' + res.data.message);
        }
      } catch (err) {
        console.error(err);
        alert('Error deleting tournament: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleCredentials = (tournament) => {
    setSelectedTournament(tournament);
    setShowCredentialsModal(true);
    setPasswordVisible(false);
  };
  const closeFeatureModal = () => {
    setShowFeatureModal(false);
    setFeatureModalTournament(null);
    setFeatureModalSearch('');
  };

  const getCredentialsText = useCallback((tournament) => {
    const baseUrl = window.location.origin;
    const loginUrl = `${baseUrl}/login/tournament-admin`;
    
    return `🎟️ Tournament Admin Credentials
───────────────────────────────
🏆 Tournament: ${tournament.name}
🏷️ Code: ${tournament.code}
👤 Username: ${tournament.adminId?.username || 'N/A'}
📧 Email: ${tournament.adminId?.email || 'N/A'}
🔑 Password: ${tournament.adminId?.plainPassword || 'N/A'}
🧩 Role: Tournament Admin
───────────────────────────────
🔗 Login Link: ${loginUrl}
───────────────────────────────
© PlayLive 2025`;
  }, []);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Credentials copied successfully!');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          showToast('Credentials copied successfully!');
        } else {
          showToast('Failed to copy credentials. Please try again.', 'error');
        }
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
        showToast('Failed to copy credentials. Please try again.', 'error');
      }
    }
  };

  const shareCredentials = async (tournament) => {
    const credentialsText = getCredentialsText(tournament);
    
    // Check if Web Share API is supported
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Admin Credentials - ${tournament.name}`,
          text: credentialsText,
        });
        showToast('Credentials shared successfully!');
      } catch (err) {
        // User cancelled or error occurred
        if (err.name !== 'AbortError') {
          console.error('Failed to share:', err);
          // Fallback to copy if share fails
          copyToClipboard(credentialsText);
        }
      }
    } else {
      // Fallback to copy if Web Share API is not supported
      showToast('Sharing not supported. Copying to clipboard instead.');
      copyToClipboard(credentialsText);
    }
  };

  const handleStatusChange = async (tournament, newStatus) => {
    // Validate user is SuperAdmin before proceeding
    if (!isSuperAdmin) {
      showToast('Only SuperAdmin can change tournament status', 'error');
      setEditingStatusFor(null);
      return;
    }

    if (updatingStatus) {
      return;
    }
    
    setUpdatingStatus(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showToast('Authentication token not found. Please login again.', 'error');
        setEditingStatusFor(null);
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login/super-admin';
        }, 2000);
        return;
      }

      // Verify user role from localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (currentUser.role !== 'SuperAdmin') {
        showToast('Your session has expired. Please login again as SuperAdmin.', 'error');
        setEditingStatusFor(null);
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login/super-admin';
        }, 2000);
        return;
      }

      const response = await axios.put(
        `${API_BASE_URL}/api/tournaments/${tournament.code}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        showToast(`Tournament status updated to ${newStatus}`);
        setEditingStatusFor(null);
        onTournamentSuccess(); // Refresh the tournaments list
      } else {
        showToast('Failed to update status', 'error');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update tournament status';
      const statusCode = error.response?.status;
      
      console.error('Error details:', {
        status: statusCode,
        statusText: error.response?.statusText,
        message: errorMessage,
        data: error.response?.data
      });

      // Show user-friendly error message
      if (statusCode === 401) {
        showToast('Your session has expired. Please login again.', 'error');
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login/super-admin';
        }, 2000);
      } else if (statusCode === 403) {
        // Check if it's a role issue or token issue
        if (errorMessage.includes('token') || errorMessage.includes('Invalid authentication')) {
          showToast('Authentication failed. Please login again.', 'error');
          setTimeout(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login/super-admin';
          }, 2000);
        } else {
          // It's a permission issue, not a token issue
          showToast(errorMessage || 'You do not have permission to change tournament status', 'error');
        }
      } else {
        showToast(errorMessage, 'error');
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusClick = (tournament, e) => {
    if (!isSuperAdmin) return;
    e.stopPropagation();
    setOpenStatusDropdown(openStatusDropdown === tournament._id ? null : tournament._id);
  };

  const handleStatusSelect = async (tournament, newStatus) => {
    if (!isSuperAdmin) return;
    setOpenStatusDropdown(null);
    await handleStatusChange(tournament, newStatus);
  };

  return (
    <div className="tournaments-page-v2 light-theme" style={{ width: '100%', minHeight: '100%' }}>
      {/* Hero Section - Sunlit Crystal Design */}
      <section className="tx-hero">
        <div className="tx-hero-inner">
          <div className="tx-hero-content">
            <div className="tx-hero-badge">
              <span className="tx-hero-badge-dot" />
              <span className="tx-hero-badge-text">Control Panel</span>
            </div>
            <h1 className="tx-hero-title">
              Tournament <span>Hub</span>
            </h1>
            <p className="tx-hero-subtitle">
              Manage all your tournaments in one place. Create, monitor, and configure events with ease.
            </p>
            <div className="tx-hero-actions">
              <button type="button" className="tx-btn tx-btn--primary" onClick={handleCreateTournament}>
                <span>+</span> New Tournament
              </button>
              <button type="button" className="tx-btn tx-btn--secondary" onClick={onTournamentSuccess}>
                <span>↻</span> Refresh
              </button>
              <button type="button" className="tx-btn tx-btn--ghost" onClick={exportToPDF}>
                <span>↓</span> Export
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Command Bar */}
      <section className="tx-command-bar">
        <div className="tx-command-bar-inner">
          <div className="tx-search-box">
            <span className="tx-search-icon">🔍</span>
            <input
              id="tournament-search"
              name="tournamentSearch"
              type="search"
              className="tx-search-input"
              placeholder="Search tournaments by name or code..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery ? (
              <button
                type="button"
                className="tx-btn tx-btn--ghost"
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', padding: '6px 12px' }}
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
              >
                ✕
              </button>
            ) : null}
          </div>
          
          {/* Status Pills */}
          <div className="tx-status-pills">
            {quickStatusSegments.map((segment) => (
              <button
                type="button"
                key={segment.id || 'all'}
                className={`tx-status-pill ${filters.status === segment.id ? 'active' : ''}`}
                onClick={() => handleStatusSegmentSelect(segment.id)}
              >
                <span>{segment.emoji}</span>
                <span>{segment.label}</span>
                <span className="tx-status-count">{segment.value}</span>
              </button>
            ))}
          </div>
          
          {/* Filter Dropdowns */}
          <div className="tx-filter-group">
            <select
              id="filter-sport"
              name="sport"
              className="tx-filter-select"
              value={filters.sport}
              onChange={(e) => updateFilters((prev) => ({ ...prev, sport: e.target.value }))}
            >
              <option value="">All sports</option>
              <option value="Cricket">Cricket</option>
              <option value="Football">Football</option>
              <option value="Volleyball">Volleyball</option>
              <option value="Basketball">Basketball</option>
            </select>
            <select
              id="filter-plan"
              name="plan"
              className="tx-filter-select"
              value={filters.plan}
              onChange={(e) => updateFilters((prev) => ({ ...prev, plan: e.target.value }))}
            >
              <option value="">All plans</option>
              {planFilterOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Export Actions */}
          <div className="tx-export-group">
            <button type="button" className="tx-export-btn" onClick={exportToExcel}>
              <span>⤓</span> CSV
            </button>
            <button type="button" className="tx-export-btn" onClick={exportToPDF}>
              <span>🖨</span> PDF
            </button>
          </div>
          
          {/* View Toggle */}
          <div className="tx-view-toggle">
            <button
              type="button"
              className={`tx-view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('table');
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem('tournamentsViewMode', 'table');
                }
              }}
            >
              ☰ Table
            </button>
            <button
              type="button"
              className={`tx-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('cards');
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem('tournamentsViewMode', 'cards');
                }
              }}
            >
              ▦ Cards
            </button>
          </div>
          
          <button type="button" className="tx-btn tx-btn--ghost" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </section>

      {/* Tournaments Grid/Table Section */}
      <section className="tx-tournament-grid-wrapper">
        <header className="tx-section-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '24px',
          padding: '16px 24px',
          background: 'var(--sl-bg-surface)',
          borderRadius: 'var(--sl-radius-lg)',
          border: '1px solid var(--sl-border-subtle)',
          boxShadow: 'var(--sl-shadow-sm)'
        }}>
          <div>
            <span style={{ 
              fontSize: '11px', 
              color: 'var(--sl-accent-primary)', 
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
              fontFamily: 'var(--sl-font-mono)'
            }}>Directory</span>
            <h3 style={{ 
              margin: '4px 0 0', 
              fontSize: '18px', 
              fontWeight: '700',
              color: 'var(--sl-text-primary)',
              fontFamily: 'var(--sl-font-display)'
            }}>All Tournaments</h3>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--sl-text-secondary)', fontWeight: '500' }}>
            {filteredTournaments.length
              ? `${paginationRange.from}-${paginationRange.to} of ${filteredTournaments.length}`
              : 'No tournaments'}
          </div>
        </header>

        {/* Legacy snapshots - hidden on new design */}
        <div style={{ display: 'none' }}>
        <article className="surface-card snapshot-card snapshot-card--plan">
          <header className="snapshot-card__header">
            <p className="snapshot-card__eyebrow">Tier coverage</p>
            <h4>Plan distribution</h4>
            <span>{tournamentStats.total ? `${tournamentStats.total} active tournaments` : 'No tournaments yet'}</span>
          </header>
          <div className="snapshot-card__body snapshot-card__body--stack">
            {tournamentStats.planDistribution.length ? (
              tournamentStats.planDistribution.map((item) => {
                const badgeClass = `plan-badge plan-${(item.plan || 'Standard').toLowerCase()}`;
                return (
                  <div key={item.plan} className="snapshot-bar">
                    <div className="snapshot-bar__meta">
                      <span className={badgeClass}>{item.label}</span>
                      <span>
                        {item.count} • {item.ratio}%
                      </span>
                    </div>
                    <div className="snapshot-bar__track">
                      <span style={{ width: `${Math.max(item.ratio, 6)}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="snapshot-card__empty">Add your first tournament to monitor plan split.</div>
            )}
          </div>
        </article>

        <article className="surface-card snapshot-card snapshot-card--sports">
          <header className="snapshot-card__header">
            <p className="snapshot-card__eyebrow">Sports mix</p>
            <h4>Top disciplines</h4>
            <span>{tournamentStats.sportBreakdown.length ? 'Leading sports by volume' : 'No sport data yet'}</span>
          </header>
          <div className="snapshot-card__body snapshot-card__body--stack">
            {tournamentStats.sportBreakdown.length ? (
              tournamentStats.sportBreakdown.map((item) => (
                <div key={item.sport} className="snapshot-bar snapshot-bar--accent">
                  <div className="snapshot-bar__meta">
                    <strong>{item.sport}</strong>
                    <span>
                      {item.count} • {item.ratio}%
                    </span>
                  </div>
                  <div className="snapshot-bar__track">
                    <span style={{ width: `${Math.max(item.ratio, 6)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <div className="snapshot-card__empty">
                As you launch tournaments across sports, you will see the distribution here.
              </div>
            )}
          </div>
        </article>

        <article className="surface-card snapshot-card snapshot-card--watch">
          <header className="snapshot-card__header">
            <p className="snapshot-card__eyebrow">Readiness radar</p>
            <h4>Deletion & governance</h4>
            <span>Monitor upcoming clean-ups</span>
          </header>
          <div className="snapshot-card__body snapshot-card__body--grid">
            <div className="snapshot-metric snapshot-metric--critical">
              <span>Critical</span>
              <strong>{autoDeleteStats.critical}</strong>
              <p>Deleting within 24h</p>
            </div>
            <div className="snapshot-metric snapshot-metric--warning">
              <span>Warning</span>
              <strong>{autoDeleteStats.warning}</strong>
              <p>Deletes in 3 days</p>
            </div>
            <div className="snapshot-metric snapshot-metric--info">
              <span>Info</span>
              <strong>{autoDeleteStats.info}</strong>
              <p>Less than a week</p>
            </div>
            <div className="snapshot-metric snapshot-metric--muted">
              <span>Disabled</span>
              <strong>{autoDeleteStats.disabled}</strong>
              <p>Manual retention</p>
            </div>
            <div className="snapshot-metric snapshot-metric--neutral">
              <span>Auction ready</span>
              <strong>{auctionReadyCount}</strong>
              <p>Auctions enabled</p>
            </div>
          </div>
        </article>

        <article className="surface-card snapshot-card snapshot-card--recent">
          <header className="snapshot-card__header">
            <p className="snapshot-card__eyebrow">Latest launches</p>
            <h4>Recently created</h4>
            <span>{tournamentStats.recent.length ? 'Fresh additions in the last rollout' : 'No recent tournaments'}</span>
          </header>
          <div className="snapshot-card__body snapshot-card__body--list">
            {tournamentStats.recent.length ? (
              <ul className="snapshot-list">
                {tournamentStats.recent.map((item) => {
                  const planClass = `plan-badge plan-${(normalizePlan(item.plan) || 'Standard').toLowerCase()}`;
                  return (
                    <li key={item._id || item.code} className="snapshot-list__item">
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {formatDate(item.createdAt)} • <span className={planClass}>{formatPlan(item.plan)}</span> •{' '}
                          {item.status || 'Status TBD'}
                        </span>
                      </div>
                      <button type="button" onClick={() => handleView(item.code)}>
                        Open
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="snapshot-card__empty">Create new tournaments to populate this launch tracker.</div>
            )}
          </div>
        </article>
        </div>
      </section>

      {/* Feature Access Modal */}
      {showFeatureModal && featureModalTournament && (() => {
        const tournament = featureModalTournament;
        const resolvedSet = new Set(getResolvedFeaturesForTournament(tournament));
        const defaultSet = new Set(getDefaultFeaturesForTournament(tournament));
        const overrides = getOverridesForTournament(tournament);
        const overrideEntries = Object.entries(overrides || {});
        const forcedOn = overrideEntries.filter(([, value]) => value === true).length;
        const forcedOff = overrideEntries.filter(([, value]) => value === false).length;

        const planKey = normalizePlan(tournament.plan);
        const planBadgeClass = `plan-badge plan-${(planKey || 'Standard').toLowerCase()} modal-plan-badge`;
        const visibleCategories = modalFeatureCategoryOrder.filter(
          (category) => (modalFilteredFeaturesByCategory[category] || []).length > 0
        );
        const totalVisibleFeatures = visibleCategories.reduce(
          (acc, category) => acc + (modalFilteredFeaturesByCategory[category] || []).length,
          0
        );
        const hasSearchTerm = featureModalSearch.trim().length > 0;
        const activeOverrides = forcedOn + forcedOff;
        const statusLabelMap = {
          tier: 'Tier default',
          'override-on': 'Forced on',
          'override-off': 'Forced off',
          'custom-on': 'Enabled',
          locked: 'Locked'
        };
        const statusIconMap = {
          tier: '🌟',
          'override-on': '⚡',
          'override-off': '⛔',
          'custom-on': '✅',
          locked: '🔒'
        };

        return (
          <div className="modal-overlay" onClick={closeFeatureModal}>
            <div className="feature-modal" onClick={(e) => e.stopPropagation()}>
              <button className="feature-modal__close" type="button" onClick={closeFeatureModal} aria-label="Close feature access modal">
                ✕
              </button>
              <div className="modal-header">
                <div className="feature-modal__header-grid">
                  <div className="feature-modal__title-block">
                    <span className="feature-modal__eyebrow">Feature Access</span>
                    <h3>{tournament.name}</h3>
                    <p>Explore the capabilities unlocked for this tournament.</p>
                  </div>
                  <div className="feature-modal__plan-block">
                    <span className={planBadgeClass}>{formatPlan(tournament.plan)}</span>
                    <span className="feature-modal__plan-meta">
                      {planKey === 'Custom' ? 'Custom configuration' : 'Plan powered features'}
                    </span>
                  </div>
                </div>
                <div className="feature-modal__summary">
                  <div className="feature-modal__metric">
                    <span className="feature-modal__metric-label">Available now</span>
                    <span className="feature-modal__metric-value">{resolvedSet.size}</span>
                    <span className="feature-modal__metric-caption">Total features resolved</span>
                  </div>
                  <div className="feature-modal__metric">
                    <span className="feature-modal__metric-label">Plan defaults</span>
                    <span className="feature-modal__metric-value">{defaultSet.size}</span>
                    <span className="feature-modal__metric-caption">Included with tier</span>
                  </div>
                  <div className="feature-modal__metric">
                    <span className="feature-modal__metric-label">Overrides</span>
                    <span className="feature-modal__metric-value">{activeOverrides}</span>
                    <span className="feature-modal__metric-caption">
                      {forcedOn} forced on • {forcedOff} forced off
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-body">
                <div className="feature-modal__toolbar">
                  <div className="feature-modal__search">
                    <span className="feature-modal__search-icon">🔍</span>
                    <input
                      id="feature-modal-search"
                      name="featureModalSearch"
                      type="search"
                      placeholder="Search features by name, category, or status..."
                      value={featureModalSearch}
                      onChange={(e) => setFeatureModalSearch(e.target.value)}
                    />
                    {featureModalSearch ? (
                      <button
                        type="button"
                        className="feature-modal__search-clear"
                        onClick={() => setFeatureModalSearch('')}
                        aria-label="Clear feature search"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <div className="feature-modal__toolbar-meta">
                    <span className="feature-modal__result-count">
                      {totalVisibleFeatures} {totalVisibleFeatures === 1 ? 'feature' : 'features'}
                      {hasSearchTerm ? ` match "${featureModalSearch.trim()}"` : ' available'}
                    </span>
                  </div>
                </div>
                <div className="feature-modal__legend">
                  <span className="legend-item legend-item--tier">Tier default</span>
                  <span className="legend-item legend-item--override-on">Forced on</span>
                  <span className="legend-item legend-item--override-off">Forced off</span>
                  <span className="legend-item legend-item--locked">Locked</span>
                </div>
                {visibleCategories.length === 0 ? (
                  <div className="feature-modal__empty-state">
                    <span className="feature-modal__empty-icon">🧐</span>
                    <p>No features match "{featureModalSearch.trim()}".</p>
                    <button type="button" onClick={() => setFeatureModalSearch('')}>
                      Reset search
                    </button>
                  </div>
                ) : (
                  visibleCategories.map((category) => (
                    <div key={category} className="feature-modal__category">
                      <div className="feature-modal__category-header">
                        <h4>{CATEGORY_LABELS[category] || category}</h4>
                        <span className="feature-modal__category-count">
                          {(modalFilteredFeaturesByCategory[category] || []).length}{' '}
                          {(modalFilteredFeaturesByCategory[category] || []).length === 1 ? 'feature' : 'features'}
                        </span>
                      </div>
                      <div className="feature-modal__list">
                        {(modalFilteredFeaturesByCategory[category] || []).map((featureId) => {
                          const feature = featureById[featureId] || {};
                          const overrideValue = overrides[featureId];
                          const status =
                            overrideValue === true
                              ? 'override-on'
                              : overrideValue === false
                                ? 'override-off'
                                : defaultSet.has(featureId)
                                  ? 'tier'
                                  : resolvedSet.has(featureId)
                                    ? 'custom-on'
                                    : 'locked';
                          const statusChipClass = `feature-modal__status-chip feature-modal__status-chip--${status}`;
                          const statusIcon = statusIconMap[status] || '⚙️';
                          return (
                            <div key={featureId} className={`feature-modal__item feature-modal__item--${status}`}>
                              <div className="feature-modal__item-main">
                                <span className="feature-modal__icon">{FEATURE_ICON_MAP[featureId] || '⚙️'}</span>
                                <div className="feature-modal__meta">
                                  <span className="feature-modal__name">{feature.name || featureId}</span>
                                  {feature.description ? (
                                    <span className="feature-modal__description">{feature.description}</span>
                                  ) : null}
                                  {featureId === 'auction_pro_multi_seat' ? (
                                    <a 
                                      href="/auction-pro-seats/participate" 
                                      className="feature-modal__participation-link"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Participate in Auction Pro Seats →
                                    </a>
                                  ) : null}
                                </div>
                              </div>
                              <span className={statusChipClass}>
                                <span className="feature-modal__status-icon">{statusIcon}</span>
                                {statusLabelMap[status]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="modal-actions">
                <button className="btn-close-modal" onClick={closeFeatureModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Credentials Modal - Modern Redesign */}
      {showCredentialsModal && selectedTournament && (
        <div className="modal-overlay credentials-overlay-v3" onClick={() => {
          setShowCredentialsModal(false);
          setPasswordVisible(false);
        }}>
          <div className="credentials-modal-v3" onClick={(e) => e.stopPropagation()}>
            {/* Header Section */}
            <div className="credentials-header-v3">
              <div className="credentials-header-content-v3">
                <div className="credentials-icon-container-v3">
                  <div className="credentials-icon-wrapper-v3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="https://www.w3.org/2000/svg">
                      <path d="M12 2C9.24 2 7 4.24 7 7V9H5C3.9 9 3 9.9 3 11V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V11C21 9.9 20.1 9 19 9H17V7C17 4.24 14.76 2 12 2ZM12 4C13.66 4 15 5.34 15 7V9H9V7C9 5.34 10.34 4 12 4ZM19 20H5V11H19V20Z" fill="currentColor"/>
                      <path d="M12 14C10.9 14 10 14.9 10 16C10 17.1 10.9 18 12 18C13.1 18 14 17.1 14 16C14 14.9 13.1 14 12 14Z" fill="currentColor"/>
                    </svg>
                  </div>
                  <div className="credentials-title-group-v3">
                    <h2 className="credentials-title-v3">Admin Credentials</h2>
                    <p className="credentials-subtitle-v3">Secure access information for tournament administration</p>
                  </div>
                </div>
                <button 
                  className="credentials-close-btn-v3"
                  onClick={() => {
                    setShowCredentialsModal(false);
                    setPasswordVisible(false);
                  }}
                  aria-label="Close modal"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Body Section */}
            <div className="credentials-body-v3">
              {/* Tournament Info Card */}
              <div className="credentials-card-v3 tournament-card">
                <div className="card-header-v3">
                  <div className="card-icon-wrapper-v3 tournament-icon-bg">
                    <span className="card-icon-v3">🏆</span>
                  </div>
                  <div className="card-header-text-v3">
                    <h3 className="card-title-v3">Tournament Information</h3>
                    <p className="card-description-v3">Basic tournament details</p>
                  </div>
                </div>
                <div className="card-content-v3">
                  <div className="credential-field-v3">
                    <label className="field-label-v3">
                      <span className="field-icon-v3">🏆</span>
                      Tournament Name
                    </label>
                    <div className="field-value-wrapper-v3">
                      <span className="field-value-v3">{selectedTournament.name}</span>
                      <button
                        className="field-action-btn-v3"
                        onClick={() => copyToClipboard(selectedTournament.name)}
                        title="Copy tournament name"
                        aria-label="Copy tournament name"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M6 6.5H4.5C3.67157 6.5 3 7.17157 3 8V14C3 14.8284 3.67157 15.5 4.5 15.5H10.5C11.3284 15.5 12 14.8284 12 14V12.5M6 6.5C6 5.67157 6.67157 5 7.5 5H9.5C10.3284 5 11 5.67157 11 6.5V7.5C11 8.32843 10.3284 9 9.5 9H7.5C6.67157 9 6 8.32843 6 7.5V6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="credential-field-v3">
                    <label className="field-label-v3">
                      <span className="field-icon-v3">🏷️</span>
                      Tournament Code
                    </label>
                    <div className="field-value-wrapper-v3">
                      <span className="field-value-v3 code-value-v3">{selectedTournament.code}</span>
                      <button
                        className="field-action-btn-v3"
                        onClick={() => copyToClipboard(selectedTournament.code)}
                        title="Copy tournament code"
                        aria-label="Copy tournament code"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M6 6.5H4.5C3.67157 6.5 3 7.17157 3 8V14C3 14.8284 3.67157 15.5 4.5 15.5H10.5C11.3284 15.5 12 14.8284 12 14V12.5M6 6.5C6 5.67157 6.67157 5 7.5 5H9.5C10.3284 5 11 5.67157 11 6.5V7.5C11 8.32843 10.3284 9 9.5 9H7.5C6.67157 9 6 8.32843 6 7.5V6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Access Credentials Card */}
              <div className="credentials-card-v3 access-card">
                <div className="card-header-v3">
                  <div className="card-icon-wrapper-v3 access-icon-bg">
                    <span className="card-icon-v3">🔐</span>
                  </div>
                  <div className="card-header-text-v3">
                    <h3 className="card-title-v3">Access Credentials</h3>
                    <p className="card-description-v3">Login information for admin access</p>
                  </div>
                </div>
                <div className="card-content-v3">
                  <div className="credential-field-v3">
                    <label className="field-label-v3">
                      <span className="field-icon-v3">👤</span>
                      Username
                    </label>
                    <div className="field-value-wrapper-v3">
                      <span className="field-value-v3">{selectedTournament.adminId?.username || 'N/A'}</span>
                      <button
                        className="field-action-btn-v3"
                        onClick={() => copyToClipboard(selectedTournament.adminId?.username || 'N/A')}
                        title="Copy username"
                        aria-label="Copy username"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M6 6.5H4.5C3.67157 6.5 3 7.17157 3 8V14C3 14.8284 3.67157 15.5 4.5 15.5H10.5C11.3284 15.5 12 14.8284 12 14V12.5M6 6.5C6 5.67157 6.67157 5 7.5 5H9.5C10.3284 5 11 5.67157 11 6.5V7.5C11 8.32843 10.3284 9 9.5 9H7.5C6.67157 9 6 8.32843 6 7.5V6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="credential-field-v3">
                    <label className="field-label-v3">
                      <span className="field-icon-v3">📧</span>
                      Email Address
                    </label>
                    <div className="field-value-wrapper-v3">
                      <span className="field-value-v3">{selectedTournament.adminId?.email || 'N/A'}</span>
                      <button
                        className="field-action-btn-v3"
                        onClick={() => copyToClipboard(selectedTournament.adminId?.email || 'N/A')}
                        title="Copy email"
                        aria-label="Copy email"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M6 6.5H4.5C3.67157 6.5 3 7.17157 3 8V14C3 14.8284 3.67157 15.5 4.5 15.5H10.5C11.3284 15.5 12 14.8284 12 14V12.5M6 6.5C6 5.67157 6.67157 5 7.5 5H9.5C10.3284 5 11 5.67157 11 6.5V7.5C11 8.32843 10.3284 9 9.5 9H7.5C6.67157 9 6 8.32843 6 7.5V6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="credential-field-v3 password-field-v3">
                    <label className="field-label-v3">
                      <span className="field-icon-v3">🔑</span>
                      Password
                    </label>
                    <div className="field-value-wrapper-v3">
                      <span className={`field-value-v3 password-value-v3 ${!passwordVisible ? 'password-hidden-v3' : ''}`}>
                        {passwordVisible ? (selectedTournament.adminId?.plainPassword || 'N/A') : '••••••••••••'}
                      </span>
                      <div className="password-actions-v3">
                        <button
                          type="button"
                          className="field-action-btn-v3 password-toggle-btn-v3"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPasswordVisible(!passwordVisible);
                          }}
                          title={passwordVisible ? 'Hide password' : 'Show password'}
                          aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                        >
                          {passwordVisible ? (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                              <path d="M9 3.375C5.0625 3.375 2.4375 5.4375 0.75 9C2.4375 12.5625 5.0625 14.625 9 14.625C12.9375 14.625 15.5625 12.5625 17.25 9C15.5625 5.4375 12.9375 3.375 9 3.375ZM9 12.375C7.34375 12.375 6 11.0313 6 9.375C6 7.71875 7.34375 6.375 9 6.375C10.6563 6.375 12 7.71875 12 9.375C12 11.0313 10.6563 12.375 9 12.375ZM9 7.875C8.17188 7.875 7.5 8.54688 7.5 9.375C7.5 10.2031 8.17188 10.875 9 10.875C9.82813 10.875 10.5 10.2031 10.5 9.375C10.5 8.54688 9.82813 7.875 9 7.875Z" fill="currentColor"/>
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                              <path d="M1.05563 8.25C2.17688 5.71875 4.80625 3.375 9 3.375C13.1938 3.375 15.8231 5.71875 16.9444 8.25C15.8231 10.7813 13.1938 13.125 9 13.125C4.80625 13.125 2.17688 10.7813 1.05563 8.25ZM9 10.125C10.6563 10.125 12 8.78125 12 7.125C12 5.46875 10.6563 4.125 9 4.125C7.34375 4.125 6 5.46875 6 7.125C6 8.78125 7.34375 10.125 9 10.125ZM3.9375 2.25L2.25 3.9375L14.0625 15.75L15.75 14.0625L3.9375 2.25Z" fill="currentColor"/>
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          className="field-action-btn-v3"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copyToClipboard(selectedTournament.adminId?.plainPassword || 'N/A');
                          }}
                          title="Copy password"
                          aria-label="Copy password"
                        >
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M6 6.5H4.5C3.67157 6.5 3 7.17157 3 8V14C3 14.8284 3.67157 15.5 4.5 15.5H10.5C11.3284 15.5 12 14.8284 12 14V12.5M6 6.5C6 5.67157 6.67157 5 7.5 5H9.5C10.3284 5 11 5.67157 11 6.5V7.5C11 8.32843 10.3284 9 9.5 9H7.5C6.67157 9 6 8.32843 6 7.5V6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="credential-field-v3">
                    <label className="field-label-v3">
                      <span className="field-icon-v3">🧩</span>
                      Role
                    </label>
                    <div className="field-value-wrapper-v3">
                      <span className="role-badge-v3">Tournament Admin</span>
                    </div>
                  </div>
                  <div className="credential-field-v3 login-link-field-v3">
                    <label className="field-label-v3">
                      <span className="field-icon-v3">🔗</span>
                      Login Link
                    </label>
                    <div className="field-value-wrapper-v3 login-link-wrapper-v3">
                      <span className="field-value-v3 login-link-value-v3">{window.location.origin}/login/tournament-admin</span>
                      <button
                        className="field-action-btn-v3"
                        onClick={() => copyToClipboard(`${window.location.origin}/login/tournament-admin`)}
                        title="Copy login link"
                        aria-label="Copy login link"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M6 6.5H4.5C3.67157 6.5 3 7.17157 3 8V14C3 14.8284 3.67157 15.5 4.5 15.5H10.5C11.3284 15.5 12 14.8284 12 14V12.5M6 6.5C6 5.67157 6.67157 5 7.5 5H9.5C10.3284 5 11 5.67157 11 6.5V7.5C11 8.32843 10.3284 9 9.5 9H7.5C6.67157 9 6 8.32843 6 7.5V6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <a
                        href={`${window.location.origin}/login/tournament-admin`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="field-action-btn-v3 login-link-btn-v3"
                        title="Open login page in new tab"
                        aria-label="Open login page"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M15 3H11M15 3V7M15 3L9 9M6 3H3C2.44772 3 2 3.44772 2 4V15C2 15.5523 2.44772 16 3 16H14C14.5523 16 15 15.5523 15 15V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Information Card */}
              {selectedTournament.createdAt && (
                <div className="credentials-card-v3 account-card">
                  <div className="card-header-v3">
                    <div className="card-icon-wrapper-v3 account-icon-bg">
                      <span className="card-icon-v3">⏰</span>
                    </div>
                    <div className="card-header-text-v3">
                      <h3 className="card-title-v3">Account Information</h3>
                      <p className="card-description-v3">Account creation details</p>
                    </div>
                  </div>
                  <div className="card-content-v3">
                    <div className="credential-field-v3">
                      <label className="field-label-v3">
                        <span className="field-icon-v3">📅</span>
                        Created On
                      </label>
                      <div className="field-value-wrapper-v3">
                        <span className="field-value-v3">
                          {new Date(selectedTournament.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Section */}
            <div className="credentials-footer-v3">
              <button
                className="btn-copy-all-v3"
                onClick={() => copyToClipboard(getCredentialsText(selectedTournament))}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7 7.5H5.5C4.67157 7.5 4 8.17157 4 9V15.5C4 16.3284 4.67157 17 5.5 17H11.5C12.3284 17 13 16.3284 13 15.5V14M7 7.5C7 6.67157 7.67157 6 8.5 6H10.5C11.3284 6 12 6.67157 12 7.5V8.5C12 9.32843 11.3284 10 10.5 10H8.5C7.67157 10 7 9.32843 7 8.5V7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Copy All Credentials</span>
              </button>
              <button
                className="btn-share-v3"
                onClick={() => shareCredentials(selectedTournament)}
                title="Share credentials"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 13.3333C14.4249 13.3333 13.8889 13.525 13.4778 13.8444L7.62222 10.7111C7.68056 10.4833 7.72222 10.25 7.72222 10C7.72222 9.75 7.68056 9.51667 7.62222 9.28889L13.4222 6.2C13.8611 6.53333 14.4111 6.73333 15 6.73333C16.3833 6.73333 17.5 5.61667 17.5 4.23333C17.5 2.85 16.3833 1.73333 15 1.73333C13.6167 1.73333 12.5 2.85 12.5 4.23333C12.5 4.48333 12.5417 4.71667 12.6 4.94444L6.8 8.03333C6.36111 7.7 5.81111 7.5 5.22222 7.5C3.83889 7.5 2.72222 8.61667 2.72222 10C2.72222 11.3833 3.83889 12.5 5.22222 12.5C5.81111 12.5 6.36111 12.3 6.8 11.9667L12.6556 15.1C12.5972 15.3167 12.5556 15.5389 12.5556 15.7667C12.5556 17.1167 13.65 18.2111 15 18.2111C16.35 18.2111 17.4444 17.1167 17.4444 15.7667C17.4444 14.4167 16.35 13.3222 15 13.3222L15 13.3333Z" fill="currentColor"/>
                </svg>
                <span>Share</span>
              </button>
              <button 
                className="btn-close-v3" 
                onClick={() => {
                  setShowCredentialsModal(false);
                  setPasswordVisible(false);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tournaments Data Display */}
        {loading ? (
          <div className="tx-loading">
            <div className="tx-spinner" />
            <span className="tx-loading-text">Loading your tournaments...</span>
          </div>
        ) : !paginatedTournaments.length ? (
          <div className="tx-empty-state">
            <span className="tx-empty-icon">🏆</span>
            <h3 className="tx-empty-title">No tournaments yet</h3>
            <p className="tx-empty-text">Get started by creating your first tournament or adjust your filters.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button type="button" className="tx-btn tx-btn--primary" onClick={handleCreateTournament}>
                + Create Tournament
              </button>
              <button type="button" className="tx-btn tx-btn--secondary" onClick={resetFilters}>
                Clear Filters
              </button>
            </div>
          </div>
        ) : (
          <>
            {viewMode === 'table' && (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th
                        className="table-heading-cell"
                        onClick={() =>
                          setSortConfig({
                            key: 'name',
                            direction:
                              sortConfig.key === 'name' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                          })
                        }
                      >
                        <div className="table-heading">
                          <span className="table-heading__label">
                            Tournament {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </span>
                          <span className="table-heading__hint">Codes, sport & alerts</span>
                        </div>
                      </th>
                      <th
                        className="table-heading-cell"
                        onClick={() =>
                          setSortConfig({
                            key: 'plan',
                            direction:
                              sortConfig.key === 'plan' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                          })
                        }
                      >
                        <div className="table-heading">
                          <span className="table-heading__label">
                            Experience {sortConfig.key === 'plan' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </span>
                          <span className="table-heading__hint">Plan & mode</span>
                        </div>
                      </th>
                      <th
                        className="table-heading-cell"
                        onClick={() =>
                          setSortConfig({
                            key: 'location',
                            direction:
                              sortConfig.key === 'location' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                          })
                        }
                      >
                        <div className="table-heading">
                          <span className="table-heading__label">
                            Operations {sortConfig.key === 'location' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </span>
                          <span className="table-heading__hint">Region, teams & timeline</span>
                        </div>
                      </th>
                      <th
                        className="table-heading-cell table-heading-cell--narrow"
                        onClick={() =>
                          setSortConfig({
                            key: 'status',
                            direction:
                              sortConfig.key === 'status' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                          })
                        }
                      >
                        <div className="table-heading">
                          <span className="table-heading__label">
                            Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                          </span>
                          <span className="table-heading__hint">Tap to change</span>
                        </div>
                      </th>
                      {isSuperAdmin && (
                        <th
                          className="table-heading-cell table-heading-cell--narrow"
                          onClick={() =>
                            setSortConfig({
                              key: 'auction',
                              direction:
                                sortConfig.key === 'auction' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                            })
                          }
                        >
                          <div className="table-heading">
                            <span className="table-heading__label">
                              Auction {sortConfig.key === 'auction' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </span>
                            <span className="table-heading__hint">Live readiness</span>
                          </div>
                        </th>
                      )}
                      <th className="table-heading-cell table-heading-cell--actions">
                        <div className="table-heading">
                          <span className="table-heading__label">Actions</span>
                          <span className="table-heading__hint">Deep links & utilities</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTournaments.map((t) => {
                      const rowKey = t._id || t.code;
                      const planBadgeClass = `plan-${(normalizePlan(t.plan) || 'Standard').toLowerCase()}`;
                      const tournamentModeMeta = getTournamentModeDetails(t);
                      const createdLabel = formatDate(t.createdAt);
                      const updatedLabel = t.updatedAt ? formatDate(t.updatedAt) : null;
                      const autoDeleteInfo = getAutoDeleteInfo(t, systemSettings);
                      const autoDeleteChipLabel = (() => {
                        if (!autoDeleteInfo?.countdown) return null;
                        if (autoDeleteInfo.countdown === 'Disabled') return 'Auto delete off';
                        if (autoDeleteInfo.countdown === 'Overdue') return 'Auto delete overdue';
                        return `${autoDeleteInfo.countdown} left`;
                      })();
                      const autoDeleteTone =
                        autoDeleteInfo?.alert ||
                        (autoDeleteInfo?.countdown === 'Disabled' ? 'muted' : null) ||
                        'info';
                      const locationLabel = t.location || t.city || 'Not shared';
                      const teamCount =
                        typeof t.participatingTeams === 'number'
                          ? t.participatingTeams
                          : Array.isArray(t.teams)
                          ? t.teams.length
                          : null;
                      const teamLabel = typeof teamCount === 'number' ? teamCount : 'N/A';
                      const timelineLabel = formatTimeline(t.startDate, t.endDate);

                      return (
                        <tr 
                          key={rowKey}
                          data-dropdown-open={
                            openStatusDropdown === t._id || 
                            openAuctionDropdown === t._id || 
                            openActionsDropdown === t._id
                          }
                        >
                          <td>
                            <div className="table-primary-block">
                              <div className="table-primary-block__top">
                                <span className="table-code-chip">{t.code || '—'}</span>
                                <span className="table-chip table-chip--sport">{t.sport || 'Not set'}</span>
                              </div>
                              <span className="table-primary-block__title">{t.name || 'Untitled tournament'}</span>
                              <div className="table-primary-block__meta">
                                <span className="table-code-caption">
                                  {createdLabel === 'Not set' ? 'Created date pending' : `Created ${createdLabel}`}
                                </span>
                                <div className="table-name-cell__meta">
                                  {updatedLabel && (
                                    <span className="table-meta-chip table-meta-chip--muted">
                                      Last update {updatedLabel}
                                    </span>
                                  )}
                                  {autoDeleteChipLabel && (
                                    <span className={`table-meta-chip table-meta-chip--${autoDeleteTone}`}>
                                      ⏱ {autoDeleteChipLabel}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="table-experience">
                              <div className="table-plan-cell">
                                <span className={`plan-badge ${planBadgeClass}`} title={formatPlan(t.plan)}>
                                  {formatPlan(t.plan)}
                                </span>
                                <span className="table-plan-caption">{normalizePlan(t.plan || 'Standard')}</span>
                              </div>
                              <div className="table-mode-cell">
                                <span className={`mode-pill mode-pill--${tournamentModeMeta.tone}`}>
                                  <span className="mode-pill__icon" aria-hidden="true">
                                    {tournamentModeMeta.icon}
                                  </span>
                                  {tournamentModeMeta.label}
                                </span>
                                {tournamentModeMeta.hint && (
                                  <span className="mode-pill__hint">{tournamentModeMeta.hint}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="table-ops-grid">
                              <div className="table-labeled-value">
                                <span className="table-labeled-value__label">Primary</span>
                                <span className="table-labeled-value__value">{locationLabel}</span>
                              </div>
                              <div className="table-labeled-value">
                                <span className="table-labeled-value__label">Teams</span>
                                <span className="table-labeled-value__value">{teamLabel}</span>
                              </div>
                              <div className="table-labeled-value">
                                <span className="table-labeled-value__label">Timeline</span>
                                <span className="table-labeled-value__value">{timelineLabel}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            {isSuperAdmin ? (
                              <div className="status-dropdown-container" style={{ position: 'relative' }}>
                                <button
                                  type="button"
                                  className="status-dropdown-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusClick(t, e);
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    backgroundColor:
                                      t.status === 'Active'
                                        ? 'rgba(16, 185, 129, 0.1)'
                                        : t.status === 'Upcoming'
                                          ? 'rgba(234, 179, 8, 0.1)'
                                          : t.status === 'Completed'
                                            ? 'rgba(148, 163, 184, 0.1)'
                                            : 'rgba(239, 68, 68, 0.1)',
                                    color:
                                      t.status === 'Active'
                                        ? '#10b981'
                                        : t.status === 'Upcoming'
                                          ? '#eab308'
                                          : t.status === 'Completed'
                                            ? '#94a3b8'
                                            : '#ef4444',
                                    border: `1px solid ${
                                      t.status === 'Active'
                                        ? 'rgba(16, 185, 129, 0.3)'
                                        : t.status === 'Upcoming'
                                          ? 'rgba(234, 179, 8, 0.3)'
                                          : t.status === 'Completed'
                                            ? 'rgba(148, 163, 184, 0.3)'
                                            : 'rgba(239, 68, 68, 0.3)'
                                    }`,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  title="Change Status"
                                >
                                  <span>
                                    {t.status === 'Active' && '🟢 Active'}
                                    {t.status === 'Upcoming' && '🟡 Upcoming'}
                                    {t.status === 'Completed' && '⚪ Completed'}
                                    {t.status === 'End' && '🔴 End'}
                                  </span>
                                  <span style={{ fontSize: '10px' }}>{openStatusDropdown === t._id ? '▲' : '▼'}</span>
                                </button>
                                {openStatusDropdown === t._id && (
                                  <div className="status-dropdown-menu">
                                    <button
                                      type="button"
                                      className={`status-dropdown-item ${
                                        t.status === 'Upcoming' ? 'status-dropdown-item--active' : ''
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStatusSelect(t, 'Upcoming');
                                      }}
                                    >
                                      🟡 Upcoming
                                    </button>
                                    <button
                                      type="button"
                                      className={`status-dropdown-item ${
                                        t.status === 'Active' ? 'status-dropdown-item--active' : ''
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStatusSelect(t, 'Active');
                                      }}
                                    >
                                      🟢 Active
                                    </button>
                                    <button
                                      type="button"
                                      className={`status-dropdown-item ${
                                        t.status === 'End' ? 'status-dropdown-item--active' : ''
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStatusSelect(t, 'End');
                                      }}
                                    >
                                      🔴 End
                                    </button>
                                    <button
                                      type="button"
                                      className={`status-dropdown-item ${
                                        t.status === 'Completed' ? 'status-dropdown-item--active' : ''
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStatusSelect(t, 'Completed');
                                      }}
                                    >
                                      ⚪ Completed
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className={`status-badge ${t.status.toLowerCase()}`}>
                                {t.status === 'Active' && '🟢 Active'}
                                {t.status === 'Upcoming' && '🟡 Upcoming'}
                                {t.status === 'Completed' && '⚪ Completed'}
                                {t.status === 'End' && '🔴 End'}
                              </span>
                            )}
                          </td>
                          {isSuperAdmin && (
                            <td>
                              <div className="auction-dropdown-container" style={{ position: 'relative' }}>
                                <button
                                  type="button"
                                  className="auction-dropdown-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAuctionDropdown(openAuctionDropdown === t._id ? null : t._id);
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    backgroundColor:
                                      t.auctionEnabled !== false ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    color: t.auctionEnabled !== false ? '#10b981' : '#ef4444',
                                    border: `1px solid ${
                                      t.auctionEnabled !== false
                                        ? 'rgba(16, 185, 129, 0.3)'
                                        : 'rgba(239, 68, 68, 0.3)'
                                    }`,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  title="Auction Actions"
                                >
                                  <span>{t.auctionEnabled !== false ? '🟢 ENABLED' : '🔴 DISABLED'}</span>
                                  <span style={{ fontSize: '10px' }}>{openAuctionDropdown === t._id ? '▲' : '▼'}</span>
                                </button>
                                {openAuctionDropdown === t._id && (
                                  <div className="auction-dropdown-menu">
                                    <button
                                      type="button"
                                      className="auction-dropdown-item"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/tournament/${t.code}/auction`);
                                        setOpenAuctionDropdown(null);
                                      }}
                                    >
                                      🔥 Live Auction Room
                                    </button>
                                    <button
                                      type="button"
                                      className="auction-dropdown-item"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(`/auction/${t.code}`, '_blank');
                                        setOpenAuctionDropdown(null);
                                      }}
                                    >
                                      👁️ Public Auction View
                                    </button>
                                    <button
                                      type="button"
                                      className="auction-dropdown-item"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/auction-results/${t.code}`);
                                        setOpenAuctionDropdown(null);
                                      }}
                                    >
                                      📊 Auction Results
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          )}
                          <td style={{ position: 'relative', overflow: 'visible' }}>
                            <div
                              className="actions-dropdown-container"
                              style={{ position: 'relative', zIndex: openActionsDropdown === t._id ? 10001 : 'auto' }}
                            >
                              <button
                                type="button"
                                className="actions-dropdown-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionsDropdown(openActionsDropdown === t._id ? null : t._id);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                  color: '#2563eb',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                title="Actions"
                              >
                                <span>⚙️ Actions</span>
                                <span style={{ fontSize: '10px' }}>{openActionsDropdown === t._id ? '▲' : '▼'}</span>
                              </button>
                              {openActionsDropdown === t._id && (
                                <div
                                  className="actions-dropdown-menu"
                                  style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', zIndex: 10002 }}
                                >
                                  <button
                                    type="button"
                                    className="actions-dropdown-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleView(t.code);
                                      setOpenActionsDropdown(null);
                                    }}
                                  >
                                    👁️ View
                                  </button>
                                  <button
                                    type="button"
                                    className="actions-dropdown-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(t.code);
                                      setOpenActionsDropdown(null);
                                    }}
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="actions-dropdown-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCredentials(t);
                                      setOpenActionsDropdown(null);
                                    }}
                                  >
                                    🧑‍💻 Credentials
                                  </button>
                                  <button
                                    type="button"
                                    className="actions-dropdown-item actions-dropdown-item--danger"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(t._id);
                                      setOpenActionsDropdown(null);
                                    }}
                                  >
                                    🗑️ Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {viewMode === 'cards' && (
              <div className="tx-tournament-grid">
                {paginatedTournaments.map((t) => {
                  const cardKey = t._id || t.code;
                  const tierClass = `tx-card-tier--${(normalizePlan(t.plan) || 'lite').toLowerCase()}`;
                  const statusClass = `tx-card-status--${(t.status || 'upcoming').toLowerCase()}`;
                  const logoUrl = buildTournamentLogoUrl(t.logo);
                  const fallbackInitial = (t.name || t.code || 'T').toString().trim().charAt(0).toUpperCase() || 'T';
                  const teamCount = typeof t.participatingTeams === 'number' ? t.participatingTeams : Array.isArray(t.teams) ? t.teams.length : 0;
                  const timelineLabel = formatTimeline(t.startDate, t.endDate);

                  return (
                    <article key={cardKey} className="tx-tournament-card">
                      {/* Visual Header */}
                      <div className="tx-card-visual">
                        <div className="tx-card-visual-content">
                          <div className="tx-card-badges">
                            <span className={`tx-card-tier ${tierClass}`}>{formatPlan(t.plan)}</span>
                            <span className={`tx-card-status ${statusClass}`}>{t.status || 'Upcoming'}</span>
                          </div>
                          <div className="tx-card-identity">
                            <div className="tx-card-logo">
                              {logoUrl ? (
                                <img src={logoUrl} alt={t.name} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                              ) : null}
                              <span style={{ display: logoUrl ? 'none' : 'flex' }}>{fallbackInitial}</span>
                            </div>
                            <div className="tx-card-name-group">
                              <h3 className="tx-card-name">{t.name}</h3>
                              <span className="tx-card-code">#{t.code}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Card Body */}
                      <div className="tx-card-body">
                        <div className="tx-card-stats">
                          <div className="tx-card-stat">
                            <span className="tx-card-stat-value">{teamCount}</span>
                            <span className="tx-card-stat-label">Teams</span>
                          </div>
                          <div className="tx-card-stat">
                            <span className="tx-card-stat-value">{t.sport?.charAt(0) || '—'}</span>
                            <span className="tx-card-stat-label">Sport</span>
                          </div>
                          <div className="tx-card-stat">
                            <span className="tx-card-stat-value">{t.auctionEnabled !== false ? '✓' : '—'}</span>
                            <span className="tx-card-stat-label">Auction</span>
                          </div>
                          <div className="tx-card-stat">
                            <span className="tx-card-stat-value">{getTournamentModeDetails(t)?.icon || '⚡'}</span>
                            <span className="tx-card-stat-label">Mode</span>
                          </div>
                        </div>
                        
                        <div className="tx-card-meta">
                          <span className="tx-card-meta-item">
                            <span className="tx-card-meta-icon">📍</span>
                            {t.location || 'Location TBD'}
                          </span>
                          <span className="tx-card-meta-item">
                            <span className="tx-card-meta-icon">📅</span>
                            {timelineLabel}
                          </span>
                        </div>
                        
                        <div className="tx-card-actions">
                          <button
                            type="button"
                            className="tx-card-btn tx-card-btn--primary"
                            onClick={() => handleView(t.code)}
                          >
                            Open Dashboard
                          </button>
                          <button
                            type="button"
                            className="tx-card-btn tx-card-btn--secondary"
                            onClick={() => handleEdit(t.code)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="tx-card-btn tx-card-btn--icon"
                            onClick={() => handleDelete(t._id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {/* Legacy Card View - Hidden */}
            {viewMode === 'cards-legacy' && (
              <div className="admin-card-grid" style={{ display: 'none' }}>
                {paginatedTournaments.map((t) => {
                  const cardKey = t._id || t.code;
                  const planBadgeClass = `plan-${(normalizePlan(t.plan) || 'Standard').toLowerCase()}`;
                  const resolvedFeatureIds = getResolvedFeaturesForTournament(t);
                  const topFeatures = resolvedFeatureIds.slice(0, 4).map((featureId) => ({
                    id: featureId,
                    name: featureById[featureId]?.name || featureId,
                    icon: FEATURE_ICON_MAP[featureId] || '✅'
                  }));
                  const remainingFeatureCount = Math.max(resolvedFeatureIds.length - topFeatures.length, 0);
                  const logoUrl = buildTournamentLogoUrl(t.logo);
                  const fallbackInitial = (t.name || t.code || 'T').toString().trim().charAt(0).toUpperCase() || 'T';
                  const autoDeleteInfo = getAutoDeleteInfo(t, systemSettings);

                  return (
                    <div key={cardKey} className="tournament-card tournament-card--board">
                      <div className="tournament-card__top">
                        <div
                          className={`tournament-card__logo ${logoUrl ? 'has-logo' : 'is-fallback'}`}
                          title={`${t.name || 'Tournament'} logo`}
                        >
                          <span aria-hidden="true">{fallbackInitial}</span>
                          {logoUrl && (
                            <img
                              src={logoUrl}
                              alt={`${t.name || 'Tournament'} logo`}
                              onError={(e) => {
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  parent.classList.remove('has-logo');
                                  parent.classList.add('is-fallback');
                                }
                                e.currentTarget.remove();
                              }}
                            />
                          )}
                        </div>
                        <div className="tournament-card__header-info">
                          <div className="tournament-card__title-row">
                            <h4>{t.name}</h4>
                            <div className="status-cell">
                              {editingStatusFor === t._id && isSuperAdmin ? (
                                <select
                                  id={`status-select-card-${t._id}`}
                                  name={`status-card-${t._id}`}
                                  className="status-select-inline"
                                  value={t.status}
                                  onChange={(e) => handleStatusChange(t, e.target.value)}
                                  onBlur={() => setEditingStatusFor(null)}
                                  autoFocus
                                  disabled={updatingStatus}
                                >
                                  <option value="Upcoming">🟡 Upcoming</option>
                                  <option value="Active">🟢 Active</option>
                                  <option value="End">🔴 End</option>
                                  <option value="Completed">⚪ Completed</option>
                                </select>
                              ) : (
                                <span
                                  className={`status-badge ${t.status.toLowerCase()} ${isSuperAdmin ? 'status-clickable' : ''}`}
                                  onClick={(e) => handleStatusClick(t, e)}
                                  title={isSuperAdmin ? 'Click to change status' : ''}
                                >
                                  {t.status === 'Active' && '🟢 Active'}
                                  {t.status === 'Upcoming' && '🟡 Upcoming'}
                                  {t.status === 'Completed' && '⚪ Completed'}
                                  {t.status === 'End' && '🔴 End'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="tournament-card__meta-row">
                            <span className="tournament-card__code">#{t.code}</span>
                            <span className={`plan-badge ${planBadgeClass}`}>{formatPlan(t.plan)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="tournament-card__details">
                        <div className="tournament-card__detail-item">
                          <span className="tournament-card__detail-label">Sport</span>
                          <span className="tournament-card__detail-value">{t.sport || 'N/A'}</span>
                        </div>
                        <div className="tournament-card__detail-item">
                          <span className="tournament-card__detail-label">Teams</span>
                          <span className="tournament-card__detail-value">{t.participatingTeams || 'N/A'}</span>
                        </div>
                        <div className="tournament-card__detail-item">
                          <span className="tournament-card__detail-label">Location</span>
                          <span className="tournament-card__detail-value">{t.location || 'N/A'}</span>
                        </div>
                        <div className="tournament-card__detail-item">
                          <span className="tournament-card__detail-label">Timeline</span>
                          <span className="tournament-card__detail-value">
                            {t.startDate
                              ? new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : 'N/A'}
                            {' - '}
                            {t.endDate
                              ? new Date(t.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : 'N/A'}
                          </span>
                        </div>
                        {isSuperAdmin && autoDeleteInfo.countdown && (
                          <div className="tournament-card__detail-item">
                            <span className="tournament-card__detail-label">Auto Delete</span>
                            <span
                              className="tournament-card__detail-value"
                              style={{
                                color:
                                  autoDeleteInfo.alert === 'critical'
                                    ? '#dc2626'
                                    : autoDeleteInfo.alert === 'warning'
                                      ? '#d97706'
                                      : autoDeleteInfo.alert === 'info'
                                        ? '#2563eb'
                                        : '#6b7280',
                                fontWeight: '600'
                              }}
                            >
                              {autoDeleteInfo.countdown === 'Disabled'
                                ? 'Disabled'
                                : autoDeleteInfo.countdown === 'Overdue'
                                  ? '⚠️ Overdue'
                                  : `🗑️ ${autoDeleteInfo.countdown}`}
                              {autoDeleteInfo.alert && autoDeleteInfo.daysRemaining <= 7 && (
                                <span style={{ display: 'block', fontSize: '11px', marginTop: '2px' }}>
                                  {autoDeleteInfo.daysRemaining <= 1
                                    ? '⚠️ Deletes tomorrow'
                                    : autoDeleteInfo.daysRemaining <= 3
                                      ? '⚠️ Deletes soon'
                                      : `⚠️ Deletes in ${autoDeleteInfo.daysRemaining} days`}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                      {topFeatures.length > 0 && (
                        <div className="tournament-card__features">
                          <div className="tournament-card__features-list">
                            {topFeatures.map((feature) => (
                              <span key={feature.id} className="feature-chip">
                                <span className="chip-icon">{feature.icon}</span>
                                {feature.name}
                              </span>
                            ))}
                            {remainingFeatureCount > 0 && (
                              <span className="feature-chip feature-chip--more">+{remainingFeatureCount}</span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="tournament-card__actions">
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleView(t.code);
                          }} 
                          className="btn-action btn-view" 
                          title="View"
                        >
                          👁️
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(t.code);
                          }} 
                          className="btn-action btn-edit" 
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(t._id);
                          }} 
                          className="btn-action btn-delete" 
                          title="Delete"
                        >
                          🗑️
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCredentials(t);
                          }}
                          className="btn-action btn-credentials"
                          title="Credentials"
                        >
                          🧑‍💻
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {!loading && totalPages > 1 && (
          <div className="tx-pagination">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="tx-page-btn"
            >
              ← Previous
            </button>
            <span className="tx-page-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="tx-page-btn"
            >
              Next →
            </button>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="tx-pagination">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="tx-page-btn"
            >
              ← Previous
            </button>
            <span className="tx-page-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="tx-page-btn"
            >
              Next →
            </button>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="tx-pagination">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="tx-page-btn"
            >
              ← Previous
            </button>
            <span className="tx-page-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="tx-page-btn"
            >
              Next →
            </button>
          </div>
        )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification toast-${toast.tone || 'success'}`} style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '16px 24px',
          background: toast.tone === 'error' ? 'rgba(239, 68, 68, 0.95)' : toast.tone === 'warning' ? 'rgba(245, 158, 11, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          color: 'white',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: '600'
        }}>
          <span>
            {toast.tone === 'error' ? '❌' : toast.tone === 'warning' ? '⚠️' : '✅'}
          </span>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default TournamentsTab;
