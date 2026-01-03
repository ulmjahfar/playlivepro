require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function updateSuperAdminPassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/playlive');
    console.log('Connected to MongoDB');

    const superAdmin = await User.findOne({ role: 'SuperAdmin' });
    if (!superAdmin) {
      console.log('No SuperAdmin found');
      return;
    }

    superAdmin.password = 'superadmin123'; // This will be hashed by pre-save
    await superAdmin.save();
    console.log('SuperAdmin password updated successfully');
    console.log('Username:', superAdmin.username);
    console.log('Password: superadmin123');
  } catch (error) {
    console.error('Error updating SuperAdmin password:', error);
  } finally {
    mongoose.connection.close();
  }
}

updateSuperAdminPassword();
