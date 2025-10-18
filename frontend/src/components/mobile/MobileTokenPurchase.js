import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CurrencyDollarIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { CreditCardIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/auth-helpers';
import { TOKEN_PURCHASE_PACKS, validatePurchasePacks } from '../../config/wallet-config';

const MobileTokenPurchase = ({ isOpen, onClose, user, onPurchaseSuccess }) => {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Color schemes for each package tier
  const colorSchemes = [
    {
      color: 'from-blue-400 to-blue-600',
      bgColor: 'from-blue-50 to-blue-100',
      darkBgColor: 'from-blue-900/20 to-blue-800/20',
    },
    {
      color: 'from-purple-400 to-purple-600',
      bgColor: 'from-purple-50 to-purple-100',
      darkBgColor: 'from-purple-900/20 to-purple-800/20',
    },
    {
      color: 'from-pink-400 to-pink-600',
      bgColor: 'from-pink-50 to-pink-100',
      darkBgColor: 'from-pink-900/20 to-pink-800/20',
    }
  ];

  // Map TOKEN_PURCHASE_PACKS to UI packages with colors and validate
  const tokenPackages = (() => {
    const validPacks = validatePurchasePacks(TOKEN_PURCHASE_PACKS) ? TOKEN_PURCHASE_PACKS : [];
    if (!validPacks.length) {
      console.error('Invalid TOKEN_PURCHASE_PACKS config');
      return [];
    }
    return validPacks.map((pack, index) => ({
      id: index + 1,
      tokens: pack.tokens,
      price: pack.priceUsd,
      perToken: pack.priceUsd / pack.tokens,
      ...colorSchemes[index % colorSchemes.length]
    }));
  })();

  const handlePurchase = async () => {
    if (!selectedPackage && !customAmount) {
      toast.error('Please select a package or enter an amount');
      return;
    }

    setIsProcessing(true);

    try {
      const token = await getAuthToken();
      const purchaseData = selectedPackage
        ? {
            tokens: selectedPackage.tokens,
            amount: selectedPackage.price * 100 // Convert to cents
          }
        : {
            tokens: Math.floor(parseFloat(customAmount) * 10), // $0.10 per token
            amount: parseFloat(customAmount) * 100 // Convert to cents
          };

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/payments/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...purchaseData,
          success_url: `${window.location.origin}/wallet?success=1`,
          cancel_url: `${window.location.origin}/wallet?canceled=1`
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Redirect to Stripe checkout
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          // Fallback for successful purchase without redirect
          toast.success(`Successfully purchased ${purchaseData.tokens} tokens!`);
          if (onPurchaseSuccess) {
            onPurchaseSuccess(purchaseData.tokens);
          }
          onClose();
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to process purchase');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Failed to process purchase. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateTokens = (amount) => {
    return Math.floor(amount * 10); // $0.10 per token
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            style={{ touchAction: 'none' }}
          />

          {/* Modal - Fixed positioning to avoid navigation overlap */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 bottom-20 top-20 bg-white dark:bg-gray-900 rounded-2xl z-[100] overflow-hidden flex flex-col shadow-2xl"
            style={{
              maxHeight: 'calc(100vh - 160px)',
              marginBottom: 'env(safe-area-inset-bottom, 20px)'
            }}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Buy Tokens</h2>
                <button
                  onClick={onClose}
                  className="p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-all duration-200 active:scale-95 flex items-center justify-center"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-6 h-6 text-white stroke-2" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {/* Token Packages - Full Width Horizontal */}
              <div className="px-4 py-3 space-y-2">
                {tokenPackages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p className="font-medium">Unable to load purchase options</p>
                    <p className="text-sm mt-1">Please contact support if this persists.</p>
                  </div>
                ) : tokenPackages.map((pkg) => (
                  <motion.button
                    key={pkg.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedPackage(pkg);
                      setShowCustomInput(false);
                      setCustomAmount('');
                    }}
                    className={`relative w-full p-3 rounded-lg border transition-all flex items-center justify-between ${
                      selectedPackage?.id === pkg.id
                        ? `border-transparent shadow-md bg-gradient-to-r ${pkg.color} text-white`
                        : `border-gray-200 dark:border-gray-700 bg-gradient-to-r ${pkg.bgColor} dark:from-gray-800 dark:to-gray-700`
                    }`}
                  >

                    <div className="relative z-10 flex items-center justify-between w-full">
                      {/* Left side - Token amount */}
                      <div className="flex items-center gap-3">
                        <div className={`text-left ${
                          selectedPackage?.id === pkg.id ? 'text-white' : ''
                        }`}>
                          <div className={`text-lg font-bold ${
                            selectedPackage?.id === pkg.id
                              ? 'text-white'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {pkg.tokens.toLocaleString()}
                          </div>
                          <div className={`text-xs ${
                            selectedPackage?.id === pkg.id
                              ? 'text-white/80'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            tokens
                          </div>
                        </div>
                      </div>

                      {/* Right side - Price and check */}
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-end gap-0.5">
                          <div className={`text-xl font-bold ${
                            selectedPackage?.id === pkg.id
                              ? 'text-white'
                              : 'bg-gradient-to-r ' + pkg.color + ' bg-clip-text text-transparent'
                          }`}>
                            ${pkg.price}
                          </div>
                          <div className={`text-[10px] ${
                            selectedPackage?.id === pkg.id
                              ? 'text-white/70'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            ~${pkg.perToken.toFixed(2)}/token
                          </div>
                        </div>
                        {selectedPackage?.id === pkg.id && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="flex items-center justify-center"
                          >
                            <CheckCircleIcon className="w-5 h-5 text-white" />
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>


              {/* Payment Method - Compact */}
              <div className="px-4 py-2">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-2.5 flex items-center gap-2 border border-gray-200 dark:border-gray-600">
                  <CreditCardIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Secure Card Payment
                    </p>
                  </div>
                  <CheckCircleIcon className="w-4 h-4 text-green-500" />
                </div>
              </div>

              {/* Summary - Compact */}
              {selectedPackage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-4 py-1"
                >
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-2 flex justify-between items-center border border-purple-200 dark:border-purple-800">
                    <div>
                      <span className="text-xs text-gray-600 dark:text-gray-400">Total: </span>
                      <span className="text-base font-bold text-purple-600 dark:text-purple-400">
                        ${selectedPackage.price}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-gray-900 dark:text-white">
                        {selectedPackage.tokens.toLocaleString()} tokens
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Fixed Bottom Button - Properly positioned above navigation */}
            <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-4 mt-auto">
              <button
                onClick={handlePurchase}
                disabled={(!selectedPackage && !customAmount) || isProcessing}
                className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 ${
                  (!selectedPackage && !customAmount) || isProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 active:scale-[0.98] shadow-lg hover:shadow-xl'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CurrencyDollarIcon className="w-5 h-5" />
                    Complete Purchase
                  </>
                )}
              </button>
              <p className="text-[11px] text-center text-gray-500 dark:text-gray-400 mt-2">
                Secure payment via Stripe • SSL Encrypted
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileTokenPurchase;