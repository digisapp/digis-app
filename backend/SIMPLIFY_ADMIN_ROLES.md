# Simplifying Admin Role System

## Current Problem

We have **3 redundant ways** to check admin status:
1. `is_admin` column (boolean)
2. `is_super_admin` column (boolean)
3. `role` column (text: 'admin', 'creator', 'fan')

This creates confusion and maintenance issues.

## Proposed Solution

**Use only the `role` column** for all permission checks.

### Role Hierarchy

```
'admin'   → Full system access (Nathan)
'creator' → Creator features (Miriam, other creators)
'fan'     → Basic user features
```

### Migration Steps

#### Step 1: Update Middleware

Change `middleware/auth.js` to only check `role`:

```javascript
// OLD
if (!result.rows[0].is_super_admin && result.rows[0].role !== 'admin')

// NEW
if (result.rows[0].role !== 'admin')
```

#### Step 2: Update All Route Checks

Search and replace in all route files:
- `is_admin` checks → `role = 'admin'` checks
- `is_super_admin` checks → `role = 'admin'` checks

#### Step 3: Update Frontend

Change frontend admin checks from:
```javascript
isAdmin = user?.user_metadata?.isAdmin
```
To:
```javascript
isAdmin = user?.user_metadata?.role === 'admin'
```

#### Step 4: Database Cleanup (Optional)

After verifying everything works:
```sql
-- Make sure role is set correctly for all users
UPDATE users SET role = 'admin' WHERE is_super_admin = true;
UPDATE users SET role = 'creator' WHERE is_creator = true AND role IS NULL;
UPDATE users SET role = 'fan' WHERE role IS NULL;

-- Drop redundant columns (optional)
ALTER TABLE users DROP COLUMN is_admin;
ALTER TABLE users DROP COLUMN is_super_admin;
```

## Benefits

✅ Single source of truth
✅ Easier to understand and maintain
✅ Standard industry pattern
✅ Easy to add new roles ('moderator', 'support', etc.)
✅ Less confusion for developers

## Current Workaround

For now, keep all three columns synced:
- When setting admin: `is_admin = true`, `is_super_admin = true`, `role = 'admin'`
- When removing admin: `is_admin = false`, `is_super_admin = false`, `role = 'creator'`
