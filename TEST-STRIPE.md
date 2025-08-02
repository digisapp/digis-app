# How to Test Your Stripe Integration

## Quick Test Setup

Since your Stripe packages are already installed and configured, here's how to test it:

### 1. Start Your Servers

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend  
cd frontend && npm start
```

### 2. Test Stripe API Endpoint

```bash
# Test that your backend Stripe endpoint works
curl -X GET http://localhost:3001/api/payments/test
```

### 3. Use the Stripe Test Component

I've created a `StripeTestPayment.js` component. To use it:

1. **Quick Test Route**: Add this to your App.js temporarily:

```javascript
// Add near the top of App.js after imports
import StripeTestPayment from './components/StripeTestPayment';

// Add this condition somewhere in your render method
{currentView === 'stripe-test' && (
  <StripeTestPayment />
)}

// Add a test button in your nav
<button onClick={() => setCurrentView('stripe-test')}>
  Test Stripe
</button>
```

### 4. Test Cards

Use these Stripe test card numbers:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`  
- **Requires Auth**: `4000 0025 0000 3155`

Use any future expiry date and any 3-digit CVC.

### 5. Check Webhook (Missing Secret)

Your webhook secret is still: `whsec_your_webhook_secret_here`

To get the real secret:
1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `http://localhost:3001/webhooks/stripe`
3. Copy the signing secret
4. Update your backend `.env`

### 6. Test the Full Flow

1. **Frontend**: User enters card details
2. **Backend**: Creates PaymentIntent via `/api/tokens/purchase`
3. **Frontend**: Confirms payment with Stripe
4. **Webhook**: Processes `payment_intent.succeeded`
5. **Database**: Updates token balance

## Your Current Status

✅ **Stripe Publishable Key**: Configured in frontend
✅ **Stripe Secret Key**: Configured in backend  
✅ **Stripe Packages**: Installed in both
✅ **Webhook Handler**: Ready at `/webhooks/stripe`
⚠️ **Webhook Secret**: Needs real value from Stripe Dashboard

## Test Payment Endpoint

```bash
# Test token purchase endpoint (requires auth)
curl -X POST http://localhost:3001/api/tokens/purchase \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "amount": 599,
    "tokens": 100,
    "currency": "usd"
  }'
```

Your platform is ready to process payments! 🚀