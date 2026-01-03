import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../utils/apiConfig';
import './TournamentHero.css';

function TournamentHero({ tournament, pageTitle, pageActions = [], pageStats = [] }) {
  const navigate = useNavigate();
  const [copiedKey, setCopiedKey] = useState('');
  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  if (!tournament) {
    return null;
  }

  const formatDate = (date, options = { day: 'numeric', month: 'short', year: 'numeric' }) => {
    if (!date) return 'Not set';
    try {
      return new Date(date).toLocaleDateString('en-IN', options);
    } catch (err) {
      return '—';
    }
  };

  const formatDateRange = (start, end) => {
    if (!start && !end) return 'Dates not scheduled';
    const formattedStart = formatDate(start);
    const formattedEnd = formatDate(end);
    if (!start) return `Ends on ${formattedEnd}`;
    if (!end) return `Starts on ${formattedStart}`;
    return `${formattedStart} → ${formattedEnd}`;
  };

  const statusIcon = (status) => {
    switch (status) {
      case 'Active':
        return '🟢 Active';
      case 'Completed':
        return '🏁 Completed';
      case 'Upcoming':
      default:
        return '🕒 Upcoming';
    }
  };

  const handleCopy = (value, key, successMessage = 'Copied to clipboard') => {
    if (!value) {
      toast.warn('Nothing to copy yet.');
      return;
    }

    navigator.clipboard.writeText(value).then(() => {
      setCopiedKey(key);
      toast.success(successMessage);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopiedKey(''), 2000);
    }).catch(() => {
      toast.error('Clipboard permissions are blocked.');
    });
  };

  const defaultActions = [
    { label: 'View Overview', onClick: () => navigate(`/tournament/${tournament.code}/overview`) },
    { label: 'Registration Links', onClick: () => navigate(`/tournament/${tournament.code}/links`) },
    { label: 'Copy Overview Link', onClick: () => handleCopy(`${window.location.origin}/tournament/${tournament.code}/overview`, 'overviewLink', 'Overview link copied') }
  ];

  const actions = pageActions.length > 0 ? pageActions : defaultActions;

  return (
    <section className="tournament-hero">
      <div className="hero-primary">
        <div className="hero-logo">
          {tournament.logo ? (
            <img
              src={`${API_BASE_URL}/${tournament.logo}`}
              alt={`${tournament.name} logo`}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
                event.currentTarget.closest('.hero-logo').classList.add('fallback');
              }}
            />
          ) : (
            <span>🏆</span>
          )}
        </div>
        <div>
          <p className="hero-eyebrow">{pageTitle || 'Tournament'}</p>
          <h1>{tournament.name}</h1>
          <div className="hero-meta">
            <span>📍 {tournament.location || 'Venue TBA'}</span>
            <span>🏷️ {tournament.sport || 'Sport not set'}</span>
            <span>📅 {formatDateRange(tournament.startDate, tournament.endDate)}</span>
            {pageStats.map((stat, index) => (
              <span key={index}>
                {stat.icon} {stat.label}: {stat.value}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="hero-secondary">
        <span className={`status-pill status-${(tournament.status || 'Upcoming').toLowerCase()}`}>
          {statusIcon(tournament.status)}
        </span>
        <div className="hero-actions">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className={action.variant || ''}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
      <div className="hero-code">
        <span className="code-label">Tournament Code</span>
        <div className="code-row">
          <code>{tournament.code}</code>
          <button
            className={copiedKey === 'code' ? 'copied' : ''}
            onClick={() => handleCopy(tournament.code, 'code', 'Tournament code copied')}
          >
            {copiedKey === 'code' ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      </div>
    </section>
  );
}

export default TournamentHero;

