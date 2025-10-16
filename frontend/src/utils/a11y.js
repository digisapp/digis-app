/**
 * Accessibility utilities for mobile components
 * Ensures WCAG 2.1 Level AA compliance
 */

/**
 * Announce message to screen readers
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
export const announce = (message, priority = 'polite') => {
  const announcer = document.getElementById('a11y-announcer');

  if (announcer) {
    announcer.setAttribute('aria-live', priority);
    announcer.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }
};

/**
 * Focus element and scroll into view
 * @param {HTMLElement|React.RefObject} elementOrRef - Element or ref to focus
 * @param {Object} options - Scroll options
 */
export const focusElement = (elementOrRef, options = {}) => {
  const element = elementOrRef?.current || elementOrRef;

  if (element && typeof element.focus === 'function') {
    element.focus(options);

    // Ensure visible on mobile
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
        ...options
      });
    }
  }
};

/**
 * Trap focus within a modal/dialog
 * @param {HTMLElement} container - Container to trap focus in
 * @returns {Function} Cleanup function
 */
export const trapFocus = (container) => {
  if (!container) return () => {};

  const focusableElements = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Focus first element
  firstElement?.focus();

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
};

/**
 * Check if user prefers reduced motion
 * @returns {boolean}
 */
export const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Get safe animation props based on user preference
 * @param {Object} animationProps - Framer Motion animation props
 * @returns {Object} - Empty object if reduced motion, original props otherwise
 */
export const getSafeAnimationProps = (animationProps) => {
  return prefersReducedMotion() ? {} : animationProps;
};

/**
 * Check color contrast ratio (WCAG AA requires 4.5:1 for normal text)
 * @param {string} color1 - Hex color
 * @param {string} color2 - Hex color
 * @returns {number} Contrast ratio
 */
export const getContrastRatio = (color1, color2) => {
  const getLuminance = (hex) => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;

    const [rs, gs, bs] = [r, g, b].map(c => {
      const sRGB = c / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Validate tap target size (WCAG recommends min 44x44px)
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} Whether element meets minimum size
 */
export const isValidTapTarget = (element) => {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  return rect.width >= 44 && rect.height >= 44;
};

/**
 * Create announcer element for screen readers (call once in app root)
 */
export const createAnnouncer = () => {
  if (typeof document === 'undefined') return;

  if (!document.getElementById('a11y-announcer')) {
    const announcer = document.createElement('div');
    announcer.id = 'a11y-announcer';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only'; // Visually hidden but accessible to screen readers

    Object.assign(announcer.style, {
      position: 'absolute',
      left: '-10000px',
      width: '1px',
      height: '1px',
      overflow: 'hidden'
    });

    document.body.appendChild(announcer);
  }
};

/**
 * Keyboard navigation helper
 */
export const handleArrowNavigation = (event, items, currentIndex, onSelect) => {
  const { key } = event;

  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(key)) {
    return;
  }

  event.preventDefault();

  let newIndex = currentIndex;

  switch (key) {
    case 'ArrowUp':
    case 'ArrowLeft':
      newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      break;
    case 'ArrowDown':
    case 'ArrowRight':
      newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      break;
    case 'Enter':
    case ' ':
      if (onSelect && items[currentIndex]) {
        onSelect(items[currentIndex]);
      }
      return;
  }

  return newIndex;
};

/**
 * Generate unique ID for form field associations
 */
let idCounter = 0;
export const generateId = (prefix = 'id') => {
  return `${prefix}-${++idCounter}`;
};

export default {
  announce,
  focusElement,
  trapFocus,
  prefersReducedMotion,
  getSafeAnimationProps,
  getContrastRatio,
  isValidTapTarget,
  createAnnouncer,
  handleArrowNavigation,
  generateId
};
