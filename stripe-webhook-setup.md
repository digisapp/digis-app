# Stripe Webhook Setup Guide for Digis Platform

## 1. Stripe Dashboard Setup

### Create Stripe Account:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Create account or sign in
3. Complete business verification (for live payments)

### Get API Keys:
1. Navigate to **Developers > API Keys**
2. Copy **Publishable key** (starts with `pk_test_` or `pk_live_`)
3. Copy **Secret key** (starts with `sk_test_` or `sk_live_`)
4. Add to your `.env` files

## 2. Create Webhook Endpoint

### In Stripe Dashboard:
1. Go to **Developers > Webhooks**
2. Click "Add endpoint"
3. Set endpoint URL:
   - **Development**: `https://your-ngrok-url.ngrok.io/webhooks/stripe`
   - **Production**: `https://your-domain.com/webhooks/stripe`

### Select Events to Listen For:
```
✅ payment_intent.succeeded
✅ payment_intent.payment_failed
✅ payment_intent.requires_action
✅ invoice.payment_succeeded
✅ invoice.payment_failed
✅ customer.subscription.created
✅ customer.subscription.updated
✅ customer.subscription.deleted
✅ checkout.session.completed
✅ charge.dispute.created
```

### Get Webhook Secret:
1. After creating webhook, click on it
2. Copy the **Signing secret** (starts with `whsec_`)
3. Add to backend `.env`: `STRIPE_WEBHOOK_SECRET=whsec_xxx`

## 3. Testing Webhooks Locally

### Install Stripe CLI:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Linux
wget -O - https://packages.stripe.com/api/security/pubkey/pubkey.gpg | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.com/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
sudo apt update && sudo apt install stripe
```

### Login to Stripe:
```bash
stripe login
```

### Forward Webhooks to Local Server:
```bash
# Start your backend server first
cd backend && npm run dev

# In another terminal, forward webhooks
stripe listen --forward-to localhost:3001/webhooks/stripe
```

This will give you a webhook secret starting with `whsec_` - use this for local development.

## 4. Test Webhook Events

### Test Payment Success:
```bash
stripe trigger payment_intent.succeeded
```

### Test Payment Failure:
```bash
stripe trigger payment_intent.payment_failed
```

### Test with Real Payment:
```bash
# Use Stripe test card numbers
# Success: 4242424242424242
# Decline: 4000000000000002
# Requires authentication: 4000002500003155
```

## 5. Production Webhook Setup

### Using ngrok for Development:
```bash
# Install ngrok
npm install -g ngrok

# Start your backend
cd backend && npm run dev

# In another terminal, expose local server
ngrok http 3001

# Use the HTTPS URL from ngrok in Stripe webhook endpoint
# Example: https://abc123.ngrok.io/webhooks/stripe
```

### Production Deployment:
1. Deploy your backend to production (Vercel, Heroku, etc.)
2. Update webhook endpoint URL in Stripe Dashboard
3. Update environment variables with production values
4. Test webhook delivery in Stripe Dashboard

## 6. Webhook Security

### Verify Webhook Signatures:
The webhook route automatically verifies signatures using:
```javascript
const event = stripe.webhooks.constructEvent(
  req.rawBody, 
  sig, 
  process.env.STRIPE_WEBHOOK_SECRET
);
```

### Security Best Practices:
- ✅ Always verify webhook signatures
- ✅ Use HTTPS endpoints only
- ✅ Keep webhook secrets secure
- ✅ Implement idempotency for webhook processing
- ✅ Log webhook events for debugging
- ✅ Handle webhook retries gracefully

## 7. Environment Variables Setup

### Backend `.env`:
```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Frontend `.env`:
```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 8. Testing Token Purchases

### Test Flow:
1. User selects token package
2. Frontend creates PaymentIntent
3. User completes payment
4. Webhook processes `payment_intent.succeeded`
5. Tokens added to user balance
6. Transaction recorded in database

### Test with Stripe CLI:
```bash
# Test successful token purchase
curl -X POST http://localhost:3001/api/tokens/purchase \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "tokens": 1000,
    "amount": 10.99,
    "paymentMethodId": "pm_card_visa"
  }'
```

## 9. Monitoring and Logs

### Stripe Dashboard Monitoring:
1. Go to **Developers > Webhooks**
2. Click on your webhook endpoint
3. View delivery attempts and responses
4. Check for failed deliveries

### Application Logs:
```bash
# View webhook processing logs
tail -f backend/logs/app.log | grep webhook

# View payment processing logs
tail -f backend/logs/app.log | grep payment
```

## 10. Error Handling

### Common Webhook Issues:

1. **Webhook signature verification failed**
   - Check webhook secret is correct
   - Ensure raw body is passed to verification

2. **Webhook endpoint not responding**
   - Check server is running and accessible
   - Verify endpoint URL is correct
   - Check firewall/security groups

3. **Database errors in webhook processing**
   - Ensure database is connected
   - Check table structure matches webhook handler
   - Verify user/session exists before processing

### Webhook Retry Logic:
Stripe automatically retries failed webhooks:
- Immediate retry
- 1 hour later
- 3 hours later
- 6 hours later
- 12 hours later
- 24 hours later

## 11. Advanced Features

### Subscription Webhooks:
```javascript
// Handle subscription events
case 'customer.subscription.created':
  // Add subscription to database
  // Send welcome email
  // Grant premium features

case 'customer.subscription.updated':
  // Update subscription status
  // Handle plan changes

case 'customer.subscription.deleted':
  // Remove premium features
  // Send cancellation email
```

### Dispute Handling:
```javascript
case 'charge.dispute.created':
  // Create fraud alert
  // Freeze account if needed
  // Notify admin team
```

## 12. Troubleshooting

### Debug Webhook Delivery:
```bash
# Check webhook endpoint health
curl -X GET http://localhost:3001/webhooks/health

# Test webhook with sample data
curl -X POST http://localhost:3001/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'
```

### Verify Environment:
```bash
# Check Stripe configuration
curl -X GET http://localhost:3001/api/payments/test
```

### Common Solutions:
1. **Ensure webhook endpoint accepts POST requests**
2. **Check Content-Type is application/json**
3. **Verify database connection in webhook handler**
4. **Test with Stripe CLI before production**
5. **Monitor webhook attempts in Stripe Dashboard**

## Support Resources:
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)