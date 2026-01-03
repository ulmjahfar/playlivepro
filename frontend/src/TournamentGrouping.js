import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_BASE_URL } from './utils/apiConfig';
import TournamentAdminLayout from './components/TournamentAdminLayout';
import GroupConfigurationPanel from './components/GroupConfigurationPanel';
import TeamPickingInterface from './components/TeamPickingInterface';
import './styles-tournament-grouping.css';

function TournamentGrouping() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [pickingState, setPickingState] = useState(null);
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [initializing, setInitializing] = useState(false);

  // Fetch tournament and picking state
  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Session expired. Please login again.');
        navigate('/login/tournament-admin');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Fetch tournament
      const tournamentRes = await axios.get(`${API_BASE_URL}/api/tournaments/${code}`, { headers });
      setTournament(tournamentRes.data.tournament);

      // Fetch picking state
      try {
        const pickingRes = await axios.get(`${API_BASE_URL}/api/grouping/${code}/picking-state`, { headers });
        if (pickingRes.data.success && pickingRes.data.initialized) {
          setPickingState(pickingRes.data);
          setGroups(pickingRes.data.groups || []);
          setShowConfiguration(false);
        } else {
          setPickingState(null);
          setGroups([]);
          setShowConfiguration(true);
        }
      } catch (err) {
        if (err.response?.status === 404 || err.response?.status === 403) {
          setPickingState(null);
          setGroups([]);
          setShowConfiguration(true);
        } else {
          throw err;
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (error.response?.status === 403) {
        toast.error('Access denied. You do not have permission to access this tournament.');
      } else if (error.response?.status === 404) {
        toast.error('Tournament not found.');
      } else {
        toast.error('Failed to load grouping data');
      }
      navigate(`/tournament/${code}/settings`);
    } finally {
      setLoading(false);
    }
  }, [code, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle group initialization
  const handleInitializeGroups = async (config) => {
    setInitializing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/api/grouping/${code}/initialize-groups`,
        config,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        setShowConfiguration(false);
        await fetchData(); // Refresh data
      }
    } catch (error) {
      console.error('Error initializing groups:', error);
      toast.error(error.response?.data?.message || 'Failed to initialize groups');
    } finally {
      setInitializing(false);
    }
  };

  // Handle team picked
  const handleTeamPicked = async () => {
    await fetchData(); // Refresh picking state
  };

  // Handle lock/unlock groups
  const handleLockGroups = async (lock) => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = lock ? 'lock-groups' : 'unlock-groups';
      const response = await axios.post(
        `${API_BASE_URL}/api/grouping/${code}/${endpoint}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        await fetchData();
      }
    } catch (error) {
      console.error(`Error ${lock ? 'locking' : 'unlocking'} groups:`, error);
      toast.error(error.response?.data?.message || `Failed to ${lock ? 'lock' : 'unlock'} groups`);
    }
  };

  // Handle clear groups
  const handleClearGroups = async () => {
    if (!window.confirm('Are you sure you want to clear all groups? This will remove all team assignments.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/api/grouping/${code}/clear-groups`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        setShowConfiguration(true);
        await fetchData();
      }
    } catch (error) {
      console.error('Error clearing groups:', error);
      toast.error(error.response?.data?.message || 'Failed to clear groups');
    }
  };

  // Handle send to broadcast
  const handleSendToBroadcast = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/api/grouping/${code}/send-to-broadcast`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success(response.data.message);
      }
    } catch (error) {
      console.error('Error sending to broadcast:', error);
      toast.error(error.response?.data?.message || 'Failed to send to broadcast');
    }
  };

  if (loading) {
    return (
      <TournamentAdminLayout noLayoutClasses={true}>
        <div className="grouping-loading">
          <div className="loading-spinner"></div>
          <p>Loading grouping data...</p>
        </div>
      </TournamentAdminLayout>
    );
  }

  if (!tournament) {
    return (
      <TournamentAdminLayout noLayoutClasses={true}>
        <div className="grouping-error">
          <p>Tournament not found</p>
        </div>
      </TournamentAdminLayout>
    );
  }

  const isLocked = pickingState?.groups?.some(g => g.locked) || tournament.groupsLocked;
  const allTeamsAssigned = pickingState && pickingState.totalAvailable === 0;

  return (
    <TournamentAdminLayout noLayoutClasses={true} hideHeader={true}>
      <div className="tournament-grouping-page one-screen-layout">
        <div className="grouping-header-redesigned">
          <div className="header-left-section">
            <div className="header-title-section">
              <h1 className="header-title">Team Grouping</h1>
              {pickingState && pickingState.initialized && (
                <div className="header-stats-row">
                  <div className="stat-badge stat-round">
                    <span className="stat-label">Round</span>
                    <span className="stat-value">{pickingState.currentRound || 1}</span>
                  </div>
                  <div className="stat-badge stat-progress">
                    <span className="stat-value">
                      {pickingState.totalAssigned || 0}<span className="stat-divider">/</span>{pickingState.totalAssigned + pickingState.totalAvailable}
                    </span>
                    <span className="stat-label">Teams</span>
                  </div>
                  {pickingState.nextGroupName && (
                    <div className="stat-badge stat-next">
                      <span className="stat-label">Next</span>
                      <span className="stat-value">Group {pickingState.nextGroupName}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="header-right-section">
            <div className="header-actions-group">
              <button
                className="header-action-btn btn-nav"
                onClick={() => window.open(`/tournament/${code}/overview`, '_blank')}
                title="Tournament Overview"
              >
                <span className="btn-emoji">📊</span>
                <span className="btn-label">Overview</span>
              </button>
              <button
                className="header-action-btn btn-nav"
                onClick={() => window.open(`/tournament/${code}/live`, '_blank')}
                title="Live Screen"
              >
                <span className="btn-emoji">📺</span>
                <span className="btn-label">Live</span>
              </button>
              <button
                className="header-action-btn btn-nav"
                onClick={() => window.open(`/live/${code}`, '_blank')}
                title="Live Auction"
              >
                <span className="btn-emoji">🎯</span>
                <span className="btn-label">Auction</span>
              </button>
            </div>
            {pickingState && pickingState.initialized && (
              <div className="header-actions-group header-actions-secondary">
                <button
                  className="header-action-btn btn-icon-only"
                  onClick={() => setShowConfiguration(true)}
                  disabled={isLocked}
                  title="Settings"
                >
                  ⚙️
                </button>
                <button
                  className="header-action-btn btn-icon-only"
                  onClick={handleClearGroups}
                  disabled={isLocked}
                  title="Clear Groups"
                >
                  🗑️
                </button>
                <button
                  className={`header-action-btn btn-text ${isLocked ? 'btn-locked' : 'btn-unlocked'}`}
                  onClick={() => handleLockGroups(!isLocked)}
                  title={isLocked ? 'Unlock Groups' : 'Lock Groups'}
                >
                  {isLocked ? '🔒 Locked' : '🔓 Unlock'}
                </button>
                {allTeamsAssigned && (
                  <button
                    className="header-action-btn btn-text btn-primary"
                    onClick={handleSendToBroadcast}
                    title="Send to Broadcast"
                  >
                    📺 Broadcast
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {showConfiguration || !pickingState?.initialized ? (
          <div className="config-wrapper-compact">
            <GroupConfigurationPanel
              tournament={tournament}
              onInitialize={handleInitializeGroups}
              onCancel={() => {
                if (pickingState?.initialized) {
                  setShowConfiguration(false);
                }
              }}
              initializing={initializing}
            />
          </div>
        ) : (
          <div className="grouping-content one-screen-content">
            {/* Picking Interface */}
            {!allTeamsAssigned && (
              <div className="picking-interface-wrapper">
                <TeamPickingInterface
                  tournamentCode={code}
                  pickingState={pickingState}
                  onTeamPicked={handleTeamPicked}
                />
              </div>
            )}

            {/* Groups Display */}
            <div className="groups-display-section">
              <h2>Groups Overview</h2>
              <div className="groups-table-wrapper">
                <table className="groups-table">
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Teams</th>
                      <th>Progress</th>
                      <th>Status</th>
                      <th>Teams</th>
                      {pickingState?.avoidSameCity && <th>Cities</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => {
                      const isFull = group.teamCount >= group.capacity;
                      const progress = group.capacity > 0 ? (group.teamCount / group.capacity) * 100 : 0;
                      const citiesInGroup = new Set();
                      group.teams.forEach(team => {
                        if (team.city) {
                          citiesInGroup.add(team.city);
                        }
                      });
                      
                      return (
                        <tr key={group.name} className={`group-table-row ${isFull ? 'full' : ''} ${group.locked ? 'locked' : ''}`}>
                          <td className="group-name-cell">
                            <strong>Group {group.name}</strong>
                          </td>
                          <td className="team-count-cell">
                            <span className="team-count-badge">
                              {group.teamCount} / {group.capacity}
                            </span>
                          </td>
                          <td className="progress-cell">
                            <div className="table-progress-bar">
                              <div
                                className="table-progress-fill"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="progress-percent">{Math.round(progress)}%</span>
                          </td>
                          <td className="status-cell">
                            {group.locked && <span className="status-badge locked-badge">🔒 Locked</span>}
                            {isFull && <span className="status-badge full-badge">Full</span>}
                            {!isFull && !group.locked && <span className="status-badge active-badge">Active</span>}
                          </td>
                          <td className="teams-cell">
                            <div className="table-teams-list">
                              {group.teams.length === 0 ? (
                                <span className="empty-teams">No teams</span>
                              ) : (
                                group.teams.map((team, index) => (
                                  <div key={team._id || index} className="table-team-item">
                                    {team.logo && (
                                      <img
                                        src={team.logo.startsWith('http') ? team.logo : `${API_BASE_URL}/${team.logo}`}
                                        alt={team.name}
                                        className="table-team-logo"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                    )}
                                    <span className="table-team-name">{team.name}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </td>
                          {pickingState?.avoidSameCity && (
                            <td className="cities-cell">
                              {citiesInGroup.size > 0 ? (
                                <span className="cities-text">{Array.from(citiesInGroup).join(', ')}</span>
                              ) : (
                                <span className="empty-cities">-</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Completion Message */}
            {allTeamsAssigned && (
              <div className="grouping-complete">
                <div className="complete-icon">✓</div>
                <h3>All Teams Assigned!</h3>
                <p>All teams have been successfully assigned to groups. You can now lock the groups and proceed.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </TournamentAdminLayout>
  );
}

export default TournamentGrouping;

