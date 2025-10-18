// src/components/EnhancedNotificationBell.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellIcon } from '@heroicons/react/24/outline';
import { BellIcon as BellIconSolid, SparklesIcon } from '@heroicons/react/24/solid';
import { useApp } from '../hooks/useApp';
import { supabase } from '../utils/supabase-auth';
import SimpleNotificationBox from './SimpleNotificationBox';

const EnhancedNotificationBell = () => {
  const { state } = useApp();

  // ✅ Early return BEFORE hooks (fixes React error #310)
  if (!state.user) return null;

  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const bellRef = useRef(null);
  const fetchingRef = useRef(false);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (fetchingRef.current) return; // Removed state.user check - guaranteed to exist
    
    fetchingRef.current = true;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('No auth token available');
        return;
      }
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/notifications?limit=1&unread_only=true`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const newUnreadCount = data.unread_count || 0;
        
        // Trigger animation if new notifications arrived
        if (newUnreadCount > unreadCount && unreadCount > 0) {
          setHasNewNotifications(true);
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 3000);
        }
        
        setUnreadCount(newUnreadCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    } finally {
      fetchingRef.current = false;
    }
  }, [unreadCount]); // Removed state.user dependency - guaranteed to exist

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    fetchUnreadCount();

    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]); // Removed state.user check - component only renders when user exists

  // Update count when notification box closes
  const handleNotificationBoxClose = () => {
    setShowNotifications(false);
    setHasNewNotifications(false);
    fetchUnreadCount();
  };

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        ref={bellRef}
        data-notification-bell
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={isAnimating ? {
          rotate: [0, -15, 15, -15, 15, -10, 10, -5, 5, 0],
          transition: { duration: 0.8, ease: "easeInOut" }
        } : {}}
        onClick={() => setShowNotifications(!showNotifications)}
        style={{
          position: 'relative',
          background: showNotifications 
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
            : 'white',
          border: showNotifications 
            ? 'none' 
            : '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: '16px',
          padding: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '48px',
          height: '48px',
          transition: 'all 0.3s ease',
          boxShadow: showNotifications 
            ? '0 8px 24px rgba(99, 102, 241, 0.25)' 
            : '0 2px 8px rgba(0, 0, 0, 0.06)',
          transform: 'translateZ(0)' // Force GPU acceleration
        }}
      >
        <motion.div
          animate={showNotifications ? { scale: 1.1 } : { scale: 1 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          {showNotifications ? (
            <BellIconSolid 
              style={{
                width: '24px',
                height: '24px',
                color: 'white'
              }}
            />
          ) : (
            <BellIcon 
              style={{
                width: '24px',
                height: '24px',
                color: unreadCount > 0 ? '#6366f1' : '#64748b'
              }}
            />
          )}
        </motion.div>
        
        {/* Unread count badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                background: 'linear-gradient(135deg, #f93b73 0%, #f5576c 100%)',
                color: 'white',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '700',
                padding: '4px 8px',
                minWidth: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(249, 59, 115, 0.4)',
                border: '2px solid white'
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* New notification sparkle effect */}
        <AnimatePresence>
          {hasNewNotifications && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              style={{
                position: 'absolute',
                top: '-8px',
                left: '-8px',
                pointerEvents: 'none'
              }}
            >
              <motion.div
                animate={{
                  rotate: [0, 360],
                  scale: [1, 1.2, 1]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear"
                }}
              >
                <SparklesIcon style={{
                  width: '16px',
                  height: '16px',
                  color: '#fbbf24',
                  filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.6))'
                }} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Pulse effect for active notifications */}
        <AnimatePresence>
          {unreadCount > 0 && !showNotifications && (
            <>
              <motion.div
                animate={{
                  scale: [1, 1.8, 1],
                  opacity: [0.4, 0, 0.4]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '16px',
                  pointerEvents: 'none'
                }}
              />
              <motion.div
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.6, 0, 0.6]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '16px',
                  pointerEvents: 'none'
                }}
              />
            </>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Enhanced Notification Box */}
      <SimpleNotificationBox
        isOpen={showNotifications}
        onClose={handleNotificationBoxClose}
        anchorElement={bellRef.current}
      />
    </div>
  );
};

export default EnhancedNotificationBell;