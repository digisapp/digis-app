import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClockIcon,
  BellIcon
} from '@heroicons/react/24/outline';

const ProfileBanner = ({
  creator,
  isLiveStreaming = false,
  liveStreamData = null,
  onStartVideoCall,
  onStartVoiceCall,
  onSendMessage,
  onScheduleSession,
  onFollowToggle,
  isFollowing = false,
  lastVOD = null,
  className = ''
}) => {
  const [nextStreamTime, setNextStreamTime] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [bannerImage, setBannerImage] = useState(creator?.banner_url);

  // Detect reduced motion preference
  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Update banner image when creator data changes
  useEffect(() => {
    if (creator?.banner_url) {
      setBannerImage(creator.banner_url);
    }
  }, [creator?.banner_url]);

  // Calculate countdown to next stream
  useEffect(() => {
    if (!creator?.next_stream_time) return;

    const calculateCountdown = () => {
      const now = new Date();
      const streamTime = new Date(creator.next_stream_time);
      const diff = streamTime - now;

      if (diff <= 0) {
        setCountdown('Starting soon...');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setCountdown(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m`);
      } else {
        setCountdown(`${minutes}m`);
      }
    };

    calculateCountdown();
    // Schedule next tick at the next minute boundary for efficiency
    const now = new Date();
    const msToNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
    const timeout = setTimeout(() => {
      calculateCountdown();
      const interval = setInterval(calculateCountdown, 60000);
      return () => clearInterval(interval);
    }, msToNextMinute);

    return () => clearTimeout(timeout);
  }, [creator?.next_stream_time]);

  // Fallback image logic
  const getBannerImage = () => {
    if (bannerImage) return bannerImage;
    if (lastVOD?.thumbnail) return lastVOD.thumbnail;
    // Default gradient fallback
    return null;
  };

  const backgroundImage = getBannerImage();

  return (
    <div className={`relative w-full ${className}`}>
      {/* Banner Container */}
      <div className="relative h-64 md:h-80 lg:h-96 overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600">
        {/* Background Image or Gradient */}
        {backgroundImage ? (
          <div className="absolute inset-0">
            <img
              src={backgroundImage}
              alt={`${creator?.username || 'Creator'} banner`}
              className="w-full h-full object-cover"
              width={1600}
              height={640}
              sizes="100vw"
              srcSet={backgroundImage ? `${backgroundImage}?w=800 800w, ${backgroundImage}?w=1200 1200w, ${backgroundImage}?w=1600 1600w` : undefined}
            />
            {/* Overlay gradient for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/90 via-pink-500/90 to-blue-500/90" />
        )}

        {/* Animated Background Effects - respect reduced motion */}
        {!prefersReducedMotion && (
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-20 left-10 w-72 h-72 bg-purple-400 rounded-full filter blur-3xl animate-pulse" />
            <div className="absolute bottom-10 right-20 w-96 h-96 bg-pink-400 rounded-full filter blur-3xl animate-pulse animation-delay-2000" />
            <div className="absolute top-40 right-40 w-64 h-64 bg-blue-400 rounded-full filter blur-3xl animate-pulse animation-delay-4000" />
          </div>
        )}

        {/* Content Overlay */}
        <div className="relative h-full flex flex-col justify-between p-4 md:p-6 lg:p-8 z-10">

          {/* Top Right - Next Stream Info */}
          {creator?.next_stream_time && !isLiveStreaming && (
            <div className="flex justify-end">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20"
              >
                <ClockIcon className="w-5 h-5 text-white" />
                <span className="text-white font-medium">
                  Next stream in {countdown}
                </span>
                <BellIcon className="w-5 h-5 text-white cursor-pointer hover:text-yellow-400 transition-colors" />
              </motion.div>
            </div>
          )}

          {/* Bottom Right - Creator Name */}
          <div className="flex items-end justify-end">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="px-4 py-2"
            >
              <h1 className="text-sm md:text-base lg:text-lg font-bold text-white">
                digis.cc/{creator?.username}
              </h1>
            </motion.div>
          </div>

        </div>
      </div>

      {/* Mobile-Responsive Design - Status Pills */}
      <div className="md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-gray-600 dark:text-gray-400">
              {creator?.followers_count || 0} followers
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {creator?.total_streams || 0} streams
            </span>
          </div>
          {creator?.next_stream_time && !isLiveStreaming && (
            <span className="text-purple-600 dark:text-purple-400 font-medium">
              Next: {countdown}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileBanner;