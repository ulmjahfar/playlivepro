import React, { useState, useEffect, useRef, useCallback } from 'react';
import { buildLogoUrl } from '../utils/playerCardUtils';
import './TeamWheelPicker.css';

function TeamWheelPicker({ teams, onTeamSelected, spinDelay = 3000, selectedTeamId = null, isSpinning = false, onSpinComplete, isLivePage = false }) {
  const wheelRef = useRef(null);
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const selectedIndexRef = useRef(null);
  const animationStartedRef = useRef(false);

  // Calculate positions for team logos - hexagon for live page, circle for admin page
  const calculateTeamPositions = (teamCount, useHexagon = false) => {
    if (teamCount === 0) return [];
    const radius = 200; // Radius of the wheel
    const positions = [];
    
    if (useHexagon) {
      // Hexagon layout: 6 sides, teams distributed across sides
      const sides = 6;
      const teamsPerSide = Math.ceil(teamCount / sides);
      
      for (let i = 0; i < teamCount; i++) {
        const sideIndex = i % sides;
        const positionOnSide = Math.floor(i / sides);
        const angle = (sideIndex * 2 * Math.PI) / sides - Math.PI / 2; // Start from top
        const distance = radius + (positionOnSide * 40); // Stack teams on same side
        const x = distance * Math.cos(angle);
        const y = distance * Math.sin(angle);
        positions.push({ x, y, angle: (angle * 180) / Math.PI, side: sideIndex });
      }
    } else {
      // Circular layout
      const angleStep = (2 * Math.PI) / teamCount;
      for (let i = 0; i < teamCount; i++) {
        const angle = i * angleStep - Math.PI / 2; // Start from top
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        positions.push({ x, y, angle: (angle * 180) / Math.PI });
      }
    }
    return positions;
  };

  const teamPositions = calculateTeamPositions(teams.length, isLivePage);

  // Enhanced confetti animation
  const triggerConfetti = useCallback(() => {
    const confettiContainer = document.getElementById('confetti-container');
    if (!confettiContainer) return;

    const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#ffd700', '#00ff88', '#ff1493', '#00bfff', '#ff8c00', '#27ae60', '#3498db'];
    const shapes = ['circle', 'square', 'triangle'];

    // Create more falling confetti particles for better effect
    for (let i = 0; i < 180; i++) {
      const confetti = document.createElement('div');
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      confetti.className = `confetti-piece ${shape}`;
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.animationDelay = Math.random() * 0.8 + 's';
      confetti.style.animationDuration = (Math.random() * 2 + 3.5) + 's';

      const color = colors[Math.floor(Math.random() * colors.length)];
      if (shape === 'triangle') {
        confetti.style.borderBottomColor = color;
      } else {
        confetti.style.backgroundColor = color;
      }

      // Add random rotation
      confetti.style.setProperty('--rotation', `${Math.random() * 720 - 360}deg`);
      confettiContainer.appendChild(confetti);
      setTimeout(() => confetti.remove(), 6000);
    }

    // Enhanced burst effect at center
    const burstContainer = document.createElement('div');
    burstContainer.style.position = 'fixed';
    burstContainer.style.top = '50%';
    burstContainer.style.left = '50%';
    burstContainer.style.transform = 'translate(-50%, -50%)';
    burstContainer.style.width = '300px';
    burstContainer.style.height = '300px';
    burstContainer.style.pointerEvents = 'none';
    burstContainer.style.zIndex = '10000';
    document.body.appendChild(burstContainer);

    // Multiple burst layers for more impact
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 40; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        const size = 6 + Math.random() * 6;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.borderRadius = '50%';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.left = '50%';
        particle.style.top = '50%';
        particle.style.transform = 'translate(-50%, -50%)';
        particle.style.opacity = '0.9';

        const angle = (Math.PI * 2 * i) / 40 + (layer * Math.PI / 3);
        const distance = 80 + layer * 40 + Math.random() * 40;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        particle.style.animation = `confetti-burst ${1 + layer * 0.2}s ease-out forwards`;
        particle.style.animationDelay = `${layer * 0.1}s`;
        particle.style.setProperty('--end-x', `${x}px`);
        particle.style.setProperty('--end-y', `${y}px`);

        burstContainer.appendChild(particle);
      }
    }

    setTimeout(() => {
      if (document.body.contains(burstContainer)) {
        document.body.removeChild(burstContainer);
      }
    }, 2000);
  }, []);

  // Play clapping sound
  const playClappingSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create a clapping-like sound using multiple oscillators
      const duration = 0.5;
      const sampleRate = audioContext.sampleRate;
      const frameCount = sampleRate * duration;
      const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
      const channelData = buffer.getChannelData(0);

      // Generate clapping sound (white noise with envelope)
      for (let i = 0; i < frameCount; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 8); // Exponential decay
        channelData[i] = (Math.random() * 2 - 1) * envelope * 0.3;
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.warn('Could not play sound:', error);
    }
  }, []);

  // Enhanced easing function for more realistic deceleration
  const easeOutCubic = (t) => {
    return 1 - Math.pow(1 - t, 3);
  };

  // Removed unused easeInOutCubic function

  // Spin wheel animation with enhanced physics
  useEffect(() => {
    // Only start animation if we have all required data
    if (teams.length === 0 || !selectedTeamId) {
      if (!isSpinning && !animationStartedRef.current) {
        setIsAnimating(false);
        setRotation(0);
      }
      return;
    }
    
    // Only start animation when isSpinning becomes true and animation hasn't started yet
    if (!isSpinning) {
      // If animation already started, let it complete
      if (animationStartedRef.current) {
        return;
      }
      return;
    }
    
    // Prevent starting animation multiple times
    if (animationStartedRef.current) {
      return;
    }
    
    animationStartedRef.current = true;
    setIsAnimating(true);
    
    // Find selected team index
    const selectedIndex = teams.findIndex(t => t._id === selectedTeamId);
    if (selectedIndex === -1) {
      setIsAnimating(false);
      return;
    }

    selectedIndexRef.current = selectedIndex;
    
    // Calculate rotation to land on selected team
    const anglePerTeam = 360 / teams.length;
    // Position selected team at top (0 degrees) - add small offset for better visual alignment
    const targetAngle = -selectedIndex * anglePerTeam - (anglePerTeam / 2);
    // Add multiple full rotations for spinning effect (more rotations for longer delay)
    const baseRotations = 6; // Reduced from 8 for faster completion
    const rotationMultiplier = Math.max(1, Math.min(spinDelay / 1000, 2)); // Cap multiplier
    const fullRotations = baseRotations * rotationMultiplier;
    const finalRotation = fullRotations * 360 + targetAngle;

    // Start spinning
    setRotation(0);
    
    // Animate to final position with enhanced easing
    const startTime = Date.now();
    let animationFrameId = null;
    let isCancelled = false;
    const onCompleteCallback = onSpinComplete; // Store callback reference to avoid dependency issues
    const currentAnimationId = selectedTeamId; // Use selectedTeamId as animation identifier
    
    const animate = (currentTime) => {
      if (isCancelled) {
        setIsAnimating(false);
        return;
      }
      
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / spinDelay, 1);
      
      // Use different easing for different phases
      let easedProgress;
      const easeOutCubicLocal = (t) => 1 - Math.pow(1 - t, 3);
      
      if (progress < 0.6) {
        // Fast spinning phase - linear
        easedProgress = progress * 1.1;
      } else if (progress < 0.85) {
        // Deceleration phase - ease-out
        const decelProgress = (progress - 0.6) / 0.25;
        easedProgress = 0.6 * 1.1 + (0.25 * 1.1 * easeOutCubicLocal(decelProgress));
      } else {
        // Final slow phase - strong ease-out
        const finalProgress = (progress - 0.85) / 0.15;
        easedProgress = 0.85 * 1.1 + (0.15 * 1.1 * easeOutCubicLocal(finalProgress));
      }
      
      // Ensure we don't exceed 1.0
      easedProgress = Math.min(easedProgress, 1.0);
      
      // Add slight oscillation at the end for more realistic stop
      let finalProgress = easedProgress;
      if (progress > 0.95) {
        const oscillation = Math.sin((progress - 0.95) * 20) * 0.005 * (1 - progress);
        finalProgress = easedProgress + oscillation;
      }
      
      const currentRotation = finalRotation * finalProgress;
      setRotation(currentRotation);
      
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // Final snap to exact position
        setRotation(finalRotation);
        setIsAnimating(false);
        
        // Small delay before triggering effects for better UX
        setTimeout(() => {
          if (!isCancelled && onCompleteCallback) {
            triggerConfetti();
            playClappingSound();
            onCompleteCallback();
            animationStartedRef.current = false; // Reset for next spin
          }
        }, 200);
      }
    };
    
    animationFrameId = requestAnimationFrame(animate);
    
    // Cleanup function - only cancel if this specific animation is being replaced
    return () => {
      // Only cancel if selectedTeamId changed (new animation starting)
      if (selectedTeamId !== currentAnimationId) {
        isCancelled = true;
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        animationStartedRef.current = false;
      }
    };
  }, [isSpinning, selectedTeamId, teams, spinDelay, triggerConfetti, playClappingSound]);
  
  // Reset animation started flag when selectedTeamId changes (new pick)
  useEffect(() => {
    if (!selectedTeamId) {
      animationStartedRef.current = false;
      setIsAnimating(false);
    }
  }, [selectedTeamId]);

  if (teams.length === 0) {
    return (
      <div className="team-wheel-picker empty">
        <p>No teams available</p>
      </div>
    );
  }

  return (
    <div className={`team-wheel-picker ${isLivePage ? 'live-page' : ''}`}>
      <div className={`wheel-container ${isLivePage ? 'hexagon-container' : ''}`}>
        <div 
          className={`wheel ${isLivePage ? 'hexagon' : ''} ${isAnimating ? 'spinning' : ''}`}
          ref={wheelRef}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isAnimating ? 'none' : 'transform 0.3s ease-out'
          }}
        >
          {/* Center circle */}
          <div className="wheel-center">
            <div className="wheel-pointer">▼</div>
          </div>

          {/* Team logos positioned in circle */}
          {teams.map((team, index) => {
            const position = teamPositions[index];
            if (!position) return null;

            const isSelected = selectedTeamId === team._id && !isAnimating;
            const teamAngle = (index * 360) / teams.length;

            return (
              <div
                key={team._id}
                className={`team-logo-item ${isSelected ? 'selected' : ''}`}
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${position.x}px)`,
                  top: `calc(50% + ${position.y}px)`,
                  transform: `translate(-50%, -50%) rotate(${-rotation + teamAngle}deg)`,
                  transformOrigin: 'center center'
                }}
              >
                <div className="team-logo-wrapper">
                  {team.logo ? (
                    <img
                      src={buildLogoUrl(team.logo)}
                      alt={team.name}
                      className="team-logo"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div className="team-logo-placeholder" style={{ display: team.logo ? 'none' : 'flex' }}>
                    {team.name?.charAt(0) || '?'}
                  </div>
                </div>
                {isSelected && (
                  <div className="selected-indicator">
                    <div className="selected-ring"></div>
                    <div className="selected-glow"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {selectedTeamId && !isAnimating && (
        <div className={`selected-team-info ${isLivePage ? 'live-page-details' : ''}`}>
          {(() => {
            const selected = teams.find(t => t._id === selectedTeamId);
            return selected ? (
              <>
                {isLivePage && selected.logo && (
                  <div className="selected-team-logo-large">
                    <img
                      src={buildLogoUrl(selected.logo)}
                      alt={selected.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = 'flex';
                        }
                      }}
                    />
                    <div 
                      className="selected-team-logo-placeholder-large"
                      style={{ display: selected.logo ? 'none' : 'flex' }}
                    >
                      {selected.name?.charAt(0) || '?'}
                    </div>
                  </div>
                )}
                <h3>{selected.name}</h3>
                {!isLivePage && selected.city && <p>📍 {selected.city}</p>}
              </>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

export default TeamWheelPicker;

