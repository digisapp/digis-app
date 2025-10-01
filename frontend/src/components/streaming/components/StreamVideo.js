/**
 * Stream video player component
 * @module components/StreamVideo
 */

import React, { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

/**
 * Video player for live streams
 */
const StreamVideo = memo(({
  streamKey,
  channel,
  isLive,
  isCreator,
  quality = 'auto',
  onError
}) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [videoStats, setVideoStats] = useState({
    bitrate: 0,
    fps: 0,
    resolution: '0x0'
  });
  
  const controlsTimeout = useRef(null);

  /**
   * Initialize video stream
   */
  useEffect(() => {
    if (!videoRef.current || !isLive) return;

    const initStream = async () => {
      try {
        if (isCreator) {
          // Creator sees their own local stream
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: quality === '1080p' ? 1920 : 
                     quality === '720p' ? 1280 : 
                     quality === '480p' ? 640 : undefined,
              height: quality === '1080p' ? 1080 : 
                      quality === '720p' ? 720 : 
                      quality === '480p' ? 480 : undefined,
              frameRate: 30
            },
            audio: true
          });
          
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsPlaying(true);
        } else {
          // Viewers connect to stream
          // This would typically use HLS or WebRTC
          const streamUrl = `${import.meta.env.VITE_STREAM_URL}/${channel}/index.m3u8`;
          
          // Check if HLS is supported
          if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            videoRef.current.src = streamUrl;
          } else {
            // Use HLS.js for browsers that don't support HLS natively
            // Would need to import and use HLS.js here
            console.log('HLS.js implementation needed');
          }
        }
      } catch (error) {
        console.error('Error initializing stream:', error);
        onError?.(error);
      }
    };

    initStream();

    return () => {
      // Cleanup
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [isLive, isCreator, channel, quality]);

  /**
   * Toggle play/pause
   */
  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  /**
   * Toggle mute
   */
  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  /**
   * Toggle fullscreen
   */
  const toggleFullscreen = async () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;

    try {
      if (!isFullscreen) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          await container.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  /**
   * Show controls temporarily
   */
  const handleMouseMove = () => {
    setShowControls(true);
    
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  return (
    <div 
      className="relative w-full h-full bg-black group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay={isLive}
        muted={isCreator} // Creators are muted by default to prevent echo
      />

      {/* Offline placeholder */}
      {!isLive && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <PlayIcon className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-white text-xl font-semibold mb-2">
              Stream Offline
            </h3>
            <p className="text-gray-400">
              {isCreator ? 'Click "Go Live" to start streaming' : 'Waiting for stream to start...'}
            </p>
          </div>
        </div>
      )}

      {/* Video controls overlay */}
      {isLive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showControls ? 1 : 0 }}
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4"
        >
          <div className="flex items-center justify-between">
            {/* Left controls */}
            <div className="flex items-center gap-2">
              {/* Play/Pause (viewers only) */}
              {!isCreator && (
                <button
                  onClick={togglePlay}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  {isPlaying ? (
                    <PauseIcon className="w-5 h-5 text-white" />
                  ) : (
                    <PlayIcon className="w-5 h-5 text-white" />
                  )}
                </button>
              )}

              {/* Volume */}
              <button
                onClick={toggleMute}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                {isMuted ? (
                  <SpeakerXMarkIcon className="w-5 h-5 text-white" />
                ) : (
                  <SpeakerWaveIcon className="w-5 h-5 text-white" />
                )}
              </button>

              {/* Live indicator */}
              <div className="px-3 py-1 bg-red-500 rounded-md flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white text-sm font-semibold">LIVE</span>
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {/* Quality selector */}
              <select
                value={quality}
                onChange={(e) => console.log('Quality:', e.target.value)}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm focus:outline-none"
              >
                <option value="auto">Auto</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
                <option value="360p">360p</option>
              </select>

              {/* Settings */}
              <button
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Cog6ToothIcon className="w-5 h-5 text-white" />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                {isFullscreen ? (
                  <ArrowsPointingInIcon className="w-5 h-5 text-white" />
                ) : (
                  <ArrowsPointingOutIcon className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Stream stats (debug/creator view) */}
          {isCreator && (
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-300">
              <span>Bitrate: {videoStats.bitrate} kbps</span>
              <span>FPS: {videoStats.fps}</span>
              <span>Resolution: {videoStats.resolution}</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
});

StreamVideo.displayName = 'StreamVideo';

export default StreamVideo;