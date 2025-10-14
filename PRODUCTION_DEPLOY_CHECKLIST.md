# Production Deployment Checklist
## Fan Privacy & Calls System

**Target**: Safe, incremental rollout with zero downtime and instant rollback capability.

---

## ✅ Pre-Deployment (Staging)

### 1. Database Migration (CRITICAL)

- [ ] **Backup production database**
  ```bash
  # Get snapshot or pg_dump before touching anything
  pg_dump $DATABASE_URL > backup_pre_fan_privacy_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **Test migration on staging first**
  ```bash
  cd backend
  # Apply migration
  npm run migrate

  # Verify schema changes
  psql $DATABASE_URL -c "\d users"
  psql $DATABASE_URL -c "\d creator_fan_relationships"
  psql $DATABASE_URL -c "\d calls"
  psql $DATABASE_URL -c "\d call_invitations"
  ```

- [ ] **Verify new columns have defaults**
  ```sql
  SELECT fan_privacy_visibility, fan_allow_dm, fan_allow_calls
  FROM users
  LIMIT 5;
  -- Should show: private, interacted, interacted (defaults)
  ```

- [ ] **Test database functions**
  ```sql
  -- Should return boolean
  SELECT creator_has_relationship(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  );
  ```

- [ ] **Have rollback script ready**
  ```bash
  # Keep 132_fan_privacy_and_calls_DOWN.sql handy
  # Test rollback on staging clone
  psql $DATABASE_URL < backend/migrations/132_fan_privacy_and_calls_DOWN.sql
  ```

### 2. Environment Variables

- [ ] **Verify Agora credentials exist**
  ```bash
  echo $AGORA_APP_ID
  echo $AGORA_APP_CERTIFICATE
  # Both must be set, non-empty
  ```

- [ ] **Set feature flags (DISABLED initially)**
  ```bash
  # In Vercel/deployment platform
  FEATURE_CALLS=false
  FEATURE_FAN_SHARE_CARD=false
  FEATURE_FAN_PRIVACY=true
  FEATURE_FAN_MINI_PROFILE=true
  ```

- [ ] **Verify CORS origins**
  ```bash
  echo $FRONTEND_URL
  # Should be: https://digis.cc
  ```

### 3. Code Review & Testing

- [ ] **Run all tests**
  ```bash
  cd backend
  npm test

  cd ../frontend
  npm test
  ```

- [ ] **Test API endpoints (staging)**
  ```bash
  # Test fan privacy settings
  curl -X GET https://staging-api.digis.cc/api/fans/me \
    -H "Authorization: Bearer $TOKEN"

  # Test call initiation (should return 403 FEATURE_DISABLED)
  curl -X POST https://staging-api.digis.cc/api/calls/initiate \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"fanId":"...","callType":"voice"}'
  ```

- [ ] **Verify structured error responses**
  ```json
  {
    "ok": false,
    "code": "FEATURE_DISABLED",
    "error": "...",
    "timestamp": "..."
  }
  ```

### 4. Rate Limiting

- [ ] **Verify rate limiters in api/index.js**
  ```javascript
  app.use('/api/fans', rateLimiters.api || defaultLimiter, fansRoutes);
  app.use('/api/calls', rateLimiters.api || defaultLimiter, callsRoutes);
  ```

- [ ] **Test rate limit enforcement** (staging)
  ```bash
  # Send 20 rapid requests, should get 429 after limit
  for i in {1..20}; do
    curl -X POST https://staging-api.digis.cc/api/calls/initiate \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"fanId":"...","callType":"voice"}'
  done
  ```

### 5. Observability

- [ ] **Verify Sentry is capturing errors**
  ```bash
  curl https://staging-api.digis.cc/debug-sentry
  # Check Sentry dashboard for error
  ```

- [ ] **Add custom metrics (if using)**
  ```javascript
  // In calls.js
  logger.info('Call initiated', {
    callId,
    creatorId,
    fanId,
    callType
  });
  ```

- [ ] **Test structured logging**
  ```bash
  # Check logs for JSON format
  tail -f backend/logs/combined.log | jq .
  ```

---

## 🚀 Deployment Steps

### Phase 1: Database Only (Safe Start)

**Goal**: Apply schema changes without enabling features.

1. **Backup production DB** (repeat, critical)
   ```bash
   pg_dump $PROD_DATABASE_URL > backup_prod_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Apply migration to production**
   ```bash
   DATABASE_URL=$PROD_DATABASE_URL npm run migrate
   ```

3. **Verify migration succeeded**
   ```sql
   -- Check tables exist
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('creator_fan_relationships', 'calls', 'call_invitations');

   -- Check columns exist
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'users'
   AND column_name LIKE 'fan_%';
   ```

4. **Monitor for errors** (5 minutes)
   - Check Sentry
   - Check application logs
   - Verify no 500s in production

5. **If migration fails**: ROLLBACK IMMEDIATELY
   ```bash
   psql $PROD_DATABASE_URL < backend/migrations/132_fan_privacy_and_calls_DOWN.sql
   ```

