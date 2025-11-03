import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
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
import LiveChatEnhanced from './LiveChatEnhanced';
import LiveChatSupabase from './LiveChatSupabase';
import VirtualGifts from './VirtualGifts';
import TipButton from './payments/TipButton';
import StreamingGiftDisplay from './StreamingGiftDisplay';
// import InteractivePolls from './InteractivePolls'; // Removed - file deleted
import CreatorSubscriptions from './CreatorSubscriptions';
import LivestreamGoalMeter from './LivestreamGoalMeter';
import TipLeaderboard from './TipLeaderboard';
import LiveStreamAnalytics from './LiveStreamAnalytics';
import EnhancedStreamingOverlay from './EnhancedStreamingOverlay';
import CoHostManager from './CoHostManager';
import StreamParticipantManager from './StreamParticipantManager';
import SaveStreamModal from './SaveStreamModal';
import PrivateShowAnnouncement from './PrivateShowAnnouncement';
import Button from './ui/Button';
import Card from './ui/Card';
import Tooltip from './ui/Tooltip';
import { getAuthToken } from '../utils/auth-helpers';
import soundManager from '../utils/soundManager';
import socketService from '../utils/socket';
import { LockClosedIcon } from '@heroicons/react/24/solid';

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
    viewers: 0,
    peakViewers: 0,
    messages: 0,
    gifts: 0,
    tips: 0,
    revenue: 0,
    newFollowers: 0,
    engagement: 0
  });
  const streamStatsRef = useRef(streamStats);
  const durationRef = useRef(0);
  const [streamGoal, setStreamGoal] = useState({
    currentAmount: 3500,
    goalAmount: 10000,
    isVisible: true
  });
  const [activeCoHosts, setActiveCoHosts] = useState([]);
  const [layoutMode, setLayoutMode] = useState('classic');
  const [showStreamEnded, setShowStreamEnded] = useState(false);
  const [showSaveStreamModal, setShowSaveStreamModal] = useState(false);
  const [streamParticipants, setStreamParticipants] = useState([]);
  const [streamRecordingData, setStreamRecordingData] = useState(null);
  const [videoVisible, setVideoVisible] = useState(true);
  const [privateShowActive, setPrivateShowActive] = useState(false);
  const [hasTicket, setHasTicket] = useState(false);
  const [currentShow, setCurrentShow] = useState(null);
  const [ticketHolders, setTicketHolders] = useState([]); // Track VIP ticket holders
  const [recentTicketPurchases, setRecentTicketPurchases] = useState([]); // For live ticker
  const videoCallRef = useRef(null);


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

  // Initialize stream analytics tracking
  useEffect(() => {
    if (!channel || !isStreaming) return;

    const initializeAnalytics = async () => {
      try {
        // Subscribe to stream channel for real-time updates (Ably)
        await socketService.joinStream(channel);

        // Also subscribe to user-specific channel for private show events
        if (user?.id) {
          const userChannel = socketService.getChannel(`user:${user.id}`);
          userChannel.subscribe((message) => {
            // Emit to local listeners so socketService.on() handlers work
            socketService.emitToListeners(message.name, message.data);
          });
        }

        // Initialize analytics if creator
        if (isCreator) {
          socketService.emit('stream-started', {
            channel,
            creatorId: user?.id,
            title: streamConfig?.title,
            category: streamConfig?.category
          });
        }

        // Track viewer join
        socketService.emit('viewer-joined', {
          channel,
          userId: user?.id,
          timestamp: Date.now()
        });

        // CLASS PAYMENT: Check if this is a class stream and charge the user
        if (!isCreator && user?.id) {
          const activeClassStream = sessionStorage.getItem('activeClassStream');
          if (activeClassStream) {
            try {
              const classData = JSON.parse(activeClassStream);
              const authToken = await getAuthToken();

              // Call mark-attendance endpoint (this is where payment happens!)
              const response = await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/classes/${classData.classId}/mark-attendance`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                  }
                }
              );

              const result = await response.json();

              if (response.ok) {
                if (result.alreadyPaid) {
                  // User already paid for this class
                  toast.success('Welcome back! You already paid for this class. 🎓', {
                    icon: '✅',
                    duration: 4000
                  });
                } else {
                  // Payment successful
                  toast.success(
                    `Payment successful! ${result.tokensPaid} tokens charged. Enjoy the class! 🎓`,
                    {
                      icon: '💎',
                      duration: 5000
                    }
                  );

                  // Call onTokenDeduction to update user balance in parent component
                  if (onTokenDeduction) {
                    onTokenDeduction(result.tokensPaid);
                  }
                }
              } else {
                // Payment failed
                if (result.error === 'Insufficient token balance') {
                  toast.error(
                    `Insufficient tokens! You need ${result.required} tokens but only have ${result.current}. Please purchase ${result.needed} more tokens.`,
                    {
                      icon: '💎',
                      duration: 8000
                    }
                  );

                  // Redirect to token purchase page after 3 seconds
                  setTimeout(() => {
                    window.location.href = '/tokens';
                  }, 3000);
                } else {
                  toast.error(result.error || 'Failed to process payment', {
                    icon: '❌',
                    duration: 5000
                  });
                }
              }
            } catch (error) {
              console.error('Error processing class payment:', error);
              toast.error('Failed to process class payment. Please contact support.', {
                icon: '❌',
                duration: 5000
              });
            }
          }
        }
      } catch (error) {
        console.error('Error initializing analytics:', error);
      }
    };

    initializeAnalytics();

    return () => {
      // Clean up when leaving stream
      socketService.emit('leave-stream', channel);
      if (isCreator) {
        socketService.emit('stream-ended', {
          channel,
          stats: streamStatsRef.current
        });
      }
    };
  }, [channel, isStreaming, isCreator, user, streamConfig]);

  // Listen for real-time analytics updates
  useEffect(() => {
    if (!channel) return;

    // Real-time viewer count updates
    socketService.on('viewer-count', (data) => {
      if (data.streamId === channel || data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          viewers: data.count,
          peakViewers: Math.max(prev.peakViewers, data.count)
        }));
        
        // Update participants list if available
        if (data.participants) {
          setStreamParticipants(data.participants);
        }
      }
    });

    // Real-time message count updates
    socketService.on('message-sent', (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          messages: prev.messages + 1,
          engagement: Math.min(100, ((prev.messages + 1) / prev.viewers) * 10)
        }));
      }
    });

    // Real-time gift/tip tracking
    socketService.on('gift-received', (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          gifts: prev.gifts + (data.quantity || 1),
          revenue: prev.revenue + (data.totalValue || 0)
        }));
      }
    });

    socketService.on('tip-received', (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          tips: prev.tips + (data.amount || 0),
          revenue: prev.revenue + (data.amount || 0)
        }));
      }
    });

    // New follower notifications
    socketService.on('new-follower', (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          newFollowers: prev.newFollowers + 1
        }));
      }
    });

    // Analytics batch update (every 30 seconds from backend)
    socketService.on('analytics-update', (data) => {
      if (data.channel === channel) {
        setStreamStats(prev => ({
          ...prev,
          ...data.stats
        }));
      }
    });

    return () => {
      socketService.off('viewer-count');
      socketService.off('message-sent');
      socketService.off('gift-received');
      socketService.off('tip-received');
      socketService.off('new-follower');
      socketService.off('analytics-update');
    };
  }, [channel]);

  // Listen for ticketed show events
  useEffect(() => {
    if (!channel) return;

    // Listen for private mode changes
    socketService.on('private_mode_started', (data) => {
      if (data.streamId === channel) {
        setPrivateShowActive(true);
        setCurrentShow(data);
        
        // If viewer doesn't have ticket, hide video
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
    
    socketService.on('ticket_purchased', (data) => {
      setHasTicket(true);
      if (privateShowActive) {
        setVideoVisible(true);
      }

      // Add to ticket holders list
      if (data.viewerId) {
        setTicketHolders(prev => [...new Set([...prev, data.viewerId])]);
      }

      // Add to recent purchases for ticker
      if (data.viewerName) {
        setRecentTicketPurchases(prev => [
          { name: data.viewerName, timestamp: Date.now() },
          ...prev.slice(0, 19) // Keep last 20
        ]);
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
    
    socketService.on('ticketed_show_announced', (data) => {
      setCurrentShow(data);
      if (!isCreator) {
        toast(`Private show announced! ${data.tokenPrice} tokens`, {
          icon: '🎟️',
          duration: 5000
        });
      }
    });

    // Ticket sold notification for creators
    socketService.on('ticket_sold', (data) => {
      if (isCreator && data.showId) {
        // Play cash register sound
        soundManager.playTipSound(data.price || 500);

        // Show celebration toast
        toast.success(`🎫 New ticket sold! +${data.price} tokens`, {
          duration: 4000,
          icon: '💰',
          style: {
            background: 'linear-gradient(to right, #10b981, #059669)',
            color: 'white',
            fontWeight: 'bold'
          }
        });
      }
    });
    
    return () => {
      socketService.off('private_mode_started');
      socketService.off('enable_private_video');
      socketService.off('ticket_purchased');
      socketService.off('private_show_ended');
      socketService.off('ticketed_show_announced');
      socketService.off('ticket_sold');
    };
  }, [channel, hasTicket, isCreator, privateShowActive]);

  const handleGiftSent = (giftData) => {
    // Emit gift event for real-time tracking
    socketService.emit('send-gift', {
      channel,
      ...giftData,
      timestamp: Date.now()
    });
    
    setStreamStats(prev => ({
      ...prev,
      gifts: prev.gifts + 1,
      revenue: prev.revenue + (giftData.value || 0)
    }));
    
    // Play gift sound based on rarity
    if (giftData.rarity) {
      soundManager.playGiftSound(giftData.rarity);
    }
    
    // Show toast notification
    toast.success(`${giftData.senderName || 'Someone'} sent ${giftData.name}!`, {
      icon: giftData.emoji || '🎁',
      duration: 3000
    });
  };

  const handleTipSent = (tipData) => {
    // Emit tip event for real-time tracking
    socketService.emit('send-tip', {
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
      setStreamGoal(prev => ({
        ...prev,
        currentAmount: prev.currentAmount + tipData.amount
      }));
    }
    
    // Play tip sound
    soundManager.playTipSound(tipData.amount);
    
    // Show toast notification
    const tipValue = (tipData.amount * 0.05).toFixed(2);
    toast.success(`${tipData.senderName || 'Someone'} tipped $${tipValue}!`, {
      icon: '💰',
      duration: 3000
    });
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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/block`, {
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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/streams/save`, {
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
        className="relative flex-1 sm:flex-initial"
      >
        {icon}
        <span className="hidden sm:inline ml-2">{label}</span>
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
    <Card className="mb-2 sm:mb-4 p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
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
          
          {/* Prominent Chat Button - visible in focus mode */}
          {layoutMode === 'focus' && (
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
          
          {/* Layout Switcher - Hidden on Mobile */}
          <div className="hidden sm:flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
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
    <div className="relative h-full bg-gray-900 rounded-lg sm:rounded-xl overflow-hidden">
      {/* Show video or blocked message based on private show access */}
      {videoVisible ? (
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
            <p className="text-sm text-gray-500 mb-6">
              💬 You can still participate in chat while the show is private
            </p>
            <PrivateShowAnnouncement
              streamId={channel}
              isCreator={false}
              className="inline-block"
            />
          </div>
        </div>
      )}
      
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

          {/* Live Stream Goal Meter - Top Center */}
          {streamGoal.isVisible && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 w-full max-w-md px-4">
              <LivestreamGoalMeter
                currentAmount={streamGoal.currentAmount}
                goalAmount={streamGoal.goalAmount}
                isCreator={isCreator}
                streamId={channel}
                user={user}
                onGoalUpdate={async (newAmount) => {
                  setStreamGoal(prev => ({ ...prev, goalAmount: newAmount }));
                  // TODO: Save to backend via API
                }}
              />
            </div>
          )}

          {/* Live Analytics - Top Right for Creators */}
          {isCreator && (
            <div className="absolute top-4 right-4 z-30">
              <LiveStreamAnalytics
                streamStats={streamStats}
                isCreator={isCreator}
              />
            </div>
          )}

          {/* Tip Leaderboard - Bottom Left for All */}
          <div className="absolute bottom-20 left-4 z-30 w-72 hidden sm:block">
            <TipLeaderboard
              creatorId={targetCreator?.id || targetCreator?.supabase_id}
              streamId={channel}
              maxEntries={5}
            />
          </div>

          {/* Live Ticket Sales Ticker - During Private Shows */}
          {privateShowActive && recentTicketPurchases.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 z-25 overflow-hidden bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 border-t border-green-500/30">
              <motion.div
                className="flex items-center gap-8 py-2 whitespace-nowrap"
                animate={{ x: ['0%', '-50%'] }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              >
                {/* Duplicate for seamless loop */}
                {[...recentTicketPurchases, ...recentTicketPurchases].map((purchase, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-green-400 font-semibold text-sm"
                  >
                    <motion.span
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      🎫
                    </motion.span>
                    <span>{purchase.name} just bought a ticket!</span>
                    <span className="text-green-300">•</span>
                  </div>
                ))}
              </motion.div>
            </div>
          )}

          {/* Private Show Controls moved outside video area */}
        </>
      )}
      
      {/* Floating Chat Button - visible in focus mode */}
      {layoutMode === 'focus' && !isCreator && (
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
      {/* Panel Tabs - Mobile Responsive */}
      <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 mb-2 sm:mb-4">
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
              <LiveChatSupabase
                user={user}
                channel={channel}
                isCreator={isCreator}
                isHost={isHost}
                onSendGift={handleGiftSent}
                onSendTip={handleTipSent}
                ticketHolders={ticketHolders}
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
              <Card className="h-full p-4">
                <p className="text-gray-500">Polls feature temporarily unavailable</p>
              </Card>
              {/* <InteractivePolls
                user={user}
                channel={channel}
                isCreator={isCreator}
                isHost={isHost}
                className="h-full"
              /> */}
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
        <div className="flex-1 p-2 sm:p-4 min-h-0">
          <VideoSection />
        </div>
      </div>
    );
  }


  // Layout: Classic Mode (Side by side on desktop, stacked on mobile)
  return (
    <div className={`flex flex-col h-screen relative isolate ${className}`}>
      {/* Background layer */}
      <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 -z-10" aria-hidden="true" />
      
      {/* Mobile Layout - Stacked */}
      <div className="flex-1 flex flex-col lg:hidden min-h-0">
        {/* Mobile Video Area - Takes up most of screen */}
        <div className="flex-1 min-h-0 relative" style={{ minHeight: '50vh' }}>
          <VideoSection />
        </div>
        
        {/* Mobile Bottom Panel - Collapsible */}
        <div className="h-[40vh] bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <SidePanel className="h-full" />
        </div>
      </div>
      
      {/* Desktop Layout - Side by side */}
      <div className="hidden lg:flex flex-1 flex-row gap-4 p-4 min-h-0">
        {/* Video Area */}
        <div className="flex-1 min-h-0 relative">
          <VideoSection />
        </div>

        {/* Side Panel */}
        <div className="w-96 min-h-0" style={{ height: '110%' }}>
          <SidePanel className="h-full" />
        </div>
      </div>

      {/* Private Show Button for Creator - Mobile Responsive Position */}
      {isCreator && !currentShow && (
        <div className="fixed bottom-20 sm:bottom-24 right-4 sm:right-12 z-40">
          <PrivateShowAnnouncement
            streamId={channel || ''}
            isCreator={true}
            onShowAnnounced={(show) => {
              setCurrentShow(show);
              setPrivateShowActive(true);
              toast.success(`Private show announced! Price: ${show.token_price} tokens`);
            }}
            onShowStarted={(showId) => {
              toast.success('Private show started! Non-ticket holders will have video hidden.');
            }}
          />
        </div>
      )}

      {/* Floating Tip Button for Viewers - Desktop & Mobile */}
      {!isCreator && targetCreator && user?.id !== targetCreator?.id && (
        <div className="fixed bottom-20 sm:bottom-24 right-4 sm:right-12 z-40">
          <TipButton
            toCreatorId={targetCreator.id || targetCreator.supabase_id}
            context={{
              streamId: channel,
              channel: channel,
              type: 'live_stream'
            }}
            onTipped={(tip) => {
              toast.success(`Tip of ${tip.amountTokens} tokens sent!`, {
                icon: '💰',
                duration: 3000
              });
              // Update stream stats
              handleTipSent({
                amount: tip.amountTokens,
                senderName: user?.displayName || user?.email?.split('@')[0]
              });
            }}
            className="shadow-2xl hover:scale-105 transition-transform"
          />
        </div>
      )}

      {/* Enhanced Gift Display System */}
      <StreamingGiftDisplay
        user={user}
        channel={channel}
        isCreator={isCreator}
        onSendGift={handleGiftSent}
        onSendTip={handleTipSent}
        streamStats={streamStats}
      />

      {/* Modals */}
      {channel && (
        <VirtualGifts
          user={user}
          channel={channel}
          isOpen={showGifts}
          onClose={() => setShowGifts(false)}
          onSendGift={handleGiftSent}
          onSendTip={handleTipSent}
          targetCreator={targetCreator}
        />
      )}

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
              className="text-center max-w-2xl mx-auto p-4 sm:p-8"
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
                  className="text-4xl sm:text-6xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"
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