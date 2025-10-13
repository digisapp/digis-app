import React, { useState, useEffect } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useAuth } from '../../contexts/AuthContext';
import DesktopNav2025 from './DesktopNav2025';
import MobileNav from './MobileNav';

const NavigationShell = ({
  onLogout,
  onShowGoLive
}) => {
  // Use AuthContext for user data
  const { currentUser } = useAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [theme, setTheme] = useState(() => {
    // Get initial theme from localStorage or default to light
    return localStorage.getItem('theme') || 'light';
  });

  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  console.log('NavigationShell rendering:', { user: !!currentUser, isMobile });

  if (!currentUser) {
    console.log('No user, returning null');
    return null;
  }

  return isMobile ? (
    <MobileNav onShowGoLive={onShowGoLive} onLogout={onLogout} />
  ) : (
    <DesktopNav2025
      onLogout={onLogout}
      onShowGoLive={onShowGoLive}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
};

export default NavigationShell;