import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  SparklesIcon,
  CalendarIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
  ChevronRightIcon,
  PhoneIcon,
  VideoCameraIcon,
  ClockIcon,
  UsersIcon,
  UserGroupIcon,
  UserCircleIcon,
  TrophyIcon,
  CurrencyDollarIcon,
  WalletIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon
} from '@heroicons/react/24/solid';
import api from '../../services/api';
import toast from 'react-hot-toast';

// Default stats to avoid repetition
const DEFAULT_STATS = {
  todayEarnings: 0,
  weekEarnings: 0,
  monthEarnings: 0,
  totalFans: 0,
  activeFans: 0,
  pendingMessages: 0,
  scheduledCalls: 0,
  upcomingStreams: 0,
  subscribers: 0,
  followers: 0
};

// Separate component for scheduled call with countdown to avoid nested useEffect
const ScheduledCallCard = ({ call }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const callTime = new Date(call.scheduledTime);
      const diff = callTime - now;

      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (hours > 24) {
          const days = Math.floor(hours / 24);
          setTimeLeft(`${days}d ${hours % 24}h`);
        } else if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes}m`);
        } else if (minutes > 0) {
          setTimeLeft(`${minutes}m ${seconds}s`);
        } else {
          setTimeLeft(`${seconds}s`);
        }
      } else {
        setTimeLeft('Starting...');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [call.scheduledTime]);

  return (
    <motion.div
      key={call.id}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            {call.type === 'video' ? (
              <VideoCameraIcon className="w-5 h-5 text-blue-600" />
            ) : (
              <PhoneIcon className="w-5 h-5 text-blue-600" />
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{call.fanName}</p>
            <p className="text-sm text-gray-500">Scheduled {call.type} call</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
            {timeLeft}
          </div>
          <p className="text-xs text-gray-500 mt-1">{call.tokens} tokens</p>
        </div>
      </div>
    </motion.div>
  );
};

const MobileCreatorDashboard = ({
  user,
  tokenBalance,
  onNavigate,
  onShowGoLive,
  onShowAvailability,
  onShowEarnings,
  onShowSettings,
  onShowContent,
  onShowMessages
}) => {
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(false); // Start with false to show dashboard immediately
  const [activeSection, setActiveSection] = useState('overview');
  const [incomingCalls, setIncomingCalls] = useState([]);
  const [scheduledCalls, setScheduledCalls] = useState([]);
  const [swipedCallId, setSwipedCallId] = useState(null);
  const [topFans, setTopFans] = useState([]);
  const [upcomingSchedule, setUpcomingSchedule] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [loadingStates, setLoadingStates] = useState({
    stats: false,
    topFans: false,
    schedule: false,
    activity: false
  });
  const [currentSection, setCurrentSection] = useState(0);
  const sectionsRef = useRef([]);

  // Click lock to prevent double-fire on mobile
  const clickLock = useRef(false);

  // Run action once with debounce to prevent double-tap issues
  const runOnce = useCallback((fn) => {
    if (clickLock.current) {
      console.log('⏸️ Click locked, ignoring tap');
      return;
    }
    clickLock.current = true;

    // Execute immediately
    fn();

    // Unlock after shorter delay
    setTimeout(() => {
      clickLock.current = false;
    }, 300);
  }, []);

  useEffect(() => {
    console.log('🎯 MobileCreatorDashboard mounted');
    console.log('User data:', user);
    console.log('Token balance:', tokenBalance);

    let isMounted = true;

    const loadData = async () => {
      if (isMounted) {
        await fetchAllData();
      }
    };

    loadData();

    // Fallback timeout to ensure loading state doesn't get stuck
    const timeout = setTimeout(() => {
      if (loading && isMounted) {
        console.log('⏱️ Loading timeout - forcing loading to false');
        setLoading(false);
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, []);

  const fetchAllData = async () => {
    // Only set loading states during refresh
    if (isRefreshing) {
      setLoadingStates({ stats: true, topFans: true, schedule: true, activity: true });
    }

    await Promise.all([
      fetchCreatorStats().finally(() => setLoadingStates(prev => ({ ...prev, stats: false }))),
      fetchCallsData(),
      fetchTopFans().finally(() => setLoadingStates(prev => ({ ...prev, topFans: false }))),
      fetchUpcomingSchedule().finally(() => setLoadingStates(prev => ({ ...prev, schedule: false })))
    ]);

    setLoadingStates(prev => ({ ...prev, activity: false }));
  };

  const fetchCallsData = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await api.calls.getPending();

      // For now, using mock data only if we want to show the feature
      // Comment these out to hide the calls section when no real data
      /*
      setIncomingCalls([
        { id: 1, fanName: 'Sarah M.', type: 'video', tokens: 150 },
        { id: 2, fanName: 'John D.', type: 'voice', tokens: 75 }
      ]);

      setScheduledCalls([
        { id: 3, fanName: 'Emma W.', type: 'video', tokens: 200, scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000) },
        { id: 4, fanName: 'Mike R.', type: 'voice', tokens: 100, scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000) }
      ]);
      */
    } catch (error) {
      console.error('Error fetching calls:', error);
    }
  };

  const fetchTopFans = async () => {
    try {
      // TODO: Replace with actual API call when endpoint is ready
      // const response = await api.analytics.getTopFans({ period: 'week' });
      // setTopFans(response.data || []);

      setTopFans([]);
    } catch (error) {
      console.error('Error fetching top fans:', error);
      setTopFans([]);
    }
  };

  const fetchUpcomingSchedule = async () => {
    try {
      // TODO: Replace with actual API call when endpoint is ready
      // const response = await api.schedule.getUpcoming();
      // setUpcomingSchedule(response.data || []);

      setUpcomingSchedule([]);
    } catch (error) {
      console.error('Error fetching upcoming schedule:', error);
      setUpcomingSchedule([]);
    }
  };

  const fetchCreatorStats = useCallback(async () => {
    try {
      console.log('📊 Starting to fetch creator stats...');

      // Fetch real follower/subscriber count from API
      const response = await api.get('/api/creators/stats');

      if (response.data && response.data.success) {
        setStats({
          todayEarnings: 0,
          weekEarnings: 0,
          monthEarnings: 0,
          totalFans: 0,
          activeFans: 0,
          pendingMessages: 0,
          scheduledCalls: 0,
          upcomingStreams: 0,
          subscribers: response.data.subscribersCount || 0,
          followers: response.data.followersCount || 0
        });
        console.log('✅ Stats updated successfully with follower count:', response.data.followersCount);
      } else {
        // Fallback to default stats
        setStats(DEFAULT_STATS);
      }
    } catch (error) {
      console.error('❌ Error fetching creator stats:', error);
      // Set default values to prevent empty dashboard
      setStats(DEFAULT_STATS);
    } finally {
      console.log('🏁 Stats fetch completed');
      // We're not managing loading state anymore - dashboard shows immediately
    }
  }, []);

  const quickActions = [
    {
      id: 'go-live',
      title: 'Go Live',
      icon: SparklesIcon,
      color: 'bg-gradient-to-r from-red-500 to-pink-500',
      onClick: () => {
        console.log('🚨 Go Live button clicked!');
        console.log('Props received:', { 
          hasOnShowGoLive: !!onShowGoLive,
          typeOfOnShowGoLive: typeof onShowGoLive
        });
        
        // Try to call the handler
        try {
          if (onShowGoLive && typeof onShowGoLive === 'function') {
            console.log('✅ Calling onShowGoLive function');
            onShowGoLive();
            // Also show an alert to confirm the click worked
            setTimeout(() => {
              if (!document.querySelector('[data-golive-modal]')) {
                console.error('❌ Modal did not appear after calling onShowGoLive');
                alert('Button clicked but modal did not open. Check console.');
              }
            }, 100);
          } else {
            console.error('❌ onShowGoLive is not a function:', onShowGoLive);
            toast.error('Go Live feature unavailable');
          }
        } catch (error) {
          console.error('❌ Error calling onShowGoLive:', error);
          toast.error('Failed to open Go Live');
        }
      },
      description: ''
    },
    {
      id: 'schedule',
      title: 'Schedule',
      icon: CalendarIcon,
      color: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      onClick: () => {
        console.log('Schedule clicked');
        if (onShowAvailability) {
          onShowAvailability();
        } else if (onNavigate) {
          // Fallback to navigate to schedule page
          onNavigate('schedule');
        } else {
          console.error('onShowAvailability is not defined');
        }
      },
      description: ''
    },
    {
      id: 'content',
      title: 'Content',
      icon: PhotoIcon,
      color: 'bg-gradient-to-r from-purple-500 to-indigo-500',
      onClick: () => {
        console.log('Content clicked');
        if (onShowContent) {
          onShowContent();
        } else if (onNavigate) {
          onNavigate('content');
        } else {
          console.error('onShowContent is not defined');
        }
      },
      description: ''
    },
    {
      id: 'wallet',
      title: 'Wallet',
      icon: WalletIcon,
      color: 'bg-gradient-to-r from-green-500 to-emerald-500',
      onClick: () => {
        console.log('Wallet clicked');
        if (onShowEarnings) {
          onShowEarnings();
        } else if (onNavigate) {
          onNavigate('wallet');
        } else {
          console.error('onShowEarnings is not defined');
        }
      },
      description: '',
      badge: tokenBalance
    }
  ];


  // Pull-to-refresh handlers
  const handleTouchStart = (e) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].pageY);
    }
  };

  const handleTouchMove = (e) => {
    if (startY && window.scrollY === 0) {
      const currentY = e.touches[0].pageY;
      const distance = Math.max(0, currentY - startY);
      setPullDistance(Math.min(distance, 100));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 50) {
      setIsRefreshing(true);
      // Haptic feedback for refresh
      if (window.navigator.vibrate) {
        window.navigator.vibrate(10);
      }
      await fetchAllData();
      setTimeout(() => {
        setIsRefreshing(false);
        toast.success('Dashboard refreshed');
      }, 500);
    }
    setPullDistance(0);
    setStartY(0);
  };

  // Format time until event
  const getTimeUntil = (date) => {
    const now = new Date();
    const diff = date - now;

    if (diff < 0) return 'Starting soon';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `in ${days}d ${hours % 24}h`;
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
  };

  // Get icon for event type
  const getEventIcon = (type) => {
    switch(type) {
      case 'stream':
        return <VideoCameraIcon className="w-4 h-4 text-red-500" />;
      case 'video-call':
        return <VideoCameraIcon className="w-4 h-4 text-blue-500" />;
      case 'voice-call':
        return <PhoneIcon className="w-4 h-4 text-green-500" />;
      case 'content':
        return <PhotoIcon className="w-4 h-4 text-purple-500" />;
      default:
        return <CalendarIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  // Handle section swipe navigation
  const handleSectionSwipe = (direction) => {
    const sections = ['overview', 'schedule', 'topfans', 'activity'];
    const newIndex = direction === 'left'
      ? Math.min(currentSection + 1, sections.length - 1)
      : Math.max(currentSection - 1, 0);

    if (newIndex !== currentSection) {
      setCurrentSection(newIndex);
      // Haptic feedback
      if (window.navigator.vibrate) {
        window.navigator.vibrate(5);
      }
      // Scroll to section
      sectionsRef.current[newIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Always render something to debug
  console.log('🎯 MobileCreatorDashboard render state:', { loading, stats, user });

  // Dashboard always renders immediately - no loading state
  console.log('🎨 Rendering main dashboard with stats:', stats);
  return (
    <div
      className="min-h-screen bg-white"
      style={{ minHeight: '-webkit-fill-available' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-purple-600 transition-all"
          style={{
            height: `${pullDistance}px`,
            opacity: Math.min(pullDistance / 50, 1)
          }}
        >
          <div className={`${pullDistance > 50 ? 'animate-spin' : ''}`}>
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      )}

      {/* Loading spinner overlay */}
      {isRefreshing && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-white rounded-full p-3 shadow-lg">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
          </div>
        </div>
      )}
      {/* Header with safe area handling */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white pb-12" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-safe">
          <div className="px-4 pt-4">
            {/* Username and stats on same row */}
            <div className="flex justify-between items-center mb-4">
              {/* Avatar and Username on the left */}
              <div className="flex items-center gap-3">
                {/* User Avatar */}
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  {user?.profile_pic_url ? (
                    <img
                      src={user.profile_pic_url}
                      alt={user.username}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-xl">
                      {user?.username?.[0]?.toUpperCase() || user?.display_name?.[0]?.toUpperCase() || 'C'}
                    </span>
                  )}
                </div>
                {/* Username without @ */}
                <p className="text-white font-semibold text-lg">
                  {user?.username || user?.display_name || user?.email?.split('@')[0] || 'creator'}
                </p>
              </div>

              {/* Followers and Tokens on the right */}
              <div className="flex items-center gap-3">
                {/* Followers Button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onNavigate && onNavigate('followers')}
                  className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5"
                >
                  <UserGroupIcon className="w-5 h-5 text-white" />
                  <span className="font-bold text-white">{stats.followers || 0}</span>
                </motion.button>

                {/* Tokens Button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onShowEarnings}
                  className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5"
                >
                  <CurrencyDollarIcon className="w-5 h-5 text-white" />
                  <span className="font-bold text-white">{tokenBalance || 0}</span>
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions - Mobile Optimized Style */}
      <div className="px-safe" style={{ position: 'relative', zIndex: 20 }}>
        <div className="px-3 -mt-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-2" style={{ position: 'relative', zIndex: 20 }}>
            <div className="grid grid-cols-4 gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    runOnce(() => {
                      console.log(`🔘 Button clicked: ${action.title}`);

                      // Haptic feedback
                      if (window.navigator.vibrate) {
                        window.navigator.vibrate(10);
                      }

                      // Call handler with small delay to allow animation
                      requestAnimationFrame(() => {
                        if (action.onClick && typeof action.onClick === 'function') {
                          console.log('✅ Calling handler for:', action.title);
                          try {
                            action.onClick();
                            console.log('✅ Handler completed for:', action.title);
                          } catch (error) {
                            console.error('❌ Handler error:', error);
                          }
                        } else {
                          console.error('❌ No handler for:', action.title);
                        }
                      });
                    });
                  }}
                  className={`
                    touch-safe
                    relative
                    flex flex-col items-center justify-center
                    gap-1
                    px-1 py-3
                    rounded-lg
                    transition-transform duration-150
                    min-h-[60px]
                    ${action.color} text-white shadow-md
                    active:scale-95
                    cursor-pointer select-none
                  `}
                  style={{
                    position: 'relative',
                    zIndex: 30,
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                  aria-label={action.title}
                  type="button"
                >
                  <action.icon className="w-6 h-6 flex-shrink-0" strokeWidth={2} style={{ pointerEvents: 'none' }} />
                  <span className="text-[11px] font-semibold leading-tight" style={{ pointerEvents: 'none' }}>
                    {action.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>


      {/* Calls Section - Only show if there are calls */}
      {(incomingCalls.length > 0 || scheduledCalls.length > 0) && (
        <div className="px-safe mt-6">
          <div className="px-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <PhoneIcon className="w-5 h-5 mr-2 text-purple-600" />
                Calls
              </h2>
              <span className="text-sm text-gray-500">
                {incomingCalls.length + scheduledCalls.length} pending
              </span>
            </div>

            <div className="space-y-3">
              {/* Incoming Calls - Priority */}
              {incomingCalls.map((call) => (
                <motion.div
                  key={call.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  drag="x"
                  dragConstraints={{ left: -100, right: 100 }}
                  onDragEnd={(e, { offset }) => {
                    if (offset.x > 80) {
                      // Accept call
                      console.log('Accept call:', call.id);
                      setIncomingCalls(prev => prev.filter(c => c.id !== call.id));
                    } else if (offset.x < -80) {
                      // Decline call
                      console.log('Decline call:', call.id);
                      setIncomingCalls(prev => prev.filter(c => c.id !== call.id));
                    }
                  }}
                  className="relative bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4 shadow-lg"
                >
                  {/* Swipe indicators */}
                  <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
                    <div className="bg-green-500/20 rounded-lg px-3 py-1">
                      <span className="text-green-700 text-xs font-semibold">← Accept</span>
                    </div>
                    <div className="bg-red-500/20 rounded-lg px-3 py-1">
                      <span className="text-red-700 text-xs font-semibold">Decline →</span>
                    </div>
                  </div>

                  {/* Call content */}
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                            {call.type === 'video' ? (
                              <VideoCameraIcon className="w-6 h-6 text-white" />
                            ) : (
                              <PhoneIcon className="w-6 h-6 text-white" />
                            )}
                          </div>
                          {/* Ringing animation */}
                          <div className="absolute inset-0 w-12 h-12 bg-green-500 rounded-full animate-ping" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{call.fanName}</p>
                          <p className="text-sm text-green-600 font-medium">Incoming {call.type} call</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{call.tokens}</p>
                        <p className="text-xs text-gray-500">tokens</p>
                      </div>
                    </div>

                    {/* Action buttons for non-swipe interaction */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          console.log('Accept call:', call.id);
                          setIncomingCalls(prev => prev.filter(c => c.id !== call.id));
                        }}
                        className="flex-1 bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          console.log('Decline call:', call.id);
                          setIncomingCalls(prev => prev.filter(c => c.id !== call.id));
                        }}
                        className="flex-1 bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Scheduled Calls with Countdown */}
              {scheduledCalls.map((call) => (
                <ScheduledCallCard key={call.id} call={call} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Schedule - Horizontal Scrollable */}
      <div className="mt-6">
        <div className="px-4 mb-3">
          <h2 className="text-lg font-bold text-gray-800">
            Schedule
          </h2>
        </div>

        {/* Skeleton Loader for Schedule */}
        {loadingStates.schedule ? (
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 px-4 pb-2" style={{ width: 'max-content' }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse"
                  style={{ minWidth: '200px', maxWidth: '250px' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                    <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
                  </div>
                  <div className="h-4 w-full bg-gray-200 rounded mb-1"></div>
                  <div className="h-3 w-3/4 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        ) : upcomingSchedule.length > 0 ? (
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 px-4 pb-2" style={{ width: 'max-content' }}>
              {upcomingSchedule.slice(0, 5).map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    // Haptic feedback
                    if (window.navigator.vibrate) {
                      window.navigator.vibrate(5);
                    }
                    // Navigate to schedule page
                    if (onNavigate) {
                      onNavigate('schedule');
                    }
                  }}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
                  style={{ minWidth: '200px', maxWidth: '250px' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      {getEventIcon(event.type)}
                    </div>
                    <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                      {getTimeUntil(event.startTime)}
                    </span>
                  </div>

                  <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
                    {event.title}
                  </h3>

                  <div className="text-xs text-gray-500">
                    {event.type === 'stream' && (
                      <div className="flex items-center gap-2">
                        <UsersIcon className="w-3 h-3" />
                        <span>{event.expectedViewers} expected</span>
                      </div>
                    )}
                    {(event.type === 'video-call' || event.type === 'voice-call') && (
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-3 h-3" />
                        <span>{event.duration} min · {event.tokens} tokens</span>
                      </div>
                    )}
                    {event.type === 'content' && (
                      <div className="flex items-center gap-2">
                        <PhotoIcon className="w-3 h-3" />
                        <span>{event.contentCount} items</span>
                      </div>
                    )}
                  </div>

                  {/* Progress indicator for next event */}
                  {index === 0 && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <motion.div
                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-1 rounded-full"
                          initial={{ width: '0%' }}
                          animate={{ width: '60%' }}
                          transition={{ duration: 1 }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Enhanced Recent Activity Feed */}
      <div className="px-safe mt-6 mb-8">
        <div className="px-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-gray-800">Activity</h2>
          </div>

          {/* Skeleton Loader for Activity */}
          {loadingStates.activity ? (
            <div className="space-y-3">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <div className="h-3 w-12 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="divide-y divide-gray-100">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                        <div>
                          <div className="h-4 w-24 bg-gray-200 rounded mb-1"></div>
                          <div className="h-3 w-32 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                      <div className="h-4 w-16 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Today's Activities */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Today</p>
              </div>
              <div className="divide-y divide-gray-100">
                {[].map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                    onClick={activity.onClick}
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div className={`${activity.iconBg} p-2 rounded-full text-white`}>
                        {activity.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {activity.detail} · {activity.time}
                        </p>
                      </div>
                    </div>

                    {/* Value or Action */}
                    {activity.value ? (
                      <span className={`text-sm font-semibold ${activity.valueColor}`}>
                        {activity.value}
                      </span>
                    ) : activity.action ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          activity.onClick();
                        }}
                        className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium hover:bg-purple-200 transition-colors"
                      >
                        {activity.action}
                      </button>
                    ) : null}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Live Indicator (if live) */}
            {false && ( // Set to true when actually live
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-r from-red-500 to-pink-500 rounded-xl p-4 text-white"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                      <div className="absolute inset-0 w-3 h-3 bg-white rounded-full animate-ping" />
                    </div>
                    <div>
                      <p className="font-semibold">You're Live!</p>
                      <p className="text-xs text-white/80">234 viewers</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('streaming')}
                    className="bg-white/20 backdrop-blur px-3 py-1 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
                  >
                    View Stream
                  </button>
                </div>
              </motion.div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Top Gifters This Week */}
      <div className="px-safe mt-6 mb-20">
        <div className="px-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-gray-800">
              Top Gifters
            </h2>
            <span className="text-sm text-gray-500">This week</span>
          </div>

          {/* Skeleton Loader for Top Gifters */}
          {loadingStates.topFans ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div className="h-4 w-24 bg-gray-200 rounded"></div>
                    </div>
                    <div className="h-4 w-20 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {topFans.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {topFans.slice(0, 3).map((fan, index) => (
                  <motion.div
                    key={fan.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => {
                      console.log('Navigating to fan profile:', fan.username);
                      if (onNavigate) {
                        onNavigate('fan-profile', { fanId: fan.id, username: fan.username });
                      }
                    }}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      {/* Rank Badge and Fan Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Rank Badge */}
                        <div className={`flex items-center justify-center p-2 rounded-full font-bold text-sm ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg' :
                          index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white shadow-md' :
                          'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-md'
                        }`}>
                          {index + 1}
                        </div>

                        {/* Fan Username */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate hover:text-purple-600 transition-colors">
                            @{fan.username}
                          </p>
                        </div>
                      </div>

                      {/* Tokens Spent */}
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">{fan.total_spent} tokens</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <TrophyIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No gifter activity this week</p>
                <p className="text-xs text-gray-400 mt-1">Start engaging to see your top supporters!</p>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

    </div>
  );
};

MobileCreatorDashboard.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    username: PropTypes.string,
    display_name: PropTypes.string,
    email: PropTypes.string,
    profile_pic_url: PropTypes.string
  }).isRequired,
  tokenBalance: PropTypes.number.isRequired,
  onNavigate: PropTypes.func.isRequired,
  onShowGoLive: PropTypes.func.isRequired,
  onShowAvailability: PropTypes.func.isRequired,
  onShowEarnings: PropTypes.func.isRequired,
  onShowSettings: PropTypes.func.isRequired,
  onShowContent: PropTypes.func.isRequired,
  onShowMessages: PropTypes.func.isRequired
};

export default MobileCreatorDashboard;