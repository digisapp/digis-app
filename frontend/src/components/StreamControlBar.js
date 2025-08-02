import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  ComputerDesktopIcon,
  CogIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ListBulletIcon,
  ClipboardDocumentIcon,
  ArrowRightOnRectangleIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
  RectangleGroupIcon,
  BookmarkIcon,
  UserPlusIcon,
  BoltIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import {
  VideoCameraSlashIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/solid';
import Button from './ui/Button';
import Tooltip from './ui/Tooltip';

const StreamControlBar = ({
  isStreaming,
  onEndStream,
  onToggleAnalytics,
  onToggleChat,
  onToggleActivityFeed,
  onLayoutChange,
  onRaid,
  onClip,
  onLayoutSave,
  customLayouts,
  onLayoutLoad,
  isStreamEnding,
  isRecording = false,
  onToggleMultiGuest,
  isMultiGuest = false,
  className = ''
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showRaidDialog, setShowRaidDialog] = useState(false);
  const [raidTarget, setRaidTarget] = useState('');

  const handleMicToggle = () => {
    setIsMuted(!isMuted);
    // Implement actual mic toggle
  };

  const handleVideoToggle = () => {
    setIsVideoOff(!isVideoOff);
    // Implement actual video toggle
  };

  const handleScreenShare = () => {
    setIsScreenSharing(!isScreenSharing);
    // Implement screen sharing
  };

  const handleRaid = () => {
    if (raidTarget) {
      onRaid(raidTarget);
      setShowRaidDialog(false);
      setRaidTarget('');
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
              <Tooltip content="Create Clip">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClip}
                  className="p-2.5 bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white rounded-md transition-all"
                >
                  <ClipboardDocumentIcon className="w-5 h-5" />
                </motion.button>
              </Tooltip>

              <Tooltip content="Raid">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowRaidDialog(true)}
                  className="p-2.5 bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white rounded-md transition-all"
                >
                  <UserPlusIcon className="w-5 h-5" />
                </motion.button>
              </Tooltip>

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
                  >
                    <UserGroupIcon className="w-5 h-5" />
                    <span className="text-xs font-medium hidden lg:inline">
                      {isMultiGuest ? 'Multi-Guest' : 'Solo'}
                    </span>
                  </motion.button>
                </Tooltip>
              )}

              {isRecording && (
                <Tooltip content="Recording">
                  <motion.div
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="p-2.5 bg-red-500/20 text-red-400 rounded-md flex items-center gap-2"
                  >
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-xs font-medium hidden lg:inline">REC</span>
                  </motion.div>
                </Tooltip>
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
                    
                    {customLayouts.length > 0 && (
                      <>
                        <div className="border-t border-gray-700 my-2" />
                        <div className="text-xs text-gray-400 font-semibold px-3 py-2">CUSTOM</div>
                        {customLayouts.map(layout => (
                          <button
                            key={layout.id}
                            onClick={() => {
                              onLayoutLoad(layout);
                              setShowLayoutMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 rounded-md transition-colors"
                          >
                            <BookmarkIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-300">{layout.name}</span>
                          </button>
                        ))}
                      </>
                    )}
                    
                    <div className="border-t border-gray-700 my-2" />
                    <button
                      onClick={() => {
                        onLayoutSave();
                        setShowLayoutMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <BookmarkIcon className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-purple-400">Save Current Layout</span>
                    </button>
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
              >
                <ListBulletIcon className="w-5 h-5" />
              </motion.button>
            </Tooltip>
          </div>

          {/* Right Section - Additional Controls can go here */}
        </div>
      </div>

      {/* Raid Dialog */}
      <AnimatePresence>
        {showRaidDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => setShowRaidDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-4">Raid a Channel</h3>
              <p className="text-gray-400 mb-4">
                Send your viewers to another live channel when you end your stream.
              </p>
              <input
                type="text"
                value={raidTarget}
                onChange={(e) => setRaidTarget(e.target.value)}
                placeholder="Enter channel name..."
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <div className="flex gap-3">
                <Button
                  onClick={handleRaid}
                  variant="primary"
                  fullWidth
                  disabled={!raidTarget}
                >
                  Start Raid
                </Button>
                <Button
                  onClick={() => setShowRaidDialog(false)}
                  variant="secondary"
                  fullWidth
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StreamControlBar;