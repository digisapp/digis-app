import React, { useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements, PaymentRequestButtonElement } from '@stripe/react-stripe-js';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const QUICK_BUY_AMOUNTS = [50, 100, 250, 500];
const TOKEN_PACKAGES = [
  { tokens: 100, price: 2.99, popular: false, savings: 0 },
  { tokens: 500, price: 12.99, popular: true, savings: 15 },
  { tokens: 1000, price: 22.99, popular: false, savings: 25 },
  { tokens: 2500, price: 49.99, popular: false, savings: 35 },
  { tokens: 5000, price: 89.99, popular: false, savings: 45 }
];

const QuickBuyWidget = ({ user, onSuccess, onClose }) => {
  const [selectedAmount, setSelectedAmount] = useState(QUICK_BUY_AMOUNTS[1]);
  const [loading, setLoading] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState(null);
  const stripe = useStripe();

  useEffect(() => {
    if (stripe) {
      const pr = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: {
          label: `${selectedAmount} Tokens`,
          amount: selectedAmount * 5, // 5 cents per token
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });

      pr.canMakePayment().then(result => {
        if (result) {
          setPaymentRequest(pr);
        }
      });

      pr.on('paymentmethod', async (ev) => {
        setLoading(true);
        try {
          const authToken = await getAuthToken();
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tokens/quick-purchase`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              tokenAmount: selectedAmount,
              paymentMethodId: ev.paymentMethod.id
            }),
          });

          if (response.ok) {
            const result = await response.json();
            ev.complete('success');
            
            // Haptic feedback
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }
            
            // toast.success(`${selectedAmount} tokens added! 🎉`);
            onSuccess?.(selectedAmount);
            onClose();
          } else {
            ev.complete('fail');
            toast.error('Purchase failed');
          }
        } catch (error) {
          ev.complete('fail');
          toast.error('Purchase failed');
        } finally {
          setLoading(false);
        }
      });
    }
  }, [stripe, selectedAmount, user, onSuccess, onClose]);

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#fff',
      borderRadius: '16px',
      padding: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      zIndex: 1000,
      minWidth: '280px',
      border: '1px solid #e1e5e9',
      animation: 'slideInRight 0.3s ease-out'
    }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', textAlign: 'center' }}>
        ⚡ Quick Buy
      </h4>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        marginBottom: '12px'
      }}>
        {QUICK_BUY_AMOUNTS.map(amount => (
          <button
            key={amount}
            onClick={() => setSelectedAmount(amount)}
            style={{
              padding: '8px',
              backgroundColor: selectedAmount === amount ? '#007bff' : '#f8f9fa',
              color: selectedAmount === amount ? 'white' : '#333',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
          >
            {amount} tokens
            <br />
            ${(amount * 0.05).toFixed(2)}
          </button>
        ))}
      </div>

      {paymentRequest && (
        <div style={{ marginBottom: '12px' }}>
          <PaymentRequestButtonElement
            options={{
              paymentRequest,
              style: {
                paymentRequestButton: {
                  theme: 'dark',
                  height: '40px',
                  type: 'buy'
                }
              }
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

const SmartNotificationWidget = ({ user, prediction, onRefill, onDismiss }) => {
  const [visible, setVisible] = useState(true);

  if (!visible || !prediction?.triggers?.length) return null;

  const trigger = prediction.triggers[0];
  const urgencyColors = {
    high: '#dc3545',
    medium: '#ffc107',
    low: '#28a745'
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '20px',
      right: '20px',
      backgroundColor: urgencyColors[trigger.severity] || '#007bff',
      color: 'white',
      borderRadius: '12px',
      padding: '16px',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      animation: 'slideInDown 0.3s ease-out'
    }}>
      <div style={{ fontSize: '24px' }}>⚠️</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
          {trigger.message}
        </div>
        <div style={{ fontSize: '14px', opacity: 0.9 }}>
          {trigger.recommendedAction}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onRefill}
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Refill
        </button>
        <button
          onClick={() => {
            setVisible(false);
            onDismiss?.();
          }}
          style={{
            padding: '8px',
            backgroundColor: 'transparent',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ×
        </button>
      </div>

      <style>{`
        @keyframes slideInDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

const MobileCheckoutForm = ({ user, selectedPackage, onSuccess, onClose }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState(null);

  useEffect(() => {
    if (stripe) {
      const pr = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: {
          label: `${selectedPackage.tokens} Tokens`,
          amount: Math.round(selectedPackage.price * 100),
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });

      pr.canMakePayment().then(result => {
        if (result) {
          setPaymentRequest(pr);
        }
      });

      pr.on('paymentmethod', async (ev) => {
        await handlePayment(ev.paymentMethod.id, ev);
      });
    }
  }, [stripe, selectedPackage]);

  const handlePayment = async (paymentMethodId, ev = null) => {
    setLoading(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tokens/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          tokenAmount: selectedPackage.tokens,
          paymentMethodId
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (ev) ev.complete('success');
        
        // Success haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100, 50, 100]);
        }
        
        const totalTokens = selectedPackage.tokens + (selectedPackage.savings ? Math.floor(selectedPackage.tokens * 0.05) : 0);
        // toast.success(`${totalTokens} tokens added! 🎉`);
        onSuccess?.(totalTokens);
        onClose();
      } else {
        if (ev) ev.complete('fail');
        
        // Error haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate([200]);
        }
        
        toast.error('Purchase failed');
      }
    } catch (error) {
      if (ev) ev.complete('fail');
      
      // Error haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([200]);
      }
      
      toast.error('Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCardPayment = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: {
        email: user.email,
        name: user.displayName || user.email,
      },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await handlePayment(paymentMethod.id);
  };

  return (
    <div>
      {paymentRequest && (
        <div style={{ marginBottom: '20px' }}>
          <PaymentRequestButtonElement
            options={{
              paymentRequest,
              style: {
                paymentRequestButton: {
                  theme: 'dark',
                  height: '48px',
                  type: 'buy'
                }
              }
            }}
          />
          <div style={{
            textAlign: 'center',
            margin: '15px 0',
            color: '#666',
            fontSize: '14px'
          }}>
            or pay with card
          </div>
        </div>
      )}

      <form onSubmit={handleCardPayment}>
        <div style={{
          padding: '16px',
          border: '1px solid #e1e5e9',
          borderRadius: '12px',
          marginBottom: '16px',
          backgroundColor: '#f8f9fa'
        }}>
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
              },
              hidePostalCode: false,
            }}
          />
        </div>

        <button
          type="submit"
          disabled={!stripe || loading}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: loading ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 'bold',
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
                width: '16px',
                height: '16px',
                border: '2px solid #ffffff',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Processing...
            </>
          ) : (
            `💳 Pay $${selectedPackage.price.toFixed(2)}`
          )}
        </button>
      </form>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const EnhancedMobileTokenPurchase = ({ user, onSuccess, onClose, showQuickBuy = false, prediction = null }) => {
  const [selectedPackage, setSelectedPackage] = useState(TOKEN_PACKAGES[1]);
  const [showPayment, setShowPayment] = useState(false);
  const [showNotification, setShowNotification] = useState(!!prediction?.triggers?.length);
  const slideRef = useRef(null);

  // Haptic feedback function
  const hapticFeedback = (intensity = 1) => {
    if (navigator.vibrate) {
      switch (intensity) {
        case 1: navigator.vibrate(50); break;
        case 2: navigator.vibrate([50, 50, 50]); break;
        case 3: navigator.vibrate([100, 50, 100]); break;
        default: navigator.vibrate(20);
      }
    }
  };

  // Gesture handling for swipe down to close
  useEffect(() => {
    let startY = 0;
    let currentY = 0;
    
    const handleTouchStart = (e) => {
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      currentY = e.touches[0].clientY;
      const diff = currentY - startY;
      
      if (diff > 0) {
        const element = slideRef.current;
        if (element) {
          element.style.transform = `translateY(${Math.min(diff, 100)}px)`;
        }
      }
    };

    const handleTouchEnd = () => {
      const diff = currentY - startY;
      const element = slideRef.current;
      
      if (element) {
        if (diff > 100) {
          hapticFeedback(1);
          onClose();
        } else {
          element.style.transform = 'translateY(0)';
        }
      }
    };

    const element = slideRef.current;
    if (element) {
      element.addEventListener('touchstart', handleTouchStart);
      element.addEventListener('touchmove', handleTouchMove);
      element.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      if (element) {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [onClose]);

  if (showQuickBuy) {
    return (
      <Elements stripe={stripePromise}>
        <QuickBuyWidget user={user} onSuccess={onSuccess} onClose={onClose} />
      </Elements>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      {showNotification && (
        <SmartNotificationWidget
          user={user}
          prediction={prediction}
          onRefill={() => setShowPayment(true)}
          onDismiss={() => setShowNotification(false)}
        />
      )}
      
      <div
        ref={slideRef}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          padding: '20px',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
          zIndex: 1000,
          maxHeight: '85vh',
          overflowY: 'auto',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        {/* Handle bar */}
        <div style={{
          width: '40px',
          height: '4px',
          backgroundColor: '#ddd',
          borderRadius: '2px',
          margin: '0 auto 20px',
          cursor: 'pointer'
        }} onClick={onClose} />

        {!showPayment ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 'bold' }}>
                💎 Buy Tokens
              </h3>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                Secure, instant delivery • Never expire
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginBottom: '24px'
            }}>
              {TOKEN_PACKAGES.map(pkg => (
                <button
                  key={pkg.tokens}
                  onClick={() => {
                    hapticFeedback(1);
                    setSelectedPackage(pkg);
                  }}
                  style={{
                    padding: '16px 12px',
                    backgroundColor: selectedPackage.tokens === pkg.tokens ? '#007bff' : '#fff',
                    color: selectedPackage.tokens === pkg.tokens ? 'white' : '#333',
                    border: pkg.popular 
                      ? '2px solid #ffc107' 
                      : selectedPackage.tokens === pkg.tokens 
                        ? '2px solid #007bff' 
                        : '1px solid #e1e5e9',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    textAlign: 'center',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    transform: selectedPackage.tokens === pkg.tokens ? 'scale(1.02)' : 'scale(1)'
                  }}
                >
                  {pkg.popular && (
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#ffc107',
                      color: '#000',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      POPULAR
                    </div>
                  )}
                  
                  <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                    {pkg.tokens.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>
                    tokens
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    ${pkg.price.toFixed(2)}
                  </div>
                  
                  {pkg.savings > 0 && (
                    <div style={{
                      backgroundColor: '#28a745',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      fontSize: '10px',
                      marginTop: '4px',
                      display: 'inline-block'
                    }}>
                      Save {pkg.savings}%
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Package details */}
            <div style={{
              backgroundColor: '#f8f9fa',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Tokens:</span>
                <span style={{ fontWeight: 'bold' }}>{selectedPackage.tokens.toLocaleString()}</span>
              </div>
              {selectedPackage.savings > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Bonus tokens:</span>
                  <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                    +{Math.floor(selectedPackage.tokens * 0.05).toLocaleString()}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Price per token:</span>
                <span>${(selectedPackage.price / selectedPackage.tokens).toFixed(3)}</span>
              </div>
              <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #dee2e6' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
                <span>Total:</span>
                <span>${selectedPackage.price.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                hapticFeedback(2);
                setShowPayment(true);
              }}
              style={{
                width: '100%',
                padding: '18px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginBottom: '12px',
                boxShadow: '0 4px 12px rgba(0,123,255,0.3)'
              }}
              aria-label="Continue to payment"
              onKeyDown={(e) => e.key === 'Enter' && (hapticFeedback(2), setShowPayment(true))}
            >
              Continue to Payment
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              <button
                onClick={() => setShowPayment(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ←
              </button>
              <h3 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '18px' }}>
                Complete Purchase
              </h3>
            </div>

            <div style={{
              backgroundColor: '#f8f9fa',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>💎</div>
              <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
                {selectedPackage.tokens.toLocaleString()} Tokens
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                ${selectedPackage.price.toFixed(2)}
              </div>
            </div>

            <MobileCheckoutForm
              user={user}
              selectedPackage={selectedPackage}
              onSuccess={onSuccess}
              onClose={onClose}
            />
          </>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: 'transparent',
            color: '#666',
            border: 'none',
            marginTop: '12px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Cancel
        </button>

        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
      </div>
    </Elements>
  );
};

export default EnhancedMobileTokenPurchase;