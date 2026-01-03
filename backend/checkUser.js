const mongoose = require('mongoose');
const User = require('./models/User');

async function checkUser() {
  try {
    await mongoose.connect('mongodb://localhost:27017/playlive');
    console.log('Connected to MongoDB');

    const user = await User.findById('69020fbf690ed5d419247116');
    if (user) {
      console.log('User found:', {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        password: user.password ? 'set' : 'not set'
      });
    } else {
      console.log('User not found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkUser();
