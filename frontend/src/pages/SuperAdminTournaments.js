import React from 'react';
import TournamentsTab from '../components/TournamentsTab';
import { useTournaments } from '../hooks/useTournaments';
import '../styles-super-admin-dashboard.css';

const SuperAdminTournaments = () => {
  const { tournaments, loading, refetch: refetchTournaments } = useTournaments();

  const handleTournamentSuccess = () => {
    refetchTournaments();
  };

  return (
    <div className="super-admin-page tournaments-page">
      <TournamentsTab
        tournaments={tournaments}
        loading={loading}
        onTournamentSuccess={handleTournamentSuccess}
      />
    </div>
  );
};

export default SuperAdminTournaments;

