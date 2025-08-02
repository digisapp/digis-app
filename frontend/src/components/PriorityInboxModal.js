import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  StarIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  FireIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const PriorityInboxModal = ({ isOpen, onClose, onSelectConversation, user }) => {
  const [priorityMessages, setPriorityMessages] = useState([]);
  const [filter, setFilter] = useState('all'); // all, unread, vip, high-value
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPriorityMessages();
    }
  }, [isOpen, filter]);

  const loadPriorityMessages = async () => {
    setLoading(true);
    try {
      // In production, fetch from API
      // For demo, use mock data
      setTimeout(() => {
        setPriorityMessages([
          {
            id: 1,
            userId: 'vip1',
            username: 'DiamondFan_Alex',
            avatar: null,
            lastMessage: 'Hey! I absolutely loved your last stream. Can we schedule a private session?',
            timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
            unread: true,
            isVIP: true,
            totalSpent: 5000,
            tokenBalance: 2500,
            priority: 'high',
            tags: ['VIP', 'High Spender'],
            hasNewOffer: true
          },
          {
            id: 2,
            userId: 'vip2',
            username: 'SuperSupporter_Maya',
            avatar: null,
            lastMessage: 'Thanks for the amazing content! Would love to discuss a collaboration idea.',
            timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
            unread: true,
            isVIP: true,
            totalSpent: 3200,
            tokenBalance: 1800,
            priority: 'high',
            tags: ['VIP', 'Frequent Buyer'],
            hasBusinessInquiry: true
          },
          {
            id: 3,
            userId: 'high1',
            username: 'LoyalFan_Chris',
            avatar: null,
            lastMessage: 'Can\'t wait for the next class! Do you have any special offers?',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            unread: false,
            isVIP: false,
            totalSpent: 1500,
            tokenBalance: 800,
            priority: 'medium',
            tags: ['Regular', 'Class Attendee']
          },
          {
            id: 4,
            userId: 'vip3',
            username: 'TokenKing_Sam',
            avatar: null,
            lastMessage: 'Just purchased more tokens! Ready for our session 🔥',
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
            unread: true,
            isVIP: true,
            totalSpent: 8000,
            tokenBalance: 4000,
            priority: 'urgent',
            tags: ['VIP', 'Top Spender', 'Active'],
            recentPurchase: { amount: 1000, time: '1 hour ago' }
          },
          {
            id: 5,
            userId: 'high2',
            username: 'NewVIP_Jordan',
            avatar: null,
            lastMessage: 'Just upgraded to VIP! Excited to connect more.',
            timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
            unread: true,
            isVIP: true,
            totalSpent: 2000,
            tokenBalance: 1200,
            priority: 'high',
            tags: ['New VIP', 'Growing'],
            newVIP: true
          }
        ]);
        setLoading(false);
      }, 800);
    } catch (error) {
      console.error('Error loading priority messages:', error);
      setLoading(false);
    }
  };

  const getFilteredMessages = () => {
    switch (filter) {
      case 'unread':
        return priorityMessages.filter(msg => msg.unread);
      case 'vip':
        return priorityMessages.filter(msg => msg.isVIP);
      case 'high-value':
        return priorityMessages.filter(msg => msg.totalSpent >= 2000);
      default:
        return priorityMessages;
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'from-red-500 to-orange-500';
      case 'high':
        return 'from-purple-500 to-pink-500';
      case 'medium':
        return 'from-blue-500 to-cyan-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const filteredMessages = getFilteredMessages();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <StarIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Priority Inbox</h2>
                <p className="text-sm text-gray-600">
                  {filteredMessages.filter(m => m.unread).length} unread from VIP fans
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Filters */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              {[
                { id: 'all', label: 'All', count: priorityMessages.length },
                { id: 'unread', label: 'Unread', count: priorityMessages.filter(m => m.unread).length },
                { id: 'vip', label: 'VIP Only', count: priorityMessages.filter(m => m.isVIP).length },
                { id: 'high-value', label: 'High Value', count: priorityMessages.filter(m => m.totalSpent >= 2000).length }
              ].map((filterOption) => (
                <motion.button
                  key={filterOption.id}
                  onClick={() => setFilter(filterOption.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    filter === filterOption.id
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {filterOption.label}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    filter === filterOption.id
                      ? 'bg-purple-200 text-purple-800'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {filterOption.count}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Messages List */}
          <div className="overflow-y-auto" style={{ height: 'calc(90vh - 200px)' }}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center py-20">
                <StarIconOutline className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No priority messages</h3>
                <p className="text-gray-600">Messages from VIP and high-value fans will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-all"
                    onClick={() => {
                      onSelectConversation(message);
                      onClose();
                    }}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Priority Indicator */}
                      <div className={`w-1 h-full bg-gradient-to-b ${getPriorityColor(message.priority)} rounded-full self-stretch`} />
                      
                      {/* Avatar */}
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
                          {message.username[0].toUpperCase()}
                        </div>
                        {message.isVIP && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
                            <StarIconSolid className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{message.username}</h3>
                            {message.unread && (
                              <div className="w-2 h-2 bg-purple-600 rounded-full" />
                            )}
                          </div>
                          <span className="text-xs text-gray-500">{formatTimeAgo(message.timestamp)}</span>
                        </div>

                        {/* Tags */}
                        <div className="flex items-center gap-2 mb-2">
                          {message.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                          {message.newVIP && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium flex items-center gap-1">
                              <SparklesIcon className="w-3 h-3" />
                              New VIP
                            </span>
                          )}
                          {message.hasNewOffer && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium flex items-center gap-1">
                              <ExclamationCircleIcon className="w-3 h-3" />
                              Offer
                            </span>
                          )}
                          {message.hasBusinessInquiry && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium flex items-center gap-1">
                              <FireIcon className="w-3 h-3" />
                              Business
                            </span>
                          )}
                        </div>

                        {/* Message Preview */}
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{message.lastMessage}</p>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <CurrencyDollarIcon className="w-3.5 h-3.5" />
                            <span>Total: ${message.totalSpent}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CurrencyDollarIcon className="w-3.5 h-3.5" />
                            <span>Balance: {message.tokenBalance} tokens</span>
                          </div>
                          {message.recentPurchase && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircleIcon className="w-3.5 h-3.5" />
                              <span>Bought {message.recentPurchase.amount} tokens {message.recentPurchase.time}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Arrow */}
                      <motion.div
                        className="text-gray-400 group-hover:text-purple-600 transition-colors"
                        whileHover={{ x: 5 }}
                      >
                        <ArrowRightIcon className="w-5 h-5" />
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats Footer */}
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {priorityMessages.filter(m => m.isVIP).length}
                </div>
                <div className="text-xs text-gray-600">VIP Fans</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  ${priorityMessages.reduce((sum, m) => sum + m.totalSpent, 0).toLocaleString()}
                </div>
                <div className="text-xs text-gray-600">Total Revenue</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {priorityMessages.filter(m => m.priority === 'urgent' || m.priority === 'high').length}
                </div>
                <div className="text-xs text-gray-600">High Priority</div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PriorityInboxModal;