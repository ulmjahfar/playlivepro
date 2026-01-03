const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const SystemSettings = require('../models/SystemSettings');

/**
 * Daily cleanup job to delete tournaments that have reached their auto-delete date
 * This should be run once per day (e.g., via cron or scheduled task)
 */
async function runAutoDeleteCleanup() {
  try {
    console.log('🧹 Starting auto-delete cleanup job...');
    
    // Get system settings
    const systemSettings = await SystemSettings.getSettings();
    
    // If auto-delete is disabled globally, skip cleanup
    if (!systemSettings.autoDeleteEnabled) {
      console.log('⏭️  Auto-delete is disabled globally. Skipping cleanup.');
      return { deleted: 0, skipped: 0 };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    // Find tournaments that should be deleted:
    // 1. autoDeleteAt <= today
    // 2. Tournament is completed (status = 'Completed' or 'End')
    // 3. Either autoDeleteEnabled is true/null (not explicitly disabled)
    const tournamentsToDelete = await Tournament.find({
      autoDeleteAt: { $lte: today },
      status: { $in: ['Completed', 'End'] },
      $or: [
        { autoDeleteEnabled: { $ne: false } }, // Not explicitly disabled
        { autoDeleteEnabled: null } // Using system setting
      ]
    });
    
    console.log(`📋 Found ${tournamentsToDelete.length} tournament(s) scheduled for deletion`);
    
    let deletedCount = 0;
    let skippedCount = 0;
    
    for (const tournament of tournamentsToDelete) {
      try {
        // Double-check: if tournament explicitly disabled auto-delete, skip
        if (tournament.autoDeleteEnabled === false) {
          console.log(`⏭️  Skipping ${tournament.code} - auto-delete explicitly disabled`);
          skippedCount++;
          continue;
        }
        
        // Double-check: if system auto-delete is disabled and tournament doesn't override, skip
        if (!systemSettings.autoDeleteEnabled && tournament.autoDeleteEnabled !== true) {
          console.log(`⏭️  Skipping ${tournament.code} - system auto-delete disabled`);
          skippedCount++;
          continue;
        }
        
        console.log(`🗑️  Deleting tournament: ${tournament.code} (${tournament.name})`);
        console.log(`   Auto-delete date: ${tournament.autoDeleteAt}`);
        console.log(`   Auction completed: ${tournament.auctionEndedAt || tournament.auctionState?.completedAt}`);
        
        // Use the existing deleteTournament function
        // Note: This function expects a code string and handles its own DB connection
        // We need to adapt it or create a version that works with an already-connected DB
        await deleteTournamentByCode(tournament.code);
        
        deletedCount++;
        console.log(`✅ Successfully deleted tournament: ${tournament.code}`);
      } catch (error) {
        console.error(`❌ Error deleting tournament ${tournament.code}:`, error);
        // Continue with other tournaments
      }
    }
    
    console.log(`✅ Auto-delete cleanup completed. Deleted: ${deletedCount}, Skipped: ${skippedCount}`);
    return { deleted: deletedCount, skipped: skippedCount };
  } catch (error) {
    console.error('❌ Error in auto-delete cleanup job:', error);
    throw error;
  }
}

/**
 * Delete tournament by code (adapted from deleteTournament.js to work with existing connection)
 * Note: This function assumes mongoose is already connected
 */
async function deleteTournamentByCode(code) {
  const Tournament = require('../models/Tournament');
  const Player = require('../models/Player');
  const Team = require('../models/Team');
  const User = require('../models/User');
  const path = require('path');
  const fs = require('fs');
  
  // Ensure we're using the existing connection, not creating a new one
  
  const tournament = await Tournament.findOne({ code });
  if (!tournament) {
    console.log(`Tournament not found: ${code}`);
    return;
  }
  
  // Delete players
  const players = await Player.find({ tournamentCode: tournament.code });
  for (const player of players) {
    try {
      if (player.photo) {
        const photoPath = path.join(__dirname, '..', 'uploads', player.photo);
        if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
      }
      if (player.receipt) {
        const receiptPath = path.join(__dirname, '..', 'uploads', player.receipt);
        if (fs.existsSync(receiptPath)) fs.unlinkSync(receiptPath);
      }
      const cardPath = path.join(__dirname, '..', 'player_cards', `${player.playerId}.pdf`);
      if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
      await Player.findByIdAndDelete(player._id);
    } catch (err) {
      console.error(`Error deleting player ${player.playerId}:`, err);
    }
  }
  
  // Delete teams
  const teams = await Team.find({ tournamentCode: tournament.code });
  for (const team of teams) {
    try {
      if (team.logo) {
        const teamLogoPath = path.join(__dirname, '..', 'uploads', team.logo);
        if (fs.existsSync(teamLogoPath)) fs.unlinkSync(teamLogoPath);
      }
      for (const guest of team.guestPlayers || []) {
        if (guest.photo) {
          const guestPhotoPath = path.join(__dirname, '..', 'uploads', guest.photo);
          if (fs.existsSync(guestPhotoPath)) fs.unlinkSync(guestPhotoPath);
        }
      }
      await Team.findByIdAndDelete(team._id);
    } catch (err) {
      console.error(`Error deleting team ${team.name}:`, err);
    }
  }
  
  // Delete tournament admin user
  if (tournament.adminId) {
    try {
      await User.findByIdAndDelete(tournament.adminId);
    } catch (err) {
      console.error(`Error deleting admin user:`, err);
    }
  }
  
  // Delete tournament logo
  if (tournament.logo) {
    try {
      const logoPath = path.join(__dirname, '..', tournament.logo);
      if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
    } catch (err) {
      console.error(`Error deleting tournament logo:`, err);
    }
  }
  
  // Delete tournament document
  await Tournament.findByIdAndDelete(tournament._id);
}

// If running as a standalone script
if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/playlive')
    .then(async () => {
      console.log('✅ Connected to MongoDB');
      await runAutoDeleteCleanup();
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Error:', err);
      process.exit(1);
    });
}

module.exports = { runAutoDeleteCleanup };

