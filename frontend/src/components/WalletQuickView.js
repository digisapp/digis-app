import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CurrencyDollarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  SparklesIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { getAuthToken } from '../utils/supabase-auth';
import toast from 'react-hot-toast';

const WalletQuickView = ({ isOpen, onClose, user, tokenBalance, onNavigateToWallet, onTokenPurchase }) => {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalEarned: 0,
    pendingBalance: 0
  });

  useEffect(() => {
    if (isOpen && user?.id) {
      fetchWalletData();
    }
  }, [isOpen, user?.id]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event) => {
      // Check if click is outside the modal
      if (!event.target.closest('.wallet-modal')) {
        onClose();
      }
    };

    // Add delay to prevent immediate close on open
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const fetchWalletData = async () => {
    try {
      setIsLoading(true);
      const authToken = await getAuthToken();
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/wallet/quick-view/${user.id}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.recentTransactions || []);
        setStats({
          totalSpent: data.totalSpent || 0,
          totalEarned: data.totalEarned || 0,
          pendingBalance: data.pendingBalance || 0
        });
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Modal - positioned below navigation z-index */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="wallet-modal fixed top-20 right-4 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-30 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-white">Wallet Overview</h3>
                <button
                  onClick={onClose}
                  className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Balance Display */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-purple-100 text-sm mb-1">Available Balance</p>
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="w-6 h-6 text-yellow-300" />
                      <span className="text-3xl font-bold text-white">
                        {tokenBalance || 0}
                      </span>
                      <span className="text-purple-100">tokens</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-purple-100 mb-1">USD Value</p>
                    <p className="text-xl font-semibold text-white">
                      ${((tokenBalance || 0) * 0.05).toFixed(2)}
                    </p>
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