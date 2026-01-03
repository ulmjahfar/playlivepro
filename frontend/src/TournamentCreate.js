import React, { useState, useMemo, useCallback, useEffect } from 'react';
import axios from 'axios';
import ImageUploadCrop from './components/ImageUploadCrop';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-create.css';

const CATEGORY_LABELS = {
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
};

const PLAN_OPTIONS = ['Standard', 'AuctionPro'];

function TournamentCreate({ onClose, onTournamentSuccess, onSuccess, isPageMode = false }) {
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
    basePrice: Math.floor(10000 / 16),
    maxFundForTeam: 10000,
    auctionType: 'slab',
    fixedIncrement: 100,
    bidLimitMode: 'limit',
    bidLimitCount: 5,
    ranges: [{ from: 0, to: 1000, increment: 100 }],
    auctionMode: 'normal'
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState(null);
  const [isBasePriceManual, setIsBasePriceManual] = useState(false);
  const [tierConfigs, setTierConfigs] = useState([]);
  const [featureDefinitions, setFeatureDefinitions] = useState([]);
  const [featureLoading, setFeatureLoading] = useState(true);
  const [featureError, setFeatureError] = useState('');
  const [isFeatureDropdownOpen, setIsFeatureDropdownOpen] = useState(false);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [isLogoUploaded, setIsLogoUploaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem('token');
    if (!token) {
      setFeatureLoading(false);
      return undefined;
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
      } catch (error) {
        console.error('Failed to load tier configuration', error);
        if (isMounted) {
          setFeatureError('Unable to load tier configuration. Feature overrides may be unavailable.');
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

  // Close dropdown when clicking outside or pressing ESC
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isFeatureDropdownOpen && !event.target.closest('.custom-dropdown-wrapper')) {
        setIsFeatureDropdownOpen(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && isFeatureDropdownOpen) {
        setIsFeatureDropdownOpen(false);
      }
    };

    if (isFeatureDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isFeatureDropdownOpen]);


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
      if (isEnabled) resolved.add(featureId);
      else resolved.delete(featureId);
    });
    return Array.from(resolved);
  }, [formData.featureOverrides, formData.plan, tierFeatureMap]);

  const resolvedFeatureSet = useMemo(() => new Set(resolvedFeatures), [resolvedFeatures]);
  const overrideCount = useMemo(
    () => Object.keys(formData.featureOverrides || {}).length,
    [formData.featureOverrides]
  );

  // Check if type/sport field should be hidden based on feature overrides
  const shouldHideTypeField = useMemo(() => {
    const overrides = formData.featureOverrides || {};
    // Hide if there's a specific override to hide the type field
    // Check for feature override keys that control field visibility
    if (overrides['hide_tournament_type'] === true || overrides['hide_sport_field'] === true) {
      return true;
    }
    // Also check if a feature that controls this is disabled via overrides
    if (overrides['show_tournament_type'] === false || overrides['show_sport_field'] === false) {
      return true;
    }
    return false;
  }, [formData.featureOverrides]);

  // Set default sport value when field is hidden
  useEffect(() => {
    if (shouldHideTypeField && !formData.sport) {
      setFormData((prev) => ({ ...prev, sport: 'Cricket' }));
    }
  }, [shouldHideTypeField, formData.sport]);

  const groupedFeatures = useMemo(
    () =>
      featureDefinitions.reduce((acc, feature) => {
        const key = feature.category || 'Uncategorized';
        if (!acc[key]) acc[key] = [];
        acc[key].push(feature);
        return acc;
      }, {}),
    [featureDefinitions]
  );

  const formatPlanLabel = useCallback((value) => {
    if (!value) return 'Standard';
    return value;
  }, []);

  const totalMinPlayers = useMemo(
    () => formData.participatingTeams * formData.minPlayers,
    [formData.participatingTeams, formData.minPlayers]
  );
  const totalMaxPlayers = useMemo(
    () => formData.participatingTeams * formData.maxPlayers,
    [formData.participatingTeams, formData.maxPlayers]
  );
  const calculatedBasePrice = useMemo(() => {
    if (formData.maxFundForTeam > 0 && formData.maxPlayers > 0) {
      return Math.floor(formData.maxFundForTeam / formData.maxPlayers);
    }
    return 0;
  }, [formData.maxFundForTeam, formData.maxPlayers]);

  const handlePlanSelect = (nextPlan) => {
    setFormData((prev) => ({
      ...prev,
      plan: nextPlan,
      featureOverrides: {}
    }));
    setIsEditingPlan(false);
  };

  const handleOverrideToggle = (featureId, enabled) => {
    setFormData((prev) => {
      const baseFeatures = new Set(tierFeatureMap[prev.plan] || []);
      const overrides = { ...(prev.featureOverrides || {}) };
      const defaultEnabled = baseFeatures.has(featureId);
      if (enabled === defaultEnabled) delete overrides[featureId];
      else overrides[featureId] = enabled;
      return {
        ...prev,
        featureOverrides: Object.keys(overrides).length ? overrides : {}
      };
    });
  };

  const handleFeatureEnable = (featureId) => {
    setFormData((prev) => {
      const overrides = { ...(prev.featureOverrides || {}) };
      overrides[featureId] = true;
      return {
        ...prev,
        featureOverrides: overrides
      };
    });
  };

  const handleFeatureDisable = (featureId) => {
    setFormData((prev) => {
      const overrides = { ...(prev.featureOverrides || {}) };
      overrides[featureId] = false;
      return {
        ...prev,
        featureOverrides: overrides
      };
    });
  };

  const handleFeatureReset = (featureId) => {
    setFormData((prev) => {
      const overrides = { ...(prev.featureOverrides || {}) };
      delete overrides[featureId];
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

  const handleInputChange = (e) => {
    if (!e || !e.target) return;
    
    const { name, value, type, checked } = e.target;
    const processedValue =
      type === 'checkbox'
        ? checked
        : name === 'name'
          ? value.toUpperCase()
          : name === 'location'
            ? value.replace(/\b\w/g, (letter) => letter.toUpperCase())
            : value;

    setFormData((prev) => {
      const next = { ...prev, [name]: processedValue };

      if (name === 'isOneDayTournament' && checked && prev.startDate) {
        next.endDate = prev.startDate;
      } else if (name === 'startDate' && prev.isOneDayTournament) {
        next.endDate = processedValue;
      }

      if ((name === 'maxFundForTeam' || name === 'maxPlayers') && !isBasePriceManual) {
        const maxFund = name === 'maxFundForTeam' ? Number(processedValue) : prev.maxFundForTeam;
        const maxPlayers = name === 'maxPlayers' ? Number(processedValue) : prev.maxPlayers;
        if (maxFund > 0 && maxPlayers > 0) {
          next.basePrice = Math.floor(maxFund / maxPlayers);
        }
      }

      if (name === 'basePrice') {
        setIsBasePriceManual(true);
      }

      return next;
    });

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (name === 'bidLimitMode' && processedValue === 'unlimited' && errors.bidLimitCount) {
      setErrors((prev) => ({ ...prev, bidLimitCount: '' }));
    }
  };

  const handleLogoSelect = (url) => {
    setFormData((prev) => ({ ...prev, logo: url }));
    setIsLogoUploaded(true);
    if (errors.logo) {
      setErrors((prev) => ({ ...prev, logo: '' }));
    }
  };

  const handleRangeChange = (index, field, value) => {
    if (typeof index !== 'number' || index < 0) return;
    setFormData((prev) => {
      if (!prev.ranges || !prev.ranges[index]) return prev;
      const nextRanges = [...prev.ranges];
      nextRanges[index] = { ...nextRanges[index], [field]: Number(value) || 0 };
      return { ...prev, ranges: nextRanges };
    });
  };

  const addRange = () => {
    setFormData((prev) => {
      if (!prev.ranges) return { ...prev, ranges: [{ from: 0, to: 0, increment: 100 }] };
      if (prev.ranges.length >= 10) return prev;
      return { ...prev, ranges: [...prev.ranges, { from: 0, to: 0, increment: 100 }] };
    });
  };

  const removeRange = (index) => {
    if (typeof index !== 'number' || index < 0) return;
    setFormData((prev) => {
      if (!prev.ranges || prev.ranges.length <= 1) return prev;
      return {
        ...prev,
        ranges: prev.ranges.filter((_, idx) => idx !== index)
      };
    });
  };

  const validateStep = (currentStep = null) => {
    const nextErrors = {};

    if (currentStep === null || currentStep === 0) {
      if (!formData.plan) {
        nextErrors.plan = 'Select a plan';
      }
    }

    if (currentStep === null || currentStep === 1) {
      if (!formData.name.trim()) nextErrors.name = 'Tournament name is required';
      // Only validate sport if the field is not hidden by feature overrides
      const overrides = formData.featureOverrides || {};
      const hideType = overrides['hide_tournament_type'] === true || 
                       overrides['hide_sport_field'] === true ||
                       overrides['show_tournament_type'] === false ||
                       overrides['show_sport_field'] === false;
      if (!hideType && !formData.sport) nextErrors.sport = 'Select the sport type';
      if (!formData.logo) nextErrors.logo = 'Tournament logo is required';
    }

    if (currentStep === null || currentStep === 2) {
      if (formData.participatingTeams < 2) nextErrors.participatingTeams = 'Minimum 2 teams required';
      if (formData.minPlayers < 1) nextErrors.minPlayers = 'Minimum players must be at least 1';
      if (formData.maxPlayers < formData.minPlayers) nextErrors.maxPlayers = 'Maximum players must be greater than minimum players';
      if (formData.playerPoolSize < formData.participatingTeams * formData.minPlayers) {
        nextErrors.playerPoolSize = 'Player pool must cover all registered team minimums';
      }
    }

    if (currentStep === null || currentStep === 3) {
      if (formData.basePrice < 0) nextErrors.basePrice = 'Must be zero or greater';
      if (formData.maxFundForTeam <= 0) nextErrors.maxFundForTeam = 'Enter a positive value';
      if (formData.bidLimitMode === 'limit' && formData.bidLimitCount < 1) {
        nextErrors.bidLimitCount = 'Enter how many bids a player can receive';
      }
      if (formData.auctionType === 'straight' && formData.fixedIncrement <= 0) {
        nextErrors.fixedIncrement = 'Increment must be positive';
      }
      if (formData.auctionType === 'slab') {
        const sortedRanges = [...formData.ranges].sort((a, b) => a.from - b.from);
        if (sortedRanges[0]?.from !== 0) {
          nextErrors.ranges = 'First range must start from ₹0';
        }
        for (let i = 0; i < sortedRanges.length - 1; i += 1) {
          if (sortedRanges[i].to >= sortedRanges[i + 1].from) {
            nextErrors.ranges = 'Auction ranges cannot overlap';
            break;
          }
        }
      }
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };


  const clearForm = () => {
    if (window.confirm('Are you sure you want to reset the form? All entered data will be lost.')) {
      setFormData({
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
        basePrice: Math.floor(10000 / 16),
        maxFundForTeam: 10000,
        auctionType: 'slab',
        fixedIncrement: 100,
        bidLimitMode: 'limit',
        bidLimitCount: 5,
        ranges: [{ from: 0, to: 1000, increment: 100 }],
        auctionMode: 'normal'
      });
      setErrors({});
      setIsLogoUploaded(false);
      setIsBasePriceManual(false);
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const copyToClipboard = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      // You could add a toast notification here if you have toast available
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const shareTournamentOnWhatsApp = useCallback(() => {
    if (!adminCredentials) return;

    const baseUrl = window.location?.origin || '';
    const loginUrl = `${baseUrl}/login/tournament-admin`;
    const registrationLink =
      adminCredentials.registrationLink || `${baseUrl}/register/${adminCredentials.tournamentCode}`;

    const shareMessage = [
      '✅ Tournament created on PlayLive',
      `🏆 ${adminCredentials.tournamentName}`,
      adminCredentials.tournamentCode ? `🏷️ Code: ${adminCredentials.tournamentCode}` : null,
      `👤 Admin username: ${adminCredentials.username}`,
      `🔐 Password: ${adminCredentials.password}`,
      `🔗 Admin login: ${loginUrl}`,
      registrationLink ? `📝 Registration: ${registrationLink}` : null,
      '',
      '📱 PlayLive Tournament OS keeps registrations, auctions, and live scoring in sync.',
      'Sent from PlayLive Control Center'
    ]
      .filter(Boolean)
      .join('\n');

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }, [adminCredentials]);

  const notifySuccess = useCallback(() => {
    if (typeof onTournamentSuccess === 'function') onTournamentSuccess();
    if (typeof onSuccess === 'function') onSuccess();
  }, [onTournamentSuccess, onSuccess]);

  const submitTournament = async () => {
    if (!validateStep(null)) {
      // Scroll to first error
      const firstErrorField = document.querySelector('.has-error');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setLoading(true);
    try {
      const submitData = new FormData();
      const isUnlimitedBid = formData.bidLimitMode === 'unlimited';

      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'ranges') {
          submitData.append(
            'auctionRules',
            JSON.stringify({
              type: formData.auctionType,
              fixedIncrement: formData.fixedIncrement,
              ranges: formData.ranges,
              baseValueOfPlayer: formData.basePrice,
              maxFundForTeam: formData.maxFundForTeam,
              bidLimitMode: formData.bidLimitMode,
              bidLimitCount: isUnlimitedBid ? null : Number(formData.bidLimitCount) || 0,
              maxBidsPerPlayer: isUnlimitedBid ? null : Number(formData.bidLimitCount) || 0
            })
          );
        } else if (key === 'featureOverrides') {
          submitData.append('featureOverrides', JSON.stringify(value || {}));
        } else if (key === 'logo' && value) {
          // Logo is already uploaded via upload-logo endpoint, so we send the path as a string
          // The backend expects either req.file (for new upload) or req.body.logo (for existing path)
          if (typeof value === 'string') {
            // Remove API URL prefix if present, keep just the path
            let logoPath = value;
            if (logoPath.startsWith('http')) {
              logoPath = logoPath.replace(API_BASE_URL || '', '');
            }
            // Ensure path starts with / if it doesn't already
            if (!logoPath.startsWith('/')) {
              logoPath = '/' + logoPath;
            }
            submitData.append('logo', logoPath);
          } else {
            // If it's a File object (shouldn't happen with ImageUploadCrop, but handle it)
            submitData.append('logo', value);
          }
        } else if (key === 'auctionType' || key === 'bidLimitMode' || key === 'bidLimitCount') {
          // handled above
        } else if (key === 'auctionMode') {
          // Send auctionMode separately for backend to save in auctionAdvancedSettings
          submitData.append('auctionMode', value);
        } else if (typeof value === 'boolean' || typeof value === 'number') {
          submitData.append(key, value);
        } else if (value) {
          submitData.append(key, value);
        }
      });

      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }

      const apiUrl = API_BASE_URL;
      if (!apiUrl) {
        alert('API URL not configured. Please check environment variables.');
        return;
      }

      const response = await axios.post(
        `${apiUrl}/api/tournaments/create`,
        submitData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        setAdminCredentials(response.data.adminCredentials);
        setShowSuccessPopup(true);
      } else {
        alert(`Failed to create tournament: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating tournament:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create tournament. Please try again.';
      alert(`Error creating tournament: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };


  const renderPlanSection = () => {
    const baseFeatures = tierFeatureMap[formData.plan] || [];
    const hasFeatureCatalog = Object.keys(groupedFeatures).length > 0;

    return (
      <section className="form-section">
        <div className="section-header">
          <h2>Plan & Features</h2>
        </div>
        <div className="section-body">
          {featureLoading ? (
            <div className="tier-loading">Loading tier options…</div>
          ) : featureError ? (
            <div className="tier-error">{featureError}</div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="tournament-plan">Tournament Plan *</label>
                <div className="plan-selector-container">
                  <div className="plan-buttons-grid">
                    {PLAN_OPTIONS.map((plan) => {
                      const info = tierMetadataMap[plan] || {};
                      const isSelected = formData.plan === plan;
                      const description = info.description || 
                        (plan === 'Standard'
                          ? 'Standard features with enhanced capabilities'
                          : 'Maximum PlayLive power with broadcast');
                      
                      return (
                        <button
                          key={plan}
                          type="button"
                          className={`plan-button ${isSelected ? 'plan-button-selected' : ''} ${errors.plan ? 'plan-button-error' : ''}`}
                          onClick={() => handlePlanSelect(plan)}
                        >
                          <div className="plan-button-content">
                            <div className="plan-button-header">
                              <span className="plan-button-icon">
                                {isSelected ? '✓' : '○'}
                              </span>
                              <span className="plan-button-title">
                                {formatPlanLabel(plan)}
                              </span>
                            </div>
                            <p className="plan-button-description">{description}</p>
                          </div>
                          {isSelected && (
                            <div className="plan-button-badge">
                              <span>Selected</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {errors.plan && <span className="field-error">{errors.plan}</span>}
              </div>

              {isEditingPlan && (
                <>
                  <div className="tier-summary-panel">
                    <div className="tier-summary-header">
                      <div>
                        <h3>Feature Summary</h3>
                        <p>Plan defaults plus any overrides you apply.</p>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className="tier-summary-plan">
                          <span className="tier-chip">{formatPlanLabel(formData.plan)}</span>
                          {overrideCount > 0 && (
                            <span className="tier-summary-overrides">
                              {overrideCount} override{overrideCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => setIsEditingPlan(false)}
                        >
                          Done
                        </button>
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
                        <h3>Edit Features</h3>
                        <p>Add or remove capabilities for this tournament.</p>
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
                      <div className="feature-overrides-dropdown-container">
                        <div className="field">
                          <label htmlFor="feature-overrides-select">Select Features to Edit</label>
                          <div className="custom-dropdown-wrapper">
                            <button
                              type="button"
                              className="custom-dropdown-button"
                              onClick={() => setIsFeatureDropdownOpen(!isFeatureDropdownOpen)}
                              id="feature-overrides-select"
                            >
                              <span>
                                {overrideCount > 0
                                  ? `${overrideCount} feature${overrideCount > 1 ? 's' : ''} modified`
                                  : 'Select features to edit'}
                              </span>
                              <span className={`dropdown-arrow ${isFeatureDropdownOpen ? 'open' : ''}`}>▼</span>
                            </button>
                            {isFeatureDropdownOpen && (
                              <>
                                <div
                                  className="dropdown-overlay"
                                  onClick={() => setIsFeatureDropdownOpen(false)}
                                />
                                <div className="custom-dropdown-menu">
                                  <div className="dropdown-header">
                                    <span>Features ({featureDefinitions.length})</span>
                                    <button
                                      type="button"
                                      className="close-dropdown-btn"
                                      onClick={() => setIsFeatureDropdownOpen(false)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <div className="dropdown-content">
                                    {Object.keys(groupedFeatures)
                                      .sort()
                                      .map((category) => {
                                        const features = groupedFeatures[category];
                                        return (
                                          <div key={category} className="dropdown-category-group">
                                            <div className="dropdown-category-title">
                                              {CATEGORY_LABELS[category] || category}
                                              <span className="category-count">({features.length})</span>
                                            </div>
                                            {features.map((feature) => {
                                              const enabled = resolvedFeatureSet.has(feature.id);
                                              const overrides = formData.featureOverrides || {};
                                              const hasOverride = Object.prototype.hasOwnProperty.call(overrides, feature.id);
                                              const overrideState = hasOverride
                                                ? overrides[feature.id]
                                                  ? 'forced-on'
                                                  : 'forced-off'
                                                : 'default';
                                              const defaultEnabled = baseFeatures.includes(feature.id);
                                              const helperText =
                                                overrideState === 'default'
                                                  ? defaultEnabled
                                                    ? 'Included in plan'
                                                    : 'Not in plan'
                                                  : overrideState === 'forced-on'
                                                    ? 'Added'
                                                    : 'Removed';

                                              return (
                                                <div
                                                  key={feature.id}
                                                  className={`dropdown-feature-item ${enabled ? 'enabled' : 'disabled'} ${
                                                    overrideState !== 'default' ? 'custom' : ''
                                                  }`}
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <label className="feature-checkbox-wrapper">
                                                    <input
                                                      type="checkbox"
                                                      checked={enabled}
                                                      onChange={(event) => handleOverrideToggle(feature.id, event.target.checked)}
                                                    />
                                                    <div className="feature-item-content">
                                                      <span className="feature-item-name">{feature.name}</span>
                                                      <small className="feature-item-hint">{helperText}</small>
                                                    </div>
                                                  </label>
                                                  <div className="feature-edit-actions">
                                                    {hasOverride ? (
                                                      <>
                                                        <button
                                                          type="button"
                                                          className={`feature-action-btn ${overrideState === 'forced-on' ? 'active' : ''}`}
                                                          onClick={() => handleFeatureEnable(feature.id)}
                                                          title="Enable feature"
                                                        >
                                                          ✓ Enable
                                                        </button>
                                                        <button
                                                          type="button"
                                                          className={`feature-action-btn ${overrideState === 'forced-off' ? 'active' : ''}`}
                                                          onClick={() => handleFeatureDisable(feature.id)}
                                                          title="Disable feature"
                                                        >
                                                          ✕ Disable
                                                        </button>
                                                        <button
                                                          type="button"
                                                          className="feature-action-btn reset-btn"
                                                          onClick={() => handleFeatureReset(feature.id)}
                                                          title="Reset to plan default"
                                                        >
                                                          ↺ Reset
                                                        </button>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <button
                                                          type="button"
                                                          className="feature-action-btn"
                                                          onClick={() => handleFeatureEnable(feature.id)}
                                                          title="Enable feature"
                                                          disabled={defaultEnabled}
                                                        >
                                                          ✓ Enable
                                                        </button>
                                                        <button
                                                          type="button"
                                                          className="feature-action-btn"
                                                          onClick={() => handleFeatureDisable(feature.id)}
                                                          title="Disable feature"
                                                          disabled={!defaultEnabled}
                                                        >
                                                          ✕ Disable
                                                        </button>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    );
  };

  const renderBasicsSection = () => (
    <section className="form-section">
      <div className="section-header">
        <h2>Tournament Basics</h2>
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
          {!shouldHideTypeField && (
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
          )}
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
              onComplete={handleLogoSelect}
              onError={(err) => {
                setErrors((prev) => ({ ...prev, logo: err }));
                setIsLogoUploaded(false);
              }}
            />
            {isLogoUploaded && formData.logo && (
              <span className="image-upload-success">✓ Image uploaded</span>
            )}
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

  const renderTeamsSection = () => (
    <section className="form-section">
      <div className="section-header">
        <h2>Team & Registration</h2>
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
            <p className="field-hint">Needs enough registered players to cover all teams’ minimum squad sizes.</p>
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

  const renderAuctionSection = () => (
    <section className="form-section">
      <div className="section-header">
        <h2>Auction Settings</h2>
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
            {!isBasePriceManual && calculatedBasePrice > 0 && (
              <p className="field-hint">
                Auto-calculated: ₹{calculatedBasePrice.toLocaleString()} (Max Fund ÷ Max Players)
              </p>
            )}
            {isBasePriceManual && (
              <p className="field-hint">
                Manual override active.{' '}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setIsBasePriceManual(false);
                    const recalculated = calculatedBasePrice || formData.basePrice;
                    setFormData((prev) => ({ ...prev, basePrice: recalculated }));
                  }}
                >
                  Reset to auto-calculated
                </button>
              </p>
            )}
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


  const containerClass = isPageMode ? 'tournament-create-page' : 'tournament-create-modal';
  const shellClass = isPageMode ? 'tournament-create-shell tournament-create-shell--page' : 'tournament-create-shell';

  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <div className={containerClass}>
      {!isPageMode && <div className="tournament-create-overlay" onClick={handleClose} />}
      <div className={shellClass}>
        {!isPageMode && (
          <header className="create-header">
            <h1>Create Tournament</h1>
            <button type="button" onClick={handleClose} className="close-btn">✕</button>
          </header>
        )}

        <main className="create-main">
          <div className="form-container">
            {renderPlanSection()}
            {renderBasicsSection()}
            {renderTeamsSection()}
            {renderAuctionSection()}
          </div>

          <footer className="create-main-footer">
            <div className="footer-actions">
              <button type="button" className="btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button type="button" className="btn-secondary" onClick={clearForm}>
                Reset
              </button>
            </div>
            <button type="button" className="btn-primary" onClick={submitTournament} disabled={loading}>
              {loading ? 'Creating...' : 'Create Tournament'}
            </button>
          </footer>
        </main>
      </div>

      {showSuccessPopup && adminCredentials && (
        <div className="success-popup-overlay">
          <div className="success-popup">
            <div className="success-hero">
              <div className="success-icon" aria-hidden="true">
                <span>✓</span>
              </div>
              <div className="success-hero-text">
                <p className="success-eyebrow">Tournament</p>
                <h3>Tournament created successfully!</h3>
                <p>Use the credentials below to share with the tournament admin.</p>
              </div>
            </div>

            <div className="credential-grid">
              <label className="credential-field">
                <span>Tournament</span>
                <div className="credential-input">
                  <input type="text" value={adminCredentials.tournamentName} readOnly />
                </div>
              </label>

              <label className="credential-field">
                <span>Username</span>
                <div className="credential-input">
                  <input type="text" value={adminCredentials.username} readOnly />
                  <button type="button" className="copy-btn" onClick={() => copyToClipboard(adminCredentials.username)}>
                    Copy
                  </button>
                </div>
              </label>

              <label className="credential-field">
                <span>Password</span>
                <div className="credential-input">
                  <input type="text" value={adminCredentials.password} readOnly />
                  <button type="button" className="copy-btn" onClick={() => copyToClipboard(adminCredentials.password)}>
                    Copy
                  </button>
                </div>
              </label>
            </div>

            <div className="success-actions">
              <button
                type="button"
                className="btn-share-whatsapp"
                onClick={shareTournamentOnWhatsApp}
              >
                <span className="btn-share-whatsapp-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="https://www.w3.org/2000/svg">
                    <path
                      d="M12.04 2C6.56 2 2.07 6.26 2.07 11.53C2.07 13.94 3.04 16.13 4.65 17.84L3.74 21.73L7.78 20.56C9.13 21.2 10.61 21.55 12.15 21.55C17.63 21.55 22.12 17.29 22.12 12.02C22.12 6.75 17.52 2 12.04 2ZM12.15 19.71C10.8 19.71 9.51 19.38 8.38 18.76L8.05 18.58L6.07 19.16L6.58 17.11L6.35 16.82C5.01 15.24 4.28 13.42 4.28 11.5C4.28 7.25 7.82 3.79 12.26 3.79C16.7 3.79 20.24 7.25 20.24 11.5C20.24 15.75 16.71 19.71 12.15 19.71Z"
                      fill="currentColor"
                    />
                    <path
                      d="M17.04 14.36C16.65 14.18 15.45 13.58 15.07 13.45C14.68 13.32 14.46 13.27 14.24 13.58C14.03 13.88 13.38 14.64 13.22 14.84C13.07 15.04 12.91 15.06 12.52 14.88C11.41 14.38 10.52 13.75 9.71 12.7C9.21 12.04 9.77 12.08 10.33 10.97C10.45 10.72 10.39 10.53 10.27 10.35C10.15 10.17 9.55 8.93 9.31 8.47C9.07 7.99 8.84 8.05 8.63 8.05C8.44 8.05 8.21 8.02 7.98 8.02C7.76 8.02 7.42 8.09 7.15 8.39C6.89 8.69 6.13 9.41 6.13 10.72C6.13 12.04 7.09 13.32 7.22 13.49C7.35 13.66 9.26 16.42 12.26 17.72C13.01 18.04 13.56 18.2 13.96 18.32C14.55 18.49 15.16 18.46 15.64 18.39C16.17 18.31 17.47 17.62 17.74 16.86C18.01 16.09 18.01 15.46 17.93 15.31C17.85 15.16 17.43 14.96 17.04 14.36Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                Share to WhatsApp
              </button>
              <button type="button" className="btn-secondary" onClick={() => alert('PDF download coming soon!')}>
                ⬇️ Download PDF
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setShowSuccessPopup(false);
                  notifySuccess();
                  handleClose();
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TournamentCreate;
