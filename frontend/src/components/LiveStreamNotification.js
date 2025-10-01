import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SparklesIcon,
  SignalIcon,
  UsersIcon,
  VideoCameraIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';
import confetti from 'canvas-confetti';

const LiveStreamNotification = ({ 
  isVisible, 
  onClose, 
  streamConfig,
  duration = 5000 
}) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only update if the value actually changed
    if (isVisible !== show) {
      setShow(isVisible);
    }
    
    if (isVisible && !show) {
      // Trigger confetti animation only when becoming visible
      const count = 200;
      const defaults = {
        origin: { y: 0.7 },
        colors: ['#a855f7', '#ec4899', '#8b5cf6', '#d946ef', '#c084fc']
      };

      function fire(particleRatio, opts) {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
          spread: 90,
          scalar: 1.2
        });
      }

      fire(0.25, {
        spread: 26,
        startVelocity: 55,
      });
      fire(0.2, {
        spread: 60,
      });
      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8
      });
      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2
      });
      fire(0.1, {
        spread: 120,
        startVelocity: 45,
      });

      // Auto-hide after duration
      const timer = setTimeout(() => {
        setShow(false);
        if (onClose) onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, show, duration, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] max-w-md w-full px-4"
        >
          <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 rounded-2xl shadow-2xl">
            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-purple-600/20 animate-pulse" />
            
            {/* Sparkle effects */}
            <div className="absolute inset-0">
              <div className="absolute top-2 left-4 animate-ping">
                <SparklesIcon className="w-4 h-4 text-white/30" />
              </div>
              <div className="absolute bottom-2 right-8 animate-ping animation-delay-200">
                <SparklesIcon className="w-3 h-3 text-white/30" />
              </div>
              <div className="absolute top-4 right-12 animate-ping animation-delay-400">
                <SparklesIcon className="w-5 h-5 text-white/30" />
              </div>
            </div>

            <div className="relative p-6">
              {/* Close button */}
              <button
                onClick={() => {
                  setShow(false);
                  if (onClose) onClose();
                }}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-white/80" />
              </button>

              {/* Content */}
              <div className="flex items-center gap-4">
                {/* Live indicator */}
                <div className="relative">
                  <div className="absolute inset-0 animate-ping">
                    <div className="w-16 h-16 bg-white/30 rounded-full" />
                  </div>
                  <div className="relative w-16 h-16 bg-white rounded-full flex items-center justify-center">
                    <SignalIcon className="w-8 h-8 text-red-600 animate-pulse" />
                  </div>
                </div>

                {/* Text content */}
                <div className="flex-1">
                  <h3 className="text-white font-bold text-xl mb-1 flex items-center gap-2">
                    You're Live! 
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="inline-block"
                    >
                      🎉
                    </motion.span>
                  </h3>
                  <p className="text-white/90 text-sm">
                    Your stream is now live and visible to all your fans
                  </p>
                  
                  {/* Stream info */}
                  {streamConfig && (
                    <div className="flex items-center gap-4 mt-3 text-white/80 text-xs">
                      <div className="flex items-center gap-1">
                        <VideoCameraIcon className="w-4 h-4" />
                        <span>{streamConfig.quality || '720p'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <UsersIcon className="w-4 h-4" />
                        <span>0 viewers</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <motion.div
                className="absolute bottom-0 left-0 h-1 bg-white/30"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: duration / 1000, ease: "linear" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LiveStreamNotification;