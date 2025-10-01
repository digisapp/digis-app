import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
  PauseIcon,
  PhotoIcon,
  VideoCameraIcon,
  ShoppingBagIcon,
  PencilSquareIcon,
  TrashIcon,
  SparklesIcon,
  EyeIcon,
  HeartIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

const EnhancedRotatingGallery = ({
  items = [],
  type = 'photo', // 'photo', 'video', or 'shop'
  title = 'Gallery',
  onAddItem,
  onEditItem,
  onDeleteItem,
  onViewAll,
  autoRotateInterval = 4000,
  maxItemsToShow = 12
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const intervalRef = useRef(null);

  // Auto-rotation effect
  useEffect(() => {
    if (isAutoRotating && items.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length);
      }, autoRotateInterval);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAutoRotating, items.length, autoRotateInterval]);

  const handlePrevious = () => {
    setIsAutoRotating(false);
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = () => {
    setIsAutoRotating(false);
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const handleDotClick = (index) => {
    setIsAutoRotating(false);
    setCurrentIndex(index);
  };

  const getIcon = () => {
    switch (type) {
      case 'video':
        return <VideoCameraIcon className="w-16 h-16 text-gray-300" />;
      case 'shop':
        return <ShoppingBagIcon className="w-16 h-16 text-gray-300" />;
      default:
        return <PhotoIcon className="w-16 h-16 text-gray-300" />;
    }
  };

  const getEmptyMessage = () => {
    switch (type) {
      case 'video':
        return 'No videos yet';
      case 'shop':
        return 'No products yet';
      default:
        return 'No photos yet';
    }
  };

  const getAddButtonText = () => {
    switch (type) {
      case 'video':
        return 'Add Videos';
      case 'shop':
        return 'Add Product';
      default:
        return 'Add Photos';
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                {getIcon()}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
            </div>
            {onAddItem && (
              <button
                onClick={onAddItem}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-200 flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                {getAddButtonText()}
              </button>
            )}
          </div>
          
          <div className="flex flex-col items-center justify-center py-16">
            {getIcon()}
            <p className="mt-4 text-gray-500 dark:text-gray-400">{getEmptyMessage()}</p>
          </div>
        </div>
      </div>
    );
  }

  const visibleItems = items.slice(0, maxItemsToShow);
  const itemsPerView = Math.min(4, visibleItems.length);
  const currentItem = visibleItems[currentIndex];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
              {items.length} items
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAutoRotating(!isAutoRotating)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={isAutoRotating ? 'Pause rotation' : 'Start rotation'}
            >
              {isAutoRotating ? (
                <PauseIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <PlayIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
            {onAddItem && (
              <button
                onClick={onAddItem}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-200 flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                {getAddButtonText()}
              </button>
            )}
          </div>
        </div>

        {/* Featured Item Display */}
        <div className="relative mb-6">
          <div className="relative aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-xl overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
              >
                {type === 'video' ? (
                  <>
                    <img
                      src={currentItem?.thumbnail_url || '/video-placeholder.jpg'}
                      alt={currentItem?.title || 'Video'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-20 h-20 bg-black/70 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <PlayIcon className="w-10 h-10 text-white ml-1" />
                      </div>
                    </div>
                  </>
                ) : (
                  <img
                    src={currentItem?.url || currentItem?.image_url || currentItem?.thumbnail_url || '/placeholder.jpg'}
                    alt={currentItem?.title || currentItem?.name || 'Item'}
                    className="w-full h-full object-cover"
                  />
                )}
                
                {/* Overlay Info */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                  <h4 className="text-white text-xl font-bold mb-2">
                    {currentItem?.title || currentItem?.name || 'Untitled'}
                  </h4>
                  {type === 'shop' && currentItem?.price && (
                    <p className="text-white text-lg font-semibold">${currentItem.price}</p>
                  )}
                  {type === 'video' && currentItem?.duration && (
                    <p className="text-white/80 text-sm">{currentItem.duration}</p>
                  )}
                  {currentItem?.is_premium && (
                    <span className="inline-block mt-2 px-3 py-1 bg-purple-600 text-white text-xs rounded-full">
                      Premium
                    </span>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Arrows */}
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-all duration-200"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-all duration-200"
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>

            {/* Edit/Delete Buttons */}
            <div className="absolute top-4 right-4 flex gap-2">
              {onEditItem && (
                <button
                  onClick={() => onEditItem(currentItem)}
                  className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-all duration-200"
                >
                  <PencilSquareIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
              )}
              {onDeleteItem && (
                <button
                  onClick={() => onDeleteItem(currentItem)}
                  className="p-2 bg-red-500/90 rounded-lg shadow-lg hover:bg-red-500 transition-all duration-200"
                >
                  <TrashIcon className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-2 mt-4">
            {visibleItems.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-8 h-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full'
                    : 'w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full hover:bg-gray-400 dark:hover:bg-gray-500'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Thumbnail Grid */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
          {visibleItems.map((item, index) => (
            <motion.div
              key={item.id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer group ${
                index === currentIndex ? 'ring-2 ring-purple-500' : ''
              }`}
              onClick={() => {
                setCurrentIndex(index);
                setIsAutoRotating(false);
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {type === 'video' ? (
                <>
                  <img
                    src={item.thumbnail_url || '/video-placeholder.jpg'}
                    alt={item.title || 'Video'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-black/70 rounded-full flex items-center justify-center">
                      <PlayIcon className="w-4 h-4 text-white ml-0.5" />
                    </div>
                  </div>
                </>
              ) : (
                <img
                  src={item.url || item.image_url || item.thumbnail_url || '/placeholder.jpg'}
                  alt={item.title || item.name || 'Item'}
                  className="w-full h-full object-cover"
                />
              )}
              
              {/* Hover Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: hoveredIndex === index ? 1 : 0 }}
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end p-2"
              >
                <div className="text-white">
                  <p className="text-xs font-medium truncate">
                    {item.title || item.name || 'Untitled'}
                  </p>
                  {type === 'shop' && item.price && (
                    <p className="text-xs">${item.price}</p>
                  )}
                </div>
              </motion.div>

              {item.is_premium && (
                <div className="absolute top-1 right-1">
                  <StarIcon className="w-4 h-4 text-yellow-400 drop-shadow-lg" />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* View All Button */}
        {items.length > maxItemsToShow && onViewAll && (
          <div className="mt-6 text-center">
            <button
              onClick={onViewAll}
              className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium"
            >
              View All {items.length} Items
            </button>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="px-6 pb-6">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-2">
                <EyeIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {Math.floor(Math.random() * 1000) + 500}
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Views</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2">
                <HeartIcon className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {Math.floor(Math.random() * 500) + 100}
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Likes</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2">
                <StarIcon className="w-4 h-4 text-yellow-500" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {items.filter(item => item.is_premium).length}
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Premium</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedRotatingGallery;