const mongoose = require('mongoose');
const Tournament = require('./models/Tournament');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/playlive').then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

async function fixAuctionRules() {
  try {
    // Use raw MongoDB collection to bypass Mongoose schema validation
    const db = mongoose.connection.db;
    const collection = db.collection('tournaments');

    const tournaments = await collection.find({}).toArray();
    console.log(`Found ${tournaments.length} tournaments`);

    for (const tournament of tournaments) {
      let auctionRules = tournament.auctionRules;

      // If auctionRules is a string, parse it
      if (typeof auctionRules === 'string') {
        try {
          auctionRules = JSON.parse(auctionRules);
          console.log(`Parsed auctionRules for tournament ${tournament.code}`);
        } catch (parseError) {
          console.error(`Error parsing auctionRules for tournament ${tournament.code}:`, parseError);
          continue;
        }
      }

      // Ensure it's an object
      if (typeof auctionRules !== 'object' || auctionRules === null) {
        auctionRules = {
          type: 'straight',
          fixedIncrement: 200,
          maxBidsPerPlayer: 5,
          bidLimitMode: 'limit',
          bidLimitCount: 5,
          ranges: [],
          baseValueOfPlayer: 0,
          maxFundForTeam: 0
        };
      } else {
        auctionRules.bidLimitMode = auctionRules.bidLimitMode || 'limit';
        if (auctionRules.bidLimitMode === 'unlimited') {
          auctionRules.bidLimitCount = null;
          auctionRules.maxBidsPerPlayer = null;
        } else {
          const fallback = auctionRules.bidLimitCount ?? auctionRules.maxBidsPerPlayer ?? 5;
          auctionRules.bidLimitCount = Number(fallback);
          auctionRules.maxBidsPerPlayer = auctionRules.bidLimitCount;
        }
      }

      // Change type to 'straight' and set fixedIncrement to 200
      auctionRules.type = 'straight';
      auctionRules.fixedIncrement = 200;

      // Update the tournament using raw collection
      await collection.updateOne(
        { _id: tournament._id },
        { $set: { auctionRules } }
      );
      console.log(`Updated auctionRules for tournament ${tournament.code}`);
    }

    console.log('All tournaments updated successfully');
  } catch (error) {
    console.error('Error fixing auctionRules:', error);
  } finally {
    mongoose.disconnect();
  }
}

fixAuctionRules();
