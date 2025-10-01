import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AtSymbolIcon, XMarkIcon } from '@heroicons/react/24/solid';
import PropTypes from 'prop-types';
import socketService from '../utils/socket';

const MentionNotification = ({ user, onNotificationClick }) => {
  const [notifications, setNotifications] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    // Listen for mention notifications
    const handleMentionNotification = (data) => {
      const notification = {
        id: Date.now(),
        ...data,
        read: false
      };
      
      setNotifications(prev => [notification, ...prev].slice(0, 5)); // Keep last 5
      setIsVisible(true);
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        markAsRead(notification.id);
      }, 5000);
      
      // Play notification sound if available
      try {
        const audio = new Audio('/sounds/mention.mp3');
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Could not play notification sound'));
      } catch (e) {
        // Sound not available
      }
    };

    socketService.on('mention-notification', handleMentionNotification);

    return () => {
      socketService.off('mention-notification', handleMentionNotification);
    };
  }, [user]);

  const markAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    
    // Remove read notifications after a delay
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }, 1000);
  };

  const handleClick = (notification) => {
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    markAsRead(notification.id);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Floating notification badge */}
      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed top-20 right-4 z-50"
          >
            <div className="relative">
              <button
                onClick={() => setIsVisible(!isVisible)}
                className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                <AtSymbolIcon className="w-6 h-6 text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification popup */}
      <AnimatePresence>
        {isVisible && notifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed top-32 right-4 z-50 w-80 max-w-sm"
          >
            <div className="bg-gray-900 rounded-xl shadow-2xl border border-purple-500/30 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-purple-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AtSymbolIcon className="w-5 h-5 text-purple-400" />
                    <h3 className="text-white font-semibold">Mentions</h3>
                  </div>
                  <button
                    onClick={() => setIsVisible(false)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <XMarkIcon className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Notifications list */}
              <div className="max-h-60 overflow-y-auto">
                {notifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onClick={() => handleClick(notification)}
                    className={`px-4 py-3 border-b border-gray-800 cursor-pointer transition-colors ${
                      notification.read 
                        ? 'bg-gray-900/50 opacity-60' 
                        : 'bg-purple-900/20 hover:bg-purple-900/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-purple-500/20 rounded-full flex-shrink-0">
                        <AtSymbolIcon className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">
                          {notification.mentionedBy}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              {notifications.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500">
                  <AtSymbolIcon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                  <p className="text-sm">No mentions yet</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

MentionNotification.propTypes = {
  user: PropTypes.shape({
    uid: PropTypes.string
  }),
  onNotificationClick: PropTypes.func
};

export default MentionNotification;