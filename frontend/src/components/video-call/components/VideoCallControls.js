/**
 * Video call control buttons component
 * @module components/VideoCallControls
 */

import React, { useState, memo } from 'react';
import { motion } from 'framer-motion';
import {
  MicrophoneIcon,
  VideoCameraIcon,
  PhoneXMarkIcon,
  ChatBubbleLeftRightIcon,
  CogIcon,
  SparklesIcon,
  CameraIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';
import {
  MicrophoneIcon as MicrophoneSolidIcon,
  VideoCameraIcon as VideoCameraSolidIcon
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

/**
 * Video call control buttons
 * @param {Object} props - Component props
 * @param {boolean} props.isAudioEnabled - Audio state
 * @param {boolean} props.isVideoEnabled - Video state
 * @param {boolean} props.isScreenSharing - Screen share state
 * @param {boolean} props.isFullscreen - Fullscreen state
 * @param {Function} props.onToggleAudio - Toggle audio callback
 * @param {Function} props.onToggleVideo - Toggle video callback
 * @param {Function} props.onToggleScreenShare - Toggle screen share callback
 * @param {Function} props.onToggleFullscreen - Toggle fullscreen callback
 * @param {Function} props.onOpenChat - Open chat callback
 * @param {Function} props.onOpenSettings - Open settings callback
 * @param {Function} props.onOpenEffects - Open effects callback
 * @param {Function} props.onTakeScreenshot - Take screenshot callback
 * @param {Function} props.onEndCall - End call callback
 * @param {boolean} props.isCreator - Whether user is creator
 */
const VideoCallControls = memo(({
  isAudioEnabled = true,
  isVideoEnabled = true,
  isScreenSharing = false,
  isFullscreen = false,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleFullscreen,
  onOpenChat,
  onOpenSettings,
  onOpenEffects,
  onTakeScreenshot,
  onEndCall,
  isCreator = false
}) => {
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const handleToggleAudio = () => {
    onToggleAudio(!isAudioEnabled);
    toast(isAudioEnabled ? 'Microphone muted' : 'Microphone unmuted', {
      icon: isAudioEnabled ? '🔇' : '🔊',
      duration: 2000
    });
  };

  const handleToggleVideo = () => {
    onToggleVideo(!isVideoEnabled);
    toast(isVideoEnabled ? 'Camera turned off' : 'Camera turned on', {
      icon: isVideoEnabled ? '📵' : '📹',
      duration: 2000
    });
  };

  const handleScreenShare = () => {
    if (!isCreator && isScreenSharing) {
      toast.error('Only creators can share screen');
      return;
    }
    onToggleScreenShare(!isScreenSharing);
  };

  const handleEndCall = () => {
    if (window.confirm('Are you sure you want to end the call?')) {
      onEndCall();
    }
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="video-call-controls"
    >
      <div className="flex items-center justify-center gap-2 p-4 bg-black/50 backdrop-blur-md rounded-2xl">
        {/* Primary Controls */}
        <div className="flex items-center gap-2">
          {/* Microphone Toggle */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleAudio}
            className={`p-3 rounded-full transition-all ${
              isAudioEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isAudioEnabled ? (
              <MicrophoneIcon className="w-6 h-6" />
            ) : (
              <MicrophoneSolidIcon className="w-6 h-6" />
            )}
          </motion.button>

          {/* Video Toggle */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleVideo}
            className={`p-3 rounded-full transition-all ${
              isVideoEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoEnabled ? (
              <VideoCameraIcon className="w-6 h-6" />
            ) : (
              <VideoCameraSolidIcon className="w-6 h-6" />
            )}
          </motion.button>

          {/* Screen Share */}
          {isCreator && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleScreenShare}
              className={`p-3 rounded-full transition-all ${
                isScreenSharing
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              <ComputerDesktopIcon className="w-6 h-6" />
            </motion.button>
          )}

          {/* End Call */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleEndCall}
            className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all ml-4"
            title="End call"
          >
            <PhoneXMarkIcon className="w-6 h-6" />
          </motion.button>
        </div>

        {/* Separator */}
        <div className="w-px h-10 bg-gray-600 mx-2" />

        {/* Secondary Controls */}
        <div className="flex items-center gap-2">
          {/* Chat */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenChat}
            className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-all"
            title="Open chat"
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5" />
          </motion.button>

          {/* Effects */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenEffects}
            className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-all"
            title="Video effects"
          >
            <SparklesIcon className="w-5 h-5" />
          </motion.button>

          {/* Screenshot */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onTakeScreenshot}
            className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-all"
            title="Take screenshot"
          >
            <CameraIcon className="w-5 h-5" />
          </motion.button>

          {/* Fullscreen */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onToggleFullscreen(!isFullscreen)}
            className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-all"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="w-5 h-5" />
            ) : (
              <ArrowsPointingOutIcon className="w-5 h-5" />
            )}
          </motion.button>

          {/* Settings */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenSettings}
            className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-all"
            title="Settings"
          >
            <CogIcon className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Mobile-optimized controls */}
      <div className="md:hidden fixed bottom-20 left-0 right-0 flex justify-center">
        <div className="bg-black/70 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-3">
          <button
            onClick={handleToggleAudio}
            className={`p-2 rounded-full ${
              isAudioEnabled ? 'bg-gray-700' : 'bg-red-500'
            }`}
          >
            {isAudioEnabled ? (
              <MicrophoneIcon className="w-5 h-5 text-white" />
            ) : (
              <MicrophoneSolidIcon className="w-5 h-5 text-white" />
            )}
          </button>

          <button
            onClick={handleToggleVideo}
            className={`p-2 rounded-full ${
              isVideoEnabled ? 'bg-gray-700' : 'bg-red-500'
            }`}
          >
            {isVideoEnabled ? (
              <VideoCameraIcon className="w-5 h-5 text-white" />
            ) : (
              <VideoCameraSolidIcon className="w-5 h-5 text-white" />
            )}
          </button>

          <button
            onClick={handleEndCall}
            className="p-2 bg-red-500 rounded-full"
          >
            <PhoneXMarkIcon className="w-5 h-5 text-white" />
          </button>

          <button
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="p-2 bg-gray-700 rounded-full"
          >
            <CogIcon className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* More options menu for mobile */}
      {showMoreOptions && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden fixed bottom-32 left-4 right-4 bg-black/90 backdrop-blur-md rounded-xl p-4"
        >
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={onOpenChat}
              className="p-3 bg-gray-700 rounded-lg flex flex-col items-center"
            >
              <ChatBubbleLeftRightIcon className="w-6 h-6 text-white mb-1" />
              <span className="text-xs text-white">Chat</span>
            </button>

            <button
              onClick={onOpenEffects}
              className="p-3 bg-gray-700 rounded-lg flex flex-col items-center"
            >
              <SparklesIcon className="w-6 h-6 text-white mb-1" />
              <span className="text-xs text-white">Effects</span>
            </button>

            <button
              onClick={onTakeScreenshot}
              className="p-3 bg-gray-700 rounded-lg flex flex-col items-center"
            >
              <CameraIcon className="w-6 h-6 text-white mb-1" />
              <span className="text-xs text-white">Screenshot</span>
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
});

VideoCallControls.displayName = 'VideoCallControls';

export default VideoCallControls;