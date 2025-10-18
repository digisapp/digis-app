// src/components/EnhancedNotificationBox.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BellIcon,
  ChatBubbleLeftRightIcon,
  CurrencyDollarIcon,
  VideoCameraIcon,
  SparklesIcon,
  UserPlusIcon,
  HeartIcon,
  GiftIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  ClockIcon,
  CheckCircleIcon,
  BellSlashIcon
} from '@heroicons/react/24/outline';
import { BellIcon as BellIconSolid } from '@heroicons/react/24/solid';
import { useApp } from '../hooks/useApp';
import { supabase } from '../utils/supabase-auth';
import { getAuthToken } from '../utils/auth-helpers';

// Enhanced Design System
const designTokens = {
  colors: {
    primary: {
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      solid: '#667eea',
      light: '#818cf8',
      dark: '#4c1d95'
    },
    accent: {
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      solid: '#ec4899',
      light: '#f472b6',
      dark: '#be185d'
    },
    success: {
      gradient: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
      solid: '#22c55e',
      light: '#4ade80',
      dark: '#16a34a'
    },
    warning: {
      gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
      solid: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706'
    },
    info: {
      gradient: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
      solid: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb'
    },
    glass: {
      light: 'rgba(255, 255, 255, 0.98)',
      medium: 'rgba(255, 255, 255, 0.85)',
      dark: 'rgba(248, 250, 252, 0.95)'
    }
  },
  shadows: {
    soft: '0 4px 24px rgba(0, 0, 0, 0.06)',
    medium: '0 8px 32px rgba(0, 0, 0, 0.08)',
    strong: '0 16px 48px rgba(0, 0, 0, 0.12)',
    glow: '0 0 40px rgba(99, 102, 241, 0.15)'
  },
  animations: {
    spring: { type: "spring", damping: 25, stiffness: 400 },
    smooth: { type: "spring", damping: 30, stiffness: 300 },
    bouncy: { type: "spring", damping: 15, stiffness: 500 }
  }
};

// Notification Categories
const notificationCategories = {
  all: { label: 'All', icon: null },
  messages: { label: 'Messages', icon: ChatBubbleLeftRightIcon },
  sessions: { label: 'Sessions', icon: VideoCameraIcon },
  earnings: { label: 'Earnings', icon: CurrencyDollarIcon },
  social: { label: 'Social', icon: UserPlusIcon }
};

// Get notification configuration based on type
const getNotificationConfig = (type) => {
  const configs = {
    message: {
      icon: ChatBubbleLeftRightIcon,
      color: designTokens.colors.info,
      category: 'messages'
    },
    session_request: {
      icon: VideoCameraIcon,
      color: designTokens.colors.primary,
      category: 'sessions'
    },
    session_started: {
      icon: VideoCameraIcon,
      color: designTokens.colors.success,
      category: 'sessions'
    },
    tip_received: {
      icon: CurrencyDollarIcon,
      color: designTokens.colors.accent,
      category: 'earnings'
    },
    gift_received: {
      icon: GiftIcon,
      color: designTokens.colors.accent,
      category: 'earnings'
    },
    new_follower: {
      icon: UserPlusIcon,
      color: designTokens.colors.primary,
      category: 'social'
    },
    new_subscriber: {
      icon: SparklesIcon,
      color: designTokens.colors.success,
      category: 'social'
    }
  };
  
  return configs[type] || {
    icon: BellIcon,
    color: designTokens.colors.info,
    category: 'all'
  };
};

