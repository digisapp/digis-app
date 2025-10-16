# Image Cropping Feature - Deployment Checklist

## ✅ Pre-Deployment Verification

### 1. Environment Variables (Backend)

Check that these are set in your production environment (Vercel/Railway/etc.):

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # ⚠️ SERVICE key, NOT anon key!

# Optional
PUBLIC_ASSET_BASE=https://your-cdn-domain.com  # If using CDN
```

**Verify locally:**
```bash
cd backend
node -e "console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅' : '❌'); console.log('SERVICE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌')"
```

---

## 🗄️ Database & Storage Setup

### 2.1 Run Database Migration

```bash
cd backend
npm run migrate
```

**Or manually in Supabase SQL Editor:**
Copy/paste: `backend/migrations/2025_10_15_avatar_card_columns.sql`

**Verify:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('avatar_url', 'card_image_url', 'avatar_updated_at', 'card_image_updated_at');
```

Should show 4 rows.

### 2.2 Supabase Storage Setup

1. Go to: `https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new`
2. Copy entire contents of: `backend/migrations/SUPABASE_STORAGE_SETUP.sql`
3. Execute SQL
4. **Verify buckets created:**
   - Go to Storage → Buckets
   - Should see: `avatars` (public) and `cards` (public)

---

## 🚀 Quick Start (3 Commands)

```bash
# 1. Run DB migration
cd backend && npm run migrate

# 2. Install frontend deps
cd ../frontend && npm install react-avatar-editor react-image-crop

# 3. Then run SUPABASE_STORAGE_SETUP.sql in Supabase Dashboard
```

---

## 🧪 Smoke Test

```bash
# Start backend
cd backend && npm run dev

# In another terminal, test upload endpoint
curl -i http://localhost:3005/api/uploads/avatar
# Expected: 401 (auth required) - proves route is registered

# Test with auth (get token from browser localStorage)
curl -i -X POST http://localhost:3005/api/uploads/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-image.jpg"
# Expected: 200 with {"success": true, "url": "..."}
```

---

## ✅ Success Criteria

- [ ] Avatar upload works (file → crop → save → see in UI)
- [ ] Card upload works
- [ ] Files in Supabase Storage `avatars` and `cards` buckets
- [ ] `users.avatar_url` and `users.card_image_url` populated
- [ ] No console errors
- [ ] Mobile uploads work (iPhone + Android)

---

**Full details:** See `CROP_SETUP_COMPLETE.md`
