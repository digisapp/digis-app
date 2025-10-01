// src/components/SimpleCreatorNotificationWidget.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BellIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  CurrencyDollarIcon,
  UserPlusIcon,
  SparklesIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../utils/supabase-auth';

const SimpleCreatorNotificationWidget = ({ onShowAllNotifications }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Mock notifications for now to avoid API issues
  useEffect(() => {
    // Set some mock notifications to show the UI
    setNotifications([
      {
        id: 1,
        type: 'new_follower',
        message: 'Sarah Johnson started following you',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        read: false
      },
      {
        id: 2,
        type: 'tip_received',
        message: 'You received a $10 tip from John Doe',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        read: false
      },
      {
        id: 3,
        type: 'session_request',
        message: 'New video call request from Emma Wilson',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        read: true
      }
    ]);
  }, []);

  const getNotificationIcon = (type) => {
    const icons = {
      new_follower: UserPlusIcon,
      tip_received: CurrencyDollarIcon,
      session_request: VideoCameraIcon,
      message: ChatBubbleLeftRightIcon,
      new_subscriber: SparklesIcon,
      like: HeartIcon
    };
    return icons[type] || BellIcon;
  };

  const getNotificationColor = (type) => {
    const colors = {
      new_follower: '#6366f1',
      tip_received: '#10b981',
      session_request: '#f59e0b',
      message: '#3b82f6',
      new_subscriber: '#ec4899',
      like: '#ef4444'
    };
    return colors[type] || '#6b7280';
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = Math.floor((now - then) / 1000 / 60); // minutes
    
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <BellIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {unreadCount} unread
            </p>
          </div>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-purple-600 hover:text-purple-700 font-medium"
        >
          {isExpanded ? 'Show less' : 'View all'}
        </motion.button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8">
            <BellIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No new notifications</p>
          </div>
        ) : (
          notifications
            .slice(0, isExpanded ? notifications.length : 3)
            .map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              const color = getNotificationColor(notification.type);
              
              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ x: 5 }}
                  className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                    !notification.read 
                      ? 'bg-purple-50 dark:bg-purple-900/20' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${
                      !notification.read 
                        ? 'font-medium text-gray-900 dark:text-white' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatTime(notification.timestamp)}
                    </p>
                  </div>
                  
                  {!notification.read && (
                    <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0 mt-2" />
                  )}
                </motion.div>
              );
            })
        )}
      </div>

      {/* Footer Actions */}
      {notifications.length > 3 && !isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button 
            onClick={onShowAllNotifications}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            View all {notifications.length} notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default SimpleCreatorNotificationWidget;