import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/apiConfig';

const formatPlanLabel = (value) => {
  if (!value) return 'Standard';
  return value;
};

export default function useTournamentFeatures(tournamentCode) {
  const [state, setState] = useState({
    loading: true,
    error: '',
    plan: 'Standard',
    overrides: {},
    allowedFeatures: [],
    features: []
  });

  const fetchFeatures = useCallback(async () => {
    if (!tournamentCode) return;

    setState((prev) => ({ ...prev, loading: true }));
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(
        `${API_BASE_URL}/api/tournaments/${tournamentCode}/features`,
        { headers }
      );

      const payload = response.data || {};
      setState({
        loading: false,
        error: '',
        plan: payload.plan || 'Standard',
        overrides: payload.overrides || {},
        allowedFeatures: payload.allowedFeatures || [],
        features: payload.features || []
      });
    } catch (error) {
      console.error('Failed to load tournament features', error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Unable to load feature permissions.',
        allowedFeatures: prev.allowedFeatures || []
      }));
    }
  }, [tournamentCode]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const hasFeature = useCallback(
    (featureId) => state.allowedFeatures.includes(featureId),
    [state.allowedFeatures]
  );

  const planLabel = useMemo(() => formatPlanLabel(state.plan), [state.plan]);

  return {
    ...state,
    planLabel,
    hasFeature,
    refetch: fetchFeatures
  };
}



