const mongoose = require('mongoose');
const Tournament = require('./models/Tournament');
const Player = require('./models/Player');
const Team = require('./models/Team');
const User = require('./models/User');
const path = require('path');
const fs = require('fs');

async function deleteTournamentByName(tournamentName) {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/playlive');
    console.log('Connected to MongoDB');

    console.log('Searching for tournament with name:', tournamentName);
    // Search case-insensitively
    const tournament = await Tournament.findOne({ 
      name: new RegExp(tournamentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') 
    });
    
    if (!tournament) {
      console.log('Tournament not found with name:', tournamentName);
      // List all tournaments to help user
      const allTournaments = await Tournament.find({});
      console.log('\nAvailable tournaments:');
      allTournaments.forEach(t => {
        console.log(`  - ${t.name} (Code: ${t.code})`);
      });
      return;
    }
    
    console.log('Found tournament:', tournament.name, 'Code:', tournament.code);

    // Find all players associated with this tournament
    console.log('Finding players for tournament code:', tournament.code);
    const players = await Player.find({ tournamentCode: tournament.code });
    console.log(`Found ${players.length} players to delete`);

    // Delete player files and records
    for (const player of players) {
      try {
        console.log('Deleting player:', player.playerId);
        // Delete photo file
        if (player.photo) {
          const photoPath = path.join(__dirname, 'uploads', 'players', player.photo);
          if (fs.existsSync(photoPath)) {
            fs.unlinkSync(photoPath);
            console.log('  ✓ Deleted photo file:', player.photo);
          }
        }

        // Delete receipt file
        if (player.receipt) {
          const receiptPath = path.join(__dirname, 'uploads', player.receipt);
          if (fs.existsSync(receiptPath)) {
            fs.unlinkSync(receiptPath);
            console.log('  ✓ Deleted receipt file:', player.receipt);
          }
        }

        // Delete player card PDF
        if (player.cardPath) {
          const cardPath = path.join(__dirname, 'player_cards', player.cardPath);
          if (fs.existsSync(cardPath)) {
            fs.unlinkSync(cardPath);
            console.log('  ✓ Deleted player card PDF:', player.cardPath);
          }
        } else {
          // Try default naming convention
          const cardPath = path.join(__dirname, 'player_cards', `${player.playerId}.pdf`);
          if (fs.existsSync(cardPath)) {
            fs.unlinkSync(cardPath);
            console.log('  ✓ Deleted player card PDF:', `${player.playerId}.pdf`);
          }
        }

        // Delete player document
        await Player.findByIdAndDelete(player._id);
        console.log('  ✓ Deleted player document:', player._id);
      } catch (playerError) {
        console.error('  ✗ Error deleting player:', player.playerId, playerError.message);
      }
    }

    // Find all teams associated with this tournament
    console.log('Finding teams for tournament code:', tournament.code);
    const teams = await Team.find({ tournamentCode: tournament.code });
    console.log(`Found ${teams.length} teams to delete`);

    // Delete team files and records
    for (const team of teams) {
      try {
        console.log('Deleting team:', team.name);
        // Delete team logo file
        if (team.logo) {
          const teamLogoPath = path.join(__dirname, 'uploads', 'teams', team.logo);
          if (fs.existsSync(teamLogoPath)) {
            fs.unlinkSync(teamLogoPath);
            console.log('  ✓ Deleted team logo file:', team.logo);
          }
          
          // Also check team_logos directory
          const teamLogoPath2 = path.join(__dirname, 'uploads', 'team_logos', team.logo);
          if (fs.existsSync(teamLogoPath2)) {
            fs.unlinkSync(teamLogoPath2);
            console.log('  ✓ Deleted team logo file (alt):', team.logo);
          }
        }

        // Delete guest player photos
        if (team.guestPlayers && Array.isArray(team.guestPlayers)) {
          for (const guest of team.guestPlayers) {
            if (guest.photo) {
              const guestPhotoPath = path.join(__dirname, 'uploads', 'guest_photos', guest.photo);
              if (fs.existsSync(guestPhotoPath)) {
                fs.unlinkSync(guestPhotoPath);
                console.log('  ✓ Deleted guest photo:', guest.photo);
              }
            }
          }
        }

        // Delete team document
        await Team.findByIdAndDelete(team._id);
        console.log('  ✓ Deleted team document:', team._id);
      } catch (teamError) {
        console.error('  ✗ Error deleting team:', team.name, teamError.message);
      }
    }

    // Delete tournament confirmation files
    const confirmationPath = path.join(__dirname, 'uploads', 'confirmations');
    if (fs.existsSync(confirmationPath)) {
      const confirmationFiles = fs.readdirSync(confirmationPath).filter(file => 
        file.startsWith(`${tournament.code}-`)
      );
      for (const file of confirmationFiles) {
        try {
          fs.unlinkSync(path.join(confirmationPath, file));
          console.log('  ✓ Deleted confirmation file:', file);
        } catch (err) {
          console.error('  ✗ Error deleting confirmation:', file, err.message);
        }
      }
    }

    // Delete associated TournamentAdmin user
    if (tournament.adminId) {
      try {
        console.log('Deleting admin user:', tournament.adminId);
        await User.findByIdAndDelete(tournament.adminId);
        console.log('  ✓ Deleted admin user:', tournament.adminId);
      } catch (adminError) {
        console.error('  ✗ Error deleting admin user:', tournament.adminId, adminError.message);
      }
    } else {
      console.log('No adminId found for tournament');
    }

    // Delete tournament logo file if exists
    if (tournament.logo) {
      try {
        const logoPath = path.join(__dirname, 'uploads', 'tournament_logos', tournament.logo);
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath);
          console.log('  ✓ Deleted tournament logo file:', tournament.logo);
        } else {
          // Try alternative path
          const logoPath2 = path.join(__dirname, tournament.logo);
          if (fs.existsSync(logoPath2)) {
            fs.unlinkSync(logoPath2);
            console.log('  ✓ Deleted tournament logo file (alt path):', tournament.logo);
          }
        }
      } catch (logoError) {
        console.error('  ✗ Error deleting tournament logo:', tournament.logo, logoError.message);
      }
    }

    // Delete the tournament
    console.log('Deleting tournament document:', tournament._id);
    await Tournament.findByIdAndDelete(tournament._id);
    console.log('✅ Tournament and all associated data deleted successfully');

  } catch (error) {
    console.error('❌ Unexpected error during tournament deletion:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Get tournament name from command line argument
const tournamentName = process.argv[2] || 'KERALA PREMIER SUPER CUP 2026';
deleteTournamentByName(tournamentName);



