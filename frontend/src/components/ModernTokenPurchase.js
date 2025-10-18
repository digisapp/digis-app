import React, { useState, useEffect, useTransition, useOptimistic, useId } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import toast from 'react-hot-toast';
import { haptic, playSound, confetti } from '../utils/modernUI';
import { useAppStore } from '../stores/useAppStore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const TOKEN_PACKAGES = [
  { tokens: 500, price: 5.94, popular: false, gradient: 'from-blue-400 to-blue-600' },
  { tokens: 1000, price: 10.33, popular: false, gradient: 'from-purple-400 to-purple-600' },
  { tokens: 2000, price: 18.57, popular: true, gradient: 'from-pink-500 to-rose-500' },
  { tokens: 5000, price: 41.47, bonus: 0.05, popular: false, gradient: 'from-orange-400 to-red-500' },
  { tokens: 10000, price: 77.16, bonus: 0.05, popular: false, gradient: 'from-green-400 to-teal-500' },
  { tokens: 20000, price: 144.57, bonus: 0.05, popular: false, gradient: 'from-indigo-400 to-purple-500' },
  { tokens: 50000, price: 334.12, bonus: 0.05, popular: false, gradient: 'from-yellow-400 to-orange-500' },
  { tokens: 100000, price: 632.49, bonus: 0.05, popular: false, gradient: 'from-pink-400 to-purple-600' }
];

