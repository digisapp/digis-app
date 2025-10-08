# Vercel Serverless Migration Audit

**Date**: 2025-10-07
**Status**: Phase 0 - Audit Complete

## Critical Blockers for Vercel Serverless

### 1. Socket.io Real-time Events (CRITICAL - Must Replace)

**Files Using Socket.io:**
- `backend/utils/socket.js` - Main Socket.io implementation
- `backend/utils/socket-enhanced.js` - Enhanced Socket implementation
- `backend/utils/stream-activity-monitor.js` - Stream monitoring
- `backend/utils/challenge-service.js` - Challenge events
- `backend/utils/websocket-validator.js` - Validation

**Socket.io Events to Migrate:**

#### User Presence
- `user-presence` - User online/offline status
- `user-presence-updated` - Presence changes
- `connection-success` - Connection confirmation

#### Streaming
- `stream:${streamId}` - Room-based streaming events
- `viewer-count-updated` - Live viewer counts
- `stream-joined` / `stream-left` - Join/leave events
- `stream-analytics` - Real-time analytics
- `stream-chat-message` - Chat messages
- `stream_inactivity_warning` - Inactivity warnings
- `stream_auto_ended` - Auto-end notifications

#### Reactions & Polls
- `reaction_sent` - Individual reactions
- `reaction_burst` - Reaction bursts
- `poll_created` / `poll_updated` - Poll events

#### Challenges & Achievements
- `challenge_completed` - Challenge completion
- `new_challenge` - New challenge notifications
- `milestone_achieved` - User milestones
- `fan_milestone` - Creator notifications

**Replacement Strategy: Supabase Realtime Channels**

---

### 2. Cron Jobs (CRITICAL - Must Replace)

**Active Cron Jobs:**

#### Payouts (`backend/jobs/cron-config.js`)
- `0 2 1 * *` - Monthly payouts (1st of month, 2 AM UTC)
- `0 2 15 * *` - Bi-monthly payouts (15th of month, 2 AM UTC)
- `0 10 * * *` - Daily retry of failed payouts (10 AM UTC)
- `0 * * * *` - Hourly cleanup tasks

#### Withdrawals (`backend/utils/cron-withdrawals.js`)
- `0 2 1 * *` - Monthly withdrawals (1st of month, 2 AM UTC)
- `0 2 15 * *` - Bi-monthly withdrawals (15th of month, 2 AM UTC)

#### Loyalty Perks (`backend/jobs/loyalty-perk-delivery.js`)
- `0 10 * * *` - Daily perk delivery (10 AM UTC)
- `0 10 * * 1` - Weekly perks (Mondays, 10 AM UTC)
- `0 0 1 * *` - Monthly perks (1st of month, midnight UTC)
- `0 * * * *` - Hourly perk checks
- `0 */6 * * *` - Every 6 hours perk validation

**Replacement Strategy: Vercel Cron + Inngest/QStash**

---

### 3. File System Operations (MEDIUM - Logging Only)

**Issue**: Winston file-based logging to `/logs/` directory
- Vercel filesystem is read-only and ephemeral
- Logs will be lost on function cold starts

**Files Affected:**
- `backend/api/index.js:10` - Winston logger import
- `backend/utils/secureLogger.js` - Logger configuration
- `backend/jobs/cron-config.js` - Cron logging

**Replacement Strategy: Axiom/Logtail/Datadog**

---

### 4. Background Workers (CRITICAL - Must Replace)

**BullMQ Workers:**
- `backend/api/index.js:622-629` - Worker initialization
- `backend/lib/queue.js` - Queue configuration

**Issue**: BullMQ requires persistent process, won't work in serverless

**Replacement Strategy: Inngest or separate worker service**

---

### 5. Stream Activity Monitor (CRITICAL - Must Replace)

**File**: `backend/utils/stream-activity-monitor.js`
- Uses `setInterval` for continuous monitoring
- Emits Socket.io events for warnings

**Replacement Strategy**:
- Migrate to Vercel Cron (check every 5 minutes)
- Use Supabase Realtime for notifications

---

## Migration Path: Supabase Realtime Mapping

