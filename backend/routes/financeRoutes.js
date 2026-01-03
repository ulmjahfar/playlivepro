const express = require('express');
const router = express.Router();
const Branch = require('../models/Branch');
const Player = require('../models/Player');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const { authenticateToken } = require('./authRoutes');

// Get tournament finance summary
router.get('/:code/summary', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const tournament = await Tournament.findOne({ code });
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Get players and teams
    const [players, teams] = await Promise.all([
      Player.find({ tournamentCode: code }),
      Team.find({ tournamentCode: code })
    ]);

    // Calculate revenue from sold players
    const totalRevenue = players
      .filter(p => p.auctionStatus === 'Sold' && p.soldPrice)
      .reduce((sum, p) => sum + (p.soldPrice || 0), 0);

    // Calculate pending payments (players with Pending status)
    const pendingPlayers = players.filter(p => p.auctionStatus === 'Pending');
    const pendingPayments = pendingPlayers.length * (tournament.basePrice || 1000);

    // Calculate financial summary entries
    const playerRegistrationRevenue = players.length * (tournament.basePrice || 1000);
    const teamRegistrationRevenue = teams.length * 10000; // Estimate team registration fee
    const auctionRevenue = totalRevenue;

    const entries = [
      { category: 'Player Registrations', amount: playerRegistrationRevenue },
      { category: 'Team Registrations', amount: teamRegistrationRevenue },
      { category: 'Auction Revenue', amount: auctionRevenue }
    ];

    res.json({
      success: true,
      summary: {
        totalRevenue: totalRevenue || playerRegistrationRevenue + teamRegistrationRevenue,
        pendingPayments,
        entries
      }
    });
  } catch (error) {
    console.error('Error fetching finance summary:', error);
    res.status(500).json({ success: false, message: 'Error fetching finance summary' });
  }
});

// Get all branches
router.get('/branches', authenticateToken, async (req, res) => {
  try {
    const branches = await Branch.find();
    res.json({ branches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add or update branch
router.post('/branch', authenticateToken, async (req, res) => {
  try {
    const { name, income, expense } = req.body;
    const branch = await Branch.findOneAndUpdate(
      { name },
      { income, expense },
      { new: true, upsert: true }
    );
    res.json({ branch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export finance data (placeholder)
router.get('/export', authenticateToken, (req, res) => {
  res.json({ message: 'Export functionality not implemented yet' });
});

module.exports = router;
