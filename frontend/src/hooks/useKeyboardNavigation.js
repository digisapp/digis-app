import { useEffect, useCallback } from 'react';

/**
 * Hook for keyboard navigation and accessibility
 * Features: arrow navigation, focus management, screen reader support
 */
export const useKeyboardNavigation = ({
  containerRef,
  itemSelector = '[data-nav-item]',
  orientation = 'horizontal', // 'horizontal' | 'vertical' | 'grid'
  loop = true,
  onSelect,
  disabled = false
}) => {
  const focusItem = useCallback((element) => {
    if (element) {
      element.focus();
      // Announce to screen readers
      const label = element.getAttribute('aria-label') || element.textContent;
      if (label) {
        // Create temporary announcement for screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = `Navigated to ${label}`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      }
    }
  }, []);

  const getItems = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll(itemSelector));
  }, [containerRef, itemSelector]);

  const getCurrentIndex = useCallback(() => {
    const items = getItems();
    const focused = document.activeElement;
    return items.findIndex(item => item === focused || item.contains(focused));
  }, [getItems]);

  const navigateToIndex = useCallback((index) => {
    const items = getItems();
    if (items.length === 0) return;

    let targetIndex = index;
    
    if (loop) {
      if (targetIndex < 0) targetIndex = items.length - 1;
      if (targetIndex >= items.length) targetIndex = 0;
    } else {
      targetIndex = Math.max(0, Math.min(targetIndex, items.length - 1));
    }

    focusItem(items[targetIndex]);
  }, [getItems, loop, focusItem]);

  const handleKeyDown = useCallback((event) => {
    if (disabled) return;

    const items = getItems();
    if (items.length === 0) return;

    const currentIndex = getCurrentIndex();
    let handled = false;

    switch (event.key) {
      case 'ArrowRight':
        if (orientation === 'horizontal' || orientation === 'grid') {
          navigateToIndex(currentIndex + 1);
          handled = true;
        }
        break;

      case 'ArrowLeft':
        if (orientation === 'horizontal' || orientation === 'grid') {
          navigateToIndex(currentIndex - 1);
          handled = true;
        }
        break;

      case 'ArrowDown':
        if (orientation === 'vertical') {
          navigateToIndex(currentIndex + 1);
          handled = true;
        } else if (orientation === 'grid') {
          // For grid navigation, move down a row
          const columns = Math.ceil(Math.sqrt(items.length));
          navigateToIndex(currentIndex + columns);
          handled = true;
        }
        break;

      case 'ArrowUp':
        if (orientation === 'vertical') {
          navigateToIndex(currentIndex - 1);
          handled = true;
        } else if (orientation === 'grid') {
          // For grid navigation, move up a row
          const columns = Math.ceil(Math.sqrt(items.length));
          navigateToIndex(currentIndex - columns);
          handled = true;
        }
        break;

      case 'Home':
        navigateToIndex(0);
        handled = true;
        break;

      case 'End':
        navigateToIndex(items.length - 1);
        handled = true;
        break;

      case 'Enter':
      case ' ':
        if (currentIndex >= 0 && onSelect) {
          onSelect(items[currentIndex], currentIndex);
          handled = true;
        }
        break;

      case 'Escape':
        // Remove focus from navigation
        if (document.activeElement && items.includes(document.activeElement)) {
          document.activeElement.blur();
          handled = true;
        }
        break;

      default:
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, [disabled, getItems, getCurrentIndex, navigateToIndex, orientation, onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    container.addEventListener('keydown', handleKeyDown);
    
    // Set up proper ARIA attributes
    container.setAttribute('role', orientation === 'grid' ? 'grid' : 'navigation');
    container.setAttribute('aria-orientation', orientation === 'grid' ? undefined : orientation);

    // Make items focusable and add proper roles
    const items = getItems();
    items.forEach((item, index) => {
      if (!item.hasAttribute('tabindex')) {
        item.setAttribute('tabindex', index === 0 ? '0' : '-1');
      }
      if (!item.hasAttribute('role')) {
        item.setAttribute('role', orientation === 'grid' ? 'gridcell' : 'menuitem');
      }
      item.setAttribute('data-nav-index', index.toString());
    });

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, disabled, handleKeyDown, getItems, orientation]);

  // Focus management utilities
  const focusFirst = useCallback(() => {
    navigateToIndex(0);
  }, [navigateToIndex]);

  const focusLast = useCallback(() => {
    const items = getItems();
    navigateToIndex(items.length - 1);
  }, [getItems, navigateToIndex]);

  const focusNext = useCallback(() => {
    const currentIndex = getCurrentIndex();
    navigateToIndex(currentIndex + 1);
  }, [getCurrentIndex, navigateToIndex]);

  const focusPrevious = useCallback(() => {
    const currentIndex = getCurrentIndex();
    navigateToIndex(currentIndex - 1);
  }, [getCurrentIndex, navigateToIndex]);

  return {
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    focusItem: (index) => navigateToIndex(index),
    currentIndex: getCurrentIndex()
  };
};

export default useKeyboardNavigation;