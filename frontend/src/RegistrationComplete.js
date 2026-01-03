import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from './utils/apiConfig';

function RegistrationComplete() {
  const { tournamentCode } = useParams();
  const [tournament, setTournament] = useState(null);

  const fetchTournament = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/tournaments/${tournamentCode}`);
      setTournament(res.data.tournament);
    } catch (err) {
      console.error(err);
    }
  }, [tournamentCode]);

  useEffect(() => {
    fetchTournament();
  }, [fetchTournament]);

  if (!tournament) return <div>Loading...</div>;

  return (
    <div className="registration-complete">
      <div className="complete-container">
        <div className="tournament-logo">
          <h1>{tournament.name}</h1>
          <p>{tournament.sport} Tournament</p>
        </div>
        <div className="notice">
          <h2>Registration for this tournament has been completed.</h2>
          <p>Thank you for your interest. Stay tuned for updates!</p>
        </div>
        <div className="contact-info">
          <h3>Contact Information</h3>
          <p>For any queries, please contact:</p>
          <p>Email: support@playlive.com</p>
          <p>Phone: +91-1234567890</p>
        </div>
      </div>
    </div>
  );
}

export default RegistrationComplete;
