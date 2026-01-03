const mongoose = require('mongoose');
const User = require('./models/User');

async function queryUsers() {
  try {
    await mongoose.connect('mongodb://localhost:27017/playlive');
    console.log('Connected to MongoDB');

    const users = await User.find({});
    console.log('Found users:', users.length);

    if (users.length > 0) {
      users.forEach(user => {
        console.log(`ID: ${user._id}, Username: ${user.username}, Role: ${user.role}, TournamentId: ${user.tournamentId}, PlainPassword: ${user.plainPassword}`);
      });
    } else {
      console.log('No users found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

queryUsers();
