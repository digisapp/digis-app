# Vanity URL System Testing Guide

This guide provides comprehensive testing instructions for the Instagram-style vanity URL system.

## System Overview

The vanity URL system allows creators to have unique, branded URLs like `digis.cc/miriam` instead of `digis.cc/creator/miriam`.

### Key Features
- Case-insensitive username uniqueness (Miriam = miriam = MIRIAM)
- 30-day cooldown on username changes
- 30-day quarantine for released usernames
- Reserved words protection (prevents conflicts with app routes)
- Live availability checking with debouncing
- Atomic updates with race condition handling
- Complete audit trail

---

## Backend Testing

### 1. Username Availability Check

**Endpoint**: `GET /api/public/usernames/availability?username=<username>`

```bash
# Test available username
curl "http://localhost:5001/api/public/usernames/availability?username=testuser123"
# Expected: {"available":true,"username":"testuser123"}

# Test taken username (use a real username from your DB)
curl "http://localhost:5001/api/public/usernames/availability?username=miriam"
# Expected: {"available":false,"reason":"taken","message":"..."}

# Test reserved word
curl "http://localhost:5001/api/public/usernames/availability?username=admin"
# Expected: {"available":false,"reason":"reserved","message":"..."}

# Test invalid format (too short)
curl "http://localhost:5001/api/public/usernames/availability?username=ab"
# Expected: {"available":false,"reason":"too_short","message":"..."}

# Test invalid format (special characters)
curl "http://localhost:5001/api/public/usernames/availability?username=test@user"
# Expected: {"available":false,"reason":"invalid_format","message":"..."}

# Test case-insensitivity (if "miriam" exists)
curl "http://localhost:5001/api/public/usernames/availability?username=MIRIAM"
# Expected: {"available":false,"reason":"taken",...}
```

### 2. Username Update

**Endpoint**: `PATCH /api/users/me/username`

```bash
# Get auth token first (replace with your method)
TOKEN="your-supabase-jwt-token"

# Test successful update
curl -X PATCH "http://localhost:5001/api/users/me/username" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"newhandle123"}'
# Expected: {"ok":true,"username":"newhandle123","url":"https://digis.cc/newhandle123"}

# Test duplicate (try same username again with different user)
curl -X PATCH "http://localhost:5001/api/users/me/username" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"newhandle123"}'
# Expected: 409 Conflict {"error":"Username already taken"}

# Test 30-day cooldown (try to change again immediately)
curl -X PATCH "http://localhost:5001/api/users/me/username" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"anotherhandle"}'
# Expected: 429 Too Many Requests {"error":"You can only change your username once every 30 days..."}

# Test reserved word
curl -X PATCH "http://localhost:5001/api/users/me/username" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin"}'
# Expected: 400 Bad Request {"error":"Username is reserved"}

# Test invalid format
curl -X PATCH "http://localhost:5001/api/users/me/username" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"ab"}'
# Expected: 400 Bad Request {"error":"Must be 3-30 characters..."}
```

### 3. Creator Profile Lookup

**Endpoint**: `GET /api/public/creators/:identifier`

```bash
# Test lookup by username
curl "http://localhost:5001/api/public/creators/miriam"
# Expected: Creator profile with follower_count

# Test case-insensitive lookup
curl "http://localhost:5001/api/public/creators/MIRIAM"
# Expected: Same creator profile as above

# Test lookup by UUID (if you have a creator ID)
curl "http://localhost:5001/api/public/creators/550e8400-e29b-41d4-a716-446655440000"
# Expected: Creator profile or 404

# Test non-existent username
curl "http://localhost:5001/api/public/creators/thisuserdoesnotexist12345"
# Expected: 404 Not Found
```

### 4. Database Verification

