import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import './PlayerSelector.css';

function PlayerSelector({ tournamentCode, onPlayerSelected, availablePlayers = [], pendingPlayers = [] }) {
  const [mode, setMode] = useState('random'); // 'random', 'skill-grouped', 'team-priority', 'pending', 'last-call'
  const [animationType, setAnimationType] = useState('wheel'); // 'wheel', 'slot', 'cards'
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const wheelRef = useRef(null);
  const animationRef = useRef(null);

  const startWheelAnimation = (players) => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    wheel.classList.add('wheel-spinning');
    let rotation = 0;
    const duration = 3000;
    const startTime = Date.now();
    const totalRotations = 6;
    const targetIndex = Math.floor(Math.random() * players.length);
    const targetRotation = (360 / players.length) * targetIndex;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      rotation = 360 * totalRotations + targetRotation - (360 * totalRotations * easeOut);

      wheel.style.transform = `rotate(${rotation}deg)`;

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        wheel.classList.remove('wheel-spinning');
        const finalPlayer = players[targetIndex];
        setSelectedPlayer(finalPlayer);
        if (onPlayerSelected) {
          onPlayerSelected(finalPlayer);
        }
        setIsSelecting(false);
      }
    };

    animate();
  };

  const startSlotAnimation = (players) => {
    // Slot animation implementation
    const reels = document.querySelectorAll('.player-slot-reel');
    const duration = 2500;
    
    reels.forEach((reel, index) => {
      const reelContent = reel.querySelector('.slot-reel-content');
      if (reelContent) {
        reel.classList.add('spinning');
        reelContent.style.animation = `slotScroll ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
        
        setTimeout(() => {
          reel.classList.remove('spinning');
          reelContent.style.animation = '';
          if (index === reels.length - 1) {
            const randomPlayer = players[Math.floor(Math.random() * players.length)];
            setSelectedPlayer(randomPlayer);
            if (onPlayerSelected) {
              onPlayerSelected(randomPlayer);
            }
            setIsSelecting(false);
          }
        }, duration);
      }
    });
  };

  const startCardAnimation = (players) => {
    const cards = document.querySelectorAll('.player-card-shuffle');
    const duration = 2000;
    const randomPlayer = players[Math.floor(Math.random() * players.length)];

    cards.forEach((card, index) => {
      card.classList.add('flying');
      card.style.setProperty('--target-x', `${(index % 3) * 200 - 200}px`);
      
      setTimeout(() => {
        card.classList.remove('flying');
        if (index === cards.length - 1) {
          setSelectedPlayer(randomPlayer);
          if (onPlayerSelected) {
            onPlayerSelected(randomPlayer);
          }
          setIsSelecting(false);
        }
      }, duration);
    });
  };

  const handleSelect = async () => {
    if (isSelecting) return;

    let playersToSelect = [];
    
    switch (mode) {
      case 'random':
        playersToSelect = availablePlayers;
        break;
      case 'skill-grouped':
        // Group by role, then pick random from each group
        const grouped = availablePlayers.reduce((acc, player) => {
          const role = player.role || 'Other';
          if (!acc[role]) acc[role] = [];
          acc[role].push(player);
          return acc;
        }, {});
        const roles = Object.keys(grouped);
        const randomRole = roles[Math.floor(Math.random() * roles.length)];
        playersToSelect = grouped[randomRole] || availablePlayers;
        break;
      case 'team-priority':
        // For now, just use available players
        // Could be enhanced to prioritize based on team needs
        playersToSelect = availablePlayers;
        break;
      case 'pending':
        playersToSelect = pendingPlayers;
        break;
      case 'last-call':
        // Players who were in last call but not sold
        playersToSelect = pendingPlayers.filter(p => p.lastCallActive);
        break;
      default:
        playersToSelect = availablePlayers;
    }

    if (playersToSelect.length === 0) {
      toast.error('No players available for selection');
      return;
    }

    setIsSelecting(true);
    setSelectedPlayer(null);

    switch (animationType) {
      case 'wheel':
        startWheelAnimation(playersToSelect);
        break;
      case 'slot':
        startSlotAnimation(playersToSelect);
        break;
      case 'cards':
        startCardAnimation(playersToSelect);
        break;
      default:
        // Fallback: just select random
        const randomPlayer = playersToSelect[Math.floor(Math.random() * playersToSelect.length)];
        setSelectedPlayer(randomPlayer);
        if (onPlayerSelected) {
          onPlayerSelected(randomPlayer);
        }
        setIsSelecting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="player-selector">
      <div className="player-selector-header">
        <h3>🎯 Advanced Player Selector</h3>
      </div>

      <div className="selector-controls">
        <div className="control-group">
          <label>Selection Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} disabled={isSelecting}>
            <option value="random">Random</option>
            <option value="skill-grouped">Skill Grouped</option>
            <option value="team-priority">Team Priority</option>
            <option value="pending">Pending List</option>
            <option value="last-call">Last Call Revival</option>
          </select>
        </div>

        <div className="control-group">
          <label>Animation Type</label>
          <div className="animation-type-buttons">
            <button
              className={`anim-btn ${animationType === 'wheel' ? 'active' : ''}`}
              onClick={() => setAnimationType('wheel')}
              disabled={isSelecting}
            >
              🎡 Wheel
            </button>
            <button
              className={`anim-btn ${animationType === 'slot' ? 'active' : ''}`}
              onClick={() => setAnimationType('slot')}
              disabled={isSelecting}
            >
              🎰 Slot
            </button>
            <button
              className={`anim-btn ${animationType === 'cards' ? 'active' : ''}`}
              onClick={() => setAnimationType('cards')}
              disabled={isSelecting}
            >
              🃏 Cards
            </button>
          </div>
        </div>

        <button
          className="btn-select-player"
          onClick={handleSelect}
          disabled={isSelecting || availablePlayers.length === 0}
        >
          {isSelecting ? '⏳ Selecting...' : '🎲 Select Player'}
        </button>
      </div>

      <div className="animation-area">
        {animationType === 'wheel' && (
          <div className="wheel-container">
            <div ref={wheelRef} className="player-selection-wheel">
              {availablePlayers.slice(0, 12).map((player, index) => (
                <div
                  key={player._id || index}
                  className="wheel-player"
                  style={{ transform: `rotate(${(360 / Math.min(availablePlayers.length, 12)) * index}deg)` }}
                >
                  <div className="wheel-player-photo">
                    {player.photo ? (
                      <img src={player.photo} alt={player.name} />
                    ) : (
                      <div className="wheel-player-placeholder">👤</div>
                    )}
                  </div>
                  <span className="wheel-player-name">{player.name}</span>
                </div>
              ))}
            </div>
            <div className="wheel-center">🎯</div>
          </div>
        )}

        {animationType === 'slot' && (
          <div className="slot-machine-container">
            <div className="player-slot-reel">
              <div className="slot-reel-content">
                {availablePlayers.map((player, index) => (
                  <div key={player._id || index} className="slot-player">
                    <img src={player.photo || '/default-photo.png'} alt={player.name} />
                    <span>{player.name}</span>
                  </div>
                ))}
                {/* Duplicate for seamless loop */}
                {availablePlayers.map((player, index) => (
                  <div key={`dup-${player._id || index}`} className="slot-player">
                    <img src={player.photo || '/default-photo.png'} alt={player.name} />
                    <span>{player.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {animationType === 'cards' && (
          <div className="cards-container">
            {availablePlayers.slice(0, 20).map((player, index) => (
              <div
                key={player._id || index}
                className="player-card-shuffle"
                style={{
                  left: `${(index % 5) * 120}px`,
                  top: `${Math.floor(index / 5) * 150}px`
                }}
              >
                <div className="card-photo">
                  {player.photo ? (
                    <img src={player.photo} alt={player.name} />
                  ) : (
                    <div className="card-placeholder">👤</div>
                  )}
                </div>
                <div className="card-name">{player.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPlayer && (
        <div className="selected-player-display">
          <h4>Selected Player:</h4>
          <div className="selected-player-info">
            <img src={selectedPlayer.photo || '/default-photo.png'} alt={selectedPlayer.name} />
            <div>
              <strong>{selectedPlayer.name}</strong>
              <div>{selectedPlayer.playerId} • {selectedPlayer.role} • {selectedPlayer.city}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerSelector;

