import React, { useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useTheme } from '../../hooks/useTheme';
import { XMarkIcon } from '@heroicons/react/24/outline';

const Modal = memo(({ 
  isOpen, 
  onClose, 
  children, 
  title,
  size = 'md',
  variant = 'default',
  closable = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  animate = true,
  glass = false,
  className = '',
  id = 'modal',
  loading = false
}) => {
  const { animations = true } = useTheme() || {};
  const modalRef = useRef(null);
  const firstFocusableRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Validate props
  const sizeClasses = {
    xs: 'max-w-xs',
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    full: 'max-w-full mx-4'
  };

  const variantClassesMap = {
    default: [
      'bg-white',
      'border-neutral-200',
      'shadow-2xl',
      'dark:bg-neutral-900',
      'dark:border-neutral-800'
    ],
    premium: [
      'bg-gradient-to-br from-primary-500 to-secondary-600',
      'text-white',
      'shadow-2xl',
      'border-transparent'
    ]
  };

  // Validate size and variant
  if (!sizeClasses[size]) {
    console.warn(`Invalid modal size: ${size}. Using md.`);
    size = 'md';
  }

  if (!variantClassesMap[variant]) {
    console.warn(`Invalid modal variant: ${variant}. Using default.`);
    variant = 'default';
  }

  if (!onClose || typeof onClose !== 'function') {
    console.warn('onClose must be a function');
    onClose = () => {};
  }

  // Apply glass effect if needed
  const variantClasses = { ...variantClassesMap };
  if (glass) {
    variantClasses.default = [
      'bg-white/10',
      'backdrop-blur-xl',
      'border-white/20',
      'shadow-2xl'
    ];
  }

  // Focus trapping
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      
      firstFocusableRef.current = firstFocusable;
      
      // Focus on close button or first focusable element
      if (closable && closeButtonRef.current) {
        closeButtonRef.current.focus();
      } else if (firstFocusable) {
        firstFocusable.focus();
      }

      const handleTab = (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          } else if (!e.shiftKey && document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      };

      modalRef.current.addEventListener('keydown', handleTab);
      return () => modalRef.current?.removeEventListener('keydown', handleTab);
    }
  }, [isOpen, closable]);

  // Handle Escape key
  useEffect(() => {
    if (closeOnEscape) {
      const handleEscape = (e) => {
        if (e.key === 'Escape' && isOpen) {
          onClose();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [closeOnEscape, isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Build base classes
  const baseClasses = [
    'relative w-full',
    sizeClasses[size],
    'max-h-[90vh] overflow-hidden rounded-2xl border',
    variantClasses[variant].join(' '),
    className
  ].filter(Boolean).join(' ');

  // Animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.3, ease: "easeOut" }
    },
    exit: { 
      opacity: 0,
      transition: { duration: 0.2, ease: "easeIn" }
    }
  };

  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8, 
      y: 20,
      rotateX: -15
    },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      rotateX: 0,
      transition: { 
        duration: 0.4, 
        ease: [0.4, 0, 0.2, 1],
        delay: 0.1
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9, 
      y: -10,
      transition: { 
        duration: 0.2, 
        ease: "easeIn" 
      }
    }
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.3, 
        delay: 0.2,
        ease: "easeOut"
      }
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? `${id}-title` : undefined}
          aria-describedby={`${id}-content`}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            variants={animate && animations ? backdropVariants : {}}
            initial={animate && animations ? "hidden" : false}
            animate={animate && animations ? "visible" : false}
            exit={animate && animations ? "exit" : false}
            onClick={closeOnOverlayClick ? onClose : undefined}
            onKeyDown={(e) => closeOnOverlayClick && e.key === 'Enter' && onClose()}
            tabIndex={closeOnOverlayClick ? 0 : -1}
            role={closeOnOverlayClick ? "button" : undefined}
            aria-label={closeOnOverlayClick ? "Close modal by clicking outside" : undefined}
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            className={baseClasses}
            variants={animate && animations ? modalVariants : {}}
            initial={animate && animations ? "hidden" : false}
            animate={animate && animations ? "visible" : false}
            exit={animate && animations ? "exit" : false}
            style={animate && animations ? { perspective: 1000 } : {}}
          >
            {/* Header */}
            {(title || closable) && (
              <motion.div 
                className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800"
                variants={animate && animations ? contentVariants : {}}
                initial={animate && animations ? "hidden" : false}
                animate={animate && animations ? "visible" : false}
              >
                {title && (
                  <h2 
                    id={`${id}-title`}
                    className="text-xl font-semibold text-neutral-900 dark:text-white"
                  >
                    {title}
                  </h2>
                )}
                
                {closable && (
                  <motion.button
                    ref={closeButtonRef}
                    onClick={onClose}
                    className="p-2 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    aria-label="Close modal"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </motion.button>
                )}
              </motion.div>
            )}

            {/* Content */}
            <motion.div 
              id={`${id}-content`}
              className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]"
              variants={animate && animations ? contentVariants : {}}
              initial={animate && animations ? "hidden" : false}
              animate={animate && animations ? "visible" : false}
            >
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <svg 
                    className="animate-spin h-8 w-8 text-purple-600" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                    />
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="sr-only">Loading...</span>
                </div>
              ) : (
                children
              )}
            </motion.div>

            {/* Decorative elements for premium variant */}
            {variant === 'premium' && (
              <>
                <div className="absolute top-4 right-4 w-2 h-2 bg-white/30 rounded-full animate-pulse" />
                <div className="absolute top-8 right-8 w-1 h-1 bg-white/20 rounded-full animate-pulse delay-300" />
                <div className="absolute bottom-4 left-4 w-1.5 h-1.5 bg-white/25 rounded-full animate-pulse delay-700" />
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
});

Modal.displayName = 'Modal';

export default Modal;