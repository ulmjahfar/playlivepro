import React, { useState } from 'react';
import MatchEditModal from './MatchEditModal';
import { API_BASE_URL } from '../utils/apiConfig';
import './MatchList.css';

function MatchList({ matches, tournamentCode, onMatchUpdated, onRegenerate }) {
  const [editingMatch, setEditingMatch] = useState(null);
  const [filterRound, setFilterRound] = useState(null);

  if (!matches || matches.length === 0) {
    return (
      <div className="match-list-empty">
        <div className="empty-icon">📋</div>
        <h3>No fixtures generated yet</h3>
        <p>Click "START FIXTURE" to generate matches</p>
      </div>
    );
  }

  // Group matches by round
  const matchesByRound = {};
  matches.forEach(match => {
    if (!matchesByRound[match.round]) {
      matchesByRound[match.round] = [];
    }
    matchesByRound[match.round].push(match);
  });

  const rounds = Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b));
  const filteredRounds = filterRound ? [filterRound] : rounds;

  const handleEditMatch = (match) => {
    setEditingMatch(match);
  };

  const handleMatchSaved = () => {
    setEditingMatch(null);
    if (onMatchUpdated) {
      onMatchUpdated();
    }
  };

  const buildLogoUrl = (logo) => {
    if (!logo) return '/default-logo.png';
    if (logo.startsWith('http')) return logo;
    if (logo.startsWith('uploads')) {
      return `${API_BASE_URL}/${logo}`;
    }
    if (logo.startsWith('/')) {
      return `${API_BASE_URL}${logo}`;
    }
    return `${API_BASE_URL}/${logo}`;
  };

  return (
    <div className="match-list-container">
      <div className="match-list-header">
        <div className="match-list-filters">
          <label>
            Filter by Round:
            <select 
              value={filterRound || ''} 
              onChange={(e) => setFilterRound(e.target.value || null)}
              className="round-filter-select"
            >
              <option value="">All Rounds</option>
              {rounds.map(round => (
                <option key={round} value={round}>Round {round}</option>
              ))}
            </select>
          </label>
        </div>
        {onRegenerate && (
          <button className="regenerate-btn" onClick={onRegenerate}>
            🔄 Regenerate All
          </button>
        )}
      </div>

      <div className="match-list-stats">
        <span>Total Matches: {matches.length}</span>
        <span>Rounds: {rounds.length}</span>
      </div>

      {filteredRounds.map(round => (
        <div key={round} className="match-round-section">
          <h3 className="round-header">Round {round}</h3>
          <div className="matches-grid">
            {matchesByRound[round].map(match => (
              <div key={match._id} className="match-card">
                <div className="match-number">Match #{match.matchNo}</div>
                <div className="match-teams">
                  <div className={`match-team ${match.teamABye ? 'bye-team' : ''}`}>
                    {match.teamA ? (
                      <>
                        {match.teamA.logo && (
                          <img 
                            src={buildLogoUrl(match.teamA.logo)} 
                            alt={match.teamA.name}
                            className="team-logo-small"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <span className="team-name">{match.teamA.name}</span>
                      </>
                    ) : (
                      <span className="bye-indicator">BYE</span>
                    )}
                    {match.teamABye && <span className="bye-badge">BYE</span>}
                  </div>
                  
                  <div className="match-vs">VS</div>
                  
                  <div className={`match-team ${match.teamBBye ? 'bye-team' : ''}`}>
                    {match.teamB ? (
                      <>
                        {match.teamB.logo && (
                          <img 
                            src={buildLogoUrl(match.teamB.logo)} 
                            alt={match.teamB.name}
                            className="team-logo-small"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <span className="team-name">{match.teamB.name}</span>
                      </>
                    ) : (
                      <span className="bye-indicator">BYE</span>
                    )}
                    {match.teamBBye && <span className="bye-badge">BYE</span>}
                  </div>
                </div>
                
                {match.groupA && match.groupB && (
                  <div className="match-groups">
                    Group {match.groupA} vs Group {match.groupB}
                  </div>
                )}
                
                <button 
                  className="edit-match-btn"
                  onClick={() => handleEditMatch(match)}
                >
                  ✏️ Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {editingMatch && (
        <MatchEditModal
          isOpen={true}
          onClose={() => setEditingMatch(null)}
          match={editingMatch}
          tournamentCode={tournamentCode}
          onMatchSaved={handleMatchSaved}
        />
      )}
    </div>
  );
}

export default MatchList;

