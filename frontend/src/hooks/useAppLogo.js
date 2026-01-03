import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/apiConfig';

/**
 * Custom hook to fetch and use the app logo throughout the application
 * @returns {Object} { logoUrl, loading, error }
 */
export const useAppLogo = () => {
  const [logoUrl, setLogoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        setLoading(true);
        // Add a short timeout to fail fast if backend is not available
        const res = await axios.get(`${API_BASE_URL}/api/auto-delete/app-logo`, {
          timeout: 2000, // 2 second timeout
          validateStatus: (status) => status < 500 // Don't throw on 4xx errors
        });
        if (res.data.success && res.data.logoUrl) {
          setLogoUrl(res.data.logoUrl);
        } else {
          setLogoUrl(null);
        }
        setError(null);
      } catch (err) {
        // Check if this is a network/connection error (backend not running)
        const isNetworkError = 
          err.code === 'ERR_NETWORK' || 
          err.code === 'ECONNREFUSED' ||
          err.code === 'ETIMEDOUT' ||
          err.code === 'ECONNABORTED' ||
          err.message === 'Network Error' ||
          (err.message && err.message.includes('ERR_CONNECTION_REFUSED')) ||
          (err.message && err.message.includes('timeout'));
        
        // Silently handle network errors - don't log or set error state
        // This allows the app to work without a backend connection
        if (!isNetworkError) {
          console.error('Error fetching app logo:', err);
          setError(err);
        }
        setLogoUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLogo();
  }, []);

  return { logoUrl, loading, error };
};

/**
 * Helper function to get app logo URL (for use outside React components)
 * @returns {Promise<string|null>} Logo URL or null
 */
export const getAppLogoUrl = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/auto-delete/app-logo`, {
      timeout: 2000, // 2 second timeout
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });
    if (res.data.success && res.data.logoUrl) {
      return res.data.logoUrl;
    }
    return null;
  } catch (err) {
    // Check if this is a network/connection error (backend not running)
    const isNetworkError = 
      err.code === 'ERR_NETWORK' || 
      err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'ECONNABORTED' ||
      err.message === 'Network Error' ||
      (err.message && err.message.includes('ERR_CONNECTION_REFUSED')) ||
      (err.message && err.message.includes('timeout'));
    
    // Silently handle network errors
    if (!isNetworkError) {
      console.error('Error fetching app logo:', err);
    }
    return null;
  }
};





