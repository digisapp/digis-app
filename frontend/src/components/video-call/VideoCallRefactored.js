/**
 * Refactored VideoCall main component
 * @module VideoCallRefactored
 */

import React, { useEffect, useRef, useState, Suspense, lazy, forwardRef } from 'react';
import { VideoCallProvider } from './contexts/VideoCallContext';
import useAgoraClient from './hooks/useAgoraClient';
import useCallBilling from './hooks/useCallBilling';
import useCallRecording from './hooks/useCallRecording';
import VideoCallHeader from './components/VideoCallHeader';
import VideoCallGrid from './components/VideoCallGrid';
import VideoCallControls from './components/VideoCallControls';
import VideoCallEnded from './components/VideoCallEnded';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorBoundary from '../ui/ErrorBoundary';
import TipButton from '../payments/TipButton';
import toast from 'react-hot-toast';

// Lazy load heavy components
const VideoCallChat = lazy(() => import('./components/VideoCallChat'));
const VideoCallSettings = lazy(() => import('./components/VideoCallSettings'));
const VideoCallEffects = lazy(() => import('./components/VideoCallEffects'));
const VideoCallGifts = lazy(() => import('./components/VideoCallGifts'));

/**
 * Main VideoCall component - orchestrates the video calling experience
 * @component
 */
