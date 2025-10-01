// High-performance virtual list for messages
// Only renders visible messages, handles 10,000+ messages smoothly

import React, { useRef, useEffect, useCallback, useState, memo, forwardRef } from 'react';
import { devLog } from '../../utils/devLog';

// Constants for performance tuning
const ITEM_HEIGHT_ESTIMATE = 80; // Average message height
const OVERSCAN_COUNT = 5; // Render extra items outside viewport
const SCROLL_DEBOUNCE = 10; // Debounce scroll events
const BATCH_SIZE = 50; // Load messages in batches

/**
 * Virtual Message List Component
 * Renders only visible messages for optimal performance
 */
const VirtualMessageList = forwardRef(({
  messages = [],
  renderMessage,
  onLoadMore,
  hasMore = false,
  loading = false,
  inverted = true, // Chat UI is typically inverted
  className = '',
  emptyMessage = 'No messages yet',
  userId, // Current user ID for message alignment
  onScroll
}, ref) => {
  // Refs
  const containerRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const heightCacheRef = useRef(new Map());

  // State
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const [containerHeight, setContainerHeight] = useState(0);
  const [totalHeight, setTotalHeight] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);

  // Calculate which messages are visible
  const calculateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container || messages.length === 0) return;

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    // For inverted list, calculate from bottom
    const effectiveScrollTop = inverted
      ? totalHeight - scrollTop - viewportHeight
      : scrollTop;

    // Estimate visible range
    const estimatedStart = Math.floor(effectiveScrollTop / ITEM_HEIGHT_ESTIMATE);
    const estimatedEnd = Math.ceil((effectiveScrollTop + viewportHeight) / ITEM_HEIGHT_ESTIMATE);

    // Add overscan for smoother scrolling
    const start = Math.max(0, estimatedStart - OVERSCAN_COUNT);
    const end = Math.min(messages.length, estimatedEnd + OVERSCAN_COUNT);

    setVisibleRange({ start, end });

    devLog('Visible range:', { start, end, total: messages.length });
  }, [messages.length, totalHeight, inverted]);

  // Handle scroll events with debouncing
  const handleScroll = useCallback((e) => {
    const container = e.target;
    scrollPositionRef.current = container.scrollTop;

    // Detect if user is scrolling
    isScrollingRef.current = true;
    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);

    // Check if auto-scroll should be disabled
    if (inverted) {
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      setIsAutoScrolling(isAtBottom);
    }

    // Debounced range calculation
    if (!scrollTimeoutRef.current) {
      scrollTimeoutRef.current = setTimeout(() => {
        calculateVisibleRange();
        scrollTimeoutRef.current = null;
      }, SCROLL_DEBOUNCE);
    }

    // Load more when near top (for inverted lists)
    if (inverted && hasMore && !loading && container.scrollTop < 200) {
      onLoadMore?.();
    }

    // Call parent scroll handler
    onScroll?.(e);
  }, [calculateVisibleRange, inverted, hasMore, loading, onLoadMore, onScroll]);

  // Update container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate total height
  useEffect(() => {
    const estimatedHeight = messages.length * ITEM_HEIGHT_ESTIMATE;
    setTotalHeight(estimatedHeight);
  }, [messages.length]);

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (inverted && isAutoScrolling && !isScrollingRef.current) {
      const container = containerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages.length, inverted, isAutoScrolling]);

  // Initial calculation
  useEffect(() => {
    calculateVisibleRange();
  }, [calculateVisibleRange, messages]);

  // Render individual message with positioning
  const renderMessageWrapper = useCallback((message, index) => {
    const isOwnMessage = message.sender === userId || message.sender_id === userId;
    const key = message.id || `msg-${index}`;

    // Calculate position
    const itemStyle = {
      position: 'absolute',
      top: inverted
        ? undefined
        : index * ITEM_HEIGHT_ESTIMATE,
      bottom: inverted
        ? (messages.length - index - 1) * ITEM_HEIGHT_ESTIMATE
        : undefined,
      left: 0,
      right: 0,
      minHeight: ITEM_HEIGHT_ESTIMATE
    };

    return (
      <div
        key={key}
        style={itemStyle}
        data-index={index}
        className="message-wrapper"
      >
        {renderMessage(message, index, isOwnMessage)}
      </div>
    );
  }, [userId, inverted, messages.length, renderMessage]);

  // Get visible messages
  const visibleMessages = messages.slice(visibleRange.start, visibleRange.end);

  return (
    <div
      ref={containerRef}
      className={`virtual-message-list ${className}`}
      onScroll={handleScroll}
      style={{
        position: 'relative',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
      }}
    >
      {/* Virtual spacer to maintain scroll height */}
      <div
        style={{
          height: totalHeight,
          position: 'relative',
          pointerEvents: visibleMessages.length === 0 ? 'none' : 'auto'
        }}
      >
        {/* Render only visible messages */}
        {visibleMessages.map((message, i) => {
          const actualIndex = visibleRange.start + i;
          return renderMessageWrapper(message, actualIndex);
        })}
      </div>

      {/* Empty state */}
      {messages.length === 0 && !loading && (
        <div className="flex items-center justify-center h-full text-gray-500">
          {emptyMessage}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center p-4">
          <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
});

VirtualMessageList.displayName = 'VirtualMessageList';

/**
 * Message item component - memoized for performance
 */
export const MessageItem = memo(({
  message,
  isOwnMessage,
  showTimestamp = true,
  showAvatar = true,
  onAvatarClick
}) => {
  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} px-4 mb-2`}>
      {/* Avatar for other's messages */}
      {!isOwnMessage && showAvatar && (
        <div
          className="flex-shrink-0 mr-2 cursor-pointer"
          onClick={() => onAvatarClick?.(message.sender)}
        >
          {message.sender_avatar ? (
            <img
              src={message.sender_avatar}
              alt=""
              className="w-8 h-8 rounded-full"
              loading="lazy"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm">
              {message.sender_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>
      )}

      {/* Message bubble */}
      <div className={`max-w-[70%] ${
        isOwnMessage
          ? 'bg-purple-600 text-white rounded-2xl rounded-tr-sm'
          : 'bg-white text-gray-900 rounded-2xl rounded-tl-sm shadow-sm'
      } px-4 py-2`}>
        {/* Message content */}
        {message.type === 'image' ? (
          <img
            src={message.content}
            alt=""
            className="rounded-lg max-w-full"
            loading="lazy"
          />
        ) : message.type === 'audio' ? (
          <audio controls className="max-w-full">
            <source src={message.content} />
          </audio>
        ) : (
          <p className={isOwnMessage ? 'text-white' : 'text-gray-900'}>
            {message.content}
          </p>
        )}

        {/* Timestamp */}
        {showTimestamp && (
          <p className={`text-xs mt-1 ${
            isOwnMessage ? 'text-purple-100' : 'text-gray-500'
          }`}>
            {formatTime(message.timestamp || message.created_at)}
            {message.status === 'sending' && ' • Sending...'}
            {message.status === 'failed' && ' • Failed'}
            {message.status === 'queued' && ' • Queued'}
          </p>
        )}
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

// Export utilities
export const utils = {
  scrollToBottom: (containerRef) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  },

  scrollToMessage: (containerRef, messageId) => {
    const element = containerRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
};

export default VirtualMessageList;