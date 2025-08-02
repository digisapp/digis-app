import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

const Tooltip = ({ 
  children, 
  content, 
  position = 'top',
  delay = 0,
  disabled = false,
  animate = true,
  maxWidth = '200px',
  className = ''
}) => {
  const { animations } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timeoutRef = useRef(null);

  const showTooltip = () => {
    if (disabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      adjustPosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const adjustPosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let newPosition = position;

    // Check if tooltip would overflow and adjust position
    switch (position) {
      case 'top':
        if (triggerRect.top - tooltipRect.height < 0) {
          newPosition = 'bottom';
        }
        break;
      case 'bottom':
        if (triggerRect.bottom + tooltipRect.height > viewportHeight) {
          newPosition = 'top';
        }
        break;
      case 'left':
        if (triggerRect.left - tooltipRect.width < 0) {
          newPosition = 'right';
        }
        break;
      case 'right':
        if (triggerRect.right + tooltipRect.width > viewportWidth) {
          newPosition = 'left';
        }
        break;
      default:
        // Keep original position for unknown position values
        break;
    }

    setActualPosition(newPosition);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getPositionClasses = () => {
    const baseClasses = 'absolute z-50';
    
    switch (actualPosition) {
      case 'top':
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
      case 'bottom':
        return `${baseClasses} top-full left-1/2 transform -translate-x-1/2 mt-2`;
      case 'left':
        return `${baseClasses} right-full top-1/2 transform -translate-y-1/2 mr-2`;
      case 'right':
        return `${baseClasses} left-full top-1/2 transform -translate-y-1/2 ml-2`;
      case 'top-left':
        return `${baseClasses} bottom-full right-0 mb-2`;
      case 'top-right':
        return `${baseClasses} bottom-full left-0 mb-2`;
      case 'bottom-left':
        return `${baseClasses} top-full right-0 mt-2`;
      case 'bottom-right':
        return `${baseClasses} top-full left-0 mt-2`;
      default:
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
    }
  };

  const getArrowClasses = () => {
    const baseArrow = 'absolute w-2 h-2 bg-neutral-900 dark:bg-neutral-100 transform rotate-45';
    
    switch (actualPosition) {
      case 'top':
        return `${baseArrow} top-full left-1/2 transform -translate-x-1/2 -translate-y-1/2`;
      case 'bottom':
        return `${baseArrow} bottom-full left-1/2 transform -translate-x-1/2 translate-y-1/2`;
      case 'left':
        return `${baseArrow} left-full top-1/2 transform -translate-y-1/2 -translate-x-1/2`;
      case 'right':
        return `${baseArrow} right-full top-1/2 transform -translate-y-1/2 translate-x-1/2`;
      case 'top-left':
      case 'top-right':
        return `${baseArrow} top-full left-4 transform -translate-y-1/2`;
      case 'bottom-left':
      case 'bottom-right':
        return `${baseArrow} bottom-full left-4 transform translate-y-1/2`;
      default:
        return `${baseArrow} top-full left-1/2 transform -translate-x-1/2 -translate-y-1/2`;
    }
  };

  const tooltipVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      y: actualPosition === 'top' || actualPosition.includes('top') ? 10 : 
         actualPosition === 'bottom' || actualPosition.includes('bottom') ? -10 : 0,
      x: actualPosition === 'left' ? 10 : actualPosition === 'right' ? -10 : 0
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 20,
        duration: 0.2
      }
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      transition: {
        duration: 0.1,
        ease: "easeIn"
      }
    }
  };

  const TooltipComponent = animate && animations ? motion.div : 'div';

  const motionProps = animate && animations ? {
    variants: tooltipVariants,
    initial: "hidden",
    animate: "visible",
    exit: "exit"
  } : {};

  return (
    <div 
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      
      <AnimatePresence>
        {isVisible && content && (
          <TooltipComponent
            ref={tooltipRef}
            className={`${getPositionClasses()} ${className}`}
            style={{ maxWidth }}
            {...motionProps}
          >
            <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium px-3 py-2 rounded-lg shadow-lg">
              {content}
            </div>
            <div className={getArrowClasses()} />
          </TooltipComponent>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tooltip;