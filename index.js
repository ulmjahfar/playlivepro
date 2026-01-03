// Root entry point for deployment
// This file starts the backend server
const path = require('path');

// Set NODE_PATH to include backend/node_modules so dependencies can be resolved
// This ensures that when server.js requires modules, they are found in backend/node_modules
const backendNodeModules = path.join(__dirname, 'backend', 'node_modules');
process.env.NODE_PATH = (process.env.NODE_PATH ? process.env.NODE_PATH + path.delimiter : '') + backendNodeModules;
require('module')._initPaths();

// Change to backend directory to ensure all relative paths work correctly
const backendDir = path.join(__dirname, 'backend');
process.chdir(backendDir);

// Start the backend server using absolute path (server.js already loads dotenv)
require(path.join(backendDir, 'server.js'));

