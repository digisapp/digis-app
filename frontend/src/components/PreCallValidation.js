import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExclamationTriangleIcon,
  CreditCardIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { CreditCardIcon as CreditCardIconSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const PreCallValidation = ({
  user,
  creator,
  sessionType,
  estimatedDuration = 10,
  onValidationComplete,
  onCancel,
  isOpen
}) => {
  const [tokenBalance, setTokenBalance] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [dynamicPricing, setDynamicPricing] = useState(null);
  const [validationStatus, setValidationStatus] = useState('checking'); // checking, insufficient, valid
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [fanTier, setFanTier] = useState('newcomer');
  const [loading, setLoading] = useState(true);

  // Fetch current token balance
  const fetchTokenBalance = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/tokens/balance`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTokenBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
      toast.error('Failed to check token balance');
    }
  }, [user]);

  // Calculate dynamic pricing
  const calculateDynamicPricing = useCallback(async () => {
    if (!creator || !sessionType) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/users/dynamic-pricing?` +
        `creatorId=${creator.id || creator.supabase_id}&sessionType=${sessionType}&duration=${estimatedDuration}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setDynamicPricing(data.pricing);
        setLoyaltyDiscount(data.loyaltyDiscount || 0);
        setFanTier(data.fanTier || 'newcomer');
        
        // Calculate total cost in tokens
        const ratePerMinute = data.pricing.finalRate;
        const totalCost = Math.ceil(ratePerMinute * estimatedDuration * 20); // Convert to tokens ($1 = ~20 tokens)
        setEstimatedCost(totalCost);
        
        // Check if user has sufficient balance
        setValidationStatus(tokenBalance >= totalCost ? 'valid' : 'insufficient');
      }
    } catch (error) {
      console.error('Error calculating dynamic pricing:', error);
      setValidationStatus('insufficient');
    }
  }, [creator, sessionType, estimatedDuration, user, tokenBalance]);

  // Check fan engagement and loyalty status
  const fetchFanEngagement = useCallback(async () => {
    if (!user || !creator) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/users/fan-engagement/${creator.id || creator.supabase_id}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFanTier(data.engagement?.loyaltyTier || 'newcomer');
      }
    } catch (error) {
      console.error('Error fetching fan engagement:', error);
    }
  }, [user, creator]);

  // Initialize validation
  useEffect(() => {
    if (isOpen && user && creator) {
      setLoading(true);
      Promise.all([
        fetchTokenBalance(),
        fetchFanEngagement()
      ]).then(() => {
        calculateDynamicPricing();
        setLoading(false);
      });
    }
  }, [isOpen, user, creator, fetchTokenBalance, fetchFanEngagement, calculateDynamicPricing]);

  // Handle token purchase
  const handleTokenPurchase = (purchasedTokens) => {
    setTokenBalance(prev => prev + purchasedTokens);
    setShowTokenPurchase(false);
    
    // Re-validate after purchase
    setTimeout(() => {
      setValidationStatus(tokenBalance + purchasedTokens >= estimatedCost ? 'valid' : 'insufficient');
    }, 100);

    // toast.success(`Added ${purchasedTokens} tokens to your balance!`);
  };

  // Handle proceed with call
  const handleProceed = () => {
    if (validationStatus === 'valid') {
      onValidationComplete({
        estimatedCost,
        dynamicPricing,
        fanTier,
        loyaltyDiscount,
        tokenBalance,
        approved: true
      });
    }
  };

  const getTierColor = (tier) => {
    const colors = {
      newcomer: 'gray',
      regular: 'blue',
      vip: 'purple',
      legend: 'gold'
    };
    return colors[tier] || 'gray';
  };

  const getTierBadge = (tier) => {
    const badges = {
      newcomer: '👋 Newcomer',
      regular: '⭐ Regular',
      vip: '💎 VIP',
      legend: '👑 Legend'
    };
    return badges[tier] || '👋 Newcomer';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      >
        <motion.div
          className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Call Validation</h3>
                <p className="text-sm text-gray-600">
                  Checking your balance for {sessionType} call
                </p>
              </div>
              <button
                onClick={onCancel}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Calculating costs...</p>
            </div>
          ) : (
            <div className="p-6">
              {/* Creator Info */}
              <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                  {creator.profilePicUrl ? (
                    <img
                      src={creator.profilePicUrl}
                      alt={creator.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    creator.username?.charAt(0)?.toUpperCase() || 'C'
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">@{creator.username}</h4>
                  <p className="text-sm text-gray-600">{sessionType} call • {estimatedDuration} min</p>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium bg-${getTierColor(fanTier)}-100 text-${getTierColor(fanTier)}-800`}>
                  {getTierBadge(fanTier)}
                </div>
              </div>

              {/* Pricing Breakdown */}
              {dynamicPricing && (
                <div className="mb-6">
                  <h5 className="font-semibold text-gray-900 mb-3">Pricing Details</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Base rate:</span>
                      <span>${dynamicPricing.baseRate.toFixed(2)}/min</span>
                    </div>
                    
                    {dynamicPricing.peakMultiplier > 1 && (
                      <div className="flex justify-between text-orange-600">
                        <span>Peak hours multiplier:</span>
                        <span>{dynamicPricing.peakMultiplier}x</span>
                      </div>
                    )}

                    {dynamicPricing.demandMultiplier > 1 && (
                      <div className="flex justify-between text-red-600">
                        <span>High demand:</span>
                        <span>{dynamicPricing.demandMultiplier}x</span>
                      </div>
                    )}

                    {loyaltyDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Loyalty discount ({fanTier}):</span>
                        <span>-{(loyaltyDiscount * 100).toFixed(0)}%</span>
                      </div>
                    )}

                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Final rate:</span>
                      <span>${dynamicPricing.finalRate.toFixed(2)}/min</span>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-blue-900">Total cost:</span>
                        <span className="text-lg font-bold text-blue-900">{estimatedCost} tokens</span>
                      </div>
                      <p className="text-xs text-blue-700 mt-1">
                        ≈ ${(estimatedCost * 0.05).toFixed(2)} USD
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Balance Status */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Your balance:</span>
                  <span className="font-semibold text-lg">{tokenBalance} tokens</span>
                </div>

                {validationStatus === 'insufficient' ? (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-900">Insufficient balance</p>
                      <p className="text-xs text-red-700">
                        You need {estimatedCost - tokenBalance} more tokens
                      </p>
                    </div>
                  </div>
                ) : validationStatus === 'valid' ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Balance sufficient</p>
                      <p className="text-xs text-green-700">
                        {tokenBalance - estimatedCost} tokens remaining after call
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <ClockIcon className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                    <p className="text-sm text-yellow-900">Checking balance...</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>

                {validationStatus === 'insufficient' ? (
                  <button
                    onClick={() => setShowTokenPurchase(true)}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CreditCardIconSolid className="w-5 h-5" />
                    Buy Tokens
                  </button>
                ) : validationStatus === 'valid' ? (
                  <button
                    onClick={handleProceed}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircleIcon className="w-5 h-5" />
                    Start Call
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-1 px-4 py-3 bg-gray-300 text-gray-500 rounded-xl font-medium cursor-not-allowed"
                  >
                    Checking...
                  </button>
                )}
              </div>

              {/* Quick Purchase Options (if insufficient) */}
              {validationStatus === 'insufficient' && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-3">Quick top-up options:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[100, 250, 500].map(amount => (
                      <button
                        key={amount}
                        onClick={() => {
                          // Mock quick purchase
                          handleTokenPurchase(amount);
                        }}
                        className="p-2 border border-gray-300 rounded-lg text-center hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900">{amount}</div>
                        <div className="text-xs text-gray-600">${(amount * 0.05).toFixed(2)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PreCallValidation;