import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook for advanced focus management and accessibility
 * Features: focus trapping, restoration, skip links, roving tabindex
 */
export const useFocusManagement = ({
  enabled = true,
  restoreFocus = true,
  trapFocus = false,
  autoFocus = false
}) => {
  const containerRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];

    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
      'audio[controls]',
      'video[controls]',
      'details > summary:first-of-type'
    ].join(', ');

    return Array.from(containerRef.current.querySelectorAll(focusableSelectors))
      .filter(element => {
        // Filter out hidden elements
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               !element.hasAttribute('hidden');
      });
  }, []);

  // Focus first focusable element
  const focusFirst = useCallback(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
      return true;
    }
    return false;
  }, [getFocusableElements]);

  // Focus last focusable element
  const focusLast = useCallback(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus();
      return true;
    }
    return false;
  }, [getFocusableElements]);

  // Focus trap handler
  const handleKeyDown = useCallback((event) => {
    if (!enabled || !trapFocus) return;

    if (event.key === 'Tab') {
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        // Shift + Tab (backward)
        if (activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab (forward)
        if (activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }

    // Escape to break out of focus trap
    if (event.key === 'Escape' && trapFocus) {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
  }, [enabled, trapFocus, getFocusableElements]);

  // Store the currently focused element when component mounts
  useEffect(() => {
    if (enabled && restoreFocus) {
      previousActiveElement.current = document.activeElement;
    }

    // Auto-focus if enabled
    if (enabled && autoFocus) {
      const timer = setTimeout(() => {
        focusFirst();
      }, 100); // Small delay to ensure DOM is ready

      return () => clearTimeout(timer);
    }
  }, [enabled, restoreFocus, autoFocus, focusFirst]);

  // Set up focus trap event listener
  useEffect(() => {
    if (!enabled || !trapFocus || !containerRef.current) return;

    const container = containerRef.current;
    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, trapFocus, handleKeyDown]);

  // Restore focus when component unmounts
  useEffect(() => {
    return () => {
      if (enabled && restoreFocus && previousActiveElement.current) {
        // Check if the previous element still exists and is focusable
        if (document.contains(previousActiveElement.current)) {
          previousActiveElement.current.focus();
        }
      }
    };
  }, [enabled, restoreFocus]);

  // Create skip link
  const createSkipLink = useCallback((targetId, label = 'Skip to main content') => {
    const skipLink = document.createElement('a');
    skipLink.href = `#${targetId}`;
    skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded focus:shadow-lg';
    skipLink.textContent = label;
    
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(targetId);
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    return skipLink;
  }, []);

  // Set up roving tabindex for navigation menus
  const setupRovingTabindex = useCallback((selector = '[role="menuitem"], [role="tab"], [role="option"]') => {
    if (!containerRef.current) return;

    const items = Array.from(containerRef.current.querySelectorAll(selector));
    
    items.forEach((item, index) => {
      item.setAttribute('tabindex', index === 0 ? '0' : '-1');
      
      item.addEventListener('focus', () => {
        // Remove tabindex from all other items
        items.forEach(otherItem => {
          if (otherItem !== item) {
            otherItem.setAttribute('tabindex', '-1');
          }
        });
        // Set current item as focusable
        item.setAttribute('tabindex', '0');
      });
    });

    return () => {
      items.forEach(item => {
        item.removeAttribute('tabindex');
      });
    };
  }, []);

  // Focus announcement for screen readers
  const announceFocus = useCallback((message, priority = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 1000);
  }, []);

  return {
    containerRef,
    focusFirst,
    focusLast,
    createSkipLink,
    setupRovingTabindex,
    announceFocus,
    getFocusableElements
  };
};

export default useFocusManagement;