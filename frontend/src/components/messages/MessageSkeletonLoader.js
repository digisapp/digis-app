import React from 'react';
import { motion } from 'framer-motion';

const MessageSkeletonLoader = ({ count = 5 }) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);
  
  const shimmer = {
    initial: { x: -200 },
    animate: { 
      x: 200,
      transition: {
        repeat: Infinity,
        duration: 1.5,
        ease: "linear"
      }
    }
  };
  
  return (
    <div className="p-4 space-y-4">
      {skeletons.map((index) => (
        <div 
          key={index}
          className={`flex ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}
        >
          <div className={`max-w-xs lg:max-w-md ${index % 2 === 0 ? 'items-start' : 'items-end'}`}>
            {/* Message bubble skeleton */}
            <div className="relative overflow-hidden bg-gray-200 dark:bg-gray-700 rounded-2xl p-4">
              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                variants={shimmer}
                initial="initial"
                animate="animate"
              />
              
              {/* Content placeholders */}
              <div className="space-y-2">
                <div className={`h-3 bg-gray-300 dark:bg-gray-600 rounded w-${
                  ['full', '3/4', '2/3', '4/5'][index % 4]
                }`} />
                {index % 3 !== 0 && (
                  <div className={`h-3 bg-gray-300 dark:bg-gray-600 rounded w-${
                    ['2/3', '1/2', '3/5'][index % 3]
                  }`} />
                )}
              </div>
            </div>
            
            {/* Timestamp skeleton */}
            <div className="flex items-center gap-2 mt-1 px-2">
              <div className="h-2 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
              {index % 2 !== 0 && (
                <div className="h-2 w-2 bg-gray-200 dark:bg-gray-700 rounded-full" />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const ConversationSkeletonLoader = ({ count = 5 }) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);
  
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {skeletons.map((index) => (
        <div key={index} className="p-4 flex items-center gap-3">
          {/* Avatar skeleton */}
          <div className="relative">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            {index % 3 === 0 && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full border-2 border-white dark:border-gray-800" />
            )}
          </div>
          
          {/* Content skeleton */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          
          {/* Badge skeleton */}
          {index % 4 === 0 && (
            <div className="w-6 h-6 bg-purple-200 dark:bg-purple-800 rounded-full animate-pulse" />
          )}
        </div>
      ))}
    </div>
  );
};

export default MessageSkeletonLoader;