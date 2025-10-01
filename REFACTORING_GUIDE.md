# Component Refactoring Guide for Digis Platform

## Overview
This guide provides a comprehensive plan for refactoring three large components and implementing improvements across the platform.

## 1. VideoCall Component Refactoring (2586 lines → ~200 lines main + modules)

### Current Issues:
- Single file with 2586 lines
- Mixed concerns (UI, Agora logic, state management, billing)
- Difficult to test and maintain

### Proposed Structure:
```
/components/video-call/
├── VideoCall.js                    // Main container (~200 lines)
├── hooks/
│   ├── useAgoraClient.js          // Agora client logic (~150 lines)
│   ├── useVideoCallState.js       // State management (~100 lines)
│   ├── useCallBilling.js          // Billing calculations (~80 lines)
│   └── useCallRecording.js        // Recording functionality (~100 lines)
├── components/
│   ├── VideoCallControls.js       // Control buttons (~150 lines)
│   ├── VideoCallHeader.js         // Header with timer/info (~100 lines)
│   ├── VideoCallGrid.js           // Video grid layout (~120 lines)
│   ├── VideoCallChat.js           // Chat component (~150 lines)
│   ├── VideoCallSettings.js       // Quality/device settings (~120 lines)
│   ├── VideoCallEffects.js        // Filters and effects (~100 lines)
│   ├── VideoCallGifts.js          // Gift sending UI (~100 lines)
│   └── VideoCallEnded.js          // End screen with summary (~80 lines)
├── utils/
│   ├── agoraHelpers.js            // Agora utility functions (~80 lines)
│   ├── videoQuality.js            // Quality management (~60 lines)
│   └── callPermissions.js         // Permission checks (~40 lines)
└── constants/
    └── videoCallConstants.js       // Constants and configs (~30 lines)
```

### Implementation Example:

```javascript
// VideoCall.js - Main Container
import React, { Suspense, lazy } from 'react';
import { VideoCallProvider } from './contexts/VideoCallContext';
import useAgoraClient from './hooks/useAgoraClient';
import useVideoCallState from './hooks/useVideoCallState';
import VideoCallHeader from './components/VideoCallHeader';
import VideoCallGrid from './components/VideoCallGrid';
import VideoCallControls from './components/VideoCallControls';

// Lazy load heavy components
const VideoCallChat = lazy(() => import('./components/VideoCallChat'));
const VideoCallSettings = lazy(() => import('./components/VideoCallSettings'));
const VideoCallEffects = lazy(() => import('./components/VideoCallEffects'));

const VideoCall = ({ sessionId, user, onEnd }) => {
  const { client, localTracks, remoteTracks } = useAgoraClient(sessionId);
  const { callState, updateCallState } = useVideoCallState();

  return (
    <VideoCallProvider value={{ client, callState, user }}>
      <div className="video-call-container">
        <VideoCallHeader />
        <VideoCallGrid 
          localTracks={localTracks}
          remoteTracks={remoteTracks}
        />
        <VideoCallControls />
        
        <Suspense fallback={<div>Loading...</div>}>
          {callState.showChat && <VideoCallChat />}
          {callState.showSettings && <VideoCallSettings />}
          {callState.showEffects && <VideoCallEffects />}
        </Suspense>
      </div>
    </VideoCallProvider>
  );
};

// hooks/useAgoraClient.js
import { useState, useEffect, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

export const useAgoraClient = (sessionId) => {
  const [client, setClient] = useState(null);
  const [localTracks, setLocalTracks] = useState({ video: null, audio: null });
  const [remoteTracks, setRemoteTracks] = useState([]);

  useEffect(() => {
    const initClient = async () => {
      const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      
      // Event handlers
      agoraClient.on('user-published', handleUserPublished);
      agoraClient.on('user-unpublished', handleUserUnpublished);
      
      setClient(agoraClient);
    };
    
    initClient();
    
    return () => {
      // Cleanup
      client?.leave();
    };
  }, [sessionId]);

  return { client, localTracks, remoteTracks };
};
```

## 2. StreamingLayout Component Refactoring (1000+ lines → ~150 lines main + modules)

