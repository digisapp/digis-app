# Agora Privacy Calls - 60-Minute Test Plan

**Estimated Time**: 60-90 minutes
**Goal**: Verify video/voice calls, creator→fan flow, timeouts, cooldowns, and iOS compatibility

---

## ✅ Prerequisites

- [ ] Backend code pushed to staging/test environment
- [ ] Agora Console credentials available
- [ ] Two test accounts: 1 Creator, 1 Fan
- [ ] iOS device or Safari for mobile testing (optional but recommended)

---

## 🚀 Part 1: Backend Bring-Up (5-10 min)

### Step 1.1: Set Environment Variables

```bash
# backend/.env
AGORA_APP_ID=your_app_id_from_agora_console
AGORA_APP_CERTIFICATE=your_certificate_from_agora_console
FEATURE_CALLS=true        # Enable privacy calls
FEATURE_FAN_PRIVACY=true  # Enable fan privacy features

# Database (should already exist)
DATABASE_URL=postgresql://...

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173  # or your frontend URL
```

### Step 1.2: Run Database Migration

```bash
cd backend
npm run migrate

# Verify tables created
psql $DATABASE_URL -c "\dt" | grep -E "calls|call_invitations|creator_fan_relationships"

# Expected output:
# calls
# call_invitations
# creator_fan_relationships
```

### Step 1.3: Start Backend

```bash
cd backend
npm run dev

# Expected in logs:
# ✅ Server running on port 3000
# ✅ Socket.io initialized (if you set it up)
# ✅ Feature flags: FEATURE_CALLS=true
```

---

## 🧪 Part 2: Backend API Smoke Tests (5-10 min)

### Get Your Tokens

```bash
# Login as creator (use your auth endpoint)
CREATOR_JWT="eyJhbGci..."

# Login as fan
FAN_JWT="eyJhbGci..."

# Get IDs from tokens or database
CREATOR_ID="creator_supabase_id"
FAN_ID="fan_supabase_id"

# API base
API_BASE="http://localhost:3000"  # or your backend URL
```

### Test 2.1: Initiate Call (Creator → Fan)

```bash
curl -i -X POST $API_BASE/api/calls/initiate \
  -H "Authorization: Bearer $CREATOR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "fanId": "'$FAN_ID'",
    "callType": "video",
    "message": "Test call from creator"
  }'
```

**Expected Response** (200):
```json
{
  "success": true,
  "callId": "uuid-here",
  "channel": "call_abc123_def456_1234567890",
  "state": "ringing",
  "message": "Call invitation sent to fan"
}
```

**Save the callId**:
```bash
CALL_ID="uuid-from-response"
```

**If you get errors**:
- `403 NOT_CREATOR` → Make sure creator account has `is_creator=true` in database
- `403 CALL_NOT_ALLOWED` → Fan privacy settings block you; adjust `fan_allow_calls`
- `403 FAN_BLOCKED` → Creator is in fan's block list
- `500` → Check logs for details (likely missing Agora credentials)

### Test 2.2: Get Pending Invitations (Fan)

```bash
curl -s -H "Authorization: Bearer $FAN_JWT" \
  $API_BASE/api/calls/pending | jq
```

**Expected Response** (200):
```json
{
  "invitations": [
    {
      "invitationId": "uuid",
      "callId": "uuid",
      "callType": "video",
      "message": "Test call from creator",
      "expiresAt": "2025-10-14T...",
      "creator": {
        "username": "creator_username",
        "displayName": "Creator Name",
        "avatarUrl": "https://..."
      }
    }
  ]
}
```

### Test 2.3: Accept Call (Fan)

```bash
curl -i -X POST $API_BASE/api/calls/$CALL_ID/accept \
  -H "Authorization: Bearer $FAN_JWT"
```

**Expected Response** (200):
```json
{
  "success": true,
  "callId": "uuid",
  "channel": "call_abc123_def456_1234567890",
  "appId": "your_agora_app_id",
  "token": "006eJxT...",  # Agora RTC token
  "uid": 12345,           # Fan's Agora UID
  "creatorUid": 67890,    # Creator's Agora UID
  "callType": "video",
  "ratePerMinute": 1.00,
  "expiresIn": 7200
}
```

