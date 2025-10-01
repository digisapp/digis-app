# Mobile Testing Guide for Digis App

## 🚀 Quick Start

### 1. Start the Development Server
```bash
# Backend
cd backend
npm run dev

# Frontend (in new terminal)
cd frontend
npm run dev
```

### 2. Access on Mobile Device

#### Option A: Same Network (Recommended)
1. Find your computer's IP address:
   - Mac: `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - Windows: `ipconfig`
   - Linux: `ip addr show`

2. On your mobile device, open browser and go to:
   ```
   http://YOUR_COMPUTER_IP:5173
   ```

#### Option B: Using ngrok (Public URL)
1. Install ngrok: `brew install ngrok` (Mac) or download from ngrok.com
2. Run: `ngrok http 5173`
3. Use the provided HTTPS URL on your mobile device

#### Option C: Using Local Tunnel
```bash
npx localtunnel --port 5173
```

## 📱 Testing on Real Devices

### iOS Safari Testing
1. **Enable Web Inspector**:
   - iPhone: Settings → Safari → Advanced → Web Inspector: ON
   - Mac: Safari → Preferences → Advanced → Show Develop menu

2. **Connect iPhone to Mac via USB**

3. **Debug from Mac Safari**:
   - Open Safari on Mac
   - Develop menu → [Your iPhone] → [Your Website]

4. **Test Features**:
   - [ ] Pull to refresh
   - [ ] Safe area handling (notch/home indicator)
   - [ ] Camera/microphone permissions
   - [ ] Add to Home Screen
   - [ ] Offline mode (airplane mode)
   - [ ] Push notifications

### Android Chrome Testing
1. **Enable Developer Options**:
   - Settings → About Phone → Tap "Build Number" 7 times
   - Settings → Developer Options → USB Debugging: ON

2. **Connect Android to Computer via USB**

3. **Debug from Chrome**:
   - Open Chrome on computer
   - Go to: `chrome://inspect`
   - Click "inspect" under your device

4. **Test Features**:
   - [ ] Pull to refresh
   - [ ] Back button handling
   - [ ] Camera/microphone permissions
   - [ ] Install prompt (PWA)
   - [ ] Offline mode
   - [ ] Background sync

## 🧪 Testing Checklist

### Performance
- [ ] Initial load time < 3 seconds on 4G
- [ ] Smooth scrolling (60 FPS)
- [ ] Virtual list handles 1000+ items
- [ ] Images lazy load properly
- [ ] No memory leaks after navigation

### Touch Interactions
- [ ] Tap targets minimum 44x44px
- [ ] Swipe gestures work smoothly
- [ ] Pull to refresh functions
- [ ] No accidental taps
- [ ] Haptic feedback works

### Offline Functionality
- [ ] App loads offline (service worker)
- [ ] Offline queue displays
- [ ] Network status indicator shows
- [ ] Actions sync when back online
- [ ] Cached data displays

### PWA Features
- [ ] Add to Home Screen works
- [ ] Splash screen displays
- [ ] App runs in standalone mode
- [ ] Push notifications work
- [ ] Background sync functions

### Video Calling (Agora)
- [ ] Camera permission request
- [ ] Microphone permission request
- [ ] Video quality adapts to network
- [ ] Picture-in-picture works
- [ ] Call ends cleanly

## 🐛 Common Issues & Solutions

### Issue: Blank white screen
**Solution**: Check console for errors, ensure all dependencies installed:
```bash
cd frontend
npm install --legacy-peer-deps
```

### Issue: Camera/Microphone not working
**Solution**: 
1. Must use HTTPS (or localhost)
2. Check permissions in browser settings
3. For iOS: Settings → Safari → Camera & Microphone

### Issue: Service Worker not registering
**Solution**:
1. Only works on HTTPS or localhost
2. Check if SW file exists: `/public/sw.js`
3. Clear browser cache and retry

### Issue: Slow performance
**Solution**:
1. Enable production build: `npm run build && npm run preview`
2. Check network throttling in DevTools
3. Reduce image sizes
4. Implement code splitting

### Issue: Touch events not working
**Solution**:
1. Use `onClick` instead of `onMouseDown`
2. Add `touch-action: manipulation` CSS
3. Ensure touch targets are large enough

## 🔧 Development Tools

### Browser DevTools
- **Chrome**: F12 or right-click → Inspect
- **Safari**: Develop menu → Show Web Inspector
- **Firefox**: F12 or right-click → Inspect Element

### Mobile Emulation
- Chrome DevTools → Toggle Device Toolbar (Ctrl+Shift+M)
- Select device preset or custom dimensions
- Test different network speeds

### Performance Testing
```bash
# Lighthouse CLI
npm install -g lighthouse
lighthouse http://localhost:5173 --view

# Bundle analysis
npm run build:analyze
```

### PWA Testing
- Chrome DevTools → Application tab
- Check:
  - Manifest
  - Service Workers
  - Cache Storage
  - IndexedDB

## 📊 Monitoring

### Real User Monitoring (RUM)
The app includes performance monitoring that tracks:
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)

View metrics in console (development mode) or analytics dashboard.

### Error Tracking
Errors are logged to:
1. Browser console
2. Local storage (`mobile_error_logs`)
3. Sentry (if configured)

## 🚢 Deployment Testing

### Staging Environment
1. Deploy to Vercel preview:
```bash
vercel --prod
```

2. Test preview URL on multiple devices

### Production Checklist
- [ ] All tests pass
- [ ] Performance budget met (< 200KB JS)
- [ ] Lighthouse score > 90
- [ ] Works on iOS 12+
- [ ] Works on Android 5+
- [ ] Offline mode functions
- [ ] Analytics configured

## 📝 Testing Template

```markdown
Device: [iPhone 13 / Samsung S21 / etc]
OS: [iOS 15.5 / Android 12 / etc]
Browser: [Safari / Chrome / etc]
Network: [WiFi / 4G / 3G]

Test Results:
- [ ] App loads successfully
- [ ] Navigation works
- [ ] Scrolling is smooth
- [ ] Videos play
- [ ] Forms submit
- [ ] Offline mode works

Issues Found:
1. [Description]
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshot/video

Performance Metrics:
- Load time: X seconds
- FPS during scroll: X
- Memory usage: X MB
```

## 🎯 Quick Test URLs

After starting the dev server, test these URLs on your mobile device:

1. **Home**: `http://[YOUR-IP]:5173/`
2. **Explore**: `http://[YOUR-IP]:5173/#explore`
3. **Messages**: `http://[YOUR-IP]:5173/#messages`
4. **Wallet**: `http://[YOUR-IP]:5173/#wallet`
5. **Profile**: `http://[YOUR-IP]:5173/#profile`

## Need Help?

- Check browser console for errors
- View network requests in DevTools
- Check `localStorage` for cached data
- Review service worker status
- Inspect WebSocket connections

Remember to test on actual devices whenever possible, as emulators don't perfectly replicate real device behavior!