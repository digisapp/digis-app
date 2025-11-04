# Agora Client Singleton Usage

## ⚠️ CRITICAL: Your Backend Uses UID-Bound Tokens

Your `/streaming/go-live` endpoint returns:

```json
{
  "agora": {
    "appId": "...",
    "token": "...",
    "channel": "creator_abc123",
    "uid": 1234567,  // ← MUST use this exact UID!
    "role": "host"
  }
}
```

The `token` is **bound to that specific `uid`**. If you join with a different UID or `undefined`, Agora rejects it with `UID_CONFLICT`.

## ✅ Correct Usage

```tsx
import { joinAsHost, getClient, safeLeave } from '@/lib/agoraClient';

// After successful /go-live call:
const response = await apiPost('/streaming/go-live', streamConfig);
const { appId, token, channel, uid } = response.agora;

// Join with the EXACT uid from backend:
const result = await joinAsHost({
  appId,
  channel,
  token,
  uid  // ← CRITICAL: Use backend's uid!
});

console.log('Joined with UID:', result.uid); // Should match backend's uid

// Get the client to publish tracks:
const client = getClient();
await client.publish([audioTrack, videoTrack]);
```

## ❌ Wrong Usage (Causes UID_CONFLICT)

```tsx
// DON'T DO THIS:
await joinAsHost({ appId, channel, token }); // Missing uid!
await joinAsHost({ appId, channel, token, uid: undefined }); // Wrong!
await joinAsHost({ appId, channel, token, uid: 999 }); // Different uid!
```

## 🔧 In Your VideoCall Component

```tsx
useEffect(() => {
  let mounted = true;

  (async () => {
    // Prevent double-mount in StrictMode
    if (!mounted) return;

    try {
      // Get stream config (includes Agora credentials)
      const { agora } = streamConfig; // from navigation state or props

      // Join with backend's UID
      const { client, uid } = await joinAsHost({
        appId: agora.appId,
        channel: agora.channel,
        token: agora.token,
        uid: agora.uid  // ← From backend!
      });

      // Now create and publish tracks
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      await client.publish([audioTrack, videoTrack]);

      console.log('✅ Streaming with UID:', uid);
    } catch (error) {
      console.error('Join error:', error);
    }
  })();

  return () => {
    mounted = false;
    safeLeave(); // Cleanup on unmount
  };
}, [streamConfig.agora.channel]); // Only re-run if channel changes
```

## 🐛 Debugging

Run this in browser console:
```js
import { getJoinState } from '@/lib/agoraClient';
console.log(getJoinState()); // Shows current state
```

Expected output:
```js
{
  channel: "creator_abc123",
  uid: 1234567,  // Should match backend's uid
  joining: false
}
```

## 📊 Why This Works

1. **Singleton**: Only ONE client exists across the app
2. **Debounce**: `_joining` flag prevents concurrent joins
3. **Force leave**: Always leaves before joining (clears ghosts)
4. **Correct UID**: Uses backend's UID (token validation succeeds)
5. **250ms delay**: Gives Agora time to release old session

Result: **No more UID_CONFLICT!** ✅
