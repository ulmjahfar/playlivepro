import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-settings.css';

function TournamentSettings() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [activeTab, setActiveTab] = useState('general');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // General Settings
  const [tournamentName, setTournamentName] = useState('');
  const [sport, setSport] = useState('Cricket');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('Upcoming');
  
  // Auction Master Controls
  const [auctionEnabled, setAuctionEnabled] = useState(true);
  const [auctionAdminControlEnabled, setAuctionAdminControlEnabled] = useState(true);
  
  // Auction Settings
  const [auctionMode, setAuctionMode] = useState('normal');
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [lastCallTimerSeconds, setLastCallTimerSeconds] = useState(10);
  const [autoTimerEnabled, setAutoTimerEnabled] = useState(true);
  const [autoNextEnabled, setAutoNextEnabled] = useState(true);
  const [autoTimeoutAction, setAutoTimeoutAction] = useState('pending');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceAnnouncerEnabled, setVoiceAnnouncerEnabled] = useState(false);
  const [assistantNotes, setAssistantNotes] = useState('');
  
  // Animation Settings
  const [nextPlayerAnimationDuration, setNextPlayerAnimationDuration] = useState(3000);
  const [groupingAnimationDuration, setGroupingAnimationDuration] = useState(3500);
  const [fixturesAnimationDuration, setFixturesAnimationDuration] = useState(4000);
  const [soldAnimationDuration, setSoldAnimationDuration] = useState(5000);
  
  // Automation Rules
  const [pendingRound2Enabled, setPendingRound2Enabled] = useState(false);
  const [pendingRound2Threshold, setPendingRound2Threshold] = useState(3);
  const [timerUnsoldEnabled, setTimerUnsoldEnabled] = useState(false);
  const [timerUnsoldSeconds, setTimerUnsoldSeconds] = useState(5);
  const [publishResultsEnabled, setPublishResultsEnabled] = useState(true);
  
  // Registration Settings
  const [playerRegistrationEnabled, setPlayerRegistrationEnabled] = useState(false);
  const [teamRegistrationEnabled, setTeamRegistrationEnabled] = useState(false);
  const [registrationStartDate, setRegistrationStartDate] = useState('');
  const [registrationEndDate, setRegistrationEndDate] = useState('');
  const [paymentReceiptMandatory, setPaymentReceiptMandatory] = useState(false);
  
  // Auction Rules
  const [basePrice, setBasePrice] = useState(1000);
  const [playerPoolSize, setPlayerPoolSize] = useState(128);
  const [participatingTeams, setParticipatingTeams] = useState(8);
  const [minPlayers, setMinPlayers] = useState(11);
  const [maxPlayers, setMaxPlayers] = useState(16);
  const [maxFundForTeam, setMaxFundForTeam] = useState(0);
  const [bidLimitMode, setBidLimitMode] = useState('limit');
  const [bidLimitCount, setBidLimitCount] = useState(5);
  const [incrementType, setIncrementType] = useState('straight');
  const [fixedIncrement, setFixedIncrement] = useState(200);
  
  // Grouping Settings
  const [groupingType, setGroupingType] = useState('random');
  const [numberOfGroups, setNumberOfGroups] = useState(0);
  const [teamsPerGroup, setTeamsPerGroup] = useState(0);
  const [avoidSameCity, setAvoidSameCity] = useState(false);
  
  // Auto-Delete Settings
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(null);
  const [autoDeleteDays, setAutoDeleteDays] = useState(null);
  
  const [user, setUser] = useState(() => { // eslint-disable-line no-unused-vars
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });

  const fetchTournament = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Session expired. Please login again.');
        return;
      }

      const res = await axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const tournamentData = res.data.tournament;
      setTournament(tournamentData);
      
      // General Settings
      setTournamentName(tournamentData.name || '');
      setSport(tournamentData.sport || 'Cricket');
      setStartDate(tournamentData.startDate ? tournamentData.startDate.split('T')[0] : '');
      setEndDate(tournamentData.endDate ? tournamentData.endDate.split('T')[0] : '');
      setLocation(tournamentData.location || '');
      setStatus(tournamentData.status || 'Upcoming');
      
      // Load auction advanced settings
      const settings = tournamentData?.auctionAdvancedSettings || {};
      if (settings.auctionMode) setAuctionMode(settings.auctionMode);
      if (settings.timerEnabled !== undefined) setTimerEnabled(settings.timerEnabled);
      if (settings.timerSeconds !== undefined) setTimerSeconds(settings.timerSeconds);
      if (settings.lastCallTimerSeconds !== undefined) setLastCallTimerSeconds(settings.lastCallTimerSeconds);
      if (settings.autoTimerEnabled !== undefined) setAutoTimerEnabled(settings.autoTimerEnabled);
      if (settings.autoNextEnabled !== undefined) setAutoNextEnabled(settings.autoNextEnabled);
      if (settings.autoTimeoutAction !== undefined) setAutoTimeoutAction(settings.autoTimeoutAction);
      if (settings.soundEnabled !== undefined) setSoundEnabled(settings.soundEnabled);
      if (settings.voiceAnnouncerEnabled !== undefined) setVoiceAnnouncerEnabled(settings.voiceAnnouncerEnabled);
      if (settings.assistantNotes !== undefined) setAssistantNotes(settings.assistantNotes || '');
      
      // Automation rules
      if (settings.automationRules) {
        if (settings.automationRules.pendingRound2) {
          setPendingRound2Enabled(settings.automationRules.pendingRound2.enabled || false);
          setPendingRound2Threshold(settings.automationRules.pendingRound2.threshold || 3);
        }
        if (settings.automationRules.timerUnsold) {
          setTimerUnsoldEnabled(settings.automationRules.timerUnsold.enabled || false);
          setTimerUnsoldSeconds(settings.automationRules.timerUnsold.seconds || 5);
        }
        if (settings.automationRules.publishResults !== undefined) {
          setPublishResultsEnabled(settings.automationRules.publishResults.enabled !== false);
        }
      }
      
      // Auction master controls
      if (tournamentData.auctionEnabled !== undefined) setAuctionEnabled(tournamentData.auctionEnabled);
      if (tournamentData.auctionAdminControlEnabled !== undefined) setAuctionAdminControlEnabled(tournamentData.auctionAdminControlEnabled);
      
      // Registration settings
      if (tournamentData.playerRegistrationEnabled !== undefined) setPlayerRegistrationEnabled(tournamentData.playerRegistrationEnabled);
      if (tournamentData.teamRegistrationEnabled !== undefined) setTeamRegistrationEnabled(tournamentData.teamRegistrationEnabled);
      if (tournamentData.paymentReceiptMandatory !== undefined) setPaymentReceiptMandatory(tournamentData.paymentReceiptMandatory);
      if (tournamentData.registrationStartDate) {
        setRegistrationStartDate(tournamentData.registrationStartDate.split('T')[0]);
      }
      if (tournamentData.registrationEndDate) {
        setRegistrationEndDate(tournamentData.registrationEndDate.split('T')[0]);
      }
      
      // Auction rules
      if (tournamentData.basePrice !== undefined) setBasePrice(tournamentData.basePrice);
      if (tournamentData.playerPoolSize !== undefined) setPlayerPoolSize(tournamentData.playerPoolSize);
      if (tournamentData.participatingTeams !== undefined) setParticipatingTeams(tournamentData.participatingTeams);
      if (tournamentData.minPlayers !== undefined) setMinPlayers(tournamentData.minPlayers);
      if (tournamentData.maxPlayers !== undefined) setMaxPlayers(tournamentData.maxPlayers);
      if (tournamentData.auctionRules) {
        if (tournamentData.auctionRules.maxFundForTeam !== undefined) setMaxFundForTeam(tournamentData.auctionRules.maxFundForTeam);
        if (tournamentData.auctionRules.bidLimitMode) setBidLimitMode(tournamentData.auctionRules.bidLimitMode);
        if (tournamentData.auctionRules.bidLimitCount !== undefined) setBidLimitCount(tournamentData.auctionRules.bidLimitCount);
        if (tournamentData.auctionRules.type) setIncrementType(tournamentData.auctionRules.type);
        if (tournamentData.auctionRules.fixedIncrement !== undefined) setFixedIncrement(tournamentData.auctionRules.fixedIncrement);
      }
      
      // Grouping settings
      if (tournamentData.groupingSettings) {
        if (tournamentData.groupingSettings.groupingType) setGroupingType(tournamentData.groupingSettings.groupingType);
        if (tournamentData.groupingSettings.numberOfGroups !== undefined) setNumberOfGroups(tournamentData.groupingSettings.numberOfGroups);
        if (tournamentData.groupingSettings.teamsPerGroup !== undefined) setTeamsPerGroup(tournamentData.groupingSettings.teamsPerGroup);
        if (tournamentData.groupingSettings.avoidSameCity !== undefined) setAvoidSameCity(tournamentData.groupingSettings.avoidSameCity);
      }
      
      // Auto-delete settings
      if (tournamentData.autoDeleteEnabled !== undefined) setAutoDeleteEnabled(tournamentData.autoDeleteEnabled);
      if (tournamentData.autoDeleteDays !== undefined) setAutoDeleteDays(tournamentData.autoDeleteDays);
      
    } catch (error) {
      console.error('Failed to fetch tournament', error);
      toast.error(error.response?.data?.message || 'Failed to load tournament settings');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchTournament();
  }, [fetchTournament]);

  const handleSaveGeneral = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Session expired. Please login again.');
        return;
      }

      setSaving(prev => ({ ...prev, general: true }));
      
      const res = await axios.put(
        `${API_BASE_URL}/api/tournaments/${code}`,
        {
          name: tournamentName,
          sport,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          location: location || undefined,
          status: user.role === 'SuperAdmin' ? status : undefined
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        setSuccessMessage('General settings saved successfully');
        setShowSuccessPopup(true);
        await fetchTournament();
      } else {
        toast.error('Failed to save general settings');
      }
    } catch (error) {
      console.error('Failed to save general settings', error);
      toast.error(error.response?.data?.message || 'Failed to save general settings');
    } finally {
      setSaving(prev => ({ ...prev, general: false }));
    }
  };

  const handleSaveAuctionSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Session expired. Please login again.');
        return;
      }

      setSaving(prev => ({ ...prev, auction: true }));
      
      const res = await axios.put(
        `${API_BASE_URL}/api/tournaments/${code}/auction-advanced-settings`,
        {
          settings: {
            auctionMode,
            timerEnabled,
            animationSettings: {
              nextPlayerAnimationDuration,
              groupingAnimationDuration,
              fixturesAnimationDuration,
              soldAnimationDuration
            },
            timerSeconds,
            lastCallTimerSeconds,
            autoTimerEnabled,
            autoNextEnabled,
            autoTimeoutAction,
            soundEnabled,
            voiceAnnouncerEnabled,
            assistantNotes,
            automationRules: {
              pendingRound2: {
                enabled: pendingRound2Enabled,
                threshold: pendingRound2Threshold
              },
              timerUnsold: {
                enabled: timerUnsoldEnabled,
                seconds: timerUnsoldSeconds
              },
              publishResults: {
                enabled: publishResultsEnabled
              }
            }
          }
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        setSuccessMessage('Auction settings saved successfully');
        setShowSuccessPopup(true);
        localStorage.setItem(`auction-mode-${code}`, auctionMode);
        await fetchTournament();
      } else {
        toast.error('Failed to save auction settings');
      }
    } catch (error) {
      console.error('Failed to save auction settings', error);
      toast.error(error.response?.data?.message || 'Failed to save auction settings');
    } finally {
      setSaving(prev => ({ ...prev, auction: false }));
    }
  };

  const handleSaveAuctionMasterControls = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Session expired. Please login again.');
        return;
      }

      setSaving(prev => ({ ...prev, master: true }));
      
      const res = await axios.put(
        `${API_BASE_URL}/api/tournaments/${code}/auction-settings`,
        {
          auctionEnabled,
          auctionAdminControlEnabled: user.role === 'SuperAdmin' ? auctionAdminControlEnabled : undefined
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        setSuccessMessage('Auction master controls saved successfully');
        setShowSuccessPopup(true);
        await fetchTournament();
      } else {
        toast.error('Failed to save auction master controls');
      }
    } catch (error) {
      console.error('Failed to save auction master controls', error);
      toast.error(error.response?.data?.message || 'Failed to save auction master controls');
    } finally {
      setSaving(prev => ({ ...prev, master: false }));
    }
  };

  const handleSaveRegistrationSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Session expired. Please login again.');
        return;
      }

      setSaving(prev => ({ ...prev, registration: true }));
      
      const res = await axios.put(
        `${API_BASE_URL}/api/tournaments/${code}`,
        {
          playerRegistrationEnabled,
          teamRegistrationEnabled,
          paymentReceiptMandatory,
          registrationStartDate: registrationStartDate || undefined,
          registrationEndDate: registrationEndDate || undefined
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        setSuccessMessage('Registration settings saved successfully');
        setShowSuccessPopup(true);
        await fetchTournament();
      } else {
        toast.error('Failed to save registration settings');
      }
    } catch (error) {
      console.error('Failed to save registration settings', error);
      toast.error(error.response?.data?.message || 'Failed to save registration settings');
    } finally {
      setSaving(prev => ({ ...prev, registration: false }));
    }
  };

  const handleSaveAuctionRules = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Session expired. Please login again.');
        return;
      }

      setSaving(prev => ({ ...prev, rules: true }));
      
      const auctionRules = {
        type: incrementType,
        fixedIncrement: incrementType === 'straight' ? fixedIncrement : undefined,
        bidLimitMode,
        bidLimitCount: bidLimitMode === 'limit' ? bidLimitCount : null,
        maxBidsPerPlayer: bidLimitMode === 'limit' ? bidLimitCount : null,
        maxFundForTeam: maxFundForTeam || 0
      };
      
      const res = await axios.put(
        `${API_BASE_URL}/api/tournaments/${code}`,
        {
          basePrice,
          playerPoolSize,
          participatingTeams,
          minPlayers,
          maxPlayers,
          auctionRules
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        setSuccessMessage('Auction rules saved successfully');
        setShowSuccessPopup(true);
        await fetchTournament();
      } else {
        toast.error('Failed to save auction rules');
      }
    } catch (error) {
      console.error('Failed to save auction rules', error);
      toast.error(error.response?.data?.message || 'Failed to save auction rules');
    } finally {
      setSaving(prev => ({ ...prev, rules: false }));
    }
  };

  const handleSaveGroupingSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Session expired. Please login again.');
        return;
      }

      setSaving(prev => ({ ...prev, grouping: true }));
      
      const res = await axios.put(
        `${API_BASE_URL}/api/tournaments/${code}`,
        {
          groupingSettings: {
            groupingType,
            numberOfGroups: numberOfGroups || undefined,
            teamsPerGroup: teamsPerGroup || undefined,
            avoidSameCity
          }
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        setSuccessMessage('Grouping settings saved successfully');
        setShowSuccessPopup(true);
        await fetchTournament();
      } else {
        toast.error('Failed to save grouping settings');
      }
    } catch (error) {
      console.error('Failed to save grouping settings', error);
      toast.error(error.response?.data?.message || 'Failed to save grouping settings');
    } finally {
      setSaving(prev => ({ ...prev, grouping: false }));
    }
  };

  const handleSaveAutoDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Session expired. Please login again.');
        return;
      }

      if (user.role !== 'SuperAdmin') {
        toast.error('Only SuperAdmin can modify auto-delete settings');
        return;
      }

      setSaving(prev => ({ ...prev, autoDelete: true }));
      
      const res = await axios.put(
        `${API_BASE_URL}/api/auto-delete/tournament/${code}/override`,
        {
          autoDeleteEnabled,
          autoDeleteDays: autoDeleteDays || undefined
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        setSuccessMessage('Auto-delete settings saved successfully');
        setShowSuccessPopup(true);
        await fetchTournament();
      } else {
        toast.error('Failed to save auto-delete settings');
      }
    } catch (error) {
      console.error('Failed to save auto-delete settings', error);
      toast.error(error.response?.data?.message || 'Failed to save auto-delete settings');
    } finally {
      setSaving(prev => ({ ...prev, autoDelete: false }));
    }
  };

  const handleResetAuction = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Session expired. Please login again.');
        return;
      }

      setResetting(true);
      
      const res = await axios.post(
        `${API_BASE_URL}/api/auctions/${code}/restart`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        toast.success('Auction reset successfully. All players, bids, and auction state have been cleared.');
        setShowResetConfirm(false);
        await fetchTournament();
      } else {
        toast.error('Failed to reset auction');
      }
    } catch (error) {
      console.error('Failed to reset auction', error);
      toast.error(error.response?.data?.message || 'Failed to reset auction');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="tournament-settings-page">
        <div className="settings-loading">
          <div className="loading-spinner"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="tournament-settings-page">
        <div className="settings-empty-state">
          <span className="empty-emoji">⚠️</span>
          <h2>Tournament Not Found</h2>
          <p>Unable to load tournament settings.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'auction', label: 'Auction', icon: '🔨' },
    { id: 'registration', label: 'Registration', icon: '📝' },
    { id: 'rules', label: 'Auction Rules', icon: '📋' },
    { id: 'grouping', label: 'Grouping', icon: '👥' },
    ...(user.role === 'SuperAdmin' ? [{ id: 'advanced', label: 'Advanced', icon: '🔧' }] : [])
  ];

  return (
    <div className="tournament-settings-page">
      <div className="settings-container">
        {/* Header */}
        <div className="settings-header">
          <h1>Tournament Settings</h1>
          <p>Manage and configure your tournament settings</p>
        </div>

        {/* Tab Navigation */}
        <div className="settings-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="settings-content">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="settings-tab-panel">
              <div className="panel-header">
                <h2>General Settings</h2>
                <p>Basic tournament information and configuration</p>
              </div>
              
              <div className="settings-grid">
                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">Tournament Name</span>
                    <span className="label-description">Display name for the tournament</span>
                  </label>
                  <input
                    type="text"
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                    className="input-text"
                    placeholder="Enter tournament name"
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">Sport</span>
                    <span className="label-description">Type of sport</span>
                  </label>
                  <select
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                    className="input-select"
                  >
                    <option value="Cricket">Cricket</option>
                    <option value="Football">Football</option>
                    <option value="Volleyball">Volleyball</option>
                    <option value="Basketball">Basketball</option>
                  </select>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">Start Date</span>
                    <span className="label-description">Tournament start date</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-date"
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">End Date</span>
                    <span className="label-description">Tournament end date</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input-date"
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">Location</span>
                    <span className="label-description">Venue or location</span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="input-text"
                    placeholder="Enter location"
                  />
                </div>

                {user.role === 'SuperAdmin' && (
                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Status</span>
                      <span className="label-description">Current tournament status</span>
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="input-select"
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                      <option value="End">End</option>
                    </select>
                  </div>
                )}

                <div className="setting-card full-width">
                  <label className="setting-label">
                    <span className="label-text">Player Card Generator</span>
                    <span className="label-description">Design and customize player cards for this tournament</span>
                  </label>
                  <button
                    className="btn-card-generator"
                    onClick={() => navigate(`/tournament/${code}/settings/player-card-designer`)}
                  >
                    🎨 Open Player Card Designer
                  </button>
                </div>
              </div>

              <div className="panel-actions">
                <button
                  className="btn-save"
                  onClick={handleSaveGeneral}
                  disabled={saving.general}
                >
                  {saving.general ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Auction Tab */}
          {activeTab === 'auction' && (
            <div className="settings-tab-panel">
              <div className="panel-header">
                <h2>Auction Settings</h2>
                <p>Configure auction behavior, timers, and automation</p>
              </div>

              {/* Master Controls */}
              <div className="settings-section">
                <h3 className="section-title">Master Controls</h3>
                <div className="settings-grid">
                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Auction Enabled</span>
                      <span className="label-description">Master switch to enable or disable all auction features</span>
                    </label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={auctionEnabled}
                        onChange={(e) => setAuctionEnabled(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  {user.role === 'SuperAdmin' && (
                    <div className="setting-card">
                      <label className="setting-label">
                        <span className="label-text">Tournament Admin Control</span>
                        <span className="label-description">Allow Tournament Admin to control the auction enabled switch</span>
                        <span className="admin-badge">SuperAdmin Only</span>
                      </label>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={auctionAdminControlEnabled}
                          onChange={(e) => setAuctionAdminControlEnabled(e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  )}
                </div>
                <div className="section-actions">
                  <button
                    className="btn-save btn-sm"
                    onClick={handleSaveAuctionMasterControls}
                    disabled={saving.master}
                  >
                    {saving.master ? 'Saving...' : 'Save Master Controls'}
                  </button>
                </div>
              </div>

              {/* Timer Settings */}
              <div className="settings-section">
                <h3 className="section-title">Timer Settings</h3>
                <div className="settings-grid">
                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Timer Enabled</span>
                      <span className="label-description">Enable or disable the countdown timer during auction</span>
                    </label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={timerEnabled}
                        onChange={(e) => setTimerEnabled(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Timer Duration</span>
                      <span className="label-description">Default countdown timer duration (seconds)</span>
                    </label>
                    <input
                      type="number"
                      value={timerSeconds}
                      onChange={(e) => setTimerSeconds(Number(e.target.value))}
                      min="10"
                      max="120"
                      className="input-number"
                    />
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Last Call Timer</span>
                      <span className="label-description">Timer duration for last call period (seconds)</span>
                    </label>
                    <input
                      type="number"
                      value={lastCallTimerSeconds}
                      onChange={(e) => setLastCallTimerSeconds(Number(e.target.value))}
                      min="5"
                      max="30"
                      className="input-number"
                    />
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Auto Timer</span>
                      <span className="label-description">Automatically start timer when a new player is selected</span>
                    </label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={autoTimerEnabled}
                        onChange={(e) => setAutoTimerEnabled(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Auto Next Player</span>
                      <span className="label-description">Automatically move to next player after sale (3 second delay)</span>
                    </label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={autoNextEnabled}
                        onChange={(e) => setAutoNextEnabled(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Auto Timeout Action</span>
                      <span className="label-description">What happens when timer expires without a sale</span>
                    </label>
                    <select
                      value={autoTimeoutAction}
                      onChange={(e) => setAutoTimeoutAction(e.target.value)}
                      className="input-select"
                    >
                      <option value="pending">Move to Pending</option>
                      <option value="unsold">Mark as Unsold</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Audio & Voice */}
              <div className="settings-section">
                <h3 className="section-title">Audio & Voice</h3>
                <div className="settings-grid">
                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Sound Effects</span>
                      <span className="label-description">Enable sound effects for bids, sales, and other events</span>
                    </label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={soundEnabled}
                        onChange={(e) => setSoundEnabled(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Voice Announcer</span>
                      <span className="label-description">Enable text-to-speech announcements during auction</span>
                    </label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={voiceAnnouncerEnabled}
                        onChange={(e) => setVoiceAnnouncerEnabled(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Animation Settings */}
              <div className="settings-section">
                <h3 className="section-title">Animation Settings</h3>
                <div className="settings-grid">
                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Next Player Animation Duration</span>
                      <span className="label-description">Time for the "Next Player Coming" wheel animation (milliseconds)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="range"
                        min="1000"
                        max="10000"
                        step="500"
                        value={nextPlayerAnimationDuration}
                        onChange={(e) => setNextPlayerAnimationDuration(Number(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        value={nextPlayerAnimationDuration}
                        onChange={(e) => setNextPlayerAnimationDuration(Number(e.target.value))}
                        min="1000"
                        max="10000"
                        step="500"
                        className="input-number"
                        style={{ width: '100px' }}
                      />
                      <span style={{ fontSize: '12px', color: '#666' }}>ms</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                      {(nextPlayerAnimationDuration / 1000).toFixed(1)} seconds
                    </div>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Grouping Animation Duration</span>
                      <span className="label-description">Time for team grouping wheel animation (milliseconds)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="range"
                        min="1000"
                        max="10000"
                        step="500"
                        value={groupingAnimationDuration}
                        onChange={(e) => setGroupingAnimationDuration(Number(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        value={groupingAnimationDuration}
                        onChange={(e) => setGroupingAnimationDuration(Number(e.target.value))}
                        min="1000"
                        max="10000"
                        step="500"
                        className="input-number"
                        style={{ width: '100px' }}
                      />
                      <span style={{ fontSize: '12px', color: '#666' }}>ms</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                      {(groupingAnimationDuration / 1000).toFixed(1)} seconds
                    </div>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Fixtures Animation Duration</span>
                      <span className="label-description">Time for fixtures generation animation (milliseconds)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="range"
                        min="1000"
                        max="10000"
                        step="500"
                        value={fixturesAnimationDuration}
                        onChange={(e) => setFixturesAnimationDuration(Number(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        value={fixturesAnimationDuration}
                        onChange={(e) => setFixturesAnimationDuration(Number(e.target.value))}
                        min="1000"
                        max="10000"
                        step="500"
                        className="input-number"
                        style={{ width: '100px' }}
                      />
                      <span style={{ fontSize: '12px', color: '#666' }}>ms</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                      {(fixturesAnimationDuration / 1000).toFixed(1)} seconds
                    </div>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Sold Animation Duration</span>
                      <span className="label-description">Time to display "Player Sold" animation overlay (milliseconds)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="range"
                        min="2000"
                        max="10000"
                        step="500"
                        value={soldAnimationDuration}
                        onChange={(e) => setSoldAnimationDuration(Number(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        value={soldAnimationDuration}
                        onChange={(e) => setSoldAnimationDuration(Number(e.target.value))}
                        min="2000"
                        max="10000"
                        step="500"
                        className="input-number"
                        style={{ width: '100px' }}
                      />
                      <span style={{ fontSize: '12px', color: '#666' }}>ms</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                      {(soldAnimationDuration / 1000).toFixed(1)} seconds
                    </div>
                  </div>
                </div>
              </div>

              {/* Automation Rules */}
              <div className="settings-section">
                <h3 className="section-title">Automation Rules</h3>
                <div className="settings-grid">
                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Pending Round 2 Automation</span>
                      <span className="label-description">Automatically start Round 2 when pending players reach threshold</span>
                    </label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={pendingRound2Enabled}
                        onChange={(e) => setPendingRound2Enabled(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  {pendingRound2Enabled && (
                    <div className="setting-card">
                      <label className="setting-label">
                        <span className="label-text">Pending Round 2 Threshold</span>
                        <span className="label-description">Number of pending players required to trigger Round 2</span>
                      </label>
                      <input
                        type="number"
                        value={pendingRound2Threshold}
                        onChange={(e) => setPendingRound2Threshold(Number(e.target.value))}
                        min="1"
                        max="50"
                        className="input-number"
                      />
                    </div>
                  )}

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Timer Unsold Automation</span>
                      <span className="label-description">Automatically mark player as unsold after timer expires</span>
                    </label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={timerUnsoldEnabled}
                        onChange={(e) => setTimerUnsoldEnabled(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  {timerUnsoldEnabled && (
                    <div className="setting-card">
                      <label className="setting-label">
                        <span className="label-text">Timer Unsold Delay</span>
                        <span className="label-description">Seconds to wait before marking as unsold</span>
                      </label>
                      <input
                        type="number"
                        value={timerUnsoldSeconds}
                        onChange={(e) => setTimerUnsoldSeconds(Number(e.target.value))}
                        min="1"
                        max="30"
                        className="input-number"
                      />
                    </div>
                  )}

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Publish Results</span>
                      <span className="label-description">Automatically publish auction results when completed</span>
                    </label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={publishResultsEnabled}
                        onChange={(e) => setPublishResultsEnabled(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Assistant Notes */}
              <div className="settings-section">
                <h3 className="section-title">Assistant Notes</h3>
                <div className="settings-grid">
                  <div className="setting-card full-width">
                    <label className="setting-label">
                      <span className="label-text">Internal Notes</span>
                      <span className="label-description">Notes for auction assistants (not visible to teams)</span>
                    </label>
                    <textarea
                      value={assistantNotes}
                      onChange={(e) => setAssistantNotes(e.target.value)}
                      placeholder="Add notes for auction assistants..."
                      rows="4"
                      className="input-textarea"
                    />
                  </div>
                </div>
              </div>

              {/* Auction Reset */}
              <div className="settings-section">
                <h3 className="section-title">Auction Reset</h3>
                <div className="settings-grid">
                  <div className="setting-card full-width">
                    <label className="setting-label">
                      <span className="label-text">Reset Auction</span>
                      <span className="label-description">Reset the entire auction to initial state. This will clear all bids, player statuses, team purchases, and auction state. This action cannot be undone.</span>
                      <span className="admin-badge" style={{ backgroundColor: '#dc2626', color: 'white' }}>⚠️ Destructive Action</span>
                    </label>
                    <button
                      className="btn-reset"
                      onClick={() => setShowResetConfirm(true)}
                      disabled={resetting}
                      style={{
                        backgroundColor: '#dc2626',
                        color: 'white',
                        padding: '12px 24px',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: resetting ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        opacity: resetting ? 0.6 : 1
                      }}
                    >
                      {resetting ? 'Resetting...' : '🔄 Reset Auction'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="panel-actions">
                <button
                  className="btn-save"
                  onClick={handleSaveAuctionSettings}
                  disabled={saving.auction}
                >
                  {saving.auction ? 'Saving...' : 'Save Auction Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Registration Tab */}
          {activeTab === 'registration' && (
            <div className="settings-tab-panel">
              <div className="panel-header">
                <h2>Registration Settings</h2>
                <p>Manage player and team registration</p>
              </div>
              
              <div className="settings-grid">
                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">Player Registration</span>
                    <span className="label-description">Enable public player registration link</span>
                  </label>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={playerRegistrationEnabled}
                      onChange={(e) => setPlayerRegistrationEnabled(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">Team Registration</span>
                    <span className="label-description">Enable public team registration link</span>
                  </label>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={teamRegistrationEnabled}
                      onChange={(e) => setTeamRegistrationEnabled(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">Registration Start Date</span>
                    <span className="label-description">When registration opens</span>
                  </label>
                  <input
                    type="date"
                    value={registrationStartDate}
                    onChange={(e) => setRegistrationStartDate(e.target.value)}
                    className="input-date"
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">Registration End Date</span>
                    <span className="label-description">When registration closes</span>
                  </label>
                  <input
                    type="date"
                    value={registrationEndDate}
                    onChange={(e) => setRegistrationEndDate(e.target.value)}
                    className="input-date"
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">Payment Receipt Mandatory</span>
                    <span className="label-description">Require players to upload payment receipt during registration</span>
                  </label>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={paymentReceiptMandatory}
                      onChange={(e) => setPaymentReceiptMandatory(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="panel-actions">
                <button
                  className="btn-save"
                  onClick={handleSaveRegistrationSettings}
                  disabled={saving.registration}
                >
                  {saving.registration ? 'Saving...' : 'Save Registration Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Auction Rules Tab */}
          {activeTab === 'rules' && (
            <div className="settings-tab-panel">
              <div className="panel-header">
                <h2>Auction Rules</h2>
                <p>Configure bidding rules, limits, and financial constraints</p>
              </div>
              
              <div className="settings-section">
                <h3 className="section-title">Basic Rules</h3>
                <div className="settings-grid">
                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Base Price</span>
                      <span className="label-description">Default starting price for players</span>
                    </label>
                    <input
                      type="number"
                      value={basePrice}
                      onChange={(e) => setBasePrice(Number(e.target.value))}
                      min="0"
                      className="input-number"
                    />
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Player Pool Size</span>
                      <span className="label-description">Total number of players available for auction</span>
                    </label>
                    <input
                      type="number"
                      value={playerPoolSize}
                      onChange={(e) => setPlayerPoolSize(Number(e.target.value))}
                      min={participatingTeams * minPlayers}
                      className="input-number"
                    />
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Participating Teams</span>
                      <span className="label-description">Number of teams in the tournament</span>
                    </label>
                    <input
                      type="number"
                      value={participatingTeams}
                      onChange={(e) => setParticipatingTeams(Number(e.target.value))}
                      min="2"
                      max="100"
                      className="input-number"
                    />
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Minimum Players per Team</span>
                      <span className="label-description">Minimum squad size required</span>
                    </label>
                    <input
                      type="number"
                      value={minPlayers}
                      onChange={(e) => setMinPlayers(Number(e.target.value))}
                      min="1"
                      className="input-number"
                    />
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Maximum Players per Team</span>
                      <span className="label-description">Maximum squad size allowed</span>
                    </label>
                    <input
                      type="number"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                      min={minPlayers}
                      className="input-number"
                    />
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Maximum Fund per Team</span>
                      <span className="label-description">Maximum budget allowed per team (0 = unlimited)</span>
                    </label>
                    <input
                      type="number"
                      value={maxFundForTeam}
                      onChange={(e) => setMaxFundForTeam(Number(e.target.value))}
                      min="0"
                      className="input-number"
                    />
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3 className="section-title">Bidding Rules</h3>
                <div className="settings-grid">
                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Bid Limit Mode</span>
                      <span className="label-description">Set bid limits per player</span>
                    </label>
                    <select
                      value={bidLimitMode}
                      onChange={(e) => setBidLimitMode(e.target.value)}
                      className="input-select"
                    >
                      <option value="limit">Limited Bids</option>
                      <option value="unlimited">Unlimited Bids</option>
                    </select>
                  </div>

                  {bidLimitMode === 'limit' && (
                    <div className="setting-card">
                      <label className="setting-label">
                        <span className="label-text">Bid Limit Count</span>
                        <span className="label-description">Maximum number of bids allowed per player</span>
                      </label>
                      <input
                        type="number"
                        value={bidLimitCount}
                        onChange={(e) => setBidLimitCount(Number(e.target.value))}
                        min="1"
                        max="50"
                        className="input-number"
                      />
                    </div>
                  )}

                  <div className="setting-card">
                    <label className="setting-label">
                      <span className="label-text">Increment Type</span>
                      <span className="label-description">Bid increment calculation method</span>
                    </label>
                    <select
                      value={incrementType}
                      onChange={(e) => setIncrementType(e.target.value)}
                      className="input-select"
                    >
                      <option value="straight">Straight (Fixed)</option>
                      <option value="slab">Slab (Range-based)</option>
                    </select>
                  </div>

                  {incrementType === 'straight' && (
                    <div className="setting-card">
                      <label className="setting-label">
                        <span className="label-text">Fixed Increment</span>
                        <span className="label-description">Fixed bid increment amount</span>
                      </label>
                      <input
                        type="number"
                        value={fixedIncrement}
                        onChange={(e) => setFixedIncrement(Number(e.target.value))}
                        min="1"
                        className="input-number"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="panel-actions">
                <button
                  className="btn-save"
                  onClick={handleSaveAuctionRules}
                  disabled={saving.rules}
                >
                  {saving.rules ? 'Saving...' : 'Save Auction Rules'}
                </button>
              </div>
            </div>
          )}

          {/* Grouping Tab */}
          {activeTab === 'grouping' && (
            <div className="settings-tab-panel">
              <div className="panel-header">
                <h2>Team Grouping Settings</h2>
                <p>Configure how teams are grouped for tournament stages</p>
              </div>
              
              <div className="settings-grid">
                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">Grouping Type</span>
                    <span className="label-description">Method used to group teams</span>
                  </label>
                  <select
                    value={groupingType}
                    onChange={(e) => setGroupingType(e.target.value)}
                    className="input-select"
                  >
                    <option value="random">Random</option>
                    <option value="seeded">Seeded</option>
                    <option value="city-based">City-based</option>
                  </select>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">Number of Groups</span>
                    <span className="label-description">Total number of groups to create</span>
                  </label>
                  <input
                    type="number"
                    value={numberOfGroups || ''}
                    onChange={(e) => setNumberOfGroups(e.target.value ? Number(e.target.value) : 0)}
                    min="0"
                    className="input-number"
                    placeholder="Auto-calculate"
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">Teams per Group</span>
                    <span className="label-description">Number of teams in each group</span>
                  </label>
                  <input
                    type="number"
                    value={teamsPerGroup || ''}
                    onChange={(e) => setTeamsPerGroup(e.target.value ? Number(e.target.value) : 0)}
                    min="0"
                    className="input-number"
                    placeholder="Auto-calculate"
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <span className="label-text">Avoid Same City</span>
                    <span className="label-description">Prevent teams from the same city in the same group</span>
                  </label>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={avoidSameCity}
                      onChange={(e) => setAvoidSameCity(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="panel-actions">
                <button
                  className="btn-save"
                  onClick={handleSaveGroupingSettings}
                  disabled={saving.grouping}
                >
                  {saving.grouping ? 'Saving...' : 'Save Grouping Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Advanced Tab (SuperAdmin Only) */}
          {activeTab === 'advanced' && user.role === 'SuperAdmin' && (
            <div className="settings-tab-panel">
              <div className="panel-header">
                <h2>Advanced Settings</h2>
                <p>System-level settings and configurations</p>
              </div>
              
              <div className="settings-section">
                <h3 className="section-title">Auto-Delete Settings</h3>
                <div className="settings-grid">
                  <div className="setting-card full-width">
                    <label className="setting-label">
                      <span className="label-text">Auto-Delete Override</span>
                      <span className="label-description">Override system-wide auto-delete settings for this tournament</span>
                      <span className="admin-badge">SuperAdmin Only</span>
                    </label>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="autoDeleteEnabled"
                          checked={autoDeleteEnabled === null}
                          onChange={() => setAutoDeleteEnabled(null)}
                        />
                        <div>
                          <strong>Use System Setting</strong>
                          <span>Follow the global auto-delete configuration</span>
                        </div>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="autoDeleteEnabled"
                          checked={autoDeleteEnabled === false}
                          onChange={() => setAutoDeleteEnabled(false)}
                        />
                        <div>
                          <strong>Never Delete</strong>
                          <span>Never automatically delete this tournament</span>
                        </div>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="autoDeleteEnabled"
                          checked={autoDeleteEnabled === true}
                          onChange={() => setAutoDeleteEnabled(true)}
                        />
                        <div>
                          <strong>Custom Days</strong>
                          <span>Delete after specified number of days</span>
                        </div>
                      </label>
                    </div>
                    {autoDeleteEnabled === true && (
                      <div className="nested-input">
                        <label>
                          Days After Completion (Minimum: 7 days)
                        </label>
                        <input
                          type="number"
                          value={autoDeleteDays || ''}
                          onChange={(e) => setAutoDeleteDays(e.target.value ? Number(e.target.value) : null)}
                          min="7"
                          className="input-number"
                          placeholder="Days (min 7)"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="panel-actions">
                <button
                  className="btn-save"
                  onClick={handleSaveAutoDelete}
                  disabled={saving.autoDelete}
                >
                  {saving.autoDelete ? 'Saving...' : 'Save Advanced Settings'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Popup Modal */}
      {showSuccessPopup && (
        <div className="success-popup-overlay" onClick={() => setShowSuccessPopup(false)}>
          <div className="success-popup-content" onClick={(e) => e.stopPropagation()}>
            <div className="success-popup-icon">✓</div>
            <h3 className="success-popup-title">Success!</h3>
            <p className="success-popup-message">{successMessage}</p>
            <button
              className="success-popup-button"
              onClick={() => setShowSuccessPopup(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#dc2626' }}>⚠️ Confirm Auction Reset</h3>
            <p style={{ marginBottom: '20px', color: '#4b5563', lineHeight: '1.6' }}>
              Are you sure you want to reset the auction? This action will:
            </p>
            <ul style={{ marginBottom: '20px', paddingLeft: '20px', color: '#4b5563', lineHeight: '1.8' }}>
              <li>Reset all players to "Available" status</li>
              <li>Clear all bid history</li>
              <li>Reset all team balances and purchased players</li>
              <li>Clear auction state and logs</li>
              <li>Reset auction status to "Not Started"</li>
            </ul>
            <p style={{ marginBottom: '24px', color: '#dc2626', fontWeight: '600' }}>
              This action cannot be undone!
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: resetting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleResetAuction}
                disabled={resetting}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  cursor: resetting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  opacity: resetting ? 0.6 : 1
                }}
              >
                {resetting ? 'Resetting...' : 'Yes, Reset Auction'}
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

export default TournamentSettings;
