import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { copyToClipboard } from './utils/clipboard';
import { API_BASE_URL } from './utils/apiConfig';

function RegistrationSuccess() {
  const { tournamentCode, playerId } = useParams();
  const [tournament, setTournament] = useState(null);
  const [player, setPlayer] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [tourRes, playerRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/tournaments/${tournamentCode}`),
        axios.get(`${API_BASE_URL}/api/players/player/${playerId}`)
      ]);
      setTournament(tourRes.data.tournament);
      setPlayer(playerRes.data.player);
    } catch (err) {
      console.error(err);
    }
  }, [tournamentCode, playerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const triggerFileDownload = useCallback((blob, filename) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleDownloadPDF = () => {
    window.open(`${API_BASE_URL}/player_cards/${playerId}.pdf`, '_blank');
  };

  const handleDownloadJPG = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/players/card-jpg/${playerId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch JPG');
      }
      const blob = await response.blob();
      triggerFileDownload(blob, `${playerId}.jpg`);
    } catch (err) {
      console.error('Unable to download JPG card', err);
      alert('Unable to download the JPG card right now. Please try again later.');
    }
  }, [playerId, triggerFileDownload]);

  const handleShareWhatsApp = () => {
    const url = `${window.location.origin}/player-card/${playerId}`;
    const message = `🏆 I just registered for the ${tournament?.name}! Check out my official RP Card 👇 ${url}`;
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

  if (!tournament || !player) return <div>Loading...</div>;

  return (
    <div className="registration-success">
      <div className="success-container">
        <div className="success-header">
          <div className="success-icon">🎉</div>
          <h1>Registration Successful!</h1>
          <p>Your RP Card is ready</p>
        </div>

        <div className="player-info">
          <div className="info-item">
            <span className="label">Player ID:</span>
            <span className="value">{player.playerId}</span>
          </div>
          <div className="info-item">
            <span className="label">Name:</span>
            <span className="value">{player.name}</span>
          </div>
          <div className="info-item">
            <span className="label">Tournament:</span>
            <span className="value">{tournament.name}</span>
          </div>
        </div>

        <div className="card-preview">
          <div className="preview-card">
            <div className="card-header">
              <h3>{tournament.name}</h3>
              <p>{tournament.sport} Tournament</p>
            </div>
            <div className="card-photo">
              {player.photo ? (
                <img src={`${API_BASE_URL}/uploads/${player.photo}`} alt="Player" />
              ) : (
                <div className="no-photo">No Photo</div>
              )}
            </div>
            <div className="card-details">
              <p><strong>ID:</strong> {player.playerId}</p>
              <p><strong>Name:</strong> {player.name}</p>
              <p><strong>Role:</strong> {player.role}</p>
            </div>
            <div className="card-footer">
              <p>⚡ Powered by PlayLive</p>
            </div>
          </div>
        </div>

        <div className="download-actions">
          <button onClick={handleDownloadPDF} className="btn btn-primary">
            ⬇️ Download Card (PDF)
          </button>
          <button onClick={handleDownloadJPG} className="btn btn-primary">
            🖼️ Download Image (JPG)
          </button>
          <button onClick={handleShareWhatsApp} className="btn btn-secondary">
            💬 Share via WhatsApp
          </button>
          <button onClick={handleCopyLink} className="btn btn-secondary">
            🔗 Copy Card Link
          </button>
        </div>

        <div className="success-footer">
          <p>Powered by PlayLive — Tournament Made Simple</p>
        </div>
      </div>
    </div>
  );
}

export default RegistrationSuccess;
