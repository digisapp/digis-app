// src/components/NotificationDropdown.js
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../hooks/useApp';
import { getAuthToken } from '../utils/auth-helpers';

// Enhanced Design System
const designTokens = {
  colors: {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    accent: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    success: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    warning: 'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)',
    danger: 'linear-gradient(135deg, #fd79a8 0%, #e84393 100%)',
    info: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
    glassmorphism: 'rgba(255, 255, 255, 0.95)'
  },
  shadows: {
    soft: '0 4px 20px rgba(0,0,0,0.08)',
    medium: '0 8px 30px rgba(0,0,0,0.12)',
    strong: '0 12px 40px rgba(0,0,0,0.15)'
  }
};

// Notification Type Icons and Colors
const getNotificationStyle = (type) => {
  const styles = {
    message: {
      icon: '💬',
      background: designTokens.colors.info,
      color: 'white'
    },
    session_request: {
      icon: '📞',
      background: designTokens.colors.primary,
      color: 'white'
    },
    session_started: {
      icon: '🎬',
      background: designTokens.colors.success,
      color: 'white'
    },
    session_ended: {
      icon: '🏁',
      background: designTokens.colors.warning,
      color: '#2d3436'
    },
    tip_received: {
      icon: '💰',
      background: designTokens.colors.accent,
      color: 'white'
    },
    follow: {
      icon: '👥',
      background: designTokens.colors.success,
      color: 'white'
    },
    creator_online: {
      icon: '🟢',
      background: designTokens.colors.success,
      color: 'white'
    },
    system: {
      icon: '⚙️',
      background: designTokens.colors.info,
      color: 'white'
    }
  };
  
  return styles[type] || styles.system;
};

const NotificationDropdown = ({ isOpen, onClose, anchorRef }) => {
  const { state } = useApp();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && 
          !dropdownRef.current.contains(event.target) &&
          !anchorRef?.current?.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, anchorRef]);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!state.user) return;
    
    setLoading(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications?limit=20&offset=0`,
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
    }
  };

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    if (!state.user) return;
    
    try {
      const authToken = await getAuthToken();
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications/${notificationId}/read`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInSeconds = Math.floor((now - then) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return then.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={dropdownRef}
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 400 }}
        className="absolute bg-white dark:bg-gray-800 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden"
        style={{
          top: '60px',
          right: '20px',
          width: '380px',
          maxHeight: '500px',
          zIndex: 1000
        }}
      >
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Notifications
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl p-1 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto bg-white dark:bg-gray-800">
          {loading ? (
            <div className="py-10 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
              <p className="mt-3 text-gray-500 dark:text-gray-400">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-5xl mb-3">📭</div>
              <h4 className="text-gray-900 dark:text-white mb-2">No notifications yet</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                We'll notify you when something interesting happens!
              </p>
            </div>
          ) : (
            notifications.map(notification => {
              const style = getNotificationStyle(notification.type);
              const isUnread = !notification.read;
              
              return (
                <motion.div
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={`px-5 py-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    isUnread ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-white dark:bg-gray-800'
                  }`}
                >
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {/* Icon */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      background: style.background,
                      color: style.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      flexShrink: 0
                    }}>
                      {style.icon}
                    </div>
                    
                    {/* Content */}
                    <div style={{ flex: 1 }}>
                      <p className={`text-sm text-gray-900 dark:text-white mb-1 ${
                        isUnread ? 'font-semibold' : 'font-normal'
                      }`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {isUnread && (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#3b82f6',
                        flexShrink: 0,
                        alignSelf: 'center'
                      }} />
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div style={{
            padding: '12px 20px',
            background: 'rgba(0, 0, 0, 0.02)',
            borderTop: '1px solid rgba(0, 0, 0, 0.1)',
            textAlign: 'center'
          }}>
            <button
              onClick={() => {
                setNotifications([]);
                // Mark all as read API call would go here
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#6366f1',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Mark all as read
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default NotificationDropdown;