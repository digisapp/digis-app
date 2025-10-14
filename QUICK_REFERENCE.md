# Quick Reference Card
## Fan Privacy & Calls System

---

## 🚀 Deploy in 3 Steps

```bash
# 1. Migrate
pg_dump $DATABASE_URL > backup.sql
npm run migrate

# 2. Deploy (flags OFF)
vercel env add FEATURE_CALLS false
vercel --prod

# 3. Enable incrementally
vercel env add FEATURE_CALLS true
vercel --prod
```

**Rollback**: `vercel env add FEATURE_CALLS false && vercel --prod`

---

## 📁 Files Created

### Backend
- `migrations/132_fan_privacy_and_calls.sql` - Database schema
- `migrations/132_fan_privacy_and_calls_DOWN.sql` - Rollback script
- `routes/fans.js` - Fan privacy API (8 endpoints)
- `routes/calls.js` - Calls API (7 endpoints)
- `utils/agoraUid.js` - Stable UID generation
- `utils/featureFlags.js` - Feature flag system
- `middleware/optionalAuth.js` - Soft auth for public pages
- `jobs/expire-call-invitations.js` - Auto-expire job

### Frontend
- `components/settings/FanPrivacySettings.jsx` - Privacy UI

### Documentation
- `FAN_PRIVACY_IMPLEMENTATION.md` - Technical spec
- `PRODUCTION_DEPLOY_CHECKLIST.md` - Deployment guide
- `PRODUCTION_READY_SUMMARY.md` - Overview

---

## 🚩 Feature Flags

```bash
# In Vercel environment variables
FEATURE_FAN_PRIVACY=true        # Safe ✅
FEATURE_FAN_MINI_PROFILE=true   # Safe ✅
FEATURE_CALLS=false             # Test first ⚠️
FEATURE_FAN_SHARE_CARD=false    # Optional ℹ️
```

---

## 🚨 Emergency Commands

```bash
# Disable calls immediately
vercel env add FEATURE_CALLS false && vercel --prod

# Rollback deployment
vercel rollback

# Rollback database (DESTRUCTIVE)
psql $DATABASE_URL < migrations/132_fan_privacy_and_calls_DOWN.sql
```

---

**Full docs**: `FAN_PRIVACY_IMPLEMENTATION.md` | `PRODUCTION_DEPLOY_CHECKLIST.md`
