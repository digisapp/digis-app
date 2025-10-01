import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  SparklesIcon,
  CheckIcon,
  LockClosedIcon,
  TvIcon,
  ClockIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const TVSubscriptionModal = ({ 
  isOpen, 
  onClose, 
  isTrialAvailable, 
  tokenBalance, 
  onStartTrial, 
  onSubscribe,
  onTokenPurchase,
  trialExpired = false,
  user 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const subscriptionCost = 500;
  const hasEnoughTokens = tokenBalance >= subscriptionCost;

  const handleStartTrial = async () => {
    setIsProcessing(true);
    try {
      await onStartTrial();
      // toast.success('🎉 Your 60-day free trial has started!');
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to start trial');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubscribe = async () => {
    setIsProcessing(true);
    try {
      await onSubscribe();
      // toast.success('🎉 Welcome to Digis TV!');
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to subscribe');
    } finally {
      setIsProcessing(false);
    }
  };

  const benefits = [
    'Unlimited access to all public live streams',
    'Watch creators streaming 24/7 from around the world',
    'No ads or interruptions during streams',
    'Support creators through the platform',
    'Exclusive TV subscriber-only content',
    'Priority access to new features'
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl p-8 max-w-lg w-full relative overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-500 rounded-full blur-3xl" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <XMarkIcon className="w-6 h-6 text-gray-700" />
            </button>

            {/* Content */}
            <div className="relative z-10">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mb-4">
                  <TvIcon className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  {!user ? 'Welcome to Digis TV' : trialExpired ? 'Your Free Trial Has Ended' : 'Digis TV Subscription'}
                </h2>
                <p className="text-gray-600">
                  {!user 
                    ? 'Sign up now and get 60 days FREE access to unlimited live streams!'
                    : trialExpired 
                      ? 'Continue watching unlimited public live streams with a subscription'
                      : 'Watch unlimited public live streams from creators worldwide'
                  }
                </p>
              </div>

              {/* Benefits */}
              <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">What's included:</h3>
                <div className="space-y-3">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing Options */}
              <div className="space-y-4">
                {/* Sign Up CTA for non-users */}
                {!user && (
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-bold">60-Day FREE Trial</h3>
                      <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                        Limited Time
                      </span>
                    </div>
                    <p className="text-white/90 mb-4">
                      Create an account now and enjoy 60 days of free access to all public live streams!
                    </p>
                    <button
                      onClick={onClose}
                      className="w-full bg-white text-purple-600 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                    >
                      Sign Up for Free Trial
                    </button>
                  </motion.div>
                )}

                {/* Monthly Subscription - Show for users with expired trials */}
                <div>
                  {user && trialExpired && (
                    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 mb-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-xl font-bold text-gray-900">TV Monthly Pass</h4>
                          <p className="text-gray-600 text-sm">Unlimited public live streams for 30 days</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">500</div>
                          <div className="text-gray-600 text-sm">tokens/month</div>
                        </div>
                      </div>

                      {/* Token Balance Check */}
                      <div className="bg-gray-100 rounded-xl p-3 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 text-sm">Your balance:</span>
                          <span className={`font-semibold ${hasEnoughTokens ? 'text-green-600' : 'text-red-600'}`}>
                            {tokenBalance.toLocaleString()} tokens
                          </span>
                        </div>
                      </div>

                      {hasEnoughTokens ? (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleSubscribe}
                          disabled={isProcessing}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isProcessing ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Processing...</span>
                            </div>
                          ) : (
                            'Subscribe Now'
                          )}
                        </motion.button>
                      ) : (
                        <div>
                          <p className="text-red-600 text-sm mb-3 text-center">
                            You need {(subscriptionCost - tokenBalance).toLocaleString()} more tokens
                          </p>
                          <button
                            onClick={onTokenPurchase}
                            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                          >
                            Buy Tokens
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Terms */}
              <p className="text-xs text-gray-500 text-center mt-6">
                By subscribing, you agree to our terms of service. Cancel anytime.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TVSubscriptionModal;