```sql
-- Check username uniqueness constraint
SELECT username, COUNT(*)
FROM users
GROUP BY LOWER(username)
HAVING COUNT(*) > 1;
-- Expected: No rows (empty result)

-- Check case variations (should only return 1 row per unique username)
SELECT LOWER(username) as normalized, COUNT(*) as count
FROM users
WHERE username IS NOT NULL
GROUP BY LOWER(username)
ORDER BY count DESC;
-- Expected: count should be 1 for all rows

-- Check quarantine table
SELECT * FROM username_quarantine
WHERE available_at > NOW()
ORDER BY released_at DESC;
-- Expected: List of recently released usernames

-- Check audit log
SELECT * FROM username_changes
ORDER BY changed_at DESC
LIMIT 10;
-- Expected: Recent username changes with old/new values

-- Verify cooldown enforcement
SELECT
  id,
  username,
  username_changed_at,
  EXTRACT(DAY FROM NOW() - username_changed_at) as days_since_change
FROM users
WHERE username_changed_at IS NOT NULL
ORDER BY username_changed_at DESC
LIMIT 10;
-- Expected: Days since change for users who've changed usernames
```

---

## Frontend Testing

### 1. Username Availability Hook

Open browser DevTools Console on any page with the hook:

```javascript
// Import the hook (or create a test component)
import { useUsernameAvailability } from './hooks/useUsernameAvailability';

function TestComponent() {
  const [input, setInput] = React.useState('');
  const { value, state } = useUsernameAvailability(input);

  console.log('Value:', value);
  console.log('State:', state);

  return <input value={input} onChange={(e) => setInput(e.target.value)} />;
}
```

**Manual Tests**:
1. Type "ab" → Should show "invalid" status (too short)
2. Type "abc" → Should show "checking" then "available" or "taken"
3. Type "admin" → Should show "invalid" status (reserved)
4. Type "test@user" → Should show "invalid" status (bad format)
5. Type slowly → Should debounce (wait 350ms before checking)
6. Type "Miriam" → Should normalize to "miriam" and check

### 2. Username Field Component

**Location**: Add to Settings or Edit Profile page

```jsx
import UsernameField from './components/settings/UsernameField';

<UsernameField
  initial={currentUser?.username || ''}
  onSaved={(username, url) => {
    console.log('Saved:', username, url);
    // Update user profile state
  }}
/>
```

**Manual Tests**:
1. **Initial Load**
   - Field should show current username
   - Preview should show `digis.cc/currentusername`
   - Save button should be disabled

2. **Type New Username**
   - Type "newhandle"
   - Status should show "Checking..."
   - Status should update to "Available ✓" (green)
   - Save button should enable

3. **Try Taken Username**
   - Type an existing username
   - Status should show "Already taken" (red)
   - Save button should stay disabled

4. **Try Reserved Word**
   - Type "admin"
   - Status should show "Reserved name" (red)
   - Save button should stay disabled

5. **Try Invalid Format**
   - Type "ab" → "Must be at least 3 characters"
   - Type "this-is-way-too-long-username-over-thirty" → "Must be at most 30 characters"
   - Type "test@user" → "Invalid format"

6. **Save Username**
   - Type available username
   - Click "Save"
   - Should show success toast with new URL
   - Field should update with new username
   - Save button should disable

7. **Cooldown Test**
   - Try to save again immediately
   - Should show error toast about 30-day cooldown

### 3. Vanity Route Guard

**Test Cases**:

1. **Valid Username Route**
   - Navigate to `/miriam` (existing username)
   - Should render CreatorPublicProfileEnhanced
   - URL should stay `/miriam`

2. **Reserved Word Route**
   - Navigate to `/explore`
   - Should render ExplorePage (not treated as username)
   - URL should stay `/explore`

3. **Invalid Format Route**
   - Navigate to `/ab` (too short)
   - Should redirect to `/404`
   - Navigate to `/test@user` (invalid chars)
   - Should redirect to `/404`

4. **Non-Existent Username**
   - Navigate to `/thisuserdoesnotexist12345`
   - VanityRoute passes (valid format)
   - CreatorPublicProfileEnhanced should handle 404

5. **Case Insensitivity**
   - Navigate to `/MIRIAM`
   - Should render same profile as `/miriam`
   - Backend should resolve case-insensitively

### 4. Creator Card Links

**Location**: Explore page, search results, etc.

**Test Cases**:

1. **Click Creator Card**
   - Click on a creator card
   - Should navigate to `/:username` (not `/creator/:username`)
   - URL should be lowercase
   - Profile should load correctly

