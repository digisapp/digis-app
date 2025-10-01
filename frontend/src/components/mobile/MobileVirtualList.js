import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import InfiniteLoader from 'react-window-infinite-loader';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobileUI } from './MobileUIProvider';

// Memoized row component for performance
const Row = memo(({ index, style, data }) => {
  const { items, renderItem, onItemClick } = data;
  const item = items[index];

  if (!item) {
    return (
      <div style={style} className="mobile-virtual-list-loading">
        <div className="mobile-skeleton-card" />
      </div>
    );
  }

  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      onClick={() => onItemClick?.(item)}
      className="mobile-virtual-list-item"
    >
      {renderItem(item, index)}
    </motion.div>
  );
});

Row.displayName = 'VirtualListRow';

const MobileVirtualList = ({
  items = [],
  renderItem,
  onItemClick,
  loadMore,
  hasMore = false,
  isLoading = false,
  itemHeight = 100,
  getItemSize,
  headerComponent,
  footerComponent,
  emptyComponent,
  refreshing = false,
  onRefresh,
  threshold = 5,
  className = ''
}) => {
  const listRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { triggerHaptic, isPullToRefresh } = useMobileUI();
  
  // Track scroll position for various optimizations
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  // Handle pull to refresh
  useEffect(() => {
    if (isPullToRefresh && onRefresh && !isRefreshing) {
      handleRefresh();
    }
  }, [isPullToRefresh]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    triggerHaptic('medium');
    
    try {
      await onRefresh?.();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, triggerHaptic, isRefreshing]);

  // Calculate item size dynamically or use provided function
  const getSize = useCallback((index) => {
    if (getItemSize) {
      return getItemSize(index);
    }
    // Add extra height for first and last items (padding)
    if (index === 0 || index === items.length - 1) {
      return itemHeight + 20;
    }
    return itemHeight;
  }, [getItemSize, itemHeight, items.length]);

  // Infinite loading configuration
  const itemCount = hasMore ? items.length + 1 : items.length;
  
  const isItemLoaded = useCallback((index) => {
    return !hasMore || index < items.length;
  }, [hasMore, items.length]);

  const loadMoreItems = useCallback(() => {
    if (!isLoading && hasMore) {
      return loadMore();
    }
    return Promise.resolve();
  }, [isLoading, hasMore, loadMore]);

  // Handle scroll events for various features
  const handleScroll = useCallback(({ scrollOffset, scrollDirection }) => {
    setScrollOffset(scrollOffset);
    
    // Trigger haptic feedback at boundaries
    if (scrollOffset <= 0 && scrollDirection === 'backward') {
      triggerHaptic('light');
    }
  }, [triggerHaptic]);

  // Optimize rendering during scroll
  const itemData = {
    items,
    renderItem,
    onItemClick
  };

  if (items.length === 0 && !isLoading) {
    return (
      <div className="mobile-virtual-list-empty">
        {emptyComponent || (
          <div className="text-center py-20">
            <p className="text-gray-500">No items to display</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`mobile-virtual-list-container ${className}`}>
      {headerComponent}
      
      {isRefreshing && (
        <div className="mobile-virtual-list-refresh">
          <div className="mobile-spinner" />
          <span>Refreshing...</span>
        </div>
      )}

      <AutoSizer>
        {({ height, width }) => (
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={itemCount}
            loadMoreItems={loadMoreItems}
            threshold={threshold}
          >
            {({ onItemsRendered, ref }) => (
              <List
                ref={(list) => {
                  ref(list);
                  listRef.current = list;
                }}
                height={height}
                width={width}
                itemCount={itemCount}
                itemSize={getSize}
                itemData={itemData}
                onScroll={handleScroll}
                onItemsRendered={onItemsRendered}
                overscanCount={3}
                useIsScrolling
                className="mobile-virtual-list"
              >
                {Row}
              </List>
            )}
          </InfiniteLoader>
        )}
      </AutoSizer>

      {footerComponent}

      <style jsx>{`
        .mobile-virtual-list-container {
          height: 100%;
          width: 100%;
          position: relative;
        }

        .mobile-virtual-list {
          overscroll-behavior-y: contain;
          -webkit-overflow-scrolling: touch;
        }

        .mobile-virtual-list-item {
          padding: 0 16px;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .mobile-virtual-list-item:active {
          transform: scale(0.98);
        }

        .mobile-virtual-list-loading {
          padding: 16px;
        }

        .mobile-skeleton-card {
          height: 80px;
          background: linear-gradient(
            90deg,
            #f0f0f0 25%,
            #e0e0e0 50%,
            #f0f0f0 75%
          );
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: 12px;
        }

        @keyframes loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        .mobile-virtual-list-refresh {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 20px;
          background: linear-gradient(to bottom, white, transparent);
          z-index: 10;
        }

        .mobile-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #e0e0e0;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .mobile-virtual-list-empty {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
};

export default memo(MobileVirtualList);