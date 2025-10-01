import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMediaQuery } from '../../hooks/useMediaQuery';

/**
 * Page transition components for smooth navigation
 * Features: multiple transition types, mobile optimization, accessibility
 */

// Transition variants - simplified for better UX
const transitionVariants = {
  slide: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  scale: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  slideUp: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  flipX: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  stackedCards: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  }
};

// Main page transition wrapper
export const PageTransition = ({
  children,
  pageKey,
  variant = 'fade',
  duration = 0.15,
  className = '',
  ...props
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Use simpler transitions on mobile or when reduced motion is preferred
  const effectiveVariant = 'fade';
  const effectiveDuration = prefersReducedMotion ? 0 : duration;

  const transition = {
    type: "tween",
    ease: "easeInOut",
    duration: effectiveDuration
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        className={`w-full h-full ${className}`}
        variants={transitionVariants[effectiveVariant]}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transition}
        style={{ 
          transformStyle: "preserve-3d",
          backfaceVisibility: "hidden"
        }}
        {...props}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// Route transition with loading state
export const RouteTransition = ({
  children,
  isLoading = false,
  loadingComponent,
  pageKey,
  variant = 'slide',
  ...props
}) => {
  if (isLoading && loadingComponent) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {loadingComponent}
      </motion.div>
    );
  }

  return (
    <PageTransition pageKey={pageKey} variant={variant} {...props}>
      {children}
    </PageTransition>
  );
};

// Modal transition
export const ModalTransition = ({
  isOpen,
  children,
  onClose,
  variant = 'scale',
  overlay = true,
  closeOnOverlayClick = true,
  ...props
}) => {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  const modalVariants = prefersReducedMotion 
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : transitionVariants[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
        >
          {overlay && (
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeOnOverlayClick ? onClose : undefined}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
          
          <motion.div
            className="relative z-10 max-w-lg w-full max-h-full overflow-auto"
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30,
              duration: prefersReducedMotion ? 0.1 : 0.4
            }}
            {...props}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Staggered list animation
export const StaggeredList = ({ children, stagger = 0.1, className = '', ...props }) => {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : stagger,
        delayChildren: prefersReducedMotion ? 0 : 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 25,
        duration: prefersReducedMotion ? 0.1 : 0.4
      }
    }
  };

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      {...props}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

// Slide transition for tab content
export const TabTransition = ({ activeTab, children, direction = 'horizontal' }) => {
  const slideVariants = direction === 'horizontal' 
    ? transitionVariants.slide 
    : transitionVariants.slideUp;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        variants={slideVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// Accordion transition
export const AccordionTransition = ({ isOpen, children, ...props }) => {
  return (
    <motion.div
      initial={false}
      animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      style={{ overflow: "hidden" }}
      {...props}
    >
      <div className="pb-4">
        {children}
      </div>
    </motion.div>
  );
};

const PageTransitionsExport = {
  PageTransition,
  RouteTransition,
  ModalTransition,
  StaggeredList,
  TabTransition,
  AccordionTransition
};

export default PageTransitionsExport;