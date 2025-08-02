import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

// Initialize Stripe outside of component to avoid re-initialization
// Validate Stripe publishable key exists
if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
  console.error('REACT_APP_STRIPE_PUBLISHABLE_KEY environment variable is not set');
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const CheckoutForm = ({ user, amount, isTip, sessionId, creatorId, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      console.error('Stripe not loaded');
      return;
    }

    if (!user) {
      toast.error('Please log in to make a payment');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Create payment method
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

      // Call backend to create payment
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payments/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          amount: amount,
          sessionId: sessionId,
          isTip: isTip,
          creatorId: creatorId,
          description: `${isTip ? 'Tip' : 'Payment'} for ${amount} USD`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Payment failed');
      }

      const paymentResult = await response.json();
      console.log('✅ Payment successful:', paymentResult);

      // Handle 3D Secure if needed
      if (paymentResult.paymentIntent && paymentResult.paymentIntent.client_secret) {
        const { error: confirmError } = await stripe.confirmCardPayment(
          paymentResult.paymentIntent.client_secret
        );

        if (confirmError) {
          throw new Error(confirmError.message);
        }
      }

      // toast.success(`Payment successful! $${amount}`);
      
      if (onSuccess) {
        onSuccess(amount);
      }

      // Clear the card element
      cardElement.clear();

    } catch (err) {
      console.error('❌ Payment error:', err);
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
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

      {error && (
        <div style={{ 
          color: '#721c24',
          backgroundColor: '#f8d7da',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px',
          fontSize: '14px',
          border: '1px solid #f5c6cb'
        }}>
          ⚠️ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        style={{
          width: '100%',
          padding: '12px 20px',
          backgroundColor: loading ? '#6c757d' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
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
          <>
            💰 {isTip ? 'Send Tip' : 'Pay'} ${amount}
          </>
        )}
      </button>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </form>
  );
};

const Payment = ({ user, amount, isTip, sessionId, creatorId, onSuccess }) => {
  const [stripeError, setStripeError] = useState(null);

  React.useEffect(() => {
    // Test Stripe loading
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

  if (stripeError) {
    return (
      <div style={{ 
        color: '#721c24',
        backgroundColor: '#f8d7da',
        padding: '15px',
        borderRadius: '8px',
        border: '1px solid #f5c6cb',
        textAlign: 'center'
      }}>
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
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{ 
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <h3 style={{ 
          margin: '0 0 10px 0',
          color: '#333',
          fontSize: '18px'
        }}>
          {isTip ? '💝 Send a Tip' : '💳 Payment Required'}
        </h3>
        <p style={{ 
          margin: '0',
          color: '#666',
          fontSize: '14px'
        }}>
          {isTip 
            ? 'Show your appreciation with a tip!' 
            : 'Complete payment to access this session'
          }
        </p>
      </div>

      <Elements stripe={stripePromise}>
        <CheckoutForm
          user={user}
          amount={amount}
          isTip={isTip}
          sessionId={sessionId}
          creatorId={creatorId}
          onSuccess={onSuccess}
        />
      </Elements>
    </div>
  );
};

export default Payment;