**Save credentials for manual testing**:
```bash
AGORA_TOKEN="token-from-response"
AGORA_UID="uid-from-response"
AGORA_CHANNEL="channel-from-response"
```

### Test 2.4: Decline Call (Alternative Flow)

Start another call, then:

```bash
curl -i -X POST $API_BASE/api/calls/$CALL_ID/decline \
  -H "Authorization: Bearer $FAN_JWT"
```

**Expected Response** (200):
```json
{
  "success": true,
  "message": "Call declined"
}
```

### Test 2.5: End Call

```bash
curl -i -X POST $API_BASE/api/calls/$CALL_ID/end \
  -H "Authorization: Bearer $FAN_JWT"
```

**Expected Response** (200):
```json
{
  "success": true,
  "callId": "uuid",
  "durationSeconds": 45,
  "durationMinutes": 1,
  "totalCost": 1.00,
  "endedBy": "fan_supabase_id"
}
```

### Test 2.6: Call History

```bash
curl -s -H "Authorization: Bearer $CREATOR_JWT" \
  $API_BASE/api/calls/history | jq
```

**Expected Response** (200):
```json
{
  "calls": [
    {
      "id": "uuid",
      "callType": "video",
      "state": "ended",
      "initiatedAt": "...",
      "endedAt": "...",
      "durationSeconds": 45,
      "totalCost": "1.00",
      "participant": {
        "username": "fan_username",
        "displayName": "Fan Name"
      }
    }
  ]
}
```

---

## 🔄 Part 3: Real-Time Wiring (10-15 min)

### Step 3.1: Set Up Socket.io Server (if not done)

In `backend/api/index.js`, add after Express app creation:

```javascript
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);

// Socket.io setup
if (!process.env.VERCEL) {  // Skip on serverless
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true
    }
  });

  global.io = io;

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Auth required'));

    try {
      // Verify token and extract user
      const { verifySupabaseToken } = require('./middleware/auth');
      const user = await verifySupabaseToken(token);
      socket.userId = user.id;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('✅ Socket connected:', socket.userId);

    socket.on('join', ({ room }) => {
      socket.join(room);
      console.log(`✅ User ${socket.userId} joined room: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected:', socket.userId);
    });
  });

  // Use server.listen instead of app.listen
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Socket.io initialized`);
  });
} else {
  // Serverless fallback
  app.listen(process.env.PORT || 3000);
}
```

### Step 3.2: Test Socket Connection (Frontend)

Create a quick test file:

```javascript
// test-socket.html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
</head>
<body>
  <h1>Socket.io Test</h1>
  <div id="output"></div>

  <script>
    const socket = io('http://localhost:3000', {
      auth: { token: 'YOUR_FAN_JWT_HERE' }
    });

    const log = (msg) => {
      document.getElementById('output').innerHTML += `<p>${msg}</p>`;
      console.log(msg);
    };

    socket.on('connect', () => {
      log('✅ Connected to Socket.io');

      // Join user's personal room
      socket.emit('join', { room: 'user:YOUR_FAN_ID_HERE' });
    });

    socket.on('call:incoming', (payload) => {
      log('📞 INCOMING CALL: ' + JSON.stringify(payload));
    });

    socket.on('call:status', (payload) => {
      log('📊 CALL STATUS: ' + JSON.stringify(payload));
    });

    socket.on('call:canceled', (payload) => {
      log('❌ CALL CANCELED: ' + JSON.stringify(payload));
    });

    socket.on('disconnect', () => {
      log('❌ Disconnected');
    });

    socket.on('connect_error', (error) => {
      log('❌ Connection error: ' + error.message);
    });
  </script>
</body>
</html>
```

**Open in browser**, then **initiate a call** via curl. You should see:
```
✅ Connected to Socket.io
📞 INCOMING CALL: {"callId":"...","creatorName":"...","callType":"video"}
```

---

## 🎨 Part 4: Frontend Integration (20-30 min)

### Step 4.1: Mount Call Listener at App Root