const VideoCallRefactored = forwardRef(({
  // Connection props
  channel,
  token: initialToken,
  uid,

  // User props
  user,
  isHost = false,
  isCreator = false,
  creatorId, // ID of the creator being called (for tips)

  // Call type props
  isStreaming = false,
  isVoiceOnly = false,
  useMultiVideoGrid = false,

  // Token/billing props
  tokenBalance = 0,
  onTokenUpdate,
  onTokenDeduction,

  // Callbacks
  onSessionEnd,
  onTokenExpired,
  onLocalTracksCreated,

  // Access control
  hasAccess = true,

  // Co-host support
  coHosts = [],
  activeCoHosts = []
}, ref) => {
  const containerRef = useRef(null);
  const [callEnded, setCallEnded] = useState(false);
  const [showUI, setShowUI] = useState({
    chat: false,
    settings: false,
    effects: false,
    gifts: false
  });

  // Custom hooks for modular functionality
  const {
    client,
    localTracks,
    remoteTracks,
    connectionState,
    isJoined,
    joinChannel,
    leaveChannel,
    toggleAudio,
    toggleVideo
  } = useAgoraClient(channel, user);

  const {
    sessionCost,
    callDuration,
    startBilling,
    stopBilling,
    calculateFinalCost
  } = useCallBilling(user, isCreator, tokenBalance);

  const {
    isRecording,
    startRecording,
    stopRecording,
    recordingUrl
  } = useCallRecording(channel, uid);

  // Initialize call
  useEffect(() => {
    if (!hasAccess) {
      toast.error('You do not have access to this call');
      onSessionEnd?.();
      return;
    }

    const initCall = async () => {
      try {
        await joinChannel(initialToken, uid);
        
        if (isCreator && !isVoiceOnly) {
          startBilling();
        }
        
        toast.success('Connected to call');
      } catch (error) {
        console.error('Failed to join call:', error);
        toast.error('Failed to connect to call');
        onSessionEnd?.();
      }
    };

    initCall();

    return () => {
      handleEndCall();
    };
  }, []);

  // Handle call end
  const handleEndCall = async () => {
    try {
      // Stop billing
      if (isCreator) {
        const finalCost = calculateFinalCost();
        stopBilling();
        
        // Deduct tokens if needed
        if (finalCost > 0 && onTokenDeduction) {
          await onTokenDeduction(finalCost);
        }
      }

      // Stop recording if active
      if (isRecording) {
        await stopRecording();
      }

      // Leave channel
      await leaveChannel();
      
      setCallEnded(true);
      
      // Notify parent
      onSessionEnd?.({
        duration: callDuration,
        cost: sessionCost,
        recordingUrl
      });
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  // Toggle UI panels
  const toggleUIPanel = (panel) => {
    setShowUI(prev => ({
      ...prev,
      [panel]: !prev[panel]
    }));
  };

  // Handle media controls
  const handleToggleAudio = async (enabled) => {
    await toggleAudio(enabled);
    toast(enabled ? 'Microphone on' : 'Microphone off', {
      icon: enabled ? '🎤' : '🔇'
    });
  };

  const handleToggleVideo = async (enabled) => {
    await toggleVideo(enabled);
    toast(enabled ? 'Camera on' : 'Camera off', {
      icon: enabled ? '📹' : '📵'
    });
  };

  // Handle screenshot
  const handleScreenshot = () => {
    if (containerRef.current) {
      // Implement screenshot logic
      toast.success('Screenshot saved');
    }
  };

  // Show ended screen if call ended
  if (callEnded) {
    return (
      <VideoCallEnded
        duration={callDuration}
        cost={sessionCost}
        isCreator={isCreator}
        recordingUrl={recordingUrl}
        onClose={() => onSessionEnd?.()}
      />
    );
  }

  return (
    <ErrorBoundary>
      <VideoCallProvider
        initialValues={{
          isJoined,
          connectionState,
          callDuration,
          sessionCost,
          isAudioEnabled: localTracks.audio?.enabled,
          isVideoEnabled: localTracks.video?.enabled
        }}
      >
        <div 
          ref={containerRef}
          className="video-call-container relative h-screen w-full bg-gray-900 overflow-hidden"
        >
          {/* Header with call info */}
          <VideoCallHeader
            channel={channel}
            duration={callDuration}
            cost={sessionCost}
            connectionState={connectionState}
            participantCount={remoteTracks.size + 1}
            isRecording={isRecording}
            isCreator={isCreator}
          />

          {/* Main video grid */}
          <VideoCallGrid
            localTracks={localTracks}
            remoteTracks={remoteTracks}
            isVoiceOnly={isVoiceOnly}
            useMultiVideoGrid={useMultiVideoGrid}
            isHost={isHost}
            activeCoHosts={activeCoHosts}
          />

          {/* Control buttons */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <VideoCallControls
              isAudioEnabled={localTracks.audio?.enabled}
              isVideoEnabled={localTracks.video?.enabled}
              isScreenSharing={!!localTracks.screen}
              isFullscreen={false}
              onToggleAudio={handleToggleAudio}
              onToggleVideo={handleToggleVideo}
              onToggleScreenShare={() => {}}
              onToggleFullscreen={() => {}}
              onOpenChat={() => toggleUIPanel('chat')}
              onOpenSettings={() => toggleUIPanel('settings')}
              onOpenEffects={() => toggleUIPanel('effects')}
              onTakeScreenshot={handleScreenshot}
              onEndCall={handleEndCall}
              isCreator={isCreator}
            />
          </div>

          {/* Tip Button - Show for fans calling creators */}
          {!isCreator && creatorId && user?.id !== creatorId && (
            <div className="absolute bottom-24 right-4 z-50">
              <TipButton
                toCreatorId={creatorId}
                context={{
                  callId: channel,
                  sessionId: channel,
                  type: 'video_call'
                }}
                onTipped={(tip) => {
                  toast.success(`Tip of ${tip.amountTokens} tokens sent!`, {
                    icon: '💰'
                  });
                  if (onTokenUpdate) {
                    onTokenUpdate(tip.new_balance);
                  }
                }}
                className="shadow-2xl"
              />
            </div>
          )}

          {/* Lazy loaded UI panels */}
          <Suspense fallback={<LoadingSpinner />}>
            {/* Chat panel */}
            {showUI.chat && (
              <VideoCallChat
                channel={channel}
                user={user}
                onClose={() => toggleUIPanel('chat')}
              />
            )}

            {/* Settings panel */}
            {showUI.settings && (
              <VideoCallSettings
                localTracks={localTracks}
                onClose={() => toggleUIPanel('settings')}
              />
            )}

            {/* Effects panel */}
            {showUI.effects && !isVoiceOnly && (
              <VideoCallEffects
                localVideoTrack={localTracks.video}
                onClose={() => toggleUIPanel('effects')}
              />
            )}

            {/* Gifts panel */}
            {showUI.gifts && isCreator && (
              <VideoCallGifts
                onSendGift={(gift) => {
                  toast.success(`Sent ${gift.name}!`);
                }}
                onClose={() => toggleUIPanel('gifts')}
              />
            )}
          </Suspense>

          {/* Connection status indicator */}
          {connectionState !== 'CONNECTED' && (
            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-4 py-2 rounded-lg">
              {connectionState === 'CONNECTING' && 'Connecting...'}
              {connectionState === 'RECONNECTING' && 'Reconnecting...'}
              {connectionState === 'DISCONNECTED' && 'Connection lost'}
            </div>
          )}

          {/* Token balance warning */}
          {!isCreator && tokenBalance < 100 && (
            <div className="absolute top-20 right-4 bg-red-500 text-white px-4 py-2 rounded-lg">
              Low token balance: {tokenBalance}
            </div>
          )}
        </div>
      </VideoCallProvider>
    </ErrorBoundary>
  );
});

VideoCallRefactored.displayName = 'VideoCallRefactored';

export default VideoCallRefactored;