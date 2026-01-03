const mongoose = require('mongoose');
const Tournament = require('./models/Tournament');

async function queryTournament() {
  try {
    await mongoose.connect('mongodb://localhost:27017/playlive');
    console.log('Connected to MongoDB');

    const tournaments = await Tournament.find({});
    console.log('Found tournaments:', tournaments.length);

    if (tournaments.length > 0) {
      tournaments.forEach(tournament => {
        console.log(JSON.stringify(tournament, null, 2));
        console.log('---');
      });
    } else {
      console.log('No tournaments found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

queryTournament();
