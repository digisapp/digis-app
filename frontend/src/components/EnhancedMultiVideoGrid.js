import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MicrophoneIcon, 
  VideoCameraIcon,
  UserIcon,
  UserPlusIcon,
  UserMinusIcon,
  PhoneXMarkIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/solid';
import {
  VideoCameraSlashIcon,
  XMarkIcon,
  HandRaisedIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Tooltip from './ui/Tooltip';
import toast from 'react-hot-toast';

const EnhancedMultiVideoGrid = ({ 
  localUser,
  remoteUsers,
  localTracks,
  isHost,
  isStreaming,
  maxParticipants = 9,
  onKickUser,
  onMuteUser,
  onRequestToJoin,
  joinRequests = [],
  className = ''
}) => {
  const [pinnedUser, setPinnedUser] = useState(null);
  const [speakingUsers, setSpeakingUsers] = useState(new Set());
  const [layout, setLayout] = useState('grid'); // 'grid', 'speaker', 'sidebar'
  const [showParticipantControls, setShowParticipantControls] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [audioLevels, setAudioLevels] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const videoRefs = useRef({});
  const audioIntervalRef = useRef(null);

  // Pagination for large numbers of participants
  const participantsPerPage = layout === 'sidebar' ? 8 : 9;
  
  // All users including local
  const allUsers = [
    { ...localUser, isLocal: true, uid: 'local', displayName: 'You' },
    ...remoteUsers
  ];

  // Calculate total pages
  const totalPages = Math.ceil(allUsers.length / participantsPerPage);
  
  // Get users for current page
  const startIndex = currentPage * participantsPerPage;
  const displayUsers = pinnedUser 
    ? [pinnedUser, ...allUsers.filter(u => u.uid !== pinnedUser.uid).slice(startIndex, startIndex + participantsPerPage - 1)]
    : allUsers.slice(startIndex, startIndex + participantsPerPage);

  // Grid layout calculation with better responsive design
  const getGridLayout = (count, layoutMode) => {
    if (layoutMode === 'speaker' && pinnedUser) {
      return 'grid-cols-1';
    }
    
    if (layoutMode === 'sidebar') {
      return 'grid-cols-4 gap-2';
    }
    
    // Grid layout
    if (count <= 1) return 'grid-cols-1';
    if (count <= 2) return 'grid-cols-1 md:grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-3';
  };

  // Play video tracks
  useEffect(() => {
    // Play local video
    if (localTracks.videoTrack && videoRefs.current['local']) {
      localTracks.videoTrack.play(videoRefs.current['local']);
    }

    // Play remote videos
    displayUsers.forEach(user => {
      if (!user.isLocal && user.videoTrack && videoRefs.current[user.uid]) {
        user.videoTrack.play(videoRefs.current[user.uid]);
      }
    });
  }, [localTracks.videoTrack, displayUsers]);

  // Advanced audio level detection
  useEffect(() => {
    audioIntervalRef.current = setInterval(() => {
      const speaking = new Set();
      const levels = {};
      
      // Check local audio
      if (localTracks.audioTrack && localTracks.audioTrack.enabled) {
        const level = localTracks.audioTrack.getVolumeLevel();
        levels['local'] = level;
        if (level > 0.05) speaking.add('local');
      }

      // Check remote audio
      remoteUsers.forEach(user => {
        if (user.audioTrack && user.hasAudio) {
          const level = user.audioTrack.getVolumeLevel();
          levels[user.uid] = level;
          if (level > 0.05) speaking.add(user.uid);
        }
      });

      setSpeakingUsers(speaking);
      setAudioLevels(levels);
    }, 100);

    return () => {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
      }
    };
  }, [localTracks.audioTrack, remoteUsers]);

  // Host controls
  const handleKickUser = (user) => {
    if (onKickUser) {
      onKickUser(user);
      // toast.success(`${user.displayName} has been removed from the call`);
    }
  };

  const handleMuteUser = (user) => {
    if (onMuteUser) {
      onMuteUser(user);
      // toast.success(`${user.displayName} has been muted`);
    }
  };

  const handleAcceptJoinRequest = (request) => {
    if (onRequestToJoin) {
      onRequestToJoin(request, true);
      // toast.success(`${request.displayName} has been added to the call`);
    }
  };

  const handleRejectJoinRequest = (request) => {
    if (onRequestToJoin) {
      onRequestToJoin(request, false);
    }
  };

  const VideoTile = ({ user, isPinned = false, isLarge = false }) => {
    const isLocal = user.uid === 'local';
    const isSpeaking = speakingUsers.has(user.uid);
    const hasVideo = isLocal ? localTracks.videoTrack?.enabled : user.hasVideo;
    const hasAudio = isLocal ? localTracks.audioTrack?.enabled : user.hasAudio;
    const audioLevel = audioLevels[user.uid] || 0;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`relative bg-gray-900 rounded-xl overflow-hidden ${
          isLarge ? 'col-span-full row-span-2' : ''
        } ${isSpeaking ? 'ring-2 ring-green-500' : ''}`}
        onDoubleClick={() => setPinnedUser(isPinned ? null : user)}
      >
        {/* Video Container */}
        <div className="relative w-full h-full min-h-[200px]">
          {hasVideo ? (
            <div
              ref={el => videoRefs.current[user.uid] = el}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                  <UserIcon className="w-12 h-12 text-white" />
                </div>
                <p className="text-gray-300 font-medium">{user.displayName}</p>
              </div>
            </div>
          )}

          {/* Audio Level Indicator */}
          <div className="absolute bottom-2 left-2 right-2">
            <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-green-500"
                initial={{ width: 0 }}
                animate={{ width: `${audioLevel * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>

          {/* User Info Overlay */}
          <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">
                {user.displayName}
                {isLocal && ' (You)'}
              </span>
              {isPinned && (
                <span className="bg-purple-600 text-white px-2 py-1 rounded-full text-xs">
                  Pinned
                </span>
              )}
            </div>
          </div>

          {/* Status Icons */}
          <div className="absolute bottom-4 right-2 flex gap-2">
            {!hasAudio && (
              <div className="bg-red-500 p-1.5 rounded-full">
                <SpeakerXMarkIcon className="w-4 h-4 text-white" />
              </div>
            )}
            {!hasVideo && (
              <div className="bg-red-500 p-1.5 rounded-full">
                <VideoCameraSlashIcon className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          {/* Host Controls */}
          {isHost && !isLocal && (
            <motion.div
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center gap-3 opacity-0 hover:opacity-100 transition-opacity"
            >
              <Tooltip content="Mute participant">
                <button
                  onClick={() => handleMuteUser(user)}
                  className="p-3 bg-orange-600 hover:bg-orange-700 text-white rounded-full transition-colors"
                >
                  <SpeakerXMarkIcon className="w-5 h-5" />
                </button>
              </Tooltip>
              <Tooltip content="Remove from call">
                <button
                  onClick={() => handleKickUser(user)}
                  className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
                >
                  <UserMinusIcon className="w-5 h-5" />
                </button>
              </Tooltip>
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Controls Bar */}
      <div className="bg-gray-900/90 backdrop-blur-sm p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Layout Controls */}
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
              <Tooltip content="Grid View">
                <button
                  onClick={() => setLayout('grid')}
                  className={`p-2 rounded transition-colors ${
                    layout === 'grid' 
                      ? 'bg-purple-600 text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <Squares2X2Icon className="w-5 h-5" />
                </button>
              </Tooltip>
              <Tooltip content="Speaker View">
                <button
                  onClick={() => setLayout('speaker')}
                  className={`p-2 rounded transition-colors ${
                    layout === 'speaker' 
                      ? 'bg-purple-600 text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <VideoCameraIcon className="w-5 h-5" />
                </button>
              </Tooltip>
              <Tooltip content="Sidebar View">
                <button
                  onClick={() => setLayout('sidebar')}
                  className={`p-2 rounded transition-colors ${
                    layout === 'sidebar' 
                      ? 'bg-purple-600 text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <ViewColumnsIcon className="w-5 h-5" />
                </button>
              </Tooltip>
            </div>

            {/* Participant Count */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <UserIcon className="w-4 h-4" />
              <span>{allUsers.length} / {maxParticipants}</span>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="p-1 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-400">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="p-1 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center gap-3">
            {/* Join Requests */}
            {isHost && joinRequests.length > 0 && (
              <div className="relative">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowParticipantControls(!showParticipantControls)}
                  icon={<HandRaisedIcon className="w-4 h-4" />}
                  className="relative"
                >
                  Join Requests
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {joinRequests.length}
                  </span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 overflow-hidden">
        {layout === 'speaker' && pinnedUser ? (
          <div className="h-full flex flex-col gap-4">
            {/* Main Speaker */}
            <div className="flex-1">
              <VideoTile user={pinnedUser} isPinned={true} isLarge={true} />
            </div>
            {/* Other Participants */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {displayUsers
                .filter(u => u.uid !== pinnedUser.uid)
                .map(user => (
                  <div key={user.uid} className="w-32 h-24 flex-shrink-0">
                    <VideoTile user={user} />
                  </div>
                ))}
            </div>
          </div>
        ) : layout === 'sidebar' ? (
          <div className="h-full flex gap-4">
            {/* Main Video */}
            <div className="flex-1">
              <VideoTile user={pinnedUser || displayUsers[0]} isPinned={true} isLarge={true} />
            </div>
            {/* Sidebar */}
            <div className="w-64 space-y-2 overflow-y-auto">
              {displayUsers
                .filter(u => u.uid !== (pinnedUser?.uid || displayUsers[0]?.uid))
                .map(user => (
                  <VideoTile key={user.uid} user={user} />
                ))}
            </div>
          </div>
        ) : (
          <div className={`h-full grid ${getGridLayout(displayUsers.length, layout)} gap-4 auto-rows-fr`}>
            <AnimatePresence mode="popLayout">
              {displayUsers.map(user => (
                <VideoTile key={user.uid} user={user} isPinned={user.uid === pinnedUser?.uid} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Join Requests Panel */}
      <AnimatePresence>
        {isHost && showParticipantControls && joinRequests.length > 0 && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="absolute top-16 right-4 w-80 bg-gray-900 rounded-xl shadow-2xl border border-gray-800 overflow-hidden z-50"
          >
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Join Requests</h3>
                <button
                  onClick={() => setShowParticipantControls(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {joinRequests.map(request => (
                <div key={request.uid} className="p-4 border-b border-gray-800 last:border-b-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{request.displayName}</p>
                        <p className="text-sm text-gray-400">Wants to join</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      fullWidth
                      onClick={() => handleAcceptJoinRequest(request)}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      fullWidth
                      onClick={() => handleRejectJoinRequest(request)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedMultiVideoGrid;