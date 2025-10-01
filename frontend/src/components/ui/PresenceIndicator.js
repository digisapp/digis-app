import React from 'react';
import { motion } from 'framer-motion';

const PresenceIndicator = ({ 
  status = 'offline', 
  size = 'md',
  showLabel = false,
  className = '' 
}) => {
  const statusConfig = {
    online: {
      color: 'bg-green-500',
      label: 'Online',
      pulse: true
    },
    away: {
      color: 'bg-yellow-500',
      label: 'Away',
      pulse: false
    },
    busy: {
      color: 'bg-red-500',
      label: 'Busy',
      pulse: false
    },
    offline: {
      color: 'bg-gray-400',
      label: 'Offline',
      pulse: false
    }
  };

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const config = statusConfig[status] || statusConfig.offline;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <div
          className={`${sizeClasses[size]} ${config.color} rounded-full`}
        />
        {config.pulse && status === 'online' && (
          <motion.div
            className={`absolute inset-0 ${sizeClasses[size]} ${config.color} rounded-full`}
            animate={{
              scale: [1, 1.5, 1.5],
              opacity: [1, 0, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        )}
      </div>
      {showLabel && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {config.label}
        </span>
      )}
    </div>
  );
};

export default PresenceIndicator;