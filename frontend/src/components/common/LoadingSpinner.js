import React from 'react';
import { motion } from 'framer-motion';

const LoadingSpinner = ({ 
  size = 'medium', 
  message = 'Loading...', 
  fullScreen = false,
  color = 'purple'
}) => {
  const sizes = {
    small: 'h-8 w-8',
    medium: 'h-12 w-12',
    large: 'h-16 w-16'
  };

  const colors = {
    purple: 'border-purple-600',
    pink: 'border-pink-600',
    blue: 'border-blue-600',
    white: 'border-white'
  };

  const Spinner = () => (
    <div className="flex flex-col items-center justify-center">
      <motion.div
        className={`${sizes[size]} border-4 border-gray-200 ${colors[color]} border-t-current rounded-full`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      {message && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`mt-4 text-sm ${color === 'white' ? 'text-white' : 'text-gray-600'}`}
        >
          {message}
        </motion.p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      >
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <Spinner />
        </div>
      </motion.div>
    );
  }

  return <Spinner />;
};

export default LoadingSpinner;