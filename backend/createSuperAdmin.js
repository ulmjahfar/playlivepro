require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function createSuperAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/playlive');
    console.log('Connected to MongoDB');

    const existingSuperAdmin = await User.findOne({ role: 'SuperAdmin' });
    if (existingSuperAdmin) {
      console.log('SuperAdmin already exists:', existingSuperAdmin.username);
      return;
    }

    const superAdmin = new User({
      username: 'superadmin',
      email: 'superadmin@playlive.ddns.me',
      password: 'superadmin123', // Change this to a secure password
      role: 'SuperAdmin'
    });

    await superAdmin.save();
    console.log('SuperAdmin created successfully');
    console.log('Username: superadmin');
    console.log('Password: superadmin123');
  } catch (error) {
    console.error('Error creating SuperAdmin:', error);
  } finally {
    mongoose.connection.close();
  }
}

createSuperAdmin();
