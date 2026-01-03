import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Homepage from './Homepage';
import SuperAdminLogin from './SuperAdminLogin';
import TournamentAdminLogin from './TournamentAdminLogin';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import PasswordResetSuccess from './PasswordResetSuccess';

// SuperAdmin Pages
import SuperAdminLayout from './components/SuperAdminLayout';
import SuperAdminOverview from './pages/SuperAdminOverview';
import SuperAdminTournaments from './pages/SuperAdminTournaments';
import SuperAdminReports from './pages/SuperAdminReports';
import SuperAdminSettings from './pages/SuperAdminSettings';
import SuperAdminAudit from './pages/SuperAdminAudit';
import SuperAdminUsers from './pages/SuperAdminUsers';

import TournamentPlayers from './TournamentPlayers';
import TournamentTeams from './TournamentTeams';
import TournamentGrouping from './TournamentGrouping';
import TournamentBroadcast from './TournamentBroadcast';
import TournamentAuctionExperience from './TournamentAuctionExperience';
import TournamentAuctionNormal from './TournamentAuctionNormal';
import TournamentReport from './TournamentReport';
import TournamentSchedule from './TournamentSchedule';
import TournamentAdmins from './TournamentAdmins';
import TournamentFinance from './TournamentFinance';
import TournamentSettings from './TournamentSettings';

import TournamentOverview from './TournamentOverview';
import TournamentAdminLayout from './components/TournamentAdminLayout';
import RouteModeGuard from './components/RouteModeGuard';
import TournamentLinks from './TournamentLinks';
import PlayerRegister from './PlayerRegister';

import TournamentEdit from './TournamentEdit';
import TournamentEditPage from './TournamentEditPage';
import TournamentCreatePage from './TournamentCreatePage';
import TournamentAdminCredentials from './TournamentAdminCredentials';
import RegistrationComplete from './RegistrationComplete';
import PlayerCard from './PlayerCard';
import RegistrationSuccess from './RegistrationSuccess';
import RegisteredPlayers from './RegisteredPlayers';
import Settings from './Settings';
import PlayerCardDesigner from './components/PlayerCardDesigner';
import AllPlayerCards from './components/AllPlayerCards';
import AuctionResults from './AuctionResults';
import TeamDashboard from './TeamDashboard';
import LiveAuction from './LiveAuction';
import LiveDisplay from './LiveDisplay';
import TournamentStream from './TournamentStream';

import TeamRegister from './TeamRegister';
import TeamRegistrationSuccess from './TeamRegistrationSuccess';
import TeamDetailsPage from './TeamDetailsPage';
import Error404 from './Error404';
import Error500 from './Error500';
import Maintenance from './Maintenance';

// Redirect component for old auction route
function AuctionRedirect() {
  const { code } = useParams();
  return <Navigate to={`/tournament/${code}/auction`} replace />;
}

