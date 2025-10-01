/**
 * Accessibility utilities and hooks
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// Keyboard navigation keys
export const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  TAB: 'Tab',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown'
};

// Focus management hook
export const useFocusTrap = (isActive = true) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleKeyDown = (e) => {
      if (e.key !== KEYS.TAB) return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);
  
  return containerRef;
};

// Keyboard navigation hook
export const useKeyboardNavigation = (items, options = {}) => {
  const {
    onSelect,
    onCancel,
    orientation = 'vertical',
    loop = true,
    autoFocus = true
  } = options;
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef([]);
  
  useEffect(() => {
    if (autoFocus && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex].focus();
    }
  }, [selectedIndex, autoFocus]);
  
  const handleKeyDown = useCallback((e) => {
    const key = e.key;
    const itemCount = items.length;
    
    switch (key) {
      case KEYS.ARROW_UP:
      case KEYS.ARROW_LEFT:
        e.preventDefault();
        setSelectedIndex(prev => {
          if (orientation === 'horizontal' && key === KEYS.ARROW_UP) return prev;
          if (orientation === 'vertical' && key === KEYS.ARROW_LEFT) return prev;
          
          const newIndex = prev - 1;
          if (newIndex < 0) {
            return loop ? itemCount - 1 : 0;
          }
          return newIndex;
        });
        break;
        
      case KEYS.ARROW_DOWN:
      case KEYS.ARROW_RIGHT:
        e.preventDefault();
        setSelectedIndex(prev => {
          if (orientation === 'horizontal' && key === KEYS.ARROW_DOWN) return prev;
          if (orientation === 'vertical' && key === KEYS.ARROW_RIGHT) return prev;
          
          const newIndex = prev + 1;
          if (newIndex >= itemCount) {
            return loop ? 0 : itemCount - 1;
          }
          return newIndex;
        });
        break;
        
      case KEYS.HOME:
        e.preventDefault();
        setSelectedIndex(0);
        break;
        
      case KEYS.END:
        e.preventDefault();
        setSelectedIndex(itemCount - 1);
        break;
        
      case KEYS.ENTER:
      case KEYS.SPACE:
        e.preventDefault();
        onSelect?.(items[selectedIndex], selectedIndex);
        break;
        
      case KEYS.ESCAPE:
        e.preventDefault();
        onCancel?.();
        break;
        
      default:
        break;
    }
  }, [items, orientation, loop, onSelect, onCancel]);
  
  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
    itemRefs
  };
};

// Announce changes to screen readers
export const useAnnounce = () => {
  const announceRef = useRef(null);
  
  useEffect(() => {
    if (!announceRef.current) {
      const announcer = document.createElement('div');
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only';
      document.body.appendChild(announcer);
      announceRef.current = announcer;
    }
    
    return () => {
      if (announceRef.current) {
        document.body.removeChild(announceRef.current);
        announceRef.current = null;
      }
    };
  }, []);
  
  const announce = useCallback((message, priority = 'polite') => {
    if (!announceRef.current) return;
    
    announceRef.current.setAttribute('aria-live', priority);
    announceRef.current.textContent = message;
    
    // Clear after announcement
    setTimeout(() => {
      if (announceRef.current) {
        announceRef.current.textContent = '';
      }
    }, 1000);
  }, []);
  
  return announce;
};

// Skip links component
export const SkipLinks = () => (
  <div className="sr-only focus-within:not-sr-only">
    <a
      href="#main-content"
      className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-lg z-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
    >
      Skip to main content
    </a>
    <a
      href="#navigation"
      className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-lg z-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
    >
      Skip to navigation
    </a>
  </div>
);

// Focus visible polyfill
export const initFocusVisible = () => {
  try {
    document.querySelector(':focus-visible');
  } catch {
    // Add focus-visible class manually
    let hadKeyboardEvent = true;
    const keyboardEvents = ['keydown', 'keyup'];
    const pointerEvents = ['mousedown', 'mouseup', 'touchstart', 'touchend'];
    
    const onPointerEvent = () => {
      hadKeyboardEvent = false;
    };
    
    const onKeyboardEvent = () => {
      hadKeyboardEvent = true;
    };
    
    keyboardEvents.forEach(event => {
      document.addEventListener(event, onKeyboardEvent, true);
    });
    
    pointerEvents.forEach(event => {
      document.addEventListener(event, onPointerEvent, true);
    });
    
    document.addEventListener('focus', (e) => {
      if (hadKeyboardEvent) {
        e.target.classList.add('focus-visible');
      }
    }, true);
    
    document.addEventListener('blur', (e) => {
      e.target.classList.remove('focus-visible');
    }, true);
  }
};

// ARIA helpers
export const ariaHelpers = {
  // Set loading state
  setLoading: (element, isLoading) => {
    element.setAttribute('aria-busy', isLoading);
  },
  
  // Set expanded state
  setExpanded: (element, isExpanded) => {
    element.setAttribute('aria-expanded', isExpanded);
  },
  
  // Set selected state
  setSelected: (element, isSelected) => {
    element.setAttribute('aria-selected', isSelected);
  },
  
  // Set disabled state
  setDisabled: (element, isDisabled) => {
    element.setAttribute('aria-disabled', isDisabled);
    if (isDisabled) {
      element.setAttribute('tabindex', '-1');
    } else {
      element.removeAttribute('tabindex');
    }
  },
  
  // Set live region
  setLiveRegion: (element, level = 'polite') => {
    element.setAttribute('aria-live', level);
    element.setAttribute('aria-atomic', 'true');
  }
};

// Reduced motion preference
export const prefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// High contrast mode detection
export const prefersHighContrast = () => {
  return window.matchMedia('(prefers-contrast: high)').matches;
};

// Color scheme preference
export const prefersColorScheme = () => {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

// Touch device detection
export const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// Screen reader detection (limited accuracy)
export const isScreenReaderActive = () => {
  // This is not 100% reliable but can help with some optimizations
  return document.body.getAttribute('aria-hidden') === 'true';
};

// Accessible modal hook
export const useAccessibleModal = (isOpen, onClose) => {
  const previousActiveElement = useRef(null);
  const modalRef = useFocusTrap(isOpen);
  
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      
      // Announce modal opening
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'assertive');
      announcement.className = 'sr-only';
      announcement.textContent = 'Dialog opened';
      document.body.appendChild(announcement);
      
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 100);
    } else {
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    }
    
    const handleEscape = (e) => {
      if (e.key === KEYS.ESCAPE && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);
  
  return modalRef;
};

// Debounced input for screen readers
export const useDebouncedAnnouncement = (value, delay = 500) => {
  const announce = useAnnounce();
  const timeoutRef = useRef(null);
  
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (value) {
        announce(value);
      }
    }, delay);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay, announce]);
};

export default {
  KEYS,
  useFocusTrap,
  useKeyboardNavigation,
  useAnnounce,
  SkipLinks,
  initFocusVisible,
  ariaHelpers,
  prefersReducedMotion,
  prefersHighContrast,
  prefersColorScheme,
  isTouchDevice,
  isScreenReaderActive,
  useAccessibleModal,
  useDebouncedAnnouncement
};