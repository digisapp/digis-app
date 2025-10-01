import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BellIcon,
  XMarkIcon,
  PhoneIcon,
  VideoCameraIcon,
  ChatBubbleLeftIcon,
  CurrencyDollarIcon,
  GiftIcon,
  HeartIcon,
  UserPlusIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import {
  useNotifications,
  useUnreadNotifications,
  useIncomingCall,
  useStreamAlerts,
  useNotificationActions,
  useUser
} from '../stores/useHybridStore';
import toast from 'react-hot-toast';

/**
 * Real-time notifications component using hybrid state management
 * Zustand for notification data (global), useState for UI state (local)
 */
const RealTimeNotificationsHybrid = () => {
  // Global state from Zustand
  const notifications = useNotifications();
  const unreadCount = useUnreadNotifications();
  const incomingCall = useIncomingCall();
  const streamAlerts = useStreamAlerts();
  const user = useUser();
  const {
    addNotification,
    removeNotification,
    markNotificationRead,
    markAllNotificationsRead,
    clearIncomingCall,
    removeStreamAlert
  } = useNotificationActions();

  // Local UI state with useState
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread, calls, tips
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (soundEnabled) {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Could not play sound:', e));
    }
  }, [soundEnabled]);

  // Handle incoming call
  const handleCallAction = useCallback((action) => {
    if (!incomingCall) return;

    if (action === 'accept') {
      // Navigate to video call
      window.location.href = `/call/${incomingCall.channelId}`;
      toast.success('Joining call...');
    } else {
      toast.info('Call declined');
    }
    
    clearIncomingCall();
  }, [incomingCall, clearIncomingCall]);

  // Auto-dismiss old stream alerts
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      streamAlerts.forEach(alert => {
        if (now - alert.timestamp > 30000) { // 30 seconds
          removeStreamAlert(alert.id);
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [streamAlerts, removeStreamAlert]);

  // Play sound for new notifications
  useEffect(() => {
    if (notifications.length > 0) {
      const latestNotification = notifications[0];
      if (Date.now() - latestNotification.timestamp < 1000) {
        playNotificationSound();
      }
    }
  }, [notifications, playNotificationSound]);

  // Filter notifications based on selected filter
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'calls') return n.type === 'call' || n.type === 'video';
    if (filter === 'tips') return n.type === 'tip' || n.type === 'gift';
    return true;
  });

  // Get icon for notification type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'call':
        return <PhoneIcon className="w-5 h-5" />;
      case 'video':
        return <VideoCameraIcon className="w-5 h-5" />;
      case 'message':
        return <ChatBubbleLeftIcon className="w-5 h-5" />;
      case 'tip':
        return <CurrencyDollarIcon className="w-5 h-5" />;
      case 'gift':
        return <GiftIcon className="w-5 h-5" />;
      case 'like':
        return <HeartIcon className="w-5 h-5" />;
      case 'follow':
        return <UserPlusIcon className="w-5 h-5" />;
      default:
        return <BellIcon className="w-5 h-5" />;
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <>
      {/* Incoming Call Modal - Highest Priority */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          >
            <motion.div
              initial={{ y: -50 }}
              animate={{ y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full mx-4"
            >
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center animate-pulse">
                  {incomingCall.type === 'video' ? (
                    <VideoCameraIcon className="w-10 h-10 text-green-600 dark:text-green-400" />
                  ) : (
                    <PhoneIcon className="w-10 h-10 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  Incoming {incomingCall.type === 'video' ? 'Video' : 'Voice'} Call
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {incomingCall.callerName || 'Someone'} is calling you
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleCallAction('decline')}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleCallAction('accept')}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                  >
                    Accept
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stream Alerts - Fixed Position */}
      <div className="fixed top-20 right-4 z-40 space-y-2 max-w-sm">
        <AnimatePresence>
          {streamAlerts.map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="bg-purple-600 text-white p-4 rounded-lg shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{alert.creatorName} is live!</p>
                  {alert.streamTitle && (
                    <p className="text-sm opacity-90">{alert.streamTitle}</p>
                  )}
                </div>
                <button
                  onClick={() => removeStreamAlert(alert.id)}
                  className="ml-2 hover:bg-white/20 rounded p-1"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Notification Bell Icon */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
        >
          <BellIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl z-50"
            >
              {/* Header */}
              <div className="p-4 border-b dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Notifications</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title={soundEnabled ? 'Mute' : 'Unmute'}
                    >
                      {soundEnabled ? '🔔' : '🔕'}
                    </button>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsRead}
                        className="text-sm text-blue-500 hover:text-blue-600"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-1">
                  {['all', 'unread', 'calls', 'tips'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 text-sm rounded-lg capitalize transition ${
                        filter === f
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <BellIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  filteredNotifications.map(notification => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer ${
                        !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onClick={() => markNotificationRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          notification.type === 'tip' ? 'bg-yellow-100 text-yellow-600' :
                          notification.type === 'gift' ? 'bg-purple-100 text-purple-600' :
                          notification.type === 'call' ? 'bg-green-100 text-green-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {notification.title || notification.message}
                          </p>
                          {notification.title && notification.message && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {notification.message}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTime(notification.timestamp)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(notification.id);
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Footer */}
              {filteredNotifications.length > 0 && (
                <div className="p-3 text-center border-t dark:border-gray-700">
                  <button className="text-sm text-purple-500 hover:text-purple-600">
                    View all notifications
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default RealTimeNotificationsHybrid;