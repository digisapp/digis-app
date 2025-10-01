// src/components/SimpleNotificationBell.js
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellIcon } from '@heroicons/react/24/outline';
import { BellIcon as BellIconSolid } from '@heroicons/react/24/solid';
import SimpleNotificationBox from './SimpleNotificationBox';

const SimpleNotificationBell = () => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount] = useState(0); // Static for now to avoid loops
  const bellRef = useRef(null);

  const handleToggle = () => {
    setShowNotifications(!showNotifications);
  };

  const handleClose = () => {
    setShowNotifications(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        ref={bellRef}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleToggle}
        className={`
          relative p-2 sm:p-3 rounded-xl transition-all duration-200 
          min-h-[40px] min-w-[40px] sm:min-h-[48px] sm:min-w-[48px] 
          flex items-center justify-center
          ${showNotifications 
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
          }
        `}
      >
        {showNotifications ? (
          <BellIconSolid className="w-5 sm:w-6 h-5 sm:h-6 text-white" />
        ) : (
          <BellIcon className="w-5 sm:w-6 h-5 sm:h-6 text-purple-600 dark:text-purple-400" />
        )}
        
        {/* Unread count badge */}
        <AnimatePresence>
          {unreadCount > 0 && !showNotifications && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                background: '#ef4444',
                color: 'white',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 6px',
                minWidth: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid white'
              }}
            >
              {unreadCount}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Notification Box */}
      <SimpleNotificationBox 
        isOpen={showNotifications}
        onClose={handleClose}
        anchorElement={bellRef.current}
      />
    </div>
  );
};

export default SimpleNotificationBell;