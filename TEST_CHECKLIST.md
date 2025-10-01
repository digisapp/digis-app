# Feature Test Checklist

## Test Instructions
Open the app at http://localhost:5173 and test the following features:

## 1. Unified Stream Panel (Chat + Activity Feed)
### Location: Live Stream page (when streaming)
- [ ] **Tabs are visible**: Should see "All", "Chat", "Tips", "Alerts" tabs
- [ ] **Tabs are not cut off**: All tabs should be fully visible (horizontal scroll if needed)
- [ ] **No "Live Stream" title**: The redundant title should be removed
- [ ] **Tab switching works**: Click each tab to filter messages
- [ ] **Message count badges**: Each tab shows message counts
- [ ] **Chat input works**: Can type and send messages
- [ ] **@mentions highlight**: Messages with @username are highlighted

## 2. Create Private Show Button
### Location: Live Stream page (Creator view)
- [ ] **Button is visible**: Bottom-right corner, above control bar
- [ ] **Position**: Should be at `bottom-24 right-12` (not blocking video or goals)
- [ ] **Shows when not live**: Button appears even in demo mode
- [ ] **Setup modal opens**: Click button to open the setup modal
- [ ] **Time selection works**: "Start Now", "In 15 min", "In 30 min", "In 1 hour" buttons
- [ ] **No calendar picker**: Date/time calendar should be removed
- [ ] **No Advanced Options**: Section should be completely removed
- [ ] **Error when not streaming**: Shows "You need to be live streaming" message

## 3. Live Streaming Indicators on Creator Profile
### Location: Creator's public profile page
- [ ] **Live badge**: Red "LIVE" badge next to creator name (30% chance in demo)
- [ ] **Live banner**: Shows "Live Now!" banner with viewer count
- [ ] **Join Stream button**: Prominent button to enter the stream
- [ ] **Animation**: Live badge pulses/animates

## 4. Video Preview on Creator Profile
### Location: Creator's public profile page (when creator is live)
- [ ] **Video replaces cover**: Live video shows instead of static cover photo
- [ ] **Auto-play works**: Video starts playing automatically (muted)
- [ ] **Mute/unmute button**: Speaker icon in bottom-right to toggle audio
- [ ] **Live info overlay**: Shows stream title, start time, viewer count

### For Paid Streams (50% chance when live):
- [ ] **Locked overlay**: Shows lock icon and blurred background
- [ ] **Token price displayed**: Shows price clearly (100-600 tokens)
- [ ] **Unlock Stream button**: Button to purchase access
- [ ] **"Exclusive Live Stream" title**: Clear indication it's paid
- [ ] **After unlock**: Video plays normally (simulated)

## 5. Navigation Flow
- [ ] **Profile → Stream**: "Enter Full Stream Experience" button works
- [ ] **Stream → Profile**: Back button returns to profile
- [ ] **Auth prompts**: Non-logged users get sign-in prompts

## Demo Mode Features
- **30% chance** creator appears as "LIVE" on their profile
- **50% chance** live streams are paid (when live)
- **Random viewer counts**: 50-550 viewers
- **Test video URL**: Uses Mux test stream for demo

## Known Issues to Verify Fixed
1. ✅ Filter tabs were going off screen → Now scrollable
2. ✅ Redundant "Live Stream" title → Removed
3. ✅ Create Private Show button not visible → Now at bottom-right
4. ✅ Button blocking Stream Goal → Moved to bottom-right
5. ✅ No live indication on profile → Added multiple indicators
6. ✅ No video preview on profile → Full video preview implemented

## Testing Tips
1. **Refresh page** multiple times to see different live/paid states (30% live chance)
2. **Check responsive**: Test on different screen sizes
3. **Test as Creator**: Sign in to see creator-specific features
4. **Test as Fan**: Sign out or use different account for fan view
5. **Check console**: No errors should appear in browser console