In `frontend/src/App.jsx` (or your main layout):

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCallInvites from './hooks/useCallInvites';
import IncomingCallModal from './components/calls/IncomingCallModal';
import { authedFetch } from './utils/requireAuth';

function App() {
  const navigate = useNavigate();
  const { invite, clearInvite } = useCallInvites();
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async (inviteData) => {
    setAccepting(true);

    try {
      // Call backend to accept
      const res = await authedFetch(`/api/calls/${inviteData.callId}/accept`, {
        method: 'POST'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to accept call');
      }

      const credentials = await res.json();

      // Navigate to existing call UI
      navigate('/call/video', {
        state: {
          // Agora credentials
          appId: credentials.appId,
          token: credentials.token,
          uid: credentials.uid,
          channel: credentials.channel,

          // Call metadata
          callId: credentials.callId,
          callType: credentials.callType,
          isVoiceOnly: credentials.callType === 'voice',

          // Billing
          billingDisabled: false, // Privacy calls have billing
          ratePerMinute: credentials.ratePerMinute,

          // For displaying who you're calling
          participant: {
            name: inviteData.creatorName,
            avatar: inviteData.avatar
          }
        }
      });

      clearInvite();
    } catch (error) {
      console.error('Error accepting call:', error);
      alert('Failed to accept call: ' + error.message);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <>
      {/* Your existing app */}
      <YourRoutes />

      {/* Incoming call modal - always mounted */}
      <IncomingCallModal
        invite={invite}
        onClose={clearInvite}
        onAccepted={handleAccept}
      />
    </>
  );
}

export default App;
```

### Step 4.2: Add CallButton to Fan Profiles

In your Messages page, DM threads, fan lists, etc.:

```jsx
import CallButton from './components/calls/CallButton';

function MessagesPage({ fan }) {
  return (
    <div className="messages-header">
      <div className="fan-info">
        <img src={fan.avatarUrl} alt={fan.displayName} />
        <h3>{fan.displayName}</h3>
      </div>

      {/* Call buttons */}
      <div className="call-buttons flex gap-2">
        <CallButton
          fanId={fan.supabase_id}
          callType="voice"
          iconOnly
          onCallInitiated={(data) => {
            console.log('Voice call started:', data.callId);
            // Optionally show "Ringing..." UI
          }}
        />

        <CallButton
          fanId={fan.supabase_id}
          callType="video"
          iconOnly
          onCallInitiated={(data) => {
            console.log('Video call started:', data.callId);
          }}
        />
      </div>
    </div>
  );
}
```

### Step 4.3: Update Call UI to Handle Privacy Calls

In your `VideoCallRefactored.js` or wherever you handle calls:

```jsx
function VideoCallRefactored() {
  const location = useLocation();
  const {
    appId,
    token,
    uid,
    channel,
    callId,
    isVoiceOnly = false,
    billingDisabled = false,
    ratePerMinute = 0,
    participant
  } = location.state || {};

  // Hide billing UI if billingDisabled
  const showBilling = !billingDisabled;

  // Don't start camera if voice-only
  const enableVideo = !isVoiceOnly;

  return (
    <div className="video-call">
      {/* Header */}
      <div className="call-header">
        <h3>Call with {participant?.name}</h3>
        {showBilling && (
          <span className="rate">{ratePerMinute} tokens/min</span>
        )}
      </div>

      {/* Video containers */}
      <div id="remote-video" className="remote-video" />
      {enableVideo && (
        <div id="local-video" className="local-video" />
      )}

      {/* Controls */}
      <div className="controls">
        <button onClick={toggleMute}>Mute</button>
        {enableVideo && <button onClick={toggleVideo}>Camera</button>}
        <button onClick={endCall}>End</button>
      </div>
    </div>
  );
}
```

### Step 4.4: Add Instrumentation

In your Agora client setup (inside VideoCallRefactored or useAgoraClient hook):

```javascript
// When creating Agora client
client.on('user-published', (user, mediaType) => {
  console.log('👤 PUBLISHED:', user.uid, mediaType);
});

client.on('user-unpublished', (user, mediaType) => {
  console.log('👤 UNPUBLISHED:', user.uid, mediaType);
});

client.on('connection-state-change', (curState, prevState, reason) => {
  console.log('🔌 STATE:', prevState, '→', curState, 'reason:', reason);
});

client.on('user-left', (user, reason) => {
  console.log('👋 USER LEFT:', user.uid, reason);
});
```

---

## 🧪 Part 5: End-to-End Test Matrix (20-30 min)

### Test A: Video Call Flow

**Duration**: 5 min

1. **Initiate**:
   - Login as Creator
   - Navigate to Fan's messages/profile
   - Click "Video Call" button
   - ✅ **Expect**: "Ringing..." toast appears

2. **Receive**:
   - In second browser window, login as Fan
   - ✅ **Expect**: `IncomingCallModal` appears
   - ✅ **Expect**: Shows creator name, avatar, "Video Call"
   - ✅ **Expect**: Countdown timer starts (120s)

3. **Accept**:
   - Fan clicks "Accept"
   - ✅ **Expect**: Fan navigates to call UI
   - ✅ **Expect**: Fan's camera initializes (local video)
   - ✅ **Expect**: Creator's window shows "Call accepted"
   - ✅ **Expect**: Creator navigates to call UI

4. **In-Call**:
   - ✅ **Expect**: Both see each other's video
   - ✅ **Expect**: Both hear each other's audio
   - Click "Mute" button
   - ✅ **Expect**: Remote side sees/hears mute take effect
   - Click "Camera" toggle
   - ✅ **Expect**: Remote side sees video stop/start

5. **End**:
   - Click "End Call"
   - ✅ **Expect**: Both exit to previous page
   - ✅ **Expect**: Backend logs show billing processed
   - Check database:
     ```sql
     SELECT state, duration_seconds, total_cost FROM calls WHERE id = 'CALL_ID';
     ```
   - ✅ **Expect**: `state='ended'`, `duration_seconds > 0`, `total_cost > 0`

**✅ PASS** / **❌ FAIL**: _______

---

### Test B: Voice Call Flow

**Duration**: 5 min

1. **Initiate**:
   - Creator clicks "Voice Call" button (phone icon)
   - ✅ **Expect**: "Ringing..." toast

2. **Receive**:
   - Fan sees modal showing "Voice Call"
   - ✅ **Expect**: No video icon, only phone icon

3. **Accept**:
   - Fan clicks "Accept"
   - ✅ **Expect**: Navigate to call UI
   - ✅ **Expect**: NO camera initialization
   - ✅ **Expect**: Only microphone requested

4. **In-Call**:
   - ✅ **Expect**: Both hear audio
   - ✅ **Expect**: No video tracks created (check console logs)
   - ✅ **Expect**: Camera button hidden/disabled

5. **End**:
   - End call
   - ✅ **Expect**: Billing processed correctly

**✅ PASS** / **❌ FAIL**: _______

---

### Test C: Decline Flow

**Duration**: 2 min

1. **Initiate**: Creator calls Fan
2. **Receive**: Fan sees modal
3. **Decline**: Fan clicks "Decline"
   - ✅ **Expect**: Modal closes
   - ✅ **Expect**: Creator sees "Call declined" notification
   - Check database:
     ```sql
     SELECT state FROM calls WHERE id = 'CALL_ID';
     ```
   - ✅ **Expect**: `state='declined'`

**✅ PASS** / **❌ FAIL**: _______

---

### Test D: Timeout Flow

**Duration**: 2 min

1. **Initiate**: Creator calls Fan
2. **Receive**: Fan sees modal
3. **Wait**: Don't click anything, let countdown reach 0
   - ✅ **Expect**: Modal auto-closes at 0
   - ✅ **Expect**: Creator sees "Call missed" or timeout
   - Check database:
     ```sql
     SELECT state FROM calls WHERE id = 'CALL_ID';
     ```
   - ✅ **Expect**: `state='missed'` or `state='expired'`

**✅ PASS** / **❌ FAIL**: _______

---

### Test E: Call Cooldown

**Duration**: 2 min

1. **First Call**: Creator calls Fan (accept or decline, doesn't matter)
2. **Immediate Second Call**: Creator tries to call same Fan again immediately
   - ✅ **Expect**: Error toast: "Please wait XXs before calling again"
   - ✅ **Expect**: Button disabled or shows cooldown
   - Check API response:
     ```json
     {
       "ok": false,
       "code": "CALL_COOLDOWN",
       "error": "Please wait before calling this fan again",
       "retryAfter": 57
     }
     ```

3. **Wait 60s**: Try again after cooldown expires
   - ✅ **Expect**: Call goes through successfully

**✅ PASS** / **❌ FAIL**: _______

---

### Test F: Permission Blocks

**Duration**: 5 min

#### F1: Fan Blocks Creator

1. In database, add block:
   ```sql
   INSERT INTO creator_blocked_users (creator_id, blocked_user_id)
   VALUES ('CREATOR_ID', 'FAN_ID');
   ```

2. Creator tries to call Fan
   - ✅ **Expect**: Error: "Unable to call this fan"
   - ✅ **Expect**: API returns `403 FAN_BLOCKED`

#### F2: Fan Privacy Settings

1. Set fan's privacy to "none":
   ```sql
   UPDATE users SET fan_allow_calls = 'none' WHERE firebase_uid = 'FAN_ID';
   ```

2. Creator tries to call Fan
   - ✅ **Expect**: Error: "This fan does not allow calls"
   - ✅ **Expect**: API returns `403 CALL_NOT_ALLOWED`

3. Set fan's privacy to "following":
   ```sql
   UPDATE users SET fan_allow_calls = 'following' WHERE firebase_uid = 'FAN_ID';
   ```

4. Creator (not followed by Fan) tries to call
   - ✅ **Expect**: `403 CALL_NOT_ALLOWED`

5. Fan follows Creator:
   ```sql
   INSERT INTO creator_fan_relationships (creator_id, fan_id, relation_type)
   VALUES ('CREATOR_ID', 'FAN_ID', 'follow');
   ```

6. Creator tries to call Fan again
   - ✅ **Expect**: Call goes through successfully

**✅ PASS** / **❌ FAIL**: _______

---

### Test G: Feature Flag

**Duration**: 2 min

1. Disable feature flag:
   ```bash
   # In backend/.env
   FEATURE_CALLS=false
   ```

2. Restart backend

3. Creator tries to initiate call
   - ✅ **Expect**: Error: "Calls are not available yet"
   - ✅ **Expect**: API returns `403 FEATURE_DISABLED`

4. Re-enable:
   ```bash
   FEATURE_CALLS=true
   ```

5. Restart backend, try again
   - ✅ **Expect**: Calls work

**✅ PASS** / **❌ FAIL**: _______

---

### Test H: iOS Safari (If Available)

**Duration**: 10 min

#### H1: User Gesture Requirement

1. Open app in iOS Safari
2. Creator initiates call
3. Fan accepts
   - ✅ **Expect**: Camera/mic prompts appear AFTER clicking "Accept"
   - ✅ **Expect**: No "play() failed" errors in console
   - ✅ **Expect**: Tracks initialize successfully

#### H2: Background Behavior

1. Start a call
2. Press Home button (background the app)
   - ✅ **Expect**: Call UI cleans up
   - ✅ **Expect**: `pagehide` event fires
   - ✅ **Expect**: Tracks closed
3. Return to app
   - ✅ **Expect**: Clean state, no stuck call

#### H3: Permission Denial

1. In iOS Settings > Safari > Camera, disable camera
2. Start video call
   - ✅ **Expect**: Friendly error message
   - ✅ **Expect**: Instructs user to enable in Settings

**✅ PASS** / **❌ FAIL**: _______

---

## 📊 Final Checklist

### Backend

- [ ] ✅ Migration applied (`calls`, `call_invitations`, `creator_fan_relationships` tables exist)
- [ ] ✅ `FEATURE_CALLS=true` in `.env`
- [ ] ✅ `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` set
- [ ] ✅ Socket.io initialized (or Ably for serverless)
- [ ] ✅ `global.io` available in routes
- [ ] ✅ API smoke tests pass (initiate, accept, decline, end)

### Frontend

- [ ] ✅ `useCallInvites` hook mounted in app root
- [ ] ✅ `IncomingCallModal` renders when invite arrives
- [ ] ✅ `CallButton` added to fan profile views
- [ ] ✅ Socket.io client connects and receives events
- [ ] ✅ Call UI handles `isVoiceOnly` and `billingDisabled` props

### Integration

- [ ] ✅ Video calls work (both parties see/hear each other)
- [ ] ✅ Voice calls work (audio only, no camera)
- [ ] ✅ Decline flow works
- [ ] ✅ Timeout/expiry works
- [ ] ✅ Call cooldown enforced (60s)
- [ ] ✅ Permission blocks work (blocked users, privacy settings)
- [ ] ✅ Feature flag toggles calls on/off
- [ ] ✅ Billing calculated and applied correctly

### iOS (Optional)

- [ ] ✅ User gesture-gated track creation
- [ ] ✅ Permission prompts appear correctly
- [ ] ✅ Background/foreground cleanup works
- [ ] ✅ No autoplay errors

---

## 🎯 Go/No-Go Decision

**Total Passing Tests**: _____ / 8

**Critical Failures**: ___________________

**Decision**:
- [ ] ✅ **GO** - Deploy to production
- [ ] ⚠️ **GO WITH CAUTION** - Deploy with known issues documented
- [ ] ❌ **NO-GO** - Fix critical issues first

---

## 🐛 Common Issues & Quick Fixes

### Issue: "Socket.io not available" in logs

**Cause**: `global.io` not initialized

**Fix**: Add Socket.io setup to `backend/api/index.js` (see Part 3)

### Issue: "Table 'calls' does not exist"

**Cause**: Migration not run

**Fix**: `cd backend && npm run migrate`

### Issue: Fan doesn't see incoming call modal

**Cause**: `useCallInvites` not mounted or socket not connected

**Fix**:
1. Check browser console for "Socket connected" log
2. Verify `useCallInvites` is in app root
3. Check Socket.io server logs for "Socket connected: USER_ID"

### Issue: Video/audio not working

**Cause**: Invalid Agora token or missing credentials

**Fix**:
1. Verify `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` in `.env`
2. Check Agora Console for errors
3. Verify token in accept response is not empty

### Issue: iOS - Black screen or no audio

**Cause**: Tracks created before user gesture

**Fix**: Ensure `joinAgoraCall()` is called AFTER "Accept" button click, not before

### Issue: "403 NOT_CREATOR"

**Cause**: User account doesn't have `is_creator=true`

**Fix**:
```sql
UPDATE users SET is_creator = true WHERE firebase_uid = 'CREATOR_ID';
```

### Issue: "429 CALL_COOLDOWN" immediately

**Cause**: Leftover cooldown from previous test

**Fix**: Restart backend (cooldown map is in-memory)

---

## 📈 Performance Metrics to Monitor

After testing, check:

1. **Agora Dashboard** (https://console.agora.io)
   - Connection success rate (should be >95%)
   - Audio/video quality scores
   - Network delay

2. **Backend Logs**
   - Call initiation success rate
   - Average call duration
   - Billing accuracy

3. **Database**
   ```sql
   -- Call success rate
   SELECT
     state,
     COUNT(*) as count,
     ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
   FROM calls
   GROUP BY state;

   -- Average call duration
   SELECT AVG(duration_seconds) as avg_duration_seconds
   FROM calls
   WHERE state = 'ended';

   -- Total revenue
   SELECT SUM(total_cost) as total_revenue
   FROM calls
   WHERE state = 'ended';
   ```

---

## ✅ Success Criteria

- [ ] 8/8 test scenarios pass
- [ ] No critical errors in logs
- [ ] Agora connection success rate >95%
- [ ] Billing accurate within $0.01
- [ ] iOS Safari works without errors
- [ ] Feature flag can disable calls instantly

**If all criteria met**: ✅ **READY FOR PRODUCTION**

---

**Test Plan Created**: 2025-10-14
**Estimated Time**: 60-90 minutes
**Systems Tested**: Backend API, Socket.io, Frontend UI, Agora RTC, iOS Safari
