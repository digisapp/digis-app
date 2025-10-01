import React from 'react';
import { motion } from 'framer-motion';

// Simple fallback hook when ThemeContext is not available
const useThemeFallback = () => {
  try {
    const { useTheme } = require('../../contexts/ThemeContext');
    return useTheme();
  } catch (error) {
    // Fallback values when ThemeContext is not available
    return {
      animations: !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    };
  }
};

const Loading = ({ 
  variant = 'spinner', 
  size = 'md', 
  color = 'primary',
  overlay = false,
  text,
  fullscreen = false,
  className = ''
}) => {
  const { animations } = useThemeFallback();

  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const colorClasses = {
    primary: 'text-primary-600',
    secondary: 'text-secondary-600',
    white: 'text-white',
    neutral: 'text-neutral-600'
  };

  const containerClasses = [
    'flex flex-col items-center justify-center gap-3',
    fullscreen ? 'fixed inset-0 z-50' : '',
    overlay ? 'bg-white/80 backdrop-blur-sm dark:bg-neutral-900/80' : '',
    className
  ].filter(Boolean).join(' ');

  // Spinner Component
  const Spinner = () => (
    <motion.div
      className={`${sizeClasses[size]} ${colorClasses[color]}`}
      animate={animations ? { rotate: 360 } : {}}
      transition={animations ? {
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      } : {}}
    >
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="60 40"
          className="opacity-20"
        />
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="15 85"
          strokeDashoffset="0"
        />
      </svg>
    </motion.div>
  );

  // Dots Component
  const Dots = () => {
    const dotVariants = {
      animate: {
        scale: [1, 1.2, 1],
        opacity: [0.5, 1, 0.5],
        transition: {
          duration: 0.8,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }
    };

    return (
      <div className="flex gap-1">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className={`w-2 h-2 rounded-full ${colorClasses[color]} bg-current`}
            variants={animations ? dotVariants : {}}
            animate={animations ? "animate" : false}
            transition={animations ? { delay: index * 0.2 } : {}}
          />
        ))}
      </div>
    );
  };

  // Pulse Component
  const Pulse = () => (
    <motion.div
      className={`${sizeClasses[size]} rounded-full ${colorClasses[color]} bg-current`}
      animate={animations ? {
        scale: [1, 1.2, 1],
        opacity: [0.7, 1, 0.7]
      } : {}}
      transition={animations ? {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      } : {}}
    />
  );

  // Wave Component
  const Wave = () => {
    const waveVariants = {
      animate: {
        scaleY: [1, 1.5, 1],
        transition: {
          duration: 0.8,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }
    };

    return (
      <div className="flex items-end gap-1">
        {[0, 1, 2, 3].map((index) => (
          <motion.div
            key={index}
            className={`w-1 h-6 ${colorClasses[color]} bg-current rounded-full`}
            variants={animations ? waveVariants : {}}
            animate={animations ? "animate" : false}
            transition={animations ? { delay: index * 0.15 } : {}}
          />
        ))}
      </div>
    );
  };

  // Ripple Component
  const Ripple = () => (
    <div className="relative">
      <motion.div
        className={`${sizeClasses[size]} rounded-full border-2 ${colorClasses[color]} border-current`}
        animate={animations ? {
          scale: [0.8, 1.2],
          opacity: [1, 0]
        } : {}}
        transition={animations ? {
          duration: 1.5,
          repeat: Infinity,
          ease: "easeOut"
        } : {}}
      />
      <motion.div
        className={`absolute inset-0 rounded-full border-2 ${colorClasses[color]} border-current`}
        animate={animations ? {
          scale: [0.8, 1.2],
          opacity: [1, 0]
        } : {}}
        transition={animations ? {
          duration: 1.5,
          repeat: Infinity,
          ease: "easeOut",
          delay: 0.5
        } : {}}
      />
    </div>
  );

  // Bouncing Balls Component
  const BouncingBalls = () => {
    const ballVariants = {
      animate: {
        y: [0, -20, 0],
        transition: {
          duration: 0.6,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }
    };

    return (
      <div className="flex gap-2">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className={`w-3 h-3 rounded-full ${colorClasses[color]} bg-current`}
            variants={animations ? ballVariants : {}}
            animate={animations ? "animate" : false}
            transition={animations ? { delay: index * 0.15 } : {}}
          />
        ))}
      </div>
    );
  };

  // Grid Component
  const Grid = () => {
    const gridVariants = {
      animate: {
        scale: [1, 0.8, 1],
        opacity: [1, 0.5, 1],
        transition: {
          duration: 1,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }
    };

    return (
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, index) => (
          <motion.div
            key={index}
            className={`w-2 h-2 ${colorClasses[color]} bg-current rounded-sm`}
            variants={animations ? gridVariants : {}}
            animate={animations ? "animate" : false}
            transition={animations ? { delay: index * 0.1 } : {}}
          />
        ))}
      </div>
    );
  };

  // Orbit Component
  const Orbit = () => (
    <div className="relative">
      <motion.div
        className={`${sizeClasses[size]} rounded-full border border-current ${colorClasses[color]} opacity-20`}
      />
      <motion.div
        className="absolute top-0 left-1/2 w-2 h-2 -mt-1 -ml-1 rounded-full bg-current"
        animate={animations ? { rotate: 360 } : {}}
        transition={animations ? {
          duration: 1.5,
          repeat: Infinity,
          ease: "linear"
        } : {}}
        style={{ transformOrigin: "1px 24px" }}
      />
    </div>
  );

  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return <Dots />;
      case 'pulse':
        return <Pulse />;
      case 'wave':
        return <Wave />;
      case 'ripple':
        return <Ripple />;
      case 'bouncing':
        return <BouncingBalls />;
      case 'grid':
        return <Grid />;
      case 'orbit':
        return <Orbit />;
      default:
        return <Spinner />;
    }
  };

  return (
    <div className={containerClasses}>
      {renderLoader()}
      
      {text && (
        <motion.p
          className={`text-sm font-medium ${colorClasses[color]}`}
          initial={animations ? { opacity: 0, y: 10 } : {}}
          animate={animations ? { opacity: 1, y: 0 } : {}}
          transition={animations ? { delay: 0.2 } : {}}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

export default Loading;