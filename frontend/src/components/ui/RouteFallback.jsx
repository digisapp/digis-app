import React from 'react';

/**
 * RouteFallback - Branded loading fallback for route-level Suspense
 *
 * Provides consistent loading experience across all routes.
 * Prevents cumulative layout shift (CLS) with proper min-height.
 */

export const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>
);

export const MobileRouteFallback = () => (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
      <p className="text-gray-600 text-sm">Loading...</p>
    </div>
  </div>
);

export const CompactRouteFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
  </div>
);

export default RouteFallback;
