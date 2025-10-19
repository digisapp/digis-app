import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Coins, X, Send } from 'lucide-react';
import { AppContext } from '../../contexts/AppContext';
import api from '../../services/api';
import BuyTokensSheet from './BuyTokensSheet';

const QUICK_TIP_AMOUNTS = [10, 25, 50, 100, 250, 500];

const TipButton = ({ toCreatorId, context = {}, onTipped, className = '' }) => {
  const { user, setUser } = useContext(AppContext);
  const [isOpen, setIsOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showBuyTokens, setShowBuyTokens] = useState(false);

  const userBalance = user?.tokenBalance || 0;

  const handleTip = async (amount) => {
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount > userBalance) {
      setError('Insufficient tokens');
      setShowBuyTokens(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/tips/send', {
        toCreatorId,
        amountTokens: amount,
        message: message.trim(),
        context
      });

      // Update user balance
      if (setUser && response.data.new_balance !== undefined) {
        setUser(prev => ({
          ...prev,
          tokenBalance: response.data.new_balance
        }));
      }

      // Show success animation
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsOpen(false);
        setCustomAmount('');
        setMessage('');
      }, 2000);

      // Callback
      if (onTipped) {
        onTipped(response.data);
      }
    } catch (err) {
      console.error('Tip error:', err);
      setError(err.response?.data?.error || 'Failed to send tip');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTip = (amount) => {
    handleTip(amount);
  };

  const handleCustomTip = () => {
    const amount = parseInt(customAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    handleTip(amount);
  };

  return (
    <>
      {/* Tip Button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={`flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full text-white font-semibold shadow-lg hover:shadow-xl transition-all ${className}`}
      >
        <Heart className="w-5 h-5" fill="currentColor" />
        <span>Tip</span>
      </motion.button>

      {/* Tip Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 w-full sm:max-w-md sm:rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Success State */}
              {success ? (
                <div className="p-12 flex flex-col items-center justify-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center"
                  >
                    <Heart className="w-10 h-10 text-white" fill="currentColor" />
                  </motion.div>
                  <motion.h3
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl font-bold text-white"
                  >
                    Tip Sent!
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-gray-400 text-center"
                  >
                    Your support means everything
                  </motion.p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="relative p-6 border-b border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                          <Heart className="w-6 h-6 text-white" fill="currentColor" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">Send a Tip</h2>
                          <div className="flex items-center space-x-2 text-sm text-gray-400">
                            <Coins className="w-4 h-4" />
                            <span>{userBalance} tokens available</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsOpen(false)}
                        className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Amounts */}
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Quick Amount</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {QUICK_TIP_AMOUNTS.map((amount) => (
                          <motion.button
                            key={amount}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleQuickTip(amount)}
                            disabled={loading || amount > userBalance}
                            className={`py-3 rounded-xl font-bold transition-all ${
                              amount > userBalance
                                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                : 'bg-gray-800 text-white hover:bg-gradient-to-r hover:from-pink-500 hover:to-purple-500'
                            }`}
                          >
                            {amount}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Amount */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Custom Amount</h3>
                      <div className="flex space-x-2">
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            placeholder="Enter amount"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                          />
                          <Coins className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={handleCustomTip}
                          disabled={loading || !customAmount}
                          className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                        >
                          <Send className="w-5 h-5" />
                        </motion.button>
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Add a Message (Optional)</h3>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Say something nice..."
                        maxLength={200}
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                      />
                      <div className="mt-1 text-xs text-gray-500 text-right">
                        {message.length}/200
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
                      {error === 'Insufficient tokens' && (
                        <button
                          onClick={() => setShowBuyTokens(true)}
                          className="mt-2 text-sm text-purple-400 hover:text-purple-300 underline"
                        >
                          Buy more tokens
                        </button>
                      )}
                    </motion.div>
                  )}

                  {/* Loading State */}
                  {loading && (
                    <div className="mx-6 mb-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                        <span className="text-sm text-purple-300">Sending tip...</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buy Tokens Sheet */}
      <BuyTokensSheet
        isOpen={showBuyTokens}
        onClose={() => setShowBuyTokens(false)}
        onSuccess={() => {
          setShowBuyTokens(false);
          setError(null);
        }}
      />
    </>
  );
};

export default TipButton;
