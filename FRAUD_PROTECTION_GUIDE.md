# Fraud Protection Implementation Guide

## Overview

This guide shows how to integrate the anti-fraud middleware into your existing token routes.

## Quick Start

### 1. Run the Migration

```bash
cd backend
npm run migrate
```

This creates:
- `fraud_alerts` table
- `user_risk_scores` table
- `account_holds` table
- Helper functions for risk calculation

### 2. Apply Middleware to Routes

**File**: `backend/routes/tokens.js`

```javascript
const {
  checkSpendLimits,
  checkVelocity,
  verifyPayoutEligibility,
  checkPurchaseFraud
} = require('../middleware/fraud-protection');

// Apply to purchase endpoint
router.post('/purchase',
  authenticateToken,
  checkPurchaseFraud,      // ← NEW: Check for stolen card patterns
  checkVelocity('purchase'), // ← NEW: Max 5 purchases/hour
  async (req, res) => {
    // existing purchase logic...
  }
);

// Apply to tip endpoint
router.post('/tip',
  authenticateToken,
  checkSpendLimits,        // ← NEW: Hourly/daily spend caps
  checkVelocity('tip'),    // ← NEW: Max 20 tips/hour
  async (req, res) => {
    // existing tip logic...
  }
);

// Apply to gift endpoint
router.post('/gift',
  authenticateToken,
  checkSpendLimits,        // ← NEW: Hourly/daily spend caps
  checkVelocity('gift'),   // ← NEW: Max 10 gifts/hour
  async (req, res) => {
    // existing gift logic...
  }
);

// Apply to payout endpoint
router.post('/payout',
  authenticateToken,
  verifyPayoutEligibility, // ← NEW: Account age + cashout pattern checks
  async (req, res) => {
    // existing payout logic...
  }
);
```

## Protection Details

### 1. Spend Limits

**Middleware**: `checkSpendLimits`

**Blocks**:
- More than 10,000 tokens spent per hour ($500)
- More than 50,000 tokens spent per day ($2,500)

**Response when blocked**:
```json
{
  "error": "Daily limit exceeded",
  "details": {
    "allowed": false,
    "reason": "daily_limit_exceeded",
    "limit": 50000,
    "current": 45000,
    "attempted": 6000,
    "message": "Daily spend limit reached (45000/50000 tokens). Limit resets in 24 hours."
  }
}
```

**Why**: Limits blast radius of compromised accounts.

---

### 2. Velocity Limits

**Middleware**: `checkVelocity(actionType)`

**Limits**:
- Purchases: 5 per hour
- Tips: 20 per hour
- Gifts: 10 per hour

**Response when blocked**:
```json
{
  "error": "Action rate limit exceeded",
  "details": {
    "allowed": false,
    "reason": "tip_velocity_exceeded",
    "limit": 20,
    "current": 20,
    "message": "Too many tip actions. Max 20 per hour."
  }
}
```

**Why**: Prevents automated abuse and rapid token drain.

---

### 3. Payout Restrictions

**Middleware**: `verifyPayoutEligibility`

**Requirements**:
- Account must be **72 hours old** (3 days)
- Must have **earning history** (completed sessions)
- Earnings must be **48 hours old** (prevent instant cashout)
- Cashout ratio < 90% (detect money mule behavior)

**Response when blocked** (new account):
```json
{
  "error": "Payout not allowed",
  "details": {
    "allowed": false,
    "reason": "account_too_new",
    "accountAge": 24.5,
    "requiredAge": 72,
    "message": "Account must be at least 72 hours old for payouts. Current age: 24 hours."
  }
}
```

**Response when blocked** (suspicious pattern):
```json
{
  "error": "Payout requires review",
  "details": {
    "allowed": false,
    "reason": "suspicious_cashout_pattern",
    "requiresReview": true,
    "cashoutRatio": 0.95,
    "message": "Payout flagged for review. Support will contact you within 24 hours."
  }
}
```

**Why**: Stolen cards + instant cashout is the #1 fraud pattern.

---

### 4. Purchase Fraud Detection

**Middleware**: `checkPurchaseFraud`

**Blocks**:
- More than **3 failed purchases** in 1 hour (card testing)

**Response when blocked**:
```json
{
  "error": "Account restricted",
  "details": {
    "allowed": false,
    "reason": "excessive_failed_purchases",
    "failedCount": 3,
    "message": "Multiple failed purchase attempts detected. Account temporarily restricted. Contact support."
  }
}
```

