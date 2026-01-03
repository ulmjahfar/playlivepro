import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { copyToClipboard } from './utils/clipboard';
import { API_BASE_URL } from './utils/apiConfig';
import './styles/player-card.css';
import html2canvas from 'html2canvas';

const TOURNAMENT_THEMES = {
  KPL2026: {
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #2563eb 100%)',
    accent: '#facc15',
    accentSoft: 'rgba(250, 204, 21, 0.35)',
    tagGradient: 'linear-gradient(135deg, #fbbf24 0%, #dda20a 60%, #b7791f 100%)',
    badgeAccent: '#eab308'
  },
  ULL2025: {
    gradient: 'linear-gradient(135deg, #172554 0%, #1d4ed8 45%, #4c1d95 100%)',
    accent: '#38bdf8',
    accentSoft: 'rgba(56, 189, 248, 0.35)',
    tagGradient: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 60%, #2563eb 100%)',
    badgeAccent: '#38bdf8'
  },
  PLAYLIVE2025: {
    gradient: 'linear-gradient(135deg, #1f2937 0%, #0f172a 50%, #334155 100%)',
    accent: '#c084fc',
    accentSoft: 'rgba(192, 132, 252, 0.35)',
    tagGradient: 'linear-gradient(135deg, #c084fc 0%, #a855f7 60%, #7c3aed 100%)',
    badgeAccent: '#c084fc'
  },
  default: {
    gradient: 'linear-gradient(135deg, #1f004f 0%, #312e81 40%, #3b82f6 100%)',
    accent: '#facc15',
    accentSoft: 'rgba(250, 204, 21, 0.3)',
    tagGradient: 'linear-gradient(135deg, #facc15 0%, #f59e0b 60%, #d97706 100%)',
    badgeAccent: '#fde047'
  }
};

const resolveTournamentTheme = (tournament) => {
  if (!tournament) return TOURNAMENT_THEMES.default;

  const { code = '', name = '' } = tournament;
  const key = code.toUpperCase();
  const nameKey = name.replace(/\s+/g, '').toUpperCase();

  return (
    TOURNAMENT_THEMES[key] ||
    TOURNAMENT_THEMES[nameKey] ||
    TOURNAMENT_THEMES.default
  );
};

const buildLogoUrl = (logo) => {
  if (!logo) return null;
  if (logo.startsWith('http')) return logo;
  if (logo.startsWith('uploads')) {
    return `${API_BASE_URL}/${logo}`;
  }
  if (logo.startsWith('/')) {
    return `${API_BASE_URL}${logo}`;
  }
  return `${API_BASE_URL}/${logo}`;
};

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

// Helper function to remove tournament code from player ID
const getPlayerIdNumber = (playerId) => {
  if (!playerId) return 'PL001';
  // If player ID contains a dash, take the part after the last dash
  if (playerId.includes('-')) {
    return playerId.split('-').pop();
  }
  return playerId;
};

