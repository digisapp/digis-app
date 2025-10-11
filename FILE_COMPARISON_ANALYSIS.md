# 📁 Duplicate File Analysis - Digis Backend

## Summary

You have several **duplicate/versioned files** in your backend that serve similar purposes. Here's what each does and which ones to keep:

---

## 1️⃣ **Payment Routes**

### **`routes/payments.js`** (1,163 lines) ✅ **ACTIVE**
**Purpose:** Main production payment routes
**Features:**
- Stripe payment processing
- Token purchases
- Session billing
- Refunds & withdrawals
- Bank account management
- Auto-withdrawal processing (cron job)
- Webhook handling
- **Used by:** `api/index.js`, `api/index-enhanced.js`

**Key endpoints:**
```javascript
POST /api/payments/create-intent    // Create payment
POST /api/payments/webhook           // Stripe webhook
GET  /api/payments/history           // Payment history
GET  /api/payments/earnings          // Creator earnings
POST /api/payments/bank-account      // Setup bank account
PUT  /api/payments/auto-withdraw     // Toggle auto-withdrawal
```

---

### **`routes/payments-enhanced.js`** (305 lines) ⚠️ **EXPERIMENTAL**
**Purpose:** Enhanced version with **idempotency** and **double-entry bookkeeping**
**Features:**
- Idempotency keys (prevents duplicate charges)
- Financial rate limiting
- Double-entry accounting (journal entries)
- `accounts` and `ledger` tables
- Strict validation
- **Used by:** `api/index.js` (alongside payments.js)

**Key differences:**
```javascript
// payments-enhanced.js has:
- Idempotency middleware
- Double-entry bookkeeping (transfer_tokens function)
- Financial rate limiters
- Reserved balance support
- Strict validation with custom errors

// payments.js has:
- Legacy approach (direct balance updates)
- More endpoints (history, earnings, bank setup)
- Auto-withdrawal cron job
- Apple Pay support
```

**Recommendation:**
- ✅ **Keep `payments.js`** for now (production-ready)
- 🔄 **Migrate to `payments-enhanced.js`** gradually (better for audit compliance)
- 🗑️ **Don't delete yet** - merge features first

---

## 2️⃣ **Socket/WebSocket Files**

### **`utils/socket.js`** (1,115 lines) ✅ **LEGACY ACTIVE**
**Purpose:** Original Socket.io implementation
**Features:**
- Basic Socket.io setup
- Session management
- Real-time notifications
- **Issue:** Not suitable for Vercel serverless

---

### **`utils/socket-improved.js`** (592 lines) ⚠️ **IN USE**
**Purpose:** Improved version with error handling
**Features:**
- Better error handling
- Retry logic
- More reliable reconnection
- **Used by:** `api/index-enhanced.js`

---

### **`utils/socket-enhanced.js`** (617 lines) ⚠️ **EXPERIMENTAL**
**Purpose:** Enhanced version with Redis + rate limiting
**Features:**
- Redis pub/sub for scaling
- Rate limiting per user
- Webhook validation
- Session analytics
- **Not currently used in production**

---

### **`utils/socket-redis-config.js`** (274 lines)
**Purpose:** Redis configuration for socket clustering
**Features:**
- PM2 ecosystem config
- Redis adapter setup
- **Not currently used**

---

### **`utils/socket-redis-helpers.js`** (418 lines)
**Purpose:** Redis helper functions for sockets
**Features:**
- User presence tracking
- Session state management
- Pub/sub helpers
- **Not currently used**

**Recommendation:**
- 🚨 **All socket files need replacement** - Vercel doesn't support long-lived WebSocket
- ✅ **Migrate to Ably/Pusher** (as outlined in STABILIZATION_PLAN.md)
- 🗑️ **Can delete after migration** - none of these will work on Vercel

---

## 3️⃣ **Supabase Admin**

### **`utils/supabase-admin.js`** (356 lines) ✅ **ACTIVE**
**Purpose:** Supabase Admin SDK wrapper
**Features:**
- `supabaseAdmin()` - returns admin client
- `initializeSupabaseAdmin()` - initializes with retry
- `verifySupabaseToken()` - JWT verification
- Redis caching for users
- Retry logic
- **Used by:** Most of your codebase

**Used in:**
- `middleware/roleVerification.js`
- `utils/tokens.js`
- `utils/notifications.js`
- Most socket files
- Test files

---

### **`utils/supabase-admin-v2.js`** (647 lines) ⚠️ **PARTIALLY ACTIVE**
**Purpose:** Enhanced version with observability
**Features:**
- Everything from v1
- **Observability utilities** (error tracking, metrics)
- Improved JWT verification
- Better error handling
- **Used by:** `middleware/auth.js` (for `verifySupabaseToken`)

**Key difference:**
```javascript
// supabase-admin-v2.js adds:
- observability.trackError()
- observability.trackMetric()
- observability.trackEvent()
- Better logging
- Performance monitoring

// Both have:
- supabaseAdmin()
- verifySupabaseToken()
- Redis caching
```

**Recommendation:**
- ⚠️ **You're using BOTH files** - this is inconsistent
- ✅ **Migrate to `supabase-admin-v2.js`** everywhere
- 🗑️ **Delete `supabase-admin.js`** after migration

---

## 📊 **Cleanup Action Plan**

### **Phase 1: Immediate (Do Today)**