### Phase 2: Deploy Backend (Features OFF)

**Goal**: Deploy code without exposing new features.

1. **Deploy backend with flags OFF**
   ```bash
   # Vercel deployment
   vercel --prod

   # Verify environment variables
   vercel env ls
   # Should show: FEATURE_CALLS=false
   ```

2. **Smoke test health endpoint**
   ```bash
   curl https://api.digis.cc/health
   # Should return 200 OK
   ```

3. **Verify new routes respond (but disabled)**
   ```bash
   curl -X GET https://api.digis.cc/api/fans/me \
     -H "Authorization: Bearer $TOKEN"
   # Should work (FAN_PRIVACY=true)

   curl -X POST https://api.digis.cc/api/calls/initiate \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"fanId":"...","callType":"voice"}'
   # Should return 403 FEATURE_DISABLED (CALLS=false)
   ```

4. **Monitor for 10 minutes**
   - Check error rate
   - Check response times
   - Verify existing features work

### Phase 3: Deploy Frontend

**Goal**: Deploy UI that respects feature flags.

1. **Deploy frontend**
   ```bash
   cd frontend
   npm run build
   vercel --prod
   ```

2. **Verify soft auth still works**
   - Visit https://digis.cc/creator/someusername (logged out)
   - Page should render without auth wall
   - Click "Follow" → should show auth modal

3. **Verify fan privacy settings appear**
   - Log in as fan
   - Go to Settings
   - Fan Privacy section should appear
   - Make changes, verify they persist

4. **Verify call UI is hidden**
   - Call buttons should not appear (CALLS=false)
   - No errors in console

### Phase 4: Enable Features (Gradual)

**Goal**: Incrementally enable features, monitor each.

#### 4a. Enable Fan Mini Profiles (Low Risk)

1. **Set flag**
   ```bash
   vercel env add FEATURE_FAN_MINI_PROFILE true
   vercel --prod
   ```

2. **Test creator views fan**
   - Log in as creator
   - View a fan you've interacted with
   - Should see mini profile
   - Verify permissions (canMessage, canCall)

3. **Monitor for 30 minutes**

#### 4b. Enable Calls (High Risk - Do Last)

1. **Set flag**
   ```bash
   vercel env add FEATURE_CALLS true
   vercel --prod
   ```

2. **Start call expiration job**
   ```javascript
   // In api/index.js (already added)
   const callExpirationJob = require('../jobs/expire-call-invitations');
   callExpirationJob.start();
   ```

3. **Verify job is running**
   ```bash
   # Check logs for:
   # "Call invitation expiration job started"
   ```

4. **Test call flow (end-to-end)**
   - Creator initiates call
   - Fan receives invitation
   - Fan accepts
   - Both join Agora channel
   - End call
   - Verify billing

5. **Monitor call metrics**
   - calls.ring
   - calls.accept
   - calls.connect
   - calls.missed
   - avg duration

6. **If issues**: DISABLE IMMEDIATELY
   ```bash
   vercel env add FEATURE_CALLS false
   vercel --prod
   ```

---

## 🔍 Post-Deployment Monitoring

### First Hour

- [ ] **Check error rate** (should be < 0.1%)
- [ ] **Check response times** (p95 < 500ms)
- [ ] **Verify no auth failures** (401/403 rate normal)
- [ ] **Check Sentry for new errors**
- [ ] **Monitor database load** (CPU, connections)

### First Day

- [ ] **Check call success rate** (initiate → connect > 80%)
- [ ] **Check for spam patterns** (cooldown working?)
- [ ] **Review structured logs** (any unexpected codes?)
- [ ] **Check token balance accuracy** (billing correct?)

### First Week

- [ ] **Analyze call duration distribution**
- [ ] **Check fan privacy adoption** (% using settings)
- [ ] **Review abuse reports** (any blocks/spam?)
- [ ] **Optimize rate limits** (adjust if needed)

---

## 🚨 Rollback Procedures

### Level 1: Disable Feature (Instant)

```bash
# If calls are causing issues
vercel env add FEATURE_CALLS false
vercel --prod
# Takes effect immediately, no downtime
```

### Level 2: Revert Code (5 minutes)

```bash
# Revert to previous deployment
vercel rollback
# Confirm working state
```

### Level 3: Rollback Database (15 minutes, DESTRUCTIVE)

```bash
# WARNING: Deletes all call history
psql $PROD_DATABASE_URL < backend/migrations/132_fan_privacy_and_calls_DOWN.sql

# Restore from backup if needed
psql $PROD_DATABASE_URL < backup_prod_YYYYMMDD_HHMMSS.sql
```

---

## 📊 Success Metrics

### Technical Metrics

- **Uptime**: > 99.9% during rollout
- **Error rate**: < 0.1%
- **P95 latency**: < 500ms for API calls
- **Database CPU**: < 80%

### Feature Metrics

- **Call connect rate**: > 80% (initiate → connected)
- **Call completion rate**: > 90% (connected → ended cleanly)
- **Privacy adoption**: > 50% fans customize settings within 7 days
- **Abuse rate**: < 1% calls reported/blocked

