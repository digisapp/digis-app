import React, { useState, useEffect, useRef, memo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from './common/ConfirmDialog';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/supabase-auth-enhanced';
import digitalWalletService from '../utils/digitalWallets';

import { ENV } from '../config/env';

const stripePromise = loadStripe(ENV.STRIPE_PUBLISHABLE_KEY);

const TOKEN_PACKAGES = [
  { tokens: 500, price: 5.94, popular: false },
  { tokens: 1000, price: 10.33, popular: false },
  { tokens: 2000, price: 18.57, popular: true }, // Most popular
  { tokens: 5000, price: 41.47, bonus: 0.05, popular: false },
  { tokens: 10000, price: 77.16, bonus: 0.05, popular: false },
  { tokens: 20000, price: 144.57, bonus: 0.05, popular: false },
  { tokens: 50000, price: 334.12, bonus: 0.05, popular: false },
  { tokens: 100000, price: 632.49, bonus: 0.05, popular: false }
];

const AUTO_REFILL_THRESHOLDS = [
  { value: 100, label: '100 tokens' },
  { value: 250, label: '250 tokens' },
  { value: 500, label: '500 tokens' },
  { value: 1000, label: '1000 tokens' }
];

const QUICK_GIFT_AMOUNTS = [
  { tokens: 50, price: 2.50, emoji: '🎁' },
  { tokens: 100, price: 4.99, emoji: '💝' },
  { tokens: 250, price: 12.47, emoji: '🎉' },
  { tokens: 500, price: 24.95, emoji: '👑' }
];

const CheckoutForm = ({ 
  user, 
  selectedPackage, 
  onSuccess, 
  onClose, 
  isGift = false, 
  giftRecipient = null,
  enableAutoRefill = false,
  autoRefillThreshold = 100,
  autoRefillAmount = 1000
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      console.error('Stripe not loaded');
      toast.error('Payment system not loaded');
      return;
    }

    if (!user) {
      toast.error('Please log in to purchase tokens');
      return;
    }

    // Show confirmation dialog for large purchases
    if (selectedPackage.price > 100 && !showConfirmDialog) {
      setShowConfirmDialog(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          email: user.email,
          name: user.displayName || user.email,
        },
      });

      if (pmError) {
        throw new Error(pmError.message);
      }

      console.log('💳 Payment method created:', paymentMethod.id);

      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tokens/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          tokenAmount: selectedPackage.tokens,
          paymentMethodId: paymentMethod.id,
          isGift,
          giftRecipient: giftRecipient?.id || null,
          giftMessage: giftRecipient?.message || null,
          enableAutoRefill,
          autoRefillThreshold,
          autoRefillAmount,
          savePaymentMethod: savePaymentMethod || enableAutoRefill
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Purchase failed');
      }

      const purchaseResult = await response.json();
      console.log('✅ Purchase successful:', purchaseResult);

      if (purchaseResult.paymentIntent && purchaseResult.paymentIntent.client_secret) {
        const { error: confirmError } = await stripe.confirmCardPayment(
          purchaseResult.paymentIntent.client_secret
        );

        if (confirmError) {
          throw new Error(confirmError.message);
        }
      }

      const totalTokens = selectedPackage.tokens + (selectedPackage.bonus ? Math.floor(selectedPackage.tokens * selectedPackage.bonus) : 0);
      
      if (isGift) {
        toast.success(`🎁 Gift of ${totalTokens} tokens sent to ${giftRecipient?.username || 'recipient'}!`);
      } else {
        toast.success(`✅ Successfully purchased ${totalTokens} tokens!${enableAutoRefill ? ' Auto-refill enabled.' : ''}`);
      }
      
      if (onSuccess) {
        onSuccess(totalTokens, { isGift, enableAutoRefill });
      }

      cardElement.clear();
      onClose();
    } catch (err) {
      console.error('❌ Purchase error:', err);
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }} role="form" aria-label="Token purchase form">
      {/* Gift Info */}
      {isGift && giftRecipient && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            marginBottom: '20px',
            padding: '15px',
            border: '2px solid #ffc107',
            borderRadius: '12px',
            backgroundColor: '#fff8e1'
          }}
        >
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            marginBottom: '10px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#f57c00'
          }}>
            🎁 Sending Gift to {giftRecipient.username}
          </div>
          {giftRecipient.message && (
            <div style={{ 
              fontSize: '14px',
              color: '#666',
              fontStyle: 'italic'
            }}>
              "{giftRecipient.message}"
            </div>
          )}
        </motion.div>
      )}

      {/* Auto-refill Info */}
      {enableAutoRefill && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            marginBottom: '20px',
            padding: '15px',
            border: '2px solid #17a2b8',
            borderRadius: '12px',
            backgroundColor: '#e1f7ff'
          }}
        >
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            marginBottom: '10px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#0c5460'
          }}>
            🔄 Auto-refill Enabled
          </div>
          <div style={{ 
            fontSize: '14px',
            color: '#666'
          }}>
            When your balance drops to {autoRefillThreshold} tokens, we'll automatically purchase {autoRefillAmount} more tokens using your saved payment method.
          </div>
        </motion.div>
      )}

      <div style={{ 
        marginBottom: '20px',
        padding: '15px',
        border: '1px solid #e1e5e9',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ 
          marginBottom: '10px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#333'
        }}>
          💳 Payment Details
          <span style={{ marginLeft: '10px', color: '#666' }}>
            ({selectedPackage.tokens} tokens for ${selectedPackage.price.toFixed(2)}
            {selectedPackage.bonus ? ` + ${Math.floor(selectedPackage.tokens * selectedPackage.bonus)} bonus tokens` : ''})
          </span>
        </div>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
                iconColor: '#666EE8',
              },
              invalid: {
                color: '#9e2146',
              },
            },
            hidePostalCode: false,
          }}
        />
      </div>

      {/* Save Payment Method */}
      {!isGift && !enableAutoRefill && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#333'
          }}>
            <input 
              type="checkbox"
              checked={savePaymentMethod}
              onChange={(e) => setSavePaymentMethod(e.target.checked)}
              style={{ margin: 0 }}
            />
            💾 Save payment method for future purchases
          </label>
        </div>
      )}

      {error && (
        <div style={{ 
          color: '#721c24',
          backgroundColor: '#f8d7da',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px',
          fontSize: '14px',
          border: '1px solid #f5c6cb'
        }} role="alert">
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="submit"
          disabled={!stripe || loading}
          style={{
            flex: 1,
            padding: '12px 20px',
            backgroundColor: loading ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
          aria-label={`Pay $${selectedPackage.price.toFixed(2)} for ${selectedPackage.tokens} tokens`}
        >
          {loading ? (
            <>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #ffffff',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                display: 'inline-block',
                marginRight: '8px'
              }}></div>
              Processing...
            </>
          ) : (
            `💰 Pay $${selectedPackage.price.toFixed(2)}`
          )}
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: '12px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
          aria-label="Cancel purchase"
        >
          Cancel
        </button>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Confirm Dialog for large purchases */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => {
          setShowConfirmDialog(false);
          handleSubmit(new Event('submit'));
        }}
        title="Confirm Large Purchase"
        message={`You are about to purchase ${selectedPackage.tokens} tokens for $${selectedPackage.price.toFixed(2)}. This is a large purchase. Are you sure you want to continue?`}
        type="warning"
        confirmText="Confirm Purchase"
      />
    </form>
  );
};

