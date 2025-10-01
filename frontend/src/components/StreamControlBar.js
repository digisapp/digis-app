import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  ComputerDesktopIcon,
  CogIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ListBulletIcon,
  ArrowRightOnRectangleIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
  RectangleGroupIcon,
  BookmarkIcon,
  BoltIcon,
  UserGroupIcon,
  CloudArrowUpIcon,
  StopIcon
} from '@heroicons/react/24/outline';
import {
  VideoCameraSlashIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/solid';
import Button from './ui/Button';
import Tooltip from './ui/Tooltip';
import toast from 'react-hot-toast';

const StreamControlBar = ({
  isStreaming,
  onEndStream,
  onToggleAnalytics,
  onToggleChat,
  onToggleActivityFeed,
  onLayoutChange,
  isStreamEnding,
  isRecording = false,
  onToggleRecording,
  onToggleMultiGuest,
  isMultiGuest = false,
  onToggleMultiCamera,
  isMultiCamera = false,
  streamId,
  localTracks = null,
  localScreenTrack = null,
  onScreenShareToggle = null,
  className = ''
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);

  // Sync button states with actual track states on mount
  React.useEffect(() => {
    if (localTracks?.audioTrack) {
      setIsMuted(!localTracks.audioTrack.enabled);
    }
    if (localTracks?.videoTrack) {
      setIsVideoOff(!localTracks.videoTrack.enabled);
    }
  }, [localTracks]);

  const handleMicToggle = async () => {
    if (!localTracks?.audioTrack) {
      toast.error('Audio track not available');
      return;
    }

    try {
      const newMutedState = !isMuted;
      await localTracks.audioTrack.setEnabled(!newMutedState);
      setIsMuted(newMutedState);
      toast.success(newMutedState ? 'Microphone muted' : 'Microphone unmuted');
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
      toast.error('Failed to toggle microphone');
    }
  };

  const handleVideoToggle = async () => {
    if (!localTracks?.videoTrack) {
      toast.error('Video track not available');
      return;
    }

    try {
      const newVideoOffState = !isVideoOff;
      await localTracks.videoTrack.setEnabled(!newVideoOffState);
      setIsVideoOff(newVideoOffState);
      toast.success(newVideoOffState ? 'Camera turned off' : 'Camera turned on');
    } catch (error) {
      console.error('Failed to toggle camera:', error);
      toast.error('Failed to toggle camera');
    }
  };

  const handleScreenShare = async () => {
    if (!onScreenShareToggle) {
      toast.error('Screen sharing not configured');
      return;
    }

    try {
      const result = await onScreenShareToggle(!isScreenSharing);
      if (result) {
        setIsScreenSharing(!isScreenSharing);
        toast.success(isScreenSharing ? 'Screen sharing stopped' : 'Screen sharing started');
      }
    } catch (error) {
      console.error('Failed to toggle screen sharing:', error);
      toast.error('Failed to toggle screen sharing');
    }
  };

  const layoutOptions = [
    { id: 'default', name: 'Default', icon: Squares2X2Icon },
    { id: 'balanced', name: 'Balanced', icon: ViewColumnsIcon },
    { id: 'focus', name: 'Focus', icon: RectangleGroupIcon }
  ];

  return (
    <>
      <div className={`absolute bottom-0 left-0 right-0 bg-gray-950/95 backdrop-blur-sm border-t border-gray-800 px-4 py-5 z-50 ${className}`}>
        <div className="flex items-center justify-between">
          {/* Left Section - Logo + Media Controls */}
          <div className="flex items-center gap-4">
            {/* Logo */}
            <img 
              src="/digis-logo-white.png" 
              alt="Digis" 
              className="h-6 w-auto opacity-80 hidden lg:block"
            />
            
            {/* Media Controls Group */}
            <div className="flex items-center gap-1 bg-gray-900/50 rounded-lg p-1">
              <Tooltip content={isMuted ? 'Unmute' : 'Mute'}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleMicToggle}
                  className={`p-2.5 rounded-md transition-all flex items-center gap-2 ${
                    isMuted 
                      ? 'bg-transparent hover:bg-red-500/20 text-red-400 ring-2 ring-red-500' 
                      : 'bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white'
                  }`}
                  aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  onKeyDown={(e) => e.key === 'Enter' && handleMicToggle()}
                >
                  {isMuted ? (
                    <SpeakerXMarkIcon className="w-5 h-5" />
                  ) : (
                    <MicrophoneIcon className="w-5 h-5" />
                  )}
                  <span className="text-xs font-medium hidden lg:inline">
                    {isMuted ? 'Muted' : 'Mic'}
                  </span>
                </motion.button>
              </Tooltip>

              <Tooltip content={isVideoOff ? 'Turn on camera' : 'Turn off camera'}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleVideoToggle}
                  className={`p-2.5 rounded-md transition-all flex items-center gap-2 ${
                    isVideoOff 
                      ? 'bg-transparent hover:bg-red-500/20 text-red-400 ring-2 ring-red-500' 
                      : 'bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white'
                  }`}
                  aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                  onKeyDown={(e) => e.key === 'Enter' && handleVideoToggle()}
                >
                  {isVideoOff ? (
                    <VideoCameraSlashIcon className="w-5 h-5" />
                  ) : (
                    <VideoCameraIcon className="w-5 h-5" />
                  )}
                  <span className="text-xs font-medium hidden lg:inline">
                    {isVideoOff ? 'Off' : 'Camera'}
                  </span>
                </motion.button>
              </Tooltip>

              <Tooltip content={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleScreenShare}
                  className={`p-2.5 rounded-md transition-all flex items-center gap-2 ${
                    isScreenSharing 
                      ? 'bg-transparent hover:bg-purple-500/20 text-purple-400 ring-2 ring-purple-500' 
                      : 'bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white'
                  }`}
                  aria-label={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
                  onKeyDown={(e) => e.key === 'Enter' && handleScreenShare()}
                >
                  <ComputerDesktopIcon className="w-5 h-5" />
                  <span className="text-xs font-medium hidden lg:inline">
                    {isScreenSharing ? 'Sharing' : 'Share'}
                  </span>
                </motion.button>
              </Tooltip>
            </div>

            {/* Stream Actions Group */}
            <div className="flex items-center gap-1 bg-gray-900/50 rounded-lg p-1">
              {onToggleMultiCamera && (
                <Tooltip content={isMultiCamera ? "Disable multi-camera" : "Enable professional multi-camera mode"}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onToggleMultiCamera}
                    className={`p-2.5 rounded-md transition-all flex items-center gap-2 ${
                      isMultiCamera 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white'
                    }`}
                    aria-label={isMultiCamera ? 'Disable multi-camera mode' : 'Enable multi-camera mode'}
                  >
                    <VideoCameraIcon className="w-5 h-5" />
                    <span className="text-xs font-medium hidden lg:inline">
                      {isMultiCamera ? 'Multi-Cam' : '1 Cam'}
                    </span>
                  </motion.button>
                </Tooltip>
              )}
              
              {onToggleMultiGuest && (
                <Tooltip content={isMultiGuest ? "Disable multi-guest" : "Enable multi-guest (up to 9)"}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onToggleMultiGuest}
                    className={`p-2.5 rounded-md transition-all flex items-center gap-2 ${
                      isMultiGuest 
                        ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                        : 'bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white'
                    }`}
                    aria-label={isMultiGuest ? 'Disable multi-guest mode' : 'Enable multi-guest mode'}
                    onKeyDown={(e) => e.key === 'Enter' && onToggleMultiGuest()}
                  >
                    <UserGroupIcon className="w-5 h-5" />
                    <span className="text-xs font-medium hidden lg:inline">
                      {isMultiGuest ? 'Multi-Guest' : 'Solo'}
                    </span>
                  </motion.button>
                </Tooltip>
              )}

              {/* Recording Toggle */}
              {onToggleRecording && (
                <Tooltip content={isRecording ? "Stop recording" : "Start recording"}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onToggleRecording}
                    className={`p-2.5 rounded-md transition-all flex items-center gap-2 ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                        : 'bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white'
                    }`}
                    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                    onKeyDown={(e) => e.key === 'Enter' && onToggleRecording()}
                  >
                    {isRecording ? (
                      <>
                        <StopIcon className="w-5 h-5" />
                        <span className="text-xs font-medium hidden lg:inline">Stop REC</span>
                      </>
                    ) : (
                      <>
                        <CloudArrowUpIcon className="w-5 h-5" />
                        <span className="text-xs font-medium hidden lg:inline">Record</span>
                      </>
                    )}
                  </motion.button>
                </Tooltip>
              )}

              {/* Recording Indicator */}
              {isRecording && (
                <motion.div
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="p-2.5 bg-red-500/20 text-red-400 rounded-md flex items-center gap-2"
                >
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className="text-xs font-medium hidden lg:inline">LIVE REC</span>
                </motion.div>
              )}
            </div>

            {/* End Stream Button */}
            <motion.button
              whileHover={{ scale: isStreamEnding ? 1 : 1.05 }}
              whileTap={{ scale: isStreamEnding ? 1 : 0.95 }}
              onClick={onEndStream}
              disabled={isStreamEnding}
              className={`px-4 py-2.5 ${
                isStreamEnding 
                  ? 'bg-gray-700 cursor-not-allowed' 
                  : 'bg-red-600 hover:bg-red-700'
              } text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg`}
              aria-label={isStreamEnding ? 'Stream ended' : 'End stream'}
              onKeyDown={(e) => e.key === 'Enter' && !isStreamEnding && onEndStream()}
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              {isStreamEnding ? 'Ended' : 'End Stream'}
            </motion.button>
          </div>

          {/* Center Section - View Controls */}
          <div className="hidden lg:flex items-center gap-1 bg-gray-900/50 rounded-lg p-1">
            {/* Layout Selector */}
            <div className="relative">
              <Tooltip content="Change layout">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowLayoutMenu(!showLayoutMenu)}
                  className="p-2.5 bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white rounded-md transition-all"
                  aria-label="Change layout"
                  aria-expanded={showLayoutMenu}
                  aria-haspopup="menu"
                  onKeyDown={(e) => e.key === 'Enter' && setShowLayoutMenu(!showLayoutMenu)}
                >
                  <Squares2X2Icon className="w-5 h-5" />
                </motion.button>
              </Tooltip>

              <AnimatePresence>
                {showLayoutMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full mb-2 left-0 bg-gray-800 rounded-lg shadow-xl p-2 min-w-[200px]"
                  >
                    <div className="text-xs text-gray-400 font-semibold px-3 py-2">LAYOUTS</div>
                    {layoutOptions.map(layout => (
                      <button
                        key={layout.id}
                        onClick={() => {
                          onLayoutChange(layout.id);
                          setShowLayoutMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 rounded-md transition-colors"
                      >
                        <layout.icon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-300">{layout.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Panel Toggles */}
            <Tooltip content="Analytics">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleAnalytics}
                className="p-2.5 bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white rounded-md transition-all"
                aria-label="Toggle analytics panel"
                onKeyDown={(e) => e.key === 'Enter' && onToggleAnalytics()}
              >
                <ChartBarIcon className="w-5 h-5" />
              </motion.button>
            </Tooltip>

            <Tooltip content="Chat">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleChat}
                className="p-2.5 bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white rounded-md transition-all"
                aria-label="Toggle chat panel"
                onKeyDown={(e) => e.key === 'Enter' && onToggleChat()}
              >
                <ChatBubbleLeftRightIcon className="w-5 h-5" />
              </motion.button>
            </Tooltip>

            <Tooltip content="Activity">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleActivityFeed}
                className="p-2.5 bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white rounded-md transition-all"
                aria-label="Toggle activity feed"
                onKeyDown={(e) => e.key === 'Enter' && onToggleActivityFeed()}
              >
                <ListBulletIcon className="w-5 h-5" />
              </motion.button>
            </Tooltip>
          </div>

          {/* Right Section - Additional Controls can go here */}
        </div>
      </div>

    </>
  );
};

StreamControlBar.propTypes = {
  isStreaming: PropTypes.bool,
  onEndStream: PropTypes.func.isRequired,
  onToggleAnalytics: PropTypes.func,
  onToggleChat: PropTypes.func,
  onToggleActivityFeed: PropTypes.func,
  onLayoutChange: PropTypes.func,
  isStreamEnding: PropTypes.bool,
  isRecording: PropTypes.bool,
  onToggleRecording: PropTypes.func,
  onToggleMultiGuest: PropTypes.func,
  isMultiGuest: PropTypes.bool,
  streamId: PropTypes.string,
  className: PropTypes.string
};

export default memo(StreamControlBar);