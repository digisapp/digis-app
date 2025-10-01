import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';

const PictureInPicture = ({ 
  children, 
  isEnabled = false, 
  onClose, 
  defaultPosition = { x: 20, y: 20 },
  className = '' 
}) => {
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [position, setPosition] = useState(defaultPosition);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const pipRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isEnabled && !isPiPActive) {
      setIsPiPActive(true);
    } else if (!isEnabled && isPiPActive) {
      setIsPiPActive(false);
    }
  }, [isEnabled]);

  // Handle dragging
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStartPos.current.x;
    const newY = e.clientY - dragStartPos.current.y;

    // Keep within viewport bounds
    const maxX = window.innerWidth - (pipRef.current?.offsetWidth || 320);
    const maxY = window.innerHeight - (pipRef.current?.offsetHeight || 180);

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleClose = () => {
    setIsPiPActive(false);
    if (onClose) {
      onClose();
    }
  };

  if (!isPiPActive) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={pipRef}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: isMinimized ? 0.5 : 1, 
          opacity: 1,
          x: position.x,
          y: position.y
        }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={`fixed z-50 ${className}`}
        style={{
          width: isMinimized ? '160px' : '320px',
          height: isMinimized ? '90px' : '180px',
        }}
      >
        {/* PiP Container */}
        <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-700">
          {/* Drag Handle */}
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/80 to-transparent cursor-move z-10"
          />

          {/* Controls */}
          <div className="absolute top-2 right-2 flex items-center gap-2 z-20">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleMinimize}
              className="p-1.5 bg-black/60 backdrop-blur-sm rounded-lg hover:bg-black/80 transition-colors"
            >
              {isMinimized ? (
                <ArrowsPointingOutIcon className="w-4 h-4 text-white" />
              ) : (
                <ArrowsPointingInIcon className="w-4 h-4 text-white" />
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleClose}
              className="p-1.5 bg-red-600/80 backdrop-blur-sm rounded-lg hover:bg-red-600 transition-colors"
            >
              <XMarkIcon className="w-4 h-4 text-white" />
            </motion.button>
          </div>

          {/* Video Content */}
          <div className="w-full h-full">
            {children}
          </div>

          {/* Minimized Label */}
          {isMinimized && (
            <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded">
              <p className="text-xs text-white font-medium">Live Stream</p>
            </div>
          )}
        </div>

        {/* Resize Handle */}
        {!isMinimized && (
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize">
            <svg className="w-full h-full text-gray-400" viewBox="0 0 8 8">
              <path d="M0,8 L8,0 M3,8 L8,3 M6,8 L8,6" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default PictureInPicture;