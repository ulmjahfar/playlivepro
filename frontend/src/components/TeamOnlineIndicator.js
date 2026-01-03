import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '../utils/apiConfig';
import './TeamOnlineIndicator.css';

function TeamOnlineIndicator({ tournamentCode, teams = [] }) {
  const [onlineTeams, setOnlineTeams] = useState(new Set());
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const newSocket = io(API_BASE_URL, {
      auth: { token }
    });

    newSocket.emit('join-auction', { tournamentCode });

    // Listen for team connection events
    newSocket.on('team:connected', (data) => {
      if (data.tournamentCode === tournamentCode && data.teamId) {
        setOnlineTeams(prev => new Set([...prev, String(data.teamId)]));
      }
    });

    newSocket.on('team:disconnected', (data) => {
      if (data.tournamentCode === tournamentCode && data.teamId) {
        setOnlineTeams(prev => {
          const newSet = new Set(prev);
          newSet.delete(String(data.teamId));
          return newSet;
        });
      }
    });

    // Request current online teams
    newSocket.emit('get-online-teams', { tournamentCode });

    newSocket.on('online-teams', (data) => {
      if (data.tournamentCode === tournamentCode && Array.isArray(data.teamIds)) {
        setOnlineTeams(new Set(data.teamIds.map(id => String(id))));
      }
    });

    // Periodically refresh online teams list
    const refreshInterval = setInterval(() => {
      newSocket.emit('get-online-teams', { tournamentCode });
    }, 10000); // Every 10 seconds

    setSocket(newSocket);

    return () => {
      clearInterval(refreshInterval);
      newSocket.disconnect();
    };
  }, [tournamentCode]);

  const onlineTeamsList = teams.filter(team => 
    onlineTeams.has(String(team._id))
  );

  if (onlineTeamsList.length === 0) {
    return (
      <div className="team-online-indicator">
        <div className="online-status">
          <span className="status-dot offline"></span>
          <span>No teams online</span>
        </div>
      </div>
    );
  }

  return (
    <div className="team-online-indicator">
      <div className="online-status">
        <span className="status-dot online"></span>
        <span>{onlineTeamsList.length} team{onlineTeamsList.length !== 1 ? 's' : ''} online</span>
      </div>
      <div className="online-teams-list">
        {onlineTeamsList.map(team => (
          <div key={team._id} className="online-team-item" title={team.name}>
            {team.logo ? (
              <img 
                src={team.logo.startsWith('http') ? team.logo : `${API_BASE_URL}/${team.logo}`}
                alt={team.name}
                className="team-logo-small"
                onError={(e) => {
                  e.target.src = `${API_BASE_URL}/default-logo.png`;
                }}
              />
            ) : (
              <div className="team-logo-placeholder">{team.name.charAt(0)}</div>
            )}
            <span className="team-name-short">{team.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TeamOnlineIndicator;

