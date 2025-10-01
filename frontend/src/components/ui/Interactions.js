import React, { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Modern micro-interaction components
 * Features: haptic feedback, spring animations, state-aware interactions
 */

// Haptic feedback utility (for mobile)
const triggerHaptic = (type = 'light') => {
  if (navigator.vibrate) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30],
      success: [10, 10, 10],
      error: [50, 50, 50]
    };
    navigator.vibrate(patterns[type] || patterns.light);
  }
};

// Interactive Button with advanced micro-interactions
export const InteractiveButton = ({ 
  children, 
  onClick, 
  variant = 'primary',
  haptic = true,
  showParticles = false,
  ...props 
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [particles, setParticles] = useState([]);

  const handleClick = (event) => {
    if (haptic) triggerHaptic('light');
    
    if (showParticles) {
      // Create particle effect
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      const newParticles = Array.from({ length: 6 }, (_, i) => ({
        id: Date.now() + i,
        x,
        y,
        angle: (i * 60) + Math.random() * 30,
        velocity: 2 + Math.random() * 2
      }));
      
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 600);
    }
    
    onClick?.(event);
  };

  return (
    <motion.button
      className="relative overflow-hidden"
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onClick={handleClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      {...props}
    >
      {children}
      
      {/* Particle effects */}
      {particles.map(particle => (
        <motion.div
          key={particle.id}
          className="absolute w-2 h-2 bg-white rounded-full pointer-events-none"
          initial={{
            x: particle.x,
            y: particle.y,
            scale: 0,
            opacity: 1
          }}
          animate={{
            x: particle.x + Math.cos(particle.angle * Math.PI / 180) * 50,
            y: particle.y + Math.sin(particle.angle * Math.PI / 180) * 50,
            scale: [0, 1, 0],
            opacity: [1, 1, 0]
          }}
          transition={{ duration: 0.6 }}
        />
      ))}
      
      {/* Press effect */}
      {isPressed && (
        <motion.div
          className="absolute inset-0 bg-white/20"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.2, opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </motion.button>
  );
};

// Magnetic hover effect
export const MagneticElement = ({ children, strength = 0.3, ...props }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (event.clientX - centerX) * strength;
    const deltaY = (event.clientY - centerY) * strength;
    
    setPosition({ x: deltaX, y: deltaY });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={position}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// Liquid button with morphing states
export const LiquidButton = ({ 
  children, 
  isLoading = false, 
  isSuccess = false,
  isError = false,
  ...props 
}) => {
  const getVariant = () => {
    if (isError) return 'error';
    if (isSuccess) return 'success';
    if (isLoading) return 'loading';
    return 'default';
  };

  const variants = {
    default: {
      borderRadius: '12px',
      backgroundColor: 'var(--color-primary-600)',
      scale: 1
    },
    loading: {
      borderRadius: '50px',
      backgroundColor: 'var(--color-neutral-400)',
      scale: 0.95
    },
    success: {
      borderRadius: '50px',
      backgroundColor: 'var(--color-success-600)',
      scale: 1.05
    },
    error: {
      borderRadius: '8px',
      backgroundColor: 'var(--color-error-600)',
      scale: 0.98
    }
  };

  return (
    <motion.button
      className="px-6 py-3 text-white font-medium transition-colors"
      variants={variants}
      animate={getVariant()}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      {...props}
    >
      <motion.span
        animate={{ opacity: isLoading ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      >
        {isSuccess ? '✓' : isError ? '✗' : children}
      </motion.span>
      
      {isLoading && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>
      )}
    </motion.button>
  );
};

// Floating action button with contextual menu
export const FloatingActionButton = ({ 
  actions = [],
  icon,
  isOpen = false,
  onToggle,
  ...props 
}) => {
  return (
    <div className="fixed bottom-6 right-6 z-50" {...props}>
      {/* Action items */}
      {isOpen && actions.map((action, index) => (
        <motion.button
          key={action.id}
          className="absolute bottom-16 right-0 w-12 h-12 bg-surface rounded-full shadow-lg flex items-center justify-center mb-3"
          style={{ bottom: `${(index + 1) * 60}px` }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ 
            delay: index * 0.1,
            type: "spring",
            stiffness: 300,
            damping: 25
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={action.onClick}
          aria-label={action.label}
        >
          {action.icon}
        </motion.button>
      ))}
      
      {/* Main FAB */}
      <motion.button
        className="w-14 h-14 bg-gradient-miami rounded-full shadow-xl flex items-center justify-center"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onToggle}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {icon}
      </motion.button>
    </div>
  );
};

// Progressive loader with stages
export const ProgressiveLoader = ({ stages = [], currentStage = 0 }) => {
  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Progress bar */}
      <div className="w-64 h-2 bg-neutral-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-miami"
          initial={{ width: '0%' }}
          animate={{ width: `${((currentStage + 1) / stages.length) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      
      {/* Stage indicators */}
      <div className="flex space-x-2">
        {stages.map((stage, index) => (
          <motion.div
            key={index}
            className={`w-3 h-3 rounded-full ${
              index <= currentStage ? 'bg-primary' : 'bg-neutral-300'
            }`}
            animate={{ 
              scale: index === currentStage ? [1, 1.2, 1] : 1,
              backgroundColor: index <= currentStage ? 'var(--color-primary-600)' : 'var(--color-neutral-300)'
            }}
            transition={{ 
              duration: index === currentStage ? 1 : 0.3,
              repeat: index === currentStage ? Infinity : 0
            }}
          />
        ))}
      </div>
      
      {/* Current stage text */}
      <motion.p
        key={currentStage}
        className="text-sm text-neutral-600"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        {stages[currentStage]}
      </motion.p>
    </div>
  );
};

// Tilt card with 3D effect
export const TiltCard = ({ children, ...props }) => {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  
  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const rotateX = (event.clientY - centerY) / 10;
    const rotateY = (centerX - event.clientX) / 10;
    
    setRotateX(rotateX);
    setRotateY(rotateY);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      className="preserve-3d"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX, rotateY }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{ transformStyle: "preserve-3d" }}
      {...props}
    >
      <div style={{ transform: "translateZ(50px)" }}>
        {children}
      </div>
    </motion.div>
  );
};

// Ripple effect component
export const RippleEffect = ({ children, ...props }) => {
  const [ripples, setRipples] = useState([]);

  const createRipple = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    const newRipple = {
      id: Date.now(),
      x,
      y,
      size
    };

    setRipples(prev => [...prev, newRipple]);

    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, 600);
  };

  return (
    <div
      className="relative overflow-hidden"
      onClick={createRipple}
      {...props}
    >
      {children}
      
      {ripples.map(ripple => (
        <motion.div
          key={ripple.id}
          className="absolute bg-white/30 rounded-full pointer-events-none"
          initial={{
            width: 0,
            height: 0,
            left: ripple.x,
            top: ripple.y,
            opacity: 1
          }}
          animate={{
            width: ripple.size,
            height: ripple.size,
            opacity: 0
          }}
          transition={{ duration: 0.6 }}
        />
      ))}
    </div>
  );
};

const InteractionsExport = {
  InteractiveButton,
  MagneticElement,
  LiquidButton,
  FloatingActionButton,
  ProgressiveLoader,
  TiltCard,
  RippleEffect,
  triggerHaptic
};

export default InteractionsExport;