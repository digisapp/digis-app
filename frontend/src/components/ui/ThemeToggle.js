import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useMediaQuery } from '../../hooks/useMediaQuery';

/**
 * Theme toggle component with smooth animations
 * Features: system preference detection, smooth transitions, accessibility
 */
const ThemeToggle = ({
  size = 'medium',
  showLabel = false,
  onChange,
  className = '',
  ...props
}) => {
  const [theme, setTheme] = useState('light');
  const [mounted, setMounted] = useState(false);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  // Initialize theme on mount
  useEffect(() => {
    setMounted(true);
    
    // Check for saved theme preference or default to system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else if (systemPrefersDark) {
      setTheme('dark');
      applyTheme('dark');
    } else {
      setTheme('light');
      applyTheme('light');
    }
  }, [systemPrefersDark]);

  const applyTheme = (newTheme) => {
    const root = document.documentElement;
    
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([10]);
    }
    
    if (onChange) {
      onChange(newTheme);
    }
  };

  // Size configurations
  const sizeConfig = {
    small: {
      container: 'w-12 h-6',
      toggle: 'w-4 h-4',
      translate: 'translate-x-6',
      text: 'text-xs'
    },
    medium: {
      container: 'w-14 h-7',
      toggle: 'w-5 h-5',
      translate: 'translate-x-7',
      text: 'text-sm'
    },
    large: {
      container: 'w-16 h-8',
      toggle: 'w-6 h-6',
      translate: 'translate-x-8',
      text: 'text-base'
    }
  };

  const config = sizeConfig[size];

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className={`${config.container} bg-neutral-300 rounded-full ${className}`} />
    );
  }

  const toggleVariants = {
    light: {
      x: 0,
      backgroundColor: '#ffffff',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
    },
    dark: {
      x: theme === 'dark' ? 28 : 0, // Adjusted for medium size
      backgroundColor: '#1f2937',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
    }
  };

  const containerVariants = {
    light: {
      backgroundColor: '#e5e7eb',
      borderColor: '#d1d5db'
    },
    dark: {
      backgroundColor: '#374151',
      borderColor: '#4b5563'
    }
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {showLabel && (
        <motion.span
          className={`font-medium text-text-primary ${config.text}`}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {theme === 'light' ? '☀️' : '🌙'} {theme === 'light' ? 'Light' : 'Dark'}
        </motion.span>
      )}
      
      <motion.button
        className={`relative ${config.container} rounded-full border-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-shadow`}
        onClick={toggleTheme}
        variants={containerVariants}
        animate={theme}
        transition={{ 
          duration: prefersReducedMotion ? 0 : 0.3,
          ease: [0.25, 0.46, 0.45, 0.94]
        }}
        whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        role="switch"
        aria-checked={theme === 'dark'}
        {...props}
      >
        {/* Background gradient */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            background: theme === 'dark' 
              ? 'linear-gradient(45deg, #1e293b, #334155)'
              : 'linear-gradient(45deg, #f1f5f9, #e2e8f0)'
          }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
        />
        
        {/* Toggle circle */}
        <motion.div
          className={`absolute top-0.5 left-0.5 ${config.toggle} rounded-full flex items-center justify-center`}
          variants={toggleVariants}
          animate={theme}
          transition={{ 
            type: "spring",
            stiffness: 300,
            damping: 30,
            duration: prefersReducedMotion ? 0 : 0.4
          }}
        >
          {/* Icon */}
          <motion.div
            animate={{ 
              rotate: theme === 'dark' ? 360 : 0,
              scale: [1, 0.8, 1]
            }}
            transition={{ 
              rotate: { duration: prefersReducedMotion ? 0 : 0.5 },
              scale: { duration: prefersReducedMotion ? 0 : 0.3, times: [0, 0.5, 1] }
            }}
            className="text-xs"
          >
            {theme === 'light' ? '☀️' : '🌙'}
          </motion.div>
        </motion.div>
        
        {/* Stars animation for dark mode */}
        {theme === 'dark' && !prefersReducedMotion && (
          <>
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-yellow-300 rounded-full"
                style={{
                  top: `${20 + i * 15}%`,
                  left: `${15 + i * 25}%`
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.5,
                  ease: "easeInOut"
                }}
              />
            ))}
          </>
        )}
      </motion.button>
    </div>
  );
};

// Hook for consuming theme state
export const useTheme = () => {
  const [theme, setTheme] = useState('light');
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (systemPrefersDark) {
      setTheme('dark');
    }
    
    // Listen for theme changes
    const handleStorageChange = (e) => {
      if (e.key === 'theme') {
        setTheme(e.newValue || 'light');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Apply theme
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  };
  
  return { theme, toggleTheme };
};

export default ThemeToggle;