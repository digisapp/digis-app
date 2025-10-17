import React, { useState, useEffect, useRef, memo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCardIcon,
  ShieldCheckIcon,
  StarIcon,
  XMarkIcon,
  CheckIcon,
  SparklesIcon,
  CurrencyDollarIcon,
  GiftIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import ErrorBoundary from './ui/ErrorBoundary';
import { getAuthToken } from '../utils/auth-helpers';
import { fetchWithRetry } from '../utils/fetchWithRetry';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Digis Token Packages - Optimized Pricing Tiers
const TOKEN_PACKAGES = [
  {
    id: 'starter',
    tokens: 50,
    price: 5.00,
    popular: false,
    savings: 0,
    perToken: 0.10
  },
  {
    id: 'basic',
    tokens: 200,
    price: 19.00,
    popular: false,
    savings: 5,
    perToken: 0.095
  },
  {
    id: 'popular',
    tokens: 433,
    price: 39.00,
    popular: false,
    savings: 10,
    perToken: 0.09
  },
  {
    id: 'value',
    tokens: 812,
    price: 69.00,
    popular: false,
    savings: 15,
    perToken: 0.085
  },
  {
    id: 'premium',
    tokens: 1488,
    price: 119.00,
    popular: false,
    savings: 20,
    perToken: 0.08
  },
  {
    id: 'vip',
    tokens: 4986,
    price: 349.00,
    popular: false,
    savings: 30,
    perToken: 0.07
  },
  {
    id: 'whale',
    tokens: 8446,
    price: 549.00,
    popular: false,
    savings: 35,
    perToken: 0.065
  }
];

const PAYMENT_METHODS = [
  { id: 'card', name: 'Credit/Debit Card', icon: CreditCardIcon },
  // Future: Apple Pay, Google Pay, etc.
];

const CheckoutForm = ({ 
  user, 
  selectedPackage, 
  onSuccess, 
  onClose, 
  isGift = false, 
  giftRecipient = null 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements || processing) return;

    setProcessing(true);
    setError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      
      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (stripeError) {
        setError(stripeError.message);
        setProcessing(false);
        return;
      }

      // Create payment intent with retry logic
      const response = await fetchWithRetry(
        `${import.meta.env.VITE_BACKEND_URL}/api/tokens/purchase`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getAuthToken()}`,
          },
          body: JSON.stringify({
            tokenAmount: selectedPackage.tokens,
            paymentMethodId: paymentMethod.id,
            isGift,
            giftRecipientId: giftRecipient?.uid,
          }),
        },
        3, // retries
        1000 // initial delay
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Payment failed. Please try again.');
      }

      const data = await response.json();
      
      if (data.success) {
        // Payment succeeded immediately
        onSuccess(selectedPackage.tokens);
        toast.success(`🎉 ${selectedPackage.tokens} tokens added successfully!`);
      } else if (data.paymentIntent) {
        // Handle 3D Secure or additional confirmation required
        if (data.paymentIntent.status === 'requires_action' || data.paymentIntent.status === 'requires_confirmation') {
          const { error: confirmError, paymentIntent: confirmedIntent } = await stripe.confirmCardPayment(
            data.paymentIntent.client_secret,
            {
              payment_method: paymentMethod.id,
            }
          );

          if (confirmError) {
            setError(confirmError.message);
          } else if (confirmedIntent.status === 'succeeded') {
            onSuccess(selectedPackage.tokens);
            toast.success(`🎉 ${selectedPackage.tokens} tokens added successfully!`);
          } else {
            setError('Payment confirmation failed. Please try again.');
          }
        } else if (data.paymentIntent.status === 'succeeded') {
          // Payment already succeeded
          onSuccess(selectedPackage.tokens);
          toast.success(`🎉 ${selectedPackage.tokens} tokens added successfully!`);
        }
      } else {
        throw new Error('Unexpected response from payment server.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1f2937',
        fontFamily: 'Inter, system-ui, sans-serif',
        '::placeholder': {
          color: '#9ca3af',
        },
      },
      invalid: {
        color: '#ef4444',
        iconColor: '#ef4444',
      },
    },
    hidePostalCode: true,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Package Summary */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              {selectedPackage.tokens.toLocaleString()} Tokens
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedPackage.value}
            </p>
            {selectedPackage.savings > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <SparklesIcon className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  Save {selectedPackage.savings}%
                </span>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${selectedPackage.price}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              ${(selectedPackage.price / selectedPackage.tokens).toFixed(3)} per token
            </div>
          </div>
        </div>
      </div>

      {/* Gift Message */}
      {isGift && (
        <div className="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-2xl p-4 border border-pink-200 dark:border-pink-800">
          <div className="flex items-center gap-2 text-pink-700 dark:text-pink-300">
            <GiftIcon className="w-5 h-5" />
            <span className="font-medium">
              Gifting to @{giftRecipient?.username || 'Unknown'}
            </span>
          </div>
        </div>
      )}

      {/* Payment Method */}
      <div className="space-y-4">
        <label htmlFor="card-element" className="block text-sm font-semibold text-gray-900 dark:text-white">
          Payment Information
        </label>
        
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border-2 border-gray-200 dark:border-gray-700 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
          <CardElement 
            id="card-element"
            options={cardElementOptions}
            data-onboarding="payment-form"
          />
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <ShieldCheckIcon className="w-4 h-4 text-green-500" />
          <span>Secured by Stripe • Your card details are never stored</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <motion.div 
          className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <XMarkIcon className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 pb-8">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          disabled={processing}
        >
          Cancel
        </button>
        
        <button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 min-h-[48px]"
        >
          {processing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCardIcon className="w-5 h-5" />
              Purchase ${selectedPackage.price}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

const ImprovedTokenPurchase = ({
  user,
  onSuccess,
  onClose,
  isModal = false,
  isGift = false,
  giftRecipient = null,
  initialPackage = null
}) => {
  // ✅ CRITICAL FIX: Declare ALL hooks BEFORE any conditional returns
  const [selectedPackage, setSelectedPackage] = useState(initialPackage || TOKEN_PACKAGES[1]); // Default to popular
  const [showCheckout, setShowCheckout] = useState(!!initialPackage);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef(null);

  // Focus management for modal
  useEffect(() => {
    if (isModal && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isModal]);

  // ✅ Prop validation AFTER all hooks (moved from top)
  if (!user?.id) {
    console.error('ImprovedTokenPurchase: Missing user data');
    toast.error('Please sign in to purchase tokens');
    return null;
  }

  if (isGift && !giftRecipient?.uid) {
    console.error('ImprovedTokenPurchase: Missing gift recipient');
    toast.error('Invalid gift recipient');
    return null;
  }

  if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    console.error('ImprovedTokenPurchase: Missing Stripe publishable key');
    toast.error('Payment configuration error. Please contact support.');
    return null;
  }

  if (!import.meta.env.VITE_BACKEND_URL) {
    console.error('ImprovedTokenPurchase: Missing backend URL');
    toast.error('Configuration error. Please contact support.');
    return null;
  }

  // Handle package selection
  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
    if (window.innerWidth < 768) {
      // Auto-proceed to checkout on mobile for better UX
      setShowCheckout(true);
    }
  };

  const PackageCard = memo(({ pkg, isSelected, onClick }) => (
    <motion.div
      onClick={() => onClick(pkg)}
      role="button"
      aria-label={`Select ${pkg.tokens} tokens for $${pkg.price}`}
      aria-pressed={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(pkg);
        }
      }}
      className={`
        relative cursor-pointer p-4 rounded-2xl border-2 transition-all duration-300
        ${isSelected 
          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-lg ring-2 ring-purple-500/20' 
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300 hover:shadow-md'
        }
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      data-onboarding="token-packages"
    >
      {/* Savings Badge */}
      {pkg.savings > 0 && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold">
            {pkg.savings}% Savings
          </div>
        </div>
      )}

      {/* Content */}
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {pkg.tokens.toLocaleString()}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Tokens
        </div>

        <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
          ${pkg.price}
        </div>
      </div>

      {/* Selection Indicator */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute top-3 left-3 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <CheckIcon className="w-4 h-4 text-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  ));
  
  PackageCard.displayName = 'PackageCard';

  if (showCheckout) {
    return (
      <ErrorBoundary variant="compact">
        <div className={isModal ? "bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full max-h-[75vh] overflow-y-auto" : "space-y-6"}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isGift ? `Gift ${selectedPackage.tokens} Tokens` : 'Purchase Tokens'}
            </h2>
            <button
              onClick={() => setShowCheckout(false)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center w-10 h-10"
              aria-label="Go back"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <Elements stripe={stripePromise}>
            <CheckoutForm
              user={user}
              selectedPackage={selectedPackage}
              onSuccess={onSuccess}
              onClose={onClose}
              isGift={isGift}
              giftRecipient={giftRecipient}
            />
          </Elements>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary variant="compact">
      <div 
        ref={modalRef}
        className={isModal ? "bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-2xl w-full max-h-[75vh] overflow-y-auto" : "space-y-6"}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-end mb-8">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center w-10 h-10"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>


        {/* Package Selection */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {TOKEN_PACKAGES.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              isSelected={selectedPackage.id === pkg.id}
              onClick={handlePackageSelect}
            />
          ))}
        </div>

        {/* Continue Button */}
        <div className="flex gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[48px]"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => setShowCheckout(true)}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center gap-2 min-h-[48px]"
          >
            Buy {selectedPackage.tokens} Tokens
          </button>
        </div>

      </div>
    </ErrorBoundary>
  );
};

export default ImprovedTokenPurchase;