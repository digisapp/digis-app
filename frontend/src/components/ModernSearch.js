import React, { useState, useDeferredValue, useTransition, useId, memo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Command } from 'cmdk';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { haptic, playSound } from '../utils/modernUI';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/useAppStore';

// AI-powered search suggestions
const useSearchSuggestions = (query) => {
  const [debouncedQuery] = useDebounce(query, 300);
  
  return useQuery({
    queryKey: ['searchSuggestions', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      
      // Simulate AI suggestions - replace with actual API
      const suggestions = [
        { type: 'creator', text: `Creators matching "${debouncedQuery}"`, icon: '👤' },
        { type: 'skill', text: `Skills: ${debouncedQuery}`, icon: '🎯' },
        { type: 'content', text: `Content about ${debouncedQuery}`, icon: '📹' },
        { type: 'trending', text: `Trending: #${debouncedQuery}`, icon: '🔥' },
      ];
      
      return suggestions;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60000, // Cache for 1 minute
  });
};

// Search result item with animations
const SearchResultItem = memo(({ result, index, onSelect }) => {
  const handleClick = () => {
    haptic.light();
    playSound('click');
    onSelect(result);
  };

  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ x: 4 }}
      onClick={handleClick}
      className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left group"
    >
      {/* Avatar/Icon */}
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold overflow-hidden">
          {result.avatar ? (
            <img src={result.avatar} alt={result.name} className="w-full h-full object-cover" />
          ) : (
            result.icon || result.name?.[0]?.toUpperCase()
          )}
        </div>
        {result.isLive && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 dark:text-white truncate">
          {result.name}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {result.description}
        </p>
      </div>

      {/* Action */}
      <motion.div
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </motion.div>
    </motion.button>
  );
});

// Modern search component
const ModernSearch = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const deferredQuery = useDeferredValue(query);
  const [isPending, startTransition] = useTransition();
  const navigate = useNavigate();
  const { setViewingCreator } = useAppStore();
  const inputRef = useRef(null);
  const id = useId();

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search categories
  const categories = [
    { id: 'all', label: 'All', icon: '🔍' },
    { id: 'creators', label: 'Creators', icon: '👥' },
    { id: 'live', label: 'Live Now', icon: '🔴' },
    { id: 'skills', label: 'Skills', icon: '💡' },
    { id: 'trending', label: 'Trending', icon: '🔥' },
  ];

  // Mock search results - replace with real API
  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: ['search', deferredQuery, selectedCategory],
    queryFn: async () => {
      if (!deferredQuery) return [];
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock results
      return [
        {
          id: 1,
          type: 'creator',
          name: 'Sarah Johnson',
          description: 'Digital Artist & Designer',
          avatar: null,
          isLive: true,
          username: 'sarahjohnson',
          rate: 10,
        },
        {
          id: 2,
          type: 'creator',
          name: 'Mike Chen',
          description: 'Music Producer & DJ',
          avatar: null,
          isLive: false,
          username: 'mikechen',
          rate: 8,
        },
        {
          id: 3,
          type: 'skill',
          name: 'Web Development',
          description: '125 creators available',
          icon: '💻',
        },
      ].filter(result => 
        selectedCategory === 'all' || 
        (selectedCategory === 'live' && result.isLive) ||
        result.type === selectedCategory.slice(0, -1)
      );
    },
    enabled: deferredQuery.length > 0,
  });

  const { data: suggestions = [] } = useSearchSuggestions(deferredQuery);

  const handleSearch = (value) => {
    startTransition(() => {
      setQuery(value);
    });
  };

  const handleResultSelect = (result) => {
    haptic.medium();
    
    if (result.type === 'creator') {
      setViewingCreator(result);
      navigate(`/${result.username}`);
    } else if (result.type === 'skill') {
      navigate(`/explore?skill=${result.name}`);
    }
    
    onClose();
  };

  const handleCategoryChange = (categoryId) => {
    haptic.light();
    setSelectedCategory(categoryId);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ type: "spring", damping: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl mx-auto mt-20 rounded-2xl glass-light dark:glass-dark shadow-2xl overflow-hidden"
        >
          {/* Search header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search creators, skills, or content..."
                className="w-full pl-12 pr-12 py-4 bg-transparent text-lg focus:outline-none placeholder-gray-400"
              />
              
              {query && (
                <motion.button
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              )}
              
              {isPending && (
                <div className="absolute right-12 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide">
              {categories.map((category) => (
                <motion.button
                  key={category.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCategoryChange(category.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                    transition-all duration-200 whitespace-nowrap
                    ${selectedCategory === category.id
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <span>{category.icon}</span>
                  {category.label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Search results */}
          <div className="max-h-[60vh] overflow-y-auto scrollbar-hide">
            {!query ? (
              // Recent searches / suggestions
              <div className="p-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                  Trending Searches
                </h3>
                <div className="space-y-2">
                  {['Digital Art', 'Music Production', 'Fitness Coach', 'Language Learning'].map((trend, index) => (
                    <motion.button
                      key={trend}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setQuery(trend)}
                      className="flex items-center gap-3 p-3 w-full rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <span className="text-gray-400">🔥</span>
                      <span>{trend}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* AI Suggestions */}
                {suggestions.length > 0 && (
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                      Suggestions
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((suggestion, index) => (
                        <motion.button
                          key={`${id}-suggestion-${index}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setQuery(suggestion.text)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm"
                        >
                          <span>{suggestion.icon}</span>
                          {suggestion.text}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Results */}
                {isLoading ? (
                  <div className="p-6 space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 animate-pulse">
                        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchResults.length > 0 ? (
                  <div>
                    {searchResults.map((result, index) => (
                      <SearchResultItem
                        key={result.id}
                        result={result}
                        index={index}
                        onSelect={handleResultSelect}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-gray-500">
                    No results found for "{deferredQuery}"
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer shortcuts */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">esc</kbd>
                Close
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">⌘K</kbd>
              to open
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default memo(ModernSearch);