**Automatic Alert**: Creates entry in `fraud_alerts` table for admin review.

**Why**: Detects stolen card validation (fraudsters test cards with small purchases).

---

## Configuration

**File**: `backend/middleware/fraud-protection.js`

```javascript
const LIMITS = {
  // Adjust these based on your legitimate use patterns
  HOURLY_SPEND_LIMIT: 10000,      // Tokens (not USD)
  DAILY_SPEND_LIMIT: 50000,

  TIPS_PER_HOUR: 20,
  GIFTS_PER_HOUR: 10,
  PURCHASES_PER_HOUR: 5,

  MIN_ACCOUNT_AGE_FOR_PAYOUT: 72,  // Hours
  MIN_EARNING_HISTORY: 48,         // Hours

  CASHOUT_VELOCITY_WINDOW: 24,    // Hours
  SUSPICIOUS_CASHOUT_RATIO: 0.9,  // 90%

  MAX_FAILED_PURCHASES: 3,
};
```

**Recommendations**:
- Start conservative (lower limits)
- Monitor `fraud_alerts` table for false positives
- Adjust limits after 1-2 weeks of data

---

## Admin Dashboard Integration

### View Fraud Alerts

**Endpoint**: `GET /api/admin/fraud/alerts`

Add to `backend/routes/admin.js`:

```javascript
const { calculateUserRiskScore } = require('../middleware/fraud-protection');

// Get pending fraud alerts
router.get('/fraud/alerts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status = 'pending', limit = 50 } = req.query;

    const alerts = await pool.query(`
      SELECT
        fa.*,
        u.email,
        u.username,
        u.created_at AS account_created,
        rs.risk_score
      FROM fraud_alerts fa
      JOIN users u ON fa.user_id = u.supabase_id
      LEFT JOIN user_risk_scores rs ON fa.user_id = rs.user_id
      WHERE fa.status = $1
      ORDER BY
        CASE fa.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        fa.created_at DESC
      LIMIT $2
    `, [status, limit]);

    res.json({
      success: true,
      alerts: alerts.rows,
      summary: await pool.query('SELECT * FROM get_fraud_alerts_summary()').then(r => r.rows[0])
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fraud alerts' });
  }
});

// Resolve fraud alert
router.post('/fraud/alerts/:alertId/resolve', authenticateToken, requireAdmin, async (req, res) => {
  const { alertId } = req.params;
  const { resolution, notes } = req.body;
  const adminId = req.user.supabase_id;

  await pool.query(`
    UPDATE fraud_alerts
    SET status = $1,
        reviewed_by = $2,
        reviewed_at = NOW(),
        resolution_notes = $3
    WHERE id = $4
  `, [resolution, adminId, notes, alertId]);

  res.json({ success: true });
});

// Calculate user risk score
router.post('/fraud/risk-score/:userId', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;

  const score = await pool.query(
    'SELECT calculate_user_risk_score($1) AS score',
    [userId]
  );

  res.json({
    success: true,
    userId,
    riskScore: parseFloat(score.rows[0].score),
    timestamp: new Date().toISOString()
  });
});
```

### Dashboard UI Example

```javascript
// Frontend component (React)
function FraudAlertsDashboard() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetch('/api/admin/fraud/alerts')
      .then(res => res.json())
      .then(data => setAlerts(data.alerts));
  }, []);

  return (
    <div>
      <h2>Pending Fraud Alerts</h2>
      {alerts.map(alert => (
        <div key={alert.id} className={`alert alert-${alert.severity}`}>
          <h3>{alert.alert_type}</h3>
          <p>User: {alert.username} ({alert.email})</p>
          <p>Risk Score: {alert.risk_score || 'N/A'}</p>
          <pre>{JSON.stringify(alert.details, null, 2)}</pre>
          <button onClick={() => resolveAlert(alert.id, 'resolved')}>
            Mark Resolved
          </button>
          <button onClick={() => resolveAlert(alert.id, 'false_positive')}>
            False Positive
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## Monitoring & Tuning

### Key Metrics to Track

```sql
-- Daily fraud alert volume
SELECT
  DATE(created_at) AS date,
  alert_type,
  COUNT(*) AS count
FROM fraud_alerts
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), alert_type
ORDER BY date DESC, count DESC;

