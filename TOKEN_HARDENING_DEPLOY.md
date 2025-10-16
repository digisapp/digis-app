# Token System Hardening - Deployment Guide

## 🚀 Quick Start (5-Minute Deploy)

### Prerequisites
- [x] Backup database before migration
- [x] Test on staging environment first
- [x] Review `IMPLEMENTATION_SUMMARY.md` for full details

---

## Step 1: Backup Database (CRITICAL!)

```bash
# Backup your production database
pg_dump $DATABASE_URL > backup_before_hardening_$(date +%Y%m%d_%H%M%S).sql

# Or if using Supabase:
# Download backup from Supabase Dashboard > Database > Backups
```

---

## Step 2: Run Migration

```bash
cd /Users/examodels/Desktop/digis-app/backend

# Apply migration
psql $DATABASE_URL -f migrations/142_token_system_hardening.sql

# Expected output:
# BEGIN
# ALTER TABLE
# ALTER TABLE
# ... (multiple schema changes)
# CREATE INDEX
# COMMENT
# COMMIT
```

**Verify migration success:**
```bash
psql $DATABASE_URL -c "
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'token_balances';
"
# Verify 'balance' shows 'bigint' (not numeric)

psql $DATABASE_URL -c "
SELECT conname FROM pg_constraint
WHERE conname = 'uniq_purchase_by_intent';
"
# Should return: uniq_purchase_by_intent
```

---

## Step 3: Update Backend Code

### Manual Patching Required

1. Open `backend/routes/tokens.js`
2. Open `backend/PATCH_tokens_hardening.md` in split view
3. Replace these sections:
   - **Lines 354-462**: `/purchase` endpoint → Copy hardened version
   - **Lines 465-654**: `/tip` endpoint → Copy hardened version
   - **Lines 657-832**: `/calls/deduct` → Apply row locking pattern

---

## Step 4: Update Webhook Handler

Open `backend/routes/payments.js` and add to webhook switch (around line 542) - full code in `IMPLEMENTATION_SUMMARY.md`

---

## Step 5: Test Locally

```bash
cd backend
npm run dev

# Test endpoint
curl http://localhost:3001/api/tokens/test
```

---

## Step 6: Deploy

```bash
git add backend/migrations/142_token_system_hardening.sql
git add backend/routes/tokens.js
git add backend/routes/payments.js
git commit -m "feat: harden token system (idempotency, row locking, refunds)"
git push origin main
```

---

## 🎯 Success Checklist

- [ ] Database backup created
- [ ] Migration runs without errors
- [ ] Code updated (purchase, tip, calls, webhook)
- [ ] Local tests pass
- [ ] Deployed to production
- [ ] Smoke tests pass

---

## 📞 Resources

- **Implementation Details**: `backend/IMPLEMENTATION_SUMMARY.md`
- **Code Patches**: `backend/PATCH_tokens_hardening.md`
- **Test Scenarios**: See IMPLEMENTATION_SUMMARY.md → Testing section
