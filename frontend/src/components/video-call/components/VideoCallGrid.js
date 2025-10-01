/**
 * Video grid layout component
 * @module components/VideoCallGrid
 */

import React, { useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import {
  MicrophoneIcon,
  VideoCameraIcon,
  UserCircleIcon
} from '@heroicons/react/24/solid';
import {
  MicrophoneIcon as MicrophoneOffIcon,
  VideoCameraIcon as VideoCameraOffIcon
} from '@heroicons/react/24/outline';

/**
 * Video grid component for displaying local and remote video streams
 */
const VideoCallGrid = memo(({
  localTracks,
  remoteTracks,
  isVoiceOnly = false,
  useMultiVideoGrid = false,
  isHost = false,
  activeCoHosts = []
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());

  /**
   * Attach local video track to DOM
   */
  useEffect(() => {
    if (localTracks.video && localVideoRef.current && !isVoiceOnly) {
      localTracks.video.play(localVideoRef.current);
    }
  }, [localTracks.video, isVoiceOnly]);

  /**
   * Attach remote tracks to DOM
   */
  useEffect(() => {
    remoteTracks.forEach((tracks, uid) => {
      const videoElement = remoteVideoRefs.current.get(uid);
      if (tracks.video && videoElement && !isVoiceOnly) {
        tracks.video.play(videoElement);
      }
    });
  }, [remoteTracks, isVoiceOnly]);

  /**
   * Calculate grid layout based on participant count
   */
  const getGridLayout = () => {
    const participantCount = remoteTracks.size + 1;
    
    if (participantCount === 1) {
      return 'grid-cols-1';
    } else if (participantCount === 2) {
      return 'grid-cols-1 md:grid-cols-2';
    } else if (participantCount <= 4) {
      return 'grid-cols-2';
    } else if (participantCount <= 6) {
      return 'grid-cols-2 md:grid-cols-3';
    } else if (participantCount <= 9) {
      return 'grid-cols-3';
    } else {
      return 'grid-cols-3 md:grid-cols-4';
    }
  };

  /**
   * Render video tile
   */
  const VideoTile = ({ 
    isLocal = false, 
    uid = null, 
    tracks = null,
    userName = 'User',
    isAudioEnabled = true,
    isVideoEnabled = true
  }) => {
    const setVideoRef = (element) => {
      if (isLocal) {
        localVideoRef.current = element;
      } else if (uid) {
        if (element) {
          remoteVideoRefs.current.set(uid, element);
        } else {
          remoteVideoRefs.current.delete(uid);
        }
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video group"
      >
        {/* Video element */}
        {!isVoiceOnly && isVideoEnabled ? (
          <video
            ref={setVideoRef}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            playsInline
            muted={isLocal}
          />
        ) : (
          // Placeholder for voice-only or video disabled
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
            <UserCircleIcon className="w-24 h-24 text-gray-600" />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

        {/* User info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Name tag */}
            <div className="bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md">
              <span className="text-white text-sm font-medium">
                {isLocal ? 'You' : userName}
              </span>
            </div>

            {/* Host/Co-host badge */}
            {(isLocal && isHost) || activeCoHosts.includes(uid) ? (
              <div className="bg-purple-500/80 backdrop-blur-sm px-2 py-1 rounded-md">
                <span className="text-white text-xs font-semibold">
                  {isHost ? 'HOST' : 'CO-HOST'}
                </span>
              </div>
            ) : null}
          </div>

          {/* Media indicators */}
          <div className="flex items-center gap-2">
            {/* Audio indicator */}
            <div className={`p-1.5 rounded-full ${
              isAudioEnabled ? 'bg-black/30' : 'bg-red-500/80'
            } backdrop-blur-sm`}>
              {isAudioEnabled ? (
                <MicrophoneIcon className="w-3 h-3 text-white" />
              ) : (
                <MicrophoneOffIcon className="w-3 h-3 text-white" />
              )}
            </div>

            {/* Video indicator */}
            {!isVoiceOnly && (
              <div className={`p-1.5 rounded-full ${
                isVideoEnabled ? 'bg-black/30' : 'bg-red-500/80'
              } backdrop-blur-sm`}>
                {isVideoEnabled ? (
                  <VideoCameraIcon className="w-3 h-3 text-white" />
                ) : (
                  <VideoCameraOffIcon className="w-3 h-3 text-white" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Speaking indicator */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </motion.div>
    );
  };

  /**
   * Render layout based on mode
   */
  if (useMultiVideoGrid || remoteTracks.size > 1) {
    // Grid layout for multiple participants
    return (
      <div className="absolute inset-0 p-4 pt-20 pb-24">
        <div className={`grid ${getGridLayout()} gap-4 h-full`}>
          {/* Local video */}
          <VideoTile
            isLocal={true}
            tracks={localTracks}
            isAudioEnabled={localTracks.audio?.enabled}
            isVideoEnabled={localTracks.video?.enabled}
          />

          {/* Remote videos */}
          {Array.from(remoteTracks.entries()).map(([uid, tracks]) => (
            <VideoTile
              key={uid}
              uid={uid}
              tracks={tracks}
              userName={`User ${uid}`}
              isAudioEnabled={tracks.audio?.enabled}
              isVideoEnabled={tracks.video?.enabled}
            />
          ))}
        </div>
      </div>
    );
  } else if (remoteTracks.size === 1) {
    // Single remote user - large view with PiP
    const [remoteUid, remoteTracks] = Array.from(remoteTracks.entries())[0];
    
    return (
      <div className="absolute inset-0">
        {/* Main remote video */}
        <VideoTile
          uid={remoteUid}
          tracks={remoteTracks}
          userName={`User ${remoteUid}`}
          isAudioEnabled={remoteTracks.audio?.enabled}
          isVideoEnabled={remoteTracks.video?.enabled}
        />

        {/* Local video PiP */}
        <motion.div
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          className="absolute bottom-24 right-4 w-32 md:w-48 aspect-video"
        >
          <VideoTile
            isLocal={true}
            tracks={localTracks}
            isAudioEnabled={localTracks.audio?.enabled}
            isVideoEnabled={localTracks.video?.enabled}
          />
        </motion.div>
      </div>
    );
  } else {
    // Solo view (only local video)
    return (
      <div className="absolute inset-0 p-4 pt-20 pb-24">
        <div className="flex items-center justify-center h-full">
          <div className="w-full max-w-4xl aspect-video">
            <VideoTile
              isLocal={true}
              tracks={localTracks}
              isAudioEnabled={localTracks.audio?.enabled}
              isVideoEnabled={localTracks.video?.enabled}
            />
          </div>
        </div>
      </div>
    );
  }
});

VideoCallGrid.displayName = 'VideoCallGrid';

export default VideoCallGrid;