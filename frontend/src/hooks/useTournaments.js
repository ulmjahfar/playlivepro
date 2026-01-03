import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/apiConfig';

export const useTournaments = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, upcoming: 0, completed: 0 });

  const calculateStats = useCallback((tournaments) => {
    const total = tournaments.length;
    const active = tournaments.filter(t => t.status === 'Active').length;
    const upcoming = tournaments.filter(t => t.status === 'Upcoming').length;
    const completed = tournaments.filter(t => t.status === 'Completed').length;
    setStats({ total, active, upcoming, completed });
  }, []);

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const res = await axios.get(`${API_BASE_URL}/api/tournaments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTournaments(res.data.tournaments);
      calculateStats(res.data.tournaments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  return { tournaments, loading, stats, refetch: fetchTournaments };
};
