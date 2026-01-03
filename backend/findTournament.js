const mongoose = require('mongoose');
const Tournament = require('./models/Tournament');

async function findTournament() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/playlive');
    console.log('Connected to MongoDB');

    // Search for tournament by name (case-insensitive)
    const tournament = await Tournament.findOne({ 
      name: { $regex: 'KERALA PREMIER SUPER CUP 2026', $options: 'i' }
    });
    
    if (!tournament) {
      console.log('Tournament not found. Listing all tournaments:');
      const allTournaments = await Tournament.find({}).select('name code _id');
      allTournaments.forEach(t => {
        console.log(`  - ${t.name} (Code: ${t.code}, ID: ${t._id})`);
      });
    } else {
      console.log('Found tournament:');
      console.log(`  Name: ${tournament.name}`);
      console.log(`  Code: ${tournament.code}`);
      console.log(`  ID: ${tournament._id}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

findTournament();



