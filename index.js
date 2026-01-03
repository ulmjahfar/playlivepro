// Root entry point for deployment
// This file starts the backend server
require('dotenv').config();
const path = require('path');

// Start the backend server
require(path.join(__dirname, 'backend', 'server.js'));

