import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  VideoCameraIcon,
  PhoneIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { VideoCameraIcon as VideoCameraIconSolid, PhoneIcon as PhoneIconSolid } from '@heroicons/react/24/solid';

const CallWaitingModal = ({
  isOpen,
  onClose,
  creator,
  callType = 'video', // 'video' or 'voice'
  onTimeout,
  onCreatorDeclined,
  maxWaitTime = 30000 // 30 seconds default
}) => {
  const [waitingTime, setWaitingTime] = useState(0);
  const [status, setStatus] = useState('ringing'); // 'ringing', 'no-answer', 'declined', 'cancelled'
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Start timer
      const startTime = Date.now();
      intervalRef.current = setInterval(() => {
        setWaitingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Set timeout for no answer
      timeoutRef.current = setTimeout(() => {
        setStatus('no-answer');
        if (onTimeout) {
          onTimeout();
        }
      }, maxWaitTime);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOpen, maxWaitTime, onTimeout]);

  const handleClose = () => {
    setStatus('cancelled');
    setWaitingTime(0);
    if (onClose) {
      onClose();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const CallIcon = callType === 'video' ? VideoCameraIcon : PhoneIcon;
  const CallIconSolid = callType === 'video' ? VideoCameraIconSolid : PhoneIconSolid;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10001]"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 30 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed z-[10002]"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '420px',
              maxWidth: '90vw'
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="call-waiting-title"
          >
            <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/30 overflow-hidden">
              {/* Gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500"></div>

              {/* Animated background orbs */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>

              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-xl transition-all duration-200 z-10 group"
                aria-label="Cancel call"
              >
                <XMarkIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              </button>

              {/* Content */}
              <div className="p-8 pb-10 relative">
                {status === 'ringing' ? (
                  // Ringing state
                  <>
                    {/* Animated calling icon */}
                    <motion.div
                      className="flex justify-center mb-6"
                      animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <div className="relative">
                        <CallIconSolid className="w-20 h-20 text-violet-600 dark:text-violet-400" />
                        {/* Ripple effect */}
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-violet-500"
                          animate={{
                            scale: [1, 2, 2],
                            opacity: [0.5, 0, 0]
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeOut"
                          }}
                        />
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-violet-500"
                          animate={{
                            scale: [1, 2, 2],
                            opacity: [0.5, 0, 0]
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeOut",
                            delay: 1
                          }}
                        />
                      </div>
                    </motion.div>

                    {/* Title */}
                    <h2 id="call-waiting-title" className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
                      Calling {creator.displayName || creator.display_name || creator.username}...
                    </h2>

                    {/* Creator info */}
                    <div className="flex items-center justify-center gap-3 mb-6">
                      <img
                        src={creator.avatar || creator.profile_pic_url || `https://ui-avatars.com/api/?name=${creator.username}&background=8B5CF6&color=fff`}
                        alt={creator.username}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-violet-500/30"
                        width={48}
                        height={48}
                      />
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          @{creator.username}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {callType === 'video' ? 'Video Call' : 'Voice Call'}
                        </p>
                      </div>
                    </div>

                    {/* Timer */}
                    <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-6 border border-violet-200/50 dark:border-violet-700/30">
                      <div className="flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300">
                        <ClockIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        <span className="text-lg font-semibold">{formatTime(waitingTime)}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">/ {formatTime(maxWaitTime / 1000)}</span>
                      </div>
                      <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
                        Waiting for creator to answer...
                      </p>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-6">
                      <motion.div
                        className="bg-gradient-to-r from-violet-600 to-purple-600 h-1.5 rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: `${(waitingTime / (maxWaitTime / 1000)) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>

                    {/* Cancel button */}
                    <button
                      onClick={handleClose}
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all font-medium"
                    >
                      Cancel Call
                    </button>
                  </>
                ) : status === 'no-answer' ? (
                  // No answer state
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 15 }}
                      className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
                    >
                      <ExclamationTriangleIcon className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      No Answer
                    </h2>

                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      {creator.displayName || creator.username} didn't respond after {formatTime(maxWaitTime / 1000)}.
                    </p>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 mb-6 border border-yellow-200 dark:border-yellow-700/30">
                      <p className="text-sm text-yellow-800 dark:text-yellow-300">
                        💡 <strong>Try these options:</strong>
                      </p>
                      <ul className="text-xs text-yellow-700 dark:text-yellow-400 mt-2 space-y-1 text-left pl-4">
                        <li>• Send them a message instead</li>
                        <li>• Check their availability status</li>
                        <li>• Try again in a few minutes</li>
                        <li>• Schedule a call for later</li>
                      </ul>
                    </div>

                    <button
                      onClick={handleClose}
                      className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all font-semibold shadow-md"
                    >
                      Okay
                    </button>
                  </div>
                ) : status === 'declined' ? (
                  // Declined state
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 15 }}
                      className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
                    >
                      <XMarkIcon className="w-10 h-10 text-red-600 dark:text-red-400 stroke-[3]" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Call Declined
                    </h2>

                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      {creator.displayName || creator.username} is currently unavailable.
                    </p>

                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6 border border-blue-200 dark:border-blue-700/30">
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        💬 <strong>Send a message instead?</strong>
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                        Let them know you'd like to connect
                      </p>
                    </div>

                    <button
                      onClick={handleClose}
                      className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all font-semibold shadow-md"
                    >
                      Okay
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CallWaitingModal;
