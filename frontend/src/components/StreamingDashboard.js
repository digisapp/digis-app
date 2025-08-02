import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import {
  UserGroupIcon,
  ChartBarIcon,
  GiftIcon,
  SparklesIcon,
  Squares2X2Icon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ShareIcon,
  FireIcon,
  XMarkIcon,
  CloudArrowDownIcon
} from '@heroicons/react/24/outline';
import {
  HeartIcon,
  StarIcon,
  TrophyIcon,
  CheckCircleIcon
} from '@heroicons/react/24/solid';
import VideoCall from './VideoCall';
import EnhancedStreamChat from './EnhancedStreamChat';
import StreamActivityFeed from './StreamActivityFeed';
import StreamAnalytics from './StreamAnalytics';
import StreamControlBar from './StreamControlBar';
import StreamInfoBar from './StreamInfoBar';
import EnhancedStreamingOverlay from './EnhancedStreamingOverlay';
import CoHostManager from './CoHostManager';
import PrivateStreamRequest from './PrivateStreamRequest';
import StreamGoalEditor from './StreamGoalEditor';
import EnhancedMultiVideoGrid from './EnhancedMultiVideoGrid';
import SaveStreamModal from './SaveStreamModal';
import Button from './ui/Button';
import Card from './ui/Card';
import toast from 'react-hot-toast';
import { useViewerCount, useStreamAnalytics, useSocket } from '../hooks/useSocket';
import { getAuthToken } from '../utils/auth-helpers';

