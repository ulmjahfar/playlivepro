import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../utils/apiConfig';

/**
 * Fetch and cache tournament metadata that determines auction experiences.
 * Both Normal and Pro auction screens rely on this hook so we only hit the
 * tournaments API once while switching between layouts.
 */
function useTournamentAuctionMeta(tournamentCode, options = {}) {
  const { auto = true } = options;
  const navigate = useNavigate();
  const apiBaseUrl = API_BASE_URL;
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(Boolean(auto));
  const [error, setError] = useState(null);

  const fetchTournament = useCallback(async () => {
    if (!tournamentCode) return null;

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Session expired. Please login again.');
      navigate('/login/tournament-admin', { replace: true });
      return null;
    }

    setLoading(true);
    try {
      const res = await axios.get(`${apiBaseUrl}/api/tournaments/${tournamentCode}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTournament(res.data.tournament);
      setError(null);
      return res.data.tournament;
    } catch (err) {
      console.error('Failed to load tournament metadata', err);
      const message = err.response?.data?.message || 'Failed to load tournament details';
      setError(err);
      toast.error(message);
      if (err.response?.status === 401) {
        navigate('/login/tournament-admin', { replace: true });
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, navigate, tournamentCode]);

  useEffect(() => {
    if (!auto) return;
    fetchTournament();
  }, [auto, fetchTournament]);

  return {
    tournament,
    loading,
    error,
    refreshTournament: fetchTournament,
    setTournament // expose setter for caller-driven optimistic updates
  };
}

export default useTournamentAuctionMeta;