function App() {
  return (
    <ThemeProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/login" element={<Navigate to="/login/super-admin" replace />} />
        <Route path="/login/super-admin" element={<SuperAdminLogin />} />
        <Route path="/login/tournament-admin" element={<TournamentAdminLogin />} />
        <Route path="/forgot-password" element={<div className="app-container"><ForgotPassword /></div>} />
        <Route path="/reset-password/:token" element={<div className="app-container"><ResetPassword /></div>} />
        <Route path="/password-reset-success" element={<div className="app-container"><PasswordResetSuccess /></div>} />
        
        {/* SuperAdmin Dashboard Routes with Layout */}
        <Route path="/dashboard/superadmin" element={<SuperAdminLayout />}>
          <Route index element={<SuperAdminOverview />} />
          <Route path="tournaments" element={<SuperAdminTournaments />} />
          <Route path="reports" element={<SuperAdminReports />} />
          <Route path="settings" element={<SuperAdminSettings />} />
          <Route path="audit" element={<SuperAdminAudit />} />
          <Route path="users" element={<SuperAdminUsers />} />
        </Route>
        
        {/* Legacy routes - redirect to new structure */}
        <Route path="/dashboard" element={<Navigate to="/dashboard/superadmin" replace />} />
        <Route path="/superadmin/settings" element={<Navigate to="/dashboard/superadmin/settings" replace />} />
        <Route path="/superadmin/audit" element={<Navigate to="/dashboard/superadmin/audit" replace />} />
        
        <Route path="/dashboard/superadmin/tournaments/create" element={<TournamentCreatePage />} />
        
        <Route path="/tournament/:code" element={<TournamentOverview />} />
        <Route path="/tournament/:code/overview" element={<TournamentOverview />} />
        <Route
          path="/tournament/:code/players"
          element={<TournamentAdminLayout><TournamentPlayers /></TournamentAdminLayout>}
        />
        <Route
          path="/tournament/:code/teams"
          element={<TournamentTeams />}
        />
        <Route
          path="/tournament/:code/grouping"
          element={<TournamentAdminLayout><TournamentGrouping /></TournamentAdminLayout>}
        />
        <Route
          path="/tournament/:code/broadcast"
          element={
            <RouteModeGuard blockedInNormalMode={true}>
              <TournamentBroadcast />
            </RouteModeGuard>
          }
        />
        <Route
          path="/tournament/:code/auction"
          element={<TournamentAuctionExperience />}
        />
        <Route
          path="/tournament/:code/report"
          element={<TournamentAdminLayout><TournamentReport /></TournamentAdminLayout>}
        />
        <Route
          path="/tournament/:code/links"
          element={
            <RouteModeGuard blockedInNormalMode={true}>
              <TournamentAdminLayout><TournamentLinks /></TournamentAdminLayout>
            </RouteModeGuard>
          }
        />
        <Route
          path="/tournament/:code/schedule"
          element={<TournamentAdminLayout><TournamentSchedule /></TournamentAdminLayout>}
        />
        <Route
          path="/tournament/:code/admins"
          element={
            <RouteModeGuard blockedInNormalMode={true}>
              <TournamentAdminLayout hideHeroBanner><TournamentAdmins /></TournamentAdminLayout>
            </RouteModeGuard>
          }
        />
        <Route
          path="/tournament/:code/settings"
          element={<TournamentAdminLayout><TournamentSettings /></TournamentAdminLayout>}
        />
        <Route
          path="/tournament/:code/settings/player-card-designer"
          element={<TournamentAdminLayout hideHeader={true}><PlayerCardDesigner /></TournamentAdminLayout>}
        />
        <Route
          path="/tournament/:code/settings/player-card-designer/all-cards"
          element={<TournamentAdminLayout hideHeader={true}><AllPlayerCards /></TournamentAdminLayout>}
        />
        <Route
          path="/tournament/:code/finance"
          element={
            <RouteModeGuard blockedInNormalMode={true}>
              <TournamentAdminLayout><TournamentFinance /></TournamentAdminLayout>
            </RouteModeGuard>
          }
        />
        <Route
          path="/tournament/:tournamentCode/credentials"
          element={
            <RouteModeGuard blockedInNormalMode={true} paramKey="tournamentCode">
              <TournamentAdminCredentials />
            </RouteModeGuard>
          }
        />
        <Route path="/edit-tournament/:id" element={<TournamentEditPage />} />
        <Route path="/live/:tournamentCode" element={<LiveAuction />} />
        <Route path="/tournament/:tournamentCode/live" element={<LiveDisplay />} />
        <Route path="/tournament/:code/stream" element={<TournamentStream />} />
        <Route path="/register/:tournamentCode" element={<div className="app-container"><PlayerRegister /></div>} />
        <Route path="/registration-complete/:tournamentCode" element={<RegistrationComplete />} />
        <Route path="/registration-success/:tournamentCode/:playerId" element={<RegistrationSuccess />} />
        <Route path="/player-card/:playerId" element={<PlayerCard />} />
        <Route path="/registered-players/:code" element={<RegisteredPlayers />} />
        <Route path="/auction-results/:code" element={<AuctionResults />} />
        <Route path="/tournament/:code/auction-results" element={<TournamentAdminLayout hideHeader={true}><AuctionResults /></TournamentAdminLayout>} />
        <Route path="/team-dashboard/:tournamentCode" element={<TeamDashboard />} />

        <Route path="/settings" element={<Settings />} />
        <Route path="/register/team/:tournamentCode" element={<div className="app-container"><TeamRegister /></div>} />
        <Route path="/team-registration-success/:teamId" element={<TeamRegistrationSuccess />} />
        <Route path="/team/:id/details" element={<TeamDetailsPage />} />


        <Route path="/404" element={<Error404 />} />
        <Route path="/500" element={<Error500 />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="*" element={<Error404 />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
