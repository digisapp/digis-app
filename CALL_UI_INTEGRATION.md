# Call UI Integration Guide
## Wire Up the Complete Call Flow

This guide shows how to integrate the call components into your existing app.

---

## 📦 What's Ready

✅ **Backend**: Fully implemented with socket emits
✅ **Frontend Components**: IncomingCallModal, CallButton, useCallInvites hook
✅ **Agora Helper**: joinAgoraCall with iOS support
✅ **Feature Flags**: Backend protection

---

## 🔌 Step 1: Add Call Listener to App Root

In your main app layout or navigation shell:

```jsx
// In App.jsx or MainLayout.jsx
import { useState } from 'react';
import useCallInvites from '@/hooks/useCallInvites';
import IncomingCallModal from '@/components/calls/IncomingCallModal';
import { joinAgoraCall, leaveAgoraCall } from '@/utils/joinAgoraCall';

function App() {
  const { invite, clearInvite } = useCallInvites();
  const [activeCall, setActiveCall] = useState(null);

  const handleCallAccepted = async (credentials) => {
    try {
      // Join Agora call
      const callState = await joinAgoraCall({
        appId: credentials.appId,
        token: credentials.token,
        channel: credentials.channel,
        uid: credentials.uid,
        callType: credentials.callType,
        onUserJoined: (user) => {
          console.log('Remote user joined:', user.uid);
        },
        onUserLeft: (user) => {
          console.log('Remote user left:', user.uid);
          handleEndCall(credentials.callId);
        },
        onError: (error) => {
          console.error('Call error:', error);
          toast.error('Call connection error');
        }
      });

      setActiveCall({
        ...credentials,
        ...callState
      });

      // Navigate to in-call UI
      // navigate('/call/active');
    } catch (error) {
      console.error('Failed to join call:', error);
      toast.error('Failed to join call');
    }
  };

  const handleEndCall = async (callId) => {
    try {
      // Leave Agora
      await leaveAgoraCall();

      // Notify backend
      await authedFetch(`/api/calls/${callId}/end`, {
        method: 'POST'
      });

      setActiveCall(null);
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  return (
    <>
      {/* Your app content */}
      <YourApp />

      {/* Incoming call modal - always mounted, shows when invite exists */}
      <IncomingCallModal
        invite={invite}
        onClose={clearInvite}
        onAccepted={handleCallAccepted}
      />
    </>
  );
}
```

---

## 🎯 Step 2: Add Call Buttons to Fan Profiles

In creator's view of a fan (messages, mini profile, etc.):

```jsx
// In FanMiniProfile.jsx or MessagesPage.jsx
import CallButton from '@/components/calls/CallButton';

function FanMiniProfile({ fan }) {
  const handleCallInitiated = ({ callId, channel }) => {
    console.log('Call initiated:', callId);
    toast.success('Ringing...');
    // Optionally navigate to a "calling" state
  };

  return (
    <div className="fan-profile">
      <img src={fan.avatarUrl} />
      <h3>{fan.displayName}</h3>

      <div className="actions">
        {/* Voice call button */}
        <CallButton
          fanId={fan.id}
          callType="voice"
          onCallInitiated={handleCallInitiated}
        />

        {/* Video call button */}
        <CallButton
          fanId={fan.id}
          callType="video"
          onCallInitiated={handleCallInitiated}
        />
      </div>
    </div>
  );
}
```

**Icon-only version** (for compact layouts):

```jsx
<div className="flex gap-2">
  <CallButton
    fanId={fan.id}
    callType="voice"
    iconOnly
    onCallInitiated={handleCallInitiated}
  />
  <CallButton
    fanId={fan.id}
    callType="video"
    iconOnly
    onCallInitiated={handleCallInitiated}
  />
</div>
```

---

## 📱 Step 3: Create Active Call UI (Optional)

For a full-screen in-call experience:

