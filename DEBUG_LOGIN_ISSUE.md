# Login Infinite Loading Issue - Diagnosis

## Problem
After successful login, the page just keeps loading with nothing in console.

## Root Cause
You have **TWO competing authentication systems**:

### 1. LoginForm.tsx (TypeScript)
```typescript
// Uses hooks/api/useAuth.ts
const loginMutation = useLogin();

// On submit:
await loginMutation.mutateAsync({ email, password });
// ↓ This calls Supabase signIn
// ↓ Then fetches /api/users/profile
// ↓ Then calls onSuccess()
```

### 2. AuthContext.jsx (JavaScript)
```javascript
// Initializes on mount in useEffect
// Calls /api/auth/sync-user
// Sets authLoading state
```

## The Problem
1. User logs in via LoginForm
2. LoginForm's `useLogin` succeeds and calls `onSuccess()`
3. BUT `AuthContext` is still in loading state (`authLoading = true`)
4. App.js checks `if (authLoading) return <LoadingScreen />`
5. **STUCK IN INFINITE LOADING**

## The Fix
You need to connect the LoginForm's success to the AuthContext, OR disable one of the auth systems.

## Recommended Solution
Update LoginForm to use AuthContext instead of the separate useLogin hook.
