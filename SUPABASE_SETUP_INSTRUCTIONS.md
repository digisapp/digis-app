# Supabase Setup for Ticketed Private Shows

## ✅ Backend Status
- **Routes**: Already registered in `/backend/api/index.js` ✅
- **Route file**: `/backend/routes/ticketed-shows.js` exists ✅
- **API endpoints**: Ready to use ✅

## 🔴 Database Status
The ticketed shows tables **DO NOT EXIST** in your database yet. You need to run the SQL migration.

## 📝 Steps to Complete Setup

### Step 1: Open Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the **SQL Editor** (usually in the left sidebar)

### Step 2: Run the Migration
1. Copy the entire contents of: `RUN_TICKETED_SHOWS_MIGRATION.sql`
2. Paste it into the Supabase SQL Editor
3. Click **Run** or **Execute**

### Step 3: Verify Tables Were Created
After running the migration, verify by running this query:
```sql
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND (tablename LIKE '%ticketed%' OR tablename LIKE 'show_%')
ORDER BY tablename;
```

You should see these 4 tables:
- `show_analytics`
- `show_announcements`
- `show_tickets`
- `ticketed_shows`

### Step 4: Verify RLS Policies
Check that Row Level Security is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('ticketed_shows', 'show_tickets', 'show_analytics', 'show_announcements');
```

All should show `rowsecurity = true`.

### Step 5: Test the Feature
Once the tables are created:

1. **Restart your backend** (to ensure clean connections):
   ```bash
   # Stop the backend (Ctrl+C) then:
   cd backend
   npm run dev
   ```

2. **Test the API endpoint**:
   ```bash
   curl http://localhost:3001/api/ticketed-shows/stream/test-stream/active
   ```
   Should return a proper response (not 404)

## 🎯 What The Migration Creates

### Tables:
1. **ticketed_shows** - Main table for show details
2. **show_tickets** - Tracks who bought tickets
3. **show_analytics** - Performance metrics
4. **show_announcements** - Notification system

### Features:
- Automatic price calculation (early bird vs regular)
- Ticket purchase tracking
- Analytics triggers
- Row Level Security policies
- Prevents duplicate ticket purchases
- Tracks revenue automatically

### Security:
- RLS enabled on all tables
- Creators can only manage their own shows
- Users can only see their own tickets
- Automatic auth.uid() checks

## 🚨 Important Notes

1. **Token Transactions**: The ticket purchase will deduct tokens from buyers and add to creators automatically through the backend API

2. **Unique Constraints**: Users cannot buy duplicate tickets for the same show

3. **Cascade Deletes**: If a stream is deleted, all associated show data is cleaned up automatically

4. **Early Bird Pricing**: Automatically switches from early bird to regular price based on deadline

## 🧪 Quick Test After Setup

Create a test show directly in SQL:
```sql
-- Insert a test show (replace with your actual IDs)
INSERT INTO ticketed_shows (
  stream_id, 
  creator_id, 
  title, 
  token_price, 
  status
) VALUES (
  gen_random_uuid(), -- or use an actual stream ID
  (SELECT supabase_id FROM users WHERE is_creator = true LIMIT 1),
  'Test Private Show',
  500,
  'announced'
) RETURNING *;
```

If this works, your tables are ready!

## ✅ Success Checklist
- [ ] Tables created in Supabase
- [ ] RLS policies active
- [ ] Backend restarted
- [ ] API endpoint responds (not 404)
- [ ] Test show can be created

Once all items are checked, the ticketed private shows feature is ready to use!