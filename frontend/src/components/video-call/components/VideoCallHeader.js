/**
 * Video call header with info display
 * @module components/VideoCallHeader
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  SignalIcon,
  ClockIcon,
  UsersIcon,
  CurrencyDollarIcon,
  RecordCircleIcon,
  WifiIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

/**
 * Header component displaying call information
 * @param {Object} props - Component props
 */
const VideoCallHeader = memo(({
  channel,
  duration = 0,
  cost = 0,
  connectionState = 'CONNECTED',
  participantCount = 1,
  isRecording = false,
  isCreator = false,
  networkQuality = { uplink: 5, downlink: 5 }
}) => {
  /**
   * Format duration display
   */
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Get connection status color
   */
  const getConnectionColor = () => {
    switch (connectionState) {
      case 'CONNECTED':
        return 'bg-green-500';
      case 'CONNECTING':
      case 'RECONNECTING':
        return 'bg-yellow-500';
      case 'DISCONNECTED':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  /**
   * Get network quality indicator
   */
  const getNetworkQualityIcon = () => {
    const avgQuality = (networkQuality.uplink + networkQuality.downlink) / 2;
    
    if (avgQuality >= 4) {
      return <WifiIcon className="w-4 h-4 text-green-400" />;
    } else if (avgQuality >= 2) {
      return <WifiIcon className="w-4 h-4 text-yellow-400" />;
    } else {
      return <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />;
    }
  };

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute top-0 left-0 right-0 z-40"
    >
      <div className="bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left side - Call info */}
          <div className="flex items-center gap-4">
            {/* Connection indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getConnectionColor()} animate-pulse`} />
              <span className="text-white text-sm font-medium">
                {connectionState === 'CONNECTED' ? 'Live' : connectionState}
              </span>
            </div>

            {/* Recording indicator */}
            {isRecording && (
              <div className="flex items-center gap-1 bg-red-500/20 backdrop-blur-sm px-3 py-1 rounded-full">
                <RecordCircleIcon className="w-4 h-4 text-red-500 animate-pulse" />
                <span className="text-red-500 text-sm font-medium">REC</span>
              </div>
            )}

            {/* Duration */}
            <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <ClockIcon className="w-4 h-4 text-white/70" />
              <span className="text-white font-mono text-sm">
                {formatDuration(duration)}
              </span>
            </div>

            {/* Participants */}
            <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <UsersIcon className="w-4 h-4 text-white/70" />
              <span className="text-white text-sm">
                {participantCount} {participantCount === 1 ? 'person' : 'people'}
              </span>
            </div>
          </div>

          {/* Center - Channel name */}
          <div className="hidden md:block">
            <h3 className="text-white font-semibold text-lg">
              {channel || 'Video Call'}
            </h3>
          </div>

          {/* Right side - Cost and quality */}
          <div className="flex items-center gap-4">
            {/* Network quality */}
            <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              {getNetworkQualityIcon()}
              <span className="text-white/70 text-sm">
                {networkQuality.uplink >= 4 ? 'Excellent' : 
                 networkQuality.uplink >= 2 ? 'Good' : 'Poor'}
              </span>
            </div>

            {/* Cost (for non-creators) */}
            {!isCreator && cost > 0 && (
              <div className="flex items-center gap-2 bg-purple-500/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <CurrencyDollarIcon className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 font-semibold text-sm">
                  {cost} tokens
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile view - simplified */}
        <div className="md:hidden mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getConnectionColor()}`} />
            <span className="text-white text-xs">
              {formatDuration(duration)}
            </span>
          </div>
          
          {!isCreator && cost > 0 && (
            <span className="text-purple-400 text-xs font-semibold">
              {cost} tokens
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
});

VideoCallHeader.displayName = 'VideoCallHeader';

export default VideoCallHeader;