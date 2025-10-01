import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

const ThemeToggle = ({ className = '' }) => {
  const { theme, toggleTheme, animations } = useTheme();

  const ToggleComponent = animations ? motion.button : 'button';

  const motionProps = animations ? {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 },
    initial: { opacity: 0, rotate: -180 },
    animate: { opacity: 1, rotate: 0 },
    transition: { duration: 0.3 }
  } : {};

  return (
    <ToggleComponent
      onClick={toggleTheme}
      className={`
        relative
        p-2
        rounded-xl
        bg-neutral-200
        dark:bg-neutral-800
        border
        border-neutral-300
        dark:border-neutral-700
        hover:bg-neutral-300
        dark:hover:bg-neutral-700
        transition-all
        duration-300
        ease-out
        focus:outline-none
        focus:ring-2
        focus:ring-primary-500
        focus:ring-offset-2
        dark:focus:ring-offset-neutral-900
        ${className}
      `}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      {...motionProps}
    >
      <motion.div
        className="relative w-6 h-6"
        animate={animations ? { rotate: theme === 'dark' ? 180 : 0 } : {}}
        transition={animations ? { duration: 0.5, ease: "easeInOut" } : {}}
      >
        <SunIcon 
          className={`
            absolute
            inset-0
            w-6
            h-6
            text-amber-500
            transition-opacity
            duration-300
            ${theme === 'dark' ? 'opacity-0' : 'opacity-100'}
          `}
        />
        <MoonIcon 
          className={`
            absolute
            inset-0
            w-6
            h-6
            text-indigo-400
            transition-opacity
            duration-300
            ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}
          `}
        />
      </motion.div>
    </ToggleComponent>
  );
};

export default ThemeToggle;