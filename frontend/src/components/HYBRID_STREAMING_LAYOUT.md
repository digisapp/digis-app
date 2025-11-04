# Hybrid Streaming Layout System

## Overview

The **HybridStreamingLayout** component intelligently switches between mobile-optimized immersive experiences and desktop-optimized classic layouts based on device detection. This gives users the best possible streaming experience for their device.

## Architecture

```
HybridStreamingLayout (Smart Wrapper)
├── Desktop/Tablet → StreamingLayout (Classic side-by-side)
│   └── VideoCall component (all bug fixes)
└── Mobile → Immersive fullscreen layout
    └── VideoCall component (all bug fixes)
```

## Key Features

### Mobile Experience (Immersive Mode)
- ✅ **Full-screen video** with iOS safe area support
- ✅ **Glassmorphism overlays** with backdrop blur
- ✅ **Animated LIVE badge** with pulsing dot
- ✅ **Auto-hiding controls** (3-second timeout)
- ✅ **Floating messages** overlay (Instagram/TikTok style)
- ✅ **Touch-optimized buttons** with large tap targets
- ✅ **Network quality indicator** (green/yellow/red dot)
- ✅ **Reconnecting status** with animated pill
- ✅ **Multi-color gradient buttons** (purple to pink)
- ✅ **Animated goal meter** with 3-level progression
- ✅ **Slide-in side panels** for chat and analytics

### Desktop Experience (Classic Mode)
- ✅ **Side-by-side layout** with video + chat
- ✅ **Panel tabs** for chat, polls, gifts
- ✅ **Focus mode** toggle for full-screen video
- ✅ **Responsive grid** for multiple co-hosts
- ✅ **Persistent controls** always visible

### Shared Features (Both Modes)
- ✅ **VideoCall component** with all UID_CONFLICT fixes
- ✅ **Private show support** with ticket gating
- ✅ **Real-time stats** via socket events
- ✅ **Gift and tip tracking** with animations
- ✅ **Stream goal meter** with visual progress
- ✅ **End stream overlay** with summary stats

## Device Detection

The system uses `/src/utils/deviceDetection.js` to determine:

```javascript
- isMobileDevice() → User agent + touch + screen size
- isTablet() → iPad or Android tablets
- isIOS() → iPhone/iPad detection
- supportsScreenShare() → iOS 17+ or desktop
- getOptimalLayout() → 'immersive' or 'classic'
```

### Detection Logic
```javascript
Mobile: Width ≤ 768px + touch support + mobile user agent
Tablet: 768px - 1024px or iPad/Android tablet
Desktop: Everything else
```

## Component Props

```jsx
<HybridStreamingLayout
  user={currentUser}              // Authenticated user object
  channel="stream_abc123"         // Agora channel name
  token="agora_rtc_token"         // Agora RTC token
  chatToken="ably_chat_token"     // Chat token (optional)
  uid={1234567}                   // Agora UID
  isCreator={true}                // Is this user the stream creator?
  isHost={true}                   // Is this user the host?
  isStreaming={true}              // Is this a live stream (vs 1-on-1 call)?
  isVoiceOnly={false}             // Voice-only mode
  onTokenDeduction={(amt) => {}}  // Called when tokens are spent
  onSessionEnd={() => {}}         // Called when stream ends
  targetCreator={creatorObject}   // Creator being tipped/gifted to
  streamConfig={{                 // Stream metadata
    title: "My Amazing Stream",
    category: "Gaming",
    description: "Let's play!"
  }}
/>
```

## File Structure

```
frontend/src/
├── components/
│   ├── HybridStreamingLayout.jsx     ← NEW: Smart wrapper
│   ├── StreamingLayout.js             ← Existing: Desktop layout
│   ├── VideoCall.js                   ← Existing: Agora integration
│   ├── LiveChatSupabase.jsx           ← Existing: Chat component
│   └── mobile/
│       └── EnhancedMobileLiveStream.js ← Original enhanced design (archived)
├── utils/
│   └── deviceDetection.js             ← NEW: Device detection utility
└── pages/
    └── StreamPage.js                  ← Updated to use Hybrid
```

## Migration Guide

### Before (Old Code)
```jsx
import StreamingLayout from '../StreamingLayout';

<StreamingLayout
  user={user}
  channel={channel}
  token={token}
  uid={uid}
  isHost={isHost}
/>
```

