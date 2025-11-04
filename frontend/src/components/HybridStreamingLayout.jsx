/**
 * HybridStreamingLayout
 * Intelligently switches between mobile-optimized immersive layout
 * and desktop-optimized classic layout based on device detection
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { isMobileDevice, getOptimalLayout, supportsScreenShare } from '../utils/deviceDetection';
import toast from 'react-hot-toast';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  XMarkIcon,
  ChatBubbleLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
  Bars3Icon,
  UserGroupIcon,
  HeartIcon as HeartIconOutline,
  GiftIcon,
  ChartBarIcon,
  TrophyIcon,
  ShareIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartIconSolid,
  VideoCameraSlashIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/solid';

// Import existing components
import VideoCall from './VideoCall';
import StreamingLayout from './StreamingLayout';
import LiveChatSupabase from './LiveChatSupabase';
import PrivateShowAnnouncement from './PrivateShowAnnouncement';
import socketService from '../services/socketServiceWrapper';

const HybridStreamingLayout = ({
  user,
  channel,
  token,
  chatToken,
  uid,
  isCreator = false,
  isHost = false,
  isStreaming = false,
  isVoiceOnly = false,
  onTokenDeduction,
  onSessionEnd,
  targetCreator = null,
  streamConfig = null,
  className = ''
}) => {
  const [deviceType] = useState(() => isMobileDevice() ? 'mobile' : 'desktop');
  const [layoutMode] = useState(() => getOptimalLayout());

  console.log('🎭 [HybridStreamingLayout] Rendered:', {
    deviceType,
    layoutMode,
    channel,
    hasToken: !!token,
    uid,
    isHost,
    isStreaming,
    willUseDesktop: deviceType === 'desktop' || layoutMode === 'classic'
  });

  // Mobile-specific state
  const [showMenu, setShowMenu] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // 'chat', 'analytics', 'settings'
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showStreamEnded, setShowStreamEnded] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState('DISCONNECTED');
  const [networkQuality, setNetworkQuality] = useState(0);
  const [videoVisible, setVideoVisible] = useState(true);
  const [privateShowActive, setPrivateShowActive] = useState(false);
  const [hasTicket, setHasTicket] = useState(false);
  const [currentShow, setCurrentShow] = useState(null);

  // Stream data
  const [streamStats, setStreamStats] = useState({
    duration: 0,
    viewers: 0,
    peakViewers: 0,
    messages: 0,
    gifts: 0,
    tips: 0,
    revenue: 0,
    newFollowers: 0,
    engagement: 0
  });
  const [messages, setMessages] = useState([]);
  const [streamGoal, setStreamGoal] = useState({
    currentAmount: 0,
    level1: { amount: 5000, description: 'Level 1' },
    level2: { amount: 10000, description: 'Level 2' },
    level3: { amount: 25000, description: 'Level 3' },
    isVisible: true
  });

  const videoCallRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const durationRef = useRef(0);

  // Desktop mode: Use classic StreamingLayout
  if (deviceType === 'desktop' || layoutMode === 'classic') {
    console.log('🎭 [HybridStreamingLayout] Using desktop StreamingLayout');
    return (
      <StreamingLayout
        user={user}
        channel={channel}
        token={token}
        chatToken={chatToken}
        uid={uid}
        isCreator={isCreator}
        isHost={isHost}
        isStreaming={isStreaming}
        isVoiceOnly={isVoiceOnly}
        onTokenDeduction={onTokenDeduction}
        onSessionEnd={onSessionEnd}
        targetCreator={targetCreator}
        streamConfig={streamConfig}
        className={className}
      />
    );
  }

  // Mobile mode: Use immersive layout
  console.log('🎭 [HybridStreamingLayout] Using mobile immersive layout');

  // Duration counter
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      durationRef.current += 1;
      setStreamStats(prev => ({ ...prev, duration: durationRef.current }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming]);

  // Socket events for real-time updates
  useEffect(() => {
    if (!channel || !isStreaming) return;

    socketService.emit('join-stream', channel);

    socketService.on('viewer-count', (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          viewers: data.count,
          peakViewers: Math.max(prev.peakViewers, data.count)
        }));
      }
    });

    socketService.on('gift-received', (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          gifts: prev.gifts + (data.quantity || 1),
          revenue: prev.revenue + (data.totalValue || 0)
        }));
        if (streamGoal.isVisible) {
          setStreamGoal(prev => ({
            ...prev,
            currentAmount: prev.currentAmount + (data.totalValue || 0)
          }));
        }
      }
    });

    socketService.on('tip-received', (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          tips: prev.tips + (data.amount || 0),
          revenue: prev.revenue + (data.amount || 0)
        }));
        if (streamGoal.isVisible) {
          setStreamGoal(prev => ({
            ...prev,
            currentAmount: prev.currentAmount + (data.amount || 0)
          }));
        }
      }
    });

    socketService.on('message-sent', (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          messages: prev.messages + 1
        }));
        setMessages(prev => [...prev.slice(-20), data]);
      }
    });

    return () => {
      socketService.emit('leave-stream', channel);
      socketService.off('viewer-count');
      socketService.off('gift-received');
      socketService.off('tip-received');
      socketService.off('message-sent');
    };
  }, [channel, isStreaming, streamGoal.isVisible]);

  // Private show events
  useEffect(() => {
    if (!channel) return;

    socketService.on('private_mode_started', (data) => {
      if (data.streamId === channel) {
        setPrivateShowActive(true);
        setCurrentShow(data);

        if (!hasTicket && !isCreator) {
          setVideoVisible(false);
          toast('Private show started! Purchase a ticket to see the video', {
            icon: '🎫',
            duration: 5000
          });
        }
      }
    });

    socketService.on('enable_private_video', (data) => {
      if (data.streamId === channel || data.channelId === channel) {
        setVideoVisible(true);
        setHasTicket(true);
        toast.success('Private show access granted! Enjoy the show! 🎉');
      }
    });

    socketService.on('private_show_ended', (data) => {
      if (data.streamId === channel) {
        setPrivateShowActive(false);
        setVideoVisible(true);
        setCurrentShow(null);
        toast('Private show has ended', { icon: '📺' });
      }
    });

    return () => {
      socketService.off('private_mode_started');
      socketService.off('enable_private_video');
      socketService.off('private_show_ended');
    };
  }, [channel, hasTicket, isCreator]);

  // Auto-hide controls after 3 seconds
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isStreaming) {
        setControlsVisible(false);
      }
    }, 3000);
  }, [isStreaming]);

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentGoalLevel = () => {
    if (streamGoal.currentAmount >= streamGoal.level3.amount) return 3;
    if (streamGoal.currentAmount >= streamGoal.level2.amount) return 2;
    if (streamGoal.currentAmount >= streamGoal.level1.amount) return 1;
    return 0;
  };

  const getGoalProgress = () => {
    const level = getCurrentGoalLevel();
    if (level === 0) {
      return (streamGoal.currentAmount / streamGoal.level1.amount) * 100;
    } else if (level === 1) {
      return ((streamGoal.currentAmount - streamGoal.level1.amount) / (streamGoal.level2.amount - streamGoal.level1.amount)) * 100;
    } else if (level === 2) {
      return ((streamGoal.currentAmount - streamGoal.level2.amount) / (streamGoal.level3.amount - streamGoal.level2.amount)) * 100;
    }
    return 100;
  };

  const handleEndStream = async () => {
    setShowEndConfirm(false);
    setShowStreamEnded(true);

    // Call parent's onSessionEnd
    if (onSessionEnd) {
      onSessionEnd();
    }
  };

  const shareStream = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Live Stream - ${targetCreator?.name || 'Creator'}`,
          text: 'Join this amazing live stream!',
          url: window.location.href
        });
      } catch (error) {
        console.log('Share cancelled or failed');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Stream link copied to clipboard!');
    }
  };

  // Mobile Immersive Layout
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        blockSize: '100dvh',
        WebkitOverflowScrolling: 'touch',
        overflowY: 'auto',
      }}
      onClick={resetControlsTimeout}
      onTouchStart={resetControlsTimeout}
      data-hybrid-streaming="mobile"
    >
      <div className="relative flex-1 w-full">
        {/* Video Component - Uses VideoCall with all bug fixes */}
        {videoVisible ? (
          <div className="absolute inset-0 z-10">
            <VideoCall
              ref={videoCallRef}
              channel={channel}
              token={token}
              uid={uid}
              isHost={isHost}
              isStreaming={isStreaming}
              isVoiceOnly={isVoiceOnly}
              onTokenDeduction={onTokenDeduction}
              onSessionEnd={onSessionEnd}
              user={user}
              hasAccess={videoVisible}
              className="w-full h-full"
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black z-10">
            <div className="text-center p-8 max-w-md">
              <LockClosedIcon className="w-20 h-20 text-gray-600 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-white mb-3">
                Private Show in Progress
              </h3>
              <p className="text-gray-400 mb-6">
                This is an exclusive ticketed show. Purchase a ticket to unlock the video feed.
              </p>
              <PrivateShowAnnouncement
                streamId={channel}
                isCreator={false}
                className="inline-block"
              />
            </div>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none z-20" />

        {/* Top Overlay - Always visible */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full flex items-center gap-1 animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full" />
                LIVE
              </span>
              <span className="text-white text-sm font-medium">{formatDuration(streamStats.duration)}</span>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setShowMenu(true)} className="p-2 bg-black/40 rounded-full backdrop-blur-sm">
                <Bars3Icon className="w-5 h-5 text-white" />
              </button>
              <button onClick={() => setShowEndConfirm(true)} className="p-2 bg-red-600 rounded-full">
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-white text-sm">
            <div className="flex items-center gap-1">
              <UserGroupIcon className="w-4 h-4" />
              <span className="font-medium">{streamStats.viewers}</span>
            </div>
            <div className="flex items-center gap-1">
              <HeartIconSolid className="w-4 h-4 text-red-500" />
              <span className="font-medium">{streamStats.gifts + streamStats.tips}</span>
            </div>
            <div className="flex items-center gap-1">
              <ChatBubbleLeftIcon className="w-4 h-4" />
              <span className="font-medium">{streamStats.messages}</span>
            </div>

            {/* Network quality indicator */}
            {networkQuality > 0 && (
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  networkQuality <= 2 ? 'bg-green-500' :
                  networkQuality === 3 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`} />
              </div>
            )}
          </div>

          {/* Reconnecting pill */}
          <AnimatePresence>
            {connectionState === 'CONNECTING' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="absolute top-4 left-4 px-3 py-1.5 bg-yellow-500/90 backdrop-blur-sm rounded-full flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white text-xs font-medium">Reconnecting...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stream title */}
          {streamConfig?.title && (
            <h3 className="text-white font-semibold mt-2 text-sm">{streamConfig.title}</h3>
          )}

          {/* Stream Goal Progress */}
          {streamGoal.isVisible && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 bg-black/40 backdrop-blur-sm rounded-lg p-3"
            >
              <div className="flex items-center justify-between text-white text-xs mb-1">
                <span className="flex items-center gap-1">
                  <TrophyIcon className="w-3 h-3" />
                  Goal Level {getCurrentGoalLevel() + 1}
                </span>
                <span className="font-bold">{streamGoal.currentAmount} / {streamGoal[`level${getCurrentGoalLevel() + 1}`]?.amount || streamGoal.level3.amount}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(getGoalProgress(), 100)}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-green-500 via-blue-500 to-purple-500"
                />
              </div>
            </motion.div>
          )}
        </div>

        {/* Live messages overlay - bottom left */}
        <div className="absolute bottom-32 left-4 right-4 max-h-48 overflow-hidden z-30 pointer-events-none">
          <AnimatePresence>
            {messages.slice(-3).map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="mb-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 max-w-xs"
              >
                <span className="text-purple-400 font-semibold text-sm">{msg.user}: </span>
                <span className="text-white text-sm">{msg.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Bottom Control Bar - Toggle visibility */}
        <AnimatePresence>
          {controlsVisible && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-0 left-0 right-0 p-4 pb-[env(safe-area-inset-bottom)] bg-gradient-to-t from-black/90 to-transparent z-30"
            >
              {/* Primary controls */}
              <div className="flex justify-center gap-3 mb-4">
                <button
                  onClick={() => setActivePanel('chat')}
                  className="p-3 bg-purple-600 rounded-full relative"
                  aria-label="Open chat"
                >
                  <ChatBubbleLeftIcon className="w-6 h-6 text-white" />
                  {streamStats.messages > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {streamStats.messages > 9 ? '9+' : streamStats.messages}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActivePanel('analytics')}
                  className="p-3 bg-blue-600 rounded-full"
                  aria-label="Open analytics"
                >
                  <ChartBarIcon className="w-6 h-6 text-white" />
                </button>

                <button
                  onClick={shareStream}
                  className="p-3 bg-white/20 backdrop-blur-sm rounded-full"
                  aria-label="Share stream"
                >
                  <ShareIcon className="w-6 h-6 text-white" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Side panels */}
        <AnimatePresence>
          {activePanel && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-gray-900 shadow-2xl overflow-hidden z-40"
            >
              {/* Panel header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">
                  {activePanel === 'chat' && 'Live Chat'}
                  {activePanel === 'analytics' && 'Analytics'}
                </h3>
                <button onClick={() => setActivePanel(null)} className="p-2 bg-white/20 rounded-full">
                  <XMarkIcon className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-y-auto p-4 h-full">
                {activePanel === 'analytics' && (
                  <div className="space-y-4">
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-400 text-xs mb-1">Total Viewers</div>
                      <div className="text-white text-3xl font-bold">{streamStats.viewers}</div>
                      <div className="text-gray-500 text-xs">Peak: {streamStats.peakViewers}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-gray-400 text-xs mb-1">Gifts</div>
                        <div className="text-purple-400 text-2xl font-bold">{streamStats.gifts}</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-gray-400 text-xs mb-1">Tips</div>
                        <div className="text-pink-400 text-2xl font-bold">{streamStats.tips}</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-gray-400 text-xs mb-1">Messages</div>
                        <div className="text-blue-400 text-2xl font-bold">{streamStats.messages}</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="text-gray-400 text-xs mb-1">Revenue</div>
                        <div className="text-green-400 text-2xl font-bold">{streamStats.revenue}</div>
                      </div>
                    </div>
                  </div>
                )}

                {activePanel === 'chat' && (
                  <div className="h-full">
                    <LiveChatSupabase
                      user={user}
                      channel={channel}
                      isCreator={isCreator}
                      isHost={isHost}
                      className="h-full"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* End Stream Confirmation */}
        <AnimatePresence>
          {showEndConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 flex items-center justify-center p-6 z-50"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm"
              >
                <h3 className="text-white text-xl font-bold mb-3">End Stream?</h3>
                <p className="text-gray-400 mb-6">Are you sure you want to end your live stream?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEndConfirm(false)}
                    className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEndStream}
                    className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium"
                  >
                    End Stream
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stream Ended Overlay */}
        <AnimatePresence>
          {showStreamEnded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 flex items-center justify-center p-6 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                className="text-center w-full max-w-md"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="mb-6"
                >
                  <CheckCircleIcon className="w-24 h-24 text-green-500 mx-auto" />
                </motion.div>

                <h1 className="text-white text-3xl font-bold mb-4">Stream Ended</h1>

                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-purple-400">{formatDuration(streamStats.duration)}</div>
                      <div className="text-xs text-gray-400">Duration</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-400">{streamStats.viewers}</div>
                      <div className="text-xs text-gray-400">Viewers</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-400">{streamStats.gifts + streamStats.tips}</div>
                      <div className="text-xs text-gray-400">Gifts & Tips</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-400">{streamStats.messages}</div>
                      <div className="text-xs text-gray-400">Messages</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {isCreator && (
                    <button className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                      <CloudArrowDownIcon className="w-5 h-5" />
                      Save Recording
                    </button>
                  )}
                  <button
                    onClick={() => window.location.href = '/'}
                    className="w-full py-4 bg-white/20 text-white rounded-xl font-bold backdrop-blur-sm"
                  >
                    Return Home
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HybridStreamingLayout;
