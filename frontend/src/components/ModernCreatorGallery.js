import React, { useState, useRef, useEffect, memo } from 'react';
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { useInView } from 'react-intersection-observer';
import ModernCreatorCard from './ModernCreatorCard';
import { haptic, device } from '../utils/modernUI';

// Horizontal scroll gallery with snap points
const SnapScrollGallery = memo(({ creators, onCreatorSelect }) => {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Swipe handlers for mobile
  const handlers = useSwipeable({
    onSwipedLeft: () => scrollToIndex(activeIndex + 1),
    onSwipedRight: () => scrollToIndex(activeIndex - 1),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  });

  const scrollToIndex = (index) => {
    if (index < 0 || index >= creators.length) return;
    
    haptic.light();
    const element = scrollRef.current?.children[index];
    element?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    setActiveIndex(index);
  };

  // Update arrows visibility on scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    
    // Update active index based on scroll position
    const cardWidth = scrollRef.current.children[0]?.offsetWidth || 0;
    const gap = 16; // gap-4 = 1rem = 16px
    const newIndex = Math.round(scrollLeft / (cardWidth + gap));
    setActiveIndex(newIndex);
  };

  return (
    <div className="relative group">
      {/* Left Arrow */}
      <AnimatePresence>
        {showLeftArrow && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            onClick={() => scrollToIndex(activeIndex - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full glass-light shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Right Arrow */}
      <AnimatePresence>
        {showRightArrow && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onClick={() => scrollToIndex(activeIndex + 1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full glass-light shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Gallery */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        {...handlers}
        className="flex gap-4 p-4 overflow-x-auto scroll-snap-x scrollbar-hide will-change-scroll"
        style={{ scrollPaddingLeft: '1rem', scrollPaddingRight: '1rem' }}
      >
        {creators.map((creator, index) => (
          <motion.div
            key={creator.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="flex-none w-80 scroll-snap-center"
          >
            <ModernCreatorCard
              creator={creator}
              onJoinSession={(type) => onCreatorSelect(creator, type)}
            />
          </motion.div>
        ))}
      </div>

      {/* Indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {creators.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollToIndex(index)}
            className={`
              h-2 rounded-full transition-all duration-300
              ${index === activeIndex 
                ? 'w-8 bg-purple-500' 
                : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
              }
            `}
          />
        ))}
      </div>
    </div>
  );
});

// Grid view with filters
const FilterableGrid = memo(({ creators, filters, onFilterChange }) => {
  const [selectedFilters, setSelectedFilters] = useState({
    category: 'all',
    priceRange: 'all',
    availability: 'all',
  });

  const handleFilterChange = (filterType, value) => {
    haptic.light();
    const newFilters = { ...selectedFilters, [filterType]: value };
    setSelectedFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const filterOptions = {
    category: [
      { value: 'all', label: 'All Categories', icon: '🌟' },
      { value: 'art', label: 'Art & Design', icon: '🎨' },
      { value: 'music', label: 'Music', icon: '🎵' },
      { value: 'tech', label: 'Technology', icon: '💻' },
      { value: 'fitness', label: 'Fitness', icon: '💪' },
    ],
    priceRange: [
      { value: 'all', label: 'Any Price' },
      { value: 'low', label: 'Under $10/min' },
      { value: 'medium', label: '$10-20/min' },
      { value: 'high', label: '$20+/min' },
    ],
    availability: [
      { value: 'all', label: 'All' },
      { value: 'online', label: 'Online Now' },
      { value: 'live', label: 'Live Streaming' },
    ],
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 p-4 rounded-2xl glass-light dark:glass-dark">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(filterOptions).map(([filterType, options]) => (
            <div key={filterType}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
                {filterType.replace(/([A-Z])/g, ' $1').trim()}
              </label>
              <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                  <motion.button
                    key={option.value}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleFilterChange(filterType, option.value)}
                    className={`
                      px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200
                      ${selectedFilters[filterType] === option.value
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    {option.icon && <span className="mr-1">{option.icon}</span>}
                    {option.label}
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {creators.map((creator, index) => (
          <motion.div
            key={creator.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            layout
          >
            <ModernCreatorCard creator={creator} />
          </motion.div>
        ))}
      </div>
    </div>
  );
});

// Stack view for mobile (like dating apps)
const StackView = memo(({ creators }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitX, setExitX] = useState(0);

  const handlers = useSwipeable({
    onSwipedLeft: () => handleSwipe('left'),
    onSwipedRight: () => handleSwipe('right'),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  });

  const handleSwipe = (direction) => {
    haptic.medium();
    setExitX(direction === 'left' ? -300 : 300);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % creators.length);
      setExitX(0);
    }, 200);
  };

  return (
    <div className="relative h-[600px] flex items-center justify-center" {...handlers}>
      <AnimatePresence mode="popLayout">
        {creators.slice(currentIndex, currentIndex + 3).map((creator, index) => (
          <motion.div
            key={`${creator.id}-${currentIndex}`}
            initial={{ scale: 0, y: 50, opacity: 0 }}
            animate={{
              scale: 1 - index * 0.05,
              y: index * -10,
              opacity: 1,
              x: index === 0 ? exitX : 0,
              zIndex: creators.length - index,
            }}
            exit={{ x: exitX, opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            transition={{ type: "spring", damping: 20 }}
            drag={index === 0 ? "x" : false}
            dragConstraints={{ left: -100, right: 100 }}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = Math.abs(offset.x) * velocity.x;
              if (swipe < -10000) {
                handleSwipe('left');
              } else if (swipe > 10000) {
                handleSwipe('right');
              }
            }}
            className="absolute w-full max-w-sm"
            style={{ cursor: index === 0 ? 'grab' : 'auto' }}
          >
            <ModernCreatorCard creator={creator} />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="absolute bottom-8 flex gap-4">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSwipe('left')}
          className="p-4 rounded-full bg-red-500 text-white shadow-xl"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSwipe('right')}
          className="p-4 rounded-full bg-green-500 text-white shadow-xl"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
});

// Main gallery component with view modes
const ModernCreatorGallery = ({ creators = [], viewMode = 'grid' }) => {
  const [currentView, setCurrentView] = useState(viewMode);
  const [filteredCreators, setFilteredCreators] = useState(creators);

  const handleViewChange = (view) => {
    haptic.light();
    setCurrentView(view);
  };

  const handleFilterChange = (filters) => {
    // Apply filters logic here
    console.log('Filters applied:', filters);
    // For now, just use all creators
    setFilteredCreators(creators);
  };

  const viewModes = [
    { id: 'grid', label: 'Grid', icon: '⚏' },
    { id: 'carousel', label: 'Carousel', icon: '⚌' },
    { id: 'stack', label: 'Stack', icon: '▭' },
  ];

  return (
    <div className="space-y-6">
      {/* View mode selector */}
      <div className="flex justify-end gap-2">
        {viewModes.map((mode) => (
          <motion.button
            key={mode.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleViewChange(mode.id)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${currentView === mode.id
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }
            `}
          >
            <span className="mr-2">{mode.icon}</span>
            {mode.label}
          </motion.button>
        ))}
      </div>

      {/* Gallery views */}
      <AnimatePresence mode="wait">
        {currentView === 'grid' && (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <FilterableGrid
              creators={filteredCreators}
              onFilterChange={handleFilterChange}
            />
          </motion.div>
        )}
        
        {currentView === 'carousel' && (
          <motion.div
            key="carousel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SnapScrollGallery creators={filteredCreators} />
          </motion.div>
        )}
        
        {currentView === 'stack' && device.isMobile() && (
          <motion.div
            key="stack"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <StackView creators={filteredCreators} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(ModernCreatorGallery);