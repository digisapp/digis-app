// src/components/SimpleNotificationBox.js
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BellIcon,
  XMarkIcon,
  BellSlashIcon
} from '@heroicons/react/24/outline';
import { BellIcon as BellIconSolid } from '@heroicons/react/24/solid';
import { supabase } from '../utils/supabase-auth';

const SimpleNotificationBox = ({ isOpen, onClose, anchorElement }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const boxRef = useRef(null);
  const hasLoadedRef = useRef(false);

  // Calculate position based on anchor element
  useEffect(() => {
    if (anchorElement && isOpen) {
      const rect = anchorElement.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;
      const boxWidth = isMobile ? window.innerWidth - 32 : 420;
      const viewportWidth = window.innerWidth;
      
      let right = isMobile ? 16 : viewportWidth - rect.right;
      let top = rect.bottom + 12;
      
      if (!isMobile && right + boxWidth > viewportWidth) {
        right = viewportWidth - boxWidth - 20;
      }
      
      setPosition({ top, right });
    }
  }, [anchorElement, isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (boxRef.current && 
          !boxRef.current.contains(event.target) &&
          !anchorElement?.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, anchorElement]);

  // Load notifications only once when opened
  useEffect(() => {
    const loadNotifications = async () => {
      if (!isOpen || hasLoadedRef.current || loading) return;
      
      setLoading(true);
      hasLoadedRef.current = true;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.log('No auth session');
          setLoading(false);
          return;
        }
        
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/notifications?limit=20`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [isOpen]);

  // Reset loaded flag when box closes
  useEffect(() => {
    if (!isOpen) {
      hasLoadedRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={boxRef}
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 400 }}
        className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          top: `${position.top}px`,
          right: `${position.right}px`,
          width: window.innerWidth < 640 ? `calc(100vw - 32px)` : '420px',
          maxHeight: window.innerWidth < 640 ? '70vh' : '80vh',
          zIndex: 1000
        }}
      >
        {/* Header */}
        <div className="border-b border-gray-100 dark:border-gray-700 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BellIconSolid className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Notifications
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {notifications.length} notifications
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer flex items-center justify-center"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto p-2">
          {loading ? (
            <div className="py-10 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm">Loading...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center">
              <BellSlashIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h4 className="text-gray-900 dark:text-white mb-2 text-sm font-medium">
                No notifications
              </h4>
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                You're all caught up!
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl p-3 mb-2 cursor-pointer transition-colors"
                >
                  <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
                    {notification.message || 'New notification'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {notification.created_at ? new Date(notification.created_at).toLocaleDateString() : 'Recently'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SimpleNotificationBox;