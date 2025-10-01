import React, { useEffect, useRef, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { 
  MicrophoneIcon, 
  VideoCameraIcon,
  UserIcon
} from '@heroicons/react/24/solid';
import {
  VideoCameraSlashIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/outline';
import { XMarkIcon } from '@heroicons/react/24/solid';
import DualBadgeDisplay from './DualBadgeDisplay';

const MultiVideoGrid = memo(({ 
  localUser,
  remoteUsers,
  localTracks,
  isStreaming,
  creatorId,
  maxVisibleUsers = 4
}) => {
  const [pinnedUser, setPinnedUser] = useState(null);
  const [speakingUsers, setSpeakingUsers] = useState(new Set());
  const videoRefs = useRef({});

  // Calculate grid layout based on number of participants
  const getGridLayout = (count) => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 2) return 'grid-cols-1 md:grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-3 md:grid-cols-4';
  };

  // All users including local
  const allUsers = [
    { ...localUser, isLocal: true, uid: 'local' },
    ...remoteUsers.slice(0, maxVisibleUsers - 1)
  ];

  // If someone is pinned, show them prominently
  const displayUsers = pinnedUser 
    ? [pinnedUser, ...allUsers.filter(u => u.uid !== pinnedUser.uid)]
    : allUsers;

  // Play video tracks
  useEffect(() => {
    // Play local video
    if (localTracks.videoTrack && videoRefs.current['local']) {
      localTracks.videoTrack.play(videoRefs.current['local']);
    }

    // Play remote videos
    remoteUsers.forEach(user => {
      if (user.videoTrack && videoRefs.current[user.uid]) {
        user.videoTrack.play(videoRefs.current[user.uid]);
      }
    });

    // Cleanup
    return () => {
      if (localTracks.videoTrack) {
        localTracks.videoTrack.stop();
      }
    };
  }, [localTracks.videoTrack, remoteUsers]);

  // Volume level detection for speaking indicator
  useEffect(() => {
    const interval = setInterval(() => {
      const speaking = new Set();
      
      // Check local audio
      if (localTracks.audioTrack) {
        const level = localTracks.audioTrack.getVolumeLevel();
        if (level > 0.1) speaking.add('local');
      }

      // Check remote audio
      remoteUsers.forEach(user => {
        if (user.audioTrack) {
          const level = user.audioTrack.getVolumeLevel();
          if (level > 0.1) speaking.add(user.uid);
        }
      });

      setSpeakingUsers(speaking);
    }, 200);

    return () => clearInterval(interval);
  }, [localTracks.audioTrack, remoteUsers]);

  const VideoTile = ({ user, isPinned = false }) => {
    const isLocal = user.uid === 'local';
    const isSpeaking = speakingUsers.has(user.uid);
    const hasVideo = isLocal ? localTracks.videoTrack : user.hasVideo;
    const hasAudio = isLocal ? localTracks.audioTrack : user.hasAudio;
    const isMuted = isLocal ? !localTracks.audioTrack?.enabled : !user.hasAudio;
    const isVideoOff = isLocal ? !localTracks.videoTrack?.enabled : !user.hasVideo;

    return (
      <motion.div
        layout
        className={`relative bg-black rounded-lg overflow-hidden ${
          isPinned ? 'col-span-full row-span-2' : ''
        } ${isSpeaking ? 'ring-2 ring-green-500' : ''}`}
        onClick={() => !isLocal && setPinnedUser(user.uid === pinnedUser?.uid ? null : user)}
      >
        {/* Video element */}
        <div 
          ref={el => videoRefs.current[user.uid] = el}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: hasVideo ? 'block' : 'none' }}
        />

        {/* Placeholder when video is off */}
        {!hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-gray-700 flex items-center justify-center">
                <UserIcon className="w-12 h-12 text-gray-400" />
              </div>
              <p className="text-white text-sm font-medium">{user.name || `User ${user.uid}`}</p>
            </div>
          </div>
        )}

        {/* User info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">
                {isLocal ? 'You' : user.name || `User ${user.uid}`}
              </span>
              {user.type === 'creator' && (
                <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
                  Creator
                </span>
              )}
              {user.type === 'cohost' && (
                <span className="bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full">
                  Co-Host
                </span>
              )}
              {/* Show dual badges for non-creator users */}
              {!isLocal && user.type !== 'creator' && creatorId && user.uid && (
                <DualBadgeDisplay
                  userId={user.uid}
                  creatorId={creatorId}
                  size="small"
                  showTooltip={false}
                />
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {/* Audio indicator */}
              {isMuted ? (
                <div className="relative">
                  <MicrophoneIcon className="w-4 h-4 text-red-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-5 h-0.5 bg-red-500 rotate-45 transform origin-center" />
                  </div>
                </div>
              ) : isSpeaking ? (
                <MicrophoneIcon className="w-4 h-4 text-green-500 animate-pulse" />
              ) : (
                <MicrophoneIcon className="w-4 h-4 text-white/50" />
              )}
              
              {/* Video indicator */}
              {isVideoOff ? (
                <VideoCameraSlashIcon className="w-4 h-4 text-red-500" />
              ) : (
                <VideoCameraIcon className="w-4 h-4 text-white/50" />
              )}
            </div>
          </div>
        </div>

        {/* Pin indicator */}
        {!isLocal && (
          <button
            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 p-2 rounded-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setPinnedUser(user.uid === pinnedUser?.uid ? null : user);
            }}
          >
            <svg
              className={`w-4 h-4 ${isPinned ? 'text-yellow-500' : 'text-white'}`}
              fill={isPinned ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        )}
      </motion.div>
    );
  };

  // Different layouts for different scenarios
  if (isStreaming && remoteUsers.length === 0) {
    // Solo streaming - full screen for host
    return (
      <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
        <VideoTile user={allUsers[0]} isPinned={true} />
      </div>
    );
  }

  if (pinnedUser) {
    // Pinned layout - large main video with small tiles
    return (
      <div className="relative w-full h-full flex flex-col gap-2">
        <div className="flex-1">
          <VideoTile user={pinnedUser} isPinned={true} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {allUsers
            .filter(u => u.uid !== pinnedUser.uid)
            .map(user => (
              <div key={user.uid} className="w-32 h-24 flex-shrink-0">
                <VideoTile user={user} />
              </div>
            ))}
        </div>
      </div>
    );
  }

  // Grid layout for multiple participants
  return (
    <div className={`grid ${getGridLayout(displayUsers.length)} gap-2 w-full h-full`}>
      {displayUsers.map(user => (
        <VideoTile key={user.uid} user={user} />
      ))}
      
      {remoteUsers.length > maxVisibleUsers && (
        <div className="bg-gray-800 rounded-lg flex items-center justify-center">
          <p className="text-white text-sm">
            +{remoteUsers.length - maxVisibleUsers + 1} more
          </p>
        </div>
      )}
    </div>
  );
});

// Memoize with custom comparison to prevent unnecessary re-renders
MultiVideoGrid.displayName = 'MultiVideoGrid';

export default MultiVideoGrid;