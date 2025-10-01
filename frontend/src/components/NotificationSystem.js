import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BellIcon,
  PhoneIcon,
  VideoCameraIcon,
  UserPlusIcon,
  CurrencyDollarIcon,
  StarIcon,
  XMarkIcon,
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import {
  BellIcon as BellIconSolid,
  PhoneIcon as PhoneIconSolid,
  VideoCameraIcon as VideoCameraIconSolid
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const NotificationSystem = ({ user, isVisible = true }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [settings, setSettings] = useState({
    callRequests: true,
    queueUpdates: true,
    tokenUpdates: true,
    earnings: true,
    fanInteractions: true,
    systemUpdates: true,
    soundEnabled: true,
    desktopNotifications: true
  });
  const [ws, setWs] = useState(null);
  const audioRef = useRef(null);
  const notificationPermission = useRef('default');

  // Initialize notification system
  useEffect(() => {
    if (!user || !isVisible) return;

    // Request notification permissions
    requestNotificationPermissions();

    // Initialize WebSocket connection
    initializeWebSocket();

    // Fetch existing notifications
    fetchNotifications();

    // Load notification settings
    loadNotificationSettings();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [user, isVisible]);

  // Request browser notification permissions
  const requestNotificationPermissions = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await window.Notification.requestPermission();
        notificationPermission.current = permission;
      } catch (error) {
        console.warn('Failed to request notification permission:', error);
      }
    }
  };

  // Initialize WebSocket for real-time notifications
  const initializeWebSocket = () => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('🔔 Notifications WebSocket connected');
      setWs(websocket);
      
      // Subscribe to notifications
      websocket.send(JSON.stringify({
        type: 'subscribe_notifications',
        userId: user.id
      }));
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'notification') {
          handleNewNotification(message.data);
        }
      } catch (error) {
        console.error('Error parsing notification WebSocket message:', error);
      }
    };

    websocket.onclose = () => {
      console.log('🔌 Notifications WebSocket disconnected');
      setWs(null);
      
      // Attempt to reconnect after 3 seconds
      setTimeout(initializeWebSocket, 3000);
    };
  };

  // Handle new incoming notification
  const handleNewNotification = (notification) => {
    // Add to notifications list
    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep only latest 50
    
    // Update unread count
    setUnreadCount(prev => prev + 1);

    // Show browser notification if enabled
    if (settings.desktopNotifications && notificationPermission.current === 'granted') {
      showDesktopNotification(notification);
    }

    // Play sound if enabled
    if (settings.soundEnabled) {
      playNotificationSound(notification.type);
    }

    // Show toast notification
    showToastNotification(notification);
  };

  // Show desktop notification
  const showDesktopNotification = (notification) => {
    const { title, body, type } = notification;
    
    const options = {
      body,
      icon: getNotificationIcon(type),
      badge: '/favicon.ico',
      tag: `digis-${notification.id}`,
      requireInteraction: type === 'call_request' || type === 'call_incoming'
    };

    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        new window.Notification(title, options);
      } catch (error) {
        console.warn('Failed to show desktop notification:', error);
      }
    }
  };

  // Play notification sound
  const playNotificationSound = (type) => {
    if (!audioRef.current) return;

    const soundMap = {
      call_request: '/sounds/call-request.mp3',
      call_incoming: '/sounds/incoming-call.mp3',
      queue_update: '/sounds/notification.mp3',
      token_earned: '/sounds/coin.mp3',
      default: '/sounds/notification.mp3'
    };

    audioRef.current.src = soundMap[type] || soundMap.default;
    audioRef.current.play().catch(console.error);
  };

  // Show toast notification
  const showToastNotification = (notification) => {
    const { type, title, body, actionUrl } = notification;
    
    const toastOptions = {
      duration: type === 'call_request' ? 10000 : 4000,
      position: 'top-right'
    };

    switch (type) {
      case 'call_request':
      case 'call_incoming':
        // toast.success(
          <NotificationToast 
            notification={notification} 
            onAction={() => handleNotificationAction(notification)} 
          />,
          { ...toastOptions, duration: 15000 }
        );
        break;
      
      case 'token_earned':
        // toast.success(`💰 ${title}\n${body}`, toastOptions);
        break;
      
      case 'queue_update':
        toast.info(`🕒 ${title}\n${body}`, toastOptions);
        break;
      
      default:
        toast(body, toastOptions);
    }
  };

  // Fetch notifications from backend
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/notifications`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Load notification settings
  const loadNotificationSettings = () => {
    const saved = localStorage.getItem(`notification-settings-${user.id}`);
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  };

  // Save notification settings
  const saveNotificationSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem(`notification-settings-${user.id}`, JSON.stringify(newSettings));
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Handle notification action
  const handleNotificationAction = (notification) => {
    const { type, actionUrl, actionData } = notification;
    
    switch (type) {
      case 'call_request':
        // Navigate to call interface or show acceptance dialog
        window.location.href = actionUrl || '/calls';
        break;
      
      case 'call_incoming':
        // Auto-join call
        window.location.href = actionUrl || '/calls';
        break;
      
      default:
        if (actionUrl) {
          window.location.href = actionUrl;
        }
    }
    
    markAsRead(notification.id);
  };

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    const iconMap = {
      call_request: PhoneIconSolid,
      call_incoming: PhoneIconSolid,
      video_call_request: VideoCameraIconSolid,
      queue_update: ClockIcon,
      token_earned: CurrencyDollarIcon,
      fan_interaction: UserPlusIcon,
      system_update: InformationCircleIcon,
      default: BellIconSolid
    };
    
    return iconMap[type] || iconMap.default;
  };

  // Get notification color based on type
  const getNotificationColor = (type) => {
    const colorMap = {
      call_request: 'blue',
      call_incoming: 'green',
      video_call_request: 'purple',
      queue_update: 'yellow',
      token_earned: 'green',
      fan_interaction: 'pink',
      system_update: 'gray',
      warning: 'red',
      default: 'blue'
    };
    
    return colorMap[type] || colorMap.default;
  };

  // Format notification time
  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    return time.toLocaleDateString();
  };

  const NotificationToast = ({ notification, onAction }) => (
    <div className="flex items-start gap-3">
      <div className={`p-2 bg-${getNotificationColor(notification.type)}-100 rounded-full`}>
        {React.createElement(getNotificationIcon(notification.type), {
          className: `w-5 h-5 text-${getNotificationColor(notification.type)}-600`
        })}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{notification.title}</p>
        <p className="text-xs text-gray-600 mt-1">{notification.body}</p>
        {notification.actionText && (
          <button
            onClick={onAction}
            className={`mt-2 px-3 py-1 bg-${getNotificationColor(notification.type)}-600 text-white text-xs rounded-full hover:bg-${getNotificationColor(notification.type)}-700 transition-colors`}
          >
            {notification.actionText}
          </button>
        )}
      </div>
    </div>
  );

  const NotificationItem = ({ notification }) => {
    const Icon = getNotificationIcon(notification.type);
    const color = getNotificationColor(notification.type);
    
    return (
      <motion.div
        className={`p-4 border-l-4 ${
          notification.read ? 'bg-white border-gray-200' : `bg-${color}-50 border-${color}-400`
        } hover:bg-gray-50 cursor-pointer`}
        whileHover={{ x: 4 }}
        onClick={() => {
          handleNotificationAction(notification);
          if (!notification.read) markAsRead(notification.id);
        }}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 bg-${color}-100 rounded-full flex-shrink-0`}>
            <Icon className={`w-5 h-5 text-${color}-600`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className={`text-sm font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                {notification.title}
              </h4>
              <span className="text-xs text-gray-500">{formatTime(notification.createdAt)}</span>
            </div>
            
            <p className={`text-sm ${notification.read ? 'text-gray-600' : 'text-gray-700'}`}>
              {notification.body}
            </p>
            
            {notification.actionText && (
              <div className="mt-2">
                <span className={`text-xs font-medium text-${color}-600`}>
                  {notification.actionText}
                </span>
              </div>
            )}
          </div>
          
          {!notification.read && (
            <div className={`w-2 h-2 bg-${color}-600 rounded-full flex-shrink-0 mt-2`} />
          )}
        </div>
      </motion.div>
    );
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Notification Bell */}
      <div className="relative">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors relative"
        >
          <BellIcon className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification Dropdown */}
        <AnimatePresence>
          {showNotifications && (
            <motion.div
              className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="p-1 hover:bg-gray-100 rounded-full"
                    >
                      <XMarkIcon className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {notifications.map(notification => (
                      <NotificationItem key={notification.id} notification={notification} />
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <BellIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No notifications yet</p>
                    <p className="text-sm text-gray-500">You'll see updates here</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="p-3 border-t border-gray-200 text-center">
                  <button 
                    onClick={() => {/* Navigate to full notifications page */}}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View all notifications
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden audio element for notification sounds */}
      <audio ref={audioRef} preload="none" />

      {/* Click outside to close */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowNotifications(false)}
        />
      )}
    </>
  );
};

// Settings component for notification preferences
export const NotificationSettings = ({ user, isOpen, onClose }) => {
  const [settings, setSettings] = useState({
    callRequests: true,
    queueUpdates: true,
    tokenUpdates: true,
    earnings: true,
    fanInteractions: true,
    systemUpdates: true,
    soundEnabled: true,
    desktopNotifications: true
  });

  useEffect(() => {
    if (isOpen && user) {
      loadSettings();
    }
  }, [isOpen, user]);

  const loadSettings = () => {
    const saved = localStorage.getItem(`notification-settings-${user.id}`);
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  };

  const saveSettings = () => {
    localStorage.setItem(`notification-settings-${user.id}`, JSON.stringify(settings));
    onClose();
    // toast.success('Notification settings saved');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Notification Settings</h3>
            
            <div className="space-y-4">
              {Object.entries({
                callRequests: 'Call requests',
                queueUpdates: 'Queue updates',
                tokenUpdates: 'Token transactions',
                earnings: 'Earnings notifications',
                fanInteractions: 'Fan interactions',
                systemUpdates: 'System updates',
                soundEnabled: 'Sound notifications',
                desktopNotifications: 'Desktop notifications'
              }).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">{label}</label>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings[key] ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings[key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

NotificationSettings.displayName = 'NotificationSettings';

NotificationSettings.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired
  }).isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};

// Hook for sending notifications with retry logic
export const useNotifications = (user) => {
  const sendNotification = useCallback(async (targetUserId, notification) => {
    try {
      const token = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/send-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            targetUserId,
            ...notification
          })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to send notification');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }, [user]);

  return { sendNotification };
};

export default NotificationSystem;