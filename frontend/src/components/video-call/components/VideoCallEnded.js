/**
 * Call ended screen component
 * @module components/VideoCallEnded
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  ClockIcon,
  CurrencyDollarIcon,
  VideoCameraIcon,
  ArrowDownTrayIcon,
  HomeIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

/**
 * Display call summary after call ends
 */
const VideoCallEnded = ({
  duration = 0,
  cost = 0,
  isCreator = false,
  recordingUrl = null,
  onClose,
  onDownloadRecording,
  userName = 'User'
}) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  /**
   * Format duration for display
   */
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
    }
    return `${secs} second${secs !== 1 ? 's' : ''}`;
  };

  /**
   * Handle rating submission
   */
  const handleSubmitRating = () => {
    if (rating > 0) {
      // Submit rating and feedback
      console.log('Rating:', rating, 'Feedback:', feedback);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-gradient-to-br from-purple-900 via-gray-900 to-black flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-800/90 backdrop-blur-xl rounded-2xl max-w-md w-full p-8 shadow-2xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <VideoCameraIcon className="w-10 h-10 text-white" />
          </motion.div>
          
          <h2 className="text-2xl font-bold text-white mb-2">
            Call Ended
          </h2>
          <p className="text-gray-400">
            {isCreator ? 'Thanks for hosting!' : 'Thanks for joining!'}
          </p>
        </div>

        {/* Call stats */}
        <div className="space-y-4 mb-8">
          {/* Duration */}
          <div className="bg-gray-700/50 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <ClockIcon className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Duration</p>
                <p className="text-white font-semibold">
                  {formatDuration(duration)}
                </p>
              </div>
            </div>
          </div>

          {/* Cost/Earnings */}
          {cost > 0 && (
            <div className="bg-gray-700/50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <CurrencyDollarIcon className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">
                    {isCreator ? 'Earned' : 'Cost'}
                  </p>
                  <p className="text-white font-semibold">
                    {cost} tokens
                  </p>
                </div>
              </div>
              {isCreator && (
                <span className="text-green-400 text-sm">
                  +${(cost * 0.05).toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* Recording */}
          {recordingUrl && (
            <div className="bg-gray-700/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-medium">Recording Available</p>
                <button
                  onClick={() => onDownloadRecording?.(recordingUrl)}
                  className="p-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors"
                >
                  <ArrowDownTrayIcon className="w-4 h-4 text-white" />
                </button>
              </div>
              <p className="text-gray-400 text-sm">
                Download your call recording
              </p>
            </div>
          )}
        </div>

        {/* Rating section (for non-creators) */}
        {!isCreator && (
          <div className="mb-8">
            <p className="text-white font-medium mb-3 text-center">
              How was your experience?
            </p>
            
            {/* Star rating */}
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  {star <= (hoveredRating || rating) ? (
                    <StarSolidIcon className="w-8 h-8 text-yellow-400" />
                  ) : (
                    <StarIcon className="w-8 h-8 text-gray-600" />
                  )}
                </button>
              ))}
            </div>

            {/* Feedback input */}
            {rating > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Share your feedback (optional)"
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  rows={3}
                />
              </motion.div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!isCreator && rating > 0 ? (
            <>
              <button
                onClick={handleSubmitRating}
                className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                Submit & Continue
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <HomeIcon className="w-5 h-5" />
              Return Home
            </button>
          )}
        </div>

        {/* Skip rating option */}
        {!isCreator && rating === 0 && (
          <button
            onClick={onClose}
            className="w-full mt-3 py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            Skip and continue
          </button>
        )}
      </motion.div>
    </motion.div>
  );
};

export default VideoCallEnded;