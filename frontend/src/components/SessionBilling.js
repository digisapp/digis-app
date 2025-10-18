import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const BillingForm = ({ user, billing, onPaymentSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements || !billing.paymentIntentId) return;

    setLoading(true);
    setError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      
      const { error: confirmError } = await stripe.confirmCardPayment(
        billing.clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              email: user.email,
              name: user.displayName || user.email,
            },
          },
        }
      );

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      // toast.success(`Payment successful! $${billing.totalAmount} for ${billing.durationMinutes} minutes`);
      onPaymentSuccess();
      
    } catch (err) {
      console.error('❌ Payment error:', err);
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      border: '1px solid #e9ecef',
      borderRadius: '12px',
      padding: '25px',
      backgroundColor: '#fff',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      maxWidth: '500px',
      margin: '20px auto'
    }}>
      <h3 style={{ marginBottom: '20px', color: '#333', textAlign: 'center' }}>
        💳 Session Payment Required
      </h3>
      
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span>Duration:</span>
          <strong>{billing.durationMinutes} minutes</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span>Rate:</span>
          <strong>${billing.ratePerMinute}/min</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px' }}>
          <span>Total:</span>
          <strong style={{ color: '#28a745' }}>${billing.totalAmount}</strong>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          border: '1px solid #ddd',
          borderRadius: '8px'
        }}>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': { color: '#aab7c4' },
                },
              },
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
            fontSize: '14px'
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!stripe || loading}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: loading ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Processing...' : `Pay $${billing.totalAmount}`}
        </button>
      </form>
    </div>
  );
};

const SessionBilling = ({ user, sessionId, onPaymentSuccess, onClose }) => {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBilling = async () => {
      try {
        const token = await getAuthToken();
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/users/session/${sessionId}/billing`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch billing information');
        }

        const data = await response.json();
        setBilling(data.billing);
      } catch (err) {
        console.error('❌ Billing fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchBilling();
    }
  }, [sessionId, user]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '24px', marginBottom: '20px' }}>⏳</div>
        <div>Loading billing information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px',
        color: '#721c24',
        backgroundColor: '#f8d7da',
        borderRadius: '8px',
        margin: '20px'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '20px' }}>⚠️</div>
        <div>Error: {error}</div>
        <button
          onClick={onClose}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <BillingForm
        user={user}
        billing={billing}
        onPaymentSuccess={onPaymentSuccess}
      />
    </Elements>
  );
};

export default SessionBilling;