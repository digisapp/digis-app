// Modal accessibility hook for consistent focus management, keyboard handling, and ARIA attributes
// Ensures all modals are accessible and follow WCAG guidelines

import { useEffect, useRef, useCallback } from 'react';
import { devLog } from '../utils/devLog';

/**
 * Hook for managing modal accessibility
 * @param {boolean} isOpen - Whether the modal is open
 * @param {Object} options - Configuration options
 * @returns {Object} - Modal refs and handlers
 */
export function useModalA11y(isOpen, options = {}) {
  const {
    modalRef,
    onClose,
    closeOnEscape = true,
    closeOnClickOutside = true,
    lockScroll = true,
    returnFocus = true,
    autoFocus = true,
    focusSelector = '[tabindex]:not([tabindex="-1"]), button, input, select, textarea, a[href]'
  } = options;

  const internalModalRef = useRef(null);
  const previousActiveElement = useRef(null);
  const scrollPosition = useRef(null);

  // Use provided ref or internal ref
  const activeModalRef = modalRef || internalModalRef;

  // Store the element that was focused before modal opened
  useEffect(() => {
    if (isOpen && returnFocus) {
      previousActiveElement.current = document.activeElement;
      devLog('Stored previous focus:', previousActiveElement.current);
    }
  }, [isOpen, returnFocus]);

  // Focus management
  useEffect(() => {
    if (!isOpen || !activeModalRef.current) return;

    const modalElement = activeModalRef.current;

    // Set ARIA attributes
    modalElement.setAttribute('role', 'dialog');
    modalElement.setAttribute('aria-modal', 'true');

    // Auto focus first focusable element
    if (autoFocus) {
      const focusableElements = modalElement.querySelectorAll(focusSelector);
      const firstElement = focusableElements[0];

      if (firstElement) {
        // Delay focus to ensure modal is fully rendered
        requestAnimationFrame(() => {
          firstElement.focus();
          devLog('Focused first element:', firstElement);
        });
      }
    }

    // Trap focus within modal
    const handleTabKey = (event) => {
      if (event.key !== 'Tab') return;

      const focusableElements = Array.from(
        modalElement.querySelectorAll(focusSelector)
      ).filter(el => !el.disabled && !el.hidden);

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      // Shift + Tab
      if (event.shiftKey) {
        if (activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      }
      // Tab
      else {
        if (activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    modalElement.addEventListener('keydown', handleTabKey);

    return () => {
      modalElement.removeEventListener('keydown', handleTabKey);
    };
  }, [isOpen, activeModalRef, autoFocus, focusSelector]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        event.stopPropagation();
        devLog('Modal closed via Escape key');
        onClose?.();
      }
    };

    // Add to document for global capture
    document.addEventListener('keydown', handleEscape, true);

    return () => {
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [isOpen, closeOnEscape, onClose]);

  // Click outside handler
  useEffect(() => {
    if (!isOpen || !closeOnClickOutside || !activeModalRef.current) return;

    const handleClickOutside = (event) => {
      const modalElement = activeModalRef.current;

      // Check if click was on the backdrop (modal container)
      if (event.target === modalElement) {
        devLog('Modal closed via outside click');
        onClose?.();
      }
    };

    // Delay to prevent immediate close on open
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeOnClickOutside, activeModalRef, onClose]);

  // Scroll lock
  useEffect(() => {
    if (!lockScroll) return;

    if (isOpen) {
      // Store current scroll position
      scrollPosition.current = {
        x: window.scrollX,
        y: window.scrollY
      };

      // Get current scrollbar width
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      // Lock scroll
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;

      document.body.style.overflow = 'hidden';

      // Add padding to prevent layout shift from scrollbar
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      // Also set position fixed for iOS
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.top = `-${scrollPosition.current.y}px`;
      }

      devLog('Body scroll locked');

      return () => {
        // Restore scroll
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;

        // Restore position for iOS
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
          document.body.style.position = '';
          document.body.style.width = '';
          document.body.style.top = '';
          window.scrollTo(scrollPosition.current.x, scrollPosition.current.y);
        }

        devLog('Body scroll unlocked');
      };
    }
  }, [isOpen, lockScroll]);

  // Return focus when modal closes
  useEffect(() => {
    if (!isOpen && returnFocus && previousActiveElement.current) {
      // Small delay to ensure modal is fully closed
      const timeoutId = setTimeout(() => {
        if (previousActiveElement.current && document.body.contains(previousActiveElement.current)) {
          previousActiveElement.current.focus();
          devLog('Returned focus to:', previousActiveElement.current);
        }
        previousActiveElement.current = null;
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, returnFocus]);

  // Helper to get focusable elements
  const getFocusableElements = useCallback(() => {
    if (!activeModalRef.current) return [];

    return Array.from(
      activeModalRef.current.querySelectorAll(focusSelector)
    ).filter(el => !el.disabled && !el.hidden);
  }, [activeModalRef, focusSelector]);

  // Helper to focus first element
  const focusFirst = useCallback(() => {
    const elements = getFocusableElements();
    if (elements[0]) {
      elements[0].focus();
    }
  }, [getFocusableElements]);

  // Helper to focus last element
  const focusLast = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[elements.length - 1].focus();
    }
  }, [getFocusableElements]);

  return {
    modalRef: activeModalRef,
    getFocusableElements,
    focusFirst,
    focusLast
  };
}

/**
 * Simple hook for basic modal accessibility
 * @param {boolean} isOpen - Whether modal is open
 * @param {Function} onClose - Close handler
 * @returns {Object} - Modal ref and props
 */
export function useSimpleModalA11y(isOpen, onClose) {
  const modalRef = useRef(null);

  useModalA11y(isOpen, {
    modalRef,
    onClose
  });

  return {
    modalRef,
    modalProps: {
      role: 'dialog',
      'aria-modal': true,
      tabIndex: -1
    }
  };
}

// Export default
export default useModalA11y;