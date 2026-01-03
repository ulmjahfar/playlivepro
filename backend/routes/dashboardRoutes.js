const express = require('express');
const Tournament = require('../models/Tournament');
const Player = require('../models/Player');
const Team = require('../models/Team');
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('./authRoutes');

const router = express.Router();

const clampLimit = (value, fallback = 12, max = 50) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const resolveSinceDate = (sinceHours) => {
  const parsed = parseInt(sinceHours, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return new Date(Date.now() - parsed * 60 * 60 * 1000);
};

const formatCurrency = (value) => {
  if (typeof value !== 'number') return null;
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
};

router.get(
  '/activity',
  authenticateToken,
  authorizeRoles('SuperAdmin'),
  async (req, res) => {
    try {
      const limit = clampLimit(req.query.limit);
      const sinceDate = resolveSinceDate(req.query.sinceHours);

      const sinceTournament = sinceDate ? { createdAt: { $gte: sinceDate } } : {};
      const sinceRegistered = sinceDate ? { registeredAt: { $gte: sinceDate } } : {};
      const sinceUser = sinceDate ? { createdAt: { $gte: sinceDate } } : {};

      const [tournaments, players, teams, admins] = await Promise.all([
        Tournament.find(sinceTournament).sort({ createdAt: -1 }).limit(limit),
        Player.find(sinceRegistered).sort({ registeredAt: -1 }).limit(limit),
        Team.find(sinceTournament).sort({ createdAt: -1 }).limit(limit),
        User.find({ role: 'TournamentAdmin', ...sinceUser })
          .populate('tournamentId', 'name code')
          .sort({ createdAt: -1 })
          .limit(limit)
      ]);

      const activities = [
        ...tournaments.map((tournament) => ({
          id: `tournament-${tournament._id}`,
          type: 'tournament.created',
          icon: '🏆',
          message: `Tournament “${tournament.name}” created`,
          context: `${tournament.sport || 'Tournament'} • Code ${tournament.code}`,
          timestamp: tournament.createdAt,
          link: tournament.code ? `/tournament/${tournament.code}/overview` : null
        })),
        ...players.map((player) => ({
          id: `player-${player._id}`,
          type: 'player.registered',
          icon: '👤',
          message: `Player ${player.name} registered`,
          context: `${player.tournamentCode} • Base ₹${formatCurrency(player.basePrice) || '—'}`,
          timestamp: player.registeredAt,
          link: player.tournamentCode ? `/tournament/${player.tournamentCode}/players` : null
        })),
        ...teams.map((team) => ({
          id: `team-${team._id}`,
          type: 'team.registered',
          icon: '🛡️',
          message: `Team ${team.name} onboarded`,
          context: `${team.tournamentCode} • ${team.city || team.captainName || 'Team submission'}`,
          timestamp: team.createdAt,
          link: team.tournamentCode ? `/tournament/${team.tournamentCode}/teams` : null
        })),
        ...admins.map((admin) => ({
          id: `admin-${admin._id}`,
          type: 'admin.created',
          icon: '🧑‍💼',
          message: `Admin ${admin.username} added`,
          context: [
            admin.name,
            admin.email,
            admin.tournamentId?.code ? `Assigned to ${admin.tournamentId.code}` : null
          ]
            .filter(Boolean)
            .join(' • '),
          timestamp: admin.createdAt,
          link: admin.tournamentId?.code
            ? `/tournament/${admin.tournamentId.code}/overview`
            : '/dashboard/superadmin'
        }))
      ].filter((activity) => activity.timestamp);

      const sortedActivities = activities.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      const limitedActivities = sortedActivities.slice(0, limit).map((activity) => ({
        ...activity,
        timestamp: new Date(activity.timestamp).toISOString()
      }));

      res.json({
        success: true,
        activities: limitedActivities,
        summary: {
          total: activities.length,
          tournaments: tournaments.length,
          players: players.length,
          teams: teams.length,
          admins: admins.length,
          limit,
          sinceHours: sinceDate ? parseInt(req.query.sinceHours, 10) : null
        },
        refreshedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching dashboard activity', error);
      res.status(500).json({
        success: false,
        message: 'Unable to load dashboard activity feed'
      });
    }
  }
);

module.exports = router;