| Socket.io Event | Supabase Channel | Topic |
|----------------|------------------|-------|
| `user-presence` | `presence:global` | `user:${userId}` |
| `stream:${id}` (viewer count) | `stream:${id}` | `viewer_count` |
| `stream:${id}` (chat) | `stream:${id}:chat` | `message` |
| `stream:${id}` (reactions) | `stream:${id}:reactions` | `reaction` |
| `stream:${id}` (polls) | `stream:${id}:polls` | `poll_event` |
| `user:${id}` (notifications) | `user:${id}:notifications` | `notification` |
| `challenge_completed` | `user:${id}:challenges` | `challenge_update` |

---

## Environment Variables Needed

### Backend (Vercel Project)
```bash
# Already in .env.example - ensure in Vercel:
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
AGORA_CUSTOMER_KEY=
AGORA_CUSTOMER_SECRET=
UPSTASH_REDIS_REST_URL=          # REQUIRED
UPSTASH_REDIS_REST_TOKEN=        # REQUIRED
POSTMARK_API_KEY=
SENTRY_DSN=
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

# New additions:
AXIOM_API_TOKEN=                  # For logging
INNGEST_SIGNING_KEY=              # For background jobs (if using Inngest)
UPSTASH_QSTASH_URL=              # For cron jobs (if using QStash)
UPSTASH_QSTASH_TOKEN=
VERCEL_CRON_SECRET=              # For securing Vercel Cron endpoints
```

### Frontend (Vercel Project)
```bash
# From .env.example:
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BACKEND_URL=https://your-backend.vercel.app
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_AGORA_APP_ID=
VITE_SENTRY_DSN=
VITE_APP_VERSION=2.0.0
```

---

## Next Steps

1. **Phase 1**: Create Supabase Realtime adapter (PRIORITY)
2. **Phase 2**: Replace Socket.io with adapter
3. **Phase 3**: Migrate cron jobs to Vercel Cron
4. **Phase 4**: Set up Inngest for background workers
5. **Phase 5**: Replace Winston with Axiom
6. **Phase 6**: Update CORS for Vercel preview URLs
7. **Phase 7**: Create separate vercel.json configs
8. **Phase 8**: Deploy and test

---

## Files to Modify

### High Priority (Must Change)
- [x] `backend/api/index.js` - Disable cron, workers, Socket.io on Vercel
- [ ] `backend/utils/socket.js` - Replace with Supabase adapter
- [ ] `backend/utils/socket-enhanced.js` - Replace with Supabase adapter
- [ ] `backend/utils/stream-activity-monitor.js` - Convert to Vercel Cron
- [ ] `backend/jobs/cron-config.js` - Convert to Vercel Cron
- [ ] `backend/utils/cron-withdrawals.js` - Convert to Vercel Cron
- [ ] `backend/jobs/loyalty-perk-delivery.js` - Convert to Vercel Cron

### Medium Priority (Should Change)
- [ ] `backend/utils/secureLogger.js` - Add Axiom transport
- [ ] `backend/middleware/rate-limiters.js` - Replace with Upstash Ratelimit
- [ ] `backend/routes/webhook.js` - Verify raw body handling

### Low Priority (Configuration)
- [ ] `vercel.json` (root) - Create monorepo OR separate configs
- [ ] `backend/vercel.json` - Update if needed
- [ ] `frontend/vercel.json` - Update if needed

---

## Estimated Migration Time

- Phase 1 (Supabase adapter): 4-6 hours
- Phase 2 (Replace Socket.io): 6-8 hours
- Phase 3 (Cron migration): 3-4 hours
- Phase 4 (Background workers): 2-3 hours
- Phase 5 (Logging): 1-2 hours
- Phase 6-8 (Config & deploy): 2-3 hours

**Total**: 18-26 hours of development work

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Real-time features break | HIGH | Comprehensive testing with Supabase Realtime before deploy |
| Payout/withdrawal jobs fail | CRITICAL | Run parallel system for 1 month, verify with database logs |
| Rate limiting breaks | MEDIUM | Upstash has similar API, add fallback logic |
| Logs lost | LOW | Axiom captures everything, set up alerts |
| Preview env data pollution | MEDIUM | Use separate Supabase/Stripe test projects |

