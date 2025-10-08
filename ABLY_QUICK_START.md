# Ably Quick Start - 5 Minute Setup

## 1. Get API Key (2 minutes)

1. Go to https://ably.com/sign-up
2. Create free account
3. Create new app
4. Copy API key: `xxxxx.xxxxxx:xxxxxxxxxxxxxxxxxxxx`

## 2. Add to Environment (30 seconds)

```bash
# backend/.env
ABLY_API_KEY=your_api_key_here
```

## 3. Test Auth Endpoint (1 minute)

### Start backend:
```bash
cd backend
pnpm dev
```

### Test endpoint:
```bash
curl -X POST http://localhost:3005/api/ably-auth
```

**Expected response:**
```json
{
  "keyName": "xxxxx",
  "ttl": 3600000,
  "capability": "{\"chat:*\":[\"subscribe\",\"history\"]}",
  "nonce": "...",
  "mac": "...",
  "timestamp": 1234567890
}
```

✅ If you see this, auth is working!

## 4. Test Frontend Connection (2 minutes)

### Option A: Add feature flag

```bash
# frontend/.env
VITE_USE_ABLY=true
```

### Option B: Test in one component

```javascript
// Replace this
import socketService from './services/socketService';

// With this
import socketService from './services/ablyService';

// Everything else stays the same!
await socketService.connect();
await socketService.joinStream('test-stream-123');
```

## 5. Verify Connection

Open browser console, you should see:
```
✅ Ably connected: user_6facd4e6-52b1...
Joined stream test-stream-123, viewers: 1
```

## Usage Examples

### Join Stream
```javascript
await socketService.joinStream('livestream-abc');
```

### Send Chat Message
```javascript
await socketService.emit('chat-message', {
  text: 'Hello!',
  streamId: 'livestream-abc',
  userId: currentUser.id
});
```

### Listen for Messages
```javascript
socketService.on('chat-message', (message) => {
  console.log('New message:', message);
});
```

### Update Presence
```javascript
await socketService.updatePresence('online');
```

### Typing Indicators
```javascript
await socketService.startTyping('chat-room-123');
// ... user stops typing
await socketService.stopTyping('chat-room-123');
```

---

## Channel Naming Convention

| Pattern | Example | Purpose |
|---------|---------|---------|
| `chat:{id}` | `chat:stream-abc` | Stream chat |
| `stream:{id}` | `stream:livestream-123` | Stream metadata |
| `presence:*` | `presence:global` | User online status |
| `user:{id}` | `user:6facd4e6-52b1...` | Private messages |

---

## Troubleshooting

### ❌ "Ably not configured"
**Fix:** Add `ABLY_API_KEY` to `.env` and restart server

### ❌ "Connection timeout"
**Fix:** Check that backend is running on correct port

### ❌ "Invalid token"
**Fix:** Verify API key format: `xxxxx.xxxxxx:xxxxxxxxxxxxxxxxxxxx`

### ❌ "Permission denied"
**Fix:** Check token capabilities in `/backend/api/ably-auth.js`

---

## Next Steps

1. ✅ Test in development
2. ✅ Deploy to staging/Vercel
3. ✅ Test production deployment
4. ✅ Monitor Ably dashboard
5. ✅ Gradually roll out to users

**Full documentation:** See `ABLY_MIGRATION_GUIDE.md`
