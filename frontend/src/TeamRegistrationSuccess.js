import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-team-registration-success.css';

function TeamRegistrationSuccess() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/teams/details/${teamId}`);
      setTeam(res.data.team);
      setTournament(res.data.tournament);
    } catch (err) {
      console.error('Error fetching team data:', err);
      setError(err.response?.data?.message || 'Unable to load team details right now.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  // Ensure scrolling works on this page
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    
    // Store original values
    const originalHtmlHeight = html.style.height;
    const originalHtmlOverflow = html.style.overflow;
    const originalBodyHeight = body.style.height;
    const originalBodyOverflow = body.style.overflow;
    const originalRootHeight = root ? root.style.height : '';
    const originalRootOverflow = root ? root.style.overflow : '';
    
    // Enable scrolling
    html.style.height = 'auto';
    html.style.overflow = 'auto';
    html.style.overflowX = 'hidden';
    body.style.height = 'auto';
    body.style.overflow = 'auto';
    body.style.overflowX = 'hidden';
    if (root) {
      root.style.height = 'auto';
      root.style.overflow = 'visible';
      root.style.overflowX = 'hidden';
    }
    
    // Cleanup: restore original values on unmount
    return () => {
      html.style.height = originalHtmlHeight;
      html.style.overflow = originalHtmlOverflow;
      body.style.height = originalBodyHeight;
      body.style.overflow = originalBodyOverflow;
      if (root) {
        root.style.height = originalRootHeight;
        root.style.overflow = originalRootOverflow;
      }
    };
  }, []);

  const confirmationPdfUrl = team?.confirmationPdf
    ? `${API_BASE_URL}/${team.confirmationPdf}`
    : null;

  const registrationLink = team?.tournamentCode
    ? `${window.location.origin}/register/team/${team.tournamentCode}`
    : window.location.origin;

  const handleDownloadConfirmation = () => {
    if (!confirmationPdfUrl) {
      alert('Confirmation slip is not ready yet. Please try again in a moment.');
      return;
    }
    window.open(confirmationPdfUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareWhatsApp = () => {
    if (!team || !tournament) return;
    const message = `✅ ${team.name} is officially registered for ${tournament.name}!\n\nTeam ID: ${team.teamId}\nCaptain: ${team.captainName}\nCity: ${team.city}\n\nSee details: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleCopySuccessLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Success page link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
      alert('Unable to copy link. Please copy it manually.');
    }
  };

  const handleRegisterAnother = () => {
    if (!team?.tournamentCode) return;
    navigate(`/register/team/${team.tournamentCode}`);
  };

  const handleBackHome = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="team-success-page">
        <div className="team-success-card">
          <div className="team-success-loading">Preparing your celebration...</div>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="team-success-page">
        <div className="team-success-card">
          <div className="team-success-error">
            <span>⚠️</span>
            <h2>We hit a snag</h2>
            <p>{error || 'Team details were not found.'}</p>
            <button className="team-success-btn secondary" onClick={handleBackHome}>
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="team-success-page">
      <div className="team-success-card">
        <div className="team-success-celebration">
          <span className="sparkle">✨</span>
          <span className="sparkle">🎉</span>
          <span className="sparkle">🏆</span>
        </div>

        <div className="team-success-heading">
          <div className="badge">Registration Complete</div>
          <h1>Welcome to {tournament?.name}</h1>
          <p>
            Team <strong>{team.name}</strong> is officially locked in for the tournament.
            Keep this confirmation handy for check-in day.
          </p>
        </div>

        <div className="team-success-overview">
          <div className="team-card">
            <div className="team-card-header">
              <div className="logo-ring">
                {team.logo ? (
                  <img
                    src={`${API_BASE_URL}/${team.logo}`}
                    alt={`${team.name} logo`}
                  />
                ) : (
                  <span className="logo-placeholder">{team.name.charAt(0)}</span>
                )}
              </div>
              <div>
                <h2>{team.name}</h2>
                <span>{tournament?.sport} • {team.city}</span>
              </div>
            </div>
            <div className="team-card-body">
              <div className="team-card-row">
                <span className="label">Team ID</span>
                <span className="value">{team.teamId}</span>
              </div>
              <div className="team-card-row">
                <span className="label">Captain</span>
                <span className="value">{team.captainName}</span>
              </div>
              <div className="team-card-row">
                <span className="label">Players Registered</span>
                <span className="value">{team.numberOfPlayers}</span>
              </div>
            </div>
          </div>

          <div className="tournament-card">
            <h3>Tournament Snapshot</h3>
            <div className="snapshot-grid">
              <div className="snapshot-item">
                <span className="label">Tournament</span>
                <span className="value">{tournament?.name || '—'}</span>
              </div>
              <div className="snapshot-item">
                <span className="label">Sport</span>
                <span className="value">{tournament?.sport || '—'}</span>
              </div>
              <div className="snapshot-item">
                <span className="label">Location</span>
                <span className="value">{tournament?.location || 'TBA'}</span>
              </div>
              <div className="snapshot-item">
                <span className="label">Contact</span>
                <span className="value">{team.mobile}</span>
              </div>
              <div className="snapshot-item">
                <span className="label">Email</span>
                <span className="value">{team.email}</span>
              </div>
              <div className="snapshot-item">
                <span className="label">City</span>
                <span className="value">{team.city}</span>
              </div>
            </div>

            {team.teamIcons?.length > 0 && (
              <div className="icon-stack">
                <span className="label">Team Vibe</span>
                <div className="icon-chips">
                  {team.teamIcons.map((icon, index) => (
                    <span key={index} className="icon-chip">{icon}</span>
                  ))}
                </div>
              </div>
            )}

            {team.guestPlayers?.length > 0 && (
              <div className="guest-section">
                <span className="label">Guest Delegation</span>
                <ul>
                  {team.guestPlayers.map((guest, index) => (
                    <li key={`${guest.name}-${index}`}>
                      <span>{guest.name}</span>
                      {guest.role && <small>{guest.role}</small>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <section className="team-success-download-card">
          <div className="download-card-hero">
            <div className="download-card-badge">Team Dashboard Kit</div>
            <h2>Keep your confirmation handy</h2>
            <p>
              Download the official PDF for check-in, share the success link with managers,
              or hop back into the dashboard to register more teams.
            </p>
          </div>

          <div className="download-card-actions">
            <button className="team-success-btn primary" onClick={handleDownloadConfirmation}>
              ⬇️ Download Confirmation PDF
            </button>
            <button className="team-success-btn secondary" onClick={handleShareWhatsApp}>
              💬 Share on WhatsApp
            </button>
            <button className="team-success-btn ghost" onClick={handleCopySuccessLink}>
              🔗 Copy Success Link
            </button>
          </div>

          <div className="download-card-footer">
            <div>
              <strong>Need to edit a roster?</strong>
              <span>Head back to the registration dashboard any time.</span>
            </div>
            <div className="download-card-links">
              <button className="team-success-link" onClick={handleRegisterAnother}>
                Register Another Team
              </button>
              <button className="team-success-link" onClick={handleBackHome}>
                Back to PlayLive Home
              </button>
              <a className="team-success-link" href={registrationLink} target="_blank" rel="noreferrer">
                Open Registration Form
              </a>
            </div>
          </div>
        </section>

        <div className="team-success-footer">
          <span>📩 Confirmation sent from PlayLive — keep this page for your records.</span>
        </div>
      </div>
    </div>
  );
}

export default TeamRegistrationSuccess;
