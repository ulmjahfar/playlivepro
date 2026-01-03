import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../utils/apiConfig';
import './MatchEditModal.css';

function MatchEditModal({ isOpen, onClose, match, tournamentCode, onMatchSaved }) {
  const [teams, setTeams] = useState([]);
  const [teamA, setTeamA] = useState(null);
  const [teamB, setTeamB] = useState(null);
  const [teamABye, setTeamABye] = useState(false);
  const [teamBBye, setTeamBBye] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && tournamentCode) {
      fetchTeams();
    }
  }, [isOpen, tournamentCode]);

  useEffect(() => {
    if (match) {
      setTeamA(match.teamA?._id || null);
      setTeamB(match.teamB?._id || null);
      setTeamABye(match.teamABye || false);
      setTeamBBye(match.teamBBye || false);
      setScheduledDate(match.scheduledDate ? new Date(match.scheduledDate).toISOString().slice(0, 16) : '');
    }
  }, [match]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/api/teams/${tournamentCode}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTeams(response.data.teams || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!teamABye && !teamBBye && (!teamA || !teamB)) {
      toast.error('Please select both teams or mark one as BYE');
      return;
    }

    if (teamA && teamB && teamA === teamB) {
      toast.error('Team A and Team B cannot be the same');
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        teamA: teamABye ? null : teamA,
        teamB: teamBBye ? null : teamB,
        teamABye,
        teamBBye,
        scheduledDate: scheduledDate || null
      };

      const response = await axios.put(
        `${API_BASE_URL}/api/fixtures/${tournamentCode}/match/${match._id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success('Match updated successfully');
        if (onMatchSaved) {
          onMatchSaved();
        }
        onClose();
      }
    } catch (error) {
      console.error('Error updating match:', error);
      toast.error(error.response?.data?.message || 'Failed to update match');
    } finally {
      setIsSaving(false);
    }
  };

  const handleByeToggle = (team) => {
    if (team === 'A') {
      setTeamABye(!teamABye);
      if (!teamABye) {
        setTeamA(null);
      }
    } else {
      setTeamBBye(!teamBBye);
      if (!teamBBye) {
        setTeamB(null);
      }
    }
  };

  if (!isOpen) return null;

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="match-edit-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="match-edit-modal-header">
          <h2>Edit Match #{match?.matchNo}</h2>
          <button className="match-edit-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="match-edit-modal-body">
          {loading ? (
            <div className="loading-state">Loading teams...</div>
          ) : (
            <>
              {/* Team A Selection */}
              <div className="team-selection-section">
                <div className="team-selection-header">
                  <label className="team-selection-label">Team A</label>
                  <label className="bye-checkbox">
                    <input
                      type="checkbox"
                      checked={teamABye}
                      onChange={() => handleByeToggle('A')}
                    />
                    <span>BYE</span>
                  </label>
                </div>
                {!teamABye ? (
                  <select
                    value={teamA || ''}
                    onChange={(e) => setTeamA(e.target.value || null)}
                    className="team-select"
                  >
                    <option value="">Select Team A</option>
                    {teams.map(team => (
                      <option key={team._id} value={team._id}>
                        {team.name} {team.city ? `(${team.city})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="bye-indicator-display">BYE</div>
                )}
                {teamA && !teamABye && (
                  <div className="selected-team-preview">
                    {teams.find(t => t._id === teamA)?.logo && (
                      <img
                        src={buildLogoUrl(teams.find(t => t._id === teamA).logo)}
                        alt={teams.find(t => t._id === teamA).name}
                        className="team-preview-logo"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <span>{teams.find(t => t._id === teamA)?.name}</span>
                  </div>
                )}
              </div>

              <div className="vs-divider">VS</div>

              {/* Team B Selection */}
              <div className="team-selection-section">
                <div className="team-selection-header">
                  <label className="team-selection-label">Team B</label>
                  <label className="bye-checkbox">
                    <input
                      type="checkbox"
                      checked={teamBBye}
                      onChange={() => handleByeToggle('B')}
                    />
                    <span>BYE</span>
                  </label>
                </div>
                {!teamBBye ? (
                  <select
                    value={teamB || ''}
                    onChange={(e) => setTeamB(e.target.value || null)}
                    className="team-select"
                  >
                    <option value="">Select Team B</option>
                    {teams.map(team => (
                      <option key={team._id} value={team._id}>
                        {team.name} {team.city ? `(${team.city})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="bye-indicator-display">BYE</div>
                )}
                {teamB && !teamBBye && (
                  <div className="selected-team-preview">
                    {teams.find(t => t._id === teamB)?.logo && (
                      <img
                        src={buildLogoUrl(teams.find(t => t._id === teamB).logo)}
                        alt={teams.find(t => t._id === teamB).name}
                        className="team-preview-logo"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <span>{teams.find(t => t._id === teamB)?.name}</span>
                  </div>
                )}
              </div>

              {/* Scheduled Date */}
              <div className="date-selection-section">
                <label className="date-label">
                  Scheduled Date & Time (Optional)
                  <input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="date-input"
                  />
                </label>
              </div>
            </>
          )}
        </div>

        <div className="match-edit-modal-footer">
          <button className="match-edit-btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            className="match-edit-btn-primary"
            onClick={handleSave}
            disabled={isSaving || loading || (!teamABye && !teamBBye && (!teamA || !teamB))}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MatchEditModal;

