import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/apiConfig';
import { buildLogoUrl } from '../utils/playerCardUtils';
import './GroupingSummary.css';

function GroupingSummary({ tournamentCode, teams = [] }) {
  const [groupingData, setGroupingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  useEffect(() => {
    const fetchGroupingData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `${API_BASE_URL}/api/grouping/${tournamentCode}/groups`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data.success && response.data.groups && response.data.groups.length > 0) {
          setGroupingData(response.data);
        } else {
          setGroupingData(null);
        }
      } catch (error) {
        console.error('Error fetching grouping data:', error);
        setGroupingData(null);
      } finally {
        setLoading(false);
      }
    };

    if (tournamentCode) {
      fetchGroupingData();
    }
  }, [tournamentCode]);

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="grouping-summary-container">
        <div className="grouping-summary-loading">Loading grouping data...</div>
      </div>
    );
  }

  if (!groupingData || !groupingData.groups || groupingData.groups.length === 0) {
    return null; // Don't show anything if no groups exist
  }

  // Create a map of team IDs to team data for quick lookup
  const teamsMap = new Map();
  teams.forEach(team => {
    teamsMap.set(team._id?.toString(), team);
  });

  const totalTeamsInGroups = groupingData.groups.reduce((sum, group) => {
    return sum + (group.teams?.length || 0);
  }, 0);

  return (
    <div className="grouping-summary-container">
      <div className="grouping-summary-header">
        <h3 className="grouping-summary-title">🎯 Team Grouping Summary</h3>
        <div className="grouping-summary-stats">
          <span className="grouping-stat-item">
            <strong>{groupingData.groups.length}</strong> Groups
          </span>
          <span className="grouping-stat-item">
            <strong>{totalTeamsInGroups}</strong> Teams Assigned
          </span>
        </div>
      </div>

      <div className="grouping-summary-content">
        {groupingData.groups.map((group) => {
          const isExpanded = expandedGroups.has(group.name);
          const groupTeams = group.teams || [];
          const groupTeamsData = groupTeams
            .map(teamId => {
              const teamIdStr = teamId._id?.toString() || teamId?.toString();
              return teamsMap.get(teamIdStr) || teamId;
            })
            .filter(Boolean);

          return (
            <div key={group.name} className="grouping-group-card">
              <div 
                className="grouping-group-header"
                onClick={() => toggleGroup(group.name)}
              >
                <div className="grouping-group-title">
                  <span className="grouping-group-name">Group {group.name}</span>
                  <span className="grouping-group-count">
                    {groupTeamsData.length} {groupTeamsData.length === 1 ? 'Team' : 'Teams'}
                  </span>
                </div>
                <div className="grouping-group-toggle">
                  {isExpanded ? '▼' : '▶'}
                </div>
              </div>

              {isExpanded && (
                <div className="grouping-group-teams">
                  {groupTeamsData.length > 0 ? (
                    <div className="grouping-teams-grid">
                      {groupTeamsData.map((team, index) => {
                        const teamData = typeof team === 'object' && team._id ? team : teamsMap.get(team?._id?.toString() || team?.toString());
                        if (!teamData) return null;

                        return (
                          <div key={teamData._id || index} className="grouping-team-item">
                            <div className="grouping-team-logo">
                              {teamData.logo ? (
                                <img 
                                  src={buildLogoUrl(teamData.logo)} 
                                  alt={teamData.name}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextSibling) {
                                      e.target.nextSibling.style.display = 'flex';
                                    }
                                  }}
                                />
                              ) : null}
                              <div 
                                className="grouping-team-logo-placeholder"
                                style={{ display: teamData.logo ? 'none' : 'flex' }}
                              >
                                {teamData.name?.charAt(0) || '?'}
                              </div>
                            </div>
                            <div className="grouping-team-info">
                              <div className="grouping-team-name">{teamData.name}</div>
                              {teamData.city && (
                                <div className="grouping-team-city">📍 {teamData.city}</div>
                              )}
                              {teamData.playersBought !== undefined && (
                                <div className="grouping-team-stats">
                                  <span>{teamData.playersBought || 0} Players</span>
                                  {teamData.spent !== undefined && (
                                    <span>₹{teamData.spent?.toLocaleString() || '0'}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grouping-empty-group">No teams assigned yet</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GroupingSummary;

