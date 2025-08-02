import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { HeartIcon } from '@heroicons/react/24/solid';
import { 
  SpeakerWaveIcon, 
  SpeakerXMarkIcon,
  DevicePhoneMobileIcon,
  ArrowsPointingOutIcon
} from '@heroicons/react/24/outline';

const MobileStreamViewer = ({ 
  children, 
  onVolumeChange, 
  onBrightnessChange,
  onDoubleTapLike,
  className = '' 
}) => {
  const [volume, setVolume] = useState(50);
  const [brightness, setBrightness] = useState(100);
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const [showBrightnessIndicator, setShowBrightnessIndicator] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const lastTapTime = useRef(0);
  const likeAnimationTimeout = useRef(null);
  const controls = useAnimation();

  // Detect orientation
  useEffect(() => {
    const handleOrientationChange = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    handleOrientationChange();
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  // Handle touch gestures
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const deltaY = touchStartY.current - touch.clientY;
    const deltaX = touch.clientX - touchStartX.current;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Vertical swipe on right side for volume
    if (touchStartX.current > screenWidth / 2 && Math.abs(deltaY) > Math.abs(deltaX)) {
      e.preventDefault();
      const volumeDelta = (deltaY / screenHeight) * 100;
      const newVolume = Math.max(0, Math.min(100, volume + volumeDelta));
      
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
      setShowVolumeIndicator(true);
      
      if (onVolumeChange) {
        onVolumeChange(newVolume);
      }
    }
    
    // Vertical swipe on left side for brightness
    else if (touchStartX.current < screenWidth / 2 && Math.abs(deltaY) > Math.abs(deltaX)) {
      e.preventDefault();
      const brightnessDelta = (deltaY / screenHeight) * 100;
      const newBrightness = Math.max(20, Math.min(100, brightness + brightnessDelta));
      
      setBrightness(newBrightness);
      setShowBrightnessIndicator(true);
      
      if (onBrightnessChange) {
        onBrightnessChange(newBrightness);
      }
    }
  };

  const handleTouchEnd = () => {
    // Hide indicators after gesture
    setTimeout(() => {
      setShowVolumeIndicator(false);
      setShowBrightnessIndicator(false);
    }, 1000);
  };

  // Handle double tap for like
  const handleTap = (e) => {
    const currentTime = Date.now();
    const tapDelay = currentTime - lastTapTime.current;
    
    if (tapDelay < 300) {
      // Double tap detected
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Show like animation at tap position
      setShowLikeAnimation({ x, y, id: Date.now() });
      
      if (onDoubleTapLike) {
        onDoubleTapLike();
      }
      
      // Clear animation after delay
      if (likeAnimationTimeout.current) {
        clearTimeout(likeAnimationTimeout.current);
      }
      
      likeAnimationTimeout.current = setTimeout(() => {
        setShowLikeAnimation(false);
      }, 2000);
    }
    
    lastTapTime.current = currentTime;
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Request landscape orientation for mobile
  const requestLandscape = async () => {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (err) {
      console.log('Orientation lock not supported');
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative touch-none select-none ${isLandscape ? 'h-screen' : ''} ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleTap}
      style={{
        filter: `brightness(${brightness}%)`,
      }}
    >
      {/* Video/Stream Content */}
      <div className="w-full h-full">
        {children}
      </div>

      {/* Volume Indicator */}
      <AnimatePresence>
        {showVolumeIndicator && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-1/2 right-8 transform -translate-y-1/2 bg-black/80 backdrop-blur-sm rounded-2xl p-4"
          >
            <div className="flex flex-col items-center gap-2">
              {isMuted ? (
                <SpeakerXMarkIcon className="w-8 h-8 text-white" />
              ) : (
                <SpeakerWaveIcon className="w-8 h-8 text-white" />
              )}
              <div className="w-2 h-32 bg-gray-700 rounded-full relative overflow-hidden">
                <motion.div 
                  className="absolute bottom-0 left-0 right-0 bg-white rounded-full"
                  animate={{ height: `${volume}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              </div>
              <span className="text-white text-sm font-medium">{Math.round(volume)}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Brightness Indicator */}
      <AnimatePresence>
        {showBrightnessIndicator && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-1/2 left-8 transform -translate-y-1/2 bg-black/80 backdrop-blur-sm rounded-2xl p-4"
          >
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <div className="w-2 h-32 bg-gray-700 rounded-full relative overflow-hidden">
                <motion.div 
                  className="absolute bottom-0 left-0 right-0 bg-yellow-400 rounded-full"
                  animate={{ height: `${brightness}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              </div>
              <span className="text-white text-sm font-medium">{Math.round(brightness)}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double Tap Like Animation */}
      <AnimatePresence>
        {showLikeAnimation && (
          <motion.div
            key={showLikeAnimation.id}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ 
              scale: [0, 1.5, 1.2],
              y: [-20, -40, -80],
              opacity: [1, 1, 0]
            }}
            transition={{ duration: 1.5 }}
            className="absolute pointer-events-none"
            style={{
              left: showLikeAnimation.x - 40,
              top: showLikeAnimation.y - 40,
            }}
          >
            <HeartIcon className="w-20 h-20 text-red-500 drop-shadow-lg" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Controls Hint */}
      {!isLandscape && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2"
        >
          <DevicePhoneMobileIcon className="w-4 h-4 text-white" />
          <span className="text-white text-xs">Rotate for fullscreen</span>
          <button
            onClick={() => {
              requestLandscape();
              toggleFullscreen();
            }}
            className="ml-2 p-1 bg-white/20 rounded"
          >
            <ArrowsPointingOutIcon className="w-3 h-3 text-white" />
          </button>
        </motion.div>
      )}

      {/* Gesture Instructions (show briefly) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.5 }}
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        onAnimationComplete={() => {
          setTimeout(() => {
            controls.start({ opacity: 0 });
          }, 3000);
        }}
        animate={controls}
      >
        <div className="bg-black/80 backdrop-blur-sm rounded-2xl p-6 text-center">
          <p className="text-white text-sm mb-2">Swipe up/down on:</p>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-white/60 text-xs">Left side</p>
              <p className="text-white font-medium">Brightness</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <p className="text-white/60 text-xs">Right side</p>
              <p className="text-white font-medium">Volume</p>
            </div>
          </div>
          <p className="text-white text-sm mt-2">Double tap to ❤️</p>
        </div>
      </motion.div>
    </div>
  );
};

export default MobileStreamViewer;