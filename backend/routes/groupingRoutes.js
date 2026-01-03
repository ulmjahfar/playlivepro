const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const { authenticateToken } = require('./authRoutes');

let io;

const setIo = (socketIo) => {
  io = socketIo;
};

// Lock Groups Endpoint
router.post('/:code/lock-groups', authenticateToken, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check if user is admin
    if (req.user.role !== 'SuperAdmin') {
      // For TournamentAdmin, check if they own the tournament
      if (req.user.role === 'TournamentAdmin') {
        if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      } else {
        // Not admin at all
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    tournament.groupsLocked = true;
    await tournament.save();

    if (io) {
      io.emit('grouping:locked', { tournamentCode: req.params.code });
    }

    res.json({ success: true, message: 'Groups locked successfully' });
  } catch (error) {
    console.error('Error locking groups:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Unlock Groups Endpoint
router.post('/:code/unlock-groups', authenticateToken, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check if user is admin
    if (req.user.role !== 'SuperAdmin') {
      // For TournamentAdmin, check if they own the tournament
      if (req.user.role === 'TournamentAdmin') {
        if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      } else {
        // Not admin at all
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    tournament.groupsLocked = false;
    await tournament.save();

    if (io) {
      io.emit('grouping:unlocked', { tournamentCode: req.params.code });
    }

    res.json({ success: true, message: 'Groups unlocked successfully' });
  } catch (error) {
    console.error('Error unlocking groups:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Groups Endpoint
router.get('/:code/groups', authenticateToken, async (req, res) => {
  try {
    console.log('GET /api/grouping/:code/groups - Tournament code:', req.params.code);
    const tournament = await Tournament.findOne({ code: req.params.code });
    
    if (!tournament) {
      console.log('Tournament not found:', req.params.code);
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Populate teams in groups
    const populatedGroups = tournament.groups ? await Promise.all(
      tournament.groups.map(async (group) => {
        const teamDocs = await Team.find({ _id: { $in: group.teams } });
        return {
          name: group.name,
          teams: teamDocs.map(t => ({
            _id: t._id,
            name: t.name,
            logo: t.logo,
            city: t.city,
            captainName: t.captainName,
            group: t.group,
            groupIndex: t.groupIndex
          })),
          locked: group.locked || false
        };
      })
    ) : [];

    res.json({
      success: true,
      groups: populatedGroups,
      locked: tournament.groupsLocked || false,
      settings: tournament.groupingSettings || {}
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clear Groups Endpoint
router.post('/:code/clear-groups', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;

    // Check tournament exists and admin access
    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check if user is admin
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Access denied: Authentication required' });
    }

    if (req.user.role !== 'SuperAdmin') {
      // For TournamentAdmin, check if they own the tournament
      if (req.user.role === 'TournamentAdmin') {
        if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied: Only tournament admin can clear groups' });
        }
      } else {
        // Not admin at all
        return res.status(403).json({ success: false, message: 'Access denied: Only tournament admin can clear groups' });
      }
    }

    // Check if groups are locked
    if (tournament.groupsLocked) {
      return res.status(400).json({ success: false, message: 'Groups are locked. Please unlock before clearing.' });
    }

    // Clear group and groupIndex from all teams
    const updateResult = await Team.updateMany(
      { tournamentCode: code },
      { $unset: { group: '', groupIndex: '' } }
    );

    // Clear groups array from tournament
    tournament.groups = [];
    await tournament.save();

    // Emit Socket.io event for real-time sync
    if (io) {
      io.emit('grouping:cleared', {
        tournamentCode: code
      });
    }

    res.json({
      success: true,
      message: `Successfully cleared group assignments for ${updateResult.modifiedCount} teams`,
      clearedCount: updateResult.modifiedCount
    });

  } catch (error) {
    console.error('Error clearing groups:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send to Broadcast Endpoint
router.post('/:code/send-to-broadcast', authenticateToken, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check if user is admin
    if (req.user.role !== 'SuperAdmin') {
      // For TournamentAdmin, check if they own the tournament
      if (req.user.role === 'TournamentAdmin') {
        if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      } else {
        // Not admin at all
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Populate groups for broadcast
    const populatedGroups = tournament.groups ? await Promise.all(
      tournament.groups.map(async (group) => {
        const teamDocs = await Team.find({ _id: { $in: group.teams } });
        return {
          name: group.name,
          teams: teamDocs.map(t => ({
            _id: t._id,
            name: t.name,
            logo: t.logo,
            city: t.city,
            captainName: t.captainName
          }))
        };
      })
    ) : [];

    // Emit broadcast event
    if (io) {
      io.emit('grouping:broadcast', {
        tournamentCode: req.params.code,
        groups: populatedGroups,
        mode: 'grouping'
      });
    }

    res.json({ success: true, message: 'Grouping sent to broadcast' });
  } catch (error) {
    console.error('Error sending to broadcast:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// End Broadcast Animation Endpoint
router.post('/:code/end-broadcast', authenticateToken, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check if user is admin
    if (req.user.role !== 'SuperAdmin') {
      // For TournamentAdmin, check if they own the tournament
      if (req.user.role === 'TournamentAdmin') {
        if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      } else {
        // Not admin at all
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Emit end broadcast event
    if (io) {
      io.emit('grouping:end-broadcast', {
        tournamentCode: req.params.code
      });
    }

    res.json({ success: true, message: 'Broadcast animation ended' });
  } catch (error) {
    console.error('Error ending broadcast:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper function to check admin access
const checkAdminAccess = (req, tournament) => {
  if (req.user.role !== 'SuperAdmin') {
    if (req.user.role === 'TournamentAdmin') {
      if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
        return false;
      }
    } else {
      return false;
    }
  }
  return true;
};

// Initialize Groups Endpoint
router.post('/:code/initialize-groups', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const { numberOfGroups, teamsPerGroup, avoidSameCity, spinDelay } = req.body;

    // Validate input
    if (!numberOfGroups || !teamsPerGroup) {
      return res.status(400).json({ 
        success: false, 
        message: 'numberOfGroups and teamsPerGroup are required' 
      });
    }

    if (numberOfGroups < 1 || numberOfGroups > 26) {
      return res.status(400).json({ 
        success: false, 
        message: 'numberOfGroups must be between 1 and 26' 
      });
    }

    if (teamsPerGroup < 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'teamsPerGroup must be at least 1' 
      });
    }

    // Find tournament
    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check admin access
    if (!checkAdminAccess(req, tournament)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if groups are locked
    if (tournament.groupsLocked) {
      return res.status(400).json({ 
        success: false, 
        message: 'Groups are locked. Please unlock before initializing new groups.' 
      });
    }

    // Get total teams
    const totalTeams = await Team.countDocuments({ tournamentCode: code });
    const requiredTeams = numberOfGroups * teamsPerGroup;

    if (totalTeams < requiredTeams) {
      return res.status(400).json({ 
        success: false, 
        message: `Not enough teams. Required: ${requiredTeams}, Available: ${totalTeams}` 
      });
    }

    // Clear existing groups if any
    await Team.updateMany(
      { tournamentCode: code },
      { $unset: { group: '', groupIndex: '' } }
    );

    // Create empty groups
    const groupNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, numberOfGroups);
    const groups = groupNames.map(name => ({
      name,
      teams: [],
      locked: false
    }));

    // Update tournament
    tournament.groups = groups;
    tournament.groupingSettings = {
      numberOfGroups,
      teamsPerGroup,
      avoidSameCity: avoidSameCity === true || avoidSameCity === 'true',
      spinDelay: spinDelay ? parseInt(spinDelay) : 3000 // Default 3000ms
    };
    await tournament.save();

    // Emit Socket.io event
    if (io) {
      io.emit('grouping:initialized', {
        tournamentCode: code,
        groups: groups.map(g => ({ name: g.name, teams: [] }))
      });
    }

    res.json({
      success: true,
      message: `Successfully initialized ${numberOfGroups} groups`,
      groups: groups.map(g => ({ name: g.name, teams: [] })),
      settings: tournament.groupingSettings,
      pickingState: {
        currentRound: 1,
        nextGroupIndex: 0,
        nextGroupName: groupNames[0] || null
      }
    });
  } catch (error) {
    console.error('Error initializing groups:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Picking State Endpoint
router.get('/:code/picking-state', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;

    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check admin access
    if (!checkAdminAccess(req, tournament)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!tournament.groups || tournament.groups.length === 0) {
      return res.json({
        success: true,
        initialized: false,
        message: 'Groups not initialized yet'
      });
    }

    // Get all teams
    const allTeams = await Team.find({ tournamentCode: code }).select('_id name logo city captainName group groupIndex');
    
    // Separate assigned and unassigned teams
    const assignedTeams = allTeams.filter(t => t.group && t.group.trim() !== '');
    const availableTeams = allTeams.filter(t => !t.group || t.group.trim() === '');

    // Calculate current round and next group
    const totalPicks = assignedTeams.length;
    const numberOfGroups = tournament.groups.length;
    const currentRound = Math.floor(totalPicks / numberOfGroups) + 1;
    const nextGroupIndex = totalPicks % numberOfGroups;
    const nextGroupName = tournament.groups[nextGroupIndex]?.name || null;

    // Populate groups with team details
    const populatedGroups = await Promise.all(
      tournament.groups.map(async (group) => {
        const teamDocs = await Team.find({ _id: { $in: group.teams } }).select('_id name logo city captainName group groupIndex');
        return {
          name: group.name,
          teams: teamDocs.map(t => ({
            _id: t._id,
            name: t.name,
            logo: t.logo,
            city: t.city,
            captainName: t.captainName,
            group: t.group,
            groupIndex: t.groupIndex
          })),
          locked: group.locked || false,
          teamCount: teamDocs.length,
          capacity: tournament.groupingSettings?.teamsPerGroup || 0
        };
      })
    );

    // Get cities in each group for conflict checking
    const groupCities = {};
    populatedGroups.forEach(group => {
      groupCities[group.name] = new Set(
        group.teams.map(t => t.city).filter(city => city)
      );
    });

    res.json({
      success: true,
      initialized: true,
      currentRound,
      nextGroupIndex,
      nextGroupName,
      availableTeams: availableTeams.map(t => ({
        _id: t._id,
        name: t.name,
        logo: t.logo,
        city: t.city,
        captainName: t.captainName
      })),
      groups: populatedGroups,
      groupCities,
      avoidSameCity: tournament.groupingSettings?.avoidSameCity || false,
      settings: tournament.groupingSettings || {},
      totalAssigned: assignedTeams.length,
      totalAvailable: availableTeams.length
    });
  } catch (error) {
    console.error('Error fetching picking state:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Pick Team Endpoint
router.post('/:code/pick-team', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const { teamId, groupName } = req.body;

    // Validate input
    if (!teamId || !groupName) {
      return res.status(400).json({ 
        success: false, 
        message: 'teamId and groupName are required' 
      });
    }

    // Find tournament
    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check admin access
    if (!checkAdminAccess(req, tournament)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if groups are locked
    if (tournament.groupsLocked) {
      return res.status(400).json({ 
        success: false, 
        message: 'Groups are locked. Please unlock before making changes.' 
      });
    }

    // Find the group
    const group = tournament.groups.find(g => g.name === groupName);
    if (!group) {
      return res.status(404).json({ success: false, message: `Group ${groupName} not found` });
    }

    // Check if group is full
    const teamsPerGroup = tournament.groupingSettings?.teamsPerGroup || 0;
    if (group.teams.length >= teamsPerGroup) {
      return res.status(400).json({ 
        success: false, 
        message: `Group ${groupName} is full (${teamsPerGroup} teams)` 
      });
    }

    // Find the team
    const team = await Team.findOne({ 
      _id: teamId, 
      tournamentCode: code 
    });

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    // Check if team is already assigned
    if (team.group) {
      return res.status(400).json({ 
        success: false, 
        message: `Team ${team.name} is already assigned to Group ${team.group}` 
      });
    }

    // City conflict validation
    const avoidSameCity = tournament.groupingSettings?.avoidSameCity || false;
    if (avoidSameCity && team.city) {
      // Get all teams currently in the target group
      const teamsInGroup = await Team.find({ 
        _id: { $in: group.teams } 
      }).select('city name');

      // Check if any team in the group has the same city
      const hasSameCity = teamsInGroup.some(t => 
        t.city && t.city.toLowerCase().trim() === team.city.toLowerCase().trim()
      );

      if (hasSameCity) {
        const conflictingTeam = teamsInGroup.find(t => 
          t.city && t.city.toLowerCase().trim() === team.city.toLowerCase().trim()
        );
        return res.status(400).json({ 
          success: false, 
          message: `Cannot assign team: Another team from ${team.city} (${conflictingTeam.name}) is already in Group ${groupName}` 
        });
      }
    }

    // Assign team to group
    team.group = groupName;
    team.groupIndex = group.teams.length; // Index within the group
    await team.save();

    // Add team to group's teams array
    group.teams.push(team._id);
    await tournament.save();

    // Calculate next group - get all teams with groups
    const allAssignedTeams = await Team.find({ 
      tournamentCode: code,
      group: { $exists: true, $ne: null, $ne: '' }
    }).select('_id');
    const totalPicks = allAssignedTeams.length;
    const numberOfGroups = tournament.groups.length;
    const currentRound = Math.floor(totalPicks / numberOfGroups) + 1;
    const nextGroupIndex = totalPicks % numberOfGroups;
    const nextGroupName = tournament.groups[nextGroupIndex]?.name || null;

    // Get remaining available teams
    const availableTeams = await Team.find({ 
      tournamentCode: code,
      $or: [
        { group: { $exists: false } },
        { group: null },
        { group: '' }
      ]
    }).select('_id name logo city captainName');

    // Emit Socket.io event
    if (io) {
      io.emit('grouping:team-picked', {
        tournamentCode: code,
        teamId: team._id.toString(),
        groupName,
        currentRound,
        nextGroupName
      });
    }

    res.json({
      success: true,
      message: `Team ${team.name} assigned to Group ${groupName}`,
      team: {
        _id: team._id,
        name: team.name,
        logo: team.logo,
        city: team.city,
        captainName: team.captainName,
        group: team.group,
        groupIndex: team.groupIndex
      },
      pickingState: {
        currentRound,
        nextGroupIndex,
        nextGroupName,
        availableTeamsCount: availableTeams.length,
        totalAssigned: totalPicks
      }
    });
  } catch (error) {
    console.error('Error picking team:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Pick Team Random Endpoint
router.post('/:code/pick-team-random', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const { groupName } = req.body;

    // Validate input
    if (!groupName) {
      return res.status(400).json({ 
        success: false, 
        message: 'groupName is required' 
      });
    }

    // Find tournament
    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check admin access
    if (!checkAdminAccess(req, tournament)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if groups are locked
    if (tournament.groupsLocked) {
      return res.status(400).json({ 
        success: false, 
        message: 'Groups are locked. Please unlock before making changes.' 
      });
    }

    // Find the group
    const group = tournament.groups.find(g => g.name === groupName);
    if (!group) {
      return res.status(404).json({ success: false, message: `Group ${groupName} not found` });
    }

    // Check if group is full
    const teamsPerGroup = tournament.groupingSettings?.teamsPerGroup || 0;
    if (group.teams.length >= teamsPerGroup) {
      return res.status(400).json({ 
        success: false, 
        message: `Group ${groupName} is full (${teamsPerGroup} teams)` 
      });
    }

    // Get all available teams
    const allAvailableTeams = await Team.find({ 
      tournamentCode: code,
      $or: [
        { group: { $exists: false } },
        { group: null },
        { group: '' }
      ]
    }).select('_id name logo city captainName');

    if (allAvailableTeams.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No available teams to pick from' 
      });
    }

    // City conflict filtering
    const avoidSameCity = tournament.groupingSettings?.avoidSameCity || false;
    let availableTeams = allAvailableTeams;

    if (avoidSameCity) {
      // Get teams currently in the target group
      const teamsInGroup = await Team.find({ 
        _id: { $in: group.teams } 
      }).select('city');

      // Get cities already in the group
      const citiesInGroup = new Set(
        teamsInGroup.map(t => t.city?.toLowerCase().trim()).filter(c => c)
      );

      // Filter out teams with city conflicts
      availableTeams = allAvailableTeams.filter(team => {
        if (!team.city) return true;
        const teamCity = team.city.toLowerCase().trim();
        return !citiesInGroup.has(teamCity);
      });

      if (availableTeams.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No available teams that meet city conflict restrictions' 
        });
      }
    }

    // Randomly select a team
    const randomIndex = Math.floor(Math.random() * availableTeams.length);
    const selectedTeam = availableTeams[randomIndex];

    // Assign team to group
    selectedTeam.group = groupName;
    selectedTeam.groupIndex = group.teams.length;
    await selectedTeam.save();

    // Add team to group's teams array
    group.teams.push(selectedTeam._id);
    await tournament.save();

    // Calculate next group
    const allAssignedTeams = await Team.find({ 
      tournamentCode: code,
      group: { $exists: true, $ne: null, $ne: '' }
    }).select('_id');
    const totalPicks = allAssignedTeams.length;
    const numberOfGroups = tournament.groups.length;
    const currentRound = Math.floor(totalPicks / numberOfGroups) + 1;
    const nextGroupIndex = totalPicks % numberOfGroups;
    const nextGroupName = tournament.groups[nextGroupIndex]?.name || null;

    // Get remaining available teams
    const remainingAvailableTeams = await Team.find({ 
      tournamentCode: code,
      $or: [
        { group: { $exists: false } },
        { group: null },
        { group: '' }
      ]
    }).select('_id name logo city captainName');

    // Emit Socket.io event for live page
    if (io) {
      io.emit('grouping:team-picked', {
        tournamentCode: code,
        teamId: selectedTeam._id.toString(),
        team: {
          _id: selectedTeam._id,
          name: selectedTeam.name,
          logo: selectedTeam.logo,
          city: selectedTeam.city,
          captainName: selectedTeam.captainName
        },
        groupName,
        currentRound,
        nextGroupName,
        spinDelay: tournament.groupingSettings?.spinDelay || 3000
      });
    }

    res.json({
      success: true,
      message: `Team ${selectedTeam.name} randomly assigned to Group ${groupName}`,
      selectedTeam: {
        _id: selectedTeam._id,
        name: selectedTeam.name,
        logo: selectedTeam.logo,
        city: selectedTeam.city,
        captainName: selectedTeam.captainName,
        group: selectedTeam.group,
        groupIndex: selectedTeam.groupIndex
      },
      pickingState: {
        currentRound,
        nextGroupIndex,
        nextGroupName,
        availableTeamsCount: remainingAvailableTeams.length,
        totalAssigned: totalPicks
      }
    });
  } catch (error) {
    console.error('Error picking team randomly:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = { router, setIo };