const StreamingDashboard = ({
  user,
  channel,
  token,
  chatToken,
  uid,
  isCreator = true,
  onSessionEnd,
  onTokenDeduction,
  onNavigate,
  targetCreator = null,
  streamConfig = null,
  className = ''
}) => {
  const { animations } = useTheme();
  const [layoutMode, setLayoutMode] = useState(() => {
    return localStorage.getItem('streamLayoutMode') || 'professional';
  });
  const [theaterMode, setTheaterMode] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showActivityFeed, setShowActivityFeed] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [pinnedPanels, setPinnedPanels] = useState(['chat']);
  const [streamTitle, setStreamTitle] = useState(streamConfig?.title || '🔴 Live with ' + (user?.displayName || 'Creator'));
  const [streamCategory, setStreamCategory] = useState(streamConfig?.category || 'Just Chatting');
  const [viewerCount, setViewerCount] = useState(0);
  const [streamDuration, setStreamDuration] = useState(0);
  const [streamStats, setStreamStats] = useState({
    viewers: 1,
    peakViewers: 1,
    messages: 0,
    newFollowers: 0,
    revenue: 0,
    engagement: 0,
    gifts: 0,
    tips: 0,
    duration: 0
  });
  const [streamGoal, setStreamGoal] = useState(() => {
    if (streamConfig?.streamGoal) {
      const level1 = streamConfig.streamGoal.level1 || { amount: 5000, description: 'Level 1 Goal' };
      return {
        currentAmount: 0,
        currentLevel: 1,
        level1,
        level2: streamConfig.streamGoal.level2 || { amount: 10000, description: 'Level 2 Goal' },
        level3: streamConfig.streamGoal.level3 || { amount: 25000, description: 'Level 3 Goal' },
        goalAmount: level1.amount,
        description: level1.description,
        isVisible: true,
        celebrated: false
      };
    }
    return {
      currentAmount: 0,
      currentLevel: 1,
      level1: { amount: 5000, description: 'Level 1 Goal' },
      level2: { amount: 10000, description: 'Level 2 Goal' },
      level3: { amount: 25000, description: 'Level 3 Goal' },
      goalAmount: 5000,
      description: 'Level 1 Goal',
      isVisible: true,
      celebrated: false
    };
  });
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState({
    goals: true,
    alerts: true,
    events: true,
    polls: false,
    widgets: true
  });
  const [quickActions, setQuickActions] = useState({
    polls: [],
    hypeTrain: null,
    spotlightViewer: null
  });
  const [customLayouts, setCustomLayouts] = useState(() => {
    const saved = localStorage.getItem('streamCustomLayouts');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentLayout, setCurrentLayout] = useState(0);
  const [activeCoHosts, setActiveCoHosts] = useState([]);
  const [streamQuality, setStreamQuality] = useState('1080p60');
  const [isRecording, setIsRecording] = useState(false);
  const [backgroundEffects, setBackgroundEffects] = useState({
    blur: false,
    virtualBg: null,
    filter: null
  });
  const [isStreamEnding, setIsStreamEnding] = useState(false);
  const [useMultiGuest, setUseMultiGuest] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [localTracks, setLocalTracks] = useState({ videoTrack: null, audioTrack: null });
  const [showSaveStreamModal, setShowSaveStreamModal] = useState(false);
  const [streamRecordingData, setStreamRecordingData] = useState(null);
  
  const videoCallRef = useRef(null);
  const durationRef = useRef(0);
  const analyticsRef = useRef(null);
  const streamStatsRef = useRef(streamStats);
  
  // Generate unique stream ID
  const streamId = useRef(`stream_${user?.uid}_${Date.now()}`).current;
  const { updateAnalytics } = useSocket();

  // Save layout preferences
  useEffect(() => {
    localStorage.setItem('streamLayoutMode', layoutMode);
  }, [layoutMode]);

  // Update stream duration
  useEffect(() => {
    const interval = setInterval(() => {
      durationRef.current += 1;
      if (durationRef.current % 10 === 0) {
        setStreamDuration(durationRef.current);
        setStreamStats(prev => ({ ...prev, duration: durationRef.current }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Use real-time viewer count from Socket.io
  useViewerCount(streamId, (count) => {
    setViewerCount(count);
    setStreamStats(stats => ({
      ...stats,
      viewers: count,
      peakViewers: Math.max(stats.peakViewers, count)
    }));
  });
  
  // Use real-time stream analytics
  useStreamAnalytics(streamId, (analytics) => {
    setStreamStats(prev => ({
      ...prev,
      ...analytics
    }));
  });
  
  // Send analytics updates periodically
  useEffect(() => {
    const interval = setInterval(() => {
      updateAnalytics({
        streamId,
        viewers: streamStats.viewers,
        duration: durationRef.current,
        revenue: streamStats.revenue,
        messages: streamStats.messages,
        gifts: streamStats.gifts,
        tips: streamStats.tips
      });
    }, 10000); // Update every 10 seconds
    
    return () => clearInterval(interval);
  }, [streamId, streamStats, updateAnalytics]);

  // Define callback functions before they're used
  const handleCreateClip = useCallback(() => {
    // toast.success('📹 Clip created! (30 seconds)', {
    //   duration: 3000,
    //   icon: '🎬'
    // });
  }, []);

  const handleToggleRecording = useCallback(() => {
    setIsRecording(prev => !prev);
    // toast.success(isRecording ? '⏹️ Recording stopped' : '🔴 Recording started', {
    //   duration: 2000
    // });
  }, [isRecording]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'm':
            e.preventDefault();
            // Toggle mic
            break;
          case 'v':
            e.preventDefault();
            // Toggle video
            break;
          case 't':
            e.preventDefault();
            setTheaterMode(prev => !prev);
            break;
          case 'c':
            e.preventDefault();
            handleCreateClip();
            break;
          case 'r':
            e.preventDefault();
            handleToggleRecording();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleCreateClip, handleToggleRecording]);

  const handleRaid = useCallback((targetChannel) => {
    console.log('Raiding channel:', targetChannel);
    // toast.success(`🚀 Raiding ${targetChannel} with ${viewerCount} viewers!`, {
    //   duration: 5000
    // });
  }, [viewerCount]);

  const handleLayoutSave = useCallback(() => {
    const newLayout = {
      id: Date.now(),
      name: `Layout ${customLayouts.length + 1}`,
      config: {
        showAnalytics,
        showActivityFeed,
        showChat,
        pinnedPanels,
        activeOverlays,
        layoutMode
      }
    };
    
    const updated = [...customLayouts, newLayout];
    setCustomLayouts(updated);
    localStorage.setItem('streamCustomLayouts', JSON.stringify(updated));
    // toast.success('💾 Layout saved!', { duration: 2000 });
  }, [customLayouts, showAnalytics, showActivityFeed, showChat, pinnedPanels, activeOverlays, layoutMode]);

  const handleLayoutLoad = useCallback((layout) => {
    setShowAnalytics(layout.config.showAnalytics);
    setShowActivityFeed(layout.config.showActivityFeed);
    setShowChat(layout.config.showChat);
    setPinnedPanels(layout.config.pinnedPanels);
    setActiveOverlays(layout.config.activeOverlays);
    setLayoutMode(layout.config.layoutMode || 'professional');
    // toast.success('✨ Layout loaded!', { duration: 2000 });
  }, []);

  const handleCoHostAccepted = useCallback((coHost) => {
    setActiveCoHosts(prev => [...prev, coHost]);
    setStreamStats(prev => ({
      ...prev,
      viewers: prev.viewers + 1
    }));
    // Enable multi-guest mode when we have co-hosts
    if (!useMultiGuest && activeCoHosts.length === 0) {
      setUseMultiGuest(true);
    }
    // toast.success(`🎉 ${coHost.name} joined as co-host!`, { duration: 3000 });
  }, [activeCoHosts.length, useMultiGuest]);

  const handleCoHostRemoved = useCallback((coHost) => {
    setActiveCoHosts(prev => prev.filter(c => c.id !== coHost.id));
    setStreamStats(prev => ({
      ...prev,
      viewers: Math.max(1, prev.viewers - 1)
    }));
    // Disable multi-guest mode if no more co-hosts
    if (activeCoHosts.length === 1) {
      setUseMultiGuest(false);
    }
  }, [activeCoHosts.length]);

  // Multi-guest handlers
  const handleKickUser = useCallback((user) => {
    // Remove user from remote users
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.id));
    // toast.success(`${user.displayName} has been removed from the stream`);
  }, []);

  const handleMuteUser = useCallback((user) => {
    // Mute user's audio track
    if (user.audioTrack) {
      user.audioTrack.setEnabled(false);
    }
    // toast.success(`${user.displayName} has been muted`);
  }, []);

  const handleJoinRequest = useCallback((request, accept) => {
    if (accept) {
      // Add to remote users
      setRemoteUsers(prev => [...prev, request]);
      setJoinRequests(prev => prev.filter(r => r.uid !== request.uid));
      // toast.success(`${request.displayName} joined the stream!`);
    } else {
      setJoinRequests(prev => prev.filter(r => r.uid !== request.uid));
      toast.info(`Join request from ${request.displayName} declined`);
    }
  }, []);

  const handlePrivateStreamAccept = useCallback((request) => {
    // Handle private stream acceptance
    toast.custom((t) => (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <FireIcon className="w-8 h-8" />
          <div>
            <p className="font-bold">Private Stream Active!</p>
            <p className="text-sm opacity-90">Now streaming privately with {request.name}</p>
            <p className="text-xs opacity-80 mt-1">They can see and chat with you</p>
          </div>
        </div>
      </motion.div>
    ), { duration: 8000 });

    // Update stats
    setStreamStats(prev => ({
      ...prev,
      revenue: prev.revenue + request.price
    }));
  }, []);

  const handlePrivateStreamReject = useCallback((request) => {
    console.log('Private stream rejected:', request);
  }, []);

  const handleGiftReceived = useCallback((giftData) => {
    setStreamStats(prev => ({
      ...prev,
      gifts: prev.gifts + 1,
      revenue: prev.revenue + giftData.value
    }));
    
    // Also update goal progress for gifts
    if (streamGoal.isVisible && giftData.value) {
      setStreamGoal(prev => {
        const newAmount = Math.min(prev.goalAmount, prev.currentAmount + giftData.value);
        const wasNotReached = prev.currentAmount < prev.goalAmount;
        const isNowReached = newAmount >= prev.goalAmount;
        
        // Check if goal was just reached
        if (wasNotReached && isNowReached && !prev.celebrated) {
          // Trigger celebration
          setTimeout(() => {
            // toast.success(`🎉 LEVEL ${prev.currentLevel} GOAL REACHED! ${prev.goalAmount.toLocaleString()} tokens!`, {
            //   duration: 6000,
            //   style: {
            //     background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            //     color: 'white',
            //     fontWeight: 'bold',
            //     fontSize: '1.2rem',
            //     padding: '16px'
            //   }
            // });
            
            // Auto-progress to next level after celebration
            if (prev.currentLevel < 3) {
              setTimeout(() => {
                setStreamGoal(current => {
                  const nextLevel = current.currentLevel + 1;
                  const nextLevelKey = `level${nextLevel}`;
                  return {
                    ...current,
                    currentLevel: nextLevel,
                    goalAmount: current[nextLevelKey].amount,
                    description: current[nextLevelKey].description,
                    celebrated: false
                  };
                });
                // toast.success(`🚀 Level ${prev.currentLevel + 1} Goal Started!`, {
                //   duration: 3000,
                //   style: {
                //     background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                //     color: 'white',
                //     fontWeight: 'bold'
                //   }
                // });
              }, 3000);
            }
          }, 100);
          
          return {
            ...prev,
            currentAmount: newAmount,
            celebrated: true
          };
        }
        
        return {
          ...prev,
          currentAmount: newAmount
        };
      });
    }
  }, [streamGoal]);

  const handleTipReceived = useCallback((tipData) => {
    setStreamStats(prev => ({
      ...prev,
      tips: prev.tips + tipData.amount,
      revenue: prev.revenue + tipData.amount
    }));
    
    if (streamGoal.isVisible) {
      setStreamGoal(prev => {
        const newAmount = Math.min(prev.goalAmount, prev.currentAmount + tipData.amount);
        const wasNotReached = prev.currentAmount < prev.goalAmount;
        const isNowReached = newAmount >= prev.goalAmount;
        
        // Check if goal was just reached
        if (wasNotReached && isNowReached && !prev.celebrated) {
          // Trigger celebration
          setTimeout(() => {
            // toast.success(`🎉 LEVEL ${prev.currentLevel} GOAL REACHED! ${prev.goalAmount.toLocaleString()} tokens!`, {
            //   duration: 6000,
            //   style: {
            //     background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            //     color: 'white',
            //     fontWeight: 'bold',
            //     fontSize: '1.2rem',
            //     padding: '16px'
            //   }
            // });
            
            // Auto-progress to next level after celebration
            if (prev.currentLevel < 3) {
              setTimeout(() => {
                setStreamGoal(current => {
                  const nextLevel = current.currentLevel + 1;
                  const nextLevelKey = `level${nextLevel}`;
                  return {
                    ...current,
                    currentLevel: nextLevel,
                    goalAmount: current[nextLevelKey].amount,
                    description: current[nextLevelKey].description,
                    celebrated: false
                  };
                });
                // toast.success(`🚀 Level ${prev.currentLevel + 1} Goal Started!`, {
                //   duration: 3000,
                //   style: {
                //     background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                //     color: 'white',
                //     fontWeight: 'bold'
                //   }
                // });
              }, 3000);
            }
          }, 100);
          
          return {
            ...prev,
            currentAmount: newAmount,
            celebrated: true
          };
        }
        
        return {
          ...prev,
          currentAmount: newAmount
        };
      });
    }
  }, [streamGoal]);

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndStream = useCallback(async () => {
    // No confirmation - end immediately
    setIsStreamEnding(true);
    
    // Create stream summary
    const summary = {
      duration: formatDuration(durationRef.current),
      viewers: streamStats.viewers,
      peakViewers: streamStats.peakViewers,
      messages: streamStats.messages,
      revenue: streamStats.revenue,
      gifts: streamStats.gifts,
      tips: streamStats.tips
    };

    // Show summary toast with buttons
    toast.custom((t) => (
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-lg w-full bg-gradient-to-r from-purple-600 to-pink-600 shadow-2xl rounded-2xl pointer-events-auto flex flex-col ring-1 ring-black ring-opacity-5 p-6`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-8 h-8 text-white" />
            <div>
              <p className="text-lg font-bold text-white">Stream Ended Successfully!</p>
            </div>
          </div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="text-white/60 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs text-white/70">Duration</p>
            <p className="text-lg font-semibold text-white">{summary.duration}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs text-white/70">Peak Viewers</p>
            <p className="text-lg font-semibold text-white">{summary.peakViewers}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs text-white/70">Messages</p>
            <p className="text-lg font-semibold text-white">{summary.messages}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="text-xs text-white/70">Earnings</p>
            <p className="text-lg font-semibold text-white">{summary.revenue} tokens</p>
          </div>
        </div>
        
        {/* Action Buttons - Each on own row */}
        <div className="flex flex-col gap-3">
          {/* Save Stream Button */}
          <motion.button
            initial={{ scale: 0.95 }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ 
              duration: 1,
              repeat: Infinity,
              repeatDelay: 2
            }}
            onClick={() => {
              toast.dismiss(t.id);
              // Show save stream modal
              setShowSaveStreamModal(true);
            }}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-xl flex items-center justify-center gap-3 text-lg"
          >
            <CloudArrowDownIcon className="w-6 h-6" />
            Save Stream Recording
          </motion.button>
          
          {/* Analytics Button */}
          <button
            onClick={() => {
              toast.dismiss(t.id);
              // Show analytics on the same page
              setShowAnalytics(true);
              // Scroll to analytics section
              if (analyticsRef.current) {
                analyticsRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-xl flex items-center justify-center gap-3 text-lg"
          >
            <ChartBarIcon className="w-6 h-6" />
            View Analytics
          </button>
          
          {/* Dashboard Button */}
          <button
            onClick={() => {
              toast.dismiss(t.id);
              // Navigate to dashboard
              if (onNavigate) {
                onNavigate('dashboard');
              }
            }}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-xl flex items-center justify-center gap-3 text-lg"
          >
            Go to Dashboard
          </button>
        </div>
      </motion.div>
    ), {
      duration: Infinity, // Don't auto-dismiss
      position: 'top-center'
    });

    // Clean up video call but don't call onSessionEnd yet
    setTimeout(() => {
      if (videoCallRef.current?.cleanup) {
        videoCallRef.current.cleanup();
      }
      // Don't call onSessionEnd here - only when navigating away
    }, 1000);
  }, [streamStats, onSessionEnd]);

  // Handle save stream
  const handleSaveStream = async (saveData) => {
    try {
      // Prepare stream recording data
      const recordingData = {
        title: streamTitle,
        description: streamConfig?.description || '',
        duration: formatDuration(durationRef.current),
        viewerCount: streamStats.viewers,
        totalGifts: streamStats.gifts,
        totalTips: streamStats.tips,
        totalMessages: streamStats.messages,
        startTime: new Date(Date.now() - (durationRef.current * 1000)).toISOString(),
        endTime: new Date().toISOString(),
        channel: channel,
        recordingUrl: null // In production, this would include the actual recording URL
      };
      
      setStreamRecordingData(recordingData);
      
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/streams/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...saveData,
          ...recordingData,
          channel,
          creatorId: user.id
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // toast.success('Stream saved to your profile!');
        setShowSaveStreamModal(false);
      } else {
        throw new Error('Failed to save stream');
      }
    } catch (error) {
      console.error('Error saving stream:', error);
      toast.error('Failed to save stream');
    }
  };

  const getLayoutClasses = () => {
    if (theaterMode) {
      return 'grid-cols-1';
    }
    
    switch (layoutMode) {
      case 'focus':
        return 'grid-cols-1';
      case 'balanced':
        return 'grid-cols-12';
      case 'professional':
      default:
        return 'grid-cols-12';
    }
  };


  return (
    <div className={`h-screen flex flex-col relative isolate ${className}`}>
      {/* Background layer */}
      <div className="absolute inset-0 bg-gray-950 -z-10" aria-hidden="true" />
      
      {/* Stream Info Bar */}
      <StreamInfoBar
        streamTitle={streamTitle}
        streamCategory={streamCategory}
        viewerCount={viewerCount}
        duration={durationRef.current}
        onTitleChange={setStreamTitle}
        onCategoryChange={setStreamCategory}
        onShare={() => {
          navigator.clipboard.writeText(window.location.href);
          // toast.success('📋 Stream link copied!', { duration: 2000 });
        }}
        user={user}
        isRecording={isRecording}
        isStreamEnding={isStreamEnding}
        streamStats={streamStats}
        className="z-50"
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className={`h-full grid ${getLayoutClasses()} gap-4 p-4`}>
          {/* Video Player Section */}
          <motion.div
            layout
            className={`relative ${
              theaterMode ? 'col-span-1' : 
              layoutMode === 'focus' ? 'col-span-1' : 
              'col-span-9'
            }`}
          >
            <Card className="h-full p-0 relative bg-gray-900">
              {/* Video container with overflow hidden */}
              <div className="absolute inset-0 overflow-hidden">
                {/* Conditionally render multi-guest or regular video */}
                {useMultiGuest ? (
                  <EnhancedMultiVideoGrid
                    localUser={{
                      uid: uid,
                      displayName: user?.displayName || 'Host',
                      hasVideo: true,
                      hasAudio: true
                    }}
                    remoteUsers={[...activeCoHosts, ...remoteUsers]}
                    localTracks={localTracks}
                    isHost={true}
                    isStreaming={true}
                    maxParticipants={9}
                    onKickUser={handleKickUser}
                    onMuteUser={handleMuteUser}
                    onRequestToJoin={handleJoinRequest}
                    joinRequests={joinRequests}
                    className="absolute inset-0 z-10"
                  />
                ) : (
                  <VideoCall
                    ref={videoCallRef}
                    channel={channel}
                    token={token}
                    uid={uid}
                    isHost={true}
                    isStreaming={true}
                    onSessionEnd={onSessionEnd}
                    onTokenDeduction={onTokenDeduction}
                    user={user}
                    activeCoHosts={activeCoHosts}
                    useMultiVideoGrid={activeCoHosts.length > 0}
                    className="absolute inset-0 z-10"
                    onLocalTracksCreated={(tracks) => setLocalTracks(tracks)}
                  />
                )}
              </div>

              {/* Enhanced Streaming Overlay */}
              <EnhancedStreamingOverlay
                user={user}
                isCreator={isCreator}
                streamStats={streamStats}
                streamGoal={streamGoal}
                onGoalUpdate={(newAmount) => setStreamGoal(prev => ({ ...prev, currentAmount: newAmount }))}
                onGoalEdit={() => setShowGoalEditor(true)}
                onEndStream={handleEndStream}
                isStreamEnding={isStreamEnding}
                className="absolute inset-0 z-20 pointer-events-none"
              />

              {/* Co-Host Manager - Bottom Left above control bar */}
              <CoHostManager
                user={user}
                isCreator={isCreator}
                channel={channel}
                isStreaming={true}
                onCoHostAccepted={handleCoHostAccepted}
                onCoHostRemoved={handleCoHostRemoved}
                maxCoHosts={3}
                className="absolute bottom-20 left-4 z-40"
              />

              {/* Private Stream Requests - Top Right */}
              <PrivateStreamRequest
                user={user}
                streamConfig={streamConfig}
                onAcceptRequest={handlePrivateStreamAccept}
                onRejectRequest={handlePrivateStreamReject}
                className="absolute top-16 right-4 z-40"
              />

              {/* Theater Mode Toggle */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setTheaterMode(!theaterMode)}
                className="absolute top-4 right-4 p-2 bg-black/60 backdrop-blur-sm rounded-lg hover:bg-black/80 transition-colors z-40"
              >
                {theaterMode ? (
                  <ArrowsPointingInIcon className="w-5 h-5 text-white" />
                ) : (
                  <ArrowsPointingOutIcon className="w-5 h-5 text-white" />
                )}
              </motion.button>

              {/* Recording Indicator */}
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute top-4 left-4 bg-red-600 text-white px-4 py-1 rounded-full flex items-center gap-2 shadow-lg z-40"
                >
                  <motion.div
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-2 h-2 bg-white rounded-full"
                  />
                  <span className="text-sm font-semibold">REC</span>
                </motion.div>
              )}
            </Card>
          </motion.div>

          {/* Side Panels */}
          {!theaterMode && layoutMode !== 'focus' && (
            <div className={`${layoutMode === 'focus' ? 'hidden' : 'col-span-3'} flex flex-col gap-3 overflow-hidden`}>
              {/* Chat Panel */}
              {showChat && (
                <motion.div
                  layout
                  className={`${showActivityFeed ? 'h-[483px]' : 'flex-1'}`}
                >
                  <EnhancedStreamChat
                    user={user}
                    channel={channel}
                    isCreator={isCreator}
                    onMessageSent={(msg) => setStreamStats(prev => ({ ...prev, messages: prev.messages + 1 }))}
                    onGiftSent={handleGiftReceived}
                    onTipSent={handleTipReceived}
                    className="h-full"
                  />
                </motion.div>
              )}

              {/* Activity Feed - Always show below chat when both are enabled */}
              {showActivityFeed && (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="h-[483px]"
                >
                  <StreamActivityFeed
                    events={[
                      { type: 'follow', user: 'NewFan123', time: Date.now() - 30000 },
                      { type: 'gift', user: 'Supporter456', gift: '💎', value: 100, time: Date.now() - 60000 },
                      { type: 'tip', user: 'BigFan789', amount: 50, message: 'Great stream!', time: Date.now() - 90000 }
                    ]}
                    className="h-full"
                  />
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Analytics Drawer - Positioned just above bottom navigation */}
      <AnimatePresence>
        {showAnalytics && !theaterMode && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-20 left-4 right-[calc(25%+1rem)] z-30"
          >
            <StreamAnalytics
              ref={analyticsRef}
              streamStats={streamStats}
              viewerData={{
                current: viewerCount,
                peak: streamStats.peakViewers,
                average: Math.floor((viewerCount + streamStats.peakViewers) / 2)
              }}
              revenueData={{
                total: streamStats.revenue,
                gifts: streamStats.gifts,
                tips: streamStats.tips
              }}
              className="backdrop-blur-xl bg-gradient-to-b from-gray-900/95 to-gray-950/95 rounded-xl shadow-2xl border border-gray-800/50"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stream Control Bar */}
      <StreamControlBar
        isStreaming={true}
        onEndStream={handleEndStream}
        onToggleAnalytics={() => setShowAnalytics(!showAnalytics)}
        onToggleChat={() => setShowChat(!showChat)}
        onToggleActivityFeed={() => setShowActivityFeed(!showActivityFeed)}
        onLayoutChange={setLayoutMode}
        onRaid={handleRaid}
        onClip={handleCreateClip}
        onLayoutSave={handleLayoutSave}
        customLayouts={customLayouts}
        onLayoutLoad={handleLayoutLoad}
        onToggleRecording={handleToggleRecording}
        isRecording={isRecording}
        isStreamEnding={isStreamEnding}
        onToggleMultiGuest={() => {
          setUseMultiGuest(!useMultiGuest);
          // toast.success(useMultiGuest ? 'Multi-guest mode disabled' : 'Multi-guest mode enabled! Up to 9 participants can join', {
          //   duration: 3000,
          //   icon: useMultiGuest ? '👤' : '👥'
          // });
        }}
        isMultiGuest={useMultiGuest}
        className="z-50"
      />

      {/* Floating Chat for Theater Mode */}
      <AnimatePresence>
        {theaterMode && showChat && (
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="fixed right-4 top-20 bottom-20 w-80 z-40"
            drag
            dragConstraints={{
              top: 0,
              left: -window.innerWidth + 340,
              right: 0,
              bottom: 0
            }}
          >
            <Card className="h-full p-0 shadow-2xl bg-gray-900/95 backdrop-blur-xl">
              <div className="p-3 border-b border-gray-700 cursor-move flex justify-between items-center bg-gradient-to-r from-purple-600 to-pink-600">
                <span className="font-semibold text-white">Live Chat</span>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-white/80 hover:text-white"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <EnhancedStreamChat
                user={user}
                channel={channel}
                isCreator={isCreator}
                onMessageSent={(msg) => setStreamStats(prev => ({ ...prev, messages: prev.messages + 1 }))}
                onGiftSent={handleGiftReceived}
                onTipSent={handleTipReceived}
                className="h-[calc(100%-50px)]"
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Helper - Removed to prevent visual clutter */}

      {/* Stream Goal Editor Modal */}
      <StreamGoalEditor
        currentGoal={streamGoal}
        onUpdateGoal={(updatedGoal) => {
          setStreamGoal(updatedGoal);
          // Check if goal was reached
          if (updatedGoal.currentAmount >= updatedGoal.goalAmount && !updatedGoal.celebrated) {
            setStreamGoal(prev => ({ ...prev, celebrated: true }));
            // toast.success(`🎉 Level ${updatedGoal.currentLevel} Goal Reached! ${updatedGoal.goalAmount.toLocaleString()} tokens!`, {
            //   duration: 5000,
            //   style: {
            //     background: 'linear-gradient(to right, #7c3aed, #ec4899)',
            //     color: 'white',
            //     fontWeight: 'bold'
            //   }
            // });
            
            // Auto-progress to next level if available
            if (updatedGoal.currentLevel < 3) {
              setTimeout(() => {
                const nextLevel = updatedGoal.currentLevel + 1;
                const nextLevelKey = `level${nextLevel}`;
                setStreamGoal({
                  ...updatedGoal,
                  currentLevel: nextLevel,
                  goalAmount: updatedGoal[nextLevelKey].amount,
                  description: updatedGoal[nextLevelKey].description,
                  celebrated: false
                });
                // toast.success(`🚀 Level ${nextLevel} Goal Started!`, {
                //   duration: 3000,
                //   style: {
                //     background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                //     color: 'white',
                //     fontWeight: 'bold'
                //   }
                // });
              }, 3000);
            }
          }
        }}
        onClose={() => setShowGoalEditor(false)}
        isVisible={showGoalEditor}
      />
      
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

export default StreamingDashboard;