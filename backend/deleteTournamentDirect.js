const mongoose = require('mongoose');

async function deleteTournamentDirect() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/playlive');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const tournamentsCollection = db.collection('tournaments');
    
    // Find tournament by name (case-insensitive)
    const tournament = await tournamentsCollection.findOne({ 
      name: { $regex: 'KERALA PREMIER SUPER CUP 2026', $options: 'i' }
    });
    
    if (!tournament) {
      console.log('Tournament not found. Listing all tournaments:');
      const allTournaments = await tournamentsCollection.find({}).toArray();
      allTournaments.forEach(t => {
        console.log(`  - ${t.name} (Code: ${t.code}, ID: ${t._id})`);
      });
      await mongoose.disconnect();
      return;
    }
    
    console.log('Found tournament:');
    console.log(`  Name: ${tournament.name}`);
    console.log(`  Code: ${tournament.code}`);
    console.log(`  ID: ${tournament._id}`);
    console.log(`  Admin ID: ${tournament.adminId}`);
    
    const tournamentCode = tournament.code;
    const tournamentId = tournament._id;
    const adminId = tournament.adminId;
    
    // Delete players
    const playersCollection = db.collection('players');
    const playersResult = await playersCollection.deleteMany({ tournamentCode: tournamentCode });
    console.log(`\nDeleted ${playersResult.deletedCount} players`);
    
    // Delete teams
    const teamsCollection = db.collection('teams');
    const teamsResult = await teamsCollection.deleteMany({ tournamentCode: tournamentCode });
    console.log(`Deleted ${teamsResult.deletedCount} teams`);
    
    // Delete admin user if exists
    if (adminId) {
      const usersCollection = db.collection('users');
      const userResult = await usersCollection.deleteOne({ _id: adminId });
      console.log(`Deleted ${userResult.deletedCount} admin user(s)`);
    }
    
    // Delete tournament
    const tournamentResult = await tournamentsCollection.deleteOne({ _id: tournamentId });
    console.log(`Deleted ${tournamentResult.deletedCount} tournament(s)`);
    
    console.log('\n✅ Tournament and associated data deleted successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

deleteTournamentDirect();



