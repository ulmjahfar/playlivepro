import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { API_BASE_URL } from '../utils/apiConfig';

function GroupConfigurationPanel({ tournament, onInitialize, onCancel, initializing }) {
  const [numberOfGroups, setNumberOfGroups] = useState(4);
  const [teamsPerGroup, setTeamsPerGroup] = useState(4);
  const [avoidSameCity, setAvoidSameCity] = useState(false);
  const [spinDelay, setSpinDelay] = useState(3000);
  const [totalTeams, setTotalTeams] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/teams/${tournament.code}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTotalTeams(response.data.teams?.length || 0);
      } catch (error) {
        console.error('Error fetching teams:', error);
      } finally {
        setLoading(false);
      }
    };

    if (tournament) {
      fetchTeams();
      // Load existing settings if available
      if (tournament.groupingSettings) {
        setNumberOfGroups(tournament.groupingSettings.numberOfGroups || 4);
        setTeamsPerGroup(tournament.groupingSettings.teamsPerGroup || 4);
        setAvoidSameCity(tournament.groupingSettings.avoidSameCity || false);
        setSpinDelay(tournament.groupingSettings.spinDelay || 3000);
      }
    }
  }, [tournament]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const requiredTeams = numberOfGroups * teamsPerGroup;

    if (numberOfGroups < 1 || numberOfGroups > 26) {
      toast.error('Number of groups must be between 1 and 26');
      return;
    }

    if (teamsPerGroup < 1) {
      toast.error('Teams per group must be at least 1');
      return;
    }

    if (totalTeams < requiredTeams) {
      toast.error(`Not enough teams. Required: ${requiredTeams}, Available: ${totalTeams}`);
      return;
    }

    onInitialize({
      numberOfGroups,
      teamsPerGroup,
      avoidSameCity,
      spinDelay: parseInt(spinDelay) || 3000
    });
  };

  const requiredTeams = numberOfGroups * teamsPerGroup;
  const remainingSlots = totalTeams - requiredTeams;

  return (
    <div className="group-configuration-panel-compact">
      <div className="config-card-compact">
        <div className="config-header-compact">
          <h2>⚙️ Group Settings</h2>
        </div>

        <form onSubmit={handleSubmit} className="config-form-compact">
          <div className="form-row-compact">
            <div className="form-group-compact">
              <label htmlFor="numberOfGroups">
                <span className="label-icon">📊</span>
                Number of Groups
              </label>
              <input
                id="numberOfGroups"
                type="number"
                min="1"
                max="26"
                value={numberOfGroups}
                onChange={(e) => setNumberOfGroups(parseInt(e.target.value) || 1)}
                required
                disabled={initializing}
                placeholder="4"
              />
            </div>

            <div className="form-group-compact">
              <label htmlFor="teamsPerGroup">
                <span className="label-icon">👥</span>
                Teams per Group
              </label>
              <input
                id="teamsPerGroup"
                type="number"
                min="1"
                value={teamsPerGroup}
                onChange={(e) => setTeamsPerGroup(parseInt(e.target.value) || 1)}
                required
                disabled={initializing}
                placeholder="4"
              />
            </div>
          </div>

          <div className="form-row-compact">
            <div className="form-group-compact checkbox-group-compact">
              <label className="checkbox-label-compact">
                <input
                  type="checkbox"
                  checked={avoidSameCity}
                  onChange={(e) => setAvoidSameCity(e.target.checked)}
                  disabled={initializing}
                />
                <span className="checkbox-text-compact">
                  🏙️ Avoid Same City
                </span>
              </label>
            </div>

            <div className="form-group-compact">
              <label htmlFor="spinDelay">
                <span className="label-icon">⏱️</span>
                Spin Delay (ms)
              </label>
              <input
                id="spinDelay"
                type="number"
                min="1000"
                max="10000"
                step="500"
                value={spinDelay}
                onChange={(e) => setSpinDelay(parseInt(e.target.value) || 3000)}
                required
                disabled={initializing}
                placeholder="3000"
              />
            </div>
          </div>

          <div className="config-summary-compact">
            <div className="summary-item-compact">
              <span className="summary-icon">📋</span>
              <span className="summary-label-compact">Available:</span>
              <span className="summary-value-compact">{loading ? '...' : totalTeams}</span>
            </div>
            <div className="summary-item-compact">
              <span className="summary-icon">✅</span>
              <span className="summary-label-compact">Required:</span>
              <span className="summary-value-compact">{requiredTeams}</span>
            </div>
            <div className="summary-item-compact">
              <span className="summary-icon">📊</span>
              <span className="summary-label-compact">Remaining:</span>
              <span className={`summary-value-compact ${remainingSlots < 0 ? 'error' : ''}`}>
                {remainingSlots}
              </span>
            </div>
          </div>

          {remainingSlots < 0 && (
            <div className="config-warning-compact">
              ⚠️ Need {Math.abs(remainingSlots)} more team(s)
            </div>
          )}

          <div className="config-actions-compact">
            {onCancel && (
              <button
                type="button"
                className="btn-secondary-compact"
                onClick={onCancel}
                disabled={initializing}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="btn-primary-compact"
              disabled={initializing || remainingSlots < 0}
            >
              {initializing ? '⏳ Initializing...' : '🚀 Initialize Groups'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GroupConfigurationPanel;

