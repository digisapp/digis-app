# 🚀 Payout System Go-Live Checklist

Complete production deployment checklist for the Stripe Connect twice-monthly payout system.

---

## ✅ Phase 1: Environment & Configuration (30 minutes)

### 1.1 Set Environment Variables

Add to your production `.env` or Vercel environment variables:

```bash
# Required
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
CRON_SECRET_KEY=<generate_with_crypto_random_bytes>

# Recommended
PAYOUT_MIN_THRESHOLD_CENTS=1000  # $10 minimum
PAYOUT_RESERVE_PERCENT=0         # Start with 0%
PLATFORM_DEFAULT_CURRENCY=usd
PLATFORM_FEE_PERCENT=10          # Your platform fee

# Optional
PAYOUT_TIMEZONE=UTC
SLACK_PAYOUT_WEBHOOK_URL=https://hooks.slack.com/...
PAYOUT_ALERT_EMAIL=ops@digis.cc
```

**Generate CRON_SECRET_KEY**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 1.2 Update Frontend Environment

Add to frontend `.env.production`:

```bash
VITE_BACKEND_URL=https://api.digis.cc
```

### 1.3 Verify CORS

Ensure backend CORS allows your frontend origin:

```javascript
// backend/middleware/cors-config.js
const allowedOrigins = [
  'https://digis.cc',
  'https://www.digis.cc',
  // ... existing origins
];
```

**✅ Checklist**:
- [ ] STRIPE_SECRET_KEY set (live key)
- [ ] STRIPE_WEBHOOK_SECRET set
- [ ] CRON_SECRET_KEY generated and set
- [ ] Payout policy vars configured
- [ ] Frontend env updated
- [ ] CORS configured

---

## ✅ Phase 2: Stripe Configuration (20 minutes)

### 2.1 Set Up Webhooks

1. Go to: https://dashboard.stripe.com/webhooks
2. Click **+ Add endpoint**
3. **Endpoint URL**: `https://api.digis.cc/webhooks/stripe`
4. **Events to send**:
   - `account.updated`
   - `payout.paid`
   - `payout.failed`
   - `payout.canceled`
   - `payment_intent.succeeded` (optional analytics)
   - `charge.dispute.created` (optional)
5. **API version**: Latest (2024-06-20 or newer)
6. Click **Add endpoint**
7. **Copy signing secret** → Set as `STRIPE_WEBHOOK_SECRET`

### 2.2 Test Webhook Delivery

```bash
# Send test event
curl -X POST https://api.digis.cc/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"ping"}'

# Check logs for webhook receipt
```

### 2.3 Verify Destination Charges

Ensure your payment creation code uses:

```javascript
stripe.paymentIntents.create({
  amount: totalAmountCents,
  currency: 'usd',
  application_fee_amount: platformFeeCents,
  transfer_data: {
    destination: creator.stripeAccountId  // ← Critical
  },
  // ... other params
})
```

**✅ Checklist**:
- [ ] Webhook endpoint added in Stripe
- [ ] All required events selected
- [ ] Signing secret copied
- [ ] Test webhook sent successfully
- [ ] Payment code uses Destination Charges

---

## ✅ Phase 3: Cron/Scheduler Setup (15 minutes)

### Option A: Vercel + QStash

1. Sign up for QStash: https://console.upstash.com
2. Create cron trigger:
   - **URL**: `https://api.digis.cc/internal/payouts/run`
   - **Schedule**: `0 6 1,15 * *` (6am UTC on 1st & 15th)
   - **Method**: POST
   - **Headers**:
     ```
     X-Cron-Secret: <your_cron_secret>
     Content-Type: application/json
     ```
   - **Body**: `{}`

### Option B: Cloud Scheduler (GCP)

```bash
gcloud scheduler jobs create http payout-cycle-1st \
  --schedule="0 6 1 * *" \
  --uri="https://api.digis.cc/internal/payouts/run" \
  --http-method=POST \
  --headers="X-Cron-Secret=<your_secret>" \
  --message-body='{"cycleDate":""}' \
  --time-zone="UTC"

gcloud scheduler jobs create http payout-cycle-15th \
  --schedule="0 6 15 * *" \
  --uri="https://api.digis.cc/internal/payouts/run" \
  --http-method=POST \
  --headers="X-Cron-Secret=<your_secret>" \
  --message-body='{}' \
  --time-zone="UTC"
```

### Option C: GitHub Actions

Create `.github/workflows/payouts.yml`:

```yaml
name: Trigger Payouts
on:
  schedule:
    - cron: '0 6 1,15 * *'  # 6am UTC on 1st & 15th
  workflow_dispatch:  # Allow manual trigger

jobs:
  trigger-payouts:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger payout run
        run: |
          curl -X POST https://api.digis.cc/internal/payouts/run \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET_KEY }}" \
            -d '{}'
```

**✅ Checklist**:
- [ ] Cron system selected and configured
- [ ] Schedule set to 6am UTC on 1st & 15th
- [ ] CRON_SECRET_KEY added to scheduler
- [ ] Test trigger sent successfully
- [ ] Backup/manual trigger method documented

---

