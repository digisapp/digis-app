import React, { useState, useRef, useEffect, memo, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';

const Tooltip = memo(({
  children,
  content,
  position = 'top',
  delay = 0,
  disabled = false,
  animate = true,
  maxWidth = '200px',
  className = '',
  id: idProp
}) => {
  // Generate stable ID
  const generatedId = useId();
  const id = idProp || `tooltip-${generatedId}`;

  // Handle missing ThemeContext gracefully
  const theme = useTheme();
  const animations = theme?.animations ?? true;

  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timeoutRef = useRef(null);

  // Validate props without mutation
  const validPositions = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const safePosition = validPositions.includes(position) ? position : 'top';
  const safeDelay = typeof delay === 'number' && delay >= 0 ? delay : 0;

  if (!validPositions.includes(position)) {
    console.warn(`Invalid tooltip position: ${position}. Using 'top'.`);
  }

  if (typeof delay !== 'number' || delay < 0) {
    console.warn(`Invalid delay: ${delay}. Using 0.`);
  }
  
  if (!content) {
    // Return children without tooltip wrapper if no content
    return <>{children}</>;
  }

  const showTooltip = () => {
    if (disabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      // Position adjustment now happens in useEffect
    }, safeDelay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && isVisible) {
      e.preventDefault();
      hideTooltip();
    }
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
        // Keep original position for corner positions
        break;
    }

    setActualPosition(newPosition);
  };

  useEffect(() => {
    // Add global keydown listener when tooltip is visible
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && isVisible) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleGlobalKeyDown);
      // Adjust position after render
      const timer = setTimeout(() => {
        adjustPosition();
      }, 0);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleGlobalKeyDown);
      };
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isVisible]); // Only depend on isVisible, not functions

  const getPositionClasses = () => {
    const baseClasses = 'absolute z-50';
    const positions = {
      top: `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`,
      bottom: `${baseClasses} top-full left-1/2 transform -translate-x-1/2 mt-2`,
      left: `${baseClasses} right-full top-1/2 transform -translate-y-1/2 mr-2`,
      right: `${baseClasses} left-full top-1/2 transform -translate-y-1/2 ml-2`,
      'top-left': `${baseClasses} bottom-full right-0 mb-2`,
      'top-right': `${baseClasses} bottom-full left-0 mb-2`,
      'bottom-left': `${baseClasses} top-full right-0 mt-2`,
      'bottom-right': `${baseClasses} top-full left-0 mt-2`
    };
    
    return positions[actualPosition] || positions.top;
  };

  const getArrowClasses = () => {
    const baseArrow = 'absolute w-2 h-2 bg-neutral-900 dark:bg-neutral-100 transform rotate-45';
    const arrows = {
      top: `${baseArrow} top-full left-1/2 transform -translate-x-1/2 -translate-y-1/2`,
      bottom: `${baseArrow} bottom-full left-1/2 transform -translate-x-1/2 translate-y-1/2`,
      left: `${baseArrow} left-full top-1/2 transform -translate-y-1/2 -translate-x-1/2`,
      right: `${baseArrow} right-full top-1/2 transform -translate-y-1/2 translate-x-1/2`,
      'top-left': `${baseArrow} top-full left-4 transform -translate-y-1/2`,
      'top-right': `${baseArrow} top-full left-4 transform -translate-y-1/2`,
      'bottom-left': `${baseArrow} bottom-full left-4 transform translate-y-1/2`,
      'bottom-right': `${baseArrow} bottom-full left-4 transform translate-y-1/2`
    };
    
    return arrows[actualPosition] || arrows.top;
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
      onKeyDown={handleKeyDown}
      aria-describedby={isVisible ? id : undefined}
    >
      {children}
      
      <AnimatePresence>
        {isVisible && content && (
          <TooltipComponent
            ref={tooltipRef}
            id={id}
            role="tooltip"
            className={`${getPositionClasses()} ${className}`}
            style={{ maxWidth }}
            {...motionProps}
          >
            <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium px-3 py-2 rounded-lg shadow-lg">
              {content}
            </div>
            <div className={getArrowClasses()} aria-hidden="true" />
          </TooltipComponent>
        )}
      </AnimatePresence>
    </div>
  );
});

Tooltip.displayName = 'Tooltip';

export default Tooltip;