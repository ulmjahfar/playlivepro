const mongoose = require('mongoose');
const Tournament = require('./models/Tournament');
const fs = require('fs');

async function listTournaments() {
  try {
    await mongoose.connect('mongodb://localhost:27017/playlive');
    console.log('Connected to MongoDB');

    const tournaments = await Tournament.find({});
    console.log('Found tournaments:', tournaments.length);

    let output = `Total tournaments: ${tournaments.length}\n\n`;
    if (tournaments.length > 0) {
      tournaments.forEach((tournament, index) => {
        output += `Tournament ${index + 1}:\n`;
        output += `  Name: ${tournament.name}\n`;
        output += `  Code: ${tournament.code}\n`;
        output += `  Sport: ${tournament.sport}\n`;
        output += `  Status: ${tournament.status}\n`;
        output += `  ID: ${tournament._id}\n`;
        output += `  Admin ID: ${tournament.adminId}\n`;
        output += `---\n`;
      });
    } else {
      output += 'No tournaments found\n';
    }

    fs.writeFileSync('tournaments_list.txt', output);
    console.log('Tournaments list saved to tournaments_list.txt');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

listTournaments();