const EnhancedNotificationBox = ({ isOpen, onClose, anchorElement }) => {
  const { state } = useApp();
  const userId = state?.user?.id;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showSettings, setShowSettings] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const boxRef = useRef(null);
  const hasLoadedRef = useRef(false);

  // Calculate position based on anchor element
  useEffect(() => {
    if (anchorElement && isOpen) {
      const rect = anchorElement.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;
      const boxWidth = isMobile ? window.innerWidth - 32 : 420;
      const viewportWidth = window.innerWidth;
      
      // Position calculation
      let right = isMobile ? 16 : viewportWidth - rect.right;
      let top = rect.bottom + 12;
      
      // Adjust if would go off screen
      if (!isMobile && right + boxWidth > viewportWidth) {
        right = viewportWidth - boxWidth - 20;
      }
      
      setPosition({ top, right });
    }
  }, [anchorElement, isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (boxRef.current && 
          !boxRef.current.contains(event.target) &&
          !anchorElement?.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, anchorElement]);

  // Fetch notifications - stabilized with useCallback
  const fetchNotifications = useCallback(async () => {
    if (!userId || hasLoadedRef.current) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      
      if (!authToken) {
        console.error('No auth token available');
        return;
      }
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/notifications?limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [userId]);

  // Load notifications only when box opens and hasn't loaded yet
  useEffect(() => {
    if (isOpen && userId && !hasLoadedRef.current) {
      fetchNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId]);

  // Reset loaded flag when box closes
  useEffect(() => {
    if (!isOpen) {
      hasLoadedRef.current = false;
    }
  }, [isOpen]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    if (!userId) return;
    
    try {
      const authToken = await getAuthToken();
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/notifications/${notificationId}/read`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [userId]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    
    try {
      const authToken = await getAuthToken();
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/notifications/read-all`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [userId]);

  // Filter notifications by category
  const filteredNotifications = notifications.filter(notification => {
    if (activeCategory === 'all') return true;
    const config = getNotificationConfig(notification.type);
    return config.category === activeCategory;
  });

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInSeconds = Math.floor((now - then) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={boxRef}
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={designTokens.animations.spring}
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          right: `${position.right}px`,
          width: window.innerWidth < 640 ? `calc(100vw - 32px)` : '420px',
          maxHeight: window.innerWidth < 640 ? '70vh' : '80vh',
          background: designTokens.colors.glass.light,
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: window.innerWidth < 640 ? '20px' : '24px',
          overflow: 'hidden',
          boxShadow: designTokens.shadows.strong,
          zIndex: 1000
        }}
      >
        {/* Header */}
        <div style={{
          background: 'white',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          padding: '20px 24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: designTokens.colors.primary.gradient,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
              }}>
                <BellIconSolid style={{ width: '20px', height: '20px', color: 'white' }} />
              </div>
              <div>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '20px', 
                  fontWeight: '700', 
                  color: '#1e293b',
                  letterSpacing: '-0.02em'
                }}>
                  Notifications
                </h3>
                <p style={{ 
                  margin: 0, 
                  fontSize: '14px', 
                  color: '#64748b',
                  marginTop: '2px'
                }}>
                  {notifications.filter(n => !n.read).length} unread
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSettings(!showSettings)}
                style={{
                  background: showSettings ? '#f1f5f9' : 'transparent',
                  border: 'none',
                  borderRadius: '10px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                  transition: 'all 0.2s'
                }}
              >
                <AdjustmentsHorizontalIcon style={{ width: '18px', height: '18px' }} />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '10px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                  transition: 'all 0.2s'
                }}
              >
                <XMarkIcon style={{ width: '20px', height: '20px' }} />
              </motion.button>
            </div>
          </div>

          {/* Category Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {Object.entries(notificationCategories).map(([key, category]) => {
              const isActive = activeCategory === key;
              const Icon = category.icon;
              
              return (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveCategory(key)}
                  style={{
                    background: isActive ? designTokens.colors.primary.gradient : '#f8fafc',
                    color: isActive ? 'white' : '#64748b',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    boxShadow: isActive ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none'
                  }}
                >
                  {Icon && <Icon style={{ width: '16px', height: '16px' }} />}
                  {category.label}
                  {key === 'all' && notifications.length > 0 && (
                    <span style={{
                      background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.06)',
                      padding: '2px 8px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {notifications.length}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={designTokens.animations.smooth}
              style={{
                background: '#f8fafc',
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: '16px 24px' }}>
                <button
                  onClick={markAllAsRead}
                  style={{
                    width: '100%',
                    background: 'white',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#475569',
                    transition: 'all 0.2s'
                  }}
                >
                  <CheckCircleIcon style={{ width: '18px', height: '18px' }} />
                  Mark all as read
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div style={{
          maxHeight: '500px',
          overflowY: 'auto',
          background: designTokens.colors.glass.dark
        }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid #e2e8f0',
                  borderTop: '3px solid #6366f1',
                  borderRadius: '50%',
                  margin: '0 auto 16px'
                }}
              />
              <p style={{ color: '#64748b', fontSize: '14px' }}>Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: '#f8fafc',
                borderRadius: '50%',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <BellSlashIcon style={{ width: '32px', height: '32px', color: '#cbd5e1' }} />
              </div>
              <h4 style={{ 
                color: '#1e293b', 
                marginBottom: '8px',
                fontSize: '16px',
                fontWeight: '600'
              }}>
                No notifications
              </h4>
              <p style={{ 
                color: '#64748b', 
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                {activeCategory === 'all' 
                  ? "You're all caught up! Check back later."
                  : `No ${activeCategory} notifications yet.`}
              </p>
            </div>
          ) : (
            <div style={{ padding: '8px' }}>
              {filteredNotifications.map((notification, index) => {
                const config = getNotificationConfig(notification.type);
                const Icon = config.icon;
                const isUnread = !notification.read;
                
                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => markAsRead(notification.id)}
                    whileHover={{ scale: 1.01 }}
                    style={{
                      background: isUnread ? 'white' : 'transparent',
                      borderRadius: '16px',
                      padding: '16px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      position: 'relative',
                      boxShadow: isUnread ? designTokens.shadows.soft : 'none',
                      border: `1px solid ${isUnread ? 'rgba(99, 102, 241, 0.1)' : 'transparent'}`,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {/* Icon */}
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '14px',
                        background: config.color.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 4px 12px ${config.color.solid}20`
                      }}>
                        <Icon style={{ 
                          width: '22px', 
                          height: '22px', 
                          color: 'white'
                        }} />
                      </div>
                      
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: '0 0 4px 0',
                          fontSize: '14px',
                          color: '#1e293b',
                          fontWeight: isUnread ? '600' : '400',
                          lineHeight: '1.5'
                        }}>
                          {notification.message}
                        </p>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '4px'
                        }}>
                          <ClockIcon style={{ 
                            width: '14px', 
                            height: '14px', 
                            color: '#94a3b8' 
                          }} />
                          <p style={{
                            margin: 0,
                            fontSize: '12px',
                            color: '#94a3b8'
                          }}>
                            {formatTimeAgo(notification.created_at)}
                          </p>
                        </div>
                      </div>

                      {/* Unread dot */}
                      {isUnread && (
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: config.color.gradient,
                          flexShrink: 0,
                          alignSelf: 'center',
                          boxShadow: `0 0 8px ${config.color.solid}40`
                        }} />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {filteredNotifications.length > 0 && (
          <div style={{
            padding: '16px 24px',
            background: 'white',
            borderTop: '1px solid rgba(0, 0, 0, 0.06)',
            textAlign: 'center'
          }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                background: designTokens.colors.primary.gradient,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                width: '100%'
              }}
            >
              View All Notifications
            </motion.button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default EnhancedNotificationBox;