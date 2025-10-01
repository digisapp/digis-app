import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrophyIcon, 
  SparklesIcon,
  HeartIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import api from '../services/api';
import DualBadgeDisplay from './DualBadgeDisplay';
import toast from 'react-hot-toast';

const TopSupportersPanel = ({ creatorId, className = '' }) => {
  const [supporters, setSupporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupporter, setSelectedSupporter] = useState(null);
  const [showThankYouModal, setShowThankYouModal] = useState(false);

  useEffect(() => {
    fetchTopSupporters();
  }, [creatorId]);

  const fetchTopSupporters = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/loyalty/creator/${creatorId}/top-supporters`);
      setSupporters(response.data.topSupporters);
    } catch (error) {
      console.error('Error fetching top supporters:', error);
      toast.error('Failed to load top supporters');
    } finally {
      setLoading(false);
    }
  };

  const sendThankYou = async (supporterId) => {
    try {
      await api.post('/api/loyalty/perks/deliver', {
        userId: supporterId,
        perkType: 'thank_you_message',
        deliveryData: {
          message: 'Thank you for being an amazing supporter! 💖',
          type: 'personal'
        }
      });
      toast.success('Thank you message sent!');
      setShowThankYouModal(false);
    } catch (error) {
      toast.error('Failed to send thank you message');
    }
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankColor = (rank) => {
    if (rank === 1) return 'from-yellow-400 to-yellow-600';
    if (rank === 2) return 'from-gray-300 to-gray-500';
    if (rank === 3) return 'from-orange-400 to-orange-600';
    return 'from-purple-400 to-purple-600';
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-2xl p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-300 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-white dark:bg-gray-800 rounded-2xl p-6 ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrophyIcon className="h-6 w-6 text-yellow-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Top Supporters
            </h3>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {supporters.length} loyal fans
          </span>
        </div>

        {/* Supporters List */}
        <div className="space-y-3">
          <AnimatePresence>
            {supporters.map((supporter, index) => (
              <motion.div
                key={supporter.userId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className={`
                  relative p-4 rounded-xl border transition-all cursor-pointer
                  ${supporter.rank <= 3 
                    ? 'border-yellow-300 dark:border-yellow-600 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20' 
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'
                  }
                  hover:shadow-lg hover:scale-[1.02]
                `}
                onClick={() => setSelectedSupporter(supporter)}
              >
                {/* Rank Badge */}
                {supporter.rank <= 3 && (
                  <div className={`absolute -top-2 -left-2 bg-gradient-to-r ${getRankColor(supporter.rank)} text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg`}>
                    {getRankIcon(supporter.rank)}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  {/* User Info */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={supporter.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${supporter.username}`}
                        alt={supporter.displayName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      {supporter.rank <= 3 && (
                        <div className="absolute -bottom-1 -right-1 text-lg">
                          {getRankIcon(supporter.rank)}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {supporter.displayName || supporter.username}
                        </p>
                        <DualBadgeDisplay
                          userId={supporter.userId}
                          creatorId={creatorId}
                          size="small"
                          showTooltip={false}
                        />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <CurrencyDollarIcon className="h-3 w-3" />
                          ${supporter.totalSpend}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDaysIcon className="h-3 w-3" />
                          {supporter.supportDays} days
                        </span>
                        {supporter.subscriptionTier && (
                          <span className="text-purple-500 font-medium">
                            {supporter.subscriptionTier}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSupporter(supporter);
                      setShowThankYouModal(true);
                    }}
                    className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                  >
                    <HeartIcon className="h-5 w-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* View All Button */}
        {supporters.length >= 10 && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full mt-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2"
          >
            View All Supporters
            <ChevronRightIcon className="h-4 w-4" />
          </motion.button>
        )}
      </motion.div>

      {/* Thank You Modal */}
      <AnimatePresence>
        {showThankYouModal && selectedSupporter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowThankYouModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                  <HeartSolidIcon className="h-8 w-8 text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Send Thank You to {selectedSupporter.displayName}
                </h3>
                
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Show your appreciation to your {selectedSupporter.loyaltyEmoji} {selectedSupporter.loyaltyLevel} supporter!
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowThankYouModal(false)}
                    className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => sendThankYou(selectedSupporter.userId)}
                    className="flex-1 py-2 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                  >
                    Send Thank You 💖
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TopSupportersPanel;