1. **Payments: Standardize on one file**
   ```bash
   # Option A: Keep payments.js (recommended)
   # - It's battle-tested
   # - Has all features you need

   # Option B: Migrate to payments-enhanced.js
   # - Better for compliance
   # - Requires migrating endpoints
   ```

2. **Supabase Admin: Consolidate to v2**
   ```bash
   # Replace all imports:
   # OLD: const { supabaseAdmin } = require('./utils/supabase-admin');
   # NEW: const { supabaseAdmin } = require('./utils/supabase-admin-v2');

   grep -rl "require.*supabase-admin'" backend/ | \
     xargs sed -i '' "s/supabase-admin'/supabase-admin-v2'/g"
   ```

3. **Sockets: Plan migration to Ably**
   - Mark all socket files as deprecated
   - See `STABILIZATION_PLAN.md` Phase 2

---

### **Phase 2: Files to Delete** (After migration)

```bash
# After migrating to supabase-admin-v2
rm backend/utils/supabase-admin.js

# After deciding on payments approach
# If keeping payments.js:
rm backend/routes/payments-enhanced.js

# If migrating to payments-enhanced.js:
# (Merge missing features first, then)
rm backend/routes/payments.js

# After migrating to Ably/Pusher
rm backend/utils/socket.js
rm backend/utils/socket-improved.js
rm backend/utils/socket-enhanced.js
rm backend/utils/socket-redis-config.js
rm backend/utils/socket-redis-helpers.js
```

---

## 🔍 **File Usage Summary**

| File | Lines | Status | Used By | Action |
|------|-------|--------|---------|--------|
| `routes/payments.js` | 1,163 | ✅ Active | api/index.js | Keep |
| `routes/payments-enhanced.js` | 305 | ⚠️ Experimental | api/index.js | Merge or Delete |
| `utils/socket.js` | 1,115 | ❌ Legacy | Nothing | Delete after Ably migration |
| `utils/socket-improved.js` | 592 | ⚠️ In Use | api/index-enhanced.js | Delete after Ably migration |
| `utils/socket-enhanced.js` | 617 | ❌ Unused | Nothing | Delete after Ably migration |
| `utils/socket-redis-config.js` | 274 | ❌ Unused | Nothing | Delete |
| `utils/socket-redis-helpers.js` | 418 | ❌ Unused | Nothing | Delete |
| `utils/supabase-admin.js` | 356 | ✅ Active | 15+ files | Migrate to v2, then delete |
| `utils/supabase-admin-v2.js` | 647 | ⚠️ Partial | middleware/auth.js | Migrate everything to this |

---

## 🎯 **Recommended Actions**

### **Today (30 minutes)**
```bash
# 1. Standardize supabase-admin to v2
find backend -name "*.js" -exec sed -i '' 's/supabase-admin'"'"'/supabase-admin-v2'"'"'/g' {} +
git add . && git commit -m "Migrate to supabase-admin-v2"

# 2. Delete unused socket helpers
rm backend/utils/socket-redis-config.js
rm backend/utils/socket-redis-helpers.js
rm backend/utils/socket-enhanced.js
git add . && git commit -m "Remove unused socket files"
```

### **Phase 2 (After Ably Migration)**
```bash
# Delete all socket files
rm backend/utils/socket*.js

# Keep only Ably integration
# (See STABILIZATION_PLAN.md Phase 2)
```

### **Phase 3 (Payments Decision)**
```bash
# Option A: Merge idempotency from payments-enhanced into payments.js
# Option B: Finish payments-enhanced.js and migrate all endpoints
# Then delete the unused file
```

---

## 💡 **Why You Have Duplicates**

This is common in rapidly-developed projects:
1. **payments-enhanced.js** - You tried to add idempotency/accounting
2. **socket-improved.js** - You tried to fix reliability issues
3. **socket-enhanced.js** - You tried to add Redis for scaling
4. **supabase-admin-v2.js** - You added observability/monitoring

**The problem:**
- Incomplete migrations leave both versions active
- Hard to know which is "canonical"
- Increases maintenance burden

**The solution:**
- Pick ONE version per feature
- Migrate everything to it
- Delete the old version
- Document in comments

---

## 📋 **Quick Cleanup Script**

Save this as `cleanup-duplicates.sh`:
```bash
#!/bin/bash
set -e

echo "🧹 Cleaning up duplicate files..."

# 1. Migrate to supabase-admin-v2
echo "Step 1: Migrating to supabase-admin-v2..."
find backend -name "*.js" -type f -exec sed -i '' \
  's/supabase-admin'"'"'/supabase-admin-v2'"'"'/g' {} +

# 2. Delete unused socket files
echo "Step 2: Removing unused socket files..."
rm -f backend/utils/socket-redis-config.js
rm -f backend/utils/socket-redis-helpers.js
rm -f backend/utils/socket-enhanced.js

# 3. Commit changes
echo "Step 3: Committing changes..."
git add .
git commit -m "chore: cleanup duplicate files

- Migrate all imports to supabase-admin-v2
- Remove unused socket-redis-* files
- Remove unused socket-enhanced.js
"

echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Test that everything still works"
echo "2. Deploy to staging"
echo "3. After Ably migration, delete remaining socket files"
```

---

**Questions?** See `STABILIZATION_PLAN.md` for Ably migration guide.