2. **Legacy URL Redirect**
   - Manually navigate to `/creator/miriam`
   - Should redirect to `/miriam`
   - Profile should load correctly

3. **URL Encoding**
   - Test usernames with dots: `/user.name`
   - Test usernames with hyphens: `/user-name`
   - Test usernames with underscores: `/user_name`
   - All should work correctly

---

## Integration Testing

### 1. End-to-End Username Change Flow

1. **Login as Creator**
2. **Navigate to Settings/Edit Profile**
3. **Open Username Field**
   - See current username
   - See current URL preview
4. **Type New Username**
   - See live validation
   - See availability checking
5. **Save New Username**
   - Get success toast with new URL
   - Field updates with new username
6. **Navigate to Old URL** (if you saved old URL)
   - Should redirect to new username URL
   - Or show 404 (depending on implementation)
7. **Navigate to New URL**
   - `/:newusername` should load your profile
8. **Try to Change Again**
   - Should get cooldown error

### 2. Race Condition Test

**Goal**: Verify database handles simultaneous claims

1. **Open Two Browser Windows** (different users)
2. **Both Type Same Username** (e.g., "superhandle")
3. **Both See "Available"**
4. **Both Click Save Simultaneously**
5. **Result**:
   - One should succeed (200 OK)
   - One should fail (409 Conflict "Username taken")
   - Database should have exactly one user with that username

### 3. Quarantine Test

**Goal**: Verify released usernames are held for 30 days

1. **User A Changes Username** from "oldhandle" to "newhandle"
2. **Check Database**:
   ```sql
   SELECT * FROM username_quarantine WHERE username = 'oldhandle';
   ```
   - Should have entry with `available_at` 30 days in future
3. **User B Tries to Claim "oldhandle"**
   - Availability check should return `taken` or `quarantined`
   - Update should fail with 409 Conflict
4. **Wait 30 Days** (or manually update `available_at` in DB)
5. **User B Tries Again**
   - Should succeed

---

## Performance Testing

### 1. Debouncing Test

**Goal**: Verify API isn't hammered during typing

1. **Open Browser Network Tab**
2. **Type Username Rapidly**: "t" "e" "s" "t" "u" "s" "e" "r"
3. **Check Network Requests**
   - Should see only 1-2 availability requests (not 8)
   - Requests should only fire after 350ms pause

### 2. Database Query Performance

```sql
-- Test username lookup performance
EXPLAIN ANALYZE
SELECT * FROM users WHERE LOWER(username) = 'miriam';
-- Should use index scan, not seq scan

-- Test follower count aggregation
EXPLAIN ANALYZE
SELECT u.*,
       (SELECT COUNT(*) FROM follows WHERE creator_id = u.id) as follower_count
FROM users u
WHERE LOWER(u.username) = 'miriam';
-- Should be fast (<50ms for reasonable data size)
```

### 3. Load Testing

```bash
# Use Apache Bench or similar
ab -n 1000 -c 10 "http://localhost:5001/api/public/usernames/availability?username=testuser"

# Check for:
# - No 500 errors
# - Reasonable response time (<100ms p95)
# - No rate limiting errors (unless intended)
```

---

## Security Testing

### 1. SQL Injection Test

```bash
# Try SQL injection in username
curl "http://localhost:5001/api/public/usernames/availability?username='; DROP TABLE users; --"
# Expected: Should be safely escaped, return invalid format

# Try in update
curl -X PATCH "http://localhost:5001/api/users/me/username" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"'; DROP TABLE users; --"}'
# Expected: Should fail validation, no SQL executed
```

### 2. Authorization Test

```bash
# Try to update username without auth token
curl -X PATCH "http://localhost:5001/api/users/me/username" \
  -H "Content-Type: application/json" \
  -d '{"username":"hacked"}'
# Expected: 401 Unauthorized

# Try to update another user's username
# (Would need to modify endpoint to accept user_id - should be rejected)
```

### 3. Rate Limiting Test

```bash
# Spam availability endpoint
for i in {1..100}; do
  curl "http://localhost:5001/api/public/usernames/availability?username=test$i" &
done
wait

# Check if rate limiting kicks in
# Expected: Some requests might get 429 Too Many Requests
```

