import React, { useState, useEffect, useRef, memo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from './common/ConfirmDialog';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/supabase-auth-enhanced';
import digitalWalletService from '../utils/digitalWallets';
import { 
  useUser, 
  useTokenBalance, 
  useAuthActions 
} from '../stores/useHybridStore';
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

/**
 * Checkout form component - uses useState for form inputs
 */
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
  
  // Global state from Zustand
  const { updateTokenBalance } = useAuthActions();
  
  // Local UI state with useState
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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/tokens/purchase`, {
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
      
      // Update global token balance in Zustand store
      if (!isGift && purchaseResult.newBalance !== undefined) {
        updateTokenBalance(totalTokens);
      }
      
      if (isGift) {
        toast.success(`🎁 Gift of ${totalTokens} tokens sent to ${giftRecipient?.username || 'recipient'}!`);
      } else {
        toast.success(`✅ Successfully purchased ${totalTokens} tokens!${enableAutoRefill ? ' Auto-refill enabled.' : ''}`);
      }
      
      if (onSuccess) {
        onSuccess(totalTokens, { isGift, enableAutoRefill });
      }
      
      // Reset form
      cardElement.clear();
      onClose();
    } catch (error) {
      console.error('Payment error:', error);
      setError(error.message || 'Payment failed. Please try again.');
      toast.error(error.message || 'Payment failed');
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Token purchase form">
      {/* Gift mode indicator */}
      {isGift && giftRecipient && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            marginBottom: '20px',
            padding: '15px',
            border: '2px solid #ff69b4',
            borderRadius: '12px',
            backgroundColor: '#ffe4e1'
          }}
        >
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            marginBottom: '10px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#8b008b'
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
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Cancel
        </button>
      </div>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleSubmit}
        title="Confirm Large Purchase"
        message={`You're about to purchase ${selectedPackage.tokens} tokens for $${selectedPackage.price.toFixed(2)}. Would you like to proceed?`}
        type="warning"
        confirmText="Confirm Purchase"
      />
    </form>
  );
};

/**
 * Main TokenPurchase component with hybrid state management
 * Uses Zustand for token balance, useState for UI state
 */
