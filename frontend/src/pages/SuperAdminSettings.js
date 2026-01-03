import React from 'react';
import SettingsTab from '../components/SettingsTab';
import { useTournaments } from '../hooks/useTournaments';
import '../styles-super-admin-dashboard.css';

const SuperAdminSettings = () => {
  const { tournaments, stats } = useTournaments();

  return (
    <div className="super-admin-page settings-page">
      <SettingsTab
        stats={stats}
        tournaments={tournaments}
      />
    </div>
  );
};

export default SuperAdminSettings;

