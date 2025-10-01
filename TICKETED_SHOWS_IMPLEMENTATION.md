# Ticketed Private Shows Implementation Guide

## Overview
This feature allows creators to monetize their live streams by announcing paid "private shows" that require tokens to access. Viewers who don't buy tickets can still see the chat but video is hidden, creating FOMO and encouraging purchases.

## Features Implemented

### 1. Database Schema (✅ Complete)
- **ticketed_shows**: Main table for show management
- **show_tickets**: Tracks ticket purchases
- **show_analytics**: Performance metrics
- **show_announcements**: Notification system
- Migration file: `/backend/migrations/122_create_ticketed_shows.sql`

### 2. Backend API (✅ Complete)
- **Endpoints** in `/backend/routes/ticketed-shows.js`:
  - `POST /api/ticketed-shows/announce` - Creator announces a show
  - `POST /api/ticketed-shows/buy-ticket` - Viewer purchases ticket
  - `POST /api/ticketed-shows/start` - Creator starts private mode
  - `POST /api/ticketed-shows/end` - Creator ends show
  - `GET /api/ticketed-shows/:showId/details` - Get show info & ticket status
  - `GET /api/ticketed-shows/:showId/analytics` - Creator analytics
  - `GET /api/ticketed-shows/stream/:streamId/active` - Check for active show

### 3. Frontend Component (✅ Complete)
- **PrivateShowAnnouncement.js**: Complete UI component for both creators and viewers
  - Creator controls to announce and manage shows
  - Viewer interface to purchase tickets
  - Real-time countdown timer
  - Early bird pricing support
  - Analytics display

## Integration Instructions

### Step 1: Update StreamingDashboard.js (Creator View)

Add to the imports:
```javascript
import PrivateShowAnnouncement from './PrivateShowAnnouncement';
```

Add to the component JSX (after the "Go Live" button):
```javascript
{/* Private Show Controls */}
{isLive && isCreator && (
  <div className="mt-4">
    <PrivateShowAnnouncement
      streamId={currentStreamId}
      isCreator={true}
      onShowAnnounced={(show) => {
        console.log('Show announced:', show);
        // Optional: Update local state
      }}
      onShowStarted={(showId) => {
        console.log('Private show started:', showId);
        // Trigger video role changes
      }}
    />
  </div>
)}
```

### Step 2: Update StreamingLayout.js (Viewer Experience)

Add to imports:
```javascript
import PrivateShowAnnouncement from './PrivateShowAnnouncement';
import { useEffect, useState } from 'react';
import socketService from '../utils/socket';
```

Add state management:
```javascript
const [videoVisible, setVideoVisible] = useState(true);
const [privateShowActive, setPrivateShowActive] = useState(false);
```

Add socket listeners:
```javascript
useEffect(() => {
  // Listen for private mode changes
  socketService.on('private_mode_started', (data) => {
    setPrivateShowActive(true);
    // Video remains visible only if viewer has ticket
  });
  
  socketService.on('enable_private_video', (data) => {
    setVideoVisible(true);
    toast.success('Private show access granted!');
  });
  
  socketService.on('private_show_ended', (data) => {
    setPrivateShowActive(false);
    setVideoVisible(true);
  });
  
  return () => {
    socketService.off('private_mode_started');
    socketService.off('enable_private_video');
    socketService.off('private_show_ended');
  };
}, []);
```

Update the video display logic:
```javascript
{/* Video Section - Hidden for non-ticket holders during private show */}
{videoVisible ? (
  <VideoCall 
    channel={channel}
    token={token}
    uid={uid}
    isHost={false}
    user={user}
  />
) : (
  <div className="bg-black rounded-lg aspect-video flex items-center justify-center">
    <div className="text-center">
      <LockClosedIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
      <h3 className="text-white text-xl font-bold mb-2">Private Show in Progress</h3>
      <p className="text-gray-400 mb-4">Purchase a ticket to see the video</p>
      <PrivateShowAnnouncement
        streamId={streamId}
        isCreator={false}
      />
    </div>
  </div>
)}

{/* Chat is always visible */}
<EnhancedStreamChat
  channel={channel}
  user={user}
  creatorId={creatorId}
  isCreator={false}
/>

{/* Show announcement for viewers */}
{!isCreator && (
  <PrivateShowAnnouncement
    streamId={streamId}
    isCreator={false}
  />
)}
```

