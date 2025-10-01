/**
 * Refactored StreamingLayout main component
 * @module StreamingLayoutRefactored
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { StreamProvider } from './contexts/StreamContext';
import useStreamManagement from './hooks/useStreamManagement';
import useStreamMonetization from './hooks/useStreamMonetization';
import StreamHeader from './components/StreamHeader';
import StreamVideo from './components/StreamVideo';
import StreamControls from './components/StreamControls';
import StreamViewerList from './components/StreamViewerList';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorBoundary from '../ui/ErrorBoundary';
import toast from 'react-hot-toast';

// Lazy load heavy components
const StreamChat = lazy(() => import('./components/StreamChat'));
const StreamGifts = lazy(() => import('./components/StreamGifts'));
const StreamPolls = lazy(() => import('./components/StreamPolls'));
const GoLiveModal = lazy(() => import('./modals/GoLiveModal'));
const StreamSettingsModal = lazy(() => import('./modals/StreamSettingsModal'));
const StreamEndModal = lazy(() => import('./modals/StreamEndModal'));

/**
 * Main StreamingLayout component - orchestrates the streaming experience
 * @component
 */
const StreamingLayoutRefactored = ({
  user,
  channel,
  isCreator = false,
  streamKey = null,
  onStreamEnd,
  tokenBalance = 0
}) => {
  const [showModals, setShowModals] = useState({
    goLive: false,
    settings: false,
    endStream: false
  });
  
  const [showPanels, setShowPanels] = useState({
    chat: true,
    gifts: false,
    polls: false,
    viewers: false
  });

  // Custom hooks for modular functionality
  const {
    streamStatus,
    streamInfo,
    streamStats,
    formattedDuration,
    prepareStream,
    startStream,
    endStream,
    updateStreamSettings,
    updateViewerCount,
    canStartStream
  } = useStreamManagement(user, channel);

  const {
    totalEarnings,
    recentTips,
    topSupporters,
    processTip,
    processGift,
    processSubscription
  } = useStreamMonetization(streamInfo?.id, user);

  // Initialize stream if creator
  useEffect(() => {
    if (isCreator && !streamInfo.id && canStartStream()) {
      setShowModals({ ...showModals, goLive: true });
    }
  }, [isCreator]);

  // Handle go live
  const handleGoLive = async (streamData) => {
    try {
      const stream = await prepareStream(streamData);
      await startStream();
      setShowModals({ ...showModals, goLive: false });
      toast.success('You are now live!', { icon: '🔴' });
    } catch (error) {
      console.error('Failed to go live:', error);
    }
  };

  // Handle stream end
  const handleEndStream = async () => {
    try {
      const summary = await endStream();
      setShowModals({ ...showModals, endStream: true });
      
      if (onStreamEnd) {
        onStreamEnd(summary);
      }
    } catch (error) {
      console.error('Failed to end stream:', error);
    }
  };

  // Toggle UI panels
  const togglePanel = (panel) => {
    setShowPanels(prev => ({
      ...prev,
      [panel]: !prev[panel]
    }));
  };

  // Handle tips and gifts
  const handleTip = async (amount, message) => {
    const tip = await processTip(amount, message, user);
    toast.success(`${user.name} tipped ${amount} tokens!`, {
      icon: '💰'
    });
    return tip;
  };

  const handleGift = async (gift) => {
    const processedGift = await processGift(gift, user);
    toast.success(`${user.name} sent a ${gift.name}!`, {
      icon: gift.emoji || '🎁'
    });
    return processedGift;
  };

  return (
    <ErrorBoundary>
      <StreamProvider
        initialValues={{
          streamId: streamInfo?.id,
          streamTitle: streamInfo?.title,
          isLive: streamStatus === 'live',
          viewerCount: streamStats.viewerCount,
          totalTips: totalEarnings.tips,
          totalGifts: totalEarnings.gifts
        }}
      >
        <div className="streaming-layout min-h-screen bg-gray-900">
          {/* Header */}
          <StreamHeader
            streamInfo={streamInfo}
            streamStatus={streamStatus}
            duration={formattedDuration}
            viewerCount={streamStats.viewerCount}
            earnings={totalEarnings.total}
            isCreator={isCreator}
            onSettings={() => setShowModals({ ...showModals, settings: true })}
          />

          {/* Main content area */}
          <div className="flex flex-1">
            {/* Left sidebar - Viewer list (optional) */}
            {showPanels.viewers && (
              <div className="w-64 bg-gray-800 border-r border-gray-700">
                <StreamViewerList
                  viewers={[]} // Would come from WebSocket
                  moderators={[]}
                  isCreator={isCreator}
                />
              </div>
            )}

            {/* Center - Video area */}
            <div className="flex-1 relative">
              <StreamVideo
                streamKey={streamKey}
                channel={channel}
                isLive={streamStatus === 'live'}
                isCreator={isCreator}
                quality={streamInfo.quality || 'auto'}
              />

              {/* Overlay components */}
              <Suspense fallback={null}>
                {/* Gifts overlay */}
                {showPanels.gifts && (
                  <StreamGifts
                    onSendGift={handleGift}
                    recentGifts={[]}
                    tokenBalance={tokenBalance}
                  />
                )}

                {/* Polls overlay */}
                {showPanels.polls && isCreator && (
                  <StreamPolls
                    streamId={streamInfo?.id}
                    isCreator={isCreator}
                  />
                )}
              </Suspense>

              {/* Creator controls */}
              {isCreator && streamStatus === 'live' && (
                <StreamControls
                  onEndStream={() => setShowModals({ ...showModals, endStream: true })}
                  onToggleChat={() => togglePanel('chat')}
                  onToggleGifts={() => togglePanel('gifts')}
                  onTogglePolls={() => togglePanel('polls')}
                  onToggleViewers={() => togglePanel('viewers')}
                  showPanels={showPanels}
                />
              )}
            </div>

            {/* Right sidebar - Chat */}
            {showPanels.chat && (
              <div className="w-80 bg-gray-800 border-l border-gray-700">
                <Suspense fallback={<LoadingSpinner />}>
                  <StreamChat
                    streamId={streamInfo?.id}
                    user={user}
                    isCreator={isCreator}
                    onTip={handleTip}
                  />
                </Suspense>
              </div>
            )}
          </div>

          {/* Modals */}
          <Suspense fallback={null}>
            {/* Go Live Modal */}
            {showModals.goLive && (
              <GoLiveModal
                onGoLive={handleGoLive}
                onClose={() => setShowModals({ ...showModals, goLive: false })}
              />
            )}

            {/* Settings Modal */}
            {showModals.settings && (
              <StreamSettingsModal
                streamInfo={streamInfo}
                onUpdate={updateStreamSettings}
                onClose={() => setShowModals({ ...showModals, settings: false })}
              />
            )}

            {/* End Stream Modal */}
            {showModals.endStream && (
              <StreamEndModal
                streamStats={streamStats}
                totalEarnings={totalEarnings}
                topSupporters={topSupporters}
                onClose={() => {
                  setShowModals({ ...showModals, endStream: false });
                  onStreamEnd?.();
                }}
              />
            )}
          </Suspense>

          {/* Stream status indicator */}
          {streamStatus === 'preparing' && (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-4 py-2 rounded-lg z-50">
              Preparing stream...
            </div>
          )}

          {/* Low token warning for viewers */}
          {!isCreator && tokenBalance < 50 && (
            <div className="fixed bottom-20 right-4 bg-red-500 text-white px-4 py-2 rounded-lg z-50">
              Low token balance: {tokenBalance}
            </div>
          )}
        </div>
      </StreamProvider>
    </ErrorBoundary>
  );
};

export default StreamingLayoutRefactored;