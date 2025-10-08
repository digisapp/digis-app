import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const WalletQuickView = ({ isOpen, onClose, user, tokenBalance, onNavigateToWallet, onTokenPurchase }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[99]"
            onClick={onClose}
          />

          {/* Modal - positioned above bottom navigation on mobile */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="wallet-modal fixed bottom-20 left-4 right-4 md:top-20 md:bottom-auto md:right-4 md:left-auto w-auto md:w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-[100] overflow-hidden"
            style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-white">Wallet</h3>
                <button
                  onClick={onClose}
                  className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Balance Display */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-center mb-4">
                  <p className="text-purple-100 text-sm mb-2">Available Balance</p>
                  <div className="flex items-center justify-center gap-2">
                    <SparklesIcon className="w-8 h-8 text-yellow-300" />
                    <span className="text-4xl font-bold text-white">
                      {tokenBalance || 0}
                    </span>
                    <span className="text-xl text-purple-100">tokens</span>
                  </div>
                </div>

                {/* Buy Tokens Button */}
                <button
                  onClick={() => {
                    onClose();
                    if (onTokenPurchase) {
                      onTokenPurchase();
                    } else {
                      toast.info('Purchase tokens feature opening...');
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 font-semibold backdrop-blur-sm border border-white/30"
                >
                  Buy Tokens
                </button>
              </div>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WalletQuickView;