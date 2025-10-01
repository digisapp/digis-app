// Virtual list component optimized for call history
// Handles thousands of call records with smooth scrolling

import React, { useRef, useEffect, useCallback, useState, memo } from 'react';
import { motion } from 'framer-motion';
import {
  PhoneIcon,
  VideoCameraIcon,
  PhoneArrowDownLeftIcon,
  PhoneArrowUpRightIcon,
  PhoneXMarkIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { devLog } from '../../utils/devLog';

// Constants
const ITEM_HEIGHT = 72; // Height of each call item
const OVERSCAN = 3; // Render extra items outside viewport

/**
 * Virtual Calls List Component
 */
const VirtualCallsList = ({
  calls = [],
  onCallClick,
  onCallBack,
  className = '',
  emptyMessage = 'No calls yet',
  loading = false
}) => {
  // Refs
  const containerRef = useRef(null);
  const scrollPositionRef = useRef(0);

  // State
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const [containerHeight, setContainerHeight] = useState(0);

  // Calculate visible range based on scroll position
  const calculateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container || calls.length === 0) return;

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    // Calculate which items are visible
    const start = Math.floor(scrollTop / ITEM_HEIGHT);
    const end = Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT);

    // Add overscan for smoother scrolling
    const overscanStart = Math.max(0, start - OVERSCAN);
    const overscanEnd = Math.min(calls.length, end + OVERSCAN);

    setVisibleRange({ start: overscanStart, end: overscanEnd });
    devLog('Visible range:', { start: overscanStart, end: overscanEnd, total: calls.length });
  }, [calls.length]);

  // Handle scroll with RAF for smoothness
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    scrollPositionRef.current = containerRef.current.scrollTop;

    // Use RAF for smooth updates
    requestAnimationFrame(() => {
      calculateVisibleRange();
    });
  }, [calculateVisibleRange]);

  // Update container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
        calculateVisibleRange();
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [calculateVisibleRange]);

  // Initial calculation
  useEffect(() => {
    calculateVisibleRange();
  }, [calls, calculateVisibleRange]);

  // Get visible calls
  const visibleCalls = calls.slice(visibleRange.start, visibleRange.end);
  const totalHeight = calls.length * ITEM_HEIGHT;

  return (
    <div
      ref={containerRef}
      className={`virtual-calls-list ${className}`}
      onScroll={handleScroll}
      style={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Virtual spacer */}
      <div
        style={{
          height: totalHeight,
          position: 'relative'
        }}
      >
        {/* Render only visible items */}
        {visibleCalls.map((call, index) => {
          const actualIndex = visibleRange.start + index;
          const top = actualIndex * ITEM_HEIGHT;

          return (
            <CallItem
              key={call.id || actualIndex}
              call={call}
              style={{
                position: 'absolute',
                top,
                left: 0,
                right: 0,
                height: ITEM_HEIGHT
              }}
              onClick={() => onCallClick?.(call)}
              onCallBack={() => onCallBack?.(call)}
            />
          );
        })}
      </div>

      {/* Empty state */}
      {calls.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <PhoneIcon className="w-12 h-12 mb-2 opacity-50" />
          <p>{emptyMessage}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

/**
 * Individual call item - memoized for performance
 */
const CallItem = memo(({
  call,
  style,
  onClick,
  onCallBack
}) => {
  const getCallIcon = () => {
    if (call.type === 'video') {
      return <VideoCameraIcon className="w-5 h-5" />;
    }

    switch (call.status) {
      case 'missed':
        return <PhoneXMarkIcon className="w-5 h-5 text-red-500" />;
      case 'incoming':
        return <PhoneArrowDownLeftIcon className="w-5 h-5 text-blue-500" />;
      case 'outgoing':
        return <PhoneArrowUpRightIcon className="w-5 h-5 text-green-500" />;
      default:
        return <PhoneIcon className="w-5 h-5" />;
    }
  };

  const getStatusColor = () => {
    switch (call.status) {
      case 'missed':
        return 'text-red-500';
      case 'active':
        return 'text-green-500';
      case 'ringing':
        return 'text-blue-500';
      default:
        return 'text-gray-600';
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isYesterday) {
      return 'Yesterday';
    }

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div
      style={style}
      className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="relative mr-3">
        {call.avatar_url ? (
          <img
            src={call.avatar_url}
            alt=""
            className="w-12 h-12 rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
            {(call.name || call.username || '?')[0].toUpperCase()}
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
          {getCallIcon()}
        </div>
      </div>

      {/* Call info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 truncate">
            {call.name || call.username || 'Unknown'}
          </h3>
          <span className="text-xs text-gray-500 ml-2">
            {formatTime(call.timestamp || call.created_at)}
          </span>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${getStatusColor()}`}>
              {call.status === 'missed' ? 'Missed' :
               call.status === 'incoming' ? 'Incoming' :
               call.status === 'outgoing' ? 'Outgoing' :
               call.status === 'active' ? 'Active' :
               'Completed'}
            </span>
            {call.duration && (
              <span className="text-sm text-gray-500">
                • {formatDuration(call.duration)}
              </span>
            )}
          </div>

          {/* Call back button for missed calls */}
          {call.status === 'missed' && onCallBack && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onCallBack();
              }}
              className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full"
            >
              Call back
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
});

CallItem.displayName = 'CallItem';

/**
 * Utility functions
 */
export const utils = {
  // Scroll to top
  scrollToTop: (containerRef) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  },

  // Scroll to specific call
  scrollToCall: (containerRef, callIndex) => {
    if (containerRef.current) {
      const scrollTop = callIndex * ITEM_HEIGHT;
      containerRef.current.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
    }
  },

  // Get visible call count
  getVisibleCount: (containerHeight) => {
    return Math.ceil(containerHeight / ITEM_HEIGHT);
  }
};

export default VirtualCallsList;