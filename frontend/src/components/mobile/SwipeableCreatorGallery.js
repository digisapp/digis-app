import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, PanInfo, useAnimation, useMotionValue } from 'framer-motion';
import { 
  HeartIcon, 
  ShareIcon, 
  ChatBubbleLeftRightIcon,
  StarIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

const SwipeableCreatorGallery = ({ 
  creators = [],
  onCreatorSelect,
  onLikeCreator,
  onPassCreator,
  onSuperLike,
  user,
  loading = false,
  className = ""
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  
  const cardRefs = useRef([]);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const cardControls = useAnimation();
  const containerRef = useRef(null);

  // Touch thresholds
  const SWIPE_THRESHOLD = 50;
  const SWIPE_VELOCITY_THRESHOLD = 300;
  const DOUBLE_TAP_DELAY = 300;
  const LONG_PRESS_DELAY = 500;

  let tapTimeout = useRef(null);
  let longPressTimeout = useRef(null);
  let doubleTapTimeout = useRef(null);
  let lastTap = useRef(0);

  // Current creator
  const currentCreator = creators[currentIndex];

  // Handle card swipe
  const handleSwipe = useCallback(async (direction) => {
    if (isAnimating || !currentCreator) return;

    setIsAnimating(true);
    setDirection(direction);

    const exitX = direction === 'right' ? 300 : -300;
    const exitRotation = direction === 'right' ? 15 : -15;

    // Animate card exit
    await cardControls.start({
      x: exitX,
      rotate: exitRotation,
      opacity: 0,
      transition: { duration: 0.3, ease: 'easeOut' }
    });

    // Call appropriate handler
    if (direction === 'right') {
      onLikeCreator?.(currentCreator);
    } else {
      onPassCreator?.(currentCreator);
    }

    // Move to next creator
    if (currentIndex < creators.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }

    // Reset card position
    dragX.set(0);
    dragY.set(0);
    await cardControls.start({
      x: 0,
      y: 0,
      rotate: 0,
      opacity: 1,
      transition: { duration: 0 }
    });

    setIsAnimating(false);
    setDirection(null);
  }, [currentCreator, currentIndex, creators.length, isAnimating, cardControls, dragX, dragY, onLikeCreator, onPassCreator]);

  // Handle drag
  const handleDrag = useCallback((event, info) => {
    if (isAnimating) return;

    const { offset, velocity } = info;
    const rotation = offset.x / 10;
    
    // Update rotation based on drag
    cardControls.set({
      rotate: Math.max(-15, Math.min(15, rotation))
    });

    // Show action hints based on drag direction
    if (Math.abs(offset.x) > 50) {
      setShowActions(true);
    } else {
      setShowActions(false);
    }
  }, [isAnimating, cardControls]);

  // Handle drag end
  const handleDragEnd = useCallback((event, info) => {
    if (isAnimating) return;

    const { offset, velocity } = info;
    const swipeDistance = Math.abs(offset.x);
    const swipeVelocity = Math.abs(velocity.x);

    // Determine if swipe was strong enough
    if (swipeDistance > SWIPE_THRESHOLD || swipeVelocity > SWIPE_VELOCITY_THRESHOLD) {
      const direction = offset.x > 0 ? 'right' : 'left';
      handleSwipe(direction);
    } else {
      // Snap back to center
      cardControls.start({
        x: 0,
        y: 0,
        rotate: 0,
        transition: { duration: 0.3, ease: 'easeOut' }
      });
      setShowActions(false);
    }
  }, [isAnimating, handleSwipe, cardControls]);

  // Handle touch interactions
  const handleTouchStart = useCallback((e) => {
    setDragStartY(e.touches[0].clientY);
    
    // Long press detection
    longPressTimeout.current = setTimeout(() => {
      // Show creator profile preview
      onCreatorSelect?.(currentCreator, 'preview');
    }, LONG_PRESS_DELAY);
  }, [currentCreator, onCreatorSelect]);

  const handleTouchEnd = useCallback((e) => {
    clearTimeout(longPressTimeout.current);
    
    const now = Date.now();
    const timeSinceLastTap = now - lastTap.current;

    if (timeSinceLastTap < DOUBLE_TAP_DELAY && timeSinceLastTap > 0) {
      // Double tap - super like
      clearTimeout(doubleTapTimeout.current);
      onSuperLike?.(currentCreator);
      
      // Show super like animation
      const superLikeEl = document.createElement('div');
      superLikeEl.innerHTML = '⭐';
      superLikeEl.className = 'fixed text-6xl animate-bounce pointer-events-none z-50';
      superLikeEl.style.top = '50%';
      superLikeEl.style.left = '50%';
      superLikeEl.style.transform = 'translate(-50%, -50%)';
      document.body.appendChild(superLikeEl);
      
      setTimeout(() => {
        document.body.removeChild(superLikeEl);
      }, 1000);
    } else {
      // Single tap - delay to check for double tap
      doubleTapTimeout.current = setTimeout(() => {
        // Single tap - show/hide UI
        setShowActions(!showActions);
      }, DOUBLE_TAP_DELAY);
    }
    
    lastTap.current = now;
  }, [currentCreator, showActions, onSuperLike]);

  // Preload next images
  useEffect(() => {
    const preloadImages = () => {
      for (let i = currentIndex; i < Math.min(currentIndex + 3, creators.length); i++) {
        const creator = creators[i];
        if (creator.profilePicUrl) {
          const img = new Image();
          img.src = creator.profilePicUrl;
        }
      }
    };

    preloadImages();
  }, [currentIndex, creators]);

  // Action button component
  const ActionButton = ({ icon: Icon, onClick, variant = 'default', size = 'md', className: buttonClassName = "" }) => {
    const sizeClasses = {
      sm: 'w-12 h-12',
      md: 'w-16 h-16',
      lg: 'w-20 h-20'
    };

    const variantClasses = {
      default: 'bg-white text-gray-700 shadow-lg',
      primary: 'bg-gradient-to-r from-pink-500 to-red-500 text-white',
      success: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white',
      danger: 'bg-gradient-to-r from-red-500 to-pink-500 text-white'
    };

    return (
      <motion.button
        onClick={onClick}
        className={`
          ${sizeClasses[size]} ${variantClasses[variant]} 
          rounded-full flex items-center justify-center backdrop-blur-sm
          active:scale-90 transition-transform touch-manipulation
          ${buttonClassName}
        `}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
      >
        <Icon className={`${size === 'lg' ? 'w-8 h-8' : size === 'md' ? 'w-6 h-6' : 'w-4 h-4'}`} />
      </motion.button>
    );
  };

  if (!currentCreator) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            All caught up!
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            You've seen all available creators. Check back later for new ones!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative flex-1 flex items-center justify-center p-4 ${className}`}>
      {/* Background cards for depth */}
      {creators.slice(currentIndex + 1, currentIndex + 3).map((creator, index) => (
        <div
          key={creator.id}
          className="absolute inset-4 bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700"
          style={{
            transform: `scale(${0.95 - index * 0.05}) translateY(${(index + 1) * 8}px)`,
            zIndex: 10 - index,
            opacity: 0.7 - index * 0.2
          }}
        />
      ))}

      {/* Main card */}
      <motion.div
        ref={el => cardRefs.current[currentIndex] = el}
        className="relative w-full max-w-sm mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-20"
        style={{ 
          x: dragX, 
          y: dragY,
          height: '70vh',
          maxHeight: '600px'
        }}
        drag="x"
        dragElastic={0.2}
        dragConstraints={{ left: 0, right: 0 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        animate={cardControls}
        whileTap={{ scale: 0.98 }}
      >
        {/* Creator Image */}
        <div className="relative h-2/3 overflow-hidden">
          {currentCreator.profilePicUrl ? (
            <img 
              src={currentCreator.profilePicUrl}
              alt={currentCreator.username}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 flex items-center justify-center">
              <div className="text-white text-6xl font-bold">
                {currentCreator.username?.[0]?.toUpperCase() || '?'}
              </div>
            </div>
          )}

          {/* Online indicator */}
          {currentCreator.isOnline && (
            <div className="absolute top-4 right-4 bg-green-500 w-4 h-4 rounded-full border-2 border-white animate-pulse" />
          )}

          {/* Super like indicator */}
          <motion.div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-6xl pointer-events-none"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: showActions && dragX.get() > 50 ? 1 : 0, rotate: 0 }}
            transition={{ duration: 0.3 }}
          >
            ⭐
          </motion.div>

          {/* Pass indicator */}
          <motion.div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-6xl text-red-500 pointer-events-none"
            initial={{ scale: 0, rotate: 30 }}
            animate={{ scale: showActions && dragX.get() < -50 ? 1 : 0, rotate: 0 }}
            transition={{ duration: 0.3 }}
          >
            ✕
          </motion.div>
        </div>

        {/* Creator Info */}
        <div className="h-1/3 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                @{currentCreator.username}
              </h3>
              <div className="flex items-center gap-1">
                <StarIcon className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {(currentCreator.rating || 4.5).toFixed(1)}
                </span>
              </div>
            </div>

            {currentCreator.bio && (
              <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-3">
                {currentCreator.bio}
              </p>
            )}

            {/* Specialties */}
            <div className="flex flex-wrap gap-2">
              {(currentCreator.specialties || []).slice(0, 2).map((specialty) => (
                <span 
                  key={specialty}
                  className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full font-medium"
                >
                  {specialty}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Action buttons */}
      <motion.div 
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-6 z-30"
        initial={{ opacity: 0, y: 50 }}
        animate={{ 
          opacity: showActions ? 1 : 0.7, 
          y: showActions ? 0 : 20,
          scale: showActions ? 1 : 0.9
        }}
        transition={{ duration: 0.3 }}
      >
        <ActionButton
          icon={XMarkIcon}
          onClick={() => handleSwipe('left')}
          variant="danger"
          size="md"
        />
        
        <ActionButton
          icon={StarIcon}
          onClick={() => onSuperLike?.(currentCreator)}
          variant="primary"
          size="lg"
        />
        
        <ActionButton
          icon={HeartIcon}
          onClick={() => handleSwipe('right')}
          variant="success"
          size="md"
        />
      </motion.div>

      {/* Progress indicator */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 flex gap-1 z-30">
        {creators.slice(0, Math.min(creators.length, 5)).map((_, index) => (
          <div
            key={index}
            className={`h-1 rounded-full transition-all duration-300 ${
              index === currentIndex 
                ? 'w-8 bg-white' 
                : index < currentIndex 
                  ? 'w-4 bg-white/50' 
                  : 'w-4 bg-white/30'
            }`}
          />
        ))}
        {creators.length > 5 && (
          <div className="text-white/70 text-xs ml-2">
            +{creators.length - 5}
          </div>
        )}
      </div>
    </div>
  );
};

export default SwipeableCreatorGallery;