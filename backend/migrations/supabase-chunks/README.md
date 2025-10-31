# Firebase Removal Migration - Supabase Chunks

This migration has been broken down into **5 small chunks** that you can run one at a time in the Supabase SQL Editor.

## ⚠️ IMPORTANT: Run in Order!

You **MUST** run these chunks in numerical order (1 → 5). Do not skip chunks.

---

## 📋 Step-by-Step Instructions

### Step 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"** button

---

### Step 2: Run CHUNK 1 - Setup supabase_id Column

**File:** `CHUNK_1_setup_supabase_id.sql`

**What it does:**
- Adds `supabase_id` column if it doesn't exist
- Makes it NOT NULL and UNIQUE
- Verifies configuration

**Instructions:**
1. Open `CHUNK_1_setup_supabase_id.sql` in a text editor
2. Copy ALL the contents
3. Paste into Supabase SQL Editor
4. Click **"Run"** button
5. Check output - should see "supabase_id | uuid | NO | NULL"

**Expected output:**
```
✓ Added supabase_id column (or "already exists")
✓ Set NOT NULL constraint
✓ Added unique constraint
```

---

### Step 3: Run CHUNK 2 - Drop Firebase UID

**File:** `CHUNK_2_drop_firebase.sql`

**What it does:**
- Drops all foreign key constraints referencing `firebase_uid`
- Drops the `firebase_uid` column
- Drops firebase-related indexes
- Verifies removal

**Instructions:**
1. Open `CHUNK_2_drop_firebase.sql`
2. Copy ALL the contents
3. Paste into Supabase SQL Editor (same or new query)
4. Click **"Run"**
5. Check output - should return 0 rows (no firebase columns found)

**Expected output:**
```
✓ Dropped firebase_uid column
✓ No firebase columns remaining
```

---

### Step 4: Run CHUNK 3 - Create Supabase Index

**File:** `CHUNK_3_create_indexes.sql`

**What it does:**
- Creates performance index on `users.supabase_id`
- Adds helpful comment
- Verifies index creation

**Instructions:**
1. Open `CHUNK_3_create_indexes.sql`
2. Copy ALL the contents
3. Paste into Supabase SQL Editor
4. Click **"Run"**
5. Check output - should see index definition

**Expected output:**
```
✓ idx_users_supabase_id created
✓ Index definition shown
```

---

### Step 5: Run CHUNK 4 - Create Related Indexes

**File:** `CHUNK_4_related_indexes.sql`

**What it does:**
- Creates performance indexes on:
  - `followers.follower_id`
  - `followers.creator_id`
  - `token_balances.user_id`
  - `token_transactions.user_id`
  - `payments.user_id`
  - `tips.tipper_id` and `tips.creator_id` (if table exists)
- Verifies all indexes created

**⚠️ Note:** If you get an error about a table not existing (like `tips`), that's OK! Just ignore that specific error and continue.

**Instructions:**
1. Open `CHUNK_4_related_indexes.sql`
2. Copy ALL the contents
3. Paste into Supabase SQL Editor
4. Click **"Run"**
5. Check output - should see list of created indexes

**Expected output:**
```
✓ Multiple indexes created
✓ List of all idx_followers_*, idx_token_*, etc.
```

**If you see errors like:**
```
ERROR: relation "tips" does not exist
```
**This is OK!** The migration will skip tables that don't exist. Just continue to the next step.

---

### Step 6: Run CHUNK 5 - Verification

**File:** `CHUNK_5_verify.sql`

**What it does:**
- Verifies no Firebase columns remain
- Verifies no Firebase indexes remain
- Verifies `supabase_id` is properly configured
- Shows all created indexes
- Displays success message

**Instructions:**
1. Open `CHUNK_5_verify.sql`
2. Copy ALL the contents
3. Paste into Supabase SQL Editor
4. Click **"Run"**
5. **Review ALL the output carefully**

**Expected output:**
```
✓ 0 firebase columns found
✓ 0 firebase indexes found
✓ supabase_id is uuid, NOT NULL
✓ users_supabase_id_unique constraint exists
✓ All performance indexes created
✓ "Firebase Removal Migration Complete!"
```

---

## ✅ After Completion

Once all 5 chunks have run successfully:

1. **Test your application:**
   - Login/signup should work
   - Creator dashboard should load
   - Followers list should display
   - Stats should show correct counts

2. **Check for errors:**
   - Open browser console
   - Navigate around the app
   - Look for any 500 errors or database errors

3. **Monitor production:**
   - Check Vercel logs for any errors
   - Monitor for 24-48 hours

---

## 🆘 Troubleshooting

### Error: "column supabase_id already exists"
**Solution:** This is fine! The migration is idempotent. Continue to next chunk.

### Error: "relation does not exist"
**Solution:** Some tables may not exist in your database. This is OK - skip and continue.

### Error: "Cannot make supabase_id NOT NULL - found NULL values"
**Solution:** Some users don't have supabase_id. Run this query to check:
```sql
SELECT id, email, username FROM users WHERE supabase_id IS NULL;
```
You'll need to populate these users with UUIDs or delete them before continuing.

### Error: "constraint already exists"
**Solution:** The migration already ran before. This is fine - continue.

---

## 📊 Files Summary

| Chunk | File | Purpose | Safe to Re-run? |
|-------|------|---------|-----------------|
| 1 | `CHUNK_1_setup_supabase_id.sql` | Setup supabase_id column | ✅ Yes |
| 2 | `CHUNK_2_drop_firebase.sql` | Remove firebase_uid | ✅ Yes |
| 3 | `CHUNK_3_create_indexes.sql` | Index supabase_id | ✅ Yes |
| 4 | `CHUNK_4_related_indexes.sql` | Index related tables | ✅ Yes |
| 5 | `CHUNK_5_verify.sql` | Verify migration | ✅ Yes |

All chunks are **safe to re-run** multiple times. They check if changes already exist before making them.

---

## 🎯 Quick Run Checklist

- [ ] Run CHUNK 1 in Supabase SQL Editor
- [ ] Run CHUNK 2 in Supabase SQL Editor
- [ ] Run CHUNK 3 in Supabase SQL Editor
- [ ] Run CHUNK 4 in Supabase SQL Editor
- [ ] Run CHUNK 5 in Supabase SQL Editor
- [ ] Review verification output
- [ ] Test application
- [ ] Monitor for errors

---

**Good luck! 🚀**

If you encounter any issues, check the troubleshooting section above.
