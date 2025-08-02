import React, { useState, useTransition, useDeferredValue, useId } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

// Modern glass-morphism card with micro-interactions
export const ModernCreatorCard: React.FC<{ creator: any }> = ({ creator }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const id = useId();
  
  // Intersection observer for lazy loading
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
    rootMargin: '50px'
  });
  
  // Haptic feedback for mobile
  const triggerHaptic = (intensity: number = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(intensity);
    }
  };
  
  // Optimistic like with haptic feedback
  const handleLike = () => {
    triggerHaptic(20);
    setIsLiked(!isLiked);
    
    // Non-blocking update
    startTransition(() => {
      // API call would go here
    });
  };
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="relative group"
    >
      {/* Glass-morphism card */}
      <div className="
        relative overflow-hidden rounded-2xl
        backdrop-blur-xl bg-white/70 dark:bg-gray-900/70
        border border-white/20 dark:border-gray-700/20
        shadow-xl hover:shadow-2xl
        transition-all duration-300
        hover:scale-[1.02] active:scale-[0.98]
        will-change-transform
      ">
        {/* Gradient border effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Content */}
        <div className="relative z-10 p-6">
          {/* Progressive image with blur-up */}
          <div className="relative mb-4 overflow-hidden rounded-lg">
            <img
              src={`${creator.avatar}?w=50&blur=10`}
              className="absolute inset-0 w-full h-full object-cover filter blur-xl scale-110"
              aria-hidden="true"
            />
            <img
              src={creator.avatar}
              alt={creator.name}
              className="relative w-full h-48 object-cover transition-all duration-700"
              loading="lazy"
            />
          </div>
          
          {/* Interactive elements */}
          <h3 className="text-xl font-bold mb-2">{creator.name}</h3>
          
          {/* Like button with animation */}
          <AnimatePresence mode="wait">
            <motion.button
              key={isLiked ? 'liked' : 'unliked'}
              onClick={handleLike}
              className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <motion.svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill={isLiked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                className={isLiked ? 'text-red-500' : 'text-gray-600'}
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </motion.svg>
              
              {/* Like animation particles */}
              {isLiked && (
                <>
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={`${id}-particle-${i}`}
                      className="absolute w-2 h-2 bg-red-500 rounded-full"
                      initial={{ scale: 0, x: 0, y: 0 }}
                      animate={{
                        scale: [0, 1, 0],
                        x: Math.cos(i * 60 * Math.PI / 180) * 30,
                        y: Math.sin(i * 60 * Math.PI / 180) * 30,
                      }}
                      transition={{ duration: 0.6 }}
                    />
                  ))}
                </>
              )}
            </motion.button>
          </AnimatePresence>
          
          {/* Skeleton loading state for stats */}
          {isPending ? (
            <div className="space-y-2 mt-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              <p>{creator.followers} followers</p>
              <p>{creator.rate} tokens/min</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Modern search with deferred value
export const ModernSearch: React.FC = () => {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [isPending, startTransition] = useTransition();
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Urgent update for input
    setSearch(value);
    
    // Non-urgent update for results
    startTransition(() => {
      // Search logic here
    });
  };
  
  return (
    <div className="relative">
      <input
        type="search"
        value={search}
        onChange={handleSearch}
        placeholder="Search creators..."
        className="
          w-full px-6 py-3 rounded-full
          bg-white/80 dark:bg-gray-900/80
          backdrop-blur-xl
          border border-gray-200/50 dark:border-gray-700/50
          focus:outline-none focus:ring-2 focus:ring-purple-500/50
          placeholder:text-gray-500
          transition-all duration-200
        "
      />
      
      {/* Loading indicator */}
      {isPending && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      
      {/* Results would use deferredSearch */}
      {deferredSearch && (
        <div className="absolute top-full mt-2 w-full">
          {/* Search results */}
        </div>
      )}
    </div>
  );
};

// Parallax scroll effect
export const ParallaxHero: React.FC = () => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  
  return (
    <div className="relative h-screen overflow-hidden">
      <motion.div
        style={{ y }}
        className="absolute inset-0"
      >
        <img
          src="/hero-bg.jpg"
          alt="Hero background"
          className="w-full h-full object-cover"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black" />
      </motion.div>
      
      <motion.div
        style={{ opacity }}
        className="relative z-10 flex items-center justify-center h-full"
      >
        <div className="text-center text-white">
          <h1 className="text-6xl font-bold mb-4">Welcome to Digis</h1>
          <p className="text-xl">Connect with your favorite creators</p>
        </div>
      </motion.div>
    </div>
  );
};

// Snap scroll gallery
export const SnapScrollGallery: React.FC<{ items: any[] }> = ({ items }) => {
  return (
    <div className="
      flex overflow-x-auto snap-x snap-mandatory
      scrollbar-hide overscroll-contain
      -webkit-overflow-scrolling: touch
      gap-4 p-4
    ">
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          className="
            flex-none w-80 snap-start snap-always
            scroll-ml-4 first:ml-0 last:mr-4
          "
        >
          <ModernCreatorCard creator={item} />
        </motion.div>
      ))}
    </div>
  );
};

// CSS custom properties for dynamic theming
export const cssVariables = `
  :root {
    --color-primary: 124 58 237;
    --color-secondary: 236 72 153;
    --blur-amount: 16px;
    --glass-opacity: 0.8;
    --animation-duration: 200ms;
  }
  
  .dark {
    --glass-opacity: 0.6;
    --blur-amount: 20px;
  }
  
  /* Modern focus styles */
  *:focus-visible {
    outline: 2px solid rgb(var(--color-primary) / 0.5);
    outline-offset: 2px;
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;