### Proposed Structure:
```
/components/streaming/
├── StreamingLayout.js              // Main container (~150 lines)
├── hooks/
│   ├── useStreamState.js          // Stream state management (~100 lines)
│   ├── useStreamAnalytics.js      // Analytics tracking (~80 lines)
│   └── useStreamMonetization.js   // Tips/gifts logic (~100 lines)
├── components/
│   ├── StreamHeader.js            // Stream title/info (~80 lines)
│   ├── StreamVideo.js             // Video player (~100 lines)
│   ├── StreamChat.js              // Chat component (~150 lines)
│   ├── StreamControls.js          // Creator controls (~120 lines)
│   ├── StreamViewerList.js        // Viewer list (~80 lines)
│   ├── StreamGifts.js             // Gift overlay (~100 lines)
│   ├── StreamPolls.js             // Interactive polls (~120 lines)
│   └── StreamSchedule.js          // Upcoming streams (~80 lines)
├── modals/
│   ├── GoLiveModal.js             // Start stream modal (~100 lines)
│   ├── StreamSettingsModal.js     // Stream settings (~80 lines)
│   └── StreamEndModal.js          // End stream summary (~80 lines)
└── utils/
    ├── streamHelpers.js            // Stream utilities (~60 lines)
    └── streamValidation.js         // Validation logic (~40 lines)
```

### Implementation Example:

```javascript
// StreamingLayout.js - Main Container
import React, { lazy, Suspense } from 'react';
import { StreamProvider } from './contexts/StreamContext';
import useStreamState from './hooks/useStreamState';
import StreamHeader from './components/StreamHeader';
import StreamVideo from './components/StreamVideo';
import StreamControls from './components/StreamControls';

const StreamChat = lazy(() => import('./components/StreamChat'));
const StreamGifts = lazy(() => import('./components/StreamGifts'));
const StreamPolls = lazy(() => import('./components/StreamPolls'));

const StreamingLayout = ({ user, streamId }) => {
  const streamState = useStreamState(streamId);
  
  return (
    <StreamProvider value={streamState}>
      <div className="streaming-layout">
        <StreamHeader />
        <div className="stream-content">
          <StreamVideo />
          <Suspense fallback={<LoadingSpinner />}>
            <StreamChat />
          </Suspense>
        </div>
        {user.isCreator && <StreamControls />}
        
        <Suspense fallback={null}>
          {streamState.showGifts && <StreamGifts />}
          {streamState.showPolls && <StreamPolls />}
        </Suspense>
      </div>
    </StreamProvider>
  );
};
```

## 3. ConnectPage Component Refactoring (1200+ lines → ~100 lines main + modules)

### Proposed Structure:
```
/components/pages/connect/
├── ConnectPage.js                  // Main router (~100 lines)
├── sections/
│   ├── ExperiencesSection.js      // Experiences tab (~200 lines)
│   ├── CollaborationsSection.js   // Collabs tab (~200 lines)
│   ├── OffersSection.js           // Offers tab (~200 lines)
│   └── RequestsSection.js         // Requests tab (~200 lines)
├── components/
│   ├── ExperienceCard.js          // Experience card (~80 lines)
│   ├── CollaborationCard.js       // Collab card (~80 lines)
│   ├── OfferCard.js               // Offer card (~80 lines)
│   └── FilterBar.js               // Filtering UI (~100 lines)
├── modals/
│   ├── ExperienceDetailsModal.js  // Experience details (~100 lines)
│   ├── CollabRequestModal.js      // Collab request (~100 lines)
│   └── OfferPurchaseModal.js      // Purchase flow (~120 lines)
└── hooks/
    ├── useExperiences.js           // Experiences data (~60 lines)
    ├── useCollaborations.js        // Collabs data (~60 lines)
    └── useOffers.js                // Offers data (~60 lines)
```

## 4. Lazy Loading Implementation

### Package Installation:
```bash
npm install --save react-intersection-observer
```

### Implementation Strategy:

```javascript
// utils/lazyComponents.js
import { lazy } from 'react';

// Lazy load heavy components
export const LazyVideoCall = lazy(() => 
  import(/* webpackChunkName: "video-call" */ '../components/video-call/VideoCall')
);

export const LazyStreamingLayout = lazy(() => 
  import(/* webpackChunkName: "streaming" */ '../components/streaming/StreamingLayout')
);

export const LazyTokenPurchase = lazy(() => 
  import(/* webpackChunkName: "payment" */ '../components/TokenPurchase')
);

// App.js - Route-based code splitting
import { Suspense, lazy } from 'react';
import LoadingSpinner from './components/ui/LoadingSpinner';

const VideoCallPage = lazy(() => import('./pages/VideoCallPage'));
const StreamPage = lazy(() => import('./pages/StreamPage'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/call/:id" element={<VideoCallPage />} />
        <Route path="/stream/:id" element={<StreamPage />} />
      </Routes>
    </Suspense>
  );
}

// Intersection Observer for lazy loading
import { useInView } from 'react-intersection-observer';

const LazyImage = ({ src, alt }) => {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true
  });

  return (
    <div ref={ref}>
      {inView ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : (
        <div className="placeholder-skeleton" />
      )}
    </div>
  );
};
```

## 5. TypeScript Migration

### Step 1: Install TypeScript
```bash
npm install --save-dev typescript @types/react @types/react-dom @types/node
```

