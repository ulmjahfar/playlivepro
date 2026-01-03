import React from 'react';
import { buildLogoUrl } from '../utils/playerCardUtils';

function GroupCard({ group, avoidSameCity }) {
  const { name, teams, teamCount, capacity, locked } = group;
  const isFull = teamCount >= capacity;
  const progress = capacity > 0 ? (teamCount / capacity) * 100 : 0;

  // Get unique cities in group
  const citiesInGroup = new Set();
  teams.forEach(team => {
    if (team.city) {
      citiesInGroup.add(team.city);
    }
  });

  return (
    <div className={`group-card ${isFull ? 'full' : ''} ${locked ? 'locked' : ''}`}>
      <div className="group-card-header">
        <div className="group-title">
          <h3>Group {name}</h3>
          {locked && <span className="lock-badge">🔒 Locked</span>}
        </div>
        <div className="group-stats">
          <span className="team-count">
            {teamCount} / {capacity}
          </span>
          {isFull && <span className="full-badge">Full</span>}
        </div>
      </div>

      <div className="group-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="progress-text">{Math.round(progress)}%</span>
      </div>

      {avoidSameCity && citiesInGroup.size > 0 && (
        <div className="group-cities">
          <span className="cities-label">Cities:</span>
          <span className="cities-list">
            {Array.from(citiesInGroup).join(', ')}
          </span>
        </div>
      )}

      <div className="group-teams">
        {teams.length === 0 ? (
          <div className="empty-group">
            <p>No teams assigned yet</p>
          </div>
        ) : (
          <div className="teams-list">
            {teams.map((team, index) => (
              <div key={team._id || index} className="team-item">
                {team.logo && (
                  <div className="team-item-logo">
                    <img
                      src={buildLogoUrl(team.logo)}
                      alt={team.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="team-item-info">
                  <span className="team-item-name">{team.name}</span>
                  {team.city && (
                    <span className="team-item-city">📍 {team.city}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GroupCard;

