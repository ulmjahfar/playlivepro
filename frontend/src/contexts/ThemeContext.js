import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  useEffect(() => {
    // Always apply light theme
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.setAttribute('data-theme', 'light');
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add('theme-light');
    // Remove any dark theme preference from localStorage
    localStorage.removeItem('appTheme');
  }, []);

  const value = {
    theme: 'light',
    setTheme: () => {}, // No-op
    toggleTheme: () => {}, // No-op
    isDark: false,
    isLight: true
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