### Step 2: Create tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./src",
    "paths": {
      "@components/*": ["components/*"],
      "@utils/*": ["utils/*"],
      "@hooks/*": ["hooks/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 3: Example TypeScript Component
```typescript
// components/video-call/VideoCall.tsx
import React, { FC, useState, useEffect } from 'react';

interface VideoCallProps {
  sessionId: string;
  user: User;
  onEnd: (summary: CallSummary) => void;
}

interface User {
  id: string;
  name: string;
  isCreator: boolean;
  tokenBalance: number;
}

interface CallSummary {
  duration: number;
  tokensSpent: number;
  quality: 'excellent' | 'good' | 'poor';
}

const VideoCall: FC<VideoCallProps> = ({ sessionId, user, onEnd }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  // Component logic
  
  return (
    <div className="video-call">
      {/* Component JSX */}
    </div>
  );
};

export default VideoCall;
```

## 6. Unit Testing Structure

### Install Testing Dependencies:
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom jest
```

### Example Test Structure:
```javascript
// __tests__/components/VideoCall.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VideoCall from '../components/video-call/VideoCall';

describe('VideoCall Component', () => {
  const mockUser = {
    id: '123',
    name: 'Test User',
    isCreator: false,
    tokenBalance: 1000
  };

  test('renders video call interface', () => {
    render(<VideoCall sessionId="test-session" user={mockUser} />);
    expect(screen.getByTestId('video-grid')).toBeInTheDocument();
  });

  test('shows controls for call management', () => {
    render(<VideoCall sessionId="test-session" user={mockUser} />);
    expect(screen.getByRole('button', { name: /mute/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /video/i })).toBeInTheDocument();
  });

  test('handles call end correctly', async () => {
    const onEndMock = jest.fn();
    render(<VideoCall sessionId="test-session" user={mockUser} onEnd={onEndMock} />);
    
    fireEvent.click(screen.getByRole('button', { name: /end call/i }));
    
    await waitFor(() => {
      expect(onEndMock).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: expect.any(Number),
          tokensSpent: expect.any(Number)
        })
      );
    });
  });
});
```

## 7. JSDoc Documentation

### Example Documentation:
```javascript
/**
 * VideoCall component for managing video/voice calls between users
 * @component
 * @param {Object} props - Component props
 * @param {string} props.sessionId - Unique identifier for the call session
 * @param {Object} props.user - Current user object
 * @param {string} props.user.id - User ID
 * @param {string} props.user.name - User display name
 * @param {boolean} props.user.isCreator - Whether user is a creator
 * @param {number} props.user.tokenBalance - User's token balance
 * @param {Function} props.onEnd - Callback when call ends
 * @returns {JSX.Element} VideoCall component
 * 
 * @example
 * <VideoCall 
 *   sessionId="abc-123"
 *   user={currentUser}
 *   onEnd={(summary) => console.log('Call ended', summary)}
 * />
 */
const VideoCall = ({ sessionId, user, onEnd }) => {
  /**
   * Initializes Agora client and joins channel
   * @async
   * @param {string} channelName - Name of the Agora channel
   * @param {string} token - Authentication token for Agora
   * @returns {Promise<void>}
   */
  const joinChannel = async (channelName, token) => {
    try {
      await client.join(appId, channelName, token, uid);
      // Additional logic
    } catch (error) {
      console.error('Failed to join channel:', error);
    }
  };

  // Component implementation
};
```

## Implementation Timeline

### Phase 1: Component Refactoring (Week 1-2)
- Day 1-3: Refactor VideoCall component
- Day 4-5: Refactor StreamingLayout component  
- Day 6-7: Refactor ConnectPage component
- Day 8-10: Testing and bug fixes

### Phase 2: Performance Optimization (Week 3)
- Day 1-2: Implement lazy loading
- Day 3-4: Add code splitting
- Day 5: Performance testing

### Phase 3: Type Safety (Week 4)
- Day 1-2: Set up TypeScript
- Day 3-5: Migrate critical components

### Phase 4: Testing & Documentation (Week 5)
- Day 1-3: Write unit tests
- Day 4-5: Add JSDoc comments

## Benefits After Refactoring

1. **Maintainability**: Smaller, focused components are easier to understand and modify
2. **Performance**: Lazy loading reduces initial bundle size by ~40%
3. **Testability**: Isolated components are easier to unit test
4. **Reusability**: Extracted components can be reused across the app
5. **Developer Experience**: Better code organization and TypeScript support
6. **Bundle Size**: Estimated reduction from 2.5MB to 1.5MB initial load

## Next Steps

1. Create feature branches for each refactoring task
2. Implement changes incrementally
3. Test thoroughly after each refactor
4. Update documentation
5. Deploy to staging for QA testing