import React, { useState, useEffect } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import DesktopNav2025 from './DesktopNav2025';
import MobileNav from './MobileNav';

const NavigationShell = ({ 
  user, 
  onLogout, 
  onShowGoLive 
}) => {
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
  
  console.log('NavigationShell rendering:', { user: !!user, isMobile });
  
  if (!user) {
    console.log('No user, returning null');
    return null;
  }

  return isMobile ? (
    <MobileNav user={user} onShowGoLive={onShowGoLive} onLogout={onLogout} />
  ) : (
    <DesktopNav2025 
      user={user} 
      onLogout={onLogout} 
      onShowGoLive={onShowGoLive}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
};

export default NavigationShell;