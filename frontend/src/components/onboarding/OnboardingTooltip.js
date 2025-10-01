import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon, 
  ChevronRightIcon,
  ChevronLeftIcon,
  CheckIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';
import { createPortal } from 'react-dom';

const OnboardingTooltip = ({ 
  children, 
  step, 
  totalSteps, 
  title, 
  description, 
  position = 'bottom',
  showArrow = true,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  isVisible = false,
  trigger = 'hover', // 'hover', 'click', 'focus', 'manual'
  theme = 'default', // 'default', 'success', 'warning', 'info'
  interactive = true,
  maxWidth = 320,
  offset = 10,
  zIndex = 1000,
  allowHTML = false
}) => {
  const [isOpen, setIsOpen] = useState(isVisible);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [actualPosition, setActualPosition] = useState(position);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timeoutRef = useRef(null);

  // Theme configurations
  const themes = {
    default: {
      bg: 'bg-gray-900 dark:bg-white',
      text: 'text-white dark:text-gray-900',
      border: 'border-gray-700 dark:border-gray-200',
      accent: 'text-blue-400 dark:text-blue-600'
    },
    success: {
      bg: 'bg-green-600 dark:bg-green-500',
      text: 'text-white',
      border: 'border-green-500 dark:border-green-400',
      accent: 'text-green-200 dark:text-green-100'
    },
    warning: {
      bg: 'bg-yellow-600 dark:bg-yellow-500',
      text: 'text-white dark:text-yellow-900',
      border: 'border-yellow-500 dark:border-yellow-400',
      accent: 'text-yellow-200 dark:text-yellow-100'
    },
    info: {
      bg: 'bg-blue-600 dark:bg-blue-500',
      text: 'text-white',
      border: 'border-blue-500 dark:border-blue-400',
      accent: 'text-blue-200 dark:text-blue-100'
    }
  };

  const currentTheme = themes[theme];

  // Calculate tooltip position
  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newPosition = { top: 0, left: 0 };
    let actualPos = position;

    // Calculate initial position based on preferred direction
    switch (position) {
      case 'top':
        newPosition.top = triggerRect.top - tooltipRect.height - offset;
        newPosition.left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        newPosition.top = triggerRect.bottom + offset;
        newPosition.left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        newPosition.top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        newPosition.left = triggerRect.left - tooltipRect.width - offset;
        break;
      case 'right':
        newPosition.top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        newPosition.left = triggerRect.right + offset;
        break;
      default:
        newPosition.top = triggerRect.bottom + offset;
        newPosition.left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
    }

    // Adjust if tooltip would go outside viewport
    if (newPosition.left < 10) {
      newPosition.left = 10;
    } else if (newPosition.left + tooltipRect.width > viewportWidth - 10) {
      newPosition.left = viewportWidth - tooltipRect.width - 10;
    }

    if (newPosition.top < 10) {
      // If top position is too high, try bottom
      if (position === 'top') {
        newPosition.top = triggerRect.bottom + offset;
        actualPos = 'bottom';
      } else {
        newPosition.top = 10;
      }
    } else if (newPosition.top + tooltipRect.height > viewportHeight - 10) {
      // If bottom position is too low, try top
      if (position === 'bottom') {
        newPosition.top = triggerRect.top - tooltipRect.height - offset;
        actualPos = 'top';
      } else {
        newPosition.top = viewportHeight - tooltipRect.height - 10;
      }
    }

    setTooltipPosition(newPosition);
    setActualPosition(actualPos);
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        calculatePosition();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Handle position calculation when tooltip becomes visible
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is ready
      setTimeout(calculatePosition, 10);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Handle controlled visibility
  useEffect(() => {
    setIsOpen(isVisible);
  }, [isVisible]);

  // Handle trigger events
  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      clearTimeout(timeoutRef.current);
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      timeoutRef.current = setTimeout(() => setIsOpen(false), 100);
    }
  };

  const handleClick = () => {
    if (trigger === 'click') {
      setIsOpen(!isOpen);
    }
  };

  const handleFocus = () => {
    if (trigger === 'focus') {
      setIsOpen(true);
    }
  };

  const handleBlur = () => {
    if (trigger === 'focus') {
      setIsOpen(false);
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          setIsOpen(false);
          onSkip?.();
          break;
        case 'ArrowRight':
          if (step < totalSteps) {
            onNext?.();
          }
          break;
        case 'ArrowLeft':
          if (step > 1) {
            onPrev?.();
          }
          break;
        case 'Enter':
          if (step === totalSteps) {
            onComplete?.();
          } else {
            onNext?.();
          }
          break;
        default:
          // Ignore other keys
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, totalSteps, onNext, onPrev, onSkip, onComplete]);

  // Close on outside click for click trigger
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (trigger === 'click' && 
          tooltipRef.current && 
          !tooltipRef.current.contains(e.target) &&
          triggerRef.current &&
          !triggerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen, trigger]);

  // Arrow component
  const Arrow = ({ position: arrowPosition }) => {
    const arrowClasses = `absolute w-3 h-3 ${currentTheme.bg} transform rotate-45 border ${currentTheme.border}`;
    
    switch (arrowPosition) {
      case 'top':
        return <div className={`${arrowClasses} -bottom-1.5 left-1/2 -translate-x-1/2 border-t-0 border-l-0`} />;
      case 'bottom':
        return <div className={`${arrowClasses} -top-1.5 left-1/2 -translate-x-1/2 border-b-0 border-r-0`} />;
      case 'left':
        return <div className={`${arrowClasses} -right-1.5 top-1/2 -translate-y-1/2 border-l-0 border-b-0`} />;
      case 'right':
        return <div className={`${arrowClasses} -left-1.5 top-1/2 -translate-y-1/2 border-r-0 border-t-0`} />;
      default:
        return null;
    }
  };

  // Tooltip content
  const TooltipContent = () => (
    <motion.div
      ref={tooltipRef}
      className={`
        fixed ${currentTheme.bg} ${currentTheme.text} rounded-xl shadow-2xl border ${currentTheme.border}
        p-5 backdrop-blur-sm z-[${zIndex}] pointer-events-auto
      `}
      style={{
        top: tooltipPosition.top,
        left: tooltipPosition.left,
        maxWidth: maxWidth,
        zIndex: zIndex
      }}
      initial={{ opacity: 0, scale: 0.9, y: actualPosition === 'top' ? 10 : -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: actualPosition === 'top' ? 10 : -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onMouseEnter={() => trigger === 'hover' && clearTimeout(timeoutRef.current)}
      onMouseLeave={() => trigger === 'hover' && handleMouseLeave()}
    >
      {showArrow && <Arrow position={actualPosition} />}
      
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <LightBulbIcon className={`w-5 h-5 ${currentTheme.accent}`} />
          {step && totalSteps && (
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${currentTheme.accent}`}>
                Step {step} of {totalSteps}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: totalSteps }, (_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i < step 
                        ? `bg-current ${currentTheme.accent}` 
                        : 'bg-gray-400 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        
        {onSkip && (
          <button
            onClick={onSkip}
            className={`p-1 hover:bg-white/10 rounded-lg transition-colors ${currentTheme.text}`}
            aria-label="Skip onboarding"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="mb-4">
        {title && (
          <h3 className="font-semibold text-lg mb-2">
            {allowHTML ? <span dangerouslySetInnerHTML={{ __html: title }} /> : title}
          </h3>
        )}
        
        <p className={`text-sm leading-relaxed ${currentTheme.text} opacity-90`}>
          {allowHTML ? <span dangerouslySetInnerHTML={{ __html: description }} /> : description}
        </p>
      </div>

      {/* Actions */}
      {(onPrev || onNext || onComplete) && (
        <div className="flex items-center justify-between">
          <div>
            {onPrev && step > 1 && (
              <button
                onClick={onPrev}
                className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg hover:bg-white/10 transition-colors ${currentTheme.text}`}
              >
                <ChevronLeftIcon className="w-4 h-4" />
                Back
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {onSkip && step < totalSteps && (
              <button
                onClick={onSkip}
                className={`px-3 py-2 text-sm font-medium rounded-lg hover:bg-white/10 transition-colors ${currentTheme.text} opacity-70`}
              >
                Skip
              </button>
            )}
            
            {step === totalSteps ? (
              <button
                onClick={onComplete}
                className="flex items-center gap-1 px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                <CheckIcon className="w-4 h-4" />
                Complete
              </button>
            ) : (
              onNext && (
                <button
                  onClick={onNext}
                  className="flex items-center gap-1 px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Next
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              )
            )}
          </div>
        </div>
      )}
    </motion.div>
  );

  return (
    <>
      {/* Trigger Element */}
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="inline-block"
      >
        {children}
      </div>

      {/* Tooltip Portal */}
      {isOpen && createPortal(
        <div className="fixed inset-0 pointer-events-none z-[999]">
          <AnimatePresence>
            <TooltipContent />
          </AnimatePresence>
        </div>,
        document.body
      )}
    </>
  );
};

export default OnboardingTooltip;