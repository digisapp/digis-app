// src/components/CreatorNotificationWidget.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BellIcon,
  ChatBubbleLeftRightIcon,
  CurrencyDollarIcon,
  VideoCameraIcon,
  UserPlusIcon,
  SparklesIcon,
  ClockIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { BellIcon as BellIconSolid } from '@heroicons/react/24/solid';
import Card from './ui/Card';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../utils/supabase-auth';

// Notification type configurations
const notificationConfigs = {
  message: {
    icon: ChatBubbleLeftRightIcon,
    gradient: 'from-blue-500 to-cyan-500',
    color: '#3b82f6'
  },
  session_request: {
    icon: VideoCameraIcon,
    gradient: 'from-purple-500 to-pink-500',
    color: '#8b5cf6'
  },
  tip_received: {
    icon: CurrencyDollarIcon,
    gradient: 'from-green-500 to-emerald-500',
    color: '#10b981'
  },
  new_follower: {
    icon: UserPlusIcon,
    gradient: 'from-indigo-500 to-purple-500',
    color: '#6366f1'
  },
  new_subscriber: {
    icon: SparklesIcon,
    gradient: 'from-yellow-500 to-orange-500',
    color: '#f59e0b'
  }
};

const CreatorNotificationWidget = ({ onShowAllNotifications }) => {
  const { state } = useApp();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch recent notifications
  const fetchNotifications = async () => {
    if (!state.user) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      
      if (!authToken) {
        console.error('No auth token available');
        return;
      }
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/notifications?limit=5`,
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
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (state.user) {
      fetchNotifications();
      // Refresh every minute
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [state.user]);

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInSeconds = Math.floor((now - then) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  return (
    <Card className="h-full overflow-hidden bg-gradient-to-br from-white via-purple-50/30 to-pink-50/30 border-purple-100">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg shadow-purple-500/20">
              <BellIconSolid className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-sm text-purple-600 font-medium mt-0.5">
                  {unreadCount} new notification{unreadCount > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onShowAllNotifications}
            className="text-purple-600 hover:text-purple-700 transition-colors"
          >
            <ArrowRightIcon className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <BellIcon className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">No notifications yet</p>
            <p className="text-gray-400 text-xs mt-1">Check back later for updates</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {notifications.slice(0, 5).map((notification, index) => {
                const config = notificationConfigs[notification.type] || {
                  icon: BellIcon,
                  gradient: 'from-gray-500 to-gray-600',
                  color: '#6b7280'
                };
                const Icon = config.icon;
                const isUnread = !notification.read;

                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ x: 4 }}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer ${
                      isUnread ? 'bg-purple-50/50 hover:bg-purple-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`
                      w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient}
                      flex items-center justify-center flex-shrink-0
                      shadow-md ${isUnread ? 'shadow-lg' : ''}
                    `}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'} line-clamp-2`}>
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <ClockIcon className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Unread indicator */}
                    {isUnread && (
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                        style={{ 
                          background: config.gradient ? `linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%)` : config.color,
                          boxShadow: `0 0 8px ${config.color}40`
                        }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* View All button */}
            {notifications.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onShowAllNotifications}
                className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                View All Notifications
                <ArrowRightIcon className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default CreatorNotificationWidget;