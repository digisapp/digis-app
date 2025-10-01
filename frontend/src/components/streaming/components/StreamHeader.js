/**
 * Stream header component
 * @module components/StreamHeader
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  SignalIcon,
  UsersIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CogIcon,
  ShareIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

/**
 * Header component for stream information
 */
const StreamHeader = memo(({
  streamInfo,
  streamStatus,
  duration,
  viewerCount,
  earnings,
  isCreator,
  onSettings,
  onShare
}) => {
  /**
   * Get status color
   */
  const getStatusColor = () => {
    switch (streamStatus) {
      case 'live':
        return 'bg-red-500';
      case 'preparing':
        return 'bg-yellow-500';
      case 'ending':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  /**
   * Format viewer count
   */
  const formatViewers = (count) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-gray-800 border-b border-gray-700 px-4 py-3"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left side - Stream info */}
        <div className="flex items-center gap-4">
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
            <span className="text-white font-semibold uppercase text-sm">
              {streamStatus === 'live' ? 'LIVE' : streamStatus}
            </span>
          </div>

          {/* Stream title */}
          <div className="max-w-md">
            <h1 className="text-white font-bold text-lg truncate">
              {streamInfo?.title || 'Untitled Stream'}
            </h1>
            {streamInfo?.category && (
              <p className="text-gray-400 text-sm">
                {streamInfo.category}
              </p>
            )}
          </div>
        </div>

        {/* Center - Stats */}
        <div className="hidden md:flex items-center gap-6">
          {/* Viewers */}
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gray-700 rounded-lg">
              <EyeIcon className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Viewers</p>
              <p className="text-white font-semibold">
                {formatViewers(viewerCount)}
              </p>
            </div>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gray-700 rounded-lg">
              <ClockIcon className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Duration</p>
              <p className="text-white font-semibold font-mono">
                {duration || '0:00'}
              </p>
            </div>
          </div>

          {/* Earnings (creator only) */}
          {isCreator && (
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gray-700 rounded-lg">
                <CurrencyDollarIcon className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Earned</p>
                <p className="text-white font-semibold">
                  {earnings} tokens
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {/* Share button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onShare}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            title="Share stream"
          >
            <ShareIcon className="w-5 h-5 text-white" />
          </motion.button>

          {/* Settings (creator only) */}
          {isCreator && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSettings}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title="Stream settings"
            >
              <CogIcon className="w-5 h-5 text-white" />
            </motion.button>
          )}

          {/* Subscribe button (viewer only) */}
          {!isCreator && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
            >
              <StarIcon className="w-4 h-4" />
              Subscribe
            </motion.button>
          )}
        </div>
      </div>

      {/* Mobile stats row */}
      <div className="md:hidden mt-3 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">
            <EyeIcon className="w-4 h-4 inline mr-1" />
            {formatViewers(viewerCount)}
          </span>
          <span className="text-gray-400">
            <ClockIcon className="w-4 h-4 inline mr-1" />
            {duration || '0:00'}
          </span>
          {isCreator && (
            <span className="text-gray-400">
              <CurrencyDollarIcon className="w-4 h-4 inline mr-1" />
              {earnings}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
});

StreamHeader.displayName = 'StreamHeader';

export default StreamHeader;