## ✅ Phase 4: Database Verification (10 minutes)

### 4.1 Run Migrations

Ensure payout tables exist:

```bash
cd backend
npm run migrate  # or your migration command
```

### 4.2 Verify Tables

```sql
-- Check tables exist
\dt creator_stripe_accounts
\dt creator_payouts
\dt payout_runs
\dt creator_earnings

-- Verify indexes
\di creator_payouts_*

-- Check functions
\df get_creator_pending_balance
\df can_creator_receive_payouts
```

### 4.3 Seed Test Data (Optional)

```sql
-- Add payout settings for existing creators
INSERT INTO creator_payout_settings (creator_id, payout_enabled, minimum_payout_amount)
SELECT supabase_id, true, 50.00 
FROM users 
WHERE is_creator = true
ON CONFLICT (creator_id) DO NOTHING;
```

**✅ Checklist**:
- [ ] All migrations run successfully
- [ ] Tables and indexes exist
- [ ] Database functions work
- [ ] Test data seeded (if needed)

---

## ✅ Phase 5: Staging Smoke Tests (45 minutes)

Run all smoke tests from `docs/SMOKE_TESTS.md`:

```bash
cd backend/docs
# Follow each test in SMOKE_TESTS.md
```

**Critical Tests**:

1. **Onboarding**: Creator can complete Stripe setup ✅
2. **Balance**: Destination charge creates balance ✅
3. **Payout**: Manual trigger creates payout ✅
4. **Threshold**: Below-threshold creators skipped ✅
5. **Failure**: Failed payouts handled gracefully ✅
6. **Webhooks**: Stripe events update DB ✅
7. **Idempotency**: Duplicate runs prevented ✅
8. **Auth**: Cron endpoint protected ✅

**✅ Checklist**:
- [ ] All 10 smoke tests pass
- [ ] Test payouts visible in Stripe Dashboard
- [ ] Frontend displays payout history
- [ ] Error handling works
- [ ] Logs show correct flow

---

## ✅ Phase 6: Monitoring & Alerts (30 minutes)

### 6.1 Set Up Sentry Alerts

Create alert rules for:
- Payout run failures
- Webhook delivery errors
- Database connection issues

### 6.2 Configure Slack Notifications

Add to `.env`:
```bash
SLACK_PAYOUT_WEBHOOK_URL=https://hooks.slack.com/services/xxx
```

Test:
```bash
curl -X POST $SLACK_PAYOUT_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"text":"🧪 Payout system test alert"}'
```

### 6.3 Set Up Dashboard

Create monitoring dashboard with:
- Payout success rate (last 30 days)
- Failed payout count
- Total payouts amount
- Average payout time
- Creator onboarding rate

**✅ Checklist**:
- [ ] Sentry alerts configured
- [ ] Slack webhook tested
- [ ] Monitoring dashboard created
- [ ] Alert thresholds set
- [ ] On-call rotation defined

---

## ✅ Phase 7: Documentation & Training (20 minutes)

### 7.1 Update Help Center

Add creator-facing docs:
- **"How to Set Up Payouts"** - Guide with screenshots
- **"When Do I Get Paid?"** - Explain 1st & 15th schedule
- **"Payout Troubleshooting"** - Common issues
- **"Banking Requirements"** - Stripe requirements by country

### 7.2 Create Internal Runbook

Document for support team:
- How to check payout status
- How to manually trigger payout
- How to handle failed payouts
- How to generate account link for creator
- Escalation procedures

### 7.3 Brief Support Team

Hold 15-minute session covering:
- Payout flow overview
- Common issues and solutions
- How to use admin tools
- When to escalate

**✅ Checklist**:
- [ ] Help Center articles published
- [ ] Internal runbook created
- [ ] Support team briefed
- [ ] FAQ updated
- [ ] Contact info documented

---

## ✅ Phase 8: Gradual Rollout (1-2 weeks)

### Week 1: Beta Test (10-20 creators)

1. **Select beta testers**:
   - Mix of high/medium/low earners
   - Different countries (if multi-currency)
   - Active creators who can provide feedback

2. **Enable payouts**:
   ```sql
   UPDATE users 
   SET payout_beta_enabled = true 
   WHERE supabase_id IN ('creator1', 'creator2', ...);
   ```

3. **Monitor closely**:
   - Daily health checks
   - Review all payout logs
   - Collect feedback
   - Fix any issues

### Week 2: Full Rollout (All creators)

1. **Announce launch**:
   - Email all creators
   - In-app notification
   - Blog post / social media

2. **Enable for all**:
   ```sql
   UPDATE users 
   SET payout_enabled = true 
   WHERE is_creator = true;
   ```

3. **Monitor at scale**:
   - Track payout success rate
   - Monitor failed payouts
   - Watch for support tickets
   - Iterate based on feedback

**✅ Checklist**:
- [ ] Beta testers selected
- [ ] Beta rollout completed
- [ ] Feedback collected and addressed
- [ ] Full rollout announced
- [ ] All creators enabled
- [ ] Post-launch monitoring active

---

## ✅ Phase 9: First Production Payout (Day 1 or 15)

### Pre-Run Checklist (1 hour before)