// Helper function to wrap text based on max letters per line
const wrapText = (text, maxLettersPerLine, textWrap) => {
  if (!text || typeof text !== 'string') return text;
  
  // If textWrap is false or maxLettersPerLine is 0 or less, return original text
  if (!textWrap || !maxLettersPerLine || maxLettersPerLine <= 0) {
    return text;
  }
  
  // Split text into words
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    // If adding this word would exceed the limit, start a new line
    if (currentLine && (currentLine + ' ' + word).length > maxLettersPerLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      // If the word itself is longer than max, split it
      if (word.length > maxLettersPerLine) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        // Split long word into chunks
        for (let i = 0; i < word.length; i += maxLettersPerLine) {
          lines.push(word.substring(i, i + maxLettersPerLine));
        }
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.join('\n');
};

function PlayerCard() {
  const { playerId } = useParams();
  const [player, setPlayer] = useState(null);
  const [tournament, setTournament] = useState(null);
  const cardRef = useRef(null);

  const fetchPlayer = useCallback(async () => {
    try {
      // Assuming we have an endpoint to get player by ID
      const res = await axios.get(`${API_BASE_URL}/api/players/player/${playerId}`);
      setPlayer(res.data.player);
      // Fetch tournament details
      const tourRes = await axios.get(`${API_BASE_URL}/api/tournaments/${res.data.player.tournamentCode}`);
      setTournament(tourRes.data.tournament);
    } catch (err) {
      console.error(err);
    }
  }, [playerId]);

  useEffect(() => {
    fetchPlayer();
  }, [fetchPlayer]);

  const theme = useMemo(() => resolveTournamentTheme(tournament), [tournament]);
  const logoUrl = useMemo(() => buildLogoUrl(tournament?.logo), [tournament]);
  const photoUrl = useMemo(() => buildPhotoUrl(player?.photo), [player]);
  const countryCode = player?.countryCode || '+91';
  const phoneNumber = player?.mobile ? `${countryCode} ${player.mobile}` : 'Not provided';
  const role = player?.role ? player.role : 'Role not set';
  const city = player?.city ? player.city : 'City not provided';
  const playerName = player?.name || 'Player';
  
  // Check if custom design exists
  const customDesign = useMemo(() => tournament?.playerCardDesign, [tournament]);
  
  const getElementStyle = useCallback((elementKey) => {
    if (!customDesign || !customDesign[elementKey] || customDesign[elementKey]?.visible === false) {
      return {};
    }
    const element = customDesign[elementKey];
    if (!element || !element.position) {
      return {};
    }
    const style = {
      position: 'absolute',
      left: `${element.position.x}%`,
      top: `${element.position.y}%`,
      zIndex: element.zIndex !== undefined ? element.zIndex : 10
    };
    
    if (elementKey === 'logo') {
      style.width = `${element.size}px`;
      style.height = `${element.size}px`;
    } else if (elementKey === 'playerPhoto') {
      style.width = `${element.size.width}px`;
      style.height = `${element.size.height}px`;
      if (element.shape === 'circle') {
        style.borderRadius = '50%';
      } else if (element.shape === 'rounded') {
        style.borderRadius = '12px';
      }
      if (element.borderWidth > 0) {
        style.border = `${element.borderWidth}px solid ${element.borderColor}`;
      }
    } else if (['tournamentName', 'playerName', 'playerId', 'playerDetails'].includes(elementKey)) {
      style.fontSize = `${element.fontSize}px`;
      style.color = element.color;
      style.fontFamily = element.fontFamily;
      if (element.fontWeight) {
        style.fontWeight = element.fontWeight;
      }
      // Apply text alignment
      if (element.textAlign) {
        style.textAlign = element.textAlign;
      }
      // Apply text wrapping
      if (element.textWrap === false) {
        style.whiteSpace = 'nowrap';
      } else {
        style.whiteSpace = 'pre-wrap';
        style.wordWrap = 'break-word';
      }
      // Apply text stroke (outside the text using text-shadow)
      if (element.textStrokeEnabled === true) {
        const strokeWidth = element.textStrokeWidth || 1;
        const strokeColor = element.textStrokeColor || '#000000';
        // Create outline effect using multiple text-shadows positioned around the text
        const shadows = [];
        const steps = Math.max(8, Math.ceil(strokeWidth * 4)); // More steps for smoother outline
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          const x = Math.cos(angle) * strokeWidth;
          const y = Math.sin(angle) * strokeWidth;
          shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
        }
        // Add existing text shadow if any, otherwise just use stroke shadows
        if (element.shadowEnabled && !element.circularBorder) {
          const shadowColor = element.shadowColor || 'rgba(0, 0, 0, 0.5)';
          const shadowBlur = element.shadowBlur !== undefined ? element.shadowBlur : 4;
          const shadowOffsetX = element.shadowOffsetX !== undefined ? element.shadowOffsetX : 2;
          const shadowOffsetY = element.shadowOffsetY !== undefined ? element.shadowOffsetY : 2;
          shadows.push(`${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`);
        }
        style.textShadow = shadows.join(', ');
      } else {
        // No stroke, but keep existing shadow if enabled
        if (element.shadowEnabled && !element.circularBorder) {
          const shadowColor = element.shadowColor || 'rgba(0, 0, 0, 0.5)';
          const shadowBlur = element.shadowBlur !== undefined ? element.shadowBlur : 4;
          const shadowOffsetX = element.shadowOffsetX !== undefined ? element.shadowOffsetX : 2;
          const shadowOffsetY = element.shadowOffsetY !== undefined ? element.shadowOffsetY : 2;
          style.textShadow = `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`;
        } else {
          style.textShadow = 'none';
        }
      }
      // Add border for text fields if enabled
      if (element.circularBorder === true) {
        const size = Math.max(element.fontSize || 14, 20);
        const borderShape = element.borderShape || 'circle';
        const multiplier = element.borderSizeMultiplier !== undefined ? element.borderSizeMultiplier : 1.8;
        const borderSize = size * multiplier;
        const borderColor = element.borderColor || element.color || '#ffffff';
        style.width = `${borderSize}px`;
        style.height = `${borderSize}px`;
        style.borderRadius = borderShape === 'circle' ? '50%' : '4px';
        style.border = `2px solid ${borderColor}`;
        style.backgroundColor = borderColor;
        style.display = 'flex';
        style.alignItems = 'center';
        style.justifyContent = 'center';
        style.padding = '0';
        style.minWidth = `${borderSize}px`;
        style.minHeight = `${borderSize}px`;
        
        // When border is enabled, use box-shadow on the border container
        if (element.shadowEnabled) {
          const shadowColor = element.shadowColor || 'rgba(0, 0, 0, 0.5)';
          const shadowBlur = element.shadowBlur !== undefined ? element.shadowBlur : 4;
          const shadowOffsetX = element.shadowOffsetX !== undefined ? element.shadowOffsetX : 2;
          const shadowOffsetY = element.shadowOffsetY !== undefined ? element.shadowOffsetY : 2;
          style.boxShadow = `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`;
        } else {
          style.boxShadow = 'none';
        }
        // Apply text stroke even when border is enabled (for text inside the border)
        if (element.textStrokeEnabled === true) {
          const strokeWidth = element.textStrokeWidth || 1;
          const strokeColor = element.textStrokeColor || '#000000';
          const shadows = [];
          const steps = Math.max(8, Math.ceil(strokeWidth * 4));
          for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const x = Math.cos(angle) * strokeWidth;
            const y = Math.sin(angle) * strokeWidth;
            shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
          }
          style.textShadow = shadows.join(', ');
        } else {
          style.textShadow = 'none';
        }
      } else {
        // When border is disabled, use normal text styling - remove all border-related styles
        // But respect width constraint if set (from drawing/resizing)
        if (element.width) {
          style.width = `${element.width}px`;
          style.maxWidth = `${element.width}px`;
          // Ensure text alignment works within the width
          style.display = 'block';
          style.boxSizing = 'border-box';
          // Use minimal padding to allow proper text alignment
          style.padding = '4px 2px';
        } else {
          style.width = 'auto';
          style.padding = '4px 8px';
        }
        style.height = 'auto';
        style.minWidth = 'auto';
        style.minHeight = 'auto';
        style.border = 'none';
        style.backgroundColor = 'transparent';
        style.borderRadius = '4px';
        style.boxShadow = 'none'; // No box shadow when border is disabled
        
        // Text stroke and shadow are already applied above (lines 213-246)
        // Don't override them here - they're already set correctly
      }
    }
    
    return style;
  }, [customDesign]);
  
  const getBackgroundStyle = useCallback(() => {
    if (customDesign?.background) {
      const bg = customDesign.background;
      if (bg.type === 'image' && bg.imageUrl) {
        const imageUrl = bg.imageUrl.startsWith('http') 
          ? bg.imageUrl 
          : `${API_BASE_URL}${bg.imageUrl.startsWith('/') ? '' : '/'}${bg.imageUrl}`;
        
        // Handle custom size
        let backgroundSize = bg.backgroundSize || 'cover';
        if (backgroundSize === 'custom') {
          const width = bg.customWidth || 100;
          const height = bg.customHeight || 100;
          const unit = bg.customUnit || '%';
          backgroundSize = `${width}${unit} ${height}${unit}`;
        }
        
        return {
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: backgroundSize,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: bg.opacity || 1
        };
      } else if (bg.type === 'gradient' && bg.gradient) {
        return { background: bg.gradient };
      }
    }
    return { background: theme.gradient };
  }, [customDesign, theme.gradient]);

  const downloadFromBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadCardAsImage = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: window.devicePixelRatio < 2 ? 2 : window.devicePixelRatio,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: cardRef.current.offsetWidth,
      height: cardRef.current.offsetHeight,
      onclone: (clonedDoc) => {
        // Ensure all styles are preserved in the cloned document
        const clonedCard = clonedDoc.querySelector('.pl-player-card[data-custom-design="true"]');
        if (clonedCard) {
          // Force text-shadow to be computed and applied
          const textElements = clonedCard.querySelectorAll('[style*="textShadow"], [style*="text-shadow"]');
          textElements.forEach(el => {
            const computedStyle = window.getComputedStyle(el);
            if (computedStyle.textShadow && computedStyle.textShadow !== 'none') {
              el.style.textShadow = computedStyle.textShadow;
            }
          });
        }
      }
    });
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          downloadFromBlob(blob, `${player?.playerId || playerId}.jpg`);
        }
        resolve();
      }, 'image/jpeg', 0.92);
    });
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/players/card-jpg/${playerId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Missing JPG');
      }
      const blob = await response.blob();
      downloadFromBlob(blob, `${player?.playerId || playerId}.jpg`);
    } catch (error) {
      console.warn('Falling back to client-side JPG generation:', error);
      await downloadCardAsImage();
    }
  };

  const handleShareWhatsApp = () => {
    const url = `${window.location.origin}/player-card/${playerId}`;
    const messageLines = [
      '🏏 Player Registration Successful!',
      `Tournament: ${tournament?.name ?? 'PlayLive Tournament'}`,
      `Player: ${playerName}`,
      `Role: ${role}`,
      `Player ID: ${player?.playerId ?? playerId}`,
      `Mobile: ${phoneNumber}`,
      '',
      'Official RP Card:',
      url
    ];
    const message = messageLines.join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/player-card/${playerId}`;
    const success = await copyToClipboard(url);
    if (success) {
      alert('Link copied to clipboard!');
    } else {
      alert('Failed to copy link. Please try again.');
    }
  };

  const handleDownloadPDF = () => {
    window.open(`${API_BASE_URL}/player_cards/${playerId}.pdf`, '_blank');
  };

  if (!player || !tournament) {
    return (
      <div className="player-card-page__loading">
        <div className="player-card-spinner" />
        <p>Loading RP Card…</p>
      </div>
    );
  }

  return (
    <div className="player-card-page">
      <div className="player-card-layout">
        <div
          className="pl-player-card"
          style={
            customDesign 
              ? {
                  ...getBackgroundStyle(),
                  width: `${customDesign.cardDimensions?.width || 600}px`,
                  height: `${customDesign.cardDimensions?.height || 800}px`,
                  maxWidth: '100%'
                }
              : { background: theme.gradient }
          }
          data-custom-design={customDesign ? 'true' : 'false'}
          ref={cardRef}
        >
          {/* For custom design, render all elements as direct children for proper z-index stacking */}
          {customDesign ? (
            <>
              {/* Render shapes */}
              {customDesign.shapes && customDesign.shapes.map((shape, index) => {
                if (!shape.visible) return null;
            const shapeStyle = {
              position: 'absolute',
              left: `${shape.position.x}%`,
              top: `${shape.position.y}%`,
              width: `${shape.size.width}px`,
              height: `${shape.size.height}px`,
              backgroundColor: shape.color,
              opacity: shape.opacity || 1,
              borderRadius: shape.type === 'ellipse' ? '50%' : `${shape.borderRadius || 0}px`,
              zIndex: shape.zIndex !== undefined ? shape.zIndex : 5,
              pointerEvents: 'none'
            };
            
            // Add shadow for shapes if enabled
            if (shape.shadowEnabled) {
              const shadowColor = shape.shadowColor || 'rgba(0, 0, 0, 0.5)';
              const shadowBlur = shape.shadowBlur !== undefined ? shape.shadowBlur : 4;
              const shadowOffsetX = shape.shadowOffsetX !== undefined ? shape.shadowOffsetX : 2;
              const shadowOffsetY = shape.shadowOffsetY !== undefined ? shape.shadowOffsetY : 2;
              shapeStyle.boxShadow = `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`;
            }
                return (
                  <div key={`shape-${index}`} style={shapeStyle} />
                );
              })}
              
              {/* Render all custom design elements as direct children */}
              {customDesign.logo && customDesign.logo.visible !== false && (
                <div className="pl-card__logo" style={getElementStyle('logo')}>
                  {logoUrl ? (
                    <img src={logoUrl} alt={`${tournament.name} logo`} />
                  ) : (
                    <span aria-hidden="true">🏆</span>
                  )}
                </div>
              )}
              
              {customDesign.tournamentName && customDesign.tournamentName.visible !== false && (() => {
                const strokeStyle = customDesign.tournamentName.textStrokeEnabled ? {
                  textShadow: (() => {
                    const strokeWidth = customDesign.tournamentName.textStrokeWidth || 1;
                    const strokeColor = customDesign.tournamentName.textStrokeColor || '#000000';
                    const shadows = [];
                    const steps = Math.max(8, Math.ceil(strokeWidth * 4));
                    for (let i = 0; i < steps; i++) {
                      const angle = (i / steps) * Math.PI * 2;
                      const x = Math.cos(angle) * strokeWidth;
                      const y = Math.sin(angle) * strokeWidth;
                      shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
                    }
                    if (customDesign.tournamentName.shadowEnabled && !customDesign.tournamentName.circularBorder) {
                      const shadowColor = customDesign.tournamentName.shadowColor || 'rgba(0, 0, 0, 0.5)';
                      const shadowBlur = customDesign.tournamentName.shadowBlur !== undefined ? customDesign.tournamentName.shadowBlur : 4;
                      const shadowOffsetX = customDesign.tournamentName.shadowOffsetX !== undefined ? customDesign.tournamentName.shadowOffsetX : 2;
                      const shadowOffsetY = customDesign.tournamentName.shadowOffsetY !== undefined ? customDesign.tournamentName.shadowOffsetY : 2;
                      shadows.push(`${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`);
                    }
                    return shadows.join(', ');
                  })()
                } : {};
                return (
                  <div style={getElementStyle('tournamentName')}>
                    <p className="pl-card__tournament-label" style={strokeStyle}>Official Tournament</p>
                    <h1 style={strokeStyle}>{wrapText(tournament.name, customDesign.tournamentName.maxLettersPerLine || 0, customDesign.tournamentName.textWrap !== false)}</h1>
                    <span className="pl-card__subtext" style={strokeStyle}>{tournament.code}</span>
                  </div>
                );
              })()}
              
              {customDesign.playerDetails && customDesign.playerDetails.visible !== false && (
                <div className="pl-card__details" style={getElementStyle('playerDetails')}>
                  <ul>
                    <li>
                      <span className="detail-icon">✔</span>
                      <span style={{
                        textShadow: customDesign.playerDetails.textStrokeEnabled ? (() => {
                          const strokeWidth = customDesign.playerDetails.textStrokeWidth || 1;
                          const strokeColor = customDesign.playerDetails.textStrokeColor || '#000000';
                          const shadows = [];
                          const steps = Math.max(8, Math.ceil(strokeWidth * 4));
                          for (let i = 0; i < steps; i++) {
                            const angle = (i / steps) * Math.PI * 2;
                            const x = Math.cos(angle) * strokeWidth;
                            const y = Math.sin(angle) * strokeWidth;
                            shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
                          }
                          return shadows.join(', ');
                        })() : 'none'
                      }}>{wrapText(customDesign.playerDetails.showLabels !== false ? `Role: ${role}` : role, customDesign.playerDetails.maxLettersPerLine || 0, customDesign.playerDetails.textWrap !== false)}</span>
                    </li>
                    <li>
                      <span className="detail-icon">✔</span>
                      <span style={{
                        textShadow: customDesign.playerDetails.textStrokeEnabled ? (() => {
                          const strokeWidth = customDesign.playerDetails.textStrokeWidth || 1;
                          const strokeColor = customDesign.playerDetails.textStrokeColor || '#000000';
                          const shadows = [];
                          const steps = Math.max(8, Math.ceil(strokeWidth * 4));
                          for (let i = 0; i < steps; i++) {
                            const angle = (i / steps) * Math.PI * 2;
                            const x = Math.cos(angle) * strokeWidth;
                            const y = Math.sin(angle) * strokeWidth;
                            shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
                          }
                          return shadows.join(', ');
                        })() : 'none'
                      }}>{wrapText(customDesign.playerDetails.showLabels !== false ? `City: ${city}` : city, customDesign.playerDetails.maxLettersPerLine || 0, customDesign.playerDetails.textWrap !== false)}</span>
                    </li>
                    <li>
                      <span className="detail-icon">✔</span>
                      <span style={{
                        textShadow: customDesign.playerDetails.textStrokeEnabled ? (() => {
                          const strokeWidth = customDesign.playerDetails.textStrokeWidth || 1;
                          const strokeColor = customDesign.playerDetails.textStrokeColor || '#000000';
                          const shadows = [];
                          const steps = Math.max(8, Math.ceil(strokeWidth * 4));
                          for (let i = 0; i < steps; i++) {
                            const angle = (i / steps) * Math.PI * 2;
                            const x = Math.cos(angle) * strokeWidth;
                            const y = Math.sin(angle) * strokeWidth;
                            shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
                          }
                          return shadows.join(', ');
                        })() : 'none'
                      }}>{wrapText(customDesign.playerDetails.showLabels !== false ? `Mobile: ${phoneNumber}` : phoneNumber, customDesign.playerDetails.maxLettersPerLine || 0, customDesign.playerDetails.textWrap !== false)}</span>
                    </li>
                  </ul>
                </div>
              )}
              
              {customDesign.playerPhoto && customDesign.playerPhoto.visible !== false && (
                <div className="pl-card__photo" style={getElementStyle('playerPhoto')}>
                  {photoUrl ? (
                    <img src={photoUrl} alt={`${playerName} portrait`} />
                  ) : (
                    <div className="pl-card__photo-placeholder">
                      <span>📸</span>
                      <p>No portrait uploaded</p>
                    </div>
                  )}
                </div>
              )}
              
              {customDesign.playerName && customDesign.playerName.visible !== false && (
                <div className="pl-card__tag-name" style={getElementStyle('playerName')}>
                  {wrapText(playerName.toUpperCase(), customDesign.playerName.maxLettersPerLine || 0, customDesign.playerName.textWrap !== false)}
                </div>
              )}
              
              {customDesign.playerId && customDesign.playerId.visible !== false && (
                <div className="pl-card__tag-id" style={getElementStyle('playerId')}>
                  {wrapText(getPlayerIdNumber(player.playerId), customDesign.playerId.maxLettersPerLine || 0, customDesign.playerId.textWrap !== false)}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Default design - use containers */}
              <div className="pl-card__header">
                <div className="pl-card__branding">
                  <div className="pl-card__logo">
                    {logoUrl ? (
                      <img src={logoUrl} alt={`${tournament.name} logo`} />
                    ) : (
                      <span aria-hidden="true">🏆</span>
                    )}
                  </div>
                  <div>
                    <p className="pl-card__tournament-label">Official Tournament</p>
                    <h1>{tournament.name}</h1>
                    <span className="pl-card__subtext">{tournament.code}</span>
                  </div>
                </div>
                <div
                  className="pl-card__badge"
                  style={{ borderColor: theme.accentSoft, color: theme.accent }}
                >
                  Powered by PlayLive
                </div>
              </div>

              <div className="pl-card__body">
                <div className="pl-card__details">
                  <ul>
                    <li>
                      <span className="detail-icon">✔</span>
                      <span>{role}</span>
                    </li>
                    <li>
                      <span className="detail-icon">✔</span>
                      <span>{city}</span>
                    </li>
                    <li>
                      <span className="detail-icon">✔</span>
                      <span>{phoneNumber}</span>
                    </li>
                  </ul>
                </div>
                <div className="pl-card__photo">
                  {photoUrl ? (
                    <img src={photoUrl} alt={`${playerName} portrait`} />
                  ) : (
                    <div className="pl-card__photo-placeholder">
                      <span>📸</span>
                      <p>No portrait uploaded</p>
                    </div>
                  )}
                </div>
              </div>

              <footer className="pl-card__tag" style={{ background: theme.tagGradient }}>
                <div className="pl-card__tag-name">{playerName.toUpperCase()}</div>
                <div className="pl-card__tag-id">
                  Player ID&nbsp;
                  <strong>{getPlayerIdNumber(player.playerId)}</strong>
                </div>
              </footer>
            </>
          )}
        </div>
      </div>

      <aside className="player-card-actions">
        <button onClick={handleDownload} className="player-card-action primary">
          🖼️ Download RP Card (JPG)
        </button>
        <button onClick={handleDownloadPDF} className="player-card-action primary-outline">
          📄 Download RP Card (PDF)
        </button>
        <button onClick={handleShareWhatsApp} className="player-card-action whatsapp">
          💬 Share via WhatsApp
        </button>
        <button onClick={handleCopyLink} className="player-card-action ghost">
          🔗 Copy RP Card Link
        </button>
      </aside>

      <div className="player-card-metadata">
        <div>
          <span>Sport</span>
          <strong>{tournament.sport || '—'}</strong>
        </div>
        <div>
          <span>Registered</span>
          <strong>{new Date(player.registeredAt).toLocaleDateString()}</strong>
        </div>
        <div>
          <span>Location</span>
          <strong>{tournament.location || 'TBA'}</strong>
        </div>
      </div>
    </div>
  );
}

export default PlayerCard;
