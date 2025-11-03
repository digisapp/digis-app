# Admin Users

This document lists all users with admin access to the Digis platform.

## Super Admins (Full Access)

- **Nathan** - nathan@examodels.com
  - Role: Platform Owner
  - Access: Full system access, can manage all users and settings

## Regular Admins

_(Currently none)_

## How to Add/Remove Admins

### Add Admin Access
```sql
UPDATE users
SET is_admin = true,
    role = 'admin'
WHERE email = 'user@example.com';
```

### Remove Admin Access
```sql
UPDATE users
SET is_admin = false,
    role = 'creator'  -- or 'fan'
WHERE email = 'user@example.com';
```

### Grant Super Admin (Full System Access)
```sql
UPDATE users
SET is_admin = true,
    is_super_admin = true,
    role = 'admin'
WHERE email = 'user@example.com';
```

## Security Notes

- Admin access is tied to individual user accounts (email-based)
- All admin actions are logged in the audit_logs table
- Use the admin dashboard at `/dashboard` when logged in as an admin
- Admins can manage creator applications, view analytics, and moderate content
