# Ably Frontend Integration Guide

## Overview

The Digis frontend now supports both Socket.io (legacy) and Ably (Vercel-ready) real-time services through a feature flag system. This allows for gradual migration without breaking existing functionality.

## ✅ What's Been Implemented

### 1. Ably Service (`frontend/src/services/ablyService.js`)
Drop-in replacement for Socket.io with 100% API compatibility:
- ✅ Connection management with automatic reconnection
- ✅ Token-based authentication (prevents API key exposure)
- ✅ Message history (rewind last 50 messages)
- ✅ Presence tracking (user online/offline status)
- ✅ Typing indicators
- ✅ Stream join/leave functionality
- ✅ Event pub/sub with same API as Socket.io

### 2. Feature Flag System
**Environment Variables:**
```bash
# Development (.env)
VITE_USE_ABLY=true

# Production (.env.production)
VITE_USE_ABLY=true
```

### 3. Service Wrapper (`frontend/src/services/socketServiceWrapper.js`)
Smart wrapper that automatically selects the correct service:
```javascript
// Automatically uses Ably if VITE_USE_ABLY=true
import socketService from './services/socketServiceWrapper';
await socketService.connect();
```

### 4. Test Suite (`frontend/src/tests/ablyConnection.test.js`)
Comprehensive test file for Ably connection:
- Connection test
- Status check
- Presence update
- Stream join/leave
- Message emission

## 📋 Integration Options

### Option A: Use Feature Flag (Recommended)
**Pros:**
- Zero code changes required
- Easy rollback (just flip the flag)
- Can A/B test with percentage of users

**Implementation:**
1. Set `VITE_USE_ABLY=true` in `.env`
2. Restart frontend: `pnpm dev`
3. All real-time features automatically use Ably

### Option B: Direct Import
**Pros:**
- Explicit control over which service to use
- Can mix Socket.io and Ably in same app

**Implementation:**
```javascript
// Use Ably directly
import ablyService from './services/ablyService';
await ablyService.connect();

// Use Socket.io directly
import socketService from './services/socket';
await socketService.connect();
```

## 🧪 Testing

### 1. Manual Browser Test
```javascript
// Open browser console
window.testAblyConnection = async () => {
  const { default: ablyService } = await import('./services/ablyService.js');
  await ablyService.connect();
  console.log('Status:', ablyService.getStatus());
};

// Run test
testAblyConnection();
```

### 2. Component Test
```javascript
import { useEffect } from 'react';
import ablyService from './services/ablyService';

function TestComponent() {
  useEffect(() => {
    const init = async () => {
      await ablyService.connect();
      console.log('✅ Ably connected:', ablyService.getStatus());

      // Test presence
      await ablyService.updatePresence('online');

      // Test join stream
      const result = await ablyService.joinStream('test-123');
      console.log('Stream joined:', result);

      // Test message
      await ablyService.emit('test-message', {
        streamId: 'test-123',
        text: 'Hello Ably!'
      });
    };

    init().catch(console.error);

    return () => {
      ablyService.disconnect();
    };
  }, []);

  return <div>Testing Ably...</div>;
}
```

### 3. Automated Test
```bash
cd frontend
pnpm test src/tests/ablyConnection.test.js
```

## 🔄 API Compatibility

All Socket.io methods work identically with Ably:

| Method | Socket.io | Ably | Status |
|--------|-----------|------|--------|
| `connect()` | ✅ | ✅ | Compatible |
| `disconnect()` | ✅ | ✅ | Compatible |
| `emit(event, data)` | ✅ | ✅ | Compatible |
| `on(event, callback)` | ✅ | ✅ | Compatible |
| `once(event, callback)` | ✅ | ✅ | Compatible |
| `off(event, callback)` | ✅ | ✅ | Compatible |
| `joinStream(id)` | ✅ | ✅ | Compatible |
| `leaveStream(id)` | ✅ | ✅ | Compatible |
| `updatePresence(status)` | ✅ | ✅ | Compatible |
| `startTyping(channel)` | ✅ | ✅ | Compatible |
| `stopTyping(channel)` | ✅ | ✅ | Compatible |
| `getStatus()` | ✅ | ✅ | Compatible |

