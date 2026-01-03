import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from './utils/apiConfig';

// Helper function to build photo URL
const buildPhotoUrl = (photo) => {
  if (!photo) return null;
  if (photo.startsWith('http')) return photo;
  if (photo.startsWith('uploads')) {
    return `${API_BASE_URL}/${photo}`;
  }
  if (photo.startsWith('/')) {
    return `${API_BASE_URL}${photo}`;
  }
  return `${API_BASE_URL}/uploads/${photo}`;
};

// Helper function to build logo URL
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

function TeamReports({ tournamentCode, onViewDetails, compareMode = false }) {
  const [teams, setTeams] = useState([]);
  const [teamDetails, setTeamDetails] = useState({});
  const [teamPlayers, setTeamPlayers] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchTeams = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auctions/live-teams/${tournamentCode}`);
      setTeams(response.data.teams);
      // Fetch details for each team
      const detailsPromises = response.data.teams.map(team =>
        axios.get(`${API_BASE_URL}/api/auctions/live-team-details/${tournamentCode}/${team._id}`)
      );
      const detailsResponses = await Promise.all(detailsPromises);
      const detailsMap = {};
      const playersMap = {};
      detailsResponses.forEach((res, idx) => {
        const teamId = response.data.teams[idx]._id;
        detailsMap[teamId] = res.data.team;
        playersMap[teamId] = res.data.players || [];
      });
      setTeamDetails(detailsMap);
      setTeamPlayers(playersMap);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching teams:', error);
      setLoading(false);
    }
  }, [tournamentCode]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  if (loading) return <div className="loading">Loading teams...</div>;

  // Comparison Table View
  if (compareMode) {
    return (
      <div className="team-reports">
        <h3>Team Comparison</h3>
        <div className="teams-comparison-table-container">
          <table className="teams-comparison-table">
            <thead>
              <tr>
                <th>Team</th>
                {teams.map(team => (
                  <th key={team._id} className="team-column">
                    <div className="comparison-team-header">
                      <img src={buildLogoUrl(team.logo)} alt={team.name} className="comparison-team-logo" />
                      <span>{team.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="stat-label">Budget</td>
                {teams.map(team => {
                  const budget = team.budget || teamDetails[team._id]?.budget || 0;
                  return (
                    <td key={team._id} className="stat-value">
                      ₹{budget.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="stat-label">Budget Used</td>
                {teams.map(team => {
                  const details = teamDetails[team._id];
                  const safeValue = (val) => (val && val > 0 ? val : 0);
                  const budgetUsed = safeValue(details?.budgetUsed || team.budgetUsed || team.totalSpent);
                  return (
                    <td key={team._id} className="stat-value">
                      ₹{budgetUsed.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="stat-label">Budget Balance</td>
                {teams.map(team => {
                  const details = teamDetails[team._id];
                  const safeValue = (val) => (val && val >= 0 ? val : 0);
                  const budgetBalance = safeValue(details?.budgetBalance || team.budgetBalance || team.currentBalance);
                  return (
                    <td key={team._id} className="stat-value">
                      ₹{budgetBalance.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="stat-label">Players Bought</td>
                {teams.map(team => {
                  const details = teamDetails[team._id];
                  const playersBought = details?.playersBought || team.playersBought || 0;
                  return (
                    <td key={team._id} className="stat-value">
                      {playersBought}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="stat-label">Highest Bid</td>
                {teams.map(team => {
                  const details = teamDetails[team._id];
                  const safeValue = (val) => (val && val > 0 ? val : 0);
                  const highestBid = safeValue(details?.highestBid);
                  return (
                    <td key={team._id} className="stat-value">
                      ₹{highestBid.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="stat-label">Max Possible Bid</td>
                {teams.map(team => {
                  const details = teamDetails[team._id];
                  const safeValue = (val) => (val && val >= 0 ? val : 0);
                  const maxBid = safeValue(details?.maxBid || details?.maxPossibleBid || team.maxBid || team.maxPossibleBid);
                  return (
                    <td key={team._id} className="stat-value gold">
                      ₹{maxBid.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="stat-label">Average Player Price</td>
                {teams.map(team => {
                  const details = teamDetails[team._id];
                  const players = teamPlayers[team._id] || [];
                  const playersBought = details?.playersBought || team.playersBought || players.length || 0;
                  const budgetUsed = details?.budgetUsed || team.budgetUsed || team.totalSpent || 0;
                  const avgPrice = playersBought > 0 ? Math.round(budgetUsed / playersBought) : 0;
                  return (
                    <td key={team._id} className="stat-value">
                      ₹{avgPrice.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="stat-label">Actions</td>
                {teams.map(team => (
                  <td key={team._id} className="stat-value">
                    <button 
                      className="view-details-btn-small" 
                      onClick={() => onViewDetails(team._id)}
                    >
                      View Details
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Regular Grid View
  return (
    <div className="team-reports">
      <h3>Team Reports</h3>
      <div className="teams-grid">
        {teams.map(team => {
          const details = teamDetails[team._id];
          const players = teamPlayers[team._id] || [];
          const playersWithPhotos = players.filter(p => p.photo).slice(0, 4); // Show max 4 players
          
          return (
            <div key={team._id} className="team-card">
              {/* Player Images Section */}
              <div className="team-players-images">
                {playersWithPhotos.length > 0 ? (
                  <div className="players-grid">
                    {playersWithPhotos.map((player, idx) => {
                      const photoUrl = buildPhotoUrl(player.photo);
                      return (
                        <div key={player._id || idx} className="player-image-wrapper">
                          {photoUrl ? (
                            <img 
                              src={photoUrl} 
                              alt={player.name || 'Player'} 
                              className="player-image"
                              onError={(e) => {
                                const wrapper = e.target.closest('.player-image-wrapper');
                                if (wrapper) {
                                  const placeholder = wrapper.querySelector('.player-image-placeholder');
                                  if (placeholder) {
                                    e.target.style.display = 'none';
                                    placeholder.style.display = 'flex';
                                  }
                                }
                              }}
                            />
                          ) : null}
                          <div className="player-image-placeholder" style={{ display: photoUrl ? 'none' : 'flex' }}>
                            {player.name ? player.name.charAt(0).toUpperCase() : '?'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="no-players-placeholder">
                    <span className="team-name-watermark">{team.name}</span>
                  </div>
                )}
              </div>
              
              <div className="team-header">
                <img src={buildLogoUrl(team.logo)} alt={team.name} className="team-logo" />
                <h4>{team.name}</h4>
              </div>
              <div className="team-stats">
                <div className="stat">
                  <span className="label">Budget</span>
                  <span className="value">₹{(team.budget || details?.budget || 0).toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="label">Used</span>
                  <span className="value">₹{(details?.budgetUsed || team.budgetUsed || team.totalSpent || 0).toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="label">Balance</span>
                  <span className="value">₹{(details?.budgetBalance || team.budgetBalance || team.currentBalance || 0).toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="label">Players</span>
                  <span className="value">{details?.playersBought || team.playersBought || 0}</span>
                </div>
                <div className="stat">
                  <span className="label">Highest Bid</span>
                  <span className="value">₹{(details?.highestBid || 0).toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="label">Max Possible Bid</span>
                  <span className="value gold">₹{(details?.maxBid || details?.maxPossibleBid || team.maxBid || team.maxPossibleBid || 0).toLocaleString()}</span>
                </div>
              </div>
              <button className="view-details-btn" onClick={() => onViewDetails(team._id)}>
                View Details
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TeamReports;
