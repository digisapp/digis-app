import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldExclamationIcon,
  HomeIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

/**
 * AccessDenied - Professional access denied page
 * Shown when a user tries to access a restricted area without proper permissions
 */
const AccessDenied = ({
  title = 'Access Denied',
  message = "You don't have permission to access this area.",
  suggestion = 'This section is restricted to administrators only.',
  showBackButton = true,
  homeUrl = '/',
  isDarkMode = true
}) => {
  const navigate = useNavigate();

  const bgClass = isDarkMode
    ? 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900'
    : 'bg-gradient-to-br from-gray-50 to-gray-100';

  const textClass = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextClass = isDarkMode ? 'text-gray-400' : 'text-gray-600';

  return (
    <div className={`min-h-screen ${bgClass} flex items-center justify-center px-4 py-12`}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-red-500 rounded-full opacity-5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-orange-500 rounded-full opacity-5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-lg relative z-10"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center justify-center w-24 h-24 mb-6"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-red-500 rounded-full opacity-20 blur-xl"></div>
            <div className="relative bg-red-500/10 backdrop-blur-sm rounded-full p-6 border border-red-500/20">
              <ShieldExclamationIcon className="w-12 h-12 text-red-500" />
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={`text-4xl font-bold ${textClass} mb-3`}
        >
          {title}
        </motion.h1>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className={`text-lg ${subtextClass} mb-2`}
        >
          {message}
        </motion.p>

        {/* Suggestion */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className={`text-sm ${subtextClass} mb-8`}
        >
          {suggestion}
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          {showBackButton && (
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-medium rounded-lg border border-white/20 transition-all hover:scale-105 active:scale-95"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-2" />
              Go Back
            </button>
          )}

          <button
            onClick={() => navigate(homeUrl)}
            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            <HomeIcon className="w-5 h-5 mr-2" />
            Return to Home
          </button>
        </motion.div>

        {/* Help Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className={`mt-12 pt-8 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-300'}`}
        >
          <p className={`text-xs ${subtextClass}`}>
            If you believe you should have access, please contact your system administrator.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AccessDenied;
