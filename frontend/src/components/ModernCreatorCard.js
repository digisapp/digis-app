// Modern CreatorCard with React 18 features and next-level UI
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useState, useTransition, useDeferredValue, useId, useCallback, memo } from 'react';
import { useInView } from 'react-intersection-observer';
import { haptic, playSound, confetti } from '../utils/modernUI';
import { useAppStore } from '../stores/useAppStore';

// Progressive Image Component
const ProgressiveImage = memo(({ src, alt, fallback }) => {
  const [imageSrc, setImageSrc] = useState(`${src}?w=50&blur=10`);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: '50px'
  });

  // Load high quality image when in view
  if (inView && !imageLoaded) {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setImageSrc(src);
      setImageLoaded(true);
    };
  }

  return (
    <div ref={ref} className="relative w-full h-full overflow-hidden">
      <img
        src={imageSrc}
        alt={alt}
        className={`
          w-full h-full object-cover transition-all duration-700
          ${!imageLoaded ? 'filter blur-xl scale-110' : ''}
        `}
      />
      {!imageLoaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-purple-400/20 to-pink-400/20" />
      )}
    </div>
  );
});

const ModernCreatorCard = ({ creator, onJoinSession, disabled, showTipButton, onTip, onMessage }) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const id = useId();
  
  // Motion values for tilt effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [30, -30]);
  const rotateY = useTransform(x, [-100, 100], [-30, 30]);
  
  const { incrementTokens } = useAppStore();

  const handleServiceClick = useCallback((serviceType) => {
    if (!disabled && onJoinSession) {
      haptic.medium();
      playSound('click');
      onJoinSession(serviceType);
    }
  }, [disabled, onJoinSession]);

  const handleFollow = useCallback(() => {
    haptic.light();
    setIsFollowing(!isFollowing);
    
    startTransition(() => {
      // API call would go here
      if (!isFollowing) {
        playSound('success');
      }
    });
  }, [isFollowing]);

  const handleLike = useCallback(() => {
    haptic.medium();
    setIsLiked(!isLiked);
    if (!isLiked) {
      playSound('like');
      confetti({ y: 0.7, particleCount: 50 });
    }
  }, [isLiked]);

  const handleTipClick = useCallback((e) => {
    e.stopPropagation();
    haptic.heavy();
    playSound('coin');
    if (onTip) {
      onTip(5);
    }
  }, [onTip]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) / 5);
    y.set((e.clientY - centerY) / 5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.05 * (creator.id || 0) }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
      }}
      className="relative will-change-transform"
    >
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`
          relative overflow-hidden rounded-3xl p-6
          glass-light dark:glass-dark
          shadow-elegant hover:shadow-2xl
          transition-all duration-300
          cursor-pointer
          group
        `}
      >
        {/* Gradient overlay on hover */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 pointer-events-none"
        />

        {/* Live Status Badge with Animation */}
        <AnimatePresence>
          {creator.isLive && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute top-4 right-4 z-10"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping" />
                <div className="relative bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile Picture with Progressive Loading */}
        <div className="relative w-32 h-32 mx-auto mb-4">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="relative w-full h-full rounded-full overflow-hidden glass-colored shadow-xl"
          >
            {creator.profile_pic_url ? (
              <ProgressiveImage
                src={creator.profile_pic_url}
                alt={creator.username}
                fallback={(creator.username || '?')[0]?.toUpperCase()}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-4xl font-bold">
                {(creator.username || '?')[0]?.toUpperCase()}
              </div>
            )}
          </motion.div>
          
          {/* Online indicator with pulse */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute bottom-1 right-1"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-green-400 rounded-full animate-ping" />
              <div className="relative w-6 h-6 bg-green-500 rounded-full border-3 border-white shadow-lg" />
            </div>
          </motion.div>
        </div>

        {/* Creator Info */}
        <div className="text-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1">
            @{creator.username}
          </h3>
          
          {creator.bio && (
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
              {creator.bio}
            </p>
          )}

          {/* Stats with Icons */}
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>{creator.followers || 0} followers</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>{creator.totalSessions || 0} sessions</span>
            </div>
          </div>
        </div>

        {/* Service Grid with Modern Style */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { type: 'video', icon: '📹', label: 'Video Call', price: creator.videoPrice || 8, gradient: 'from-purple-500 to-pink-500' },
            { type: 'voice', icon: '📱', label: 'Voice Call', price: creator.voicePrice || 6, gradient: 'from-blue-500 to-cyan-500' },
            { type: 'stream', icon: '📡', label: 'Stream', price: creator.streamPrice || 5, gradient: 'from-orange-500 to-red-500' },
            { type: 'message', icon: '💬', label: 'Message', price: creator.messagePrice || 2, gradient: 'from-green-500 to-teal-500' },
          ].map((service) => (
            <motion.button
              key={service.type}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleServiceClick(service.type)}
              disabled={disabled}
              className={`
                relative overflow-hidden rounded-xl p-3
                bg-gradient-to-br ${service.gradient}
                text-white font-medium
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                group
              `}
            >
              <div className="relative z-10">
                <div className="text-2xl mb-1">{service.icon}</div>
                <div className="text-xs">{service.label}</div>
                <div className="text-sm font-bold">${service.price}/min</div>
              </div>
              <motion.div
                className="absolute inset-0 bg-white/20"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.5 }}
              />
            </motion.button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleFollow}
            className={`
              px-4 py-2 rounded-full text-sm font-medium
              transition-all duration-200
              ${isFollowing 
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300' 
                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
              }
            `}
          >
            {isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              isFollowing ? 'Following' : 'Follow'
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLike}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <AnimatePresence mode="wait">
              <motion.svg
                key={isLiked ? 'liked' : 'unliked'}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className={`w-5 h-5 ${isLiked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}
                fill={isLiked ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </motion.svg>
            </AnimatePresence>
          </motion.button>

          {showTipButton && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleTipClick}
              disabled={disabled}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              💰 Tip
            </motion.button>
          )}
        </div>

        {/* Like animation particles */}
        <AnimatePresence>
          {isLiked && (
            <>
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={`${id}-heart-${i}`}
                  className="absolute w-4 h-4 pointer-events-none"
                  style={{
                    left: '50%',
                    top: '50%',
                  }}
                  initial={{ scale: 0, x: 0, y: 0 }}
                  animate={{
                    scale: [0, 1, 0],
                    x: Math.cos(i * 60 * Math.PI / 180) * 60,
                    y: Math.sin(i * 60 * Math.PI / 180) * 60,
                  }}
                  exit={{ scale: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  ❤️
                </motion.div>
              ))}
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default memo(ModernCreatorCard);