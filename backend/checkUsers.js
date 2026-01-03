const mongoose = require('mongoose');
const User = require('./models/User');

async function checkUsers() {
  try {
    await mongoose.connect('mongodb://localhost:27017/playlive');
    console.log('Connected to MongoDB');

    const users = await User.find({ role: 'TournamentAdmin' });
    console.log('Found TournamentAdmin users:', users.length);

    users.forEach(user => {
      console.log(`ID: ${user._id}, Username: ${user.username}, Role: ${user.role}, TournamentId: ${user.tournamentId}, PlainPassword: ${user.plainPassword}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkUsers();
