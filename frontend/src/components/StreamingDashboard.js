import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
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
  CloudArrowDownIcon,
  LockClosedIcon,
  ShoppingBagIcon
} from '@heroicons/react/24/outline';
import {
  HeartIcon,
  StarIcon,
  TrophyIcon,
  CheckCircleIcon
} from '@heroicons/react/24/solid';
import VideoCall from './VideoCall';
import UnifiedStreamPanel from './UnifiedStreamPanel';
import StreamAnalytics from './StreamAnalytics';
import StreamAnalyticsEnhanced from './StreamAnalyticsEnhanced';
import StreamControlBar from './StreamControlBar';
import StreamInfoBar from './StreamInfoBar';
import EnhancedStreamingOverlay from './EnhancedStreamingOverlay';
import CoHostManager from './CoHostManager';
import CreatorPrivateCallNotification from './CreatorPrivateCallNotification';
import PrivateCallRequestModal from './PrivateCallRequestModal';
import StreamGoalEditor from './StreamGoalEditor';
import EnhancedMultiVideoGrid from './EnhancedMultiVideoGrid';
import SaveStreamModal from './SaveStreamModal';
import PrivateShowAnnouncement from './PrivateShowAnnouncement';
import MultiCameraStreamingManager from './MultiCameraStreamingManager';
import LiveShoppingOverlay from './streaming/LiveShoppingOverlay';
import CreatorShoppingControls from './streaming/CreatorShoppingControls';
import Button from './ui/Button';
import Card from './ui/Card';
import ErrorBoundary from './ui/ErrorBoundary';
import toast from 'react-hot-toast';
import { useViewerCount, useStreamAnalytics, useSocket } from '../hooks/useSocket';
import { getAuthToken } from '../utils/auth-helpers';
import socketService from '../utils/socket';

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
  className = '',
  onStreamSaved = null
}) => {
  const { animations } = useTheme();
  const [layoutMode, setLayoutMode] = useState('professional');
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showStreamPanel, setShowStreamPanel] = useState(true);
  const [pinnedPanels, setPinnedPanels] = useState(['chat']);
  const [streamTitle, setStreamTitle] = useState(streamConfig?.title || 'My Live Stream');
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
  const [activeCoHosts, setActiveCoHosts] = useState([]);
  const [showCoHostPanel, setShowCoHostPanel] = useState(false); // Hide co-host panel by default
  const [coHostRequests, setCoHostRequests] = useState([]); // Track co-host requests for notification badge
  const [showShoppingPanel, setShowShoppingPanel] = useState(false); // Shopping panel state
  const [streamQuality, setStreamQuality] = useState('2K');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState(null);
  const [recordingResourceId, setRecordingResourceId] = useState(null);
  const [recordingSid, setRecordingSid] = useState(null);
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
  const [screenTrack, setScreenTrack] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showSaveStreamModal, setShowSaveStreamModal] = useState(false);
  const [streamRecordingData, setStreamRecordingData] = useState(null);
  const [showPrivateCallModal, setShowPrivateCallModal] = useState(false);
  const [useMultiCamera, setUseMultiCamera] = useState(false);
  const [multiCameraLayout, setMultiCameraLayout] = useState('single');
  const [agoraClient, setAgoraClient] = useState(null);
  const [privateCallSession, setPrivateCallSession] = useState(null);
  const [ticketedShowActive, setTicketedShowActive] = useState(false);
  const [currentTicketedShow, setCurrentTicketedShow] = useState(null);
  const [shoppingEnabled, setShoppingEnabled] = useState(true); // Enable by default for demo
  const [streamId, setStreamId] = useState(() => {
    // Generate a unique stream ID
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });
  
  const videoCallRef = useRef(null);
  const durationRef = useRef(0);
  const analyticsRef = useRef(null);
  const streamStatsRef = useRef(streamStats);
  
  // streamId is already defined above via useState
  const { updateAnalytics } = useSocket();
  
  // Initialize real-time analytics tracking
  useEffect(() => {
    if (!channel || !isCreator) return;
    
    // Join stream room and initialize analytics
    socketService.emit('stream-started', {
      channel,
      streamId,
      creatorId: user?.id || user?.supabase_id,
      title: streamTitle,
      category: streamCategory
    });
    
    // Listen for real-time analytics updates
    const handleViewerCount = (data) => {
      if (data.channel === channel || data.streamId === streamId) {
        setViewerCount(data.count);
        setStreamStats(prev => ({
          ...prev,
          viewers: data.count,
          peakViewers: Math.max(prev.peakViewers, data.count)
        }));
      }
    };
    
    const handleAnalyticsUpdate = (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          ...data.stats
        }));
      }
    };
    
    const handleNewFollower = (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          newFollowers: prev.newFollowers + 1
        }));
        toast.success(`🎉 ${data.followerName} just followed!`, {
          icon: '❤️',
          duration: 3000
        });
      }
    };
    
    const handleEngagementUpdate = (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          engagement: data.engagement || prev.engagement,
          messages: data.messageCount || prev.messages
        }));
      }
    };
    
    // Register socket listeners
    socketService.on('viewer-count', handleViewerCount);
    socketService.on('viewer-count-update', handleViewerCount);
    socketService.on('analytics-update', handleAnalyticsUpdate);
    socketService.on('new-follower', handleNewFollower);
    socketService.on('engagement-update', handleEngagementUpdate);
    
    // Cleanup on unmount
    return () => {
      socketService.emit('stream-ended', {
        channel,
        streamId,
        stats: streamStatsRef.current
      });
      
      socketService.off('viewer-count', handleViewerCount);
      socketService.off('viewer-count-update', handleViewerCount);
      socketService.off('analytics-update', handleAnalyticsUpdate);
      socketService.off('new-follower', handleNewFollower);
      socketService.off('engagement-update', handleEngagementUpdate);
    };
  }, [channel, streamId, isCreator, user, streamTitle, streamCategory]);


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
  const handleToggleRecording = useCallback(async () => {
    try {
      const authToken = await getAuthToken();
      
      if (!isRecording) {
        // Start recording
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/recording/streams/${streamId}/start-recording`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              token: token // Agora token for recording
            })
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          setRecordingId(data.recordingId);
          setRecordingResourceId(data.resourceId);
          setRecordingSid(data.sid);
          setIsRecording(true);
          toast.success('🔴 Recording started in 2K', { duration: 2000 });
        } else {
          throw new Error('Failed to start recording');
        }
      } else {
        // Stop recording with auto-save
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/recording/streams/${streamId}/stop-recording`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              autoSave: true, // Auto-save and publish for sale
              title: streamTitle || `Stream Recording ${new Date().toLocaleDateString()}`,
              tokenPrice: 10 // Default price
            })
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          setIsRecording(false);
          
          // Calculate suggested price based on duration (10 tokens per minute)
          const durationMinutes = Math.ceil((data.duration || streamStats.duration) / 60);
          const suggestedPrice = Math.max(10, Math.min(500, durationMinutes * 10));
          
          // Prepare comprehensive recording data for the save modal
          setStreamRecordingData({
            streamId: streamId,
            recordingId: data.recordingId,
            title: streamTitle || `Stream Recording ${new Date().toLocaleDateString()}`,
            description: streamConfig?.description || '',
            recordingUrl: data.fileUrl,
            duration: data.duration || streamStats.duration,
            durationMinutes: durationMinutes,
            viewerCount: streamStats.viewers,
            peakViewers: streamStats.peakViewers || streamStats.viewers,
            totalGifts: streamStats.gifts || 0,
            totalTips: streamStats.tips || 0,
            totalRevenue: (streamStats.gifts + streamStats.tips) * 50, // Assuming 1 token = $0.05
            thumbnail_url: streamConfig?.thumbnail || user?.profile_pic_url,
            suggestedPrice: suggestedPrice,
            recordedAt: new Date().toISOString()
          });
          
          // Auto-open the SaveStreamModal for editing
          setShowSaveStreamModal(true);
          
          toast.success('⏹️ Recording stopped! Now customize your video for sale.', { 
            duration: 3000,
            icon: '🎬'
          });
        } else {
          throw new Error('Failed to stop recording');
        }
      }
    } catch (error) {
      console.error('Recording toggle error:', error);
      toast.error(isRecording ? 'Failed to stop recording' : 'Failed to start recording');
    }
  }, [isRecording, streamId, token, streamTitle, streamConfig, streamStats, user]);

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
          case 'r':
            e.preventDefault();
            handleToggleRecording();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleToggleRecording]);



  // Handle screen sharing toggle
  const handleScreenShareToggle = useCallback(async (enable) => {
    try {
      if (!agoraClient) {
        toast.error('Agora client not initialized');
        return false;
      }

      if (enable) {
        // Start screen sharing
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

        // Create screen video track
        const screenVideoTrack = await AgoraRTC.createScreenVideoTrack({
          encoderConfig: '1080p_1',
        });

        // Unpublish camera track if sharing screen
        if (localTracks?.videoTrack) {
          await agoraClient.unpublish(localTracks.videoTrack);
        }

        // Publish screen track
        await agoraClient.publish(screenVideoTrack);

        setScreenTrack(screenVideoTrack);
        setIsScreenSharing(true);

        // Listen for screen share ended by user (clicking browser's stop sharing)
        screenVideoTrack.on('track-ended', async () => {
          await handleScreenShareToggle(false);
        });

        return true;
      } else {
        // Stop screen sharing
        if (screenTrack) {
          screenTrack.stop();
          screenTrack.close();
          await agoraClient.unpublish(screenTrack);
          setScreenTrack(null);
        }

        // Re-publish camera track
        if (localTracks?.videoTrack) {
          await agoraClient.publish(localTracks.videoTrack);
        }

        setIsScreenSharing(false);
        return true;
      }
    } catch (error) {
      console.error('Screen share error:', error);
      if (error.message?.includes('Permission denied')) {
        toast.error('Screen sharing permission denied');
      } else {
        toast.error('Failed to toggle screen sharing');
      }
      return false;
    }
  }, [agoraClient, localTracks, screenTrack]);

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
    // Emit gift analytics event
    socketService.emit('gift-received', {
      channel,
      ...giftData,
      timestamp: Date.now()
    });
    
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
    // Emit tip analytics event
    socketService.emit('tip-received', {
      channel,
      ...tipData,
      timestamp: Date.now()
    });
    
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
    
    // Stop recording with auto-save if it's still active
    if (isRecording) {
      try {
        const authToken = await getAuthToken();
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/recording/streams/${streamId}/stop-recording`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              autoSave: true,
              title: streamTitle || `Stream Recording ${new Date().toLocaleDateString()}`,
              tokenPrice: 10
            })
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          setStreamRecordingData({
            streamId: streamId,
            title: streamTitle,
            description: streamConfig?.description || '',
            recordingUrl: data.fileUrl,
            duration: data.duration,
            viewerCount: streamStats.viewers,
            thumbnail_url: user?.profile_pic_url
          });
        }
      } catch (error) {
        console.error('Error stopping recording on stream end:', error);
      }
    }
    
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
      // If parent component provided a callback for saved streams, call it
      // This will add the stream to the Modern Content Gallery
      if (onStreamSaved) {
        await onStreamSaved(saveData);
      }
      
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
    <div className={`h-screen flex flex-col relative isolate bg-gray-950 ${className}`}>
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

      {/* Floating Private Show Button - Always visible for creators */}
      {isCreator && channel && !currentTicketedShow && (
        <div className="fixed top-24 right-4 z-50">
          <PrivateShowAnnouncement
            streamId={channel}
            isCreator={true}
            onShowAnnounced={(show) => {
              setCurrentTicketedShow(show);
              setTicketedShowActive(true);
              toast.success(`Private show announced! Price: ${show.token_price} tokens`);
            }}
            onShowStarted={(showId) => {
              toast.success('Private show started! Non-ticket holders will have video hidden.');
            }}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden bg-gray-950">
        <div className={`h-full grid ${getLayoutClasses()} gap-4 p-4 bg-gray-950`}>
          {/* Video Player Section */}
          <motion.div
            layout
            className={`relative ${
              layoutMode === 'focus' ? 'col-span-1' : 
              'col-span-9'
            }`}
          >
            <div className="h-full relative bg-gray-950 rounded-xl">
              {/* Video container with overflow hidden */}
              <div className="absolute inset-0 overflow-hidden">
                {/* Conditionally render multi-camera, multi-guest or regular video */}
                {useMultiCamera ? (
                  <MultiCameraStreamingManager
                    client={agoraClient}
                    channel={channel}
                    uid={uid}
                    isStreaming={true}
                    onLayoutChange={(layout) => setMultiCameraLayout(layout)}
                    onCameraSwitch={(deviceId) => console.log('Switched to camera:', deviceId)}
                    className="absolute inset-0 z-10"
                  />
                ) : useMultiGuest ? (
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
                  <ErrorBoundary>
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
                      coHosts={activeCoHosts}
                      useMultiVideoGrid={activeCoHosts.length > 0}
                      className="absolute inset-0 z-10"
                      onLocalTracksCreated={(tracks) => setLocalTracks(tracks)}
                      onClientCreated={(client) => setAgoraClient(client)}
                    />
                  </ErrorBoundary>
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

              {/* Live Shopping Components - Disabled to remove animations */}
              {/* {shoppingEnabled && !isCreator && (
                <LiveShoppingOverlay
                  streamId={streamId}
                  isCreator={isCreator}
                  user={user}
                  onPurchase={(data) => {
                    // Update stream revenue
                    setStreamStats(prev => ({
                      ...prev,
                      revenue: prev.revenue + data.totalPrice
                    }));
                    // Update token balance if needed
                    if (onTokenDeduction) {
                      onTokenDeduction(data.totalPrice);
                    }
                  }}
                />
              )} */}

              {/* Tab Bar - Private Show button, Co-Hosts and Shop */}
              <div className="absolute bottom-20 left-4 z-40 flex gap-2">
                {/* Private Show Button - Colorful gradient */}
                {isCreator && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowPrivateCallModal(!showPrivateCallModal);
                      setShowCoHostPanel(false);
                      setShowShoppingPanel(false);
                    }}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg font-semibold"
                  >
                    <SparklesIcon className="w-5 h-5" />
                    <span>Private Show</span>
                  </motion.button>
                )}

                {/* Co-Host Tab Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowCoHostPanel(!showCoHostPanel);
                    setShowShoppingPanel(false);
                    setShowPrivateCallModal(false);
                  }}
                  className={`${showCoHostPanel ? 'bg-purple-600' : 'bg-gray-900/90 hover:bg-gray-800'} text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all`}
                >
                  <UserGroupIcon className="w-5 h-5" />
                  <span className="font-medium">Co-Hosts</span>
                  {activeCoHosts.length > 0 && (
                    <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {activeCoHosts.length}
                    </span>
                  )}
                  {!showCoHostPanel && coHostRequests?.length > 0 && isCreator && (
                    <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
                      {coHostRequests.length} new
                    </span>
                  )}
                </motion.button>

                {/* Shop Tab Button - Only show if creator and shopping enabled */}
                {isCreator && shoppingEnabled && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowShoppingPanel(!showShoppingPanel);
                      setShowCoHostPanel(false);
                      setShowPrivateCallModal(false);
                    }}
                    className={`${showShoppingPanel ? 'bg-purple-600' : 'bg-gray-900/90 hover:bg-gray-800'} text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all`}
                  >
                    <ShoppingBagIcon className="w-5 h-5" />
                    <span className="font-medium">Shop</span>
                  </motion.button>
                )}
              </div>

              {/* Co-Host Manager Panel - Slide in from left */}
              <AnimatePresence>
                {showCoHostPanel && (
                  <motion.div
                    initial={{ x: -320, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -320, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20 }}
                    className="absolute bottom-32 left-4 z-40"
                  >
                    <ErrorBoundary>
                      <CoHostManager
                        streamId={channel}
                        isCreator={isCreator}
                        user={user}
                        onClose={() => setShowCoHostPanel(false)}
                          onCoHostsUpdate={(coHosts) => {
                            setActiveCoHosts(coHosts);
                            // Auto-open panel if there are new co-hosts
                            if (coHosts.length > activeCoHosts.length) {
                              setShowCoHostPanel(true);
                            }
                          }}
                          onRequestsUpdate={(requests) => {
                            setCoHostRequests(requests);
                            // Auto-open panel for creators when new requests come in
                            if (isCreator && requests.length > coHostRequests.length) {
                              setShowCoHostPanel(true);
                              toast.info('New co-host request received!');
                            }
                          }}
                          className="min-w-[320px] max-w-[400px]"
                        />
                    </ErrorBoundary>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Shopping Panel - Slide in from left */}
              <AnimatePresence>
                {showShoppingPanel && isCreator && shoppingEnabled && (
                  <motion.div
                    initial={{ x: -320, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -320, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20 }}
                    className="absolute bottom-32 left-4 z-40"
                  >
                    <ErrorBoundary>
                      <div className="relative">
                        <CreatorShoppingControls
                          streamId={streamId}
                          user={user}
                          hideToggleButton={true}
                          onClose={() => setShowShoppingPanel(false)}
                        />
                      </div>
                    </ErrorBoundary>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Private Call Notifications moved to tab system */}

              {/* Recording Indicator moved here to keep top-left clean */}


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
            </div>
          </motion.div>

          {/* Unified Stream Panel - Combines Chat & Activity */}
          {layoutMode !== 'focus' && showStreamPanel && (
            <div className={`${layoutMode === 'focus' ? 'hidden' : 'col-span-3'} flex flex-col gap-3 overflow-hidden`}>
              <motion.div
                layout
                className="flex-1"
              >
                <UnifiedStreamPanel
                  user={user}
                  channel={channel}
                  creatorId={isCreator ? user?.supabase_id || user?.id : targetCreator?.supabase_id || targetCreator?.id}
                  isCreator={isCreator}
                  className="h-full"
                />
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Drawer - Positioned just above bottom navigation */}
      <AnimatePresence>
        {showAnalytics && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={`absolute bottom-20 left-4 z-30 ${
              layoutMode === 'focus' ? 'right-4' : 'right-[calc(25%+1rem)]'
            }`}
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
              className=""
            />
          </motion.div>
        )}
      </AnimatePresence>


      {/* Stream Control Bar */}
      <StreamControlBar
        isStreaming={true}
        onEndStream={handleEndStream}
        onToggleAnalytics={() => setShowAnalytics(!showAnalytics)}
        onToggleStreamPanel={() => setShowStreamPanel(!showStreamPanel)}
        onLayoutChange={setLayoutMode}
        onToggleRecording={handleToggleRecording}
        isRecording={isRecording}
        isStreamEnding={isStreamEnding}
        streamId={streamId}
        localTracks={localTracks}
        onScreenShareToggle={handleScreenShareToggle}
        onToggleShopping={() => {
          setShoppingEnabled(!shoppingEnabled);
          toast.success(shoppingEnabled ? 'Shopping disabled' : '🛍️ Shopping enabled!');
        }}
        shoppingEnabled={shoppingEnabled}
        onToggleMultiGuest={() => {
          if (useMultiCamera) {
            toast.error('Disable multi-camera mode first');
            return;
          }
          setUseMultiGuest(!useMultiGuest);
          // toast.success(useMultiGuest ? 'Multi-guest mode disabled' : 'Multi-guest mode enabled! Up to 9 participants can join', {
          //   duration: 3000,
          //   icon: useMultiGuest ? '👤' : '👥'
          // });
        }}
        isMultiGuest={useMultiGuest}
        onToggleMultiCamera={() => {
          if (useMultiGuest) {
            toast.error('Disable multi-guest mode first');
            return;
          }
          setUseMultiCamera(!useMultiCamera);
          toast.success(useMultiCamera ? 'Multi-camera mode disabled' : 'Professional multi-camera mode enabled!', {
            duration: 3000,
            icon: useMultiCamera ? '📷' : '🎥'
          });
        }}
        isMultiCamera={useMultiCamera}
        className="z-50"
      />


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
        onClose={() => {
          setShowSaveStreamModal(false);
          setStreamRecordingData(null);
        }}
        streamData={streamRecordingData || {
          streamId: streamId,
          title: streamTitle,
          description: streamConfig?.description || '',
          duration: formatDuration(durationRef.current),
          viewerCount: streamStats.viewers,
          thumbnail_url: user?.profile_pic_url
        }}
        onSave={handleSaveStream}
        user={user}
      />
      
      {/* Private Show Panel/Modal - Different for Creators and Fans */}
      <AnimatePresence>
        {showPrivateCallModal && (
          <>
            {isCreator ? (
              // For creators, show the Private Show announcement panel directly
              <motion.div
                initial={{ x: -320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -320, opacity: 0 }}
                transition={{ type: 'spring', damping: 20 }}
                className="absolute bottom-32 left-4 z-40"
              >
                <PrivateShowAnnouncement
                  streamId={channel || ''}
                  isCreator={true}
                  onClose={() => setShowPrivateCallModal(false)}
                  onShowAnnounced={(show) => {
                    setCurrentTicketedShow(show);
                    setTicketedShowActive(true);
                    setShowPrivateCallModal(false);
                    toast.success(`Private show announced! Price: ${show.token_price} tokens`);
                  }}
                  onShowStarted={(showId) => {
                    toast.success('Private show started! Non-ticket holders will have video hidden.');
                    setShowPrivateCallModal(false);
                  }}
                  className="bg-gray-900 rounded-2xl p-4 shadow-2xl border border-gray-800 min-w-[320px]"
                />
              </motion.div>
            ) : (
              // For fans, show the request modal
              <PrivateCallRequestModal
                isOpen={showPrivateCallModal}
                onClose={() => setShowPrivateCallModal(false)}
                creator={targetCreator}
                streamId={channel}
                fanId={user?.supabase_id || user?.id}
                fanTokenBalance={user?.token_balance || 1000}
                pricePerMinute={streamConfig?.audienceControl?.privateStreamPrice || 100}
                minimumMinutes={5}
            />
          )}
        </>
      )}
      </AnimatePresence>
    </div>
  );
};

export default StreamingDashboard;