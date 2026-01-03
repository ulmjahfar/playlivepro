import React, { useState, useMemo } from 'react';
import { buildLogoUrl } from '../utils/playerCardUtils';

function TeamSelectionModal({
  isOpen,
  onClose,
  teams,
  groupName,
  avoidSameCity,
  conflictingCities,
  onSelectTeam
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTeams = useMemo(() => {
    let filtered = teams;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        team =>
          team.name?.toLowerCase().includes(query) ||
          team.city?.toLowerCase().includes(query) ||
          team.captainName?.toLowerCase().includes(query)
      );
    }

    // Filter by city conflict if avoidSameCity is enabled
    if (avoidSameCity && conflictingCities.size > 0) {
      filtered = filtered.filter(team => {
        if (!team.city) return true;
        const teamCity = team.city.toLowerCase().trim();
        return !Array.from(conflictingCities).some(
          city => city.toLowerCase().trim() === teamCity
        );
      });
    }

    return filtered;
  }, [teams, searchQuery, avoidSameCity, conflictingCities]);

  if (!isOpen) return null;

  const handleTeamClick = (team) => {
    // Check if team has city conflict
    if (avoidSameCity && team.city) {
      const teamCity = team.city.toLowerCase().trim();
      const hasConflict = Array.from(conflictingCities).some(
        city => city.toLowerCase().trim() === teamCity
      );
      if (hasConflict) {
        return; // Don't allow selection
      }
    }
    onSelectTeam(team._id);
  };

  const getTeamStatus = (team) => {
    if (!avoidSameCity || !team.city) return null;
    const teamCity = team.city.toLowerCase().trim();
    const hasConflict = Array.from(conflictingCities).some(
      city => city.toLowerCase().trim() === teamCity
    );
    return hasConflict ? 'conflict' : null;
  };

  return (
    <div className="team-selection-modal-overlay" onClick={onClose}>
      <div className="team-selection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Select Team for Group {groupName}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {avoidSameCity && conflictingCities.size > 0 && (
          <div className="modal-warning">
            <span className="warning-icon">⚠️</span>
            <span>
              Teams from these cities are already in Group {groupName}:{' '}
              {Array.from(conflictingCities).join(', ')}
            </span>
          </div>
        )}

        <div className="modal-search">
          <input
            type="text"
            placeholder="Search teams by name, city, or captain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="modal-content">
          {filteredTeams.length === 0 ? (
            <div className="no-teams">
              <p>No available teams found.</p>
              {searchQuery && <p className="hint">Try a different search term.</p>}
            </div>
          ) : (
            <div className="teams-grid">
              {filteredTeams.map((team) => {
                const status = getTeamStatus(team);
                const isDisabled = status === 'conflict';

                return (
                  <div
                    key={team._id}
                    className={`team-card ${isDisabled ? 'disabled' : 'clickable'}`}
                    onClick={() => !isDisabled && handleTeamClick(team)}
                    title={
                      isDisabled
                        ? `Cannot select: Another team from ${team.city} is already in Group ${groupName}`
                        : `Select ${team.name}`
                    }
                  >
                    {team.logo && (
                      <div className="team-logo">
                        <img
                          src={buildLogoUrl(team.logo)}
                          alt={team.name}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="team-info">
                      <h3 className="team-name">{team.name}</h3>
                      {team.city && (
                        <p className="team-city">
                          📍 {team.city}
                          {isDisabled && <span className="conflict-badge">Conflict</span>}
                        </p>
                      )}
                      {team.captainName && (
                        <p className="team-captain">👤 {team.captainName}</p>
                      )}
                    </div>
                    {isDisabled && (
                      <div className="team-overlay">
                        <span className="overlay-text">City Conflict</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <div className="teams-count">
            {filteredTeams.length} team{filteredTeams.length !== 1 ? 's' : ''} available
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeamSelectionModal;

