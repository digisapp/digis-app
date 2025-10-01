import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { formatTimestamp } from '../../utils/dateHelpers';

const MessageSearch = ({
  messages,
  onResultClick,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  
  // Search through messages
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    return messages.filter(message => 
      message.content?.toLowerCase().includes(query) ||
      message.sender_name?.toLowerCase().includes(query)
    ).map(message => ({
      ...message,
      // Highlight matching text
      highlightedContent: highlightText(message.content, query)
    }));
  }, [messages, searchQuery]);
  
  // Highlight matching text
  const highlightText = (text, query) => {
    if (!text || !query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <mark key={index} className="bg-yellow-300 dark:bg-yellow-600 text-inherit">{part}</mark> : 
        part
    );
  };
  
  // Navigate search results
  const navigateToResult = (index) => {
    if (searchResults.length === 0) return;
    
    const newIndex = Math.max(0, Math.min(searchResults.length - 1, index));
    setCurrentResultIndex(newIndex);
    onResultClick(searchResults[newIndex].id);
  };
  
  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'Enter':
        if (!e.shiftKey && searchResults.length > 0) {
          e.preventDefault();
          navigateToResult(currentResultIndex);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateToResult(currentResultIndex - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        navigateToResult(currentResultIndex + 1);
        break;
      case 'Escape':
        onClose();
        break;
    }
  };
  
  useEffect(() => {
    // Reset current index when search changes
    setCurrentResultIndex(0);
    setShowResults(searchQuery.length > 0);
  }, [searchQuery]);
  
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3"
    >
      <div className="relative">
        {/* Search input */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search in conversation..."
            className="w-full pl-10 pr-20 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            autoFocus
          />
          
          {/* Search result counter and navigation */}
          {searchResults.length > 0 && (
            <div className="absolute right-10 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              <span className="text-xs text-gray-500">
                {currentResultIndex + 1} / {searchResults.length}
              </span>
              <button
                onClick={() => navigateToResult(currentResultIndex - 1)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                disabled={currentResultIndex === 0}
              >
                <ChevronUpIcon className="w-3 h-3 text-gray-500" />
              </button>
              <button
                onClick={() => navigateToResult(currentResultIndex + 1)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                disabled={currentResultIndex === searchResults.length - 1}
              >
                <ChevronDownIcon className="w-3 h-3 text-gray-500" />
              </button>
            </div>
          )}
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          >
            <XMarkIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        
        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto z-20"
          >
            {searchResults.slice(0, 10).map((result, index) => (
              <button
                key={result.id}
                onClick={() => {
                  setCurrentResultIndex(index);
                  onResultClick(result.id);
                  setShowResults(false);
                }}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  index === currentResultIndex ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white truncate">
                      {result.highlightedContent || result.content}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {result.sender_name} • {formatTimestamp(result.timestamp)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            
            {searchResults.length > 10 && (
              <div className="px-4 py-2 text-xs text-gray-500 text-center border-t border-gray-200 dark:border-gray-700">
                {searchResults.length - 10} more results...
              </div>
            )}
          </motion.div>
        )}
        
        {/* No results */}
        {showResults && searchQuery && searchResults.length === 0 && (
          <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 text-center text-sm text-gray-500">
            No messages found
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MessageSearch;