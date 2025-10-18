import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import {
  CameraIcon,
  PhotoIcon,
  VideoCameraIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  ArrowLeftIcon,
  SparklesIcon,
  UserCircleIcon,
  CheckBadgeIcon,
  IdentificationIcon
} from '@heroicons/react/24/outline';
import { HeartIcon, StarIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import CompCard from '../CompCard';

const DigitalsPage = () => {
  const { username } = useParams();
  const [creator, setCreator] = useState(null);
  const [digitals, setDigitals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDigital, setSelectedDigital] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [activeView, setActiveView] = useState('portfolio'); // portfolio or compcard

  useEffect(() => {
    fetchDigitals();
  }, [username]);

  const fetchDigitals = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/digitals/creator/${username}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch digitals');
      }

      const data = await response.json();
      setCreator(data.creator);
      setDigitals(data.digitals);
      setCategories([
        { id: 'all', name: 'All', count: data.digitals.length },
        ...data.categories.map(cat => ({
          ...cat,
          count: data.digitals.filter(d => d.category === cat.slug).length
        }))
      ]);
    } catch (error) {
      console.error('Error fetching digitals:', error);
      toast.error('Failed to load digitals');
    } finally {
      setLoading(false);
    }
  };

  const filteredDigitals = selectedCategory === 'all' 
    ? digitals 
    : digitals.filter(d => d.category === selectedCategory);

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setSelectedDigital(filteredDigitals[index]);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setSelectedDigital(null);
  };

  const navigateLightbox = (direction) => {
    const newIndex = direction === 'next' 
      ? (lightboxIndex + 1) % filteredDigitals.length
      : (lightboxIndex - 1 + filteredDigitals.length) % filteredDigitals.length;
    setLightboxIndex(newIndex);
    setSelectedDigital(filteredDigitals[newIndex]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading digitals...</p>
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <CameraIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Creator Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This creator's digitals page doesn't exist.
          </p>
          <Link
            to="/explore"
            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Explore Creators
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {creator.avatar ? (
                <img
                  src={creator.avatar}
                  alt={creator.displayName || creator.username}
                  className="w-16 h-16 rounded-full object-cover ring-4 ring-purple-100 dark:ring-purple-900"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                  {(creator.displayName || creator.username || 'U')[0].toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {creator.displayName || creator.username}'s Digitals
                  </h1>
                  <CheckBadgeIcon className="w-6 h-6 text-blue-500" />
                </div>
                <p className="text-gray-600 dark:text-gray-400">@{creator.username}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Main View Toggle */}
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-1 flex">
                <button
                  onClick={() => setActiveView('portfolio')}
                  className={`px-3 py-1.5 rounded transition-all flex items-center gap-2 ${
                    activeView === 'portfolio'
                      ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <PhotoIcon className="w-4 h-4" />
                  Portfolio
                </button>
                <button
                  onClick={() => setActiveView('compcard')}
                  className={`px-3 py-1.5 rounded transition-all flex items-center gap-2 ${
                    activeView === 'compcard'
                      ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <IdentificationIcon className="w-4 h-4" />
                  Comp Card
                </button>
              </div>
              
              {/* Grid/List Toggle (only for portfolio view) */}
              {activeView === 'portfolio' && (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-1 flex">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-2 py-1.5 rounded transition-all text-sm ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-2 py-1.5 rounded transition-all text-sm ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    List
                  </button>
                </div>
              )}
              
              <Link
                to={`/connect?creator=${creator.username}`}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl"
              >
                Connect
              </Link>
            </div>
          </div>

          {/* Category Filter */}
          {categories.length > 1 && (
            <div className="flex gap-2 mt-6 overflow-x-auto pb-2">
              {categories.map((cat) => (
                <motion.button
                  key={cat.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {cat.name}
                  {cat.count > 0 && (
                    <span className="ml-2 text-xs opacity-70">({cat.count})</span>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeView === 'compcard' ? (
          /* Comp Card View */
          <CompCard 
            user={creator}
            digitals={digitals}
            isEditable={false}
          />
        ) : filteredDigitals.length === 0 ? (
          <div className="text-center py-20">
            <CameraIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              No digitals yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {selectedCategory === 'all' 
                ? 'This creator hasn\'t uploaded any digitals yet.'
                : `No digitals in this category.`}
            </p>
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6'
              : 'space-y-4'
          }>
            {filteredDigitals.map((digital, index) => (
              <motion.div
                key={digital.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={
                  viewMode === 'grid'
                    ? 'group cursor-pointer'
                    : 'bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-shadow cursor-pointer'
                }
                onClick={() => openLightbox(index)}
              >
                {viewMode === 'grid' ? (
                  /* Grid View */
                  <div className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
                    {digital.file_type === 'video' ? (
                      <>
                        <img
                          src={digital.thumbnail_url || '/video-placeholder.jpg'}
                          alt={digital.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <VideoCameraIcon className="w-8 h-8 text-white" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <img
                        src={digital.file_url}
                        alt={digital.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    )}
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="font-semibold text-lg mb-1">{digital.title}</h3>
                        {digital.description && (
                          <p className="text-sm opacity-90 line-clamp-2">{digital.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Icons */}
                    <div className="absolute top-3 right-3 flex gap-2">
                      {digital.is_featured && (
                        <div className="p-1.5 bg-yellow-500 rounded-lg">
                          <StarIcon className="w-4 h-4 text-white" />
                        </div>
                      )}
                      {digital.allow_download && (
                        <div className="p-1.5 bg-green-500 rounded-lg">
                          <ArrowDownTrayIcon className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* List View */
                  <div className="flex gap-4 p-4">
                    <div className="relative w-32 h-40 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      {digital.file_type === 'video' ? (
                        <>
                          <img
                            src={digital.thumbnail_url || '/video-placeholder.jpg'}
                            alt={digital.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <VideoCameraIcon className="w-8 h-8 text-white drop-shadow-lg" />
                          </div>
                        </>
                      ) : (
                        <img
                          src={digital.file_url}
                          alt={digital.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {digital.title}
                      </h3>
                      {digital.description && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                          {digital.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <EyeIcon className="w-4 h-4" />
                          {digital.view_count || 0} views
                        </span>
                        {digital.tags && digital.tags.length > 0 && (
                          <div className="flex gap-2">
                            {digital.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedDigital && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
            onClick={closeLightbox}
          >
            {/* Close Button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 p-2 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors z-10"
            >
              <XMarkIcon className="w-6 h-6 text-white" />
            </button>

            {/* Navigation */}
            {filteredDigitals.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateLightbox('prev');
                  }}
                  className="absolute left-4 p-2 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors"
                >
                  <ChevronLeftIcon className="w-6 h-6 text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateLightbox('next');
                  }}
                  className="absolute right-4 p-2 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors"
                >
                  <ChevronRightIcon className="w-6 h-6 text-white" />
                </button>
              </>
            )}

            {/* Content */}
            <div 
              className="max-w-6xl max-h-[90vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedDigital.file_type === 'video' ? (
                <video
                  src={selectedDigital.file_url}
                  controls
                  autoPlay
                  className="max-w-full max-h-full rounded-lg"
                />
              ) : (
                <img
                  src={selectedDigital.file_url}
                  alt={selectedDigital.title}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              )}
            </div>

            {/* Info Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
              <div className="max-w-4xl mx-auto text-white">
                <h3 className="text-2xl font-bold mb-2">{selectedDigital.title}</h3>
                {selectedDigital.description && (
                  <p className="text-gray-300 mb-4">{selectedDigital.description}</p>
                )}
                <div className="flex items-center gap-6 text-sm text-gray-400">
                  <span className="flex items-center gap-2">
                    <EyeIcon className="w-5 h-5" />
                    {selectedDigital.view_count || 0} views
                  </span>
                  {selectedDigital.allow_download && (
                    <button className="flex items-center gap-2 hover:text-white transition-colors">
                      <ArrowDownTrayIcon className="w-5 h-5" />
                      Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DigitalsPage;