const TokenPurchase = ({ user: propUser, onSuccess, onClose, isModal = false }) => {
  // Global state from Zustand
  const globalUser = useUser();
  const tokenBalance = useTokenBalance();
  const user = propUser || globalUser;
  
  // Local UI state with useState - all form inputs and UI toggles
  const [selectedPackage, setSelectedPackage] = useState(TOKEN_PACKAGES[2]); // Default to popular
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
  const [tokenPackages, setTokenPackages] = useState(TOKEN_PACKAGES);
  const [walletCapabilities, setWalletCapabilities] = useState(null);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const searchTimeoutRef = useRef(null);

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
          // Find the popular package or use the third one
          const popularPackage = data.packages?.find(p => p.popular) || data.packages?.[2] || TOKEN_PACKAGES[2];
          setSelectedPackage(popularPackage);
        }
      } catch (error) {
        console.error('Error fetching token packages:', error);
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
        `${import.meta.env.VITE_BACKEND_URL}/users/search?q=${encodeURIComponent(query)}`,
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

  const containerStyle = isModal ? {
    padding: '30px',
    maxWidth: '600px',
    margin: '0 auto'
  } : {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto'
  };

  if (stripeError) {
    return (
      <div style={containerStyle}>
        <div style={{ 
          textAlign: 'center',
          padding: '40px',
          color: '#dc3545'
        }}>
          <h3>⚠️ Payment System Error</h3>
          <p>{stripeError}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header with balance */}
      <div style={{ 
        marginBottom: '30px',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '10px' }}>💰 Purchase Tokens</h2>
        <p style={{ color: '#666' }}>
          Current Balance: <strong>{tokenBalance.toLocaleString()} tokens</strong>
        </p>
      </div>

      {/* Mode Tabs */}
      <div style={{ 
        display: 'flex',
        gap: '10px',
        marginBottom: '25px',
        borderBottom: '2px solid #e1e5e9',
        paddingBottom: '10px'
      }}>
        {['purchase', 'gift', 'auto-refill'].map((tabMode) => (
          <button
            key={tabMode}
            onClick={() => setMode(tabMode)}
            style={{
              padding: '10px 20px',
              backgroundColor: mode === tabMode ? '#007bff' : 'transparent',
              color: mode === tabMode ? 'white' : '#666',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              fontWeight: mode === tabMode ? '600' : '400',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'capitalize'
            }}
          >
            {tabMode === 'purchase' && '🛒 '}
            {tabMode === 'gift' && '🎁 '}
            {tabMode === 'auto-refill' && '🔄 '}
            {tabMode.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Package Selection */}
      {!packagesLoading && (
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ marginBottom: '15px', fontSize: '18px' }}>
            Select Package
          </h3>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px'
          }}>
            {tokenPackages.map((pkg) => (
              <motion.button
                key={pkg.tokens}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedPackage(pkg)}
                style={{
                  padding: '15px',
                  border: selectedPackage.tokens === pkg.tokens ? '3px solid #007bff' : '2px solid #e1e5e9',
                  borderRadius: '12px',
                  backgroundColor: selectedPackage.tokens === pkg.tokens ? '#e6f2ff' : 'white',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s'
                }}
              >
                {pkg.popular && (
                  <span style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '10px',
                    backgroundColor: '#ff69b4',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: '600'
                  }}>
                    POPULAR
                  </span>
                )}
                <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>
                  {pkg.tokens.toLocaleString()}
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>tokens</div>
                {pkg.bonus && (
                  <div style={{ fontSize: '12px', color: '#28a745', marginTop: '5px' }}>
                    +{Math.floor(pkg.tokens * pkg.bonus)} bonus
                  </div>
                )}
                <div style={{ fontSize: '16px', fontWeight: '600', marginTop: '8px', color: '#007bff' }}>
                  ${pkg.price.toFixed(2)}
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Gift Mode Controls */}
      {mode === 'gift' && (
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ marginBottom: '15px' }}>Gift Details</h3>
          {!giftRecipient ? (
            <div>
              <input
                type="text"
                placeholder="Search for user to gift tokens..."
                onChange={(e) => handleSearchInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #e1e5e9',
                  marginBottom: '10px'
                }}
              />
              {searchLoading && <div>Searching...</div>}
              {searchResults.length > 0 && (
                <div style={{ 
                  border: '1px solid #e1e5e9',
                  borderRadius: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => selectGiftRecipient(user)}
                      style={{
                        padding: '10px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f0f0f0',
                        ':hover': { backgroundColor: '#f8f9fa' }
                      }}
                    >
                      <strong>{user.username}</strong>
                      {user.displayName && <span> ({user.displayName})</span>}
                    </div>
                  ))}
                </div>
              )}
              <textarea
                placeholder="Add a gift message (optional)"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #e1e5e9',
                  marginTop: '10px',
                  minHeight: '80px'
                }}
              />
            </div>
          ) : (
            <div style={{
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px'
            }}>
              <div>Gifting to: <strong>{giftRecipient.username}</strong></div>
              {giftMessage && <div style={{ marginTop: '10px', fontStyle: 'italic' }}>"{giftMessage}"</div>}
              <button
                onClick={resetGiftMode}
                style={{
                  marginTop: '10px',
                  padding: '5px 10px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Change Recipient
              </button>
            </div>
          )}
        </div>
      )}

      {/* Auto-refill Settings */}
      {mode === 'auto-refill' && (
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ marginBottom: '15px' }}>Auto-refill Settings</h3>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Refill when balance drops below:
            </label>
            <select
              value={autoRefillThreshold}
              onChange={(e) => setAutoRefillThreshold(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #e1e5e9'
              }}
            >
              {AUTO_REFILL_THRESHOLDS.map((threshold) => (
                <option key={threshold.value} value={threshold.value}>
                  {threshold.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Amount to refill:
            </label>
            <select
              value={autoRefillAmount}
              onChange={(e) => setAutoRefillAmount(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #e1e5e9'
              }}
            >
              {tokenPackages.map((pkg) => (
                <option key={pkg.tokens} value={pkg.tokens}>
                  {pkg.tokens} tokens (${pkg.price.toFixed(2)})
                </option>
              ))}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={enableAutoRefill}
              onChange={(e) => setEnableAutoRefill(e.target.checked)}
            />
            Enable auto-refill
          </label>
        </div>
      )}

      {/* Stripe Checkout */}
      <Elements stripe={stripePromise}>
        <CheckoutForm
          user={user}
          selectedPackage={selectedPackage}
          onSuccess={onSuccess}
          onClose={onClose}
          isGift={mode === 'gift'}
          giftRecipient={giftRecipient}
          enableAutoRefill={mode === 'auto-refill' && enableAutoRefill}
          autoRefillThreshold={autoRefillThreshold}
          autoRefillAmount={autoRefillAmount}
        />
      </Elements>

      {/* Digital Wallet Options */}
      {walletCapabilities && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <div style={{ color: '#666', marginBottom: '10px' }}>Or pay with:</div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {walletCapabilities.applePayAvailable && (
              <button
                onClick={() => toast.info('Apple Pay coming soon!')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#000',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                🍎 Apple Pay
              </button>
            )}
            {walletCapabilities.googlePayAvailable && (
              <button
                onClick={() => toast.info('Google Pay coming soon!')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#4285f4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                Google Pay
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

TokenPurchase.propTypes = {
  user: PropTypes.object,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func,
  isModal: PropTypes.bool
};

export default memo(TokenPurchase);