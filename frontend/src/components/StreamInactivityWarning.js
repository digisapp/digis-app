import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';

const StreamInactivityWarning = ({ streamId, onKeepAlive }) => {
  const [warning, setWarning] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !streamId) return;

    // Listen for inactivity warnings
    const handleInactivityWarning = (data) => {
      if (data.streamId === streamId) {
        setWarning(data);
        setCountdown(data.minutesRemaining * 60); // Convert to seconds
      }
    };

    // Listen for stream auto-end
    const handleStreamAutoEnded = (data) => {
      if (data.streamId === streamId) {
        setWarning({
          ...data,
          ended: true
        });
      }
    };

    socket.on('stream_inactivity_warning', handleInactivityWarning);
    socket.on('stream_auto_ended', handleStreamAutoEnded);

    return () => {
      socket.off('stream_inactivity_warning', handleInactivityWarning);
      socket.off('stream_auto_ended', handleStreamAutoEnded);
    };
  }, [socket, streamId]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0 && !warning?.ended) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, warning?.ended]);

  const handleKeepAlive = async () => {
    try {
      // Send heartbeat to keep stream alive
      await api.post(`/api/streaming/heartbeat/${streamId}`);
      
      // Log activity
      await api.post(`/api/streaming/activity/${streamId}`, {
        activityType: 'creator_action',
        details: { action: 'keep_alive' }
      });

      // Clear warning
      setWarning(null);
      setCountdown(0);
      
      if (onKeepAlive) {
        onKeepAlive();
      }
    } catch (error) {
      console.error('Error sending keep-alive:', error);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDismiss = () => {
    if (!warning?.ended) {
      setWarning(null);
      setCountdown(0);
    }
  };

  return (
    <AnimatePresence>
      {warning && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-lg w-full px-4"
        >
          <div className={`
            ${warning.ended ? 'bg-red-600' : 'bg-yellow-500'} 
            text-white rounded-lg shadow-2xl p-4
          `}>
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="h-6 w-6 flex-shrink-0 mt-0.5" />
              
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">
                  {warning.ended ? 'Stream Ended' : 'Stream Inactivity Warning'}
                </h3>
                
                <p className="text-sm mb-3">
                  {warning.ended 
                    ? warning.message 
                    : `Your stream will automatically end in ${formatTime(countdown)} due to inactivity.`}
                </p>

                {!warning.ended && (
                  <>
                    {warning.viewerCount === 0 && (
                      <p className="text-xs mb-3 opacity-90">
                        No viewers are currently watching your stream.
                      </p>
                    )}

                    <div className="flex space-x-2">
                      <button
                        onClick={handleKeepAlive}
                        className="px-4 py-2 bg-white text-yellow-600 rounded-md font-semibold hover:bg-gray-100 transition-colors text-sm"
                      >
                        I'm Still Here!
                      </button>
                      
                      <button
                        onClick={handleDismiss}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-md font-semibold hover:bg-yellow-700 transition-colors text-sm"
                      >
                        Dismiss
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 h-1 bg-yellow-600 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-white"
                        initial={{ width: '100%' }}
                        animate={{ width: '0%' }}
                        transition={{ 
                          duration: warning.minutesRemaining * 60,
                          ease: 'linear'
                        }}
                      />
                    </div>
                  </>
                )}

                {warning.ended && (
                  <button
                    onClick={() => window.location.href = '/dashboard'}
                    className="px-4 py-2 bg-white text-red-600 rounded-md font-semibold hover:bg-gray-100 transition-colors text-sm"
                  >
                    Return to Dashboard
                  </button>
                )}
              </div>

              {!warning.ended && (
                <button
                  onClick={handleDismiss}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StreamInactivityWarning;