### Business Metrics

- **Creator adoption**: % creators initiate calls
- **Fan engagement**: % fans accept calls
- **Revenue**: Average tokens earned per call
- **Retention**: % users return after first call

---

## 🛡️ Safety Guardrails (Already Implemented)

### Abuse Prevention
- ✅ Call cooldown (60s per creator-fan pair)
- ✅ Block list enforcement
- ✅ Permission checks (relationship-based)
- ✅ Rate limiting (5 calls/min per IP, 10/min per user)

### Error Handling
- ✅ Structured error responses (`{ ok, code, error }`)
- ✅ Graceful degradation (features off if flag disabled)
- ✅ No 500s on auth failures (401/403 instead)

### Data Safety
- ✅ Rollback script available
- ✅ Foreign key constraints (cascade deletes)
- ✅ Check constraints (valid enums)
- ✅ Indexes on all queries

---

## 📝 Communication Plan

### Before Deployment

**To Team**:
> Deploying fan privacy & calls system today at 3pm EST.
> - Database migration first (5 min)
> - Code deploy with features OFF (15 min)
> - Gradual flag enablement (1-2 hours)
> - Monitoring window: 24 hours
> - Rollback plan ready

**To Users** (if downtime expected):
> We're improving your privacy controls today. No action needed.

### During Issues

**If rollback needed**:
> We've temporarily disabled calls while we fix an issue.
> Your data and privacy settings are safe.
> We'll re-enable soon.

### Post-Deployment

**Success**:
> ✅ Fan privacy system live
> ✅ Voice/video calls available
> ✅ New privacy controls in Settings

---

## 🔧 Quick Fixes for Common Issues

### Issue: Calls not connecting

**Check**:
1. Agora credentials set?
2. Tokens generated correctly?
3. UIDs stable and unique?
4. Channel name valid?

**Fix**:
```bash
# Test token generation
curl -X GET https://api.digis.cc/api/agora/token?channel=test&uid=123&role=host \
  -H "Authorization: Bearer $TOKEN"
```

### Issue: Permission denied errors

**Check**:
1. Relationship exists in DB?
2. Fan policy allows?
3. Fan has blocked creator?

**Fix**:
```sql
-- Verify relationship
SELECT * FROM creator_fan_relationships
WHERE creator_id = '...' AND fan_id = '...';

-- Check block status
SELECT * FROM creator_blocked_users
WHERE creator_id = '...' AND blocked_user_id = '...';
```

### Issue: Invitations not expiring

**Check**:
1. Expiration job running?
2. Job interval correct?

**Fix**:
```bash
# Manually expire stale invitations
psql $DATABASE_URL -c "
  UPDATE call_invitations
  SET state = 'expired'
  WHERE state = 'pending' AND expires_at < NOW();
"
```

### Issue: High database CPU

**Check**:
1. Missing indexes?
2. Slow queries?

**Fix**:
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Add missing indexes (all should exist from migration)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_state ON calls(state);
```

---

## ✅ Final Pre-Deploy Checklist

- [ ] ✅ Backup created
- [ ] ✅ Migration tested on staging
- [ ] ✅ Rollback script verified
- [ ] ✅ Feature flags set (OFF initially)
- [ ] ✅ CORS configured
- [ ] ✅ Rate limiters in place
- [ ] ✅ Structured errors implemented
- [ ] ✅ Call expiration job ready
- [ ] ✅ Monitoring configured
- [ ] ✅ Team notified
- [ ] ✅ Rollback plan documented
- [ ] ✅ Success metrics defined

---

## 🎯 Deployment Timeline

**Total time**: 2-3 hours (with monitoring)

| Time | Activity | Duration | Risk |
|------|----------|----------|------|
| T+0 | Backup DB | 5 min | None |
| T+5 | Apply migration | 5 min | Medium |
| T+10 | Monitor | 10 min | Low |
| T+20 | Deploy backend (flags OFF) | 10 min | Low |
| T+30 | Smoke test | 10 min | None |
| T+40 | Deploy frontend | 10 min | Low |
| T+50 | Test soft auth | 10 min | None |
| T+60 | Enable FAN_MINI_PROFILE | 5 min | Low |
| T+65 | Monitor | 30 min | Low |
| T+95 | Enable CALLS | 5 min | Medium |
| T+100 | Test E2E call | 15 min | Medium |
| T+115 | Monitor calls | 60 min | Medium |
| T+175 | Success! 🎉 | - | - |

**Abort criteria**: If error rate > 1% or critical bug, disable feature flags immediately.

---

## 📞 Support Contacts

- **Backend Issues**: Check Sentry, backend logs
- **Database Issues**: Check pg_stat_activity, slow query log
- **Frontend Issues**: Check browser console, network tab
- **Agora Issues**: Check Agora dashboard, token expiration

---

**Remember**: Ship incrementally, monitor constantly, rollback quickly if needed. Better to disable a feature than to ship a broken one.

✅ **Ready to deploy!**
