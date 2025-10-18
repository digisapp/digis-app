// src/components/NotificationBell.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { BellIcon } from '@heroicons/react/24/outline';
import { useApp } from '../hooks/useApp';
import NotificationDropdown from './NotificationDropdown';
import { getAuthToken } from '../utils/auth-helpers';

const NotificationBell = () => {
  const { state } = useApp();

  // ✅ Early return BEFORE hooks (fixes React error #310)
  if (!state.user) return null;

  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const bellRef = useRef(null);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    // No need to check state.user - guaranteed to exist

    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/notifications?limit=1&unread_only=true`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const newUnreadCount = data.unread_count;
        
        // Trigger shake animation if new notifications arrived
        if (newUnreadCount > unreadCount && unreadCount > 0) {
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 1000);
        }
        
        setUnreadCount(newUnreadCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [unreadCount]); // Removed state.user dependency - guaranteed to exist

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    fetchUnreadCount();

    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]); // Removed state.user check - component only renders when user exists

  // Update count when notification dropdown closes
  const handleNotificationDropdownClose = () => {
    setShowNotifications(false);
    fetchUnreadCount();
  };

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        ref={bellRef}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={isShaking ? {
          rotate: [0, -10, 10, -10, 10, 0],
          transition: { duration: 0.5 }
        } : {}}
        onClick={() => setShowNotifications(!showNotifications)}
        style={{
          position: 'relative',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          padding: '12px',
          cursor: 'pointer',
          color: '#1f2937',
          fontSize: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '48px',
          height: '48px',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
        }}
      >
        <BellIcon 
          style={{
            width: '24px',
            height: '24px',
            filter: unreadCount > 0 ? 'brightness(1.2)' : 'none'
          }}
        />
        
        {/* Unread count badge */}
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: 'bold',
              padding: '2px 6px',
              minWidth: '18px',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(240, 147, 251, 0.4)',
              border: '2px solid white'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.div>
        )}
        
        {/* Pulse animation for new notifications */}
        {unreadCount > 0 && (
          <motion.div
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.6, 0, 0.6]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              width: '18px',
              height: '18px',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              borderRadius: '12px',
              pointerEvents: 'none'
            }}
          />
        )}
      </motion.button>

      {/* Notification Dropdown */}
      <NotificationDropdown
        isOpen={showNotifications}
        onClose={handleNotificationDropdownClose}
        anchorRef={bellRef}
      />
    </div>
  );
};

export default NotificationBell;