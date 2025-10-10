# Stripe Configuration Guide

## Webhook Configuration (CRITICAL)

### 1. Match Dashboard Events to Code Allowlist

Your code only processes these 15 event types (`backend/routes/stripe-webhooks.js`):

```javascript
// Payment lifecycle
'payment_intent.succeeded'
'payment_intent.payment_failed'
'payment_intent.canceled'
'payment_intent.requires_action'

// Charge events
'charge.succeeded'
'charge.failed'
'charge.refunded'

// Customer events
'customer.created'
'customer.updated'
'customer.deleted'

// Payout events (for creator earnings)
'payout.created'
'payout.paid'
'payout.failed'

// Subscription events
'customer.subscription.created'
'customer.subscription.updated'
'customer.subscription.deleted'

// Dispute handling
'charge.dispute.created'
'charge.dispute.updated'
'charge.dispute.closed'
```

### 2. Configure in Stripe Dashboard

1. **Go to**: https://dashboard.stripe.com/webhooks
2. **Click**: "Add endpoint"
3. **Endpoint URL**: `https://api.digis.app/webhooks/stripe`
4. **Events to send**: Select ONLY the 15 events listed above
5. **Description**: "Digis production webhook - payments & payouts"

**Why**: This reduces noise and eliminates risk of unexpected events causing issues.

---

## Idempotency Settings

### Redis TTL: 7 Days

Your code now stores webhook event IDs for **7 days** (`backend/lib/redis.js:124`):

```javascript
ex: TTL.WEEK  // 7 days - matches Stripe retry window + buffer
```

**Why**: Stripe retries webhooks for up to 3 days. We use 7 days for:
- Safety buffer for extended retries
- Incident analysis (30 days would be better for analytics)
- Replay protection

### Database Storage: Permanent

Webhook events are permanently stored in `processed_webhooks` table for audit trail.

---

## Monitoring & Alerts

### Structured Logs

Your webhooks now emit structured logs for easy parsing:

```
[WEBHOOK_RECEIVED] type=payment_intent.succeeded id=evt_123 age=234ms
[WEBHOOK_DUPLICATE] source=redis type=charge.succeeded id=evt_456
[WEBHOOK_SUCCESS] type=payout.paid id=evt_789 duration=145ms
[WEBHOOK_FAILED] type=payment_intent.succeeded id=evt_999 error="..."
[WEBHOOK_IGNORED] type=unknown.event id=evt_111
```

### Recommended Alerts

Set up monitoring for:

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| Webhook failure rate | >1% | Investigate immediately |
| Duplicate rate | >10% | Check Stripe retry config |
| Processing duration | >2s p95 | Optimize handler |
| Ignored events | Any | Update allowlist if legitimate |

### Query Logs

```bash
# Success rate
grep WEBHOOK_SUCCESS logs/app.log | wc -l

# Failure rate
grep WEBHOOK_FAILED logs/app.log | wc -l

# By event type
grep "type=payment_intent.succeeded" logs/app.log | wc -l

# Slow webhooks (>1s)
grep WEBHOOK_SUCCESS logs/app.log | awk '$F ~ /duration=[0-9]{4,}/'
```

---

## Stripe Connect (If Using)

If you're paying creators via Stripe Connect:

### 1. Separate Connect Webhook

Create a second webhook endpoint:

- **URL**: `https://api.digis.app/webhooks/stripe-connect`
- **Listen to**: Events from connected accounts
- **Events**: Same 15 events as above
- **Connect**: Check "Listen to events on connected accounts"

### 2. Handler Differences

Connected account webhooks include `account` property:

```javascript
if (event.account) {
  // This is from a connected creator account
  const creatorStripeAccountId = event.account;
  // Handle accordingly
}
```

### 3. Separate Secrets

Use different webhook secrets for account vs. connect webhooks.

---

## Testing

### 1. Stripe CLI

```bash
# Install
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3005/webhooks/stripe

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger charge.refunded
```

### 2. Verify Allowlist

Try triggering an unhandled event:

```bash
stripe trigger account.updated
```

Expected log: `[WEBHOOK_IGNORED] type=account.updated id=evt_...`

### 3. Verify Idempotency

Send same event twice:

```bash
stripe events resend evt_123
```

Expected: Second attempt logs `[WEBHOOK_DUPLICATE]`

---

## Security Checklist

- [x] Signature verification enabled
- [x] 5-minute timestamp tolerance
- [x] Event type allowlist (15 events)
- [x] Idempotency via Redis (7 day TTL)
- [x] Idempotency via database (permanent)
- [x] Transactional processing
- [x] Smart retry logic (500 vs 200)
- [x] Structured logging
- [ ] Alert on failure rate >1%
- [ ] Alert on slow processing (>2s)

---

## Production Deployment Checklist

### Before Launch

1. **Set webhook URL** in Stripe Dashboard
2. **Copy webhook signing secret** to Vercel env: `STRIPE_WEBHOOK_SECRET`
3. **Enable only 15 allowed events** in dashboard
4. **Test with Stripe CLI** locally
5. **Deploy to staging** and test with real events
6. **Set up monitoring** alerts (Sentry/Datadog)

### After Launch

1. **Monitor first 24 hours** closely
2. **Check for WEBHOOK_IGNORED** events (may need to add to allowlist)
3. **Verify idempotency** is working (no duplicate side-effects)
4. **Check processing duration** (should be <500ms typically)

---

## Troubleshooting

### "Webhook signature verification failed"

**Cause**: Wrong `STRIPE_WEBHOOK_SECRET` in env vars

**Fix**:
1. Get secret from Stripe Dashboard → Webhooks → Click endpoint → "Signing secret"
2. Update Vercel env: `vercel env pull` → edit → `vercel env push`

### "Event type not handled" for legitimate events

**Cause**: Event not in allowlist

**Fix**:
1. Add event type to `ALLOWED_EVENTS` Set in `backend/routes/stripe-webhooks.js`
2. Update Stripe Dashboard to send that event type
3. Deploy changes

### High duplicate rate

**Cause**: Stripe retrying due to slow responses or timeouts

**Fix**:
1. Check `processing_webhooks` table for slow queries
2. Optimize database queries
3. Consider moving heavy processing to background job (Inngest)

### Webhooks not arriving

**Cause**: Incorrect URL or Stripe not sending

**Fix**:
1. Verify URL in Stripe Dashboard
2. Check endpoint is publicly accessible: `curl https://api.digis.app/health`
3. Review Stripe Dashboard → Webhooks → "Logs" tab

---

## Resources

- [Stripe Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Stripe Connect Webhooks](https://stripe.com/docs/connect/webhooks)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Idempotency in Stripe](https://stripe.com/docs/api/idempotent_requests)

---

**Last Updated**: 2025-01-XX
**Owner**: Backend Team
**Review**: Quarterly
