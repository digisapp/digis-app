# Agora Privacy Calls - Green-Light Checklist

**Duration**: 15 minutes
**Goal**: Verify end-to-end flow works before production rollout

---

## ✅ Go/No-Go Checklist

### 1. Backend Ready (2 min)

- [ ] ✅ `FEATURE_CALLS=true` in `backend/.env`
- [ ] ✅ `AGORA_APP_ID` set in `backend/.env`
- [ ] ✅ `AGORA_APP_CERTIFICATE` set in `backend/.env`
- [ ] ✅ `npm run migrate` created tables:
  ```bash
  psql $DATABASE_URL -c "\dt" | grep -E "calls|call_invitations"
  # Expected: calls, call_invitations tables exist
  ```

**Status**: ⬜ PASS / ⬜ FAIL

---

### 2. Socket Events Flowing (3 min)

Open **two browser windows** (Creator + Fan), open console in both.

#### Test A: Creator Initiates → Fan Receives

- [ ] ✅ Creator clicks "Call Fan" button
- [ ] ✅ Fan console shows:
  ```javascript
  [Socket] call:incoming {callId:"...", creatorName:"...", callType:"video"}
  ```
- [ ] ✅ Fan sees `IncomingCallModal` with creator info and countdown

#### Test B: Fan Accepts → Creator Notified

- [ ] ✅ Fan clicks "Accept"
- [ ] ✅ Creator console shows:
  ```javascript
  [Socket] call:status {callId:"...", state:"accepted", fanId:"..."}
  ```
- [ ] ✅ Creator UI navigates to call screen

#### Test C: Creator Cancels → Fan Notified

- [ ] ✅ Start new call
- [ ] ✅ Creator cancels before fan accepts
- [ ] ✅ Fan console shows:
  ```javascript
  [Socket] call:canceled {callId:"..."}
  ```
- [ ] ✅ Fan's modal dismisses automatically

**Status**: ⬜ PASS / ⬜ FAIL

---

### 3. Video & Voice Paths (5 min)

#### Test A: Video Call

- [ ] ✅ Creator initiates **video** call
- [ ] ✅ Fan accepts
- [ ] ✅ **Both sides see local video** (small pip/preview)
- [ ] ✅ **Both sides see remote video** (full screen)
- [ ] ✅ Both sides hear audio
- [ ] ✅ Console shows:
  ```javascript
  [AGORA] state CONNECTING -> CONNECTED
  [AGORA] published <uid> video
  [AGORA] published <uid> audio
  ```

#### Test B: Voice Call

- [ ] ✅ Creator initiates **voice** call
- [ ] ✅ Fan accepts
- [ ] ✅ **No camera prompt** appears (iOS especially)
- [ ] ✅ **Both sides hear audio**
- [ ] ✅ No video tracks created
- [ ] ✅ Console shows:
  ```javascript
  [AGORA] state CONNECTING -> CONNECTED
  [AGORA] published <uid> audio
  ```
  (Note: No "published video" log)

**Status**: ⬜ PASS / ⬜ FAIL

---

### 4. iOS Sanity (3 min - if iOS device available)

Open in **iOS Safari**:

#### Test A: User Gesture Required

- [ ] ✅ Creator calls fan
- [ ] ✅ Fan **taps "Accept"** button
- [ ] ✅ Camera/mic permissions prompt **after** tap (not before)
- [ ] ✅ No "play() failed" or autoplay errors in console
- [ ] ✅ Tracks initialize successfully

#### Test B: Background Cleanup

- [ ] ✅ Start call (accept it)
- [ ] ✅ Press Home button (background app)
- [ ] ✅ Fan's call UI cleans up (no stuck state)
- [ ] ✅ Console shows:
  ```javascript
  📱 Page hiding/backgrounding, cleaning up call...
  ```
- [ ] ✅ Return to app → clean state

**Status**: ⬜ PASS / ⬜ FAIL / ⬜ SKIP (no iOS device)

---

### 5. Guardrails (2 min)