### Step 3: Update VideoCall.js for Role-Based Access

Add prop for access control:
```javascript
const VideoCall = ({ 
  channel, 
  token, 
  uid, 
  isHost, 
  user,
  hasAccess = true // New prop
}) => {
  // ... existing code
  
  useEffect(() => {
    if (!hasAccess) {
      // Set to audience role without video subscribe
      client.current.setClientRole('audience');
      return;
    }
    
    // Existing video setup code
  }, [hasAccess]);
  
  // Don't render video elements if no access
  if (!hasAccess) {
    return null;
  }
  
  // ... rest of component
};
```

### Step 4: Socket Event Updates

Add to `/backend/utils/socket.js`:
```javascript
// In the connection handler
socket.on('join-stream', (data) => {
  socket.join(`stream:${data.channel}`);
  socket.join(`user:${socket.userId}`);
});

// Emit events for ticketed shows
io.to(`stream:${streamId}`).emit('ticketed_show_announced', data);
io.to(`stream:${streamId}`).emit('private_mode_started', data);
io.to(`user:${userId}`).emit('ticket_purchased', data);
io.to(`user:${userId}`).emit('enable_private_video', data);
```

### Step 5: Run Database Migration

```bash
cd backend
npm run migrate
```

### Step 6: Update Environment Variables

No new environment variables required - uses existing database and API configuration.

## Testing the Feature

### As a Creator:
1. Start a live stream
2. Click "Announce Private Show"
3. Set title, price, and optional start time
4. Monitor ticket sales in real-time
5. Click "Start Private Show" when ready

### As a Viewer:
1. Join a live stream
2. See private show announcement
3. Click "Buy Ticket" (deducts tokens)
4. When show starts:
   - With ticket: Full video + chat access
   - Without ticket: Chat only, video hidden
5. Can buy ticket mid-show to join

## Revenue Model

- **Token Economy**: Uses existing token system
- **Pricing Options**:
  - Regular price
  - Early bird pricing
  - Optional ticket limits
- **Creator Earnings**: Tokens go directly to creator balance
- **Platform Fee**: Can be configured in payment processing

## Security Features

- Row Level Security (RLS) on all tables
- Token balance validation before purchase
- Atomic transactions for payments
- Creator-only show management
- Ticket uniqueness enforcement

## Analytics Tracked

- Total tickets sold
- Revenue generated
- Peak viewers
- Average watch time
- Early bird vs regular sales
- Conversion rates

## Future Enhancements

1. **Gift Tickets**: Allow users to buy tickets for others
2. **Recurring Shows**: Schedule regular private shows
3. **Tiered Pricing**: Different access levels
4. **Show Recordings**: Sell access to past shows
5. **Bundle Deals**: Multiple show packages
6. **Referral System**: Rewards for bringing viewers

## Deployment Checklist

- [ ] Run database migration
- [ ] Deploy backend with new routes
- [ ] Deploy frontend with components
- [ ] Test token deduction flow
- [ ] Verify socket events working
- [ ] Check video hiding for non-payers
- [ ] Confirm analytics tracking

## Support & Troubleshooting

### Common Issues:

1. **"Insufficient tokens" error**
   - User needs to purchase more tokens via Wallet

2. **Video not hiding for non-payers**
   - Check socket connection
   - Verify VideoCall hasAccess prop

3. **Tickets not updating in real-time**
   - Ensure socket events are properly emitted
   - Check socket room joining

4. **Analytics not showing**
   - Verify creator authentication
   - Check analytics endpoint permissions

## Performance Considerations

- Ticket purchases use database transactions
- Real-time updates via WebSocket (not polling)
- Countdown timer uses client-side interval
- Analytics cached for 5 minutes
- Early bird deadline checked server-side

This implementation provides a complete ticketed show system that seamlessly integrates with your existing streaming infrastructure while maintaining security and performance.