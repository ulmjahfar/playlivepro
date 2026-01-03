const mongoose = require('mongoose');
const Tournament = require('./models/Tournament');
const Player = require('./models/Player');
const Team = require('./models/Team');
const User = require('./models/User');
const path = require('path');
const fs = require('fs');

async function deleteTournament(code) {
  try {
    await mongoose.connect('mongodb://localhost:27017/playlive');
    console.log('Connected to MongoDB');

    console.log('Attempting to delete tournament with code:', code);
    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      console.log('Tournament not found for code:', code);
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
          const photoPath = path.join(__dirname, 'uploads', player.photo);
          if (fs.existsSync(photoPath)) {
            fs.unlinkSync(photoPath);
            console.log('Deleted photo file:', photoPath);
          } else {
            console.log('Photo file not found:', photoPath);
          }
        }

        // Delete receipt file
        if (player.receipt) {
          const receiptPath = path.join(__dirname, 'uploads', player.receipt);
          if (fs.existsSync(receiptPath)) {
            fs.unlinkSync(receiptPath);
            console.log('Deleted receipt file:', receiptPath);
          } else {
            console.log('Receipt file not found:', receiptPath);
          }
        }

        // Delete player card PDF
        const cardPath = path.join(__dirname, 'player_cards', `${player.playerId}.pdf`);
        if (fs.existsSync(cardPath)) {
          fs.unlinkSync(cardPath);
          console.log('Deleted player card PDF:', cardPath);
        } else {
          console.log('Player card PDF not found:', cardPath);
        }

        // Delete player document
        await Player.findByIdAndDelete(player._id);
        console.log('Deleted player document:', player._id);
      } catch (playerError) {
        console.error('Error deleting player:', player.playerId, playerError);
        // Continue with other players
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
          const teamLogoPath = path.join(__dirname, 'uploads', team.logo);
          if (fs.existsSync(teamLogoPath)) {
            fs.unlinkSync(teamLogoPath);
            console.log('Deleted team logo file:', teamLogoPath);
          } else {
            console.log('Team logo file not found:', teamLogoPath);
          }
        }

        // Delete guest player photos
        for (const guest of team.guestPlayers || []) {
          if (guest.photo) {
            const guestPhotoPath = path.join(__dirname, 'uploads', guest.photo);
            if (fs.existsSync(guestPhotoPath)) {
              fs.unlinkSync(guestPhotoPath);
              console.log('Deleted guest photo file:', guestPhotoPath);
            } else {
              console.log('Guest photo file not found:', guestPhotoPath);
            }
          }
        }

        // Delete team document
        await Team.findByIdAndDelete(team._id);
        console.log('Deleted team document:', team._id);
      } catch (teamError) {
        console.error('Error deleting team:', team.name, teamError);
        // Continue with other teams
      }
    }

    // Delete associated TournamentAdmin user
    if (tournament.adminId) {
      try {
        console.log('Deleting admin user:', tournament.adminId);
        await User.findByIdAndDelete(tournament.adminId);
        console.log('Deleted admin user:', tournament.adminId);
      } catch (adminError) {
        console.error('Error deleting admin user:', tournament.adminId, adminError);
        // Continue
      }
    } else {
      console.log('No adminId found for tournament');
    }

    // Delete tournament logo file if exists
    if (tournament.logo) {
      try {
        const logoPath = path.join(__dirname, tournament.logo);
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath);
          console.log('Deleted tournament logo file:', logoPath);
        } else {
          console.log('Tournament logo file not found:', logoPath);
        }
      } catch (logoError) {
        console.error('Error deleting tournament logo:', tournament.logo, logoError);
        // Continue
      }
    }

    // Delete the tournament
    console.log('Deleting tournament document:', tournament._id);
    await Tournament.findByIdAndDelete(tournament._id);
    console.log('Deleted tournament document successfully');

    console.log('Tournament and all associated data deleted successfully');

  } catch (error) {
    console.error('Unexpected error during tournament deletion:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run with code 'ULL2025'
deleteTournament('ULL2025');
