import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles.css';
import './styles-theme.css';
import './styles-team-register.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import './i18n'; // Import i18n configuration
import './utils/axiosConfig'; // Set up global axios interceptors

// Polyfill for crypto.randomUUID if not available
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = function() {
    // Generate a UUID v4 using crypto.getRandomValues (more widely supported)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

// Filter out browser extension console messages and WebSocket connection errors
const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

const shouldFilter = (args) => {
  const message = args.join(' ').toLowerCase();
  return message.includes('chext') || 
         message.includes('chext_driver') || 
         message.includes('chext_loader') ||
         message.includes('initialized driver') ||
         message.includes('initialized chextloader') ||
         (message.includes('unload event listeners') && message.includes('deprecated')) ||
         // Filter WebSocket connection errors that occur during reconnection/cleanup
         message.includes('websocket is closed before the connection is established') ||
         (message.includes('websocket connection to') && message.includes('failed')) ||
         // Filter WebSocket errors for port 3000 (React dev server - Socket.io will fallback to polling)
         (message.includes('websocket') && message.includes(':3000'));
};

const shouldFilterError = (args) => {
  const message = args.join(' ').toLowerCase();
  return shouldFilter(args) ||
         // Filter WebSocket errors that are side effects of cleanup
         (message.includes('websocket') && message.includes('closed') && message.includes('connection')) ||
         // Filter WebSocketClient.js errors (Socket.io internal connection attempts)
         (message.includes('websocketclient') && message.includes('failed')) ||
         // Filter the specific "WebSocket is closed before the connection is established" error
         (message.includes('websocket connection to') && message.includes('failed') && message.includes('closed before')) ||
         // Filter "WebSocket is closed before the connection is established" (exact match)
         (message.includes('websocket is closed before the connection is established')) ||
         // Filter Socket.io WebSocket connection errors
         (message.includes('socket.io') && message.includes('websocket') && message.includes('failed')) ||
         // Filter any WebSocket errors related to socket.io transport fallback
         (message.includes('websocket') && message.includes('socket.io') && (message.includes('failed') || message.includes('closed')));
};

if (process.env.NODE_ENV === 'development') {
  console.log = (...args) => {
    if (!shouldFilter(args)) {
      originalLog.apply(console, args);
    }
  };

  console.info = (...args) => {
    if (!shouldFilter(args)) {
      originalInfo.apply(console, args);
    }
  };

  console.warn = (...args) => {
    if (!shouldFilter(args)) {
      originalWarn.apply(console, args);
    }
  };

  console.error = (...args) => {
    if (!shouldFilterError(args)) {
      originalError.apply(console, args);
    }
  };
} else {
  // In production, only filter WebSocket errors to reduce noise
  console.error = (...args) => {
    if (!shouldFilterError(args)) {
      originalError.apply(console, args);
    }
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// Suppress WebSocket errors from window error events (browser-native errors)
const originalWindowError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  const errorMessage = String(message || '').toLowerCase();
  // Suppress WebSocket connection errors that occur during cleanup/reconnection
  // These are expected when socket.io tries websocket and falls back to polling
  if (errorMessage.includes('websocket') && 
      (errorMessage.includes('closed before') || 
       errorMessage.includes('connection failed') ||
       errorMessage.includes('failed: websocket is closed') ||
       (errorMessage.includes('socket.io') && errorMessage.includes('failed')) ||
       (errorMessage.includes('socket.io') && errorMessage.includes('websocket') && errorMessage.includes('closed')))) {
    return true; // Suppress the error
  }
  // Call original error handler if not a WebSocket error
  if (originalWindowError) {
    return originalWindowError(message, source, lineno, colno, error);
  }
  return false;
};

// Suppress unhandled promise rejections related to WebSocket
window.addEventListener('unhandledrejection', (event) => {
  const reason = String(event.reason || '').toLowerCase();
  if (reason.includes('websocket') && 
      (reason.includes('closed before') || 
       reason.includes('connection failed') ||
       reason.includes('websocket is closed before the connection is established') ||
       (reason.includes('socket.io') && reason.includes('failed')))) {
    event.preventDefault(); // Suppress the error
  }
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
