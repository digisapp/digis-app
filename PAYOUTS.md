# Creator Payouts System Documentation

## Overview

The Digis Creator Payouts system enables creators to receive automatic bi-weekly payments for their earnings on the platform. Creators receive payouts on the 1st and 15th of each month via direct deposit to their bank accounts.

## System Architecture

### Database Schema

1. **creator_stripe_accounts** - Stores Stripe Connect account information
2. **creator_bank_accounts** - Encrypted bank account details (managed by Stripe)
3. **creator_payouts** - Payout history and status tracking
4. **creator_earnings** - Detailed earnings ledger
5. **creator_payout_settings** - Creator preferences for payouts

### Key Features

- **Automatic Bi-weekly Payouts**: Processed on 1st and 15th of each month
- **Stripe Connect Integration**: Secure banking and compliance
- **No Platform Fees**: Creators keep 100% of their earnings
- **$50 Minimum Payout**: Configurable per creator
- **Real-time Earnings Tracking**: All earnings recorded immediately
- **Comprehensive Dashboard**: View pending balance, history, and analytics

## Implementation Details

### Earnings Sources

All creator earnings are automatically tracked:

1. **Video/Voice Sessions** - Recorded when session ends
2. **Tips** - Recorded when tip is sent
3. **Membership Purchases** - Recorded when user joins tier
4. **Membership Upgrades** - Recorded when user upgrades tier

### Payout Schedule

- **1st of month**: Pays earnings from 16th-31st of previous month
- **15th of month**: Pays earnings from 1st-15th of current month

### API Endpoints

```
GET  /api/creator-payouts/dashboard       - Payout dashboard data
GET  /api/creator-payouts/stripe-account  - Stripe account status
POST /api/creator-payouts/stripe-account/create - Start Stripe onboarding
GET  /api/creator-payouts/settings        - Payout preferences
PUT  /api/creator-payouts/settings        - Update preferences
GET  /api/creator-payouts/history         - Payout history
POST /api/creator-payouts/request-payout  - Manual payout request
```

### Stripe Webhooks

Configure webhook endpoint: `/webhooks/stripe`

Required events:
- `account.updated` - Track onboarding status
- `payout.paid` - Confirm successful payouts
- `payout.failed` - Handle failed payouts

### Environment Variables

```bash
# Required for payouts
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
ENABLE_CRON=true # Enable automatic processing
```

## Setup Instructions

### 1. Database Migration

```bash
npm run migrate
```

### 2. Configure Stripe Connect

1. Enable Connect in Stripe Dashboard
2. Set up webhook endpoint
3. Configure platform settings

### 3. Enable Scheduled Jobs

For production:
```bash
# The cron jobs are automatically initialized when ENABLE_CRON=true
```

For manual testing:
```bash
node scripts/process-payouts.js generate  # Generate payouts
node scripts/process-payouts.js process   # Process payouts
node scripts/process-payouts.js report    # View report
```

### 4. Frontend Integration

Add payout dashboard to creator navigation:

```javascript
// In main app component
import CreatorPayoutDashboard from './components/CreatorPayoutDashboard';

// Add route
<Route path="/creator/payouts" element={<CreatorPayoutDashboard />} />

// Add to navigation
onShowPayouts={() => navigate('/creator/payouts')}
```

## Security Considerations

1. **Bank Account Security**: All banking info stored and processed by Stripe
2. **PCI Compliance**: Handled by Stripe Connect
3. **Authentication**: All endpoints require Firebase auth
4. **Creator Verification**: Only verified creators can receive payouts

## Testing

### Test Stripe Connect Onboarding

Use Stripe test mode with test data:
- Test routing: 110000000
- Test account: 000123456789

### Test Payout Processing

```bash
# Generate test earnings
INSERT INTO creator_earnings (creator_id, earning_type, tokens_earned, usd_value)
VALUES ('test-creator-uid', 'test', 1000, 50.00);

# Run payout processor
node scripts/process-payouts.js process
```

## Monitoring

### Key Metrics

- Payout success rate
- Average payout amount
- Failed payout reasons
- Time to payout completion

### Logs

- Application logs: `/logs/payout-processor.log`
- Cron logs: `/logs/cron.log`

## Troubleshooting

### Common Issues

1. **"Cannot receive payouts"**
   - Check Stripe account status
   - Verify onboarding completed
   - Ensure payouts_enabled = true

2. **"Insufficient balance"**
   - Check minimum payout amount
   - Verify earnings are tracked
   - Review pending balance

3. **"Payout failed"**
   - Check Stripe dashboard
   - Verify bank account
   - Review webhook logs

## Support

For creator support:
1. Direct to Stripe Connect support for banking issues
2. Check payout dashboard for status
3. Review notification center for updates

For platform administrators:
1. Monitor `/api/creator-payouts/admin/dashboard`
2. Check payout processor logs
3. Review Stripe Connect dashboard