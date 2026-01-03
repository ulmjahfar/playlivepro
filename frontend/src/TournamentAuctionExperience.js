import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TournamentAdminLayout from './components/TournamentAdminLayout';
import useTournamentAuctionMeta from './hooks/useTournamentAuctionMeta';
import TournamentAuctionNormal from './TournamentAuctionNormal';
import './styles-tournament-auction-new.css';

function TournamentAuctionExperience() {
  const { code } = useParams();
  const { tournament, loading, error } = useTournamentAuctionMeta(code);

  if (loading) {
    return (
      <TournamentAdminLayout>
        <div className="auction-page-loading">
          <div className="loading-spinner-new"></div>
          <h2>Loading Auction Dashboard</h2>
          <p>Preparing your tournament auction...</p>
        </div>
      </TournamentAdminLayout>
    );
  }

  if (error && !tournament) {
    return (
      <TournamentAdminLayout>
        <div className="auction-page-error">
          <div className="error-icon">⚠️</div>
          <h2>Unable to Load Tournament</h2>
          <p>{error?.response?.data?.message || error?.message || 'Failed to load tournament data.'}</p>
          <button onClick={() => window.location.reload()} className="btn-retry">
            Retry
          </button>
        </div>
      </TournamentAdminLayout>
    );
  }

  if (!tournament && !loading) {
    return (
      <TournamentAdminLayout>
        <div className="auction-page-empty">
          <div className="empty-icon">📋</div>
          <h2>Tournament Not Found</h2>
          <p>The tournament you're looking for doesn't exist or you don't have access to it.</p>
        </div>
      </TournamentAdminLayout>
    );
  }

  return (
    <TournamentAdminLayout fullSize={true}>
      <div className="auction-page-container" id="auction-page-container">
        <TournamentAuctionNormal />
      </div>
    </TournamentAdminLayout>
  );
}

export default TournamentAuctionExperience;