### After (New Code)
```jsx
import HybridStreamingLayout from '../HybridStreamingLayout';

<HybridStreamingLayout
  user={user}
  channel={channel}
  token={token}
  uid={uid}
  isHost={isHost}
  isStreaming={true}
  streamConfig={{ title, category, description }}
/>
```

## Design Elements Comparison

| Element | Mobile (Immersive) | Desktop (Classic) |
|---------|-------------------|-------------------|
| Layout | Fixed fullscreen overlay | Flex grid with panels |
| Controls | Floating, auto-hide | Always visible |
| Chat | Slide-in panel | Side panel |
| Messages | Floating over video | In chat panel |
| LIVE Badge | Animated red pill | Static badge |
| Buttons | Gradient with shadow | Solid colors |
| Video | Full bleed | Contained in grid |
| Stats | Compact top bar | Card-based layout |

## CSS Classes (Mobile)

### Glassmorphism
```css
bg-black/60 backdrop-blur-sm        /* Messages, overlays */
bg-white/20 backdrop-blur-sm        /* Buttons, controls */
bg-gradient-to-b from-black/80     /* Top gradient */
bg-gradient-to-t from-black/90     /* Bottom gradient */
```

### Gradients
```css
bg-gradient-to-r from-purple-600 to-pink-600   /* Brand buttons */
bg-gradient-to-r from-green-500 via-blue-500 to-purple-500  /* Goal meter */
```

### iOS Safe Areas
```css
padding-top: env(safe-area-inset-top)
padding-bottom: env(safe-area-inset-bottom)
blockSize: 100dvh
```

## Performance Optimizations

1. **Conditional Rendering**: Desktop components don't load on mobile
2. **Ref-based Duration**: Avoids re-renders every second
3. **Message Slicing**: Only show last 3-20 messages
4. **Debounced Controls**: Auto-hide timeout prevents spam
5. **AnimatePresence**: Smooth transitions without layout shift

## Testing Checklist

### Mobile Testing
- [ ] iPhone Safari (iOS 15+)
- [ ] iPhone Safari (iOS 17+ screen share)
- [ ] Android Chrome
- [ ] Safe area insets (notch handling)
- [ ] Landscape orientation
- [ ] Auto-hide controls after 3 seconds
- [ ] Tap to show/hide controls
- [ ] Chat slide-in panel
- [ ] Private show ticket gating

### Desktop Testing
- [ ] Chrome (Windows/Mac)
- [ ] Safari (Mac)
- [ ] Firefox
- [ ] Focus mode toggle
- [ ] Side panel resizing
- [ ] Co-host grid layout
- [ ] Keyboard shortcuts

### Cross-Device Testing
- [ ] Switch from desktop to mobile (responsive)
- [ ] Private show on both devices
- [ ] Gift/tip animations
- [ ] Real-time stat updates
- [ ] End stream overlay

## Known Issues & Future Enhancements

### Current Limitations
- Mobile landscape mode needs better button positioning
- Analytics panel on mobile could use more graphs
- Screen sharing only works on iOS 17+

### Planned Features
- [ ] Picture-in-picture mode for mobile multitasking
- [ ] Swipe gestures for panel navigation
- [ ] Customizable control positions
- [ ] Dark/light theme support in immersive mode
- [ ] Recording indicator for mobile

## Browser Support

| Browser | Mobile | Desktop | Screen Share |
|---------|--------|---------|--------------|
| Chrome | ✅ | ✅ | ✅ |
| Safari | ✅ | ✅ | iOS 17+ only |
| Firefox | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ |

## Bug Fixes Included

All critical bug fixes from `VideoCall.js` are inherited:
- ✅ UID_CONFLICT infinite loop fixed
- ✅ SDK initialization race condition fixed
- ✅ Token refresh logic improved
- ✅ Auth sync-metadata endpoint fixed
- ✅ Stuck stream auto-cleanup (2 minutes)
- ✅ Service role key for RLS bypass
- ✅ Database column type fixes (UUID vs SERIAL)

## Credits

- **Original Enhanced Design**: EnhancedMobileLiveStream.js (Oct 19, 2024)
- **Desktop Layout**: StreamingLayout.js (Nov 2, 2024)
- **Hybrid Integration**: Nov 4, 2024
- **Design Inspiration**: Instagram Live, TikTok Live, Twitch Mobile

---

For questions or issues, check the main CLAUDE.md documentation.
