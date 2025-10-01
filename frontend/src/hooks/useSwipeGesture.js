import { useEffect, useRef } from 'react';

/**
 * Modern swipe gesture hook with velocity detection and haptic feedback
 * Supports horizontal and vertical swipes with customizable thresholds
 */
export const useSwipeGesture = ({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  velocityThreshold = 0.3,
  element = null
}) => {
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const touchEndRef = useRef({ x: 0, y: 0, time: 0 });
  const isSwipingRef = useRef(false);

  useEffect(() => {
    const targetElement = element || document;
    
    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
      isSwipingRef.current = false;
    };

    const handleTouchMove = (e) => {
      if (!touchStartRef.current.time) return;
      
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      
      // Detect if user is swiping
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        isSwipingRef.current = true;
      }
    };

    const handleTouchEnd = (e) => {
      if (!touchStartRef.current.time) return;
      
      const touch = e.changedTouches[0];
      touchEndRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };

      const deltaX = touchEndRef.current.x - touchStartRef.current.x;
      const deltaY = touchEndRef.current.y - touchStartRef.current.y;
      const deltaTime = touchEndRef.current.time - touchStartRef.current.time;
      
      // Calculate velocity
      const velocityX = Math.abs(deltaX / deltaTime);
      const velocityY = Math.abs(deltaY / deltaTime);
      
      // Determine if it's a valid swipe
      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
      const meetsThreshold = isHorizontalSwipe 
        ? Math.abs(deltaX) > threshold 
        : Math.abs(deltaY) > threshold;
      const meetsVelocity = isHorizontalSwipe
        ? velocityX > velocityThreshold
        : velocityY > velocityThreshold;
      
      if (meetsThreshold && meetsVelocity && isSwipingRef.current) {
        // Trigger haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(10);
        }
        
        if (isHorizontalSwipe) {
          if (deltaX > 0 && onSwipeRight) {
            onSwipeRight({ deltaX, velocityX, deltaTime });
          } else if (deltaX < 0 && onSwipeLeft) {
            onSwipeLeft({ deltaX: Math.abs(deltaX), velocityX, deltaTime });
          }
        } else {
          if (deltaY > 0 && onSwipeDown) {
            onSwipeDown({ deltaY, velocityY, deltaTime });
          } else if (deltaY < 0 && onSwipeUp) {
            onSwipeUp({ deltaY: Math.abs(deltaY), velocityY, deltaTime });
          }
        }
      }
      
      // Reset
      touchStartRef.current = { x: 0, y: 0, time: 0 };
      touchEndRef.current = { x: 0, y: 0, time: 0 };
      isSwipingRef.current = false;
    };

    targetElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    targetElement.addEventListener('touchmove', handleTouchMove, { passive: true });
    targetElement.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      targetElement.removeEventListener('touchstart', handleTouchStart);
      targetElement.removeEventListener('touchmove', handleTouchMove);
      targetElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, velocityThreshold, element]);
};

/**
 * Hook for edge swipe gestures (from screen edges)
 */
export const useEdgeSwipe = ({
  onLeftEdgeSwipe,
  onRightEdgeSwipe,
  edgeThreshold = 20,
  swipeThreshold = 50
}) => {
  const touchStartRef = useRef({ x: 0, y: 0 });
  const isEdgeSwipeRef = useRef(false);

  useEffect(() => {
    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      const { clientX } = touch;
      const screenWidth = window.innerWidth;
      
      // Check if touch started at edge
      if (clientX <= edgeThreshold) {
        isEdgeSwipeRef.current = 'left';
        touchStartRef.current = { x: clientX, y: touch.clientY };
      } else if (clientX >= screenWidth - edgeThreshold) {
        isEdgeSwipeRef.current = 'right';
        touchStartRef.current = { x: clientX, y: touch.clientY };
      } else {
        isEdgeSwipeRef.current = false;
      }
    };

    const handleTouchEnd = (e) => {
      if (!isEdgeSwipeRef.current) return;
      
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      
      if (Math.abs(deltaX) > swipeThreshold) {
        if (navigator.vibrate) {
          navigator.vibrate(15);
        }
        
        if (isEdgeSwipeRef.current === 'left' && deltaX > 0 && onLeftEdgeSwipe) {
          onLeftEdgeSwipe();
        } else if (isEdgeSwipeRef.current === 'right' && deltaX < 0 && onRightEdgeSwipe) {
          onRightEdgeSwipe();
        }
      }
      
      isEdgeSwipeRef.current = false;
      touchStartRef.current = { x: 0, y: 0 };
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onLeftEdgeSwipe, onRightEdgeSwipe, edgeThreshold, swipeThreshold]);
};

export default useSwipeGesture;