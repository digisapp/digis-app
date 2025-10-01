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
  ArrowRightIcon,
  CheckIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  HeartIcon,
  PhoneIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { BellIcon as BellIconSolid } from '@heroicons/react/24/solid';
import Card from './ui/Card';
import { useApp } from '../hooks/useApp';
import { supabase } from '../utils/supabase-auth';
import toast from 'react-hot-toast';

// Notification type configurations
const notificationConfigs = {
  message: {
    icon: ChatBubbleLeftRightIcon,
    gradient: 'from-blue-500 to-cyan-500',
    color: '#3b82f6',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  session_request: {
    icon: VideoCameraIcon,
    gradient: 'from-purple-500 to-pink-500',
    color: '#8b5cf6',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    urgent: true
  },
  voice_request: {
    icon: PhoneIcon,
    gradient: 'from-indigo-500 to-purple-500',
    color: '#6366f1',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    urgent: true
  },
  tip_received: {
    icon: CurrencyDollarIcon,
    gradient: 'from-green-500 to-emerald-500',
    color: '#10b981',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  new_follower: {
    icon: UserPlusIcon,
    gradient: 'from-indigo-500 to-purple-500',
    color: '#6366f1',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200'
  },
  new_subscriber: {
    icon: SparklesIcon,
    gradient: 'from-yellow-500 to-orange-500',
    color: '#f59e0b',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  }
};

const CreatorNotificationWidget = ({ onShowAllNotifications }) => {
  const { state } = useApp();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [processingAction, setProcessingAction] = useState(null);

  // Mock enhanced notification data
  useEffect(() => {
    setNotifications([
      {
        id: 1,
        type: 'session_request',
        message: 'Alice wants to start a video call',
        created_at: new Date(Date.now() - 300000), // 5 min ago
        read: false,
        sessionType: 'video',
        duration: 30,
        tokens: 240,
        fanInfo: { username: 'alice123', tier: 'VIP', totalSpent: 2450 },
        expiresAt: new Date(Date.now() + 600000) // expires in 10 min
      },
      {
        id: 2,
        type: 'tip_received',
        message: 'Bob sent you a tip!',
        created_at: new Date(Date.now() - 1800000), // 30 min ago
        read: false,
        amount: 150,
        dollarValue: 7.50,
        fanInfo: { username: 'bob_music', tier: 'Gold', totalSpent: 1890 }
      },
      {
        id: 3,
        type: 'message',
        message: 'Carol: "Loved your last stream! When\'s the next one?"',
        created_at: new Date(Date.now() - 3600000), // 1 hour ago
        read: true,
        fanInfo: { username: 'carol_art', tier: 'Silver', totalSpent: 1670 }
      },
      {
        id: 4,
        type: 'voice_request',
        message: 'David wants to start a voice call',
        created_at: new Date(Date.now() - 7200000), // 2 hours ago
        read: false,
        sessionType: 'voice',
        duration: 15,
        tokens: 90,
        fanInfo: { username: 'david_photo', tier: 'Bronze', totalSpent: 1520 },
        expiresAt: new Date(Date.now() + 300000) // expires in 5 min
      },
      {
        id: 5,
        type: 'new_subscriber',
        message: 'Eva just subscribed to your VIP tier!',
        created_at: new Date(Date.now() - 14400000), // 4 hours ago
        read: true,
        fanInfo: { username: 'eva_tech', tier: 'New VIP', totalSpent: 1380 }
      }
    ]);
    setUnreadCount(3);
    setLoading(false);
  }, []);

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInSeconds = Math.floor((now - then) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  const getTimeRemaining = (expiresAt) => {
    const now = new Date();
    const diffInSeconds = Math.floor((expiresAt - now) / 1000);
    
    if (diffInSeconds <= 0) return 'Expired';
    if (diffInSeconds < 60) return `${diffInSeconds}s left`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m left`;
    return `${Math.floor(diffInSeconds / 3600)}h left`;
  };

  const getExpiryPercentage = (createdAt, expiresAt) => {
    const now = new Date();
    const total = expiresAt - createdAt;
    const elapsed = now - createdAt;
    return Math.max(0, Math.min(100, (1 - elapsed / total) * 100));
  };

  const handleAcceptSession = async (notification) => {
    setProcessingAction(notification.id);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(`${notification.sessionType === 'video' ? 'Video' : 'Voice'} call accepted!`);
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    } catch (error) {
      toast.error('Failed to accept session');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleDeclineSession = async (notification) => {
    setProcessingAction(notification.id);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Session request declined');
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    } catch (error) {
      toast.error('Failed to decline session');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleSendReply = async (notification) => {
    if (!replyMessage.trim()) return;
    
    setProcessingAction(notification.id);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Reply sent!');
      setReplyingTo(null);
      setReplyMessage('');
      setNotifications(prev => prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      ));
    } catch (error) {
      toast.error('Failed to send reply');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleThankYou = async (notification) => {
    setProcessingAction(notification.id);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Thank you message sent!');
      setNotifications(prev => prev.map(n => 
        n.id === notification.id ? { ...n, read: true, thanked: true } : n
      ));
    } catch (error) {
      toast.error('Failed to send thank you');
    } finally {
      setProcessingAction(null);
    }
  };

  const getFanTierColor = (tier) => {
    switch (tier) {
      case 'VIP':
      case 'New VIP':
        return 'text-purple-600 bg-purple-100';
      case 'Gold':
        return 'text-yellow-600 bg-yellow-100';
      case 'Silver':
        return 'text-gray-600 bg-gray-100';
      case 'Bronze':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-500 bg-gray-50';
    }
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
                const isHighValue = notification.amount > 100 || notification.tokens > 200;
                const isExpiringSoon = notification.expiresAt && 
                  (notification.expiresAt - new Date()) < 300000; // 5 minutes

                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className={`
                      p-3 rounded-xl transition-all
                      ${config.urgent && isUnread ? 'border-2 ' + config.borderColor : ''}
                      ${isUnread ? config.bgColor : 'hover:bg-gray-50'}
                      ${isHighValue && isUnread ? 'animate-pulse' : ''}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`
                        w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient}
                        flex items-center justify-center flex-shrink-0
                        shadow-md ${isUnread ? 'shadow-lg' : ''}
                        ${isHighValue ? 'animate-bounce' : ''}
                      `}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'} line-clamp-2`}>
                          {notification.message}
                        </p>
                        
                        {/* Additional Info */}
                        <div className="flex items-center gap-3 mt-1.5">
                          {notification.fanInfo && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getFanTierColor(notification.fanInfo.tier)}`}>
                              {notification.fanInfo.tier}
                            </span>
                          )}
                          
                          {notification.amount && (
                            <span className="text-xs font-bold text-green-600">
                              {notification.amount} tokens (${notification.dollarValue?.toFixed(2)})
                            </span>
                          )}
                          
                          {notification.tokens && (
                            <span className="text-xs font-bold text-purple-600">
                              {notification.tokens} tokens • {notification.duration}min
                            </span>
                          )}
                          
                          <div className="flex items-center gap-1">
                            <ClockIcon className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {formatTimeAgo(notification.created_at)}
                            </span>
                          </div>
                        </div>


                        {/* Quick Actions */}
                        {(notification.type === 'session_request' || notification.type === 'voice_request') && isUnread && (
                          <div className="flex items-center gap-2 mt-3">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleAcceptSession(notification)}
                              disabled={processingAction === notification.id}
                              className="flex-1 py-1.5 px-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-1 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                            >
                              <CheckIcon className="w-3.5 h-3.5" />
                              Accept
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleDeclineSession(notification)}
                              disabled={processingAction === notification.id}
                              className="flex-1 py-1.5 px-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-1 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                            >
                              <XMarkIcon className="w-3.5 h-3.5" />
                              Decline
                            </motion.button>
                          </div>
                        )}

                        {/* Message Reply */}
                        {notification.type === 'message' && (
                          <>
                            {replyingTo === notification.id ? (
                              <div className="mt-3 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={replyMessage}
                                  onChange={(e) => setReplyMessage(e.target.value)}
                                  placeholder="Type a reply..."
                                  className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  onKeyPress={(e) => e.key === 'Enter' && handleSendReply(notification)}
                                />
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleSendReply(notification)}
                                  disabled={processingAction === notification.id || !replyMessage.trim()}
                                  className="p-1.5 bg-purple-500 text-white rounded-lg disabled:opacity-50"
                                >
                                  <PaperAirplaneIcon className="w-3.5 h-3.5" />
                                </motion.button>
                              </div>
                            ) : (
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setReplyingTo(notification.id)}
                                className="mt-2 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                              >
                                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                                Quick Reply
                              </motion.button>
                            )}
                          </>
                        )}

                        {/* Thank You for Tips */}
                        {notification.type === 'tip_received' && !notification.thanked && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleThankYou(notification)}
                            disabled={processingAction === notification.id}
                            className="mt-2 py-1.5 px-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-1 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                          >
                            <HeartIcon className="w-3.5 h-3.5" />
                            Send Thank You
                          </motion.button>
                        )}
                      </div>

                    </div>
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