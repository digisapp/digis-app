import React from 'react';
import { motion } from 'framer-motion';

const DigisWatermark = ({ position = 'bottom-right', size = 'medium', opacity = 0.7, username = null, showLogo = false }) => {
  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'center': 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
  };

  // Size classes
  const sizeClasses = {
    'small': 'h-8 md:h-10',
    'medium': 'h-10 md:h-12',
    'large': 'h-12 md:h-16'
  };

  // Font size based on size prop
  const fontSizes = {
    'small': 'text-sm',
    'medium': 'text-base',
    'large': 'text-lg'
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: opacity }}
      transition={{ duration: 0.5 }}
      className={`absolute ${positionClasses[position]} z-10 pointer-events-none select-none`}
      style={{ 
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
      }}
    >
      {username ? (
        // Show username URL
        <div className={`${fontSizes[size]} font-semibold text-white`}>
          <span style={{ 
            background: 'linear-gradient(90deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 100%)',
            padding: '4px 12px',
            borderRadius: '6px',
            backdropFilter: 'blur(8px)'
          }}>
            Digis.cc/{username}
          </span>
        </div>
      ) : showLogo ? (
        // Show logo if no username but showLogo is true
        <div className="relative">
          <img
            src="/digis-logo-white.png"
            alt=""
            className={`${sizeClasses[size]} w-auto object-contain opacity-90`}
            style={{
              filter: 'brightness(1.1) contrast(1.1)'
            }}
          />
          
          {/* Subtle glow effect */}
          <div 
            className="absolute inset-0 bg-white/20 blur-xl"
            style={{
              maskImage: 'url(/digis-logo-white.png)',
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskImage: 'url(/digis-logo-white.png)',
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center'
            }}
          />
        </div>
      ) : null}
    </motion.div>
  );
};

export default DigisWatermark;