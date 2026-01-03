require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function checkSuperAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/playlive');
    console.log('Connected to MongoDB');

    const superAdmin = await User.findOne({ role: 'SuperAdmin' });
    if (!superAdmin) {
      console.log('No SuperAdmin found');
      return;
    }

    console.log('SuperAdmin found:');
    console.log('Username:', superAdmin.username);
    console.log('Email:', superAdmin.email);
    console.log('Role:', superAdmin.role);
    // Note: password is hashed, so not logging it
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkSuperAdmin();
