import React, { useState, useRef, useEffect } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion';
import { useMediaQuery } from '../../hooks/useMediaQuery';

/**
 * Pull-to-refresh component for mobile interfaces
 * Features: smooth animations, haptic feedback, customizable threshold
 */
const PullToRefresh = ({
  children,
  onRefresh,
  refreshThreshold = 80,
  isRefreshing = false,
  disabled = false,
  refreshMessage = "Pull to refresh",
  releaseMessage = "Release to refresh",
  refreshingMessage = "Refreshing...",
  ...props
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, refreshThreshold], [0, 1]);
  const scale = useTransform(y, [0, refreshThreshold], [0.8, 1]);
  const rotate = useTransform(y, [0, refreshThreshold], [0, 180]);

  // Haptic feedback utility
  const triggerHaptic = (type = 'light') => {
    if (navigator.vibrate) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30]
      };
      navigator.vibrate(patterns[type] || patterns.light);
    }
  };

  const handleTouchStart = (e) => {
    if (disabled || !isMobile || isRefreshing) return;
    
    // Only allow pull-to-refresh when at the top of the page
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop > 0) return;

    touchStartY.current = e.touches[0].clientY;
    setIsPulling(true);
  };

  const handleTouchMove = (e) => {
    if (!isPulling || disabled || !isMobile || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - touchStartY.current);
    
    // Apply diminishing returns for smoother feel
    const adjustedDistance = distance * 0.5;
    
    setPullDistance(adjustedDistance);
    y.set(adjustedDistance);

    const newCanRefresh = adjustedDistance >= refreshThreshold;
    if (newCanRefresh !== canRefresh) {
      setCanRefresh(newCanRefresh);
      triggerHaptic(newCanRefresh ? 'medium' : 'light');
    }

    // Prevent default scrolling
    if (distance > 10) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling) return;

    setIsPulling(false);
    
    if (canRefresh && !isRefreshing && onRefresh) {
      triggerHaptic('heavy');
      onRefresh();
    }

    // Reset state
    setPullDistance(0);
    setCanRefresh(false);
    y.set(0);
  };

  // Reset when refreshing completes
  useEffect(() => {
    if (!isRefreshing) {
      setPullDistance(0);
      setCanRefresh(false);
      y.set(0);
    }
  }, [isRefreshing, y]);

  const getRefreshIcon = () => {
    if (isRefreshing) {
      return (
        <motion.div
          className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      );
    }

    return (
      <motion.svg
        className="w-6 h-6 text-primary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        style={{ rotate }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 14l-7 7m0 0l-7-7m7 7V3"
        />
      </motion.svg>
    );
  };

  const getMessage = () => {
    if (isRefreshing) return refreshingMessage;
    if (canRefresh) return releaseMessage;
    return refreshMessage;
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      {...props}
    >
      {/* Pull indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 z-10 flex flex-col items-center justify-center bg-surface/95 backdrop-blur-sm"
        style={{
          opacity,
          scale,
          height: Math.min(pullDistance, refreshThreshold + 20)
        }}
        initial={{ y: -100 }}
        animate={{ y: isPulling ? 0 : -100 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center space-x-2 py-4">
          {getRefreshIcon()}
          <motion.span
            className="text-sm text-text-secondary font-medium"
            animate={{ 
              color: canRefresh ? 'var(--color-primary-600)' : 'var(--color-text-secondary)' 
            }}
          >
            {getMessage()}
          </motion.span>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        style={{ y }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {children}
      </motion.div>

      {/* Loading overlay */}
      {isRefreshing && (
        <motion.div
          className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          exit={{ scaleX: 0 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </div>
  );
};

export default PullToRefresh;