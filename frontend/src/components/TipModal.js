import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  SparklesIcon,
  MinusIcon,
  PlusIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const TipModal = ({
  isOpen,
  onClose,
  creator,
  tokenBalance = 0,
  onTipSent
}) => {
  const navigate = useNavigate();
  const [tipAmount, setTipAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isSending, setSending] = useState(false);
  const [showInsufficientTokens, setShowInsufficientTokens] = useState(false);

  const modalRef = useRef(null);
  const firstFocusableRef = useRef(null);
  const lastFocusableRef = useRef(null);

  // Focus trap implementation
  useEffect(() => {
    if (isOpen && firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  const presetAmounts = [25, 50, 100, 250, 500];
  const actualAmount = isCustom ? parseInt(customAmount) || 0 : tipAmount;
  const hasEnoughTokens = tokenBalance >= actualAmount && actualAmount > 0;

  const handlePresetClick = (amount) => {
    setTipAmount(amount);
    setIsCustom(false);
    setCustomAmount('');
  };

  const handleCustomFocus = () => {
    setIsCustom(true);
  };

  const handleSendTip = async () => {
    // Check if user has enough tokens
    if (!hasEnoughTokens || actualAmount <= 0) {
      setShowInsufficientTokens(true);
      return;
    }

    setSending(true);
    try {
      // Simulate sending tip
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (onTipSent) {
        onTipSent(actualAmount);
      }

      toast.success(`Sent ${actualAmount} tokens to ${creator.username}!`, {
        icon: '💝',
        duration: 3000
      });

      onClose();
      setTipAmount(50);
      setCustomAmount('');
      setIsCustom(false);
      setShowInsufficientTokens(false);
    } catch (error) {
      toast.error('Failed to send tip');
    } finally {
      setSending(false);
    }
  };

  const safeTipAmount = (n) => Math.max(1, Math.min(1000000, n || 0));

  const adjustAmount = (delta) => {
    if (isCustom) {
      const current = parseInt(customAmount) || 0;
      const newAmount = safeTipAmount(current + delta);
      setCustomAmount(newAmount.toString());
    } else {
      const newAmount = safeTipAmount(tipAmount + delta);
      setTipAmount(newAmount);
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001]"
            onClick={onClose}
          />

          {/* Enhanced Modal with Message popup style */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 30 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed z-[10002]"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '420px',
              maxWidth: '90vw',
              paddingBottom: 'env(safe-area-inset-bottom)'
            }}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tip-title"
          >
            {/* Glass morphism container */}
            <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_70px_-15px_rgba(251,191,36,0.3)] border border-white/20 dark:border-gray-700/30 overflow-hidden">
              {/* Gradient accent top border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500"></div>

              {/* Floating orbs for ambiance */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl"></div>

              {/* Close button */}
              <button
                ref={lastFocusableRef}
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-xl transition-all hover:rotate-90 duration-200 z-10 group"
                aria-label="Close tip modal"
              >
                <XMarkIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              </button>

              {/* Body with padding */}
              <div className="p-6 relative">
                <h2 id="tip-title" className="sr-only">Send a tip to {creator.username}</h2>
                {/* Mini avatar and name at top */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="relative">
                    <img
                      src={creator.avatar || creator.profile_pic_url || `https://ui-avatars.com/api/?name=${creator.username}&background=FBBF24&color=fff`}
                      alt={creator.username}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-amber-500/30 cursor-pointer hover:ring-4 hover:ring-amber-500/50 transition-all"
                      width={32}
                      height={32}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/profile/${creator.username}`);
                        onClose();
                      }}
                    />
                    {creator.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Send tip to {creator.displayName || creator.display_name || creator.username}
                  </span>
                </div>

                {/* Preset amounts */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Quick amounts</p>
                  <div className="grid grid-cols-5 gap-2">
                    {presetAmounts.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handlePresetClick(amount)}
                        className={`py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                          !isCustom && tipAmount === amount
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {amount}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom amount input */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Custom amount</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustAmount(-10)}
                      className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <MinusIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <input
                      ref={firstFocusableRef}
                      type="number"
                      value={isCustom ? customAmount : tipAmount}
                      onChange={(e) => {
                        setIsCustom(true);
                        const val = safeTipAmount(parseInt(e.target.value) || 0);
                        setCustomAmount(val.toString());
                      }}
                      onFocus={handleCustomFocus}
                      placeholder="Enter amount"
                      className="flex-1 px-4 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-center text-lg font-semibold text-gray-900 dark:text-white bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all focus:bg-white dark:focus:bg-gray-800"
                      min="1"
                      max="1000000"
                      step="1"
                    />
                    <button
                      onClick={() => adjustAmount(10)}
                      className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <PlusIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Warning if insufficient tokens - only shown after clicking Send Tip */}
                {showInsufficientTokens && (
                  <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg mb-4">
                    <p className="font-medium">Insufficient tokens</p>
                    <p className="text-xs mt-1">You need {Math.max(0, actualAmount - tokenBalance)} more tokens to send this tip.</p>
                    <button
                      onClick={() => navigate('/tokens')}
                      className="mt-2 w-full px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-all"
                    >
                      Purchase Tokens
                    </button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendTip}
                    disabled={actualAmount <= 0 || isSending}
                    className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 relative overflow-hidden group ${
                      actualAmount > 0 && !isSending
                        ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-lg hover:shadow-xl hover:from-amber-700 hover:to-yellow-700 transform hover:-translate-y-0.5'
                        : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {/* Button shimmer animation on hover */}
                    {actualAmount > 0 && !isSending && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[length:200%_100%] group-hover:animate-shimmer"></div>
                    )}

                    <div className="relative flex items-center gap-2">
                      {isSending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <HeartIcon className="w-5 h-5" />
                          <span>Send Tip</span>
                        </>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default TipModal;