-- False positive rate
SELECT
  alert_type,
  COUNT(*) FILTER (WHERE status = 'false_positive') AS false_positives,
  COUNT(*) FILTER (WHERE status = 'resolved') AS true_positives,
  COUNT(*) AS total,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'false_positive')::DECIMAL /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) AS false_positive_rate
FROM fraud_alerts
GROUP BY alert_type;

-- High risk users
SELECT * FROM high_risk_users LIMIT 20;

-- Blocked accounts
SELECT
  u.email,
  u.username,
  rs.risk_score,
  rs.block_reason,
  rs.blocked_at
FROM user_risk_scores rs
JOIN users u ON rs.user_id = u.supabase_id
WHERE rs.is_blocked = true
ORDER BY rs.blocked_at DESC;
```

### Tuning Guide

1. **Too many false positives** (legitimate users blocked):
   - Increase `HOURLY_SPEND_LIMIT` / `DAILY_SPEND_LIMIT`
   - Increase `TIPS_PER_HOUR` / `GIFTS_PER_HOUR`
   - Lower `SUSPICIOUS_CASHOUT_RATIO` from 0.9 to 0.95

2. **Not catching fraud**:
   - Decrease limits
   - Increase `MIN_ACCOUNT_AGE_FOR_PAYOUT` from 72h to 96h
   - Add IP/device tracking (next phase)

3. **User complaints**:
   - Check `fraud_alerts` table for their account
   - Manually resolve with `UPDATE fraud_alerts SET status = 'false_positive'`
   - Whitelist user: `UPDATE user_risk_scores SET is_blocked = false`

---

## Testing

### Test Scenarios

```bash
# Test 1: Velocity limit (should block after 5th purchase)
for i in {1..6}; do
  curl -X POST https://api.digis.com/api/tokens/purchase \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"tokenAmount": 500, "paymentMethodId": "pm_test"}'
done

# Test 2: Daily spend limit
curl -X POST https://api.digis.com/api/tokens/tip \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"creatorId": "creator-uuid", "tokenAmount": 51000}'  # Over 50k limit

# Test 3: New account payout (should block)
# Create account, wait < 72 hours, try payout
curl -X POST https://api.digis.com/api/tokens/payout \
  -H "Authorization: Bearer $NEW_USER_TOKEN" \
  -d '{"tokenAmount": 1000}'

# Test 4: Failed purchase limit
# Use invalid payment method 3 times rapidly
for i in {1..3}; do
  curl -X POST https://api.digis.com/api/tokens/purchase \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"tokenAmount": 500, "paymentMethodId": "pm_invalid"}'
done
```

---

## FAQ

**Q: Will this block legitimate power users?**
A: Unlikely. Daily limit of 50,000 tokens = $2,500. If you have users spending >$2,500/day, increase `DAILY_SPEND_LIMIT`.

**Q: What if a creator needs urgent payout?**
A: Admins can manually approve via:
```sql
UPDATE fraud_alerts
SET status = 'resolved', resolution_notes = 'Manually approved by support'
WHERE user_id = 'user-uuid' AND alert_type = 'suspicious_cashout_pattern';
```

**Q: Can I disable fraud checks for VIP users?**
A: Yes, add whitelist check:
```javascript
if (req.user.is_vip || req.user.is_verified_creator) {
  return next(); // Skip fraud checks
}
```

**Q: How do I handle chargebacks?**
A: Add to `ledger.js`:
```javascript
await debitTokens({
  userId: affectedUserId,
  tokens: chargebackAmount,
  type: 'chargeback',
  source: 'stripe',
  providerEventId: dispute.id
});
```

---

## Deployment Checklist

- [ ] Run migration 145
- [ ] Add middleware to token routes
- [ ] Test all endpoints with Postman/curl
- [ ] Configure alert thresholds for your use case
- [ ] Set up admin dashboard for fraud alerts
- [ ] Monitor `fraud_alerts` table daily for first week
- [ ] Adjust limits based on false positive rate
- [ ] Document internal process for manual review

---

## Support

**Stuck?** Check:
1. Migration ran successfully: `SELECT * FROM fraud_alerts LIMIT 1;`
2. Middleware imported: `const { checkSpendLimits } = require('../middleware/fraud-protection');`
3. Routes using middleware: Search for `checkSpendLimits` in `tokens.js`
4. Logs: `tail -f backend/logs/app.log | grep fraud`

**Need help?** Create issue with:
- Error message
- Which endpoint
- User account age
- Recent `fraud_alerts` entries for that user
