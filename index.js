// Root entry point for deployment
// This file starts the backend server
const path = require('path');
const Module = require('module');

const backendDir = path.join(__dirname, 'backend');
const backendNodeModules = path.join(backendDir, 'node_modules');

// Patch Module._nodeModulePaths to include backend/node_modules
const originalNodeModulePaths = Module._nodeModulePaths;
Module._nodeModulePaths = function(from) {
  const paths = originalNodeModulePaths.call(this, from);
  // Add backend/node_modules if not already present
  if (!paths.includes(backendNodeModules)) {
    paths.unshift(backendNodeModules);
  }
  return paths;
};

// Change to backend directory to ensure all relative paths work correctly
process.chdir(backendDir);

// Start the backend server using absolute path (server.js already loads dotenv)
require(path.join(backendDir, 'server.js'));

