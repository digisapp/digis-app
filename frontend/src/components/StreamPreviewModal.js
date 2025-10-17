import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  UserGroupIcon,
  SparklesIcon,
  ArrowsPointingOutIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  EyeIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const StreamPreviewModal = ({
  isOpen,
  onClose,
  stream,
  user,
  onFollow,
  onSubscribe,
  onViewFullStream,
  onLike,
  isFollowing = false,
  isSubscribed = false,
  isLiked = false
}) => {
  // ✅ Early return BEFORE hooks (fixes React error #310)
  if (!stream) return null;

  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(stream.viewers || 0); // Now safe - stream guaranteed to exist
  const videoRef = useRef(null);

  // Simulate viewer count updates
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setViewerCount(prev => {
        const change = Math.floor(Math.random() * 10) - 5;
        return Math.max(0, prev + change);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Handle video loading
  useEffect(() => {
    if (videoRef.current && isOpen) {
      videoRef.current.play().catch(err => {
        console.log('Auto-play prevented:', err);
      });
    }
  }, [isOpen]);

  const handleFollow = async () => {
    if (!user) {
      toast.error('Please sign in to follow creators');
      return;
    }
    onFollow && onFollow(stream.creatorId);
  };

  const handleSubscribe = async () => {
    if (!user) {
      toast.error('Please sign in to subscribe');
      return;
    }
    onSubscribe && onSubscribe(stream.creatorId);
  };

  const handleViewFullStream = () => {
    onViewFullStream && onViewFullStream(stream);
    onClose();
  };

  const formatViewers = (count) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
            className="bg-gray-900 rounded-2xl overflow-hidden max-w-6xl w-full max-h-[90vh] flex flex-col lg:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Video Section */}
            <div className="relative flex-1 bg-black">
              <div className="relative aspect-video lg:aspect-auto lg:h-full">
                {/* Video Player */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  src={stream.streamUrl || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'}
                  muted={isMuted}
                  autoPlay
                  playsInline
                  onLoadedData={() => setIsLoading(false)}
                />

                {/* Loading State */}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {/* Stream Overlay Controls */}
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 via-black/30 to-transparent">
                  <div className="flex items-start justify-between">
                    {/* Live Badge and Viewers */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-lg">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        <span className="text-white text-sm font-bold">LIVE</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-lg">
                        <EyeIcon className="w-4 h-4 text-white" />
                        <span className="text-white text-sm font-medium">{formatViewers(viewerCount)}</span>
                      </div>
                    </div>

                    {/* Close Button */}
                    <button
                      onClick={onClose}
                      className="p-2 bg-black/50 backdrop-blur-sm rounded-lg hover:bg-black/70 transition-colors"
                    >
                      <XMarkIcon className="w-6 h-6 text-white" />
                    </button>
                  </div>
                </div>

                {/* Bottom Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                  <div className="flex items-center justify-between">
                    {/* Stream Title */}
                    <div className="flex-1">
                      <h3 className="text-white font-bold text-lg drop-shadow-lg">
                        {stream.title}
                      </h3>
                      <p className="text-white/80 text-sm drop-shadow">
                        {stream.category} • Started {new Date(stream.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>

                    {/* Audio Control */}
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="p-2 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition-colors"
                    >
                      {isMuted ? (
                        <SpeakerXMarkIcon className="w-5 h-5 text-white" />
                      ) : (
                        <SpeakerWaveIcon className="w-5 h-5 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div className="w-full lg:w-96 bg-gray-900 p-6 flex flex-col">
              {/* Creator Info */}
              <div className="flex items-start gap-4 mb-6">
                <img
                  src={stream.creatorAvatar || `https://ui-avatars.com/api/?name=${stream.creatorName}&background=gradient`}
                  alt={stream.creatorName}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-purple-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-white font-bold text-lg">{stream.creatorName}</h2>
                    {stream.isVerified && (
                      <CheckCircleIcon className="w-5 h-5 text-purple-500" />
                    )}
                  </div>
                  <p className="text-gray-400 text-sm">@{stream.creatorUsername || stream.creatorName.toLowerCase().replace(/\s/g, '')}</p>
                  <p className="text-gray-500 text-xs mt-1">{stream.followerCount || '10.5K'} followers</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 mb-6">
                {/* Follow Button */}
                <button
                  onClick={handleFollow}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    isFollowing
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-white text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <UserGroupIcon className="w-5 h-5" />
                  {isFollowing ? 'Following' : 'Follow'}
                </button>

                {/* Subscribe Button */}
                <button
                  onClick={handleSubscribe}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    isSubscribed
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white opacity-70'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                  }`}
                >
                  <SparklesIcon className="w-5 h-5" />
                  {isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>

                {/* View Full Stream Button */}
                <button
                  onClick={handleViewFullStream}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  <ArrowsPointingOutIcon className="w-5 h-5" />
                  View Full Stream
                </button>
              </div>

              {/* Stream Stats */}
              <div className="flex items-center justify-around py-4 border-t border-gray-800">
                <button
                  onClick={() => onLike && onLike(stream.id)}
                  className="flex flex-col items-center gap-1 hover:text-purple-400 transition-colors"
                >
                  {isLiked ? (
                    <HeartSolid className="w-6 h-6 text-red-500" />
                  ) : (
                    <HeartIcon className="w-6 h-6 text-gray-400" />
                  )}
                  <span className="text-xs text-gray-400">{stream.likes || '2.3K'}</span>
                </button>

                <div className="flex flex-col items-center gap-1">
                  <ChatBubbleLeftRightIcon className="w-6 h-6 text-gray-400" />
                  <span className="text-xs text-gray-400">{stream.messages || '156'}</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <EyeIcon className="w-6 h-6 text-gray-400" />
                  <span className="text-xs text-gray-400">{formatViewers(viewerCount)}</span>
                </div>
              </div>

              {/* Stream Description */}
              <div className="mt-auto pt-4 border-t border-gray-800">
                <h4 className="text-white font-medium mb-2">About this stream</h4>
                <p className="text-gray-400 text-sm line-clamp-3">
                  {stream.description || `Join ${stream.creatorName} for an exciting live stream! Interact, chat, and enjoy exclusive content.`}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StreamPreviewModal;