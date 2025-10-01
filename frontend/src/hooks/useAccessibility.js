import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook for creating accessible button props
 */
export const useAccessibleButton = (label, onClick, disabled = false) => ({
  onClick,
  disabled,
  'aria-label': label,
  role: 'button',
  tabIndex: disabled ? -1 : 0,
  onKeyDown: (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      onClick?.(e);
    }
  }
});

/**
 * Hook for creating accessible modal props
 */
export const useAccessibleModal = (isOpen, onClose, label) => {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      // Focus trap
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements?.length > 0) {
        focusableElements[0].focus();
      }
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return {
    ref: modalRef,
    role: 'dialog',
    'aria-modal': true,
    'aria-label': label,
    tabIndex: -1
  };
};

/**
 * Hook for creating accessible tab props
 */
export const useAccessibleTabs = (tabs, activeTab, onChange) => {
  const tabListRef = useRef(null);

  const handleKeyDown = (e) => {
    const tabElements = Array.from(
      tabListRef.current?.querySelectorAll('[role="tab"]') || []
    );
    const currentIndex = tabElements.findIndex(el => el === e.target);

    let newIndex = currentIndex;
    
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        newIndex = (currentIndex + 1) % tabElements.length;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = (currentIndex - 1 + tabElements.length) % tabElements.length;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = tabElements.length - 1;
        break;
      default:
        return;
    }

    if (newIndex !== currentIndex && tabElements[newIndex]) {
      tabElements[newIndex].focus();
      onChange(tabs[newIndex].id);
    }
  };

  const getTabProps = (tab, index) => ({
    role: 'tab',
    'aria-selected': activeTab === tab.id,
    'aria-controls': `tabpanel-${tab.id}`,
    id: `tab-${tab.id}`,
    tabIndex: activeTab === tab.id ? 0 : -1,
    onClick: () => onChange(tab.id),
    onKeyDown: handleKeyDown
  });

  const getTabPanelProps = (tabId) => ({
    role: 'tabpanel',
    id: `tabpanel-${tabId}`,
    'aria-labelledby': `tab-${tabId}`,
    hidden: activeTab !== tabId,
    tabIndex: 0
  });

  return {
    tabListProps: {
      ref: tabListRef,
      role: 'tablist',
      'aria-label': 'Navigation tabs'
    },
    getTabProps,
    getTabPanelProps
  };
};

/**
 * Hook for announcing messages to screen readers
 */
export const useAnnouncement = () => {
  const announce = (message, priority = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.setAttribute('style', 'position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden;');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  return announce;
};

/**
 * Hook for creating an ARIA live region
 */
export const useAriaLiveRegion = (initialMessage = '', priority = 'polite') => {
  const [message, setMessage] = useState(initialMessage);
  const regionRef = useRef(null);

  useEffect(() => {
    if (regionRef.current && message) {
      regionRef.current.textContent = message;
    }
  }, [message]);

  const liveRegionProps = {
    ref: regionRef,
    'aria-live': priority,
    'aria-atomic': true,
    className: 'sr-only',
    style: {
      position: 'absolute',
      left: '-9999px',
      width: '1px',
      height: '1px',
      overflow: 'hidden'
    }
  };

  return [setMessage, liveRegionProps];
};

/**
 * Hook for keyboard navigation in grids/lists
 */
export const useKeyboardNavigation = (items, onSelect, options = {}) => {
  const {
    orientation = 'vertical',
    wrap = true,
    onEscape = null
  } = options;

  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef([]);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items.length]);

  const handleKeyDown = useCallback((e) => {
    const itemCount = items.length;
    if (itemCount === 0) return;

    let newIndex = focusedIndex;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        if (orientation === 'vertical' && e.key === 'ArrowRight') return;
        if (orientation === 'horizontal' && e.key === 'ArrowDown') return;
        
        newIndex = focusedIndex + 1;
        if (newIndex >= itemCount) {
          newIndex = wrap ? 0 : itemCount - 1;
        }
        break;

      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        if (orientation === 'vertical' && e.key === 'ArrowLeft') return;
        if (orientation === 'horizontal' && e.key === 'ArrowUp') return;
        
        newIndex = focusedIndex - 1;
        if (newIndex < 0) {
          newIndex = wrap ? itemCount - 1 : 0;
        }
        break;

      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;

      case 'End':
        e.preventDefault();
        newIndex = itemCount - 1;
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        if (onSelect && items[focusedIndex]) {
          onSelect(items[focusedIndex], focusedIndex);
        }
        break;

      case 'Escape':
        if (onEscape) {
          e.preventDefault();
          onEscape();
        }
        break;

      default:
        return;
    }

    if (newIndex !== focusedIndex) {
      setFocusedIndex(newIndex);
      itemRefs.current[newIndex]?.focus();
    }
  }, [focusedIndex, items, onSelect, orientation, wrap, onEscape]);

  const getItemProps = (index) => ({
    ref: (el) => itemRefs.current[index] = el,
    tabIndex: index === focusedIndex ? 0 : -1,
    onKeyDown: handleKeyDown,
    onFocus: () => setFocusedIndex(index),
    'aria-selected': index === focusedIndex
  });

  return {
    focusedIndex,
    getItemProps,
    setFocusedIndex
  };
};

/**
 * Hook for focus trap (useful for modals and dropdowns)
 */
export const useFocusTrap = (isActive = true) => {
  const containerRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    previousActiveElement.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement.focus();

    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    return () => {
      container.removeEventListener('keydown', handleTabKey);
      // Restore focus to previous element
      if (previousActiveElement.current && previousActiveElement.current.focus) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive]);

  return containerRef;
};

/**
 * Hook for managing form field descriptions and errors
 */
export const useAriaDescribedBy = (fieldId, description, error) => {
  const descriptionId = `${fieldId}-description`;
  const errorId = `${fieldId}-error`;

  const fieldProps = {
    'aria-describedby': [
      description && descriptionId,
      error && errorId
    ].filter(Boolean).join(' ') || undefined,
    'aria-invalid': !!error
  };

  const descriptionProps = description ? {
    id: descriptionId,
    className: 'sr-only'
  } : null;

  const errorProps = error ? {
    id: errorId,
    role: 'alert',
    'aria-live': 'polite'
  } : null;

  return {
    fieldProps,
    descriptionProps,
    errorProps
  };
};