#### Test A: Call Cooldown

- [ ] ✅ Creator calls Fan
- [ ] ✅ Fan accepts or declines
- [ ] ✅ Creator **immediately** tries to call same Fan again
- [ ] ✅ Error toast shows: **"Please wait XXs before calling again"**
- [ ] ✅ API returns:
  ```json
  {
    "code": "CALL_COOLDOWN",
    "error": "Please wait before calling this fan again",
    "retryAfter": 57
  }
  ```

#### Test B: Blocked Fan

- [ ] ✅ Add block in database:
  ```sql
  INSERT INTO creator_blocked_users (creator_id, blocked_user_id)
  VALUES ('CREATOR_ID', 'FAN_ID');
  ```
- [ ] ✅ Creator tries to call blocked Fan
- [ ] ✅ Error toast shows: **"Unable to call this fan"**
- [ ] ✅ API returns:
  ```json
  {
    "code": "FAN_BLOCKED",
    "error": "Unable to call this fan"
  }
  ```
- [ ] ✅ Remove block for future tests:
  ```sql
  DELETE FROM creator_blocked_users WHERE creator_id = 'CREATOR_ID' AND blocked_user_id = 'FAN_ID';
  ```

**Status**: ⬜ PASS / ⬜ FAIL

---

## 🚦 Final Decision

**Total Checks Passed**: _____ / 5 sections

### ✅ GREEN LIGHT - Ship It!
All 5 sections passed. Ready for production rollout.

**Action**: Deploy with `FEATURE_CALLS=true`

---

### ⚠️ YELLOW LIGHT - Proceed with Caution
4/5 sections passed. Known issues documented.

**Action**: Deploy but monitor closely. Document known issues.

---

### 🛑 RED LIGHT - Do Not Ship
Less than 4/5 sections passed. Critical issues present.

**Action**: Fix critical issues first. Re-run checklist.

---

## 🐛 Quick Triage Guide

### Issue: Fan Never Sees Invite

**Symptoms**: Creator clicks "Call", but fan's modal never appears

**Checks**:
1. **Socket.io CORS**: Verify frontend origin allowed
   ```javascript
   // backend/api/index.js
   cors: {
     origin: process.env.FRONTEND_URL,  // Must match frontend URL
     credentials: true
   }
   ```

2. **Room Name**: Confirm emitting to correct fan channel
   ```javascript
   // backend/routes/calls.js - should be:
   global.io.to(`user:${fanId}`).emit('call:incoming', {...});
   // NOT: `user:${fan.username}` or other variants
   ```

3. **Socket Connection**: Check browser console
   ```javascript
   // Should see:
   ✅ Connected to Socket.io
   ✅ Joined room: user:FAN_ID
   ```

4. **Backend Logs**: Look for socket emit confirmation
   ```bash
   tail -f backend/logs/combined.log | grep "Call invitation sent"
   ```

**Fix**:
- Ensure `global.io` is initialized
- Verify Socket.io client connects with correct token
- Check room naming matches backend emit

---

### Issue: Accept Returns 401

**Symptoms**: Fan clicks "Accept", gets "Unauthorized" error

**Checks**:
1. **Token Exists**: Check Network tab → Request Headers
   ```
   Authorization: Bearer eyJhbGci...
   ```

2. **Token Fresh**: Supabase tokens expire after 1 hour
   ```javascript
   // Your authedFetch should auto-refresh
   const session = await getSession();
   if (session.expires_at < Date.now()) {
     await refreshSession();
   }
   ```

