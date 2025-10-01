import React from 'react';
import { motion } from 'framer-motion';

const Slider = ({
  value = 0,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className = '',
  showValue = false,
  valueFormatter = (v) => v,
  color = 'purple'
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  const colorClasses = {
    purple: {
      track: 'bg-purple-600',
      bg: 'bg-purple-100 dark:bg-purple-900/20',
      thumb: 'bg-white border-purple-600'
    },
    blue: {
      track: 'bg-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-900/20',
      thumb: 'bg-white border-blue-600'
    },
    pink: {
      track: 'bg-pink-600',
      bg: 'bg-pink-100 dark:bg-pink-900/20',
      thumb: 'bg-white border-pink-600'
    }
  };

  const colors = colorClasses[color] || colorClasses.purple;

  return (
    <div className={`relative ${className}`}>
      <div className={`relative h-2 ${colors.bg} rounded-full overflow-hidden`}>
        <motion.div
          className={`absolute top-0 left-0 h-full ${colors.track} rounded-full`}
          initial={false}
          animate={{ width: `${percentage}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer ${
          disabled ? 'cursor-not-allowed' : ''
        }`}
      />
      <motion.div
        className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 ${colors.thumb} rounded-full shadow-lg border-2 pointer-events-none`}
        initial={false}
        animate={{ left: `calc(${percentage}% - 10px)` }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {showValue && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            {valueFormatter(value)}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Slider;