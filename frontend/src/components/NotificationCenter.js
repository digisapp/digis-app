// src/components/NotificationCenter.js
import React, { useState, useEffect } from 'react';
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
    glassmorphism: 'rgba(255, 255, 255, 0.1)'
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

const NotificationCenter = ({ isOpen, onClose }) => {
  const { state } = useApp();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'unread', 'preferences'
  const [preferences, setPreferences] = useState({
    messages: true,
    session_requests: true,
    tips: true,
    follows: true,
    creator_online: true,
    system: true,
    email_notifications: false,
    push_notifications: true
  });

  // Fetch notifications
  const fetchNotifications = async (unreadOnly = false) => {
    if (!state.user) return;
    
    setLoading(true);
    try {
      const authToken = await getAuthToken();
      const params = new URLSearchParams({
        limit: 50,
        offset: 0,
        unread_only: unreadOnly.toString()
      });

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      } else {
        console.error('Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch notification preferences
  const fetchPreferences = async () => {
    if (!state.user) return;
    
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications/preferences`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    if (!state.user) return;
    
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications/${notificationId}/read`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, read_at: new Date().toISOString() }
              : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!state.user) return;
    
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications/read-all`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    if (!state.user) return;
    
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications/${notificationId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        // Update unread count if deleted notification was unread
        const deletedNotif = notifications.find(n => n.id === notificationId);
        if (deletedNotif && !deletedNotif.read_at) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Update preferences
  const updatePreferences = async (newPreferences) => {
    if (!state.user) return;
    
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications/preferences`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ preferences: newPreferences })
        }
      );

      if (response.ok) {
        setPreferences(newPreferences);
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  };

  // Load data when component opens
  useEffect(() => {
    if (isOpen && state.user) {
      fetchNotifications(activeTab === 'unread');
      fetchPreferences();
    }
  }, [isOpen, state.user, activeTab]);

  // Format time ago
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  // Filter notifications based on active tab
  const filteredNotifications = notifications.filter(notif => {
    if (activeTab === 'unread') return !notif.read_at;
    return true;
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          style={{
            background: designTokens.colors.glassmorphism,
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '24px',
            padding: '0',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'hidden',
            boxShadow: designTokens.shadows.strong
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            background: designTokens.colors.primary,
            color: 'white',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                🔔 Notifications
              </h2>
              {unreadCount > 0 && (
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                  {unreadCount} unread
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontSize: '24px',
                width: '40px',
                height: '40px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          </div>

          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '0'
          }}>
            {[
              { key: 'all', label: 'All', count: notifications.length },
              { key: 'unread', label: 'Unread', count: unreadCount },
              { key: 'preferences', label: 'Settings', count: null }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  background: activeTab === tab.key ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  border: 'none',
                  color: activeTab === tab.key ? '#1f2937' : '#6b7280',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: activeTab === tab.key ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span style={{
                    background: designTokens.colors.accent,
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    padding: '2px 8px',
                    minWidth: '20px',
                    textAlign: 'center'
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            padding: activeTab === 'preferences' ? '20px' : '0'
          }}>
            {activeTab === 'preferences' ? (
              // Preferences Tab
              <div>
                <h3 style={{ margin: '0 0 20px 0', color: '#1f2937' }}>Notification Preferences</h3>
                
                {Object.entries(preferences).map(([key, value]) => (
                  <div key={key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <span style={{ color: '#1f2937', fontWeight: '500' }}>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <label style={{
                      position: 'relative',
                      width: '50px',
                      height: '24px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => {
                          const newPreferences = { ...preferences, [key]: e.target.checked };
                          setPreferences(newPreferences);
                          updatePreferences(newPreferences);
                        }}
                        style={{ display: 'none' }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: value ? designTokens.colors.success : '#ddd',
                        borderRadius: '12px',
                        transition: 'all 0.2s ease'
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: '2px',
                          left: value ? '28px' : '2px',
                          width: '20px',
                          height: '20px',
                          background: 'white',
                          borderRadius: '10px',
                          transition: 'all 0.2s ease'
                        }} />
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              // Notifications List
              <div>
                {/* Quick Actions */}
                {filteredNotifications.length > 0 && (
                  <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        style={{
                          background: designTokens.colors.success,
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        Mark All Read
                      </button>
                    )}
                    <button
                      onClick={() => fetchNotifications(activeTab === 'unread')}
                      disabled={loading}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#1f2937',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      {loading ? '🔄' : '🔄'} Refresh
                    </button>
                  </div>
                )}

                {/* Notifications */}
                {loading ? (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#6b7280'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔄</div>
                    Loading notifications...
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#6b7280'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔔</div>
                    <h3 style={{ margin: '0 0 8px 0' }}>No notifications</h3>
                    <p style={{ margin: 0, fontSize: '14px' }}>
                      {activeTab === 'unread' ? 'All caught up!' : "You'll see notifications here when they arrive"}
                    </p>
                  </div>
                ) : (
                  <div>
                    {filteredNotifications.map((notification, index) => {
                      const style = getNotificationStyle(notification.type);
                      const isUnread = !notification.read_at;
                      
                      return (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            background: isUnread ? 'rgba(103, 126, 234, 0.05)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                          }}
                          onClick={() => isUnread && markAsRead(notification.id)}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px'
                          }}>
                            {/* Icon */}
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '20px',
                              background: style.background,
                              color: style.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px',
                              flexShrink: 0
                            }}>
                              {style.icon}
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '4px'
                              }}>
                                <h4 style={{
                                  margin: 0,
                                  fontSize: '14px',
                                  fontWeight: 'bold',
                                  color: '#1f2937'
                                }}>
                                  {notification.title}
                                </h4>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span style={{
                                    fontSize: '12px',
                                    color: '#6b7280'
                                  }}>
                                    {formatTimeAgo(notification.created_at)}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteNotification(notification.id);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#6b7280',
                                      cursor: 'pointer',
                                      padding: '4px',
                                      borderRadius: '4px',
                                      fontSize: '16px'
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                              <p style={{
                                margin: 0,
                                fontSize: '13px',
                                color: '#6b7280',
                                lineHeight: '1.4'
                              }}>
                                {notification.message}
                              </p>
                            </div>
                          </div>

                          {/* Unread indicator */}
                          {isUnread && (
                            <div style={{
                              position: 'absolute',
                              left: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: '4px',
                              height: '40px',
                              background: designTokens.colors.primary,
                              borderRadius: '2px'
                            }} />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NotificationCenter;