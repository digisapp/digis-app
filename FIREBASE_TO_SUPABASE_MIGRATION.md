# Firebase to Supabase Migration Guide

## Overview
This document tracks the migration from Firebase to Supabase authentication.

## Key Changes Required

### 1. Frontend Changes

#### Authentication Token
Replace all instances of:
```javascript
const firebaseToken = await user.getIdToken();
```
With:
```javascript
import { getAuthToken } from '../utils/auth-helpers';
const authToken = await getAuthToken();
```

#### User ID References
Replace:
- `user.uid` → `user.id`
- `firebase_uid` → `supabase_id`
- `firebaseUid` → `supabaseId`

#### Import Updates
Add to files using authentication:
```javascript
import { getAuthToken, getCurrentUser, getUserId } from '../utils/auth-helpers';
```

### 2. Backend Changes

#### Database Columns
- Column `firebase_uid` should be renamed to `supabase_id`
- Update all SQL queries accordingly

#### Middleware
- Already updated in `/backend/middleware/auth-enhanced.js`
- Uses `verifySupabaseToken` instead of Firebase verification

### 3. Files to Update

#### High Priority Frontend Files:
1. `/src/components/LiveChat.js` - ✅ Updated
2. `/src/components/CreatorCardsGallery.js`
3. `/src/components/CreatorNotificationWidget.js`
4. `/src/components/DigitalWalletPayment.js`
5. `/src/components/InstantChatWidget.js`
6. `/src/components/GiftInteractionSystem.js`
7. `/src/components/EnhancedMobileTokenPurchase.js`
8. `/src/components/InteractivePolls.js`
9. `/src/components/VirtualGifts.js`
10. `/src/components/Settings.js`

#### Test Files to Update:
- Remove or update all test files mocking Firebase
- Update to use Supabase mocks instead

#### Files to Remove:
1. `/src/test-auth.html` - Firebase test file
2. `/GOOGLE_SIGNIN_TROUBLESHOOTING.md` - Firebase documentation

### 4. Database Migration

Run this SQL to update the database:
```sql
-- Add supabase_id column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_id UUID;

-- Copy data from firebase_uid to supabase_id (if needed)
-- UPDATE users SET supabase_id = firebase_uid::uuid WHERE firebase_uid IS NOT NULL;

-- Update foreign key references in other tables
-- ALTER TABLE sessions RENAME COLUMN firebase_uid TO supabase_id;
-- etc. for other tables
```

### 5. Testing Checklist

- [ ] User can sign up with email/password
- [ ] User can log in with email/password
- [ ] Authentication tokens work for API calls
- [ ] User profile data is correctly fetched
- [ ] Creator features work with new auth
- [ ] Token purchases work
- [ ] Video/voice calls authenticate properly
- [ ] Chat features work with new auth

## Progress Tracking

- [x] Created auth-helpers.js utility
- [x] Updated LiveChat.js component
- [ ] Update remaining components
- [ ] Update test files
- [ ] Remove Firebase files
- [ ] Update database schema
- [ ] Test all features