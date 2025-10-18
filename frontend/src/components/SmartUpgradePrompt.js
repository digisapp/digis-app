import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SparklesIcon,
  ArrowUpIcon,
  CurrencyDollarIcon,
  CheckIcon,
  XMarkIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { getAuthToken } from '../utils/supabase-auth';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import DualBadgeDisplay from './DualBadgeDisplay';
import toast from 'react-hot-toast';

const SmartUpgradePrompt = ({ 
  user, 
  currentBadges, 
  context = 'wallet', // 'wallet', 'checkout', 'profile'
  onUpgrade,
  onDismiss 
}) => {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (user && !dismissed) {
      fetchUpgradeSuggestion();
    }
  }, [user, currentBadges]);

  const fetchUpgradeSuggestion = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/analytics/upgrade-suggestion/${user.id}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      const data = await response.json();
      
      if (data.shouldShow && data.suggestion) {
        setSuggestion(data.suggestion);
      }
    } catch (error) {
      console.error('Error fetching upgrade suggestion:', error);
    }
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      if (onUpgrade) {
        await onUpgrade(suggestion);
      }
      toast.success('Upgrade initiated!');
      setSuggestion(null);
    } catch (error) {
      toast.error('Failed to process upgrade');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setSuggestion(null);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (!suggestion || dismissed) return null;

  // Context-specific prompts
  const getPromptContent = () => {
    switch (context) {
      case 'wallet':
        return {
          title: '💎 You\'re Close to Diamond Status!',
          subtitle: `Only ${suggestion.remaining} tokens away from unlocking exclusive Diamond perks`,
          cta: 'Upgrade Now',
          benefits: [
            '20% permanent discount on all content',
            '100 bonus tokens monthly',
            'VIP creator access',
            'Daily exclusive content'
          ]
        };
      
      case 'checkout':
        return {
          title: '🎯 Smart Savings Alert!',
          subtitle: `Upgrade to ${suggestion.nextTier} and save ${suggestion.discountAmount}% on this purchase`,
          cta: 'Upgrade & Save',
          benefits: [
            `Save $${suggestion.savingsAmount} on this order`,
            'Unlock permanent discounts',
            'Get bonus tokens monthly',
            'Priority support'
          ]
        };
      
      case 'profile':
        return {
          title: '🚀 Level Up Your Experience!',
          subtitle: `You've been supporting for ${suggestion.supportDays} days - time to unlock more benefits`,
          cta: 'View Upgrade Options',
          benefits: suggestion.benefits || []
        };
      
      default:
        return {
          title: 'Upgrade Available',
          subtitle: 'Unlock more benefits',
          cta: 'Learn More',
          benefits: []
        };
    }
  };

  const content = getPromptContent();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="relative"
      >
        {/* Main Prompt Card */}
        <div className={`
          bg-gradient-to-br from-purple-900/90 to-pink-900/90 
          backdrop-blur-lg rounded-2xl p-6 border border-purple-500/30
          shadow-2xl shadow-purple-500/20
          ${context === 'wallet' ? 'max-w-md' : 'w-full'}
        `}>
          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="mb-4">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              {suggestion.urgency === 'high' && (
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <SparklesIcon className="w-6 h-6 text-yellow-400" />
                </motion.span>
              )}
              {content.title}
            </h3>
            <p className="text-gray-300 text-sm">{content.subtitle}</p>
          </div>

          {/* Progress Indicator */}
          {suggestion.progress && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Progress to {suggestion.nextTier}</span>
                <span>{suggestion.progress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${suggestion.progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                />
              </div>
            </div>
          )}

          {/* Badge Preview */}
          <div className="bg-black/30 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-400 mb-2">Your Status After Upgrade:</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-gray-500">Current:</span>
                <DualBadgeDisplay
                  userId={user.id}
                  creatorId={suggestion.creatorId}
                  size="small"
                  showTooltip={false}
                />
              </div>
              <ArrowUpIcon className="w-4 h-4 text-purple-400" />
              <div className="flex items-center gap-3">
                <span className="text-green-400">New:</span>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white text-xs font-bold">
                    {suggestion.nextSubscriptionTier || currentBadges?.subscription?.tier || 'Bronze'}
                  </span>
                  <span className="px-2 py-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full text-white text-xs font-bold">
                    {suggestion.nextLoyaltyLevel || 'Diamond'} {suggestion.nextLoyaltyEmoji}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits List */}
          {content.benefits.length > 0 && (
            <div className="space-y-2 mb-4">
              {content.benefits.slice(0, 4).map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-2"
                >
                  <CheckIcon className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">{benefit}</span>
                </motion.div>
              ))}
            </div>
          )}

          {/* Limited Time Offer Badge */}
          {suggestion.limitedTime && (
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-2 mb-4">
              <p className="text-yellow-400 text-xs text-center font-medium">
                ⏰ Limited Time: {suggestion.offerExpiry}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white py-3 px-4 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ArrowUpIcon className="w-5 h-5" />
                  {content.cta}
                </span>
              )}
            </button>
            
            {context !== 'checkout' && (
              <button
                onClick={handleDismiss}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
              >
                Maybe Later
              </button>
            )}
          </div>

          {/* Trust Indicators */}
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <CheckIcon className="w-3 h-3" />
                Cancel anytime
              </span>
              <span className="flex items-center gap-1">
                <CurrencyDollarIcon className="w-3 h-3" />
                Secure payment
              </span>
              <span className="flex items-center gap-1">
                <TrophyIcon className="w-3 h-3" />
                Instant benefits
              </span>
            </div>
          </div>
        </div>

        {/* Floating Particles Effect */}
        {suggestion.urgency === 'high' && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                  x: Math.random() * 100 - 50,
                  y: Math.random() * 100 - 50
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 0.5
                }}
                className="absolute top-1/2 left-1/2 w-2 h-2 bg-purple-400 rounded-full"
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default SmartUpgradePrompt;