// Package Card with 3D tilt effect
const TokenPackageCard = ({ pkg, isSelected, onSelect, index }) => {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  
  // 3D tilt effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [10, -10]);
  const rotateY = useTransform(x, [-100, 100], [-10, 10]);
  
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) / 10);
    y.set((e.clientY - centerY) / 10);
  };
  
  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };
  
  const handleSelect = () => {
    haptic.light();
    playSound('click');
    onSelect(pkg);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      className="relative"
    >
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSelect}
        className={`
          relative w-full p-6 rounded-2xl
          ${isSelected ? 'ring-4 ring-purple-500 ring-offset-2' : ''}
          ${pkg.popular ? 'glass-colored shadow-xl' : 'glass-light shadow-lg'}
          hover:shadow-2xl transition-all duration-300
          overflow-hidden group
        `}
      >
        {/* Popular badge */}
        {pkg.popular && (
          <motion.div
            initial={{ rotate: -12 }}
            animate={{ rotate: [-12, -8, -12] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg"
          >
            MOST POPULAR
          </motion.div>
        )}
        
        {/* Background gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${pkg.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
        
        {/* Content */}
        <div className="relative z-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.1 + 0.2, type: "spring" }}
            className="text-4xl mb-2"
          >
            💎
          </motion.div>
          
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
            {pkg.tokens.toLocaleString()}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">tokens</p>
          
          {pkg.bonus && (
            <div className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium px-2 py-1 rounded-full mb-2">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9.5H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
              +{(pkg.bonus * 100).toFixed(0)}% bonus
            </div>
          )}
          
          <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            ${pkg.price}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            ${(pkg.price / pkg.tokens * 100).toFixed(2)} per 100
          </p>
        </div>
        
        {/* Selection indicator */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute top-2 left-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center"
            >
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
};

// Modern Checkout Form with optimistic updates
const ModernCheckoutForm = ({ user, selectedPackage, onSuccess, onClose }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const { tokenBalance, setTokenBalance, incrementTokens } = useAppStore();
  
  // Optimistic token balance
  const [optimisticBalance, setOptimisticBalance] = useOptimistic(
    tokenBalance,
    (state, newTokens) => state + newTokens
  );
  
  const [loading, setLoading] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const id = useId();

  // Purchase mutation with optimistic updates
  const purchaseMutation = useMutation({
    mutationFn: async (paymentData) => {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/tokens/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseToken}`,
        },
        body: JSON.stringify(paymentData),
      });
      
      if (!response.ok) throw new Error('Purchase failed');
      return response.json();
    },
    onMutate: async () => {
      // Optimistic update
      startTransition(() => {
        setOptimisticBalance(selectedPackage.tokens);
      });
      
      // Haptic feedback
      haptic.medium();
    },
    onSuccess: (data) => {
      // Play success sound and confetti
      playSound('coin');
      confetti({ y: 0.6 });
      
      // Update actual balance
      setTokenBalance(data.newBalance);
      
      // Invalidate queries
      queryClient.invalidateQueries(['tokenBalance']);
      
      // toast.success(
      //   <div className="flex items-center gap-2">
      //     <span className="text-2xl">🎉</span>
      //     <div>
      //       <p className="font-semibold">Purchase successful!</p>
      //       <p className="text-sm">{selectedPackage.tokens} tokens added</p>
      //     </div>
      //   </div>
      // );
      
      onSuccess();
    },
    onError: (error) => {
      haptic.error();
      playSound('error');
      toast.error(error.message || 'Purchase failed');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    
    try {
      const cardElement = elements.getElement(CardElement);
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          email: user.email,
          name: user.displayName || user.email,
        },
      });

      if (error) throw error;

      await purchaseMutation.mutateAsync({
        tokenAmount: selectedPackage.tokens,
        paymentMethodId: paymentMethod.id,
        savePaymentMethod: saveCard,
      });
    } catch (error) {
      console.error('Payment error:', error);
    } finally {
      setLoading(false);
    }
  };

  const isProcessing = loading || purchaseMutation.isPending;

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Current balance with optimistic update */}
      <div className="text-center p-4 rounded-xl glass-light">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Balance</p>
        <motion.p
          key={optimisticBalance}
          initial={{ scale: 1.2, color: '#10b981' }}
          animate={{ scale: 1, color: '#1f2937' }}
          className="text-3xl font-bold"
        >
          {optimisticBalance.toLocaleString()} tokens
        </motion.p>
        {isPending && (
          <p className="text-xs text-green-600 mt-1">
            +{selectedPackage.tokens.toLocaleString()} pending...
          </p>
        )}
      </div>

      {/* Selected package summary */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-lg">{selectedPackage.tokens.toLocaleString()} tokens</p>
            {selectedPackage.bonus && (
              <p className="text-sm text-green-600">+{(selectedPackage.bonus * 100)}% bonus included</p>
            )}
          </div>
          <p className="text-2xl font-bold">${selectedPackage.price}</p>
        </div>
      </div>

      {/* Card input with modern style */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Payment Details
        </label>
        <div className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus-within:border-purple-500 transition-colors">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </div>
      </div>

      {/* Save card option */}
      <label className="flex items-center gap-3 cursor-pointer group">
        <div className="relative">
          <input
            type="checkbox"
            checked={saveCard}
            onChange={(e) => setSaveCard(e.target.checked)}
            className="sr-only"
          />
          <div className={`
            w-5 h-5 rounded border-2 transition-all duration-200
            ${saveCard 
              ? 'bg-purple-500 border-purple-500' 
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 group-hover:border-purple-400'
            }
          `}>
            <AnimatePresence>
              {saveCard && (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="w-3 h-3 text-white absolute top-0.5 left-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </motion.svg>
              )}
            </AnimatePresence>
          </div>
        </div>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Save card for future purchases
        </span>
      </label>

      {/* Action buttons */}
      <div className="flex gap-3">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </motion.button>
        
        <motion.button
          type="submit"
          disabled={!stripe || isProcessing}
          whileHover={!isProcessing ? { scale: 1.02 } : {}}
          whileTap={!isProcessing ? { scale: 0.98 } : {}}
          className={`
            flex-1 px-6 py-3 rounded-xl font-medium text-white
            bg-gradient-to-r from-purple-600 to-pink-600
            hover:from-purple-700 hover:to-pink-700
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            relative overflow-hidden
          `}
        >
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-2"
              >
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </motion.div>
            ) : (
              <motion.span
                key="purchase"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Purchase ${selectedPackage.price}
              </motion.span>
            )}
          </AnimatePresence>
          
          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            initial={{ x: '-100%' }}
            animate={!isProcessing ? { x: '100%' } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.button>
      </div>
    </motion.form>
  );
};

// Main component with modern UI
const ModernTokenPurchase = ({ isOpen, onClose }) => {
  const [selectedPackage, setSelectedPackage] = useState(TOKEN_PACKAGES[2]); // Default to popular
  const { user } = useAppStore();
  const [showCheckout, setShowCheckout] = useState(false);

  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
  };

  const handlePurchaseClick = () => {
    haptic.medium();
    setShowCheckout(true);
  };

  const handleSuccess = () => {
    setShowCheckout(false);
    setTimeout(onClose, 1000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-6xl max-h-[90vh] overflow-auto rounded-3xl glass-light dark:glass-dark shadow-2xl scrollbar-hide"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 p-6 border-b border-gray-200 dark:border-gray-700 glass-light dark:glass-dark">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                    Purchase Tokens
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Select a package to continue
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>
            </div>

            <Elements stripe={stripePromise}>
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {!showCheckout ? (
                    <motion.div
                      key="packages"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      {/* Package grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {TOKEN_PACKAGES.map((pkg, index) => (
                          <TokenPackageCard
                            key={pkg.tokens}
                            pkg={pkg}
                            index={index}
                            isSelected={selectedPackage.tokens === pkg.tokens}
                            onSelect={handlePackageSelect}
                          />
                        ))}
                      </div>

                      {/* Continue button */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handlePurchaseClick}
                        className="w-full md:w-auto mx-auto block px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium text-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-xl"
                      >
                        Continue with {selectedPackage.tokens.toLocaleString()} tokens
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="checkout"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="max-w-md mx-auto"
                    >
                      <ModernCheckoutForm
                        user={user}
                        selectedPackage={selectedPackage}
                        onSuccess={handleSuccess}
                        onClose={() => setShowCheckout(false)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Elements>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ModernTokenPurchase;