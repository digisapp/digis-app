# Where to Find Users in Supabase Database

## Quick Reference
- **All Users**: `users` table
- **Creators**: `users` table WHERE `is_creator = true`
- **Fans**: `users` table WHERE `is_creator = false`
- **Pending Creator Applications**: `creator_applications` table WHERE `status = 'pending'`

## Detailed Database Structure

### 1. Users Table (Main User Storage)
**Location**: `public.users`

This is the main table containing ALL users (both creators and fans):

```sql
-- View all users
SELECT * FROM users;

-- View only CREATORS
SELECT * FROM users WHERE is_creator = true;

-- View only FANS (regular users)
SELECT * FROM users WHERE is_creator = false;

-- View ADMINS
SELECT * FROM users WHERE is_super_admin = true;

-- View online creators
SELECT * FROM users WHERE is_creator = true AND is_online = true;
```

#### Key Columns in Users Table:
- `id` - Internal database ID
- `supabase_id` - UUID from Supabase Auth (links to auth.users)
- `email` - User's email address
- `username` - Unique username
- `display_name` - Display name
- **`is_creator`** - Boolean flag (true = creator, false = fan)
- `is_super_admin` - Boolean flag for admin users
- `is_online` - Online status
- `bio` - User biography
- `profile_pic_url` - Profile picture URL
- `price_per_min` - Creator's rate for calls (only relevant for creators)
- `created_at` - Account creation date
- `role` - Role type ('authenticated', 'admin', etc.)

### 2. Creator Applications Table
**Location**: `public.creator_applications`

This table tracks users who have applied to become creators:

```sql
-- View ALL creator applications
SELECT * FROM creator_applications;

-- View PENDING applications (waiting for approval)
SELECT * FROM creator_applications WHERE status = 'pending';

-- View APPROVED applications
SELECT * FROM creator_applications WHERE status = 'approved';

-- View REJECTED applications
SELECT * FROM creator_applications WHERE status = 'rejected';

-- View pending applications with user details
SELECT 
    ca.*,
    u.username,
    u.email,
    u.display_name
FROM creator_applications ca
JOIN users u ON ca.supabase_user_id = u.supabase_id
WHERE ca.status = 'pending'
ORDER BY ca.created_at DESC;
```

#### Application Statuses:
- `pending` - Awaiting review
- `approved` - Application approved (user should now have `is_creator = true`)
- `rejected` - Application denied
- `under_review` - Currently being reviewed

#### Key Columns in Creator Applications:
- `id` - Application ID
- `supabase_user_id` - Links to users.supabase_id
- `application_reason` - Why they want to be a creator
- `status` - Application status
- `admin_notes` - Admin review notes
- `reviewed_by` - Admin who reviewed
- `reviewed_at` - Review timestamp
- `created_at` - Application submission date

### 3. Creator-Specific Tables

#### Creator Profiles (Extended Info)
```sql
-- View all creator profiles with details
SELECT * FROM creator_profiles;

-- Join with users table for complete creator info
SELECT 
    u.*,
    cp.hourly_rate,
    cp.category,
    cp.specialties,
    cp.availability_schedule
FROM users u
LEFT JOIN creator_profiles cp ON u.id = cp.user_id
WHERE u.is_creator = true;
```

#### Creator Stats & Analytics
```sql
-- Get creator statistics
SELECT 
    u.username,
    u.display_name,
    COUNT(DISTINCT s.id) as total_sessions,
    SUM(s.duration_minutes) as total_minutes,
    SUM(s.tokens_earned) as total_tokens_earned,
    COUNT(DISTINCT cs.user_id) as subscriber_count
FROM users u
LEFT JOIN sessions s ON u.supabase_id = s.creator_id
LEFT JOIN creator_subscriptions cs ON u.supabase_id = cs.creator_id
WHERE u.is_creator = true
GROUP BY u.id, u.username, u.display_name;
```

## SQL Queries for Common Tasks

### 1. Dashboard Statistics
```sql
-- Get platform statistics
SELECT 
    COUNT(*) FILTER (WHERE is_creator = false) as total_fans,
    COUNT(*) FILTER (WHERE is_creator = true) as total_creators,
    COUNT(*) FILTER (WHERE is_creator = true AND is_online = true) as online_creators,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_users_7d
FROM users;

-- Get pending applications count
SELECT COUNT(*) as pending_applications 
FROM creator_applications 
WHERE status = 'pending';
```

