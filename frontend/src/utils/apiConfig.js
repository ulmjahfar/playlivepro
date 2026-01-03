// Dynamic API URL configuration
export const getApiBaseUrl = () => {
  // Check for environment variable first (for production)
  if (process.env.REACT_APP_API_URL) {
    console.log('Using REACT_APP_API_URL from env:', process.env.REACT_APP_API_URL);
    return process.env.REACT_APP_API_URL;
  }
  
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // If accessing from localhost, use localhost backend
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('API Base URL: Using localhost backend');
    return 'http://localhost:5000';
  }
  
  // For LAN/WAN access, use the same hostname but with port 5000 for backend
  const apiUrl = `${protocol}//${hostname}:5000`;
  console.log('🚀 API Base URL configured:', apiUrl, '| Hostname:', hostname, '| Protocol:', protocol);
  return apiUrl;
};

// Evaluate at module load time
const computedApiUrl = getApiBaseUrl();
console.log('📡 API_BASE_URL constant set to:', computedApiUrl);
export const API_BASE_URL = computedApiUrl;
