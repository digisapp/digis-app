import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import toast from 'react-hot-toast';
import { 
  XMarkIcon, 
  CreditCardIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../utils/supabase';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const QUICK_BUY_PACKAGES = [
  { tokens: 100, price: 4.99, emoji: '⚡', label: 'Quick' },
  { tokens: 500, price: 19.99, emoji: '💎', label: 'Value' },
  { tokens: 1000, price: 34.99, emoji: '🚀', label: 'Power' }
];

const QuickCheckoutForm = ({ user, selectedPackage, onSuccess, onClose }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);

  useEffect(() => {
    loadSavedPaymentMethods();
  }, []);

  const loadSavedPaymentMethods = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tokens/payment-methods`, {
        headers: { Authorization: `Bearer ${supabaseToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.paymentMethods || []);
      }
    } catch (error) {
      console.error('Failed to load payment methods:', error);
    }
  };

  const processSavedPaymentMethod = async (paymentMethodId) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tokens/purchase-saved`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseToken}`,
        },
        body: JSON.stringify({
          tokenAmount: selectedPackage.tokens,
          paymentMethodId: paymentMethodId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Purchase failed');
      }

      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      // toast.success(`🎉 ${selectedPackage.tokens} tokens added instantly!`);
      onSuccess(selectedPackage.tokens);
      onClose();

    } catch (error) {
      console.error('Quick purchase error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUseSavedPaymentMethod = (paymentMethodId) => {
    processSavedPaymentMethod(paymentMethodId);
  };

  const handleCardPayment = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      toast.error('Payment system not loaded');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      
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

      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tokens/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseToken}`,
        },
        body: JSON.stringify({
          tokenAmount: selectedPackage.tokens,
          paymentMethodId: paymentMethod.id,
          savePaymentMethod: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Purchase failed');
      }

      const purchaseResult = await response.json();

      if (purchaseResult.paymentIntent && purchaseResult.paymentIntent.client_secret) {
        const { error: confirmError } = await stripe.confirmCardPayment(
          purchaseResult.paymentIntent.client_secret
        );

        if (confirmError) {
          throw new Error(confirmError.message);
        }
      }

      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      // toast.success(`🎉 ${selectedPackage.tokens} tokens added!`);
      onSuccess(selectedPackage.tokens);
      onClose();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      if (navigator.vibrate) navigator.vibrate([200]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '30px',
          maxWidth: '400px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '25px'
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '24px', 
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            ⚡ Quick Buy
          </h3>
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.9 }}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#f0f0f0',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <XMarkIcon style={{ width: '18px', height: '18px' }} />
          </motion.button>
        </div>

        {/* Package Info */}
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '16px',
          marginBottom: '25px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>
            {selectedPackage.emoji}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>
            {selectedPackage.tokens} Tokens
          </div>
          <div style={{ fontSize: '18px', color: '#28a745', fontWeight: '600' }}>
            ${selectedPackage.price}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
            {selectedPackage.label} Package
          </div>
        </div>

        {/* Saved Payment Methods */}
        {paymentMethods.length > 0 && (
          <div style={{ marginBottom: '25px' }}>
            <h4 style={{ 
              margin: '0 0 15px 0', 
              fontSize: '16px', 
              fontWeight: '600',
              color: '#495057'
            }}>
              ⚡ One-Tap Purchase
            </h4>
            {paymentMethods.slice(0, 2).map((method, index) => (
              <motion.button
                key={method.id}
                onClick={() => handleUseSavedPaymentMethod(method.id)}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%',
                  padding: '16px',
                  marginBottom: '10px',
                  backgroundColor: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                <CreditCardIcon style={{ width: '20px', height: '20px' }} />
                Pay with ••••{method.last4}
                <BoltIcon style={{ width: '16px', height: '16px' }} />
              </motion.button>
            ))}
          </div>
        )}

        {/* New Card Form */}
        <form onSubmit={handleCardPayment}>
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ 
              margin: '0 0 15px 0', 
              fontSize: '16px', 
              fontWeight: '600',
              color: '#495057'
            }}>
              💳 New Card
            </h4>
            <div style={{
              padding: '16px',
              border: '2px solid #e9ecef',
              borderRadius: '12px',
              backgroundColor: '#fff'
            }}>
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#495057',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      '::placeholder': {
                        color: '#6c757d',
                      },
                      iconColor: '#667eea'
                    },
                    invalid: {
                      color: '#dc3545',
                      iconColor: '#dc3545'
                    }
                  },
                  hidePostalCode: false,
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{
              color: '#721c24',
              backgroundColor: '#f8d7da',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '15px',
              fontSize: '14px'
            }}>
              ⚠️ {error}
            </div>
          )}

          <motion.button
            type="submit"
            disabled={!stripe || loading}
            whileHover={{ scale: (!stripe || loading) ? 1 : 1.02 }}
            whileTap={{ scale: (!stripe || loading) ? 1 : 0.98 }}
            style={{
              width: '100%',
              padding: '18px',
              background: loading ? '#6c757d' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid #ffffff',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Processing...
              </>
            ) : (
              <>
                <BoltIcon style={{ width: '20px', height: '20px' }} />
                Quick Buy ${selectedPackage.price}
              </>
            )}
          </motion.button>
        </form>

        <div style={{
          textAlign: 'center',
          fontSize: '12px',
          color: '#666',
          marginTop: '15px',
          lineHeight: '1.4'
        }}>
          🔒 Secure payment • Card saved for future quick purchases
        </div>
      </motion.div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
};

const QuickBuyWidget = ({ 
  user, 
  onSuccess, 
  position = 'bottom-right',
  theme = 'gradient',
  size = 'medium' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showPackageSelect, setShowPackageSelect] = useState(false);

  // Position styles
  const getPositionStyles = () => {
    const positions = {
      'bottom-right': { bottom: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'top-right': { top: '20px', right: '20px' },
      'top-left': { top: '20px', left: '20px' },
      'center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    };
    return positions[position] || positions['bottom-right'];
  };

  // Theme styles
  const getThemeStyles = () => {
    const themes = {
      gradient: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      },
      purple: {
        background: '#6f42c1',
        color: 'white'
      },
      green: {
        background: '#28a745',
        color: 'white'
      },
      dark: {
        background: '#212529',
        color: 'white'
      }
    };
    return themes[theme] || themes.gradient;
  };

  // Size styles
  const getSizeStyles = () => {
    const sizes = {
      small: { width: '50px', height: '50px', fontSize: '20px' },
      medium: { width: '60px', height: '60px', fontSize: '24px' },
      large: { width: '70px', height: '70px', fontSize: '28px' }
    };
    return sizes[size] || sizes.medium;
  };

  const handleQuickBuy = (pkg) => {
    setSelectedPackage(pkg);
    setIsOpen(true);
    setShowPackageSelect(false);
  };

  const handleSuccess = (tokensAdded) => {
    setIsOpen(false);
    setSelectedPackage(null);
    setShowPackageSelect(false);
    if (onSuccess) {
      onSuccess(tokensAdded);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Main Widget Button */}
      <motion.div
        style={{
          position: 'fixed',
          zIndex: 999,
          ...getPositionStyles()
        }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        <motion.button
          onClick={() => setShowPackageSelect(!showPackageSelect)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          style={{
            ...getSizeStyles(),
            ...getThemeStyles(),
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}
          title="Quick Buy Tokens"
        >
          <BoltIcon style={{ width: '24px', height: '24px' }} />
        </motion.button>

        {/* Package Selection Menu */}
        <AnimatePresence>
          {showPackageSelect && (
            <motion.div
              style={{
                position: 'absolute',
                bottom: position.includes('bottom') ? '80px' : 'auto',
                top: position.includes('top') ? '80px' : 'auto',
                right: position.includes('right') ? '0' : 'auto',
                left: position.includes('left') ? '0' : 'auto',
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '15px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                minWidth: '200px'
              }}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            >
              <div style={{
                fontSize: '16px',
                fontWeight: 'bold',
                marginBottom: '15px',
                textAlign: 'center',
                color: '#333'
              }}>
                ⚡ Quick Buy
              </div>

              {QUICK_BUY_PACKAGES.map(pkg => (
                <motion.button
                  key={pkg.tokens}
                  onClick={() => handleQuickBuy(pkg)}
                  whileHover={{ scale: 1.02, backgroundColor: '#f8f9fa' }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginBottom: '8px',
                    backgroundColor: 'transparent',
                    border: '2px solid #e9ecef',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{pkg.emoji}</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                        {pkg.tokens} tokens
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {pkg.label}
                      </div>
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 'bold', 
                    color: '#28a745' 
                  }}>
                    ${pkg.price}
                  </div>
                </motion.button>
              ))}

              <div style={{
                textAlign: 'center',
                fontSize: '11px',
                color: '#999',
                marginTop: '10px'
              }}>
                💳 Saved cards for instant purchase
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isOpen && selectedPackage && (
          <Elements stripe={stripePromise}>
            <QuickCheckoutForm
              user={user}
              selectedPackage={selectedPackage}
              onSuccess={handleSuccess}
              onClose={() => setIsOpen(false)}
            />
          </Elements>
        )}
      </AnimatePresence>
    </>
  );
};

export default QuickBuyWidget;