---

## Smoke Tests (Quick Verification)

Run these after deployment to verify system works:

```bash
# 1. Check availability endpoint
curl "https://digis.cc/api/public/usernames/availability?username=testuser123"

# 2. Check creator lookup
curl "https://digis.cc/api/public/creators/miriam"

# 3. Navigate to vanity URL in browser
open "https://digis.cc/miriam"

# 4. Check database constraints
psql $DATABASE_URL -c "SELECT count(*) FROM users WHERE username IS NOT NULL;"
psql $DATABASE_URL -c "SELECT count(*) FROM username_quarantine;"
psql $DATABASE_URL -c "SELECT count(*) FROM username_changes;"
```

---

## Common Issues & Debugging

### Issue: "Username already taken" but it's my username

**Cause**: Trying to set username to current value
**Fix**: Frontend should disable save button when username matches current

### Issue: Can't change username even though 30 days passed

**Cause**: `username_changed_at` not being set correctly
**Debug**:
```sql
SELECT username, username_changed_at,
       EXTRACT(DAY FROM NOW() - username_changed_at) as days
FROM users WHERE id = '<user-id>';
```

### Issue: Vanity URL shows 404 for valid creator

**Cause**: VanityRoute guard might be too strict
**Debug**: Check browser console for logs from VanityRoute.jsx
**Fix**: Verify username passes validation regex

### Issue: Case-insensitive lookup not working

**Cause**: Missing `LOWER()` in query
**Debug**: Check backend logs, verify query uses `LOWER(username) = LOWER($1)`

### Issue: Reserved word still allowed

**Cause**: Reserved list not synced between frontend/backend
**Fix**: Both should import from `shared/reservedHandles.js`

---

## Rollout Checklist

- [ ] Run database migrations
- [ ] Verify unique index exists: `\d users` in psql
- [ ] Test availability endpoint
- [ ] Test update endpoint with valid token
- [ ] Test 30-day cooldown enforcement
- [ ] Test quarantine system
- [ ] Deploy frontend with new routes
- [ ] Test vanity URLs in production
- [ ] Test legacy URL redirects
- [ ] Monitor error logs for 24 hours
- [ ] Check database for duplicate usernames
- [ ] Verify audit log is populating

---

## API Reference

### GET /api/public/usernames/availability

**Query Params**:
- `username` (required): Username to check

**Response** (200 OK):
```json
{
  "available": true,
  "username": "normalized_username"
}
```

OR

```json
{
  "available": false,
  "reason": "taken|reserved|too_short|too_long|invalid_format",
  "message": "Human-readable error"
}
```

### PATCH /api/users/me/username

**Headers**:
- `Authorization: Bearer <token>` (required)

**Body**:
```json
{
  "username": "newhandle"
}
```

**Response** (200 OK):
```json
{
  "ok": true,
  "username": "newhandle",
  "url": "https://digis.cc/newhandle"
}
```

**Error Responses**:
- `400`: Invalid username format
- `401`: Not authenticated
- `409`: Username taken
- `429`: Cooldown active (30 days)

### GET /api/public/creators/:identifier

**Path Params**:
- `identifier`: Username, UUID, or Supabase ID

**Response** (200 OK):
```json
{
  "id": "uuid",
  "username": "miriam",
  "display_name": "Miriam",
  "bio": "...",
  "follower_count": 1234,
  // ... other profile fields
}
```

**Error Responses**:
- `404`: Creator not found

---

## Testing Summary

After completing all tests above, you should have verified:

- ✅ Username uniqueness (case-insensitive)
- ✅ 30-day cooldown enforcement
- ✅ 30-day quarantine for released names
- ✅ Reserved words protection
- ✅ Format validation (3-30 chars, alphanumeric + ._-)
- ✅ Race condition handling
- ✅ Vanity URL routing
- ✅ Legacy URL redirects
- ✅ Live availability checking with debouncing
- ✅ Atomic database updates
- ✅ Audit trail logging
- ✅ Security (SQL injection, auth, rate limiting)

Your Instagram-style vanity URL system is now production-ready! 🎉