```bash
# 1. Verify cron is armed
curl https://api.digis.cc/internal/payouts/health \
  -H "X-Cron-Secret: $CRON_SECRET"

# 2. Check Stripe balance
# Ensure platform account has funds if using Transfers (not needed for Destination Charges)

# 3. Review eligible creators
psql $DATABASE_URL -c "
  SELECT COUNT(*) as eligible_creators
  FROM creator_stripe_accounts
  WHERE payouts_enabled = true
    AND charges_enabled = true;
"

# 4. Check for stuck runs
psql $DATABASE_URL -c "
  SELECT * FROM payout_runs
  WHERE status = 'running'
    AND started_at < NOW() - INTERVAL '1 hour';
"
```

### During Run (Real-time monitoring)

```bash
# Tail logs
tail -f /var/log/app.log | grep payout

# Watch database
watch -n 5 "psql $DATABASE_URL -c \"
  SELECT status, COUNT(*) 
  FROM creator_payouts 
  WHERE created_at > NOW() - INTERVAL '1 hour'
  GROUP BY status;
\""
```

### Post-Run Checklist (30 minutes after)

```bash
# 1. Check run status
curl https://api.digis.cc/internal/payouts/status/$RUN_ID \
  -H "X-Cron-Secret: $CRON_SECRET"

# 2. Verify payouts in Stripe
# Go to: https://dashboard.stripe.com/connect/payouts

# 3. Check for failures
psql $DATABASE_URL -c "
  SELECT creator_id, net_payout_amount, failure_reason
  FROM creator_payouts
  WHERE status = 'failed'
    AND created_at > NOW() - INTERVAL '1 hour';
"

# 4. Review logs for errors
grep -i error /var/log/app.log | tail -50

# 5. Send summary to team
# Use your alerting system or manual Slack message
```

**✅ Checklist**:
- [ ] Pre-run checks completed
- [ ] Cron triggered successfully
- [ ] Payouts created in Stripe
- [ ] No unexpected failures
- [ ] Team notified of results
- [ ] Issues documented (if any)

---

## ✅ Phase 10: Ongoing Operations

### Daily

- [ ] Check health endpoint
- [ ] Review failed payouts (if any)
- [ ] Monitor support tickets

### Weekly

- [ ] Review payout success rate
- [ ] Check for stuck runs
- [ ] Update FAQ based on questions
- [ ] Review Stripe account statuses

### Monthly

- [ ] Analyze payout metrics
- [ ] Review and adjust reserve percentage
- [ ] Update documentation
- [ ] Collect creator feedback

### Quarterly

- [ ] Security audit
- [ ] Performance review
- [ ] Compliance check (1099-K, etc.)
- [ ] Disaster recovery drill

---

## 🚨 Emergency Procedures

### Rollback Plan

If critical issues arise:

1. **Pause cron**:
   ```bash
   # Disable in QStash/Cloud Scheduler
   # Or: Remove CRON_SECRET_KEY from env (breaks auth)
   ```

2. **Notify creators**:
   - In-app banner
   - Email notification
   - Provide ETA for resolution

3. **Revert changes**:
   ```bash
   git revert <commit_hash>
   vercel --prod
   ```

4. **Manual payouts** (if needed):
   - Export eligible creators from DB
   - Create payouts manually in Stripe Dashboard
   - Update DB records manually

### Support Escalation

**Level 1** (Support agent):
- Check payout status in DB
- Generate new account link
- Refer to runbook

**Level 2** (Engineer):
- Check logs and Sentry
- Manually trigger retry
- Investigate Stripe API issues

**Level 3** (On-call):
- Critical system issues
- Mass payout failures
- Security incidents

---

## 📊 Success Metrics

Track these KPIs:

- **Payout Success Rate**: Target > 98%
- **Average Processing Time**: < 5 minutes per run
- **Failed Payout Resolution Time**: < 24 hours
- **Creator Satisfaction**: > 4.5/5 stars
- **Support Ticket Volume**: < 5% of creators per month

---

## ✅ Final Sign-Off

Before marking go-live as complete:

- [ ] All environment variables set
- [ ] Stripe webhooks configured and tested
- [ ] Cron scheduler active
- [ ] Database migrations applied
- [ ] All smoke tests pass
- [ ] Monitoring and alerts active
- [ ] Documentation complete
- [ ] Support team trained
- [ ] Beta rollout successful
- [ ] First production payout completed
- [ ] Post-launch review scheduled

**Signed off by**:
- Engineering Lead: _______________
- Product Manager: _______________
- Head of Operations: _______________
- Date: _______________

---

## 🎉 Congratulations!

Your twice-monthly payout system is now live and serving creators!

**Next steps**:
1. Monitor closely for first 2 weeks
2. Iterate based on feedback
3. Consider enhancements:
   - Instant payouts for premium creators
   - Multi-currency support
   - Payout on demand
   - Tax reporting features

**Need help?** Refer to:
- `docs/PAYOUT_SYSTEM.md` - Full system documentation
- `docs/SMOKE_TESTS.md` - Testing guide
- `docs/GO_LIVE_CHECKLIST.md` - This document
