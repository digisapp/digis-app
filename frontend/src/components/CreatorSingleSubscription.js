import React, { useState, useEffect } from 'react';
import {
  CurrencyDollarIcon,
  CheckIcon,
  XMarkIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase-auth';
import toast from 'react-hot-toast';

const CreatorSingleSubscription = ({
  isOpen,
  onClose,
  creatorId,
  creatorName,
  onSuccess,
  user,
  tokenBalance = 0
}) => {
  const [subscriptionPrice, setSubscriptionPrice] = useState(200); // Default 200 tokens
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (isOpen && creatorId) {
      loadSubscriptionInfo();
    }
  }, [isOpen, creatorId]);

  const loadSubscriptionInfo = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        console.error('No auth token available');
        return;
      }

      // Check if already subscribed
      const checkResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/subscriptions/check/${creatorId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        setIsSubscribed(checkData.isSubscribed);
      }

      // Get creator's subscription price
      const priceResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/subscriptions/creator/${creatorId}/price`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        setSubscriptionPrice(priceData.price || 200);
      }
    } catch (error) {
      console.error('Error loading subscription info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      toast.error('Please log in to subscribe');
      return;
    }

    if (tokenBalance < subscriptionPrice) {
      toast.error('Insufficient tokens. Please purchase more tokens.');
      return;
    }

    setSubscribing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/subscriptions/subscribe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            creatorId,
            priceTokens: subscriptionPrice
          })
        }
      );

      if (response.ok) {
        toast.success(`Successfully subscribed to ${creatorName}!`);
        setIsSubscribed(true);
        if (onSuccess) {
          onSuccess();
        }
        setTimeout(() => onClose(), 1500);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to subscribe');
      }
    } catch (error) {
      console.error('Subscribe error:', error);
      toast.error('Failed to subscribe. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl">
                <SparklesIcon className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Subscribe</h2>
                <p className="text-white/90">to {creatorName}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-500">Loading subscription details...</p>
              </div>
            ) : isSubscribed ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckIcon className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Already Subscribed!
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  You're already subscribed to {creatorName}
                </p>
              </div>
            ) : (
              <>
                {/* Subscription Details */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-gray-600 dark:text-gray-400">Monthly Subscription</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {subscriptionPrice} tokens
                      </div>
                      <div className="text-sm text-gray-500">
                        ≈ ${(subscriptionPrice * 0.05).toFixed(2)}/month
                      </div>
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="space-y-3 border-t border-gray-200 dark:border-gray-600 pt-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Subscription Benefits
                    </h4>
                    {[
                      'Access exclusive content',
                      'Priority messaging',
                      'Special subscriber-only streams',
                      'Monthly perks and rewards',
                      'Early access to new content'
                    ].map((benefit, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckIcon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {benefit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Token Balance */}
                <div className="flex items-center justify-between mb-6 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Your token balance:
                  </span>
                  <span className={`font-bold ${tokenBalance >= subscriptionPrice ? 'text-green-600' : 'text-red-600'}`}>
                    {tokenBalance} tokens
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubscribe}
                    disabled={subscribing || tokenBalance < subscriptionPrice}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg flex items-center justify-center gap-2"
                  >
                    {subscribing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Subscribing...</span>
                      </>
                    ) : (
                      <>
                        <CurrencyDollarIcon className="w-5 h-5" />
                        <span>Subscribe Now</span>
                      </>
                    )}
                  </button>
                </div>

                {tokenBalance < subscriptionPrice && (
                  <p className="text-center text-sm text-red-600 dark:text-red-400 mt-3">
                    You need {subscriptionPrice - tokenBalance} more tokens to subscribe
                  </p>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreatorSingleSubscription;