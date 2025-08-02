import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';
import {
  ChatBubbleLeftRightIcon,
  GiftIcon,
  ChartBarIcon,
  ShareIcon,
  Squares2X2Icon,
  FilmIcon,
  ViewfinderCircleIcon,
  CheckCircleIcon,
  XMarkIcon,
  CloudArrowDownIcon
} from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';
import VideoCall from './VideoCall';
import LiveChat from './LiveChat';
import VirtualGifts from './VirtualGifts';
import InteractivePolls from './InteractivePolls';
import CreatorSubscriptions from './CreatorSubscriptions';
import EnhancedStreamingOverlay from './EnhancedStreamingOverlay';
import CoHostManager from './CoHostManager';
import StreamParticipantManager from './StreamParticipantManager';
import SaveStreamModal from './SaveStreamModal';
import Button from './ui/Button';
import Card from './ui/Card';
import Tooltip from './ui/Tooltip';
import { getAuthToken } from '../utils/auth-helpers';

const StreamingLayout = ({
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
  const { animations } = useTheme();
  const [activePanel, setActivePanel] = useState('chat');
  const [showGifts, setShowGifts] = useState(false);
  const [showSubscriptions, setShowSubscriptions] = useState(false);
  const [streamStats, setStreamStats] = useState({
    duration: 0,
    viewers: 1,
    messages: 0,
    gifts: 0,
    tips: 0
  });
  const streamStatsRef = useRef(streamStats);
  const durationRef = useRef(0);
  const [streamGoal, setStreamGoal] = useState({
    currentAmount: 3500,
    goalAmount: 10000,
    isVisible: true
  });
  const [activeCoHosts, setActiveCoHosts] = useState([]);
  const [layoutMode, setLayoutMode] = useState(() => {
    return localStorage.getItem('streamLayoutMode') || 'classic';
  });
  const [showStreamEnded, setShowStreamEnded] = useState(false);
  const [showSaveStreamModal, setShowSaveStreamModal] = useState(false);
  const [streamParticipants, setStreamParticipants] = useState([]);
  const [streamRecordingData, setStreamRecordingData] = useState(null);
  const videoCallRef = useRef(null);

  // Save layout preference
  useEffect(() => {
    localStorage.setItem('streamLayoutMode', layoutMode);
  }, [layoutMode]);

  // Update refs when state changes
  useEffect(() => {
    streamStatsRef.current = streamStats;
  }, [streamStats]);

  // Use ref for duration to avoid re-renders every second
  useEffect(() => {
    const interval = setInterval(() => {
      durationRef.current += 1;
      // Only update state every 10 seconds to reduce re-renders
      if (durationRef.current % 10 === 0) {
        setStreamStats(prev => ({
          ...prev,
          duration: durationRef.current
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Mock participants for testing (in production, this would come from Agora events)
  useEffect(() => {
    if (isStreaming && isCreator) {
      // Add some mock participants for testing
      const mockParticipants = [
        { uid: 'user1', name: 'Alice Johnson', role: 'Viewer', joinTime: '2 min ago' },
        { uid: 'user2', name: 'Bob Smith', role: 'Viewer', joinTime: '5 min ago' },
        { uid: 'user3', name: 'Carol Williams', role: 'VIP Viewer', joinTime: '10 min ago' },
      ];
      setStreamParticipants(mockParticipants);
      setStreamStats(prev => ({ ...prev, viewers: mockParticipants.length }));
    }
  }, [isStreaming, isCreator]);

  const handleGiftSent = (giftData) => {
    setStreamStats(prev => ({
      ...prev,
      gifts: prev.gifts + 1
    }));
  };

  const handleTipSent = (tipData) => {
    setStreamStats(prev => ({
      ...prev,
      tips: prev.tips + tipData.amount
    }));

    if (streamGoal.isVisible) {
      setStreamGoal(prev => ({
        ...prev,
        currentAmount: prev.currentAmount + tipData.amount
      }));
    }
  };

  const handleCoHostAccepted = (coHost) => {
    setActiveCoHosts(prev => [...prev, coHost]);
    setStreamStats(prev => ({
      ...prev,
      viewers: prev.viewers + 1
    }));
  };

  const handleCoHostRemoved = (coHost) => {
    setActiveCoHosts(prev => prev.filter(c => c.id !== coHost.id));
    setStreamStats(prev => ({
      ...prev,
      viewers: Math.max(1, prev.viewers - 1)
    }));
  };

  // Handle kick user from stream
  const handleKickUser = async (participant) => {
    try {
      // Here you would call your backend API to kick the user
      // For now, we'll just remove them from the participants list
      setStreamParticipants(prev => prev.filter(p => p.uid !== participant.uid));
      
      // You would also send a signal to disconnect the user from Agora
      // await agoraClient.kickUser(participant.uid);
      
      // toast.success(`${participant.name} has been removed from the stream`);
    } catch (error) {
      console.error('Error kicking user:', error);
      toast.error('Failed to remove user');
    }
  };

  // Handle block user
  const handleBlockUser = async (participant) => {
    try {
      // Here you would call your backend API to block the user
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          blockedUserId: participant.uid,
          reason: 'Blocked during live stream'
        }),
      });

      if (response.ok) {
        // Also kick them from the current stream
        await handleKickUser(participant);
      } else {
        throw new Error('Failed to block user');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
    }
  };

  // Handle save stream
  const handleSaveStream = async (saveData) => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streams/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...saveData,
          channel,
          creatorId: user.id
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // toast.success('Stream saved to your profile!');
        setShowSaveStreamModal(false);
        // Optionally redirect to the saved stream
        // navigate(`/profile/${user.id}/streams/${data.streamId}`);
      } else {
        throw new Error('Failed to save stream');
      }
    } catch (error) {
      console.error('Error saving stream:', error);
      toast.error('Failed to save stream');
    }
  };

  // Handle end stream - show prominent overlay then cleanup
  const handleEndStream = async () => {
    console.log('Ending stream...');
    
    // Show notification to creator that stream is ending
    if (isCreator) {
      // Create a custom notification with stream stats
      toast.custom((t) => (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-gradient-to-r from-purple-600 to-pink-600 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-6`}
        >
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-full">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">Stream Ended Successfully! 🎉</p>
                <p className="text-sm text-white/80">Great job on your stream!</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-xs text-white/70">Duration</p>
                <p className="text-lg font-semibold text-white">{formatDuration(streamStats.duration)}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-xs text-white/70">Viewers</p>
                <p className="text-lg font-semibold text-white">{streamStats.viewers}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-xs text-white/70">Engagement</p>
                <p className="text-lg font-semibold text-white">{streamStats.messages} messages</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-xs text-white/70">Earnings</p>
                <p className="text-lg font-semibold text-white">{streamStats.gifts + streamStats.tips} tokens</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="ml-4 flex-shrink-0 text-white/60 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </motion.div>
      ), {
        duration: 8000,
        position: 'top-center'
      });
    }
    
    // Prepare stream recording data
    const recordingData = {
      title: streamConfig?.title || 'Live Stream',
      description: streamConfig?.description || '',
      duration: formatDuration(streamStats.duration),
      viewerCount: streamStats.viewers,
      totalGifts: streamStats.gifts,
      totalTips: streamStats.tips,
      totalMessages: streamStats.messages,
      startTime: new Date(Date.now() - (streamStats.duration * 1000)).toISOString(),
      endTime: new Date().toISOString(),
      channel: channel,
      // In production, this would include the actual recording URL from Agora Cloud Recording
      recordingUrl: null
    };
    setStreamRecordingData(recordingData);
    
    // Show the stream ended overlay
    setShowStreamEnded(true);
    
    // Don't cleanup immediately - let user save the stream first
  };

  const formatDuration = (seconds) => {
    // Use ref value for real-time duration
    const currentSeconds = durationRef.current || seconds;
    const hours = Math.floor(currentSeconds / 3600);
    const mins = Math.floor((currentSeconds % 3600) / 60);
    const secs = currentSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      alert('Stream link copied to clipboard!');
    }
  };

  const PanelButton = ({ id, icon, label, count = null }) => (
    <Tooltip content={label}>
      <Button
        size="sm"
        variant={activePanel === id ? 'primary' : 'ghost'}
        onClick={() => setActivePanel(id)}
        className="relative"
      >
        {icon}
        <span className="mobile-hidden ml-2">{label}</span>
        {count !== null && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Button>
    </Tooltip>
  );

  // Stream Header Component (reusable across layouts)
  const StreamHeader = () => (
    <Card className="mb-4 p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="font-semibold text-lg">
                {isStreaming ? 'LIVE STREAMING' : isVoiceOnly ? 'VOICE CALL' : 'VIDEO CALL'}
              </span>
            </div>
            
            {(isCreator && isStreaming) ? (
              <div className="flex items-center gap-2">
                <span className="text-neutral-600 dark:text-neutral-400">-</span>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                    {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'C'}
                  </div>
                  <span className="font-medium">{user?.displayName || 'Creator'}</span>
                </div>
              </div>
            ) : targetCreator && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-400 to-secondary-400 flex items-center justify-center text-white font-semibold text-sm">
                  {targetCreator.name?.[0]?.toUpperCase() || 'C'}
                </div>
                <span className="font-medium">{targetCreator.name}</span>
              </div>
            )}
          </div>
          
          {/* Stream Title Display */}
          {streamConfig?.title && isStreaming && (
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-purple-500" />
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                {streamConfig.title}
              </h2>
              {streamConfig.category && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                    {streamConfig.category}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
          {/* Stream Participant Manager - visible for creators */}
          {isCreator && isStreaming && (
            <StreamParticipantManager
              user={user}
              channel={channel}
              participants={streamParticipants}
              isCreator={isCreator}
              onKickUser={handleKickUser}
              onBlockUser={handleBlockUser}
            />
          )}
          
          {/* Prominent Chat Button - visible in theater and focus modes */}
          {(layoutMode === 'theater' || layoutMode === 'focus') && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (layoutMode === 'focus') {
                  setLayoutMode('classic');
                }
                setActivePanel('chat');
              }}
              icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />}
              className="relative animate-pulse-subtle"
            >
              <span className="mobile-hidden">Open Chat</span>
              {streamStats.messages > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center">
                  {streamStats.messages > 99 ? '99+' : streamStats.messages}
                </span>
              )}
            </Button>
          )}
          
          <Button
            size="xs"
            variant="ghost"
            onClick={shareStream}
            icon={<ShareIcon className="w-4 h-4" />}
          >
            <span className="mobile-hidden">Share</span>
          </Button>
          
          {/* Layout Switcher */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
            <Tooltip content="Classic Layout">
              <button
                onClick={() => setLayoutMode('classic')}
                className={`p-1.5 rounded transition-colors ${
                  layoutMode === 'classic' 
                    ? 'bg-white dark:bg-neutral-700 shadow-sm' 
                    : 'hover:bg-white/50 dark:hover:bg-neutral-700/50'
                }`}
              >
                <Squares2X2Icon className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="Theater Mode">
              <button
                onClick={() => setLayoutMode('theater')}
                className={`p-1.5 rounded transition-colors ${
                  layoutMode === 'theater' 
                    ? 'bg-white dark:bg-neutral-700 shadow-sm' 
                    : 'hover:bg-white/50 dark:hover:bg-neutral-700/50'
                }`}
              >
                <FilmIcon className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="Focus Mode">
              <button
                onClick={() => setLayoutMode('focus')}
                className={`p-1.5 rounded transition-colors ${
                  layoutMode === 'focus' 
                    ? 'bg-white dark:bg-neutral-700 shadow-sm' 
                    : 'hover:bg-white/50 dark:hover:bg-neutral-700/50'
                }`}
              >
                <ViewfinderCircleIcon className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </Card>
  );

  // Video Component (reusable)
  const VideoSection = () => (
    <div className="relative h-full bg-black rounded-xl overflow-hidden">
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
        activeCoHosts={activeCoHosts}
        useMultiVideoGrid={isStreaming && activeCoHosts.length > 0}
        className="absolute inset-0 z-10"
      />
      
      {isStreaming && (
        <>
          <EnhancedStreamingOverlay
            user={user}
            isCreator={isCreator}
            streamStats={streamStats}
            streamGoal={streamGoal}
            onGoalUpdate={(newAmount) => setStreamGoal(prev => ({ ...prev, currentAmount: newAmount }))}
            onEndStream={handleEndStream}
            className="absolute inset-0 z-20 pointer-events-none"
          />
          
          <CoHostManager
            user={user}
            isCreator={isCreator}
            channel={channel}
            isStreaming={isStreaming}
            onCoHostAccepted={handleCoHostAccepted}
            onCoHostRemoved={handleCoHostRemoved}
            maxCoHosts={3}
            className="absolute top-20 right-4 z-40"
          />
        </>
      )}
      
      {/* Floating Chat Button - visible in theater and focus modes */}
      {(layoutMode === 'theater' || layoutMode === 'focus') && !isCreator && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bottom-4 right-4 z-50"
        >
          <Button
            size="lg"
            variant="primary"
            onClick={() => {
              if (layoutMode === 'focus') {
                setLayoutMode('classic');
              }
              setActivePanel('chat');
            }}
            icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />}
            className="relative shadow-2xl hover:shadow-3xl transition-all duration-300 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <span className="font-semibold">Chat</span>
            {streamStats.messages > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[24px] h-6 flex items-center justify-center font-bold animate-bounce">
                {streamStats.messages > 99 ? '99+' : streamStats.messages}
              </span>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );

  // Side Panel Component
  const SidePanel = ({ className: panelClassName = '' }) => (
    <div className={`flex flex-col ${panelClassName}`}>
      {/* Panel Tabs */}
      <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 mb-4">
        <PanelButton
          id="chat"
          icon={<ChatBubbleLeftRightIcon className="w-4 h-4" />}
          label="Chat"
          count={streamStats.messages}
        />
        <PanelButton
          id="polls"
          icon={<ChartBarIcon className="w-4 h-4" />}
          label="Polls"
        />
        {!isCreator && !isHost && (
          <PanelButton
            id="gifts"
            icon={<GiftIcon className="w-4 h-4" />}
            label="Gifts"
          />
        )}
      </div>

      {/* Panel Content */}
      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {activePanel === 'chat' && (
            <motion.div
              key="chat"
              initial={animations ? { opacity: 0, x: 20 } : {}}
              animate={animations ? { opacity: 1, x: 0 } : {}}
              exit={animations ? { opacity: 0, x: -20 } : {}}
              className="h-full"
            >
              <LiveChat
                user={user}
                channel={channel}
                isCreator={isCreator}
                isHost={isHost}
                onSendGift={handleGiftSent}
                onSendTip={handleTipSent}
                className="h-full"
              />
            </motion.div>
          )}

          {activePanel === 'polls' && (
            <motion.div
              key="polls"
              initial={animations ? { opacity: 0, x: 20 } : {}}
              animate={animations ? { opacity: 1, x: 0 } : {}}
              exit={animations ? { opacity: 0, x: -20 } : {}}
              className="h-full"
            >
              <InteractivePolls
                user={user}
                channel={channel}
                isCreator={isCreator}
                isHost={isHost}
                className="h-full"
              />
            </motion.div>
          )}

          {activePanel === 'gifts' && (
            <motion.div
              key="gifts"
              initial={animations ? { opacity: 0, x: 20 } : {}}
              animate={animations ? { opacity: 1, x: 0 } : {}}
              exit={animations ? { opacity: 0, x: -20 } : {}}
              className="h-full"
            >
              <Card className="h-full p-4">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <GiftIcon className="w-5 h-5 text-primary-500" />
                  Send Gifts & Tips
                </h3>
                
                <Button
                  onClick={() => setShowGifts(true)}
                  fullWidth
                  icon={<GiftIcon className="w-4 h-4" />}
                >
                  Open Gift Menu
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  // Layout: Focus Mode (Video only)
  if (layoutMode === 'focus') {
    return (
      <div className={`flex flex-col h-screen relative isolate ${className}`}>
        <div className="flex-1 p-4 min-h-0">
          <VideoSection />
        </div>
      </div>
    );
  }

  // Layout: Theater Mode (Video on top, chat below)
  if (layoutMode === 'theater') {
    return (
      <div className={`flex flex-col h-screen relative isolate ${className}`}>
        <div className="flex-1 flex flex-col gap-4 p-4 min-h-0">
          {/* Video takes more space */}
          <div className="flex-[3] min-h-0">
            <VideoSection />
          </div>
          
          {/* Chat takes less space */}
          <div className="flex-1 min-h-0">
            <SidePanel className="h-full" />
          </div>
        </div>
      </div>
    );
  }

  // Layout: Classic Mode (Side by side - default)
  return (
    <div className={`flex flex-col h-screen relative isolate ${className}`}>
      {/* Background layer */}
      <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 -z-10" aria-hidden="true" />
      
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">
        {/* Video Area */}
        <div className="flex-1 min-h-0 relative">
          <VideoSection />
        </div>

        {/* Side Panel */}
        <div className="w-full lg:w-96 min-h-0" style={{ height: '110%' }}>
          <SidePanel className="h-full" />
        </div>
      </div>

      {/* Modals */}
      <VirtualGifts
        user={user}
        channel={channel}
        isOpen={showGifts}
        onClose={() => setShowGifts(false)}
        onSendGift={handleGiftSent}
        onSendTip={handleTipSent}
        targetCreator={targetCreator}
      />

      <CreatorSubscriptions
        user={user}
        creator={targetCreator}
        isOpen={showSubscriptions}
        onClose={() => setShowSubscriptions(false)}
        onSubscribe={(subscription) => {
          console.log('Subscribed:', subscription);
        }}
      />

      {/* Stream Ended Overlay */}
      <AnimatePresence>
        {showStreamEnded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="text-center max-w-2xl mx-auto p-8"
            >

              {/* Main Content */}
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative z-10"
              >
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.3 }}
                  className="mb-8 inline-flex"
                >
                  <div className="relative">
                    <CheckCircleIcon className="w-32 h-32 text-purple-500" />
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0"
                    >
                      <SparklesIcon className="w-8 h-8 text-yellow-400 absolute -top-2 -right-2" />
                    </motion.div>
                  </div>
                </motion.div>

                {/* Title */}
                <motion.h1
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-6xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"
                >
                  Stream Ended
                </motion.h1>

                {/* Stats */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8"
                >
                  <h3 className="text-xl font-semibold text-white mb-4">Stream Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-400">{formatDuration(streamStats.duration)}</div>
                      <div className="text-sm text-gray-400">Duration</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-400">{streamStats.viewers}</div>
                      <div className="text-sm text-gray-400">Viewers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-400">{streamStats.gifts + streamStats.tips}</div>
                      <div className="text-sm text-gray-400">Gifts & Tips</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-400">{streamStats.messages}</div>
                      <div className="text-sm text-gray-400">Messages</div>
                    </div>
                  </div>
                </motion.div>

                {/* Thank You Message */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-xl text-gray-300 mb-8"
                >
                  Thank you for an amazing stream! See you next time! 🎉
                </motion.p>

                {/* Action Buttons - Each on own row */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="flex flex-col gap-4 w-full max-w-md mx-auto"
                >
                  {isCreator && (
                    <>
                      {/* Save Stream Button */}
                      <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 1, repeat: Infinity, repeatDelay: 1 }}
                      >
                        <Button
                          size="lg"
                          variant="primary"
                          onClick={() => {
                            setShowStreamEnded(false);
                            setShowSaveStreamModal(true);
                          }}
                          icon={<CloudArrowDownIcon className="w-5 h-5" />}
                          className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 font-bold shadow-xl"
                        >
                          Save Stream Recording
                        </Button>
                      </motion.div>
                      
                      {/* View Analytics Button */}
                      <Button
                        size="lg"
                        onClick={() => window.location.href = '/dashboard'}
                        icon={<ChartBarIcon className="w-5 h-5" />}
                        className="w-full px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm font-bold"
                      >
                        View Analytics
                      </Button>
                    </>
                  )}
                  
                  {/* Return to Home Button */}
                  <Button
                    size="lg"
                    onClick={() => window.location.href = '/'}
                    className="w-full px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm font-bold"
                  >
                    Return to Home
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Stream Modal */}
      <SaveStreamModal
        isOpen={showSaveStreamModal}
        onClose={() => setShowSaveStreamModal(false)}
        streamData={streamRecordingData}
        onSave={handleSaveStream}
        user={user}
      />
    </div>
  );
};

export default StreamingLayout;