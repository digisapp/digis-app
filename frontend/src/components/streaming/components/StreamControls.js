/**
 * Stream control buttons for creators
 * @module components/StreamControls
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  GiftIcon,
  ChartBarIcon,
  UsersIcon,
  CogIcon,
  XMarkIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';
import {
  MicrophoneIcon as MicrophoneSolidIcon,
  VideoCameraIcon as VideoCameraSolidIcon
} from '@heroicons/react/24/solid';

/**
 * Control panel for stream creators
 */
const StreamControls = memo(({
  onEndStream,
  onToggleChat,
  onToggleGifts,
  onTogglePolls,
  onToggleViewers,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  showPanels = {},
  mediaState = { audio: true, video: true, screenShare: false }
}) => {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800/90 backdrop-blur-lg rounded-2xl p-3 shadow-2xl border border-gray-700"
    >
      <div className="flex items-center gap-2">
        {/* Media controls */}
        <div className="flex items-center gap-1 pr-2 border-r border-gray-600">
          {/* Microphone */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onToggleAudio?.(!mediaState.audio)}
            className={`p-2.5 rounded-lg transition-all ${
              mediaState.audio
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={mediaState.audio ? 'Mute microphone' : 'Unmute microphone'}
          >
            {mediaState.audio ? (
              <MicrophoneIcon className="w-5 h-5" />
            ) : (
              <MicrophoneSolidIcon className="w-5 h-5" />
            )}
          </motion.button>

          {/* Camera */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onToggleVideo?.(!mediaState.video)}
            className={`p-2.5 rounded-lg transition-all ${
              mediaState.video
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={mediaState.video ? 'Turn off camera' : 'Turn on camera'}
          >
            {mediaState.video ? (
              <VideoCameraIcon className="w-5 h-5" />
            ) : (
              <VideoCameraSolidIcon className="w-5 h-5" />
            )}
          </motion.button>

          {/* Screen share */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onToggleScreenShare?.(!mediaState.screenShare)}
            className={`p-2.5 rounded-lg transition-all ${
              mediaState.screenShare
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title={mediaState.screenShare ? 'Stop sharing' : 'Share screen'}
          >
            <ComputerDesktopIcon className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Panel toggles */}
        <div className="flex items-center gap-1 px-2">
          {/* Chat */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleChat}
            className={`p-2.5 rounded-lg transition-all ${
              showPanels.chat
                ? 'bg-purple-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="Toggle chat"
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5" />
          </motion.button>

          {/* Gifts */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleGifts}
            className={`p-2.5 rounded-lg transition-all ${
              showPanels.gifts
                ? 'bg-purple-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="Toggle gifts"
          >
            <GiftIcon className="w-5 h-5" />
          </motion.button>

          {/* Polls */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onTogglePolls}
            className={`p-2.5 rounded-lg transition-all ${
              showPanels.polls
                ? 'bg-purple-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="Toggle polls"
          >
            <ChartBarIcon className="w-5 h-5" />
          </motion.button>

          {/* Viewers */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleViewers}
            className={`p-2.5 rounded-lg transition-all ${
              showPanels.viewers
                ? 'bg-purple-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="Toggle viewer list"
          >
            <UsersIcon className="w-5 h-5" />
          </motion.button>
        </div>

        {/* End stream button */}
        <div className="pl-2 border-l border-gray-600">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onEndStream}
            className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
            title="End stream"
          >
            <XMarkIcon className="w-5 h-5" />
            End Stream
          </motion.button>
        </div>
      </div>

      {/* Stream stats mini display */}
      <div className="mt-2 pt-2 border-t border-gray-700 flex items-center justify-center gap-4 text-xs">
        <span className="text-gray-400">
          <span className="text-white font-semibold">Live</span> for 00:00
        </span>
        <span className="text-gray-400">
          <span className="text-white font-semibold">0</span> viewers
        </span>
        <span className="text-gray-400">
          <span className="text-green-400 font-semibold">0</span> tokens earned
        </span>
      </div>
    </motion.div>
  );
});

StreamControls.displayName = 'StreamControls';

export default StreamControls;