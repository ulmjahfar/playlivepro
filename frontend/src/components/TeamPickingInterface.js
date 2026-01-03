import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { API_BASE_URL } from '../utils/apiConfig';

function TeamPickingInterface({ tournamentCode, pickingState, onTeamPicked }) {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showTimer, setShowTimer] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [pickingTeam, setPickingTeam] = useState(false);
  const timerIntervalRef = useRef(null);
  const timerTimeoutRef = useRef(null);

  // Cleanup timer on unmount - must be before any early returns
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (timerTimeoutRef.current) {
        clearTimeout(timerTimeoutRef.current);
      }
    };
  }, []);

  if (!pickingState || !pickingState.initialized) {
    return null;
  }

  const { groups, currentRound, nextGroupName, availableTeams, avoidSameCity, groupCities } = pickingState;

  const handleGroupClick = async (groupName) => {
    // Check if this is the next group to pick
    if (groupName !== nextGroupName) {
      toast.warning(`Please pick for Group ${nextGroupName} first (Round ${currentRound})`);
      return;
    }

    // Check if group is full
    const group = groups.find(g => g.name === groupName);
    if (group && group.teamCount >= group.capacity) {
      toast.warning(`Group ${groupName} is full`);
      return;
    }

    if (availableTeams.length === 0) {
      toast.warning('No available teams to pick from');
      return;
    }

    setSelectedGroup(groupName);
    setPickingTeam(true);
    setSelectedTeam(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/api/grouping/${tournamentCode}/pick-team-random`,
        { groupName },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        // Get spin delay from settings
        const spinDelay = pickingState?.settings?.spinDelay || 3000;
        const countdownSeconds = Math.ceil(spinDelay / 1000);
        
        // Set selected team
        setSelectedTeam(response.data.selectedTeam);
        
        // Start countdown timer
        setShowTimer(true);
        setCountdown(countdownSeconds);

        // Countdown interval
        let currentCount = countdownSeconds;
        timerIntervalRef.current = setInterval(() => {
          currentCount -= 1;
          setCountdown(currentCount);
          
          if (currentCount <= 0) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
            
            // Show selected team for 2 seconds, then refresh
            timerTimeoutRef.current = setTimeout(() => {
              setShowTimer(false);
              setPickingTeam(false);
              setSelectedGroup(null);
              setSelectedTeam(null);
              setCountdown(0);
              onTeamPicked(); // Refresh picking state
            }, 2000);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error picking team:', error);
      toast.error(error.response?.data?.message || 'Failed to assign team');
      setShowTimer(false);
      setPickingTeam(false);
      setSelectedGroup(null);
      setSelectedTeam(null);
      setCountdown(0);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  return (
    <div className="team-picking-interface">

      <div className="group-buttons-container">
        <h3>Select Group to Pick Team</h3>
        <div className="group-buttons-grid">
          {groups.map((group) => {
            const isNext = group.name === nextGroupName;
            const isFull = group.teamCount >= group.capacity;
            const isDisabled = !isNext || isFull;

            return (
              <button
                key={group.name}
                className={`group-pick-button ${isNext ? 'next-group' : ''} ${isFull ? 'full' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => handleGroupClick(group.name)}
                disabled={isDisabled}
                title={
                  isFull
                    ? `Group ${group.name} is full`
                    : !isNext
                    ? `Pick for Group ${nextGroupName} first`
                    : `Pick a team for Group ${group.name}`
                }
              >
                <div className="group-button-header">
                  <span className="group-name">Group {group.name}</span>
                  {isNext && <span className="next-badge">Next</span>}
                </div>
                <div className="group-button-stats">
                  <span className="team-count">
                    {group.teamCount} / {group.capacity}
                  </span>
                  {isFull && <span className="full-badge">Full</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showTimer && (
        <div className="picking-timer-overlay" onClick={() => {
          if (!pickingTeam && countdown === 0) {
            setShowTimer(false);
            setSelectedGroup(null);
            setSelectedTeam(null);
            setCountdown(0);
          }
        }}>
          <div className="picking-timer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="picking-timer-header">
              <h2>Picking Team for Group {selectedGroup}</h2>
            </div>
            <div className="picking-timer-content">
              {countdown > 0 ? (
                <>
                  <div className="timer-countdown">{countdown}</div>
                  <p className="timer-text">Picking team...</p>
                </>
              ) : selectedTeam ? (
                <>
                  <div className="timer-complete-icon">✓</div>
                  <h3 className="selected-team-name">{selectedTeam.name}</h3>
                  {selectedTeam.city && (
                    <p className="selected-team-city">📍 {selectedTeam.city}</p>
                  )}
                  <p className="timer-complete-text">Team assigned to Group {selectedGroup}!</p>
                </>
              ) : null}
            </div>
            {countdown === 0 && selectedTeam && (
              <button
                className="btn-primary timer-close-btn"
                onClick={() => {
                  setShowTimer(false);
                  setSelectedGroup(null);
                  setSelectedTeam(null);
                  setCountdown(0);
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamPickingInterface;

