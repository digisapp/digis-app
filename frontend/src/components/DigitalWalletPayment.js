import React, { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import digitalWalletService from '../utils/digitalWallets';
import { getAuthToken } from '../utils/auth-helpers';

const DigitalWalletPayment = ({
  user,
  amount,
  currency = 'USD',
  tokenAmount,
  onSuccess,
  onError,
  onCancel,
  className = '',
  showTitle = true,
  layout = 'vertical' // 'vertical', 'horizontal', 'compact'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [capabilities, setCapabilities] = useState({});
  const [processingMethod, setProcessingMethod] = useState(null);
  const applePayRef = useRef(null);
  const googlePayRef = useRef(null);

  useEffect(() => {
    initializeWallets();
  }, []);

  const initializeWallets = async () => {
    try {
      await digitalWalletService.initialize();
      const caps = digitalWalletService.getDeviceCapabilities();
      setCapabilities(caps);
      
      // Create payment buttons
      createPaymentButtons();
    } catch (error) {
      console.error('Failed to initialize digital wallets:', error);
    }
  };

  const createPaymentButtons = () => {
    // Create Apple Pay button
    if (capabilities.applePayAvailable && applePayRef.current) {
      // Clear existing button
      applePayRef.current.innerHTML = '';
      
      digitalWalletService.createApplePayButton({
        container: applePayRef.current,
        onClick: handleApplePayClick,
        style: 'black',
        type: 'buy'
      });
    }

    // Create Google Pay button
    if (capabilities.googlePayAvailable && googlePayRef.current) {
      // Clear existing button
      googlePayRef.current.innerHTML = '';
      
      digitalWalletService.createGooglePayButton({
        container: googlePayRef.current,
        onClick: handleGooglePayClick,
        buttonColor: 'default',
        buttonType: 'buy'
      });
    }
  };

  const handleApplePayClick = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setProcessingMethod('apple_pay');

    try {
      const validatedAmount = digitalWalletService.validateAmount(amount);
      
      await digitalWalletService.processApplePayment({
        amount: validatedAmount,
        currency,
        merchantName: `${tokenAmount} Digis Tokens`,
        onValidateMerchant: handleApplePayValidation,
        onPaymentAuthorized: handleApplePayAuthorization,
        onCancel: () => {
          setIsLoading(false);
          setProcessingMethod(null);
          onCancel?.();
        },
        onError: (error) => {
          setIsLoading(false);
          setProcessingMethod(null);
          handlePaymentError(error);
        }
      });
    } catch (error) {
      setIsLoading(false);
      setProcessingMethod(null);
      handlePaymentError(error);
    }
  };

  const handleApplePayValidation = async (validationURL) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/payments/apple-pay-validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          validationURL,
          displayName: `${tokenAmount} Digis Tokens`
        })
      });

      if (!response.ok) {
        throw new Error('Merchant validation failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Apple Pay validation error:', error);
      throw error;
    }
  };

  const handleApplePayAuthorization = async (payment) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/tokens/purchase-apple-pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          tokenAmount,
          paymentData: payment.token,
          amount: amount
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Payment failed');
      }

      const result = await response.json();
      
      // Success feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 100]);
      }
      
      // toast.success(`🍎 ${tokenAmount} tokens added via Apple Pay!`);
      
      setIsLoading(false);
      setProcessingMethod(null);
      onSuccess?.(result);
      
      return { success: true };
    } catch (error) {
      console.error('Apple Pay authorization error:', error);
      return { success: false, error: error.message };
    }
  };

  const handleGooglePayClick = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setProcessingMethod('google_pay');

    try {
      const validatedAmount = digitalWalletService.validateAmount(amount);
      
      await digitalWalletService.processGooglePayment({
        amount: validatedAmount,
        currency,
        merchantName: 'Digis Tokens',
        onPaymentAuthorized: handleGooglePayAuthorization,
        onCancel: () => {
          setIsLoading(false);
          setProcessingMethod(null);
          onCancel?.();
        },
        onError: (error) => {
          setIsLoading(false);
          setProcessingMethod(null);
          handlePaymentError(error);
        }
      });
    } catch (error) {
      setIsLoading(false);
      setProcessingMethod(null);
      handlePaymentError(error);
    }
  };

  const handleGooglePayAuthorization = async (paymentData) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/tokens/purchase-google-pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          tokenAmount,
          paymentData: paymentData.paymentMethodData.tokenizationData.token,
          amount: amount
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Payment failed');
      }

      const result = await response.json();
      
      // Success feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 100]);
      }
      
      // toast.success(`🟢 ${tokenAmount} tokens added via Google Pay!`);
      
      setIsLoading(false);
      setProcessingMethod(null);
      onSuccess?.(result);
      
      return { success: true };
    } catch (error) {
      console.error('Google Pay authorization error:', error);
      return { success: false, error: error.message };
    }
  };

  const handlePaymentError = (error) => {
    console.error('Digital wallet payment error:', error);
    toast.error(error.message || 'Payment failed');
    onError?.(error);
    
    // Error feedback
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  };

  const getLayoutStyles = () => {
    switch (layout) {
      case 'horizontal':
        return {
          container: { display: 'flex', gap: '12px', alignItems: 'center' },
          button: { flex: 1 }
        };
      case 'compact':
        return {
          container: { display: 'flex', gap: '8px', alignItems: 'center' },
          button: { minWidth: '120px' }
        };
      default: // vertical
        return {
          container: { display: 'flex', flexDirection: 'column', gap: '12px' },
          button: { width: '100%' }
        };
    }
  };

  const styles = getLayoutStyles();

  // Don't render if no digital wallets are available
  if (!capabilities.applePayAvailable && !capabilities.googlePayAvailable) {
    return null;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {showTitle && (
        <div style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#495057',
          marginBottom: '15px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          ⚡ Express Checkout
          <div style={{
            fontSize: '12px',
            backgroundColor: '#28a745',
            color: 'white',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: '500'
          }}>
            Instant
          </div>
        </div>
      )}

      <div style={styles.container}>
        {/* Apple Pay Button */}
        {capabilities.applePayAvailable && (
          <motion.div
            style={styles.button}
            whileHover={{ scale: isLoading ? 1 : 1.02 }}
            whileTap={{ scale: isLoading ? 1 : 0.98 }}
            role="button"
            tabIndex={isLoading ? -1 : 0}
            aria-label={`Pay with Apple Pay for ${tokenAmount} tokens`}
            aria-disabled={isLoading}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleApplePayClick()}
          >
            <div
              ref={applePayRef}
              style={{
                position: 'relative',
                opacity: isLoading && processingMethod !== 'apple_pay' ? 0.5 : 1,
                pointerEvents: isLoading ? 'none' : 'auto'
              }}
            />
            
            {isLoading && processingMethod === 'apple_pay' && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Processing...
              </div>
            )}
          </motion.div>
        )}

        {/* Google Pay Button */}
        {capabilities.googlePayAvailable && (
          <motion.div
            style={styles.button}
            whileHover={{ scale: isLoading ? 1 : 1.02 }}
            whileTap={{ scale: isLoading ? 1 : 0.98 }}
            role="button"
            tabIndex={isLoading ? -1 : 0}
            aria-label={`Pay with Google Pay for ${tokenAmount} tokens`}
            aria-disabled={isLoading}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleGooglePayClick()}
          >
            <div
              ref={googlePayRef}
              style={{
                position: 'relative',
                opacity: isLoading && processingMethod !== 'google_pay' ? 0.5 : 1,
                pointerEvents: isLoading ? 'none' : 'auto'
              }}
            />
            
            {isLoading && processingMethod === 'google_pay' && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Processing...
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Payment Info */}
      <div style={{
        fontSize: '12px',
        color: '#6c757d',
        marginTop: '10px',
        textAlign: layout === 'horizontal' ? 'left' : 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: layout === 'horizontal' ? 'flex-start' : 'center',
        gap: '6px'
      }}>
        <span>🔒</span>
        <span>
          {digitalWalletService.formatAmount(amount, currency)} • {tokenAmount} tokens
        </span>
      </div>

      {/* Processing Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
              zIndex: 10
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid #e9ecef',
                borderTop: '3px solid #007bff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#495057'
              }}>
                {processingMethod === 'apple_pay' ? '🍎 Processing Apple Pay...' : 
                 processingMethod === 'google_pay' ? '🟢 Processing Google Pay...' : 
                 'Processing Payment...'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
};

DigitalWalletPayment.propTypes = {
  user: PropTypes.object.isRequired,
  amount: PropTypes.number.isRequired,
  currency: PropTypes.string,
  tokenAmount: PropTypes.number.isRequired,
  onSuccess: PropTypes.func.isRequired,
  onError: PropTypes.func,
  onCancel: PropTypes.func,
  className: PropTypes.string,
  showTitle: PropTypes.bool,
  layout: PropTypes.oneOf(['vertical', 'horizontal', 'compact'])
};

DigitalWalletPayment.defaultProps = {
  currency: 'USD',
  className: '',
  showTitle: true,
  layout: 'vertical'
};

export default memo(DigitalWalletPayment);