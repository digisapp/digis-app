import React, { useRef, useEffect } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { useMobileUI } from './MobileUIProvider';

const MobileBottomSheet = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  snapPoints = [0.9, 0.5, 0],
  defaultSnap = 0.5,
  showHandle = true,
  closeOnOverlayClick = true,
  className = ''
}) => {
  const { triggerHaptic, keyboardHeight } = useMobileUI();
  const controls = useAnimation();
  const y = useMotionValue(0);
  const sheetRef = useRef(null);
  
  const height = typeof window !== 'undefined' ? window.innerHeight : 0;
  const dragThreshold = 50;
  
  // Transform y to opacity for overlay
  const overlayOpacity = useTransform(
    y,
    [0, height * 0.5],
    [0.5, 0]
  );
  
  useEffect(() => {
    if (isOpen) {
      controls.start({ y: height * (1 - defaultSnap) });
      document.body.style.overflow = 'hidden';
    } else {
      controls.start({ y: height });
      document.body.style.overflow = '';
    }
  }, [isOpen, controls, height, defaultSnap]);
  
  // Adjust for keyboard
  useEffect(() => {
    if (keyboardHeight > 0 && isOpen) {
      controls.start({ 
        y: height * (1 - defaultSnap) - keyboardHeight,
        transition: { duration: 0.3 }
      });
    }
  }, [keyboardHeight, isOpen, controls, height, defaultSnap]);
  
  const handleDragEnd = (event, info) => {
    const velocity = info.velocity.y;
    const currentY = y.get();
    
    // Find closest snap point
    const snapPositions = snapPoints.map(point => height * (1 - point));
    let closestSnap = snapPositions[0];
    let minDistance = Math.abs(currentY - snapPositions[0]);
    
    snapPositions.forEach(snap => {
      const distance = Math.abs(currentY - snap);
      if (distance < minDistance) {
        minDistance = distance;
        closestSnap = snap;
      }
    });
    
    // Apply velocity bias
    if (velocity > 500) {
      // Fast downward swipe - go to next lower snap or close
      const currentIndex = snapPositions.indexOf(closestSnap);
      if (currentIndex < snapPositions.length - 1) {
        closestSnap = snapPositions[currentIndex + 1];
      }
    } else if (velocity < -500) {
      // Fast upward swipe - go to next higher snap
      const currentIndex = snapPositions.indexOf(closestSnap);
      if (currentIndex > 0) {
        closestSnap = snapPositions[currentIndex - 1];
      }
    }
    
    // Close if dragged to bottom
    if (closestSnap === height) {
      onClose();
      triggerHaptic('light');
    } else {
      controls.start({ 
        y: closestSnap,
        transition: { type: 'spring', damping: 30, stiffness: 300 }
      });
      triggerHaptic('light');
    }
  };
  
  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose();
      triggerHaptic('light');
    }
  };

  return (
    <>
      {/* Overlay */}
      <motion.div
        className="fixed inset-0 bg-black z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: isOpen ? 0.5 : 0 }}
        exit={{ opacity: 0 }}
        style={{ opacity: overlayOpacity, pointerEvents: isOpen ? 'auto' : 'none' }}
        onClick={handleOverlayClick}
      />
      
      {/* Bottom Sheet */}
      <motion.div
        ref={sheetRef}
        className={`mobile-modal ${className}`}
        initial={{ y: height }}
        animate={controls}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ y }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Handle */}
        {showHandle && (
          <div className="mobile-modal-handle" />
        )}
        
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        
        {/* Content */}
        <div className="mobile-modal-content">
          {children}
        </div>
        
        {/* Safe area padding */}
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
      </motion.div>
    </>
  );
};

export default MobileBottomSheet;