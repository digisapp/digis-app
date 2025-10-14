import React from 'react';

/**
 * UnauthSplash - Minimal loading component shown during auth redirects
 *
 * Displayed for ~300-500ms during ProtectedRoute redirects to smooth UX
 * and reduce perceived flicker on low-end devices.
 *
 * Usage: <UnauthSplash />
 */
const UnauthSplash = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center">
        {/* Spinner */}
        <div className="inline-block">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
        </div>

        {/* Message */}
        <p className="mt-4 text-gray-600 font-medium">
          Signing you out…
        </p>
      </div>
    </div>
  );
};

export default UnauthSplash;
