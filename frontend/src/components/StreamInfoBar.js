import React, { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { formatDuration, formatViewerCount } from '../utils/streamUtils';
import {
  UserGroupIcon,
  TagIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const StreamInfoBar = ({
  streamTitle,
  streamCategory,
  viewerCount,
  duration,
  onTitleChange,
  onCategoryChange,
  user,
  isRecording,
  isStreamEnding,
  streamStats,
  className = ''
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [tempTitle, setTempTitle] = useState(streamTitle);
  const [tempCategory, setTempCategory] = useState(streamCategory);

  // Using centralized formatDuration from utils

  const handleTitleSave = () => {
    onTitleChange(tempTitle);
    setIsEditingTitle(false);
  };

  const handleCategorySave = () => {
    onCategoryChange(tempCategory);
    setIsEditingCategory(false);
  };


  return (
    <div className={`bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-4 py-2 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        {/* Left Section - Stream Info */}
        <div className="flex-1 flex items-center gap-4">
          {/* Live Badge with Username and Title */}
          <div className="flex items-center gap-3">
            <motion.div
              animate={isStreamEnding ? {} : { scale: [1, 1.1, 1] }}
              transition={{ repeat: isStreamEnding ? 0 : Infinity, duration: 2 }}
              className={`${
                isStreamEnding 
                  ? 'bg-gray-600' 
                  : 'bg-red-600'
              } text-white px-3 py-1 rounded-md flex items-center gap-2 text-sm font-bold`}
            >
              {!isStreamEnding && (
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              )}
              {isStreamEnding ? 'ENDED' : 'LIVE'}
            </motion.div>
            
            {/* Username */}
            {user && (
              <div className="text-white font-semibold">
                {user.displayName || user.email?.split('@')[0] || 'Creator'}
              </div>
            )}
            
            {/* Separator */}
            <span className="text-gray-400">•</span>

            {/* Stream Title (Editable) - Shows the title from Go Live Setup */}
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    className="bg-gray-700 text-white px-3 py-1 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTitleSave();
                      if (e.key === 'Escape') {
                        setTempTitle(streamTitle);
                        setIsEditingTitle(false);
                      }
                    }}
                  />
                  <button
                    onClick={handleTitleSave}
                    className="text-green-500 hover:text-green-400"
                  >
                    <CheckIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setTempTitle(streamTitle);
                      setIsEditingTitle(false);
                    }}
                    className="text-red-500 hover:text-red-400"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <div className="text-white font-medium truncate max-w-md" title="Stream Title">
                    {streamTitle || 'My Live Stream'}
                  </div>
                  {onTitleChange && (
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>


          {/* Category - Now visible on mobile too */}
          <div className="flex items-center">
            {isEditingCategory ? (
              <div className="flex items-center gap-2">
                <TagIcon className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={tempCategory}
                  onChange={(e) => setTempCategory(e.target.value)}
                  className="bg-gray-700 text-white px-2 py-1 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCategorySave();
                    if (e.key === 'Escape') setIsEditingCategory(false);
                  }}
                />
                <button
                  onClick={handleCategorySave}
                  className="p-1 text-green-500 hover:bg-gray-700 rounded"
                >
                  <CheckIcon className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setIsEditingCategory(false)}
                  className="p-1 text-red-500 hover:bg-gray-700 rounded"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <TagIcon className="w-4 h-4 text-gray-400" />
                <span className="text-purple-400 text-xs" title="Stream Category">{streamCategory || 'Just Chatting'}</span>
                <button
                  onClick={() => {
                    setTempCategory(streamCategory);
                    setIsEditingCategory(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-opacity"
                >
                  <PencilIcon className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Section - Mini Stats & Actions */}
        <div className="flex items-center gap-3">
          {/* Mini Stats Display */}
          <div className="hidden lg:flex items-center gap-3 bg-gray-800/50 rounded-lg px-3 py-1.5">
            {/* Viewers */}
            <div className="flex items-center gap-1.5">
              <UserGroupIcon className="w-4 h-4 text-purple-400" />
              <div className="text-sm">
                <span className="text-white font-semibold">{viewerCount.toLocaleString()}</span>
                <span className="text-gray-400 text-xs ml-1">viewers</span>
              </div>
            </div>
            
            <div className="w-px h-4 bg-gray-700" />
            
            {/* Duration */}
            <div className="text-sm">
              <span className="text-white font-medium">{formatDuration(duration)}</span>
            </div>
            
            {streamStats && (
              <>
                <div className="w-px h-4 bg-gray-700" />
                
                {/* Revenue */}
                <div className="flex items-center gap-1.5">
                  <div className="text-sm">
                    <span className="text-green-400 font-semibold">{streamStats.revenue}</span>
                    <span className="text-gray-400 text-xs ml-1">tokens</span>
                  </div>
                </div>
                
                <div className="w-px h-4 bg-gray-700" />
                
                {/* Messages */}
                <div className="text-sm">
                  <span className="text-blue-400 font-medium">{streamStats.messages}</span>
                  <span className="text-gray-400 text-xs ml-1">msgs</span>
                </div>
              </>
            )}
          </div>
          
          {/* Mobile Stats - Compact Version */}
          <div className="flex lg:hidden items-center gap-2 text-sm">
            <UserGroupIcon className="w-4 h-4 text-gray-400" />
            <span className="text-white font-medium">{viewerCount}</span>
            <span className="text-gray-400">•</span>
            <span className="text-white font-medium">{formatDuration(duration)}</span>
          </div>
        </div>
      </div>

      {/* Mobile Category Display */}
      <div className="md:hidden mt-2">
        {isEditingCategory ? (
          <div className="flex items-center gap-2">
            <TagIcon className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={tempCategory}
              onChange={(e) => setTempCategory(e.target.value)}
              className="flex-1 bg-gray-700 text-white px-2 py-1 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCategorySave();
                if (e.key === 'Escape') setIsEditingCategory(false);
              }}
            />
            <button
              onClick={handleCategorySave}
              className="p-1 text-green-500 hover:bg-gray-700 rounded"
            >
              <CheckIcon className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIsEditingCategory(false)}
              className="p-1 text-red-500 hover:bg-gray-700 rounded"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <TagIcon className="w-4 h-4 text-gray-400" />
            <span className="text-purple-400 text-xs">{streamCategory}</span>
            <button
              onClick={() => {
                setTempCategory(streamCategory);
                setIsEditingCategory(true);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-opacity"
            >
              <PencilIcon className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders
export default memo(StreamInfoBar, (prevProps, nextProps) => {
  return (
    prevProps.streamTitle === nextProps.streamTitle &&
    prevProps.streamCategory === nextProps.streamCategory &&
    prevProps.viewerCount === nextProps.viewerCount &&
    prevProps.duration === nextProps.duration &&
    prevProps.isRecording === nextProps.isRecording &&
    prevProps.isStreamEnding === nextProps.isStreamEnding
  );
});