const TokenPurchase = ({ user, onSuccess, onClose, isModal = false }) => {
  const [selectedPackage, setSelectedPackage] = useState(TOKEN_PACKAGES[0]);
  const [stripeError, setStripeError] = useState(null);
  const [mode, setMode] = useState('purchase'); // 'purchase', 'gift', 'auto-refill'
  const [giftRecipient, setGiftRecipient] = useState(null);
  const [giftMessage, setGiftMessage] = useState('');
  const [showGiftSearch, setShowGiftSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [enableAutoRefill, setEnableAutoRefill] = useState(false);
  const [autoRefillThreshold, setAutoRefillThreshold] = useState(100);
  const [autoRefillAmount, setAutoRefillAmount] = useState(1000);
  const searchTimeoutRef = useRef(null);
  const [tokenPackages, setTokenPackages] = useState(TOKEN_PACKAGES);
  const [walletCapabilities, setWalletCapabilities] = useState(null);
  const [packagesLoading, setPackagesLoading] = useState(true);

  // Fetch dynamic token packages
  useEffect(() => {
    const fetchTokenPackages = async () => {
      try {
        const authToken = await getAuthToken();
        const response = await fetch(`${ENV.BACKEND_URL}/api/tokens/packages`, {
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        });
        if (response.ok) {
          const data = await response.json();
          setTokenPackages(data.packages || TOKEN_PACKAGES);
          // Update selected package to first from fetched packages
          setSelectedPackage(data.packages?.[0] || TOKEN_PACKAGES[0]);
        }
      } catch (error) {
        console.error('Error fetching token packages:', error);
        // Fall back to hardcoded packages
      } finally {
        setPackagesLoading(false);
      }
    };
    fetchTokenPackages();
  }, []);

  // Initialize digital wallet service
  useEffect(() => {
    digitalWalletService.initialize().then(() => {
      setWalletCapabilities(digitalWalletService.getDeviceCapabilities());
    });
  }, []);

  useEffect(() => {
    stripePromise
      .then((stripe) => {
        if (!stripe) {
          setStripeError('Failed to load Stripe');
        } else {
          console.log('✅ Stripe loaded successfully');
        }
      })
      .catch((error) => {
        console.error('❌ Stripe loading error:', error);
        setStripeError('Failed to initialize payment system');
      });
  }, []);

  const searchUsers = async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/search?q=${encodeURIComponent(query)}`,
        {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchInput = (query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(query);
    }, 300);
  };

  const selectGiftRecipient = (recipient) => {
    setGiftRecipient({ ...recipient, message: giftMessage });
    setShowGiftSearch(false);
    setSearchResults([]);
  };

  const resetGiftMode = () => {
    setGiftRecipient(null);
    setGiftMessage('');
    setShowGiftSearch(false);
    setSearchResults([]);
    setMode('purchase');
  };

  const handleApplePay = async () => {
    if (!walletCapabilities?.applePayAvailable) {
      toast.error('Apple Pay is not available on this device');
      return;
    }

    try {
      await digitalWalletService.processApplePayment({
        amount: selectedPackage.price,
        items: [{
          label: `${selectedPackage.tokens} Tokens${selectedPackage.bonus ? ` (+${Math.floor(selectedPackage.tokens * selectedPackage.bonus)} bonus)` : ''}`,
          amount: selectedPackage.price
        }],
        onValidateMerchant: async (validationURL) => {
          const authToken = await getAuthToken();
          const response = await fetch(`${ENV.BACKEND_URL}/api/payments/apple-pay/validate`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ validationURL })
          });
          return response.json();
        },
        onPaymentAuthorized: async (payment) => {
          const authToken = await getAuthToken();
          const response = await fetch(`${ENV.BACKEND_URL}/api/tokens/purchase`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              tokenAmount: selectedPackage.tokens,
              paymentMethodId: payment.token.paymentMethod.network,
              applePayToken: payment.token,
              isGift: mode === 'gift' && giftRecipient,
              giftRecipient: giftRecipient?.id || null,
              giftMessage: giftRecipient?.message || null,
              enableAutoRefill,
              autoRefillThreshold,
              autoRefillAmount,
              savePaymentMethod: false
            })
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Purchase failed');
          }
          
          const result = await response.json();
          const totalTokens = selectedPackage.tokens + (selectedPackage.bonus ? Math.floor(selectedPackage.tokens * selectedPackage.bonus) : 0);
          
          if (mode === 'gift') {
            toast.success(`🎁 Gift of ${totalTokens} tokens sent to ${giftRecipient?.username || 'recipient'}!`);
          } else {
            toast.success(`✅ Successfully purchased ${totalTokens} tokens!${enableAutoRefill ? ' Auto-refill enabled.' : ''}`);
          }
          
          if (onSuccess) {
            onSuccess(totalTokens, { isGift: mode === 'gift', enableAutoRefill });
          }
          
          onClose();
          return result;
        },
        onCancel: () => {
          console.log('Apple Pay cancelled');
        },
        onError: (error) => {
          console.error('Apple Pay error:', error);
          toast.error(error.message || 'Apple Pay payment failed');
        }
      });
    } catch (error) {
      console.error('Apple Pay error:', error);
      toast.error('Apple Pay payment failed');
    }
  };

  const handleGooglePay = async () => {
    if (!walletCapabilities?.googlePayAvailable) {
      toast.error('Google Pay is not available on this device');
      return;
    }

    try {
      await digitalWalletService.processGooglePayment({
        amount: selectedPackage.price,
        items: [{
          label: `${selectedPackage.tokens} Tokens`,
          price: selectedPackage.price.toFixed(2)
        }],
        onPaymentAuthorized: async (paymentData) => {
          const authToken = await getAuthToken();
          const response = await fetch(`${ENV.BACKEND_URL}/api/tokens/purchase`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              tokenAmount: selectedPackage.tokens,
              paymentMethodId: paymentData.paymentMethodData.tokenizationData.token,
              googlePayToken: paymentData,
              isGift: mode === 'gift' && giftRecipient,
              giftRecipient: giftRecipient?.id || null,
              giftMessage: giftRecipient?.message || null,
              enableAutoRefill,
              autoRefillThreshold,
              autoRefillAmount,
              savePaymentMethod: false
            })
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Purchase failed');
          }
          
          const result = await response.json();
          const totalTokens = selectedPackage.tokens + (selectedPackage.bonus ? Math.floor(selectedPackage.tokens * selectedPackage.bonus) : 0);
          
          if (mode === 'gift') {
            toast.success(`🎁 Gift of ${totalTokens} tokens sent to ${giftRecipient?.username || 'recipient'}!`);
          } else {
            toast.success(`✅ Successfully purchased ${totalTokens} tokens!${enableAutoRefill ? ' Auto-refill enabled.' : ''}`);
          }
          
          if (onSuccess) {
            onSuccess(totalTokens, { isGift: mode === 'gift', enableAutoRefill });
          }
          
          onClose();
          return result;
        },
        onError: (error) => {
          console.error('Google Pay error:', error);
          toast.error(error.message || 'Google Pay payment failed');
        }
      });
    } catch (error) {
      console.error('Google Pay error:', error);
      toast.error('Google Pay payment failed');
    }
  };

  if (stripeError) {
    return (
      <div style={{ 
        color: '#721c24',
        backgroundColor: '#f8d7da',
        padding: '15px',
        borderRadius: '8px',
        border: '1px solid #f5c6cb',
        textAlign: 'center'
      }} role="alert">
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
        <div>Payment system unavailable</div>
        <div style={{ fontSize: '14px', marginTop: '5px' }}>{stripeError}</div>
      </div>
    );
  }

  return (
    <div style={{ 
      border: '1px solid #e9ecef',
      borderRadius: '12px',
      padding: '25px',
      backgroundColor: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      maxWidth: isModal ? '500px' : '700px',
      margin: isModal ? 'auto' : '0 auto 20px',
      position: isModal ? 'relative' : 'static'
    }} role="dialog" aria-label="Token purchase dialog">
      {/* Header with Mode Selection */}
      <div style={{ 
        marginBottom: '25px',
        textAlign: 'center'
      }}>
        <h3 style={{ 
          margin: '0 0 15px 0',
          color: '#333',
          fontSize: '20px'
        }}>
          💎 Token Store
        </h3>
        
        {/* Mode Tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '15px'
        }}>
          {[
            { key: 'purchase', label: '💰 Buy Tokens', desc: 'Purchase tokens for yourself' },
            { key: 'gift', label: '🎁 Send Gift', desc: 'Gift tokens to someone' },
            { key: 'auto-refill', label: '🔄 Auto-refill', desc: 'Set up automatic purchases' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setMode(tab.key);
                if (tab.key === 'gift') {
                  setShowGiftSearch(true);
                } else if (tab.key === 'auto-refill') {
                  setEnableAutoRefill(true);
                } else {
                  resetGiftMode();
                  setEnableAutoRefill(false);
                }
              }}
              style={{
                flex: 1,
                padding: '10px 8px',
                backgroundColor: mode === tab.key ? '#007bff' : 'transparent',
                color: mode === tab.key ? 'white' : '#666',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title={tab.desc}
              aria-label={tab.desc}
              aria-pressed={mode === tab.key}
              role="tab"
              aria-selected={mode === tab.key}
              onKeyDown={(e) => e.key === 'Enter' && setMode(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <p style={{ 
          margin: '0',
          color: '#666',
          fontSize: '14px'
        }}>
          {mode === 'purchase' ? 'Tip big, save more! Tokens never expire.' :
           mode === 'gift' ? 'Send tokens as a gift to friends and creators.' :
           'Never run out of tokens with automatic refills.'}
        </p>
      </div>

      {/* Gift User Search */}
      <AnimatePresence>
        {mode === 'gift' && showGiftSearch && !giftRecipient && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: '20px' }}
          >
            <div style={{
              padding: '20px',
              border: '2px dashed #ffc107',
              borderRadius: '12px',
              backgroundColor: '#fff8e1'
            }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#f57c00' }}>
                🔍 Find Gift Recipient
              </h4>
              
              <input
                type="text"
                placeholder="Search by username or email..."
                onChange={(e) => handleSearchInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e1e5e9',
                  borderRadius: '8px',
                  fontSize: '14px',
                  marginBottom: '10px'
                }}
                aria-label="Search for gift recipient"
                aria-describedby="search-results-status"
              />
              
              <textarea
                placeholder="Optional gift message..."
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                maxLength={200}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e1e5e9',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical',
                  marginBottom: '15px'
                }}
              />
              
              {/* Search Results */}
              {searchLoading && (
                <div style={{ textAlign: 'center', color: '#666' }} id="search-results-status" role="status" aria-live="polite">
                  Searching...
                </div>
              )}
              
              {searchResults.length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {searchResults.map(user => (
                    <button
                      key={user.id}
                      onClick={() => selectGiftRecipient(user)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        margin: '5px 0',
                        backgroundColor: '#fff',
                        border: '1px solid #e1e5e9',
                        borderRadius: '8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                      aria-label={`Select ${user.username} as gift recipient`}
                      onKeyDown={(e) => e.key === 'Enter' && selectGiftRecipient(user)}
                    >
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        👤
                      </div>
                      <div>
                        <div style={{ fontWeight: '500' }}>{user.username}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>{user.displayName}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-refill Settings */}
      <AnimatePresence>
        {mode === 'auto-refill' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: '20px' }}
          >
            <div style={{
              padding: '20px',
              border: '2px solid #17a2b8',
              borderRadius: '12px',
              backgroundColor: '#e1f7ff'
            }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#0c5460' }}>
                🔄 Auto-refill Settings
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Trigger at:
                  </label>
                  <select
                    value={autoRefillThreshold}
                    onChange={(e) => setAutoRefillThreshold(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e1e5e9',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    aria-label="Auto-refill trigger threshold"
                  >
                    {AUTO_REFILL_THRESHOLDS.map(threshold => (
                      <option key={threshold.value} value={threshold.value}>
                        {threshold.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Purchase amount:
                  </label>
                  <select
                    value={autoRefillAmount}
                    onChange={(e) => setAutoRefillAmount(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e1e5e9',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    aria-label="Auto-refill purchase amount"
                  >
                    {TOKEN_PACKAGES.slice(1, 5).map(pkg => (
                      <option key={pkg.tokens} value={pkg.tokens}>
                        {pkg.tokens} tokens (${pkg.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div style={{ 
                marginTop: '15px',
                padding: '10px',
                backgroundColor: '#fff',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#666'
              }}>
                💡 When your balance drops to {autoRefillThreshold} tokens, we'll automatically purchase {autoRefillAmount} more tokens.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Gift Options */}
      {mode === 'gift' && !showGiftSearch && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '20px' }}
        >
          <h4 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>🎁 Quick Gift Options</h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '10px',
            marginBottom: '15px'
          }}>
            {QUICK_GIFT_AMOUNTS.map(gift => (
              <button
                key={gift.tokens}
                onClick={() => setSelectedPackage({ 
                  tokens: gift.tokens, 
                  price: gift.price, 
                  popular: false, 
                  bonus: 0 
                })}
                style={{
                  padding: '15px 10px',
                  backgroundColor: selectedPackage.tokens === gift.tokens ? '#ffc107' : '#fff8e1',
                  color: '#f57c00',
                  border: '2px solid #ffc107',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textAlign: 'center',
                  fontWeight: '600'
                }}
                aria-label={`Select ${gift.tokens} token gift for $${gift.price.toFixed(2)}`}
                aria-pressed={selectedPackage.tokens === gift.tokens}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedPackage({ tokens: gift.tokens, price: gift.price, popular: false, bonus: 0 })}
              >
                <div style={{ fontSize: '20px', marginBottom: '5px' }}>{gift.emoji}</div>
                {gift.tokens} tokens
                <br />
                ${gift.price.toFixed(2)}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Token Package Selection */}
      {mode === 'purchase' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          marginBottom: '25px'
        }}>
          {tokenPackages.map(pkg => (
            <motion.button
              key={pkg.tokens}
              onClick={() => setSelectedPackage(pkg)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                position: 'relative',
                padding: '15px 10px',
                backgroundColor: selectedPackage.tokens === pkg.tokens ? '#007bff' : '#f8f9fa',
                color: selectedPackage.tokens === pkg.tokens ? 'white' : '#333',
                border: pkg.popular ? '2px solid #ffc107' : '1px solid #dee2e6',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '13px',
                textAlign: 'center',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              aria-label={`Select ${pkg.tokens} token package for $${pkg.price.toFixed(2)}`}
            >
              {pkg.popular && (
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: '#ffc107',
                  color: '#000',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  POPULAR
                </div>
              )}
              
              <div style={{ fontSize: '16px', marginBottom: '5px' }}>
                {pkg.tokens.toLocaleString()} 💎
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                ${pkg.price.toFixed(2)}
              </div>
              {pkg.bonus && (
                <div style={{ fontSize: '11px', marginTop: '5px', opacity: 0.8 }}>
                  +{Math.floor(pkg.tokens * pkg.bonus).toLocaleString()} bonus
                </div>
              )}
            </motion.button>
          ))}
        </div>
      )}

      {/* Digital Wallet Options */}
      {(walletCapabilities?.applePayAvailable || walletCapabilities?.googlePayAvailable) && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '15px',
            fontSize: '14px',
            color: '#666'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '10px'
            }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }}></div>
              <span>Express checkout</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }}></div>
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: '10px',
            marginBottom: '15px'
          }}>
            {walletCapabilities?.applePayAvailable && (
              <motion.button
                onClick={handleApplePay}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  backgroundColor: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                aria-label="Pay with Apple Pay"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z"/>
                </svg>
                Apple Pay
              </motion.button>
            )}
            
            {walletCapabilities?.googlePayAvailable && (
              <motion.button
                onClick={handleGooglePay}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  backgroundColor: '#fff',
                  color: '#3c4043',
                  border: '1px solid #dadce0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                aria-label="Pay with Google Pay"
              >
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
                  <path fill="#34A853" d="M3.964 7.885A11.22 11.22 0 0 0 2.306 12c0 1.485.289 2.904 1.658 4.115l3.976-3.204c-.527-.79-.79-1.751-.79-2.91s.263-2.121.79-2.911L3.964 7.885z"/>
                  <path fill="#FBBC05" d="M12.48 4.639c1.487 0 2.813.511 3.87 1.516l2.907-2.907C17.393 1.44 15.194 0 12.48 0 7.786 0 3.682 2.808 1.658 6.885l3.976 3.204c.944-2.825 3.623-5.45 6.846-5.45z"/>
                  <path fill="#EA4335" d="M12.48 23.693c-2.584 0-4.828-1.068-6.471-2.824l-3.976 3.204C4.014 27.538 7.934 30 12.48 30c3.47 0 6.377-1.147 8.533-3.12 1.88-1.84 3.016-4.48 3.307-7.68h-11.84v4.533h7.062c-.384 2.036-1.52 3.54-2.692 4.64-1.12 1.053-2.693 1.32-4.37 1.32z"/>
                </svg>
                Google Pay
              </motion.button>
            )}
          </div>
          
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '15px',
            fontSize: '14px',
            color: '#666'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '10px'
            }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }}></div>
              <span>Or pay with card</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }}></div>
            </div>
          </div>
        </div>
      )}

      <Elements stripe={stripePromise}>
        <CheckoutForm
          user={user}
          selectedPackage={selectedPackage}
          onSuccess={onSuccess}
          onClose={onClose}
          isGift={mode === 'gift' && giftRecipient}
          giftRecipient={giftRecipient}
          enableAutoRefill={mode === 'auto-refill'}
          autoRefillThreshold={autoRefillThreshold}
          autoRefillAmount={autoRefillAmount}
        />
      </Elements>
    </div>
  );
};

CheckoutForm.propTypes = {
  user: PropTypes.object.isRequired,
  selectedPackage: PropTypes.shape({
    tokens: PropTypes.number.isRequired,
    price: PropTypes.number.isRequired,
    popular: PropTypes.bool,
    bonus: PropTypes.number
  }).isRequired,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func.isRequired,
  isGift: PropTypes.bool,
  giftRecipient: PropTypes.object,
  enableAutoRefill: PropTypes.bool,
  autoRefillThreshold: PropTypes.number,
  autoRefillAmount: PropTypes.number
};

CheckoutForm.defaultProps = {
  isGift: false,
  giftRecipient: null,
  enableAutoRefill: false,
  autoRefillThreshold: 100,
  autoRefillAmount: 1000
};

TokenPurchase.propTypes = {
  user: PropTypes.object.isRequired,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func.isRequired,
  isModal: PropTypes.bool
};

TokenPurchase.defaultProps = {
  isModal: false
};

export default memo(TokenPurchase);