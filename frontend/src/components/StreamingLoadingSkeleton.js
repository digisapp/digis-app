import React from 'react';
import { motion } from 'framer-motion';

const StreamingLoadingSkeleton = ({ type = 'dashboard' }) => {
  const shimmer = {
    animate: {
      backgroundPosition: ['200% 0', '-200% 0'],
    },
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear'
    }
  };

  if (type === 'chat') {
    return (
      <div className="h-full flex flex-col bg-gray-900">
        {/* Chat header */}
        <div className="h-16 border-b border-gray-800 p-4">
          <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
        </div>

        {/* Chat messages */}
        <div className="flex-1 p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 bg-gray-800 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-gray-800 rounded animate-pulse" />
                <div className="h-4 w-full max-w-xs bg-gray-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Chat input */}
        <div className="h-20 border-t border-gray-800 p-4">
          <div className="h-12 bg-gray-800 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div className="text-center space-y-4">
          <motion.div
            className="w-20 h-20 mx-auto"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <svg className="w-full h-full text-purple-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </motion.div>
          <div className="space-y-2">
            <p className="text-white font-medium">Loading stream...</p>
            <p className="text-gray-400 text-sm">Initializing video connection</p>
          </div>
        </div>
      </div>
    );
  }

  // Default dashboard skeleton
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="h-16 bg-gray-900 border-b border-gray-800 px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-20 h-6 bg-gray-800 rounded animate-pulse" />
          <div className="w-32 h-6 bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="w-24 h-8 bg-gray-800 rounded animate-pulse" />
      </div>

      {/* Main content */}
      <div className="p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Video/Stream area */}
          <div className="lg:col-span-8 space-y-4">
            <motion.div
              className="aspect-video bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 rounded-xl relative overflow-hidden"
              animate={shimmer.animate}
              transition={shimmer.transition}
              style={{
                backgroundSize: '200% 100%',
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 bg-gray-900/50 rounded-full animate-pulse" />
              </div>
            </motion.div>

            {/* Control bar */}
            <div className="h-16 bg-gray-900 rounded-lg p-4 flex items-center justify-between">
              <div className="flex gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-10 h-10 bg-gray-800 rounded animate-pulse" />
                ))}
              </div>
              <div className="w-32 h-10 bg-red-900/50 rounded animate-pulse" />
            </div>

            {/* Analytics */}
            <div className="bg-gray-900 rounded-xl p-4 space-y-4">
              <div className="h-6 w-32 bg-gray-800 rounded animate-pulse" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
                    <div className="h-8 w-16 bg-gray-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="lg:col-span-4 space-y-4">
            {/* Chat skeleton */}
            <div className="bg-gray-900 rounded-xl h-[500px] flex flex-col">
              <div className="p-4 border-b border-gray-800">
                <div className="h-6 w-20 bg-gray-800 rounded animate-pulse" />
              </div>
              <div className="flex-1 p-4 space-y-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="w-6 h-6 bg-gray-800 rounded-full animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 w-3/4 bg-gray-800 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-800">
                <div className="h-10 bg-gray-800 rounded-lg animate-pulse" />
              </div>
            </div>

            {/* Stream info */}
            <div className="bg-gray-900 rounded-xl p-4 space-y-3">
              <div className="h-5 w-24 bg-gray-800 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-800 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-gray-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamingLoadingSkeleton;