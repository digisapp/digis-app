import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  XMarkIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { getAuthToken } from '../utils/auth-helpers';

const SmartBalanceNotifications = ({ 
  user, 
  currentBalance, 
  onQuickPurchase,
  onOpenTokenStore,
  settings = {}
}) => {
  const [notifications, setNotifications] = useState([]);
  const [userSettings, setUserSettings] = useState({
    enabled: true,
    lowThreshold: 50,
    criticalThreshold: 10,
    showQuickBuy: true,
    autoRefillEnabled: false,
    autoRefillThreshold: 25,
    autoRefillAmount: 500,
    notificationFrequency: 'smart', // 'always', 'smart', 'daily'
    lastNotificationTime: null,
    dismissedNotifications: [],
    ...settings
  });
  const [showSettings, setShowSettings] = useState(false);

  // Load user settings from backend
  useEffect(() => {
    loadUserSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Monitor balance changes
  useEffect(() => {
    if (currentBalance !== null) {
      checkBalanceThresholds(currentBalance);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBalance, userSettings]);

  const loadUserSettings = async () => {
    if (!user) return;
    
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/notification-settings`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUserSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };

  const saveUserSettings = async (newSettings) => {
    if (!user) return;
    
    try {
      const authToken = await getAuthToken();
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/notification-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ settings: newSettings })
      });

      setUserSettings(newSettings);
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const dismissNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    
    // Remember dismissal
    setUserSettings(prev => ({
      ...prev,
      dismissedNotifications: [
        ...prev.dismissedNotifications.filter(d => d.id !== notificationId),
        { id: notificationId, timestamp: Date.now() }
      ].slice(-10) // Keep only last 10 dismissals
    }));
  }, []);

  const showNotification = useCallback((notification) => {
    // Check if this notification was recently dismissed
    const isDismissed = userSettings.dismissedNotifications.some(
      dismissed => dismissed.id === notification.id && 
      (Date.now() - dismissed.timestamp) < 60 * 60 * 1000 // 1 hour
    );

    if (isDismissed) return;

    setNotifications(prev => {
      // Remove existing notification of same type
      const filtered = prev.filter(n => n.id !== notification.id);
      return [...filtered, { ...notification, timestamp: Date.now() }];
    });

    // Auto-hide if specified
    if (notification.autoHide) {
      setTimeout(() => {
        dismissNotification(notification.id);
      }, notification.autoHide);
    }

    // Show browser notification if permission granted
    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
      try {
        new window.Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico'
        });
      } catch (error) {
        console.warn('Failed to show browser notification:', error);
      }
    }
  }, [userSettings.dismissedNotifications, dismissNotification]);

  const checkBalanceThresholds = useCallback((balance) => {
    if (!userSettings.enabled) return;

    const now = Date.now();
    const lastNotification = userSettings.lastNotificationTime;
    
    // Determine if we should show notification based on frequency setting
    const shouldShowNotification = () => {
      if (userSettings.notificationFrequency === 'always') return true;
      if (userSettings.notificationFrequency === 'daily') {
        return !lastNotification || (now - lastNotification) > 24 * 60 * 60 * 1000;
      }
      // Smart frequency - more frequent for lower balances
      if (!lastNotification) return true;
      const timeSinceLastNotification = now - lastNotification;
      const minInterval = balance <= userSettings.criticalThreshold ? 30 * 60 * 1000 : // 30 min for critical
                         balance <= userSettings.lowThreshold ? 2 * 60 * 60 * 1000 : // 2 hours for low
                         24 * 60 * 60 * 1000; // 24 hours for normal
      return timeSinceLastNotification > minInterval;
    };

    // Critical balance notification
    if (balance <= userSettings.criticalThreshold && shouldShowNotification()) {
      showNotification({
        id: 'critical-balance',
        type: 'critical',
        title: '⚠️ Critical Token Balance',
        message: `Only ${balance} tokens remaining! Purchase more to continue using features.`,
        actions: [
          { label: 'Buy Tokens', action: 'token-store', variant: 'primary' }
        ],
        persistent: true,
        priority: 'high'
      });
    }
    // Low balance notification
    else if (balance <= userSettings.lowThreshold && shouldShowNotification()) {
      showNotification({
        id: 'low-balance',
        type: 'warning',
        title: '💡 Low Token Balance',
        message: `You have ${balance} tokens left. Consider purchasing more for uninterrupted access.`,
        actions: [
          { label: 'Buy Tokens', action: 'token-store', variant: 'primary' },
          { label: 'Enable Auto-refill', action: 'enable-autorefill', variant: 'secondary' }
        ],
        autoHide: 10000,
        priority: 'medium'
      });
    }

    // Update last notification time
    if (balance <= userSettings.lowThreshold) {
      setUserSettings(prev => ({
        ...prev,
        lastNotificationTime: now
      }));
    }
  }, [userSettings, showNotification]);

  const handleNotificationAction = (action, notificationId) => {
    switch (action) {
      case 'quick-buy':
        onQuickPurchase?.();
        break;
      case 'token-store':
        onOpenTokenStore?.();
        break;
      case 'enable-autorefill':
        handleEnableAutoRefill();
        break;
      default:
        break;
    }
    
    dismissNotification(notificationId);
  };

  const handleEnableAutoRefill = () => {
    setUserSettings(prev => ({
      ...prev,
      autoRefillEnabled: true
    }));
    // toast.success('Auto-refill enabled! Your tokens will be automatically topped up.');
  };

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'default') {
      try {
        const permission = await window.Notification.requestPermission();
        if (permission === 'granted') {
          // toast.success('Notifications enabled! You\'ll be alerted about low balances.');
        }
      } catch (error) {
        console.warn('Failed to request notification permission:', error);
      }
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '🔔';
    }
  };

  const getNotificationStyle = (type) => {
    switch (type) {
      case 'critical':
        return {
          backgroundColor: '#fee2e2',
          borderColor: '#fca5a5',
          color: '#991b1b'
        };
      case 'warning':
        return {
          backgroundColor: '#fef3c7',
          borderColor: '#fcd34d',
          color: '#92400e'
        };
      case 'info':
        return {
          backgroundColor: '#dbeafe',
          borderColor: '#93c5fd',
          color: '#1e40af'
        };
      default:
        return {
          backgroundColor: '#f3f4f6',
          borderColor: '#d1d5db',
          color: '#374151'
        };
    }
  };

  return (
    <>
      {/* Notifications Container */}
      <div style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        zIndex: 1000,
        width: '350px',
        maxWidth: '90vw'
      }}>
        <AnimatePresence>
          {notifications.map(notification => (
            <motion.div
              key={notification.id}
              style={{
                ...getNotificationStyle(notification.type),
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid',
                marginBottom: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
              }}
              initial={{ opacity: 0, x: 300, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 300, scale: 0.9 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>
                    {getNotificationIcon(notification.type)}
                  </span>
                  <h4 style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '700'
                  }}>
                    {notification.title}
                  </h4>
                </div>
                
                <motion.button
                  onClick={() => dismissNotification(notification.id)}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    opacity: 0.7
                  }}
                >
                  <XMarkIcon style={{ width: '16px', height: '16px' }} />
                </motion.button>
              </div>

              <p style={{
                margin: '0 0 16px 0',
                fontSize: '14px',
                lineHeight: '1.4',
                opacity: 0.9
              }}>
                {notification.message}
              </p>

              {notification.actions && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}>
                  {notification.actions.map((action, index) => (
                    <motion.button
                      key={index}
                      onClick={() => handleNotificationAction(action.action, notification.id)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        backgroundColor: action.variant === 'primary' ? '#1f2937' : 'transparent',
                        color: action.variant === 'primary' ? 'white' : 'inherit',
                        border: action.variant === 'secondary' ? '1px solid currentColor' : 'none'
                      }}
                    >
                      {action.label}
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1001,
              padding: '20px'
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '30px',
                maxWidth: '500px',
                width: '100%',
                maxHeight: '80vh',
                overflowY: 'auto'
              }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '25px'
              }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                  🔔 Notification Settings
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <XMarkIcon style={{ width: '24px', height: '24px' }} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Enable/Disable */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="checkbox"
                    checked={userSettings.enabled}
                    onChange={(e) => saveUserSettings({
                      ...userSettings,
                      enabled: e.target.checked
                    })}
                  />
                  <span style={{ fontSize: '16px', fontWeight: '500' }}>
                    Enable balance notifications
                  </span>
                </label>

                {/* Thresholds */}
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    Low balance threshold: {userSettings.lowThreshold} tokens
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    value={userSettings.lowThreshold}
                    onChange={(e) => saveUserSettings({
                      ...userSettings,
                      lowThreshold: parseInt(e.target.value)
                    })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    Critical balance threshold: {userSettings.criticalThreshold} tokens
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={userSettings.criticalThreshold}
                    onChange={(e) => saveUserSettings({
                      ...userSettings,
                      criticalThreshold: parseInt(e.target.value)
                    })}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Notification Frequency */}
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    Notification frequency
                  </label>
                  <select
                    value={userSettings.notificationFrequency}
                    onChange={(e) => saveUserSettings({
                      ...userSettings,
                      notificationFrequency: e.target.value
                    })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db'
                    }}
                  >
                    <option value="smart">Smart (adaptive based on balance)</option>
                    <option value="always">Always show</option>
                    <option value="daily">Once per day maximum</option>
                  </select>
                </div>

                {/* Browser Notifications */}
                <div>
                  <button
                    onClick={requestNotificationPermission}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    {(typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') ? 
                      '✅ Browser notifications enabled' :
                      '🔔 Enable browser notifications'
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Trigger Button */}
      <motion.button
        onClick={() => setShowSettings(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: '#6b7280',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Notification Settings"
      >
        <Cog6ToothIcon style={{ width: '24px', height: '24px' }} />
      </motion.button>
    </>
  );
};

export default SmartBalanceNotifications;