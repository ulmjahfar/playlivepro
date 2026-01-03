import React, { useMemo, forwardRef, useEffect } from 'react';
import { API_BASE_URL } from '../utils/apiConfig';
import '../styles/player-card.css';

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
  
  // Handle File objects (from form upload)
  if (photo instanceof File || (typeof photo === 'object' && photo?.constructor?.name === 'File')) {
    return URL.createObjectURL(photo);
  }
  
  // Handle URL strings
  if (typeof photo === 'string') {
    if (photo.startsWith('http')) return photo;
    if (photo.startsWith('blob:')) return photo;
    if (photo.startsWith('uploads')) {
      return `${API_BASE_URL}/${photo}`;
    }
    if (photo.startsWith('/')) {
      return `${API_BASE_URL}${photo}`;
    }
    return `${API_BASE_URL}/uploads/${photo}`;
  }
  
  return null;
};

const PlayerCardPreview = forwardRef(({ player, tournament, playerId, hidePlayerId = false, successMessage }, ref) => {
  const theme = useMemo(() => resolveTournamentTheme(tournament), [tournament]);
  const logoUrl = useMemo(() => buildLogoUrl(tournament?.logo), [tournament]);
  
  // Handle both registeredPlayer object and form data
  const playerPhoto = player?.photo || null;
  const photoUrl = useMemo(() => {
    const url = buildPhotoUrl(playerPhoto);
    return url;
  }, [playerPhoto]);
  
  // Cleanup object URL on unmount if it was created from a File
  useEffect(() => {
    return () => {
      if (playerPhoto && (playerPhoto instanceof File || (typeof playerPhoto === 'object' && playerPhoto?.constructor?.name === 'File'))) {
        if (photoUrl && photoUrl.startsWith('blob:')) {
          URL.revokeObjectURL(photoUrl);
        }
      }
    };
  }, [playerPhoto, photoUrl]);
  
  const countryCode = player?.countryCode || '+91';
  const phoneNumber = player?.mobile 
    ? `${countryCode} ${player.mobile}`
    : 'Not provided';
  const role = player?.role || 'Role not set';
  const city = player?.city || 'City not provided';
  const playerName = player?.name || 'Player';

  // Extract player number from playerId (e.g., "PLTC001-002" -> "002" -> "02")
  const playerNumber = useMemo(() => {
    const id = playerId || player?.playerId || '';
    const match = id.match(/-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      return num < 10 ? `0${num}` : String(num);
    }
    return '01';
  }, [playerId, player]);

  if (!player || !tournament) {
    return (
      <div className="player-card-preview-loading">
        <div className="player-card-spinner" />
        <p>Loading card...</p>
      </div>
    );
  }

  return (
    <div
      className="pl-player-card pl-player-card--modal pl-player-card--enhanced"
      style={{ background: theme.gradient }}
      ref={ref}
    >
      {successMessage && (
        <div className="pl-card__success-message">
          <p>{successMessage}</p>
        </div>
      )}

      <div className="pl-card__header-enhanced">
        <div className="pl-card__logo-enhanced">
          {logoUrl ? (
            <img src={logoUrl} alt={`${tournament.name} logo`} />
          ) : (
            <span aria-hidden="true">🏆</span>
          )}
        </div>
        <div className="pl-card__tournament-info">
          <h1 className="pl-card__tournament-name" style={{ color: theme.accent }}>
            {tournament.name}
          </h1>
        </div>
      </div>

      <div className="pl-card__body-enhanced">
        <div className="pl-card__details-enhanced">
          <div className="pl-card__details-content">
            <span className="pl-card__player-name">{playerName.toUpperCase()}</span>
            <span>{role}</span>
            <span>{city}</span>
            <span>{phoneNumber}</span>
          </div>
        </div>
        <div className="pl-card__photo-enhanced">
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

      <div className="pl-card__powered-by">
        <span style={{ borderColor: theme.accent, color: theme.accent }}>
          POWERED BY PLAYLIVE
        </span>
      </div>
    </div>
  );
});

PlayerCardPreview.displayName = 'PlayerCardPreview';

export default PlayerCardPreview;

