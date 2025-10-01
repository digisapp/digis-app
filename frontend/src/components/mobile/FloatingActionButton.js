import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobileUI } from './MobileUIProvider';
import {
  PlusIcon,
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';

const FloatingActionButton = ({ onVideoCall, onVoiceCall, onChat, onGoLive }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { triggerHaptic, isScrollingUp } = useMobileUI();
  const [showLabel, setShowLabel] = useState(false);

  useEffect(() => {
    // Show label hint after 3 seconds
    const timer = setTimeout(() => {
      setShowLabel(true);
      setTimeout(() => setShowLabel(false), 3000);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    triggerHaptic('medium');
  };

  const handleAction = (action, callback) => {
    triggerHaptic('success');
    setIsExpanded(false);
    callback?.();
  };

  const fabVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: { type: 'spring', damping: 15 }
    },
    expanded: {
      scale: 1.1,
      transition: { type: 'spring', damping: 12 }
    }
  };

  const menuItemVariants = {
    hidden: { scale: 0, opacity: 0, y: 20 },
    visible: (i) => ({
      scale: 1,
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        type: 'spring',
        damping: 18
      }
    }),
    exit: {
      scale: 0,
      opacity: 0,
      y: 20,
      transition: { duration: 0.2 }
    }
  };

  const actions = [
    { 
      icon: VideoCameraIcon, 
      label: 'Video Call', 
      color: 'bg-blue-500',
      onClick: () => handleAction('video', onVideoCall)
    },
    { 
      icon: PhoneIcon, 
      label: 'Voice Call', 
      color: 'bg-green-500',
      onClick: () => handleAction('voice', onVoiceCall)
    },
    { 
      icon: ChatBubbleLeftRightIcon, 
      label: 'Quick Chat', 
      color: 'bg-purple-500',
      onClick: () => handleAction('chat', onChat)
    },
    { 
      icon: SparklesIcon, 
      label: 'Go Live', 
      color: 'bg-red-500',
      onClick: () => handleAction('live', onGoLive)
    }
  ];

  return (
    <motion.div 
      className="fab-container"
      initial="hidden"
      animate={isScrollingUp ? "visible" : "hidden"}
      variants={{
        hidden: { y: 100, opacity: 0 },
        visible: { y: 0, opacity: 1 }
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Action menu */}
      <AnimatePresence>
        {isExpanded && (
          <div className="absolute bottom-16 right-0 space-y-3">
            {actions.map((action, index) => (
              <motion.div
                key={action.label}
                custom={index}
                variants={menuItemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex items-center justify-end gap-3"
              >
                <motion.span
                  className="bg-black/80 text-white px-3 py-1 rounded-full text-sm whitespace-nowrap"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 + 0.1 }}
                >
                  {action.label}
                </motion.span>
                <motion.button
                  onClick={action.onClick}
                  className={`w-12 h-12 rounded-full ${action.color} shadow-lg flex items-center justify-center text-white`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <action.icon className="w-6 h-6" />
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        className={`fab ${isExpanded ? 'expanded' : ''}`}
        onClick={toggleExpanded}
        variants={fabVariants}
        initial="hidden"
        animate={isExpanded ? "expanded" : "visible"}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          animate={{ rotate: isExpanded ? 45 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {isExpanded ? (
            <XMarkIcon className="w-6 h-6 text-white" />
          ) : (
            <PlusIcon className="w-6 h-6 text-white" />
          )}
        </motion.div>
        
        {/* Label hint */}
        <AnimatePresence>
          {showLabel && !isExpanded && (
            <motion.span
              className="absolute right-full mr-3 bg-black/80 text-white px-3 py-1 rounded-full text-sm whitespace-nowrap"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              Quick Actions
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Backdrop */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="fixed inset-0 bg-black/20 -z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleExpanded}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default FloatingActionButton;