```jsx
// components/calls/ActiveCallScreen.jsx
import { useState, useEffect } from 'react';
import { toggleMute, toggleVideo, leaveAgoraCall } from '@/utils/joinAgoraCall';
import { authedFetch } from '@/utils/requireAuth';

export default function ActiveCallScreen({ callId, callType, onEnd }) {
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [duration, setDuration] = useState(0);

  // Call timer
  useEffect(() => {
    const interval = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleMute = () => {
    toggleMute(!muted);
    setMuted(!muted);
  };

  const handleToggleVideo = () => {
    toggleVideo(!videoEnabled);
    setVideoEnabled(!videoEnabled);
  };

  const handleEndCall = async () => {
    await leaveAgoraCall();

    await authedFetch(`/api/calls/${callId}/end`, {
      method: 'POST'
    });

    onEnd?.();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Video containers */}
      <div className="flex-1 relative">
        {/* Remote video (full screen) */}
        <div
          id="remote-video"
          className="absolute inset-0 bg-gray-900"
        />

        {/* Local video (pip) */}
        {callType === 'video' && (
          <div
            id="local-video"
            className="absolute top-4 right-4 w-32 h-48 bg-gray-800 rounded-xl overflow-hidden"
          />
        )}

        {/* Call info overlay */}
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
          <div className="text-white font-semibold">{formatTime(duration)}</div>
          <div className="text-gray-300 text-sm">Connected</div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 flex items-center justify-center gap-4">
        {/* Mute button */}
        <button
          onClick={handleToggleMute}
          className={`p-4 rounded-full ${
            muted ? 'bg-red-600' : 'bg-gray-700'
          } text-white`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {muted ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            )}
          </svg>
        </button>

        {/* Video toggle (video calls only) */}
        {callType === 'video' && (
          <button
            onClick={handleToggleVideo}
            className={`p-4 rounded-full ${
              !videoEnabled ? 'bg-red-600' : 'bg-gray-700'
            } text-white`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        )}

        {/* End call button */}
        <button
          onClick={handleEndCall}
          className="p-4 rounded-full bg-red-600 text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

---

## 🔐 Step 4: Ensure Socket.io is Available

The backend expects `global.io` to be set. In your server startup:

```javascript
// In api/index.js or server.js
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);

// Only on non-serverless environments
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true
    }
  });

  // Make io available globally for routes
  global.io = io;

  // Set up socket authentication
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const user = await verifyToken(token);
      socket.userId = user.id;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.userId);

    // Join user's personal room
    socket.on('join', ({ room }) => {
      socket.join(room);
      console.log(`User ${socket.userId} joined room: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.userId);
    });
  });
}
```

**For Vercel (serverless)**, use Ably instead:

```javascript
// Backend route for Ably token
router.post('/api/ably-auth', authenticateToken, (req, res) => {
  const ably = new Ably.Rest(process.env.ABLY_API_KEY);
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: req.user.supabase_id
  });
  res.json(tokenRequest);
});

// Frontend hook
import Ably from 'ably';

const useAblySocket = () => {
  const [realtime, setRealtime] = useState(null);

  useEffect(() => {
    const session = await getSession();
    if (!session) return;

    const client = new Ably.Realtime({
      authUrl: '/api/ably-auth',
      authHeaders: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    setRealtime(client);

    return () => client.close();
  }, []);

  return realtime;
};
```

---

## ✅ Step 5: Test the Flow

### Creator Side
1. Navigate to fan profile or chat
2. Click "Voice Call" or "Video Call"
3. See "Ringing..." toast
4. Wait for fan to accept

### Fan Side
1. Receive incoming call modal
2. See creator info and countdown
3. Click "Accept"
4. Join Agora call
5. See active call UI

### Both Sides
1. Mute/unmute works
2. Video toggle works (video calls)
3. End call
4. Billing processes correctly

---

## 🚨 Common Issues

### "Socket.io not available" warning
**Solution**: Set `global.io` in your server startup (see Step 4)

### Call invitation not showing
**Check**:
1. Socket connection established?
2. User joined their personal room?
3. Backend emitting to correct room (`user:${fanId}`)?
4. `useCallInvites` hook mounted?

### Agora not connecting
**Check**:
1. Token generated correctly?
2. UID is positive integer?
3. Channel name valid (alphanumeric, <64 chars)?
4. User gesture occurred before joining (iOS)?

### Permissions denied on iOS
**Solution**: Show message to enable in Settings > Safari > Camera/Microphone

---

## 🎯 Production Checklist

- [ ] Socket.io or Ably configured
- [ ] `global.io` set on backend (or Ably alternative)
- [ ] Call buttons show only for fans with permission
- [ ] Incoming call modal renders correctly
- [ ] Agora joins after user gesture (iOS tested)
- [ ] Call end triggers billing
- [ ] Page hide cleans up call
- [ ] Feature flag `FEATURE_CALLS=true` set
- [ ] Rate limits tested (cooldown working)
- [ ] Error messages user-friendly

---

## 📚 Related Files

**Backend**:
- `routes/calls.js` - Call API with socket emits
- `jobs/expire-call-invitations.js` - Auto-expire job
- `utils/agoraUid.js` - Stable UID generation

**Frontend**:
- `components/calls/IncomingCallModal.jsx` - Incoming call UI
- `components/calls/CallButton.jsx` - Initiate call button
- `hooks/useCallInvites.js` - Real-time invitation listener
- `utils/joinAgoraCall.js` - Agora helper with iOS support

**Docs**:
- `FAN_PRIVACY_IMPLEMENTATION.md` - Full technical spec
- `PRODUCTION_DEPLOY_CHECKLIST.md` - Deployment guide
- `PRODUCTION_READY_SUMMARY.md` - Overview

---

## 🎉 You're Done!

The call system is now fully wired. Test thoroughly, then follow `PRODUCTION_DEPLOY_CHECKLIST.md` to ship safely.

**Remember**: Enable `FEATURE_CALLS=true` only after testing the full flow end-to-end!
