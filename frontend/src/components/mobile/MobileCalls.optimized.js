// Optimized MobileCalls with virtual lists for performance
// Handles thousands of call records without lag

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import VirtualCallsList from './VirtualCallsList';
import { apiClient } from '../../utils/apiClient';
import { realtimeService, EVENTS, useRealtime } from '../../services/realtimeService';
import { useHaptics } from '../../hooks/useHaptics';
import { useTimers } from '../../hooks/useTimers';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { devLog } from '../../utils/devLog';
import toast from 'react-hot-toast';

import {
  PhoneIcon,
  VideoCameraIcon,
  ClockIcon,
  CalendarIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  PhoneArrowDownLeftIcon,
  PhoneArrowUpRightIcon,
  PhoneXMarkIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';

const MobileCallsOptimized = ({
  user,
  isCreator,
  onStartCall,
  onNavigate
}) => {
  // Hooks
  const haptics = useHaptics();
  const timers = useTimers();

  // Realtime for incoming calls
  const realtime = useRealtime({
    [EVENTS.CALL_INCOMING]: handleIncomingCall,
    [EVENTS.CALL_ACCEPTED]: handleCallAccepted,
    [EVENTS.CALL_REJECTED]: handleCallRejected,
    [EVENTS.CALL_ENDED]: handleCallEnded,
    [EVENTS.CALL_MISSED]: handleCallMissed
  });

  // State
  const [activeTab, setActiveTab] = useState('all');
  const [calls, setCalls] = useState([]);
  const [filteredCalls, setFilteredCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, missed, incoming, outgoing
  const [showFilters, setShowFilters] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  // Refs
  const listRef = useRef(null);
  const currentPage = useRef(1);

  // Tabs configuration
  const tabs = [
    { id: 'all', label: 'All', icon: PhoneIcon },
    { id: 'missed', label: 'Missed', icon: PhoneXMarkIcon },
    { id: 'scheduled', label: 'Scheduled', icon: CalendarIcon }
  ];

  // Filter configuration
  const filters = [
    { id: 'all', label: 'All Calls' },
    { id: 'missed', label: 'Missed', color: 'text-red-500' },
    { id: 'incoming', label: 'Incoming', color: 'text-blue-500' },
    { id: 'outgoing', label: 'Outgoing', color: 'text-green-500' },
    { id: 'video', label: 'Video Calls' },
    { id: 'voice', label: 'Voice Calls' }
  ];

  // Realtime event handlers
  function handleIncomingCall(data) {
    setIncomingCall(data);
    haptics.incomingCall();

    // Show notification
    toast((t) => (
      <div className="flex items-center gap-3">
        <img
          src={data.caller.avatar_url || ''}
          alt=""
          className="w-10 h-10 rounded-full"
        />
        <div className="flex-1">
          <p className="font-medium">{data.caller.name}</p>
          <p className="text-sm text-gray-600">
            Incoming {data.type === 'video' ? 'video' : 'voice'} call
          </p>
        </div>
        <button
          onClick={() => {
            acceptCall(data);
            toast.dismiss(t.id);
          }}
          className="px-3 py-1 bg-green-500 text-white rounded-full text-sm"
        >
          Accept
        </button>
        <button
          onClick={() => {
            rejectCall(data);
            toast.dismiss(t.id);
          }}
          className="px-3 py-1 bg-red-500 text-white rounded-full text-sm"
        >
          Decline
        </button>
      </div>
    ), { duration: 30000 }); // 30 second timeout for call
  }

  function handleCallAccepted(data) {
    setActiveCall(data);
    haptics.success();
  }

  function handleCallRejected(data) {
    setIncomingCall(null);
    toast.error('Call rejected');
  }

  function handleCallEnded(data) {
    setActiveCall(null);
    setIncomingCall(null);
    haptics.tap();

    // Refresh call list
    fetchCalls();
  }

  function handleCallMissed(data) {
    // Add to missed calls
    setCalls(prev => [{
      ...data,
      status: 'missed',
      timestamp: new Date()
    }, ...prev]);

    haptics.warning();
    toast.error('Missed call from ' + data.caller?.name);
  }

  // Accept incoming call
  const acceptCall = useCallback((call) => {
    haptics.success();
    realtime.send({
      type: 'accept_call',
      callId: call.id
    });

    // Navigate to call screen
    if (call.type === 'video') {
      onNavigate?.('videoCall', { call });
    } else {
      onNavigate?.('voiceCall', { call });
    }
  }, [realtime, onNavigate, haptics]);

  // Reject incoming call
  const rejectCall = useCallback((call) => {
    haptics.tap();
    realtime.send({
      type: 'reject_call',
      callId: call.id
    });
    setIncomingCall(null);
  }, [realtime, haptics]);

  // Fetch calls with pagination
  const fetchCalls = useCallback(async (page = 1, append = false) => {
    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await apiClient.get(`/api/calls?page=${page}&limit=50&type=${filterType}`);

      if (response.ok) {
        const data = await response.json();
        const newCalls = data.calls || [];

        if (append) {
          setCalls(prev => [...prev, ...newCalls]);
        } else {
          setCalls(newCalls);
        }

        setHasMore(newCalls.length >= 50);
        currentPage.current = page;

        devLog('Fetched calls:', {
          page,
          count: newCalls.length,
          total: append ? calls.length + newCalls.length : newCalls.length
        });
      }
    } catch (error) {
      devLog('Error fetching calls:', error);
      toast.error('Failed to load calls');

      // Use mock data for demo
      if (page === 1) {
        setCalls(generateMockCalls(100));
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterType, calls.length]);

  // Load more for pagination
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchCalls(currentPage.current + 1, true);
    }
  }, [loadingMore, hasMore, fetchCalls]);

  // Use infinite scroll hook
  const { sentinelRef } = useInfiniteScroll(loadMore, {
    hasMore,
    loading: loadingMore,
    rootMargin: '200px'
  });

  // Search and filter calls
  useEffect(() => {
    let filtered = [...calls];

    // Apply tab filter
    if (activeTab === 'missed') {
      filtered = filtered.filter(call => call.status === 'missed');
    } else if (activeTab === 'scheduled') {
      filtered = filtered.filter(call => call.scheduled);
    }

    // Apply type filter
    if (filterType !== 'all') {
      switch (filterType) {
        case 'missed':
          filtered = filtered.filter(call => call.status === 'missed');
          break;
        case 'incoming':
          filtered = filtered.filter(call => call.direction === 'incoming');
          break;
        case 'outgoing':
          filtered = filtered.filter(call => call.direction === 'outgoing');
          break;
        case 'video':
          filtered = filtered.filter(call => call.type === 'video');
          break;
        case 'voice':
          filtered = filtered.filter(call => call.type === 'voice');
          break;
      }
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(call => {
        const name = call.name || call.username || '';
        return name.toLowerCase().includes(query);
      });
    }

    setFilteredCalls(filtered);
  }, [calls, activeTab, filterType, searchQuery]);

  // Debounced search
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);

    timers.debounce(() => {
      devLog('Search query:', query);
    }, 300)();
  }, [timers]);

  // Handle call click
  const handleCallClick = useCallback((call) => {
    haptics.tap();

    if (call.status === 'missed') {
      // Show call back options
      toast((t) => (
        <div className="flex flex-col gap-2">
          <p className="font-medium">Call back {call.name}?</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onStartCall?.({ ...call, type: 'voice' });
                toast.dismiss(t.id);
              }}
              className="flex-1 px-3 py-1 bg-gray-200 rounded-lg text-sm"
            >
              <PhoneIcon className="w-4 h-4 inline mr-1" />
              Voice
            </button>
            <button
              onClick={() => {
                onStartCall?.({ ...call, type: 'video' });
                toast.dismiss(t.id);
              }}
              className="flex-1 px-3 py-1 bg-purple-600 text-white rounded-lg text-sm"
            >
              <VideoCameraIcon className="w-4 h-4 inline mr-1" />
              Video
            </button>
          </div>
        </div>
      ), { duration: 5000 });
    } else {
      // View call details
      onNavigate?.('callDetails', { call });
    }
  }, [onStartCall, onNavigate, haptics]);

  // Handle call back
  const handleCallBack = useCallback((call) => {
    haptics.tap();
    onStartCall?.({ ...call, type: call.type || 'voice' });
  }, [onStartCall, haptics]);

  // Initial load
  useEffect(() => {
    fetchCalls(1, false);
  }, [filterType]);

  // Generate mock calls for demo
  const generateMockCalls = (count) => {
    const statuses = ['completed', 'missed', 'missed', 'completed', 'completed'];
    const directions = ['incoming', 'outgoing', 'incoming', 'outgoing'];
    const types = ['voice', 'video', 'voice', 'voice', 'video'];

    return Array.from({ length: count }, (_, i) => ({
      id: `call_${i}`,
      name: `Contact ${i + 1}`,
      username: `@user${i + 1}`,
      avatar_url: `https://i.pravatar.cc/150?img=${(i % 50) + 1}`,
      status: statuses[i % statuses.length],
      direction: directions[i % directions.length],
      type: types[i % types.length],
      duration: Math.floor(Math.random() * 600),
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      scheduled: i % 20 === 0
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Calls</h1>
            <button
              onClick={() => {
                setShowFilters(!showFilters);
                haptics.tap();
              }}
              className="p-2 text-gray-600"
            >
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="search"
              placeholder="Search calls..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                haptics.tap();
              }}
              className={`flex-1 py-3 flex items-center justify-center gap-2 relative transition-colors ${
                activeTab === tab.id
                  ? 'text-purple-600'
                  : 'text-gray-500'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"
                />
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t bg-gray-50 px-4 py-3 overflow-hidden"
            >
              <div className="flex gap-2 flex-wrap">
                {filters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => {
                      setFilterType(filter.id);
                      haptics.tap();
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      filterType === filter.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300'
                    }`}
                  >
                    <span className={filter.color}>{filter.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Calls List with Virtual Scrolling */}
      <div className="flex-1" style={{ height: 'calc(100vh - 200px)' }}>
        <VirtualCallsList
          ref={listRef}
          calls={filteredCalls}
          onCallClick={handleCallClick}
          onCallBack={handleCallBack}
          loading={loading}
          emptyMessage={
            searchQuery
              ? 'No calls found'
              : activeTab === 'missed'
              ? 'No missed calls'
              : activeTab === 'scheduled'
              ? 'No scheduled calls'
              : 'No calls yet'
          }
        />

        {/* Infinite scroll sentinel */}
        {hasMore && !loading && (
          <div ref={sentinelRef} className="h-10" />
        )}
      </div>

      {/* Incoming call modal */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end"
          >
            <motion.div className="w-full bg-white rounded-t-3xl p-6 pb-safe">
              <div className="text-center">
                <img
                  src={incomingCall.caller?.avatar_url || ''}
                  alt=""
                  className="w-24 h-24 rounded-full mx-auto mb-4"
                />
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {incomingCall.caller?.name || 'Unknown'}
                </h2>
                <p className="text-gray-600 mb-8">
                  Incoming {incomingCall.type} call...
                </p>

                <div className="flex gap-4">
                  <button
                    onClick={() => rejectCall(incomingCall)}
                    className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-medium flex items-center justify-center gap-2"
                  >
                    <XMarkIcon className="w-6 h-6" />
                    Decline
                  </button>
                  <button
                    onClick={() => acceptCall(incomingCall)}
                    className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-medium flex items-center justify-center gap-2"
                  >
                    {incomingCall.type === 'video' ? (
                      <VideoCameraIcon className="w-6 h-6" />
                    ) : (
                      <PhoneIcon className="w-6 h-6" />
                    )}
                    Accept
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom padding for navigation */}
      <div className="h-20" />
    </div>
  );
};

export default MobileCallsOptimized;