3. **Backend Auth Middleware**: Verify authenticateToken works
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/calls/pending
   # Should return 200, not 401
   ```

**Fix**:
- Use `authedFetch` (not raw `fetch`) - handles token refresh
- Check Supabase session validity
- Verify `authenticateToken` middleware on `/api/calls/*` routes

---

### Issue: Black Video / No Audio

**Symptoms**: Call connects, but no video/audio streams

**Checks**:
1. **User Gesture (iOS)**: Tracks must be created AFTER button click
   ```javascript
   // ✅ CORRECT: joinAgoraCall() called in onClick handler
   const handleAccept = async () => {
     await joinAgoraCall(credentials);  // User gesture present
   };

   // ❌ WRONG: joinAgoraCall() called in useEffect before interaction
   useEffect(() => {
     joinAgoraCall(credentials);  // No user gesture - iOS blocks
   }, []);
   ```

2. **DOM Ready**: Container must exist before playing tracks
   ```javascript
   // Ensure <div id="remote-video"> is mounted
   const remoteContainer = document.getElementById('remote-video');
   if (remoteContainer) {
     user.videoTrack.play(remoteContainer);
   }
   ```

3. **Agora Events**: Check console for connection states
   ```javascript
   // Should see:
   [AGORA] state CONNECTING -> CONNECTED
   [AGORA] published 12345 video
   [AGORA] published 12345 audio
   ```

4. **Permissions**: Verify camera/mic access granted
   ```javascript
   // Chrome: chrome://settings/content/camera
   // Safari: Settings > Safari > Camera/Microphone
   ```

**Fix**:
- Always call `joinAgoraCall()` from user event handler
- Verify DOM containers exist before `.play()`
- Check browser permissions
- Add instrumentation (see "Minimal Instrumentation" below)

---

### Issue: Infinite Ringing

**Symptoms**: Invitation never expires, fan sees modal forever

**Checks**:
1. **Expiration Job Running**: Check backend logs
   ```bash
   tail -f backend/logs/combined.log | grep "expire-call"
   # Should see periodic runs every 30s
   ```

2. **Job Initialized**: Verify job started in `backend/api/index.js`
   ```javascript
   // Should have:
   const expireCallJob = require('./jobs/expire-call-invitations');
   expireCallJob.start();
   ```

3. **Frontend Cleanup**: Check `pagehide` event fires
   ```javascript
   // In useCallInvites.js - should have:
   window.addEventListener('pagehide', onPageHide);
   ```

4. **Database TTL**: Verify invitation has `expires_at`
   ```sql
   SELECT id, expires_at, NOW() FROM call_invitations WHERE state = 'pending';
   ```

**Fix**:
- Start expiration job in server startup
- Add `pagehide` cleanup in `useCallInvites`
- Verify invitation created with 2-minute TTL

---

### Issue: Cooldown Not Enforced

**Symptoms**: Creator can spam calls without 60s delay

**Checks**:
1. **Server Clock**: Ensure server time correct
   ```bash
   date
   # Should match actual time
   ```

2. **Creator/Fan IDs Match**: Check backend logs
   ```bash
   tail -f backend/logs/combined.log | grep "checkCallCooldown"
   # Should show: key=CREATOR_ID:FAN_ID
   ```

3. **Cooldown Map Persists**: Verify server not restarting between calls
   ```javascript
   // In backend/routes/calls.js
   const callCooldowns = new Map();  // In-memory - cleared on restart
   ```

4. **Time Calculation**: Check cooldown logic
   ```javascript
   const cooldownMs = 60000; // 60 seconds
   const remaining = Math.ceil((cooldownMs - (now - lastCall)) / 1000);
   ```

**Fix**:
- Verify server clock accurate
- Check IDs in cooldown key match request IDs
- Don't restart server between test calls
- Consider Redis for persistent cooldowns in production

---

## 📊 Minimal Instrumentation to Keep

### Frontend - In Your Call UI

Add once in your call component (both session + privacy flows):

```javascript
// In VideoCallRefactored.js or wherever you initialize Agora client
useEffect(() => {
  if (!client) return;

  // Connection state changes
  client.on('connection-state-change', (curState, prevState, reason) => {
    console.log('[AGORA] state', prevState, '->', curState, 'reason:', reason);

    // Optional: Show reconnecting UI
    if (curState === 'RECONNECTING') {
      showReconnectingUI();
    }
  });

  // Remote user publishes track
  client.on('user-published', (user, mediaType) => {
    console.log('[AGORA] published', user.uid, mediaType);
  });

  // Remote user unpublishes track
  client.on('user-unpublished', (user, mediaType) => {
    console.log('[AGORA] unpublished', user.uid, mediaType);
  });

  // Cleanup
  return () => {
    client.off('connection-state-change');
    client.off('user-published');
    client.off('user-unpublished');
  };
}, [client]);
```

### Backend - In Call Routes

Add state transition logging in `backend/routes/calls.js`:

```javascript
// Helper function - add at top of file
function logCallTransition(callId, from, to, reason, metadata = {}) {
  logger.info('Call state transition', {
    callId,
    from,
    to,
    reason,
    ...metadata,
    timestamp: new Date().toISOString()
  });
}

// Use in routes:

// POST /api/calls/initiate
logCallTransition(callId, null, 'ringing', 'initiated', {
  creatorId,
  fanId,
  callType
});

// POST /api/calls/:callId/accept
logCallTransition(callId, 'ringing', 'connected', 'accepted', {
  fanId,
  creatorId
});

// POST /api/calls/:callId/decline
logCallTransition(callId, 'ringing', 'declined', 'declined', {
  fanId,
  creatorId
});

// POST /api/calls/:callId/end
logCallTransition(callId, 'connected', 'ended', 'completed', {
  endedBy: userId,
  durationSeconds,
  totalCost
});

// In expire-call-invitations.js job
logCallTransition(callId, 'ringing', 'missed', 'expired', {
  fanId,
  creatorId,
  expiresAt: invitation.expires_at
});
```

**Log Format** (structured for easy parsing):
```json
{
  "level": "info",
  "message": "Call state transition",
  "callId": "uuid",
  "from": "ringing",
  "to": "connected",
  "reason": "accepted",
  "fanId": "fan_id",
  "creatorId": "creator_id",
  "timestamp": "2025-10-14T..."
}
```

---

## 📈 Production Monitoring

After green-light, monitor these metrics:

### 1. Call Success Rate

```sql
SELECT
  state,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM calls
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY state
ORDER BY count DESC;
```

**Target**:
- `connected` + `ended` > 80%
- `missed` < 10%
- `declined` < 20%

### 2. Average Call Duration

```sql
SELECT
  callType,
  AVG(duration_seconds) as avg_duration,
  MIN(duration_seconds) as min_duration,
  MAX(duration_seconds) as max_duration
FROM calls
WHERE state = 'ended'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY callType;
```

**Target**: avg_duration > 60 seconds (healthy engagement)

### 3. Socket Connection Success

```bash
# Backend logs
tail -f backend/logs/combined.log | grep "Socket connected" | wc -l

# vs. errors
tail -f backend/logs/combined.log | grep "Socket connection error" | wc -l
```

**Target**:
- Connection success rate > 95%
- < 5% connection errors

### 4. Agora Connection State

Check Agora Console → Analytics:
- Connection success rate > 95%
- Audio freeze rate < 2%
- Video freeze rate < 5%
- Network delay < 300ms

---

## ✅ Post-Deployment Checklist

After rolling out:

- [ ] Monitor call success rate (first 24 hours)
- [ ] Check for Socket.io errors in logs
- [ ] Verify billing accuracy (spot-check 10 calls)
- [ ] Review Agora Console metrics
- [ ] Test on iOS Safari (if possible)
- [ ] Verify feature flag can instantly disable
- [ ] Document any issues for next iteration

---

## 🎉 Success Criteria

**All Green Lights Mean**:
- ✅ Creator → Fan instant calls work
- ✅ Video and voice paths function correctly
- ✅ iOS doesn't break (if tested)
- ✅ Guardrails prevent abuse
- ✅ System is production-ready

**You're cleared for takeoff!** 🚀

---

**Checklist Version**: 1.0
**Last Updated**: 2025-10-14
**Estimated Time**: 15 minutes
**Required**: 2 test accounts (1 Creator, 1 Fan)
