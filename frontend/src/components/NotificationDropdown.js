// src/components/NotificationDropdown.js
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
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
        style={{
          position: 'absolute',
          top: '60px', // Positioned below the navigation bar
          right: '20px',
          background: designTokens.colors.glassmorphism,
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '16px',
          width: '380px',
          maxHeight: '500px',
          overflow: 'hidden',
          boxShadow: designTokens.shadows.strong,
          zIndex: 1000
        }}
      >
        {/* Header */}
        <div style={{
          background: 'white',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
            Notifications
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              color: '#6b7280',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          maxHeight: '400px',
          overflowY: 'auto',
          background: 'white'
        }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
              <p style={{ marginTop: '12px', color: '#6b7280' }}>Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
              <h4 style={{ color: '#1f2937', marginBottom: '8px' }}>No notifications yet</h4>
              <p style={{ color: '#6b7280', fontSize: '14px' }}>
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
                  whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.02)' }}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                    cursor: 'pointer',
                    position: 'relative',
                    background: isUnread ? 'rgba(99, 102, 241, 0.05)' : 'transparent'
                  }}
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
                      <p style={{
                        margin: '0 0 4px 0',
                        fontSize: '14px',
                        color: '#1f2937',
                        fontWeight: isUnread ? '600' : '400'
                      }}>
                        {notification.message}
                      </p>
                      <p style={{
                        margin: 0,
                        fontSize: '12px',
                        color: '#6b7280'
                      }}>
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