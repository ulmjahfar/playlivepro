const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const Team = require('../models/Team');
const { authenticateToken } = require('./authRoutes');
const { generateFixtures } = require('../utils/fixtureGenerator');

let io;

const setIo = (socketIo) => {
  io = socketIo;
};

// Helper function to check admin access
const checkAdminAccess = async (req, tournament) => {
  if (!req.user || !req.user.id) {
    return { allowed: false, message: 'Access denied: Authentication required' };
  }

  if (req.user.role === 'SuperAdmin') {
    return { allowed: true };
  }

  if (req.user.role === 'TournamentAdmin') {
    if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
      return { allowed: false, message: 'Access denied: Only tournament admin can manage fixtures' };
    }
    return { allowed: true };
  }

  return { allowed: false, message: 'Access denied: Only tournament admin can manage fixtures' };
};

// Generate fixtures
router.post('/:code/generate', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const { fixtureType, matchCount } = req.body;

    if (!fixtureType || !matchCount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Fixture type and match count are required' 
      });
    }

    // Validate fixture type
    const validFixtureTypes = ['straight', 'mixed', 'mixed-group', 'within-group'];
    if (!validFixtureTypes.includes(fixtureType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid fixture type' 
      });
    }

    // Validate match count
    let parsedMatchCount = matchCount;
    if (matchCount !== 'round-robin' && matchCount !== 'custom') {
      parsedMatchCount = parseInt(matchCount);
      if (isNaN(parsedMatchCount) || parsedMatchCount < 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid match count' 
        });
      }
    }

    // Handle custom match count
    if (matchCount === 'custom') {
      const customCount = parseInt(req.body.customMatchCount);
      if (isNaN(customCount) || customCount < 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid custom match count' 
        });
      }
      parsedMatchCount = customCount;
    }

    // Find tournament
    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check admin access
    const accessCheck = await checkAdminAccess(req, tournament);
    if (!accessCheck.allowed) {
      return res.status(403).json({ success: false, message: accessCheck.message });
    }

    // Check if groups exist and are locked
    if (!tournament.groups || tournament.groups.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No groups found. Please create groups first.' 
      });
    }

    if (!tournament.groupsLocked) {
      return res.status(400).json({ 
        success: false, 
        message: 'Groups must be locked before generating fixtures.' 
      });
    }

    // Populate groups with team data
    const populatedGroups = await Promise.all(
      tournament.groups.map(async (group) => {
        const teamDocs = await Team.find({ _id: { $in: group.teams } });
        return {
          name: group.name,
          teams: teamDocs.map(t => t._id)
        };
      })
    );

    // Generate fixtures
    const matchData = generateFixtures(populatedGroups, fixtureType, parsedMatchCount);

    // Delete existing fixtures for this tournament
    await Match.deleteMany({ tournamentCode: code });

    // Create match documents
    const matchesToInsert = matchData.map(match => ({
      tournamentId: tournament._id,
      tournamentCode: code,
      teamA: match.teamA || null,
      teamB: match.teamB || null,
      groupA: match.groupA || null,
      groupB: match.groupB || null,
      round: match.round,
      matchNo: match.matchNo,
      fixtureType: match.fixtureType,
      status: 'scheduled',
      teamABye: match.teamABye || false,
      teamBBye: match.teamBBye || false
    }));

    const matches = await Match.insertMany(matchesToInsert);

    // Emit socket event for real-time updates (broadcast to all connected clients)
    if (io) {
      io.emit('fixtures:generated', {
        tournamentCode: code,
        matchCount: matches.length,
        fixtureType,
        totalMatches: matches.length
      });
    }

    res.json({
      success: true,
      matches: matches,
      message: `Successfully generated ${matches.length} matches`
    });

  } catch (error) {
    console.error('Error generating fixtures:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all fixtures for a tournament
router.get('/:code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;

    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check admin access
    const accessCheck = await checkAdminAccess(req, tournament);
    if (!accessCheck.allowed) {
      return res.status(403).json({ success: false, message: accessCheck.message });
    }

    const matches = await Match.find({ tournamentCode: code })
      .populate('teamA', 'name logo city')
      .populate('teamB', 'name logo city')
      .sort({ round: 1, matchNo: 1 });

    res.json({
      success: true,
      matches: matches
    });

  } catch (error) {
    console.error('Error fetching fixtures:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Regenerate fixtures (reuses generate logic)
router.post('/:code/regenerate', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const { fixtureType, matchCount, customMatchCount } = req.body;

    if (!fixtureType || !matchCount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Fixture type and match count are required' 
      });
    }

    // Validate fixture type
    const validFixtureTypes = ['straight', 'mixed', 'mixed-group', 'within-group'];
    if (!validFixtureTypes.includes(fixtureType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid fixture type' 
      });
    }

    // Validate match count
    let parsedMatchCount = matchCount;
    if (matchCount !== 'round-robin' && matchCount !== 'custom') {
      parsedMatchCount = parseInt(matchCount);
      if (isNaN(parsedMatchCount) || parsedMatchCount < 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid match count' 
        });
      }
    }

    // Handle custom match count
    if (matchCount === 'custom') {
      const customCount = parseInt(customMatchCount);
      if (isNaN(customCount) || customCount < 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid custom match count' 
        });
      }
      parsedMatchCount = customCount;
    }

    // Find tournament
    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check admin access
    const accessCheck = await checkAdminAccess(req, tournament);
    if (!accessCheck.allowed) {
      return res.status(403).json({ success: false, message: accessCheck.message });
    }

    // Check if groups exist and are locked
    if (!tournament.groups || tournament.groups.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No groups found. Please create groups first.' 
      });
    }

    if (!tournament.groupsLocked) {
      return res.status(400).json({ 
        success: false, 
        message: 'Groups must be locked before generating fixtures.' 
      });
    }

    // Delete existing fixtures
    await Match.deleteMany({ tournamentCode: code });

    // Populate groups with team data
    const populatedGroups = await Promise.all(
      tournament.groups.map(async (group) => {
        const teamDocs = await Team.find({ _id: { $in: group.teams } });
        return {
          name: group.name,
          teams: teamDocs.map(t => t._id)
        };
      })
    );

    // Generate fixtures
    const matchData = generateFixtures(populatedGroups, fixtureType, parsedMatchCount);

    // Create match documents
    const matchesToInsert = matchData.map(match => ({
      tournamentId: tournament._id,
      tournamentCode: code,
      teamA: match.teamA || null,
      teamB: match.teamB || null,
      groupA: match.groupA || null,
      groupB: match.groupB || null,
      round: match.round,
      matchNo: match.matchNo,
      fixtureType: match.fixtureType,
      status: 'scheduled',
      teamABye: match.teamABye || false,
      teamBBye: match.teamBBye || false
    }));

    const matches = await Match.insertMany(matchesToInsert);

    // Emit socket event for real-time updates (broadcast to all connected clients)
    if (io) {
      io.emit('fixtures:generated', {
        tournamentCode: code,
        matchCount: matches.length,
        fixtureType,
        totalMatches: matches.length
      });
    }

    res.json({
      success: true,
      matches: matches,
      message: `Successfully regenerated ${matches.length} matches`
    });

  } catch (error) {
    console.error('Error regenerating fixtures:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Edit individual match
router.put('/:code/match/:matchId', authenticateToken, async (req, res) => {
  try {
    const { code, matchId } = req.params;
    const { teamA, teamB, teamABye, teamBBye, scheduledDate } = req.body;

    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check admin access
    const accessCheck = await checkAdminAccess(req, tournament);
    if (!accessCheck.allowed) {
      return res.status(403).json({ success: false, message: accessCheck.message });
    }

    const match = await Match.findOne({ _id: matchId, tournamentCode: code });
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    // Update match
    if (teamA !== undefined) match.teamA = teamA || null;
    if (teamB !== undefined) match.teamB = teamB || null;
    if (teamABye !== undefined) match.teamABye = teamABye;
    if (teamBBye !== undefined) match.teamBBye = teamBBye;
    if (scheduledDate !== undefined) match.scheduledDate = scheduledDate ? new Date(scheduledDate) : null;

    // If BYE is set, clear the corresponding team
    if (match.teamABye) match.teamA = null;
    if (match.teamBBye) match.teamB = null;

    await match.save();

    // Emit socket event
    if (io) {
      io.emit('fixture:updated', {
        tournamentCode: code,
        matchId: match._id
      });
    }

    const updatedMatch = await Match.findById(matchId)
      .populate('teamA', 'name logo city')
      .populate('teamB', 'name logo city');

    res.json({
      success: true,
      match: updatedMatch,
      message: 'Match updated successfully'
    });

  } catch (error) {
    console.error('Error updating match:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete all fixtures
router.delete('/:code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;

    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check admin access
    const accessCheck = await checkAdminAccess(req, tournament);
    if (!accessCheck.allowed) {
      return res.status(403).json({ success: false, message: accessCheck.message });
    }

    await Match.deleteMany({ tournamentCode: code });

    // Emit socket event
    if (io) {
      io.emit('fixtures:deleted', {
        tournamentCode: code
      });
    }

    res.json({
      success: true,
      message: 'All fixtures deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting fixtures:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = { router, setIo };

