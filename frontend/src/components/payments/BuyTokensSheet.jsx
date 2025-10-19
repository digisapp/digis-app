import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Coins, Zap, TrendingUp, Check } from 'lucide-react';
import api from '../../services/api';

const TOKEN_PACKAGES = [
  {
    id: 'starter',
    tokens: 100,
    price: 9.99,
    priceId: 'price_starter_100_tokens',
    badge: null,
    popular: false
  },
  {
    id: 'popular',
    tokens: 500,
    price: 39.99,
    priceId: 'price_popular_500_tokens',
    badge: '20% Bonus',
    popular: true
  },
  {
    id: 'best',
    tokens: 1500,
    price: 99.99,
    priceId: 'price_best_1500_tokens',
    badge: '50% Bonus',
    popular: false
  }
];

const BuyTokensSheet = ({ isOpen, onClose, onSuccess }) => {
  const [selectedPackage, setSelectedPackage] = useState('popular');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setLoading(true);
    setError(null);

    try {
      const pkg = TOKEN_PACKAGES.find(p => p.id === selectedPackage);

      // Create Stripe checkout session
      const response = await api.post('/payments/create-checkout-session', {
        priceId: pkg.priceId,
        tokenAmount: pkg.tokens,
        successUrl: `${window.location.origin}/payment/success`,
        cancelUrl: `${window.location.origin}/payment/cancel`
      });

      if (response.data.url) {
        // Redirect to Stripe checkout
        window.location.href = response.data.url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (err) {
      console.error('Purchase error:', err);
      setError(err.response?.data?.error || 'Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 w-full sm:max-w-lg sm:rounded-2xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-6 border-b border-gray-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Buy Tokens</h2>
                  <p className="text-sm text-gray-400">Choose your package</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Packages */}
          <div className="p-6 space-y-3">
            {TOKEN_PACKAGES.map((pkg) => (
              <motion.button
                key={pkg.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedPackage(pkg.id)}
                className={`relative w-full p-4 rounded-xl border-2 transition-all ${
                  selectedPackage === pkg.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                {pkg.popular && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-xs font-bold text-white">
                    MOST POPULAR
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      pkg.id === 'starter' ? 'bg-blue-500/20' :
                      pkg.id === 'popular' ? 'bg-purple-500/20' :
                      'bg-yellow-500/20'
                    }`}>
                      {pkg.id === 'starter' && <Zap className="w-6 h-6 text-blue-400" />}
                      {pkg.id === 'popular' && <TrendingUp className="w-6 h-6 text-purple-400" />}
                      {pkg.id === 'best' && <Coins className="w-6 h-6 text-yellow-400" />}
                    </div>

                    <div className="text-left">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl font-bold text-white">{pkg.tokens}</span>
                        <span className="text-sm text-gray-400">tokens</span>
                        {pkg.badge && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full">
                            {pkg.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        ${(pkg.price / pkg.tokens).toFixed(2)} per token
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-2xl font-bold text-white">${pkg.price}</span>
                    {selectedPackage === pkg.id && (
                      <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Info Box */}
          <div className="mx-6 mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Coins className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 text-sm">
                <p className="text-blue-300 font-medium mb-1">100% to Creators</p>
                <p className="text-blue-200/70 text-xs leading-relaxed">
                  When you spend tokens on creators, they receive 100% of what you send.
                  Creators earn $0.05 per token when cashing out.
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl"
            >
              <p className="text-sm text-red-300">{error}</p>
            </motion.div>
          )}

          {/* Purchase Button */}
          <div className="p-6 pt-0">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handlePurchase}
              disabled={loading || !selectedPackage}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                loading || !selectedPackage
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/25'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                `Purchase ${TOKEN_PACKAGES.find(p => p.id === selectedPackage)?.tokens || 0} Tokens`
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BuyTokensSheet;
