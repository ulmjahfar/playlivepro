const mongoose = require('mongoose');
const User = require('./models/User');
const Tournament = require('./models/Tournament');

async function resetPassword() {
  try {
    await mongoose.connect('mongodb://localhost:27017/playlive');
    console.log('Connected to MongoDB');

    const tournament = await Tournament.findOne({ code: 'KPL2025' });
    if (!tournament) {
      console.log('Tournament not found');
      return;
    }

    const user = await User.findById(tournament.adminId);
    if (!user) {
      console.log('User not found');
      return;
    }

    const newPassword = 'admin123'; // Set a known password
    user.password = newPassword;
    user.plainPassword = newPassword; // Store plain password for TournamentAdmin
    await user.save();

    // Also update the tournament's adminPasswordHash to the plain password for reference
    tournament.adminPasswordHash = newPassword;
    await tournament.save();

    console.log('Password reset to:', newPassword);
    console.log('Username:', tournament.adminUsername);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

resetPassword();
