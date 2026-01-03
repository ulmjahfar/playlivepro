import axios from 'axios';
import { toast } from 'react-toastify';

// Set up axios interceptors for global error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized errors globally
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      
      // Don't redirect if already on a login page
      if (!currentPath.includes('/login')) {
        // Clear authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Determine which login page to redirect to based on the error or current path
        let loginPath = '/login/tournament-admin';
        if (currentPath.includes('/dashboard/superadmin') || currentPath.includes('/superadmin')) {
          loginPath = '/login/super-admin';
        }
        
        // Show error message
        toast.error('Session expired. Please login again.');
        
        // Redirect to login page
        setTimeout(() => {
          window.location.href = loginPath;
        }, 1000);
      }
    }
    
    // Return the error so individual components can still handle it if needed
    return Promise.reject(error);
  }
);

export default axios;

