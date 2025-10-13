import React, { createContext, useContext, useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load MobileBottomSheet to avoid circular dependency issues
const MobileBottomSheet = lazy(() => import('./MobileBottomSheet'));

// Create context for mobile UI state
const MobileUIContext = createContext({});

export const MobileUIProvider = ({ children }) => {
  const [isScrollingUp, setIsScrollingUp] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isSwipeMenuOpen, setIsSwipeMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [isPullToRefresh, setIsPullToRefresh] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Refs to maintain stable references for touch handlers
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);
  const handlersRef = useRef({});

  // Haptic feedback support
  const triggerHaptic = useCallback((type = 'light') => {
    if ('vibrate' in navigator) {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(20);
          break;
        case 'heavy':
          navigator.vibrate(30);
          break;
        case 'success':
          navigator.vibrate([10, 20, 10]);
          break;
        case 'warning':
          navigator.vibrate([30, 10, 30]);
          break;
        case 'error':
          navigator.vibrate([50, 20, 50, 20, 50]);
          break;
        default:
          navigator.vibrate(10);
      }
    }
  }, []);

  // Scroll direction detection
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          
          if (currentScrollY > lastScrollY && currentScrollY > 100) {
            setIsScrollingUp(false);
          } else {
            setIsScrollingUp(true);
          }
          
          setLastScrollY(currentScrollY);
          ticking = false;
        });
        
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Touch gesture handling - using refs to avoid creating new functions on every state change
  const handleTouchStart = useCallback((e) => {
    const touch = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
    touchStartRef.current = touch;
    touchEndRef.current = null;
    setTouchStart(touch);
    setTouchEnd(null);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!touchStartRef.current) return;

    const touch = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    touchEndRef.current = touch;
    setTouchEnd(touch);
  }, []);

  const handleTouchEnd = useCallback(() => {
    const start = touchStartRef.current;
    const end = touchEndRef.current;

    if (!start || !end) return;

    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const deltaTime = Date.now() - start.time;

    // Minimum swipe distance
    const minSwipeDistance = 50;

    // Detect swipe direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
          setSwipeDirection('right');
          triggerHaptic('light');
        } else {
          setSwipeDirection('left');
          triggerHaptic('light');
        }
      }
    } else {
      // Vertical swipe
      if (Math.abs(deltaY) > minSwipeDistance) {
        if (deltaY > 0 && window.scrollY === 0 && deltaTime < 300) {
          // Pull to refresh
          setIsPullToRefresh(true);
          triggerHaptic('medium');
          setTimeout(() => setIsPullToRefresh(false), 2000);
        } else if (deltaY < 0) {
          setSwipeDirection('up');
        }
      }
    }

    // Reset after animation
    setTimeout(() => {
      setSwipeDirection(null);
    }, 300);
  }, [triggerHaptic]);

  // Keyboard height detection for iOS
  useEffect(() => {
    const handleViewportChange = () => {
      if ('visualViewport' in window) {
        const viewport = window.visualViewport;
        const keyboardHeight = window.innerHeight - viewport.height;
        setKeyboardHeight(keyboardHeight);
      }
    };

    if ('visualViewport' in window) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }

    return () => {
      if ('visualViewport' in window) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
    };
  }, []);

  // Store handlers in ref to maintain stable references
  useEffect(() => {
    handlersRef.current.handleTouchStart = handleTouchStart;
    handlersRef.current.handleTouchMove = handleTouchMove;
    handlersRef.current.handleTouchEnd = handleTouchEnd;
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Attach global touch listeners - use stable wrapper functions
  useEffect(() => {
    const onTouchStart = (e) => handlersRef.current.handleTouchStart?.(e);
    const onTouchMove = (e) => handlersRef.current.handleTouchMove?.(e);
    const onTouchEnd = (e) => handlersRef.current.handleTouchEnd?.(e);

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []); // Empty dependency array - listeners are now stable

  // Enhanced modal system
  const openModal = useCallback((modalId, props = {}) => {
    setActiveModal({ id: modalId, props });
    triggerHaptic('light');
    document.body.style.overflow = 'hidden';
  }, [triggerHaptic]);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    triggerHaptic('light');
    document.body.style.overflow = '';
  }, [triggerHaptic]);

  // Swipe menu control
  const toggleSwipeMenu = useCallback(() => {
    setIsSwipeMenuOpen(prev => !prev);
    triggerHaptic('medium');
  }, [triggerHaptic]);

  // Bottom sheet control - handles both old and new formats
  const openBottomSheet = useCallback((contentOrConfig, options = {}) => {
    // Handle both formats:
    // 1. openBottomSheet(content, options) - old format
    // 2. openBottomSheet({ title, content, ... }) - new format from MobileCreatorProfile

    let modalProps = {};

    if (contentOrConfig && typeof contentOrConfig === 'object' && (contentOrConfig.title || contentOrConfig.content)) {
      // New format with title and content
      modalProps = { ...contentOrConfig };
    } else if (contentOrConfig === null) {
      // Close bottom sheet
      setActiveModal(null);
      document.body.style.overflow = '';
      return;
    } else {
      // Old format
      modalProps = { content: contentOrConfig, ...options };
    }

    setActiveModal({ id: 'bottomSheet', props: modalProps });
    triggerHaptic('light');
    document.body.style.overflow = 'hidden';
  }, [triggerHaptic]);

  const value = {
    // States
    isScrollingUp,
    isSwipeMenuOpen,
    activeModal,
    swipeDirection,
    isPullToRefresh,
    keyboardHeight,
    
    // Actions
    triggerHaptic,
    openModal,
    closeModal,
    toggleSwipeMenu,
    openBottomSheet,
    
    // Touch handlers
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };

  return (
    <MobileUIContext.Provider value={value}>
      {children}
      
      {/* Pull to refresh indicator */}
      <AnimatePresence>
        {isPullToRefresh && (
          <motion.div
            className="pull-to-refresh visible refreshing"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
          >
            <div className="spinner" />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Gesture hints removed - no swipe indicators */}

      {/* Bottom Sheet Modal */}
      {activeModal?.id === 'bottomSheet' && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-50" />}>
          <MobileBottomSheet
            isOpen={true}
            onClose={() => {
              setActiveModal(null);
              document.body.style.overflow = '';
            }}
            title={activeModal.props?.title}
          >
            {activeModal.props?.content}
          </MobileBottomSheet>
        </Suspense>
      )}
    </MobileUIContext.Provider>
  );
};

// Custom hook with fallback
export const useMobileUI = () => {
  const context = useContext(MobileUIContext);
  if (!context) {
    // Return safe defaults when used outside provider
    return {
      isScrollingUp: true,
      isSwipeMenuOpen: false,
      activeModal: null,
      swipeDirection: null,
      isPullToRefresh: false,
      keyboardHeight: 0,
      triggerHaptic: () => {},
      openModal: () => {},
      closeModal: () => {},
      toggleSwipeMenu: () => {},
      openBottomSheet: () => {}
    };
  }
  return context;
};