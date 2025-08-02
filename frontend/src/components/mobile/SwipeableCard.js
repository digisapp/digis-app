import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import { useMobileUI } from './MobileUIProvider';
import { 
  HeartIcon, 
  ChatBubbleLeftIcon,
  ShareIcon,
  BookmarkIcon,
  TrashIcon,
  FlagIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

const SwipeableCard = ({ 
  children, 
  onSwipeLeft, 
  onSwipeRight, 
  onLike,
  onComment,
  onShare,
  onBookmark,
  onDelete,
  onReport,
  enableActions = true,
  className = '' 
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const { triggerHaptic } = useMobileUI();
  
  const constraintsRef = useRef(null);
  const x = useMotionValue(0);
  const controls = useAnimation();
  
  // Transform values for visual feedback
  const background = useTransform(
    x,
    [-200, -100, 0, 100, 200],
    ['#ef4444', '#fbbf24', '#ffffff', '#10b981', '#22c55e']
  );
  
  const rotate = useTransform(x, [-200, 200], [-20, 20]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  
  const handleDragEnd = async (event, info) => {
    const threshold = 100;
    const velocity = info.velocity.x;
    const offset = info.offset.x;
    
    if (Math.abs(offset) > threshold || Math.abs(velocity) > 500) {
      if (offset > 0) {
        // Swipe right
        triggerHaptic('success');
        await controls.start({ x: 300, opacity: 0 });
        onSwipeRight?.();
      } else {
        // Swipe left
        triggerHaptic('warning');
        await controls.start({ x: -300, opacity: 0 });
        onSwipeLeft?.();
      }
    } else {
      // Snap back
      controls.start({ x: 0, rotate: 0 });
    }
  };
  
  const handleLike = () => {
    setIsLiked(!isLiked);
    triggerHaptic('light');
    onLike?.(!isLiked);
  };
  
  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    triggerHaptic('light');
    onBookmark?.(!isBookmarked);
  };
  
  const handleAction = (action, callback) => {
    triggerHaptic('light');
    callback?.();
    setShowActions(false);
  };
  
  const toggleActions = () => {
    setShowActions(!showActions);
    triggerHaptic('light');
  };

  return (
    <div ref={constraintsRef} className="relative">
      <motion.div
        drag="x"
        dragConstraints={constraintsRef}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x, rotate, opacity }}
        className={`swipeable-card ${showActions ? 'show-actions' : ''} ${className}`}
        whileTap={{ scale: 0.98 }}
      >
        {/* Background color indicator */}
        <motion.div
          className="absolute inset-0 rounded-16 -z-10"
          style={{ backgroundColor: background, opacity: 0.2 }}
        />
        
        {/* Card content */}
        <div className="relative">
          {children}
        </div>
        
        {/* Quick actions bar */}
        {enableActions && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-4">
              <motion.button
                onClick={handleLike}
                whileTap={{ scale: 0.8 }}
                className="flex items-center gap-1 text-gray-600"
              >
                <motion.div
                  animate={{ scale: isLiked ? [1, 1.2, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {isLiked ? (
                    <HeartSolidIcon className="w-6 h-6 text-red-500" />
                  ) : (
                    <HeartIcon className="w-6 h-6" />
                  )}
                </motion.div>
                <span className="text-sm">Like</span>
              </motion.button>
              
              <button
                onClick={() => handleAction('comment', onComment)}
                className="flex items-center gap-1 text-gray-600"
              >
                <ChatBubbleLeftIcon className="w-6 h-6" />
                <span className="text-sm">Comment</span>
              </button>
              
              <button
                onClick={() => handleAction('share', onShare)}
                className="flex items-center gap-1 text-gray-600"
              >
                <ShareIcon className="w-6 h-6" />
                <span className="text-sm">Share</span>
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <motion.button
                onClick={handleBookmark}
                whileTap={{ scale: 0.8 }}
              >
                <BookmarkIcon 
                  className={`w-6 h-6 ${isBookmarked ? 'fill-blue-500 text-blue-500' : 'text-gray-600'}`} 
                />
              </motion.button>
              
              <button
                onClick={toggleActions}
                className="p-1 text-gray-400"
              >
                •••
              </button>
            </div>
          </div>
        )}
        
        {/* Swipe actions */}
        <motion.div 
          className="swipe-actions"
          initial={{ opacity: 0 }}
          animate={{ opacity: showActions ? 1 : 0 }}
        >
          <button
            onClick={() => handleAction('delete', onDelete)}
            className="p-3 bg-red-500 text-white rounded-lg"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleAction('report', onReport)}
            className="p-3 bg-orange-500 text-white rounded-lg ml-2"
          >
            <FlagIcon className="w-5 h-5" />
          </button>
        </motion.div>
      </motion.div>
      
      {/* Swipe indicators */}
      <motion.div
        className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold"
        style={{ opacity: useTransform(x, [50, 100], [0, 1]) }}
      >
        LIKE
      </motion.div>
      
      <motion.div
        className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold"
        style={{ opacity: useTransform(x, [-100, -50], [1, 0]) }}
      >
        PASS
      </motion.div>
    </div>
  );
};

export default SwipeableCard;