## 🚀 Deployment Checklist

### Local Development
- [x] Ably SDK installed (`pnpm add ably`)
- [x] Feature flag added to `.env` (`VITE_USE_ABLY=true`)
- [x] Backend auth endpoint working (`/api/ably-auth`)
- [ ] Test connection in browser
- [ ] Test real-time features (chat, presence, streams)

### Staging/Production
- [ ] Set `VITE_USE_ABLY=true` in Vercel environment variables
- [ ] Test auth endpoint on production backend
- [ ] Monitor Ably dashboard for connections
- [ ] Test with real users
- [ ] Monitor error rates in Sentry

## 🐛 Troubleshooting

### Connection Fails
**Symptom:** `Failed to connect to Ably`
**Fix:**
1. Check backend is running: `http://localhost:3005/api/ably-auth`
2. Verify `ABLY_API_KEY` in backend `.env`
3. Check browser console for errors
4. Verify `VITE_BACKEND_URL` in frontend `.env`

### Token Authentication Errors
**Symptom:** `Invalid token` or `401 Unauthorized`
**Fix:**
1. Check Supabase session is valid
2. Verify auth token in request headers
3. Check backend logs for auth errors

### Messages Not Receiving
**Symptom:** Can send but not receive messages
**Fix:**
1. Check channel subscription: `ablyService.getStatus()`
2. Verify event listeners are attached before messages sent
3. Check capability permissions in backend `/api/ably-auth.js`

### Presence Not Updating
**Symptom:** User online status not changing
**Fix:**
1. Verify presence channel: `presence:global`
2. Check capability includes `["presence"]` permission
3. Ensure `updatePresence()` is called after `connect()`

## 📊 Monitoring

### Ably Dashboard
Monitor real-time metrics:
- **Connections:** Active WebSocket connections
- **Messages:** Message throughput
- **Channels:** Active channels
- **Errors:** Connection/authentication failures

Access: https://ably.com/dashboard

### Browser Console
Enable debug logs:
```javascript
localStorage.setItem('Ably.debug', 'true');
location.reload();
```

### Backend Logs
Token creation logs:
```
📝 Ably token created: {
  clientId: "6facd4e6-52b1-484e-bc5f-c159f4cab63c",
  role: "creator",
  authenticated: true,
  capabilities: "chat:*, stream:*, presence:*, user:..."
}
```

## 🔄 Rollback Plan

### Instant Rollback (Feature Flag)
```bash
# Set in .env
VITE_USE_ABLY=false

# Or in Vercel dashboard
VITE_USE_ABLY=false

# Redeploy
vercel --prod
```

### Gradual Rollout (A/B Test)
```javascript
// In socketServiceWrapper.js
const USE_ABLY = Math.random() < 0.10; // 10% of users
```

## 📚 Additional Resources

- **Ably Docs:** https://ably.com/docs
- **Ably React SDK:** https://ably.com/docs/getting-started/react
- **Channel Naming:** `ABLY_MIGRATION_GUIDE.md`
- **Backend Setup:** `VERCEL_DEPLOYMENT_STATUS.md`
- **Quick Start:** `ABLY_QUICK_START.md`

## 🎯 Next Steps

1. **Test in Development:**
   - Set `VITE_USE_ABLY=true`
   - Test all real-time features
   - Monitor browser console for errors

2. **Deploy to Staging:**
   - Deploy frontend to Vercel
   - Set environment variables
   - Test with production backend

3. **Gradual Production Rollout:**
   - Start with 10% of users
   - Monitor error rates
   - Increase to 50%, then 100%

4. **Post-Migration:**
   - Remove Socket.io dependencies (optional)
   - Update documentation
   - Archive legacy Socket.io code

---

**Status:** ✅ Frontend integration complete and ready for testing

**Last Updated:** January 2025