### 2. Find Specific Users
```sql
-- Find user by email
SELECT * FROM users WHERE email = 'user@example.com';

-- Find user by username
SELECT * FROM users WHERE username = 'johndoe';

-- Find user by Supabase Auth ID
SELECT * FROM users WHERE supabase_id = 'uuid-here';

-- Search users by name
SELECT * FROM users 
WHERE display_name ILIKE '%john%' 
   OR username ILIKE '%john%';
```

### 3. Creator Discovery
```sql
-- Get featured creators
SELECT * FROM users 
WHERE is_creator = true 
  AND is_online = true
  AND featured = true
ORDER BY rating DESC
LIMIT 10;

-- Get creators by category
SELECT u.*, cp.category, cp.hourly_rate
FROM users u
JOIN creator_profiles cp ON u.id = cp.user_id
WHERE u.is_creator = true
  AND cp.category = 'Gaming'
ORDER BY u.rating DESC;

-- Get top earning creators
SELECT 
    u.username,
    u.display_name,
    SUM(s.tokens_earned) as total_earnings
FROM users u
JOIN sessions s ON u.supabase_id = s.creator_id
WHERE u.is_creator = true
  AND s.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, u.username, u.display_name
ORDER BY total_earnings DESC
LIMIT 10;
```

### 4. Manage Creator Applications
```sql
-- Approve a creator application
UPDATE creator_applications 
SET 
    status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = 'admin-id-here'
WHERE id = 'application-id-here';

-- After approval, update user to creator
UPDATE users 
SET is_creator = true 
WHERE supabase_id = (
    SELECT supabase_user_id 
    FROM creator_applications 
    WHERE id = 'application-id-here'
);

-- Reject an application with reason
UPDATE creator_applications 
SET 
    status = 'rejected',
    admin_notes = 'Reason for rejection',
    reviewed_at = NOW(),
    reviewed_by = 'admin-id-here'
WHERE id = 'application-id-here';
```

## Supabase Dashboard Navigation

### To View in Supabase Dashboard:

1. **Log into Supabase Dashboard**
   - Go to your project dashboard

2. **Navigate to Table Editor**
   - Click on "Table Editor" in the left sidebar

3. **View Users**
   - Click on `users` table
   - Use filters to separate creators/fans:
     - Filter: `is_creator` equals `true` (for creators)
     - Filter: `is_creator` equals `false` (for fans)

4. **View Creator Applications**
   - Click on `creator_applications` table
   - Filter by `status` = `pending` to see pending applications

5. **Use SQL Editor for Complex Queries**
   - Click on "SQL Editor" in the left sidebar
   - Run any of the queries above

## RLS (Row Level Security) Policies

The following RLS policies are in place:

### Users Table:
- Users can view their own profile
- Users can update their own profile
- Public profiles of creators are viewable by all
- Only admins can change `is_creator` status

### Creator Applications:
- Users can view their own applications
- Users can create applications (one per user)
- Only admins can approve/reject applications
- Admins can view all applications

## API Endpoints for User Management

### Get Users
```javascript
// Backend endpoint
GET /api/users/creators  // Get all creators
GET /api/users/fans      // Get all fans
GET /api/users/online    // Get online creators

// Supabase client (Frontend)
const { data: creators } = await supabase
  .from('users')
  .select('*')
  .eq('is_creator', true);

const { data: fans } = await supabase
  .from('users')
  .select('*')
  .eq('is_creator', false);
```

### Creator Applications
```javascript
// Get pending applications
const { data: pendingApps } = await supabase
  .from('creator_applications')
  .select(`
    *,
    user:users(username, email, display_name)
  `)
  .eq('status', 'pending')
  .order('created_at', { ascending: false });

// Submit creator application
const { data, error } = await supabase
  .from('creator_applications')
  .insert({
    supabase_user_id: userId,
    application_reason: 'I want to share my expertise...',
    status: 'pending'
  });
```

## Summary

- **All users** are in the `users` table
- **Creators** have `is_creator = true`
- **Fans** have `is_creator = false`
- **Pending applications** are in `creator_applications` table with `status = 'pending'`
- When an application is approved, the user's `is_creator` flag is set to `true`
- The `supabase_id` column links to Supabase Auth (`auth.users` table)