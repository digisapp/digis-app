# Miriam Authentication Issue - Diagnosis & Fix

## ✅ Findings

### Database Status
- **Miriam exists**: ✅ Yes
- **supabase_id**: `6facd4e6-52b1-484e-bc5f-c159f4cab63c`
- **Email**: `miriam@examodels.com`
- **Username**: `miriam`
- **is_creator**: `true`
- **role**: `creator`
- **creator_type**: `Content Creator`

### Likely Issue
The problem is **NOT** with the database or backend. Miriam's account is correctly configured.

The issue is likely one of these:

1. **Frontend Session Not Persisting**
   - Supabase session not saved to localStorage
   - Browser cache clearing between refreshes
   - Multiple tabs causing session conflicts

2. **Backend Sync Failing Silently**
   - `/api/auth/sync-user` returning error
   - JWT token expired or invalid
   - CORS blocking the request

3. **Profile Cache Corruption**
   - Old "default" profile cached
   - Not clearing cache on logout

---

## 🔧 Quick Fix Steps

### Step 1: Clear Browser Storage
```javascript
// Run this in browser console (F12)
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Step 2: Check Backend Logs
When Miriam logs in, check backend console for:
```
✅ sync-user request { userId: '6facd4e6-...', email: 'miriam@examodels.com' }
✅ Canonical profile computed: { username: 'miriam', is_creator: true }
```

If you see ❌ errors, that's the problem.

### Step 3: Test Sync Endpoint Manually
```bash
# Get Miriam's JWT token from browser:
# 1. Login as Miriam
# 2. Open DevTools (F12) → Application → Local Storage
# 3. Find "sb-[project-id]-auth-token"
# 4. Copy the access_token value

# Then test:
curl -X POST https://your-backend.vercel.app/api/auth/sync-user \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supabaseId": "6facd4e6-52b1-484e-bc5f-c159f4cab63c",
    "email": "miriam@examodels.com"
  }'
```

Expected response:
```json
{
  "success": true,
  "user": {
    "username": "miriam",
    "is_creator": true,
    "email": "miriam@examodels.com"
  }
}
```

---

## 🐛 Common Causes

### 1. Multiple Supabase Instances
If you have multiple `supabase` clients, they can conflict.

**Check**: Search codebase for `createClient` calls:
```bash
grep -r "createClient" frontend/src/
```

**Fix**: Use only `/frontend/src/utils/supabase-auth.js`

### 2. Auth Cache Not Clearing
Old profile stuck in localStorage.

**Fix**: Add to logout handler:
```javascript
const signOut = async () => {
  await supabase.auth.signOut();
  localStorage.removeItem('digis-profile-cache');
  localStorage.removeItem('digis-token-balance');
  clearProfileCache();
  location.reload();
};
```

### 3. Backend ENV Vars Missing
If `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are wrong in Vercel.

**Check**: Visit https://your-backend.vercel.app/test
Look for:
```json
{
  "supabaseUrl": "Loaded" // Should be "Loaded", not "Missing"
}
```

---

## 🚨 Emergency Reset

If nothing works, run this in browser console as Miriam:

```javascript
// 1. Clear everything
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('supabase-auth');

// 2. Force logout
await supabase.auth.signOut();

// 3. Wait 2 seconds
await new Promise(r => setTimeout(r, 2000));

// 4. Login again
location.href = '/login';
```

---

## 📊 Next Steps

1. Have Miriam login
2. Open browser DevTools (F12) → Console
3. Look for these logs:
   - `✅ sync-user success: { username: 'miriam', is_creator: true }`
   - `✅ Canonical profile computed`
   - `✅ Role verified: creator`

4. If you see ❌ errors, screenshot them and share
5. If no logs appear, the frontend isn't calling sync-user

---

## 💡 Pro Tip

Add this to AuthContext to debug:

```javascript
useEffect(() => {
  console.log('🔍 AUTH STATE:', {
    user: user?.email,
    profile: profile?.username,
    isCreator,
    tokenBalance
  });
}, [user, profile, isCreator, tokenBalance]);
```

This will show exactly what AuthContext sees.

