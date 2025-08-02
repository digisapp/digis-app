import React from 'react';
import { motion } from 'framer-motion';

const EmptyState = ({ 
  icon: Icon, 
  title, 
  message, 
  action, 
  actionText,
  iconColor = 'text-gray-400'
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      {Icon && (
        <div className="mb-4">
          <Icon className={`h-16 w-16 ${iconColor}`} />
        </div>
      )}
      
      {title && (
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {title}
        </h3>
      )}
      
      {message && (
        <p className="text-gray-600 text-center max-w-sm mb-6">
          {message}
        </p>
      )}
      
      {action && actionText && (
        <button
          onClick={action}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          {actionText}
        </button>
      )}
    </motion.div>
  );
};

export default EmptyState;