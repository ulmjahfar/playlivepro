import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ImageUploadCrop from './components/ImageUploadCrop';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-dashboard.css';
import './styles-tournament-create.css';
import './styles-tournament-edit.css';

function TournamentEdit({ isPageMode = false, onClose }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    plan: 'Standard',
    featureOverrides: {},
    name: '',
    sport: '',
    startDate: '',
    endDate: '',
    isOneDayTournament: false,
    location: '',
    logo: '',
    registrationStartDate: '',
    registrationEndDate: '',
    participatingTeams: 8,
    minPlayers: 11,
    maxPlayers: 16,
    playerPoolSize: 128,
    playerRegistrationEnabled: false,
    teamRegistrationEnabled: false,
    basePrice: 1000,
    maxFundForTeam: 0,
    auctionType: 'slab',
    fixedIncrement: 100,
    bidLimitMode: 'limit',
    bidLimitCount: 5,
    maxRounds: 1,
    ranges: [{ from: 0, to: 1000, increment: 100 }]
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [tierConfigs, setTierConfigs] = useState([]);
  const [featureDefinitions, setFeatureDefinitions] = useState([]);
  const [featureLoading, setFeatureLoading] = useState(true);
  const [featureError, setFeatureError] = useState('');
  const [initialAllowedFeatures, setInitialAllowedFeatures] = useState([]);
  const [initialFormState, setInitialFormState] = useState(null);

  const steps = useMemo(() => [
    {
      id: 0,
      title: 'Plan & Features',
      subtitle: 'Choose the tournament tier and adjust access',
      icon: '🏟️'
    },
    {
      id: 1,
      title: 'Tournament Basics',
      subtitle: 'Update name, branding, schedule, and location',
      icon: '🗓️'
    },
    {
      id: 2,
      title: 'Teams & Registration',
      subtitle: 'Control squad sizes and registration links',
      icon: '👥'
    },
    {
      id: 3,
      title: 'Auction Settings',
      subtitle: 'Fine-tune bidding rules, budgets, and slabs',
      icon: '📊'
    }
  ], []);

  const categoryLabels = useMemo(() => ({
    TournamentManagement: 'Tournament Management',
    Registration: 'Registration',
    Auction: 'Auction',
    Finance: 'Finance',
    Reports: 'Reports',
    Analytics: 'Analytics',
    Notifications: 'Notifications',
    Broadcast: 'Broadcast',
    Branding: 'Branding',
    AdminTools: 'Admin Tools'
  }), []);

  const tierFeatureMap = useMemo(() => {
    const map = {};
    tierConfigs.forEach((tier) => {
      map[tier.tier] = Array.isArray(tier.features) ? tier.features : [];
    });
    return map;
  }, [tierConfigs]);

  const tierMetadataMap = useMemo(() => {
    const map = {};
    tierConfigs.forEach((tier) => {
      map[tier.tier] = tier.metadata || {};
    });
    return map;
  }, [tierConfigs]);

  const featureById = useMemo(() => {
    const map = {};
    featureDefinitions.forEach((feature) => {
      map[feature.id] = feature;
    });
    return map;
  }, [featureDefinitions]);

  const resolvedFeatures = useMemo(() => {
    const defaults = tierFeatureMap[formData.plan] || [];
    const resolved = new Set(defaults);
    const overrides = formData.featureOverrides || {};
    Object.entries(overrides).forEach(([featureId, isEnabled]) => {
      if (isEnabled) {
        resolved.add(featureId);
      } else {
        resolved.delete(featureId);
      }
    });
    if (resolved.size === 0 && initialAllowedFeatures.length > 0) {
      return initialAllowedFeatures;
    }
    return Array.from(resolved);
  }, [formData.featureOverrides, formData.plan, tierFeatureMap, initialAllowedFeatures]);

  const resolvedFeatureSet = useMemo(() => new Set(resolvedFeatures), [resolvedFeatures]);

  const overrideCount = useMemo(
    () => Object.keys(formData.featureOverrides || {}).length,
    [formData.featureOverrides]
  );

  const formatPlanLabel = useCallback((value) => {
    if (!value) return 'Standard';
    return value;
  }, []);

  const handlePlanSelect = (plan) => {
    setFormData((prev) => ({
      ...prev,
      plan,
      featureOverrides: {}
    }));
  };

  const handleOverrideToggle = (featureId, enabled) => {
    setFormData((prev) => {
      const baseFeatures = new Set(tierFeatureMap[prev.plan] || []);
      const overrides = { ...(prev.featureOverrides || {}) };
      const defaultEnabled = baseFeatures.has(featureId);

      if (enabled === defaultEnabled) {
        delete overrides[featureId];
      } else {
        overrides[featureId] = enabled;
      }

      return {
        ...prev,
        featureOverrides: Object.keys(overrides).length ? overrides : {}
      };
    });
  };

  const resetOverrides = () => {
    setFormData((prev) => ({
      ...prev,
      featureOverrides: {}
    }));
  };

  const renderPlanManager = () => {
    const planOptions = ['Standard', 'AuctionPro'];
    const baseFeatures = tierFeatureMap[formData.plan] || [];
    const groupedFeatures = featureDefinitions.reduce((acc, feature) => {
      const key = feature.category || 'Uncategorized';
      if (!acc[key]) acc[key] = [];
      acc[key].push(feature);
      return acc;
    }, {});
    const hasFeatureCatalog = Object.keys(groupedFeatures).length > 0;

    return (
      <>
        {featureLoading ? (
          <div className="tier-loading">Loading tier options…</div>
        ) : featureError ? (
          <div className="tier-error">{featureError}</div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="tournament-plan">Tournament Plan *</label>
              <select 
                id="tournament-plan"
                name="plan" 
                value={formData.plan} 
                onChange={(e) => handlePlanSelect(e.target.value)}
                className={errors.plan ? 'has-error' : ''}
              >
                {planOptions.map((plan) => {
                  const info = tierMetadataMap[plan] || {};
                  return (
                    <option key={plan} value={plan}>
                      {formatPlanLabel(plan)} - {info.description || 
                        (plan === 'Standard'
                          ? 'Premium broadcast, automation, and analytics package'
                          : 'Maximum PlayLive power with broadcast')}
                    </option>
                  );
                })}
              </select>
              {errors.plan && <span className="field-error">{errors.plan}</span>}
            </div>

            <div className="tier-summary-panel">
              <div className="tier-summary-header">
                <div>
                  <h3>Feature Summary</h3>
                  <p>Plan defaults plus any overrides you apply.</p>
                </div>
                <div className="tier-summary-plan">
                  <span className="tier-chip">{formatPlanLabel(formData.plan)}</span>
                  {overrideCount > 0 && (
                    <span className="tier-summary-overrides">
                      {overrideCount} override{overrideCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="tier-feature-tags">
                {resolvedFeatures.length ? (
                  resolvedFeatures.map((featureId) => (
                    <span key={featureId} className="feature-tag">
                      {featureById[featureId]?.name || featureId}
                    </span>
                  ))
                ) : (
                  <span className="feature-tag muted">No features selected</span>
                )}
              </div>
            </div>

            <div className="tier-overrides-panel">
              <div className="tier-overrides-header">
                <div>
                  <h3>Feature Overrides (Super Admin only)</h3>
                  <p>Instantly add or remove capabilities for this specific tournament.</p>
                </div>
                <button type="button" className="ghost-btn" onClick={resetOverrides} disabled={overrideCount === 0}>
                  Reset overrides
                </button>
              </div>

              {!hasFeatureCatalog ? (
                <div className="tier-empty-state">
                  <p>No feature catalog available. Add features from System Settings → Feature Management.</p>
                </div>
              ) : (
                Object.keys(groupedFeatures).sort().map((category) => {
                  const features = groupedFeatures[category];
                  return (
                    <div key={category} className="override-category-block">
                      <div className="override-category-header">
                        <h4>{categoryLabels[category] || category}</h4>
                        <span>{features.length} feature{features.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="override-grid">
                        {features.map((feature) => {
                          const isEnabled = resolvedFeatureSet.has(feature.id);
                          const overrides = formData.featureOverrides || {};
                          const hasOverride = Object.prototype.hasOwnProperty.call(overrides, feature.id);
                          const overrideState = hasOverride ? (overrides[feature.id] ? 'forced-on' : 'forced-off') : 'default';
                          const defaultEnabled = baseFeatures.includes(feature.id);
                          const helperText = overrideState === 'default'
                            ? defaultEnabled ? 'Included in plan' : 'Locked in plan'
                            : overrideState === 'forced-on'
                              ? 'Override: enabled'
                              : 'Override: disabled';

                          return (
                            <label
                              key={feature.id}
                              className={`feature-toggle ${isEnabled ? 'enabled' : 'disabled'} ${overrideState !== 'default' ? 'custom' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) => handleOverrideToggle(feature.id, e.target.checked)}
                              />
                              <div>
                                <span className="feature-toggle-name">{feature.name}</span>
                                <small>{helperText}</small>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </>
    );
  };

  const formatDateShort = useCallback((value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  const formatDateRange = useCallback(
    (start, end) => {
      const startLabel = formatDateShort(start);
      const endLabel = formatDateShort(end);
      if (startLabel && endLabel) return `${startLabel} → ${endLabel}`;
      if (startLabel) return `Starts ${startLabel}`;
      if (endLabel) return `Ends ${endLabel}`;
      return 'Dates TBD';
    },
    [formatDateShort]
  );

  const formatRelativeTime = useCallback((value) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const diff = Date.now() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  }, []);

  // Authentication check with browser back button protection
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (!token || !storedUser) {
        navigate('/login/super-admin', { replace: true });
        return false;
      }
      
      try {
        const parsedUser = JSON.parse(storedUser);
        // Check if user is SuperAdmin (required for editing tournaments)
        const normalizedRole = (parsedUser.role || '').toString().trim().replace(/[\s_]/g, '').toLowerCase();
        if (normalizedRole !== 'superadmin') {
          navigate('/login/super-admin', { replace: true });
          return false;
        }
        return true;
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login/super-admin', { replace: true });
        return false;
      }
    };

    // Check on mount
    if (!checkAuth()) {
      return;
    }

    // Handle browser back/forward cache (bfcache) restoration
    const handlePageShow = (e) => {
      // e.persisted is true when page is restored from bfcache
      if (e.persisted) {
        checkAuth();
      }
    };

    // Handle when window regains focus (user switches tabs/apps)
    const handleFocus = () => {
      checkAuth();
    };

    // Handle visibility changes (tab switching)
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

  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.get(`${API_BASE_URL}/api/tournaments/${id}`, { headers });
        const tournamentData = response.data.tournament;
        setTournament(tournamentData);

        let plan = tournamentData.plan || 'Standard';
        let overridesPayload = tournamentData.featureOverrides || {};

        try {
          const featureResponse = await axios.get(
            `${API_BASE_URL}/api/tournaments/${id}/features`,
            { headers }
          );
          const featureData = featureResponse.data || {};
          if (featureData.plan) plan = featureData.plan;
          if (featureData.overrides) overridesPayload = featureData.overrides;
          if (Array.isArray(featureData.allowedFeatures)) {
            setInitialAllowedFeatures(featureData.allowedFeatures);
          }
        } catch (featureErr) {
          console.warn('Unable to fetch tournament feature map', featureErr);
        }

        const normalizedOverrides = {};
        if (overridesPayload && typeof overridesPayload === 'object') {
          Object.entries(overridesPayload).forEach(([key, value]) => {
            normalizedOverrides[key] = Boolean(value);
          });
        }

        const incomingBidMode =
          tournamentData.auctionRules?.bidLimitMode ||
          (tournamentData.auctionRules?.maxBidsPerPlayer ? 'limit' : 'unlimited');
        const incomingBidCount =
          tournamentData.auctionRules?.bidLimitCount ??
          tournamentData.auctionRules?.maxBidsPerPlayer ??
          5;

        // Pre-populate form data
        const initialState = {
          plan,
          featureOverrides: normalizedOverrides,
          name: tournamentData.name || '',
          sport: tournamentData.sport || '',
          startDate: tournamentData.startDate ? tournamentData.startDate.split('T')[0] : '',
          endDate: tournamentData.endDate ? tournamentData.endDate.split('T')[0] : '',
          isOneDayTournament: tournamentData.startDate && tournamentData.endDate && tournamentData.startDate.split('T')[0] === tournamentData.endDate.split('T')[0],
          location: tournamentData.location || '',
          logo: tournamentData.logo || '',
          registrationStartDate: tournamentData.registrationStartDate ? tournamentData.registrationStartDate.split('T')[0] : '',
          registrationEndDate: tournamentData.registrationEndDate ? tournamentData.registrationEndDate.split('T')[0] : '',
          participatingTeams: tournamentData.participatingTeams || 8,
          minPlayers: tournamentData.minPlayers || 11,
          maxPlayers: tournamentData.maxPlayers || Math.max(tournamentData.minPlayers || 11, 16),
          playerPoolSize: tournamentData.playerPoolSize || (tournamentData.participatingTeams || 8) * (tournamentData.minPlayers || 11),
          playerRegistrationEnabled: tournamentData.playerRegistrationEnabled || false,
          teamRegistrationEnabled: tournamentData.teamRegistrationEnabled || false,
          basePrice: tournamentData.basePrice || 1000,
          maxFundForTeam: tournamentData.auctionRules?.maxFundForTeam || 0,
          auctionType: tournamentData.auctionRules?.type || 'slab',
          fixedIncrement: tournamentData.auctionRules?.fixedIncrement || 100,
          bidLimitMode: incomingBidMode === 'unlimited' ? 'unlimited' : 'limit',
          bidLimitCount: incomingBidCount,
          maxRounds: tournamentData.auctionState?.maxRounds || 1,
          ranges: tournamentData.auctionRules?.ranges || [{ from: 0, to: 1000, increment: 100 }]
        };

        setFormData(initialState);
        setInitialFormState(initialState);
        setStep(0);
      } catch (err) {
        console.error('Error fetching tournament:', err);
        
        // Log detailed error information for debugging
        if (err.response) {
          console.error('Response status:', err.response.status);
          console.error('Response data:', err.response.data);
          console.error('Response headers:', err.response.headers);
        } else if (err.request) {
          console.error('Request made but no response received:', err.request);
        } else {
          console.error('Error setting up request:', err.message);
        }
        
        // Provide user-friendly error message based on error type
        if (err.response?.status === 500) {
          setError('Server error: The server encountered an issue while loading tournament details. Please check the server logs or contact support.');
        } else if (err.response?.status === 404) {
          setError('Tournament not found. Please verify the tournament code is correct.');
        } else if (err.response?.status === 401 || err.response?.status === 403) {
          setError('Authentication failed. Please log in again.');
          setTimeout(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/login/super-admin');
          }, 2000);
        } else if (err.response?.data?.message) {
          setError(`Failed to load tournament: ${err.response.data.message}`);
        } else {
          setError('Failed to load tournament details. Please check your connection and try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTournament();
  }, [id, navigate]);

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem('token');
    if (!token) {
      setFeatureLoading(false);
      return;
    }

    const loadTierData = async () => {
      setFeatureLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [definitionsRes, tiersRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/features/definitions`, { headers }),
          axios.get(`${API_BASE_URL}/api/features/tier-configs`, { headers })
        ]);

        if (!isMounted) return;
        setFeatureDefinitions(definitionsRes.data.features || []);
        setTierConfigs(tiersRes.data.tiers || []);
        setFeatureError('');
      } catch (err) {
        console.error('Failed to load tier configuration', err);
        if (isMounted) {
          setFeatureError('Unable to load tier data. Feature overrides may be unavailable.');
        }
      } finally {
        if (isMounted) {
          setFeatureLoading(false);
        }
      }
    };

    loadTierData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let processedValue = type === 'checkbox' ? checked : value;

    // Auto-capitalize tournament name
    if (name === 'name') {
      processedValue = value.toUpperCase();
    }

    // Auto-capitalize venue location (title case)
    if (name === 'location') {
      processedValue = value.replace(/\b\w/g, l => l.toUpperCase());
    }

    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: processedValue
      };

      // If one day tournament is checked, sync end date with start date
      if (name === 'isOneDayTournament' && checked && prev.startDate) {
        updated.endDate = prev.startDate;
      } else if (name === 'startDate' && prev.isOneDayTournament) {
        updated.endDate = processedValue;
      }

      return updated;
    });
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (name === 'bidLimitMode' && processedValue === 'unlimited' && errors.bidLimitCount) {
      setErrors(prev => ({ ...prev, bidLimitCount: '' }));
    }
  };

  const handleLogoUploadComplete = (result) => {
    // result can be a string URL (from onComplete) or an object (from onUploadComplete)
    const logoUrl = typeof result === 'string' ? result : (result?.url || result?.file);
    if (logoUrl) {
      setFormData(prev => ({ ...prev, logo: logoUrl }));
      // Clear any existing error for logo field
      setErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors.logo) delete newErrors.logo;
        return newErrors;
      });
    }
  };

  const handleRangeChange = (index, field, value) => {
    const newRanges = [...formData.ranges];
    newRanges[index][field] = parseInt(value) || 0;
    setFormData(prev => ({ ...prev, ranges: newRanges }));
  };

  const addRange = () => {
    if (formData.ranges.length < 10) {
      setFormData(prev => ({
        ...prev,
        ranges: [...prev.ranges, { from: 0, to: 0, increment: 100 }]
      }));
    }
  };

  const removeRange = (index) => {
    if (formData.ranges.length > 1) {
      setFormData(prev => ({
        ...prev,
        ranges: prev.ranges.filter((_, i) => i !== index)
      }));
    }
  };

  const validateStep = (stepIndex) => {
    const newErrors = {};

    if (stepIndex === 0) {
      if (!formData.plan) newErrors.plan = 'Select a plan';
    } else if (stepIndex === 1) {
      if (!formData.name.trim()) newErrors.name = 'Tournament name is required';
      if (!formData.sport) newErrors.sport = 'Sport type is required';
      // Validate logo - check for both empty string and falsy values, but allow existing tournament logos
      if (!formData.logo || (typeof formData.logo === 'string' && formData.logo.trim() === '')) {
        newErrors.logo = 'Tournament logo is required';
      }
    } else if (stepIndex === 2) {
      if (formData.participatingTeams < 2) newErrors.participatingTeams = 'Minimum 2 teams required';
      if (formData.minPlayers < 1) newErrors.minPlayers = 'Minimum players must be at least 1';
      if (formData.maxPlayers < formData.minPlayers) newErrors.maxPlayers = 'Maximum players must be greater than minimum players';
      if (formData.playerPoolSize < formData.participatingTeams * formData.minPlayers) {
        newErrors.playerPoolSize = 'Player pool must cover all teams\' minimum squad size';
      }
    } else if (stepIndex === 3) {
      if (formData.basePrice < 0) newErrors.basePrice = 'Base Value of Player must be positive';
      if (formData.maxFundForTeam < 0) newErrors.maxFundForTeam = 'Max fund must be positive';
      if (formData.bidLimitMode === 'limit' && formData.bidLimitCount < 1) {
        newErrors.bidLimitCount = 'Enter how many bids a player can receive';
      }
      if (formData.auctionType === 'straight' && formData.fixedIncrement <= 0) {
        newErrors.fixedIncrement = 'Fixed increment must be positive';
      }
      if (formData.auctionType === 'slab') {
        // Check for overlapping ranges
        const sortedRanges = [...formData.ranges].sort((a, b) => a.from - b.from);
        for (let i = 0; i < sortedRanges.length - 1; i++) {
          if (sortedRanges[i].to >= sortedRanges[i + 1].from) {
            newErrors.ranges = 'Auction ranges cannot overlap';
            break;
          }
        }
        // Check if ranges cover from 0 upwards
        if (sortedRanges[0]?.from !== 0) {
          newErrors.ranges = 'First range must start from ₹0';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goToNextStep = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, steps.length - 1));
      window.scrollTo(0, 0);
    }
  };

  const goToPreviousStep = () => {
    setStep(prev => Math.max(prev - 1, 0));
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    if (!validateStep(step)) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      let submitData;

      const isUnlimitedBid = formData.bidLimitMode === 'unlimited';
      const numericBidCount = isUnlimitedBid ? null : Number(formData.bidLimitCount) || 0;

      // Always send JSON - logo is now a URL string (uploaded via uploadPath)
      submitData = {
        name: formData.name,
        sport: formData.sport,
        startDate: formData.startDate,
        endDate: formData.endDate,
        location: formData.location,
        registrationStartDate: formData.registrationStartDate,
        registrationEndDate: formData.registrationEndDate,
        participatingTeams: formData.participatingTeams,
        minPlayers: formData.minPlayers,
        maxPlayers: formData.maxPlayers,
        playerPoolSize: formData.playerPoolSize,
        playerRegistrationEnabled: formData.playerRegistrationEnabled,
        teamRegistrationEnabled: formData.teamRegistrationEnabled,
        basePrice: formData.basePrice,
        maxFundForTeam: formData.maxFundForTeam,
        auctionType: formData.auctionType,
        fixedIncrement: formData.fixedIncrement,
        auctionRules: {
          type: formData.auctionType,
          fixedIncrement: formData.fixedIncrement,
          ranges: formData.ranges,
          baseValueOfPlayer: formData.basePrice,
          maxFundForTeam: formData.maxFundForTeam,
          bidLimitMode: formData.bidLimitMode,
          bidLimitCount: numericBidCount,
          maxBidsPerPlayer: numericBidCount,
        },
        plan: formData.plan,
        featureOverrides: formData.featureOverrides,
        auctionState: {
          maxRounds: formData.maxRounds || 1
        },
      };

      // Include logo URL if it exists (uploaded via ImageUploadCrop)
      if (formData.logo) {
        submitData.logo = formData.logo;
      }

      const response = await axios.put(
        `${API_BASE_URL}/api/tournaments/${id}`,
        submitData,
        { headers }
      );

      if (response.data.success) {
        alert('Tournament updated successfully!');
        navigate('/dashboard/superadmin');
      }
    } catch (error) {
      console.error('Error updating tournament:', error);
      alert('Error updating tournament: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const totalMinPlayers = formData.participatingTeams * formData.minPlayers;
  const totalMaxPlayers = formData.participatingTeams * formData.maxPlayers;

  const logoInitialUrl = useMemo(() => {
    const logoPath = tournament?.logo;
    if (!logoPath) return null;
    if (logoPath.startsWith('http')) return logoPath;
    if (logoPath.startsWith('/')) return `${API_BASE_URL}${logoPath}`;
    return `${API_BASE_URL}/${logoPath}`;
  }, [tournament]);

  const sidebarSummary = useMemo(() => [
    { label: 'Plan', value: formatPlanLabel(formData.plan) },
    { label: 'Tournament code', value: tournament?.code || '—' },
    { label: 'Sport', value: formData.sport || '—' },
    { label: 'Teams', value: formData.participatingTeams || '—' },
    { label: 'Registration', value: formatDateRange(formData.registrationStartDate, formData.registrationEndDate) },
    {
      label: 'Budget / team',
      value: formData.maxFundForTeam > 0 ? `₹${Number(formData.maxFundForTeam).toLocaleString()}` : '—'
    }
  ], [
    formData.plan,
    formData.sport,
    formData.participatingTeams,
    formData.registrationStartDate,
    formData.registrationEndDate,
    formData.maxFundForTeam,
    formatPlanLabel,
    formatDateRange,
    tournament?.code
  ]);

  const progressPercent = Math.round(((step + 1) / steps.length) * 100);
  const isLastStep = step === steps.length - 1;

  const resetFormToInitial = () => {
    if (initialFormState) {
      setFormData(initialFormState);
      setErrors({});
      setStep(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderBasicsStep = () => (
    <section className="form-section">
      <div className="section-header">
        <h2>Tournament Basics</h2>
        <p>Foundation details for the event.</p>
      </div>
      <div className="section-body">
        <div className="step-grid">
          <div className={`field ${errors.name ? 'has-error' : ''}`}>
            <label htmlFor="tournament-name">Tournament name *</label>
            <input
              id="tournament-name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="KERALA PREMIER LEAGUE"
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className={`field ${errors.sport ? 'has-error' : ''}`}>
            <label htmlFor="sport">Sport *</label>
            <select id="sport" name="sport" value={formData.sport} onChange={handleInputChange}>
              <option value="">Select sport</option>
              <option value="Cricket">Cricket</option>
              <option value="Football">Football</option>
              <option value="Volleyball">Volleyball</option>
              <option value="Basketball">Basketball</option>
            </select>
            {errors.sport && <span className="field-error">{errors.sport}</span>}
          </div>
          <div className="field span-2">
            <label className="switch-field">
              <input
                type="checkbox"
                name="isOneDayTournament"
                checked={formData.isOneDayTournament}
                onChange={handleInputChange}
              />
              <span className="switch-label">One day tournament</span>
            </label>
          </div>
          <div className="field">
            <label htmlFor="start-date">Start date</label>
            <div className="date-input-wrapper">
              <input
                id="start-date"
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                className="date-input"
              />
              <span className="date-icon">📅</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="end-date">End date</label>
            <div className="date-input-wrapper">
              <input
                id="end-date"
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                className="date-input"
                disabled={formData.isOneDayTournament}
                min={formData.startDate || undefined}
              />
              <span className="date-icon">📅</span>
            </div>
            {formData.isOneDayTournament && (
              <small className="field-hint" style={{ marginTop: '0.25rem' }}>
                End date is same as start date for one day tournament
              </small>
            )}
          </div>
          <div className="field span-2">
            <label htmlFor="location">Venue</label>
            <input
              id="location"
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="Jawaharlal Nehru Stadium"
            />
          </div>
          <div className={`field span-2 ${errors.logo ? 'has-error' : ''}`}>
            <label>Tournament logo *</label>
            <ImageUploadCrop
              uploadType="tournamentLogo"
              aspect={1}
              maxSizeMB={1}
              placeholder="Upload & crop tournament logo"
              uploadPath={`${API_BASE_URL}/api/tournaments/upload-logo`}
              onComplete={handleLogoUploadComplete}
              onError={(err) => setErrors((prev) => ({ ...prev, logo: err }))}
              initialImage={logoInitialUrl}
            />
            {errors.logo && <span className="field-error">{errors.logo}</span>}
          </div>
          <div className="field">
            <label htmlFor="reg-start">Registration start</label>
            <div className="date-input-wrapper">
              <input
                id="reg-start"
                type="date"
                name="registrationStartDate"
                value={formData.registrationStartDate}
                onChange={handleInputChange}
                className="date-input"
              />
              <span className="date-icon">📅</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="reg-end">Registration end</label>
            <div className="date-input-wrapper">
              <input
                id="reg-end"
                type="date"
                name="registrationEndDate"
                value={formData.registrationEndDate}
                onChange={handleInputChange}
                className="date-input"
                min={formData.registrationStartDate || undefined}
              />
              <span className="date-icon">📅</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const renderTeamsStep = () => (
    <section className="form-section">
      <div className="section-header">
        <h2>Team & Registration</h2>
        <p>Control how many teams participate and how they join.</p>
      </div>
      <div className="section-body">
        <div className="step-grid">
          <div className={`field ${errors.participatingTeams ? 'has-error' : ''}`}>
            <label htmlFor="teams">Participating teams *</label>
            <input
              id="teams"
              type="number"
              name="participatingTeams"
              value={formData.participatingTeams}
              onChange={handleInputChange}
              min="2"
              max="100"
            />
            {errors.participatingTeams && <span className="field-error">{errors.participatingTeams}</span>}
          </div>
          <div className={`field ${errors.minPlayers ? 'has-error' : ''}`}>
            <label htmlFor="min-players">Minimum players per team *</label>
            <input
              id="min-players"
              type="number"
              name="minPlayers"
              value={formData.minPlayers}
              onChange={handleInputChange}
              min="1"
            />
            {errors.minPlayers && <span className="field-error">{errors.minPlayers}</span>}
          </div>
          <div className={`field ${errors.maxPlayers ? 'has-error' : ''}`}>
            <label htmlFor="max-players">Maximum players per team *</label>
            <input
              id="max-players"
              type="number"
              name="maxPlayers"
              value={formData.maxPlayers}
              onChange={handleInputChange}
              min={formData.minPlayers}
            />
            {errors.maxPlayers && <span className="field-error">{errors.maxPlayers}</span>}
          </div>
          <div className="field">
            <label>Squad size range (auto)</label>
            <input
              type="text"
              value={`${totalMinPlayers} - ${totalMaxPlayers} players`}
              readOnly
              className="readonly"
            />
          </div>
          <div className={`field ${errors.playerPoolSize ? 'has-error' : ''}`}>
            <label htmlFor="player-pool">Total player pool *</label>
            <input
              id="player-pool"
              type="number"
              name="playerPoolSize"
              value={formData.playerPoolSize}
              onChange={handleInputChange}
              min={totalMinPlayers}
            />
            <p className="field-hint">Needs enough registered players to cover all teams' minimum squad sizes.</p>
            {errors.playerPoolSize && <span className="field-error">{errors.playerPoolSize}</span>}
          </div>
          <div className="switch-field">
            <label className="switch">
              <input
                type="checkbox"
                name="teamRegistrationEnabled"
                checked={formData.teamRegistrationEnabled}
                onChange={handleInputChange}
              />
              <span className="slider" />
            </label>
            <div>
              <strong>Enable team registration link</strong>
              <p>Generate a public link for teams to apply.</p>
            </div>
          </div>
          <div className="switch-field">
            <label className="switch">
              <input
                type="checkbox"
                name="playerRegistrationEnabled"
                checked={formData.playerRegistrationEnabled}
                onChange={handleInputChange}
              />
              <span className="slider" />
            </label>
            <div>
              <strong>Enable player registration link</strong>
              <p>Allow individual players to register directly.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const renderAuctionStep = () => (
    <section className="form-section">
      <div className="section-header">
        <h2>Auction Settings</h2>
        <p>Define how team budgets and bidding work.</p>
      </div>
      <div className="section-body">
        <div className="step-grid">
          <div className={`field ${errors.basePrice ? 'has-error' : ''}`}>
            <label htmlFor="base-price">Base Value of Player (₹) *</label>
            <input
              id="base-price"
              type="number"
              name="basePrice"
              value={formData.basePrice}
              onChange={handleInputChange}
              min="0"
            />
            {errors.basePrice && <span className="field-error">{errors.basePrice}</span>}
          </div>
          <div className={`field ${errors.maxFundForTeam ? 'has-error' : ''}`}>
            <label htmlFor="max-fund">Max fund per team (₹) *</label>
            <input
              id="max-fund"
              type="number"
              name="maxFundForTeam"
              value={formData.maxFundForTeam}
              onChange={handleInputChange}
              min="1"
            />
            {errors.maxFundForTeam && <span className="field-error">{errors.maxFundForTeam}</span>}
          </div>
          <div className={`field span-2 ${errors.bidLimitCount ? 'has-error' : ''}`}>
            <label>Bids allowed per player *</label>
            <div className="bid-limit-options">
              <label className="bid-limit-option">
                <input
                  type="radio"
                  name="bidLimitMode"
                  value="limit"
                  checked={formData.bidLimitMode === 'limit'}
                  onChange={handleInputChange}
                />
                <span>Limit</span>
              </label>
              <label className="bid-limit-option">
                <input
                  type="radio"
                  name="bidLimitMode"
                  value="unlimited"
                  checked={formData.bidLimitMode === 'unlimited'}
                  onChange={handleInputChange}
                />
                <span>Unlimited</span>
              </label>
            </div>
            {formData.bidLimitMode === 'limit' && (
              <div className="bid-limit-count">
                <label htmlFor="bid-limit-count">Number of bids allowed</label>
                <input
                  id="bid-limit-count"
                  type="number"
                  name="bidLimitCount"
                  min="1"
                  value={formData.bidLimitCount}
                  onChange={handleInputChange}
                />
              </div>
            )}
            <p className="field-hint">
              Selecting Unlimited will ignore the bid count and allow teams to place unlimited bids on a player.
            </p>
            {errors.bidLimitCount && <span className="field-error">{errors.bidLimitCount}</span>}
          </div>
          <div className="field span-2">
            <label htmlFor="auction-type">Auction type *</label>
            <select id="auction-type" name="auctionType" value={formData.auctionType} onChange={handleInputChange}>
              <option value="slab">Slab method</option>
              <option value="straight">Straight method</option>
            </select>
          </div>
          {formData.auctionType === 'straight' && (
            <div className={`field span-2 ${errors.fixedIncrement ? 'has-error' : ''}`}>
              <label htmlFor="fixed-increment">Fixed increment (₹) *</label>
              <input
                id="fixed-increment"
                type="number"
                name="fixedIncrement"
                value={formData.fixedIncrement}
                onChange={handleInputChange}
                min="1"
              />
              {errors.fixedIncrement && <span className="field-error">{errors.fixedIncrement}</span>}
            </div>
          )}
          {formData.auctionType === 'slab' && (
            <div className={`field span-2 ${errors.ranges ? 'has-error' : ''}`}>
              <label>Auction slab configuration</label>
              <div className="slab-wrapper">
                {formData.ranges.map((range, index) => (
                  <div key={index} className="slab-row">
                    <div className="slab-inputs">
                      <label>
                        <span>From</span>
                        <input
                          type="number"
                          value={range.from}
                          min="0"
                          onChange={(event) => handleRangeChange(index, 'from', event.target.value)}
                        />
                      </label>
                      <label>
                        <span>To</span>
                        <input
                          type="number"
                          value={range.to}
                          min="0"
                          onChange={(event) => handleRangeChange(index, 'to', event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Increment</span>
                        <input
                          type="number"
                          value={range.increment}
                          min="1"
                          onChange={(event) => handleRangeChange(index, 'increment', event.target.value)}
                        />
                      </label>
                    </div>
                    {formData.ranges.length > 1 && (
                      <button type="button" className="slab-remove" onClick={() => removeRange(index)}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {formData.ranges.length < 10 && (
                  <button type="button" className="slab-add" onClick={addRange}>
                    + Add slab range
                  </button>
                )}
              </div>
              {errors.ranges && <span className="field-error">{errors.ranges}</span>}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  const renderPlanStep = () => (
    <section className="form-section">
      <div className="section-header">
        <h2>Plan & Features</h2>
        <p>Choose the base tier and fine-tune feature access for this tournament.</p>
      </div>
      <div className="section-body">
        {renderPlanManager()}
      </div>
    </section>
  );

  const renderCurrentStep = () => {
    if (step === 0) return renderPlanStep();
    if (step === 1) return renderBasicsStep();
    if (step === 2) return renderTeamsStep();
    return renderAuctionStep();
  };

  const statusLabel = (tournament?.status || 'Draft').toLowerCase();
  const lastUpdatedLabel = formatRelativeTime(tournament?.updatedAt || tournament?.createdAt);
  const canPreview = Boolean(tournament?.code);
  const currentStepConfig = steps[step];

  if (loading) {
    return <div className="loading">Loading tournament details...</div>;
  }

  if (error || !tournament) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error || 'Tournament not found'}</p>
        <button onClick={() => navigate('/dashboard/superadmin')} className="btn btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const containerClass = isPageMode ? 'tournament-create-page' : 'tournament-create-modal';
  const shellClass = isPageMode ? 'tournament-create-shell tournament-create-shell--page' : 'tournament-create-shell';

  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose();
    } else {
      navigate('/dashboard/superadmin');
    }
  };

  return (
    <div className={containerClass}>
      {!isPageMode && <div className="tournament-create-overlay" onClick={handleClose} />}
      <div className={shellClass}>
        {!isPageMode && (
          <header className="create-header">
            <div className="header-content">
              <div>
                <h1>Edit Tournament</h1>
                <p>Update tournament settings and configuration</p>
              </div>
              <button type="button" onClick={handleClose} className="close-btn">
                ✕
              </button>
            </div>
          </header>
        )}

        <main className="create-main">
          <div className="form-container">
            {renderCurrentStep()}
          </div>

          <footer className="create-main-footer">
            <button type="button" className="btn-secondary" onClick={resetFormToInitial} disabled={!initialFormState}>
              Reset changes
            </button>
            <div className="footer-actions">
              {step > 0 && (
                <button type="button" className="btn-secondary" onClick={goToPreviousStep}>
                  ← Back
                </button>
              )}
              {isLastStep ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Saving…' : 'Save changes'}
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={goToNextStep}>
                  Next →
                </button>
              )}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default TournamentEdit;
