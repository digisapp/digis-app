import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import MobileNavigation from './MobileNavigation';
import ImprovedNavigation from '../ImprovedNavigation';
import { useMediaQuery } from '../../hooks/useMediaQuery';

/**
 * Responsive Navigation Container
 * Automatically switches between desktop and mobile navigation
 */
const ResponsiveNavigation = ({
  currentView,
  setCurrentView,
  onViewChange, // Alternative prop name
  isCreator,
  isAdmin,
  tokenBalance,
  user,
  onTokenPurchase,
  onSignOut,
  ...props
}) => {
  const [unreadMessages, setUnreadMessages] = useState(0);
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Use onViewChange if setCurrentView is not provided
  const viewChangeHandler = setCurrentView || onViewChange;
  
  console.log('ResponsiveNavigation props:', {
    currentView,
    setCurrentView: typeof setCurrentView,
    isCreator,
    isMobile
  });

  // Mock unread messages count (in real app, this would come from context/state)
  useEffect(() => {
    // Simulate fetching unread messages
    const fetchUnreadMessages = () => {
      // This would be a real API call
      setUnreadMessages(Math.floor(Math.random() * 5));
    };

    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);

  const handleProfileClick = () => {
    if (viewChangeHandler) {
      viewChangeHandler('profile');
    }
  };
  
  const commonProps = {
    currentView,
    setCurrentView: viewChangeHandler,
    isCreator,
    isAdmin,
    tokenBalance,
    user,
    unreadMessages,
    onTokenPurchase,
    onProfileClick: handleProfileClick,
    ...props
  };

  if (isMobile) {
    return (
      <MobileNavigation
        {...commonProps}
        onSignOut={onSignOut}
      />
    );
  }

  return (
    <ImprovedNavigation
      {...commonProps}
      onSignOut={onSignOut}
    />
  );
};

export default ResponsiveNavigation;