import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CogIcon, CheckIcon } from '@heroicons/react/24/outline';
import { WifiIcon, SpeakerWaveIcon } from '@heroicons/react/24/solid';

const StreamQualitySelector = ({ currentQuality = 'auto', onQualityChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState(currentQuality);
  const dropdownRef = useRef(null);

  const qualityOptions = [
    { 
      id: 'auto', 
      label: 'Auto', 
      detail: 'Best for your connection',
      icon: WifiIcon,
      color: 'text-green-400'
    },
    { 
      id: '1080p', 
      label: '1080p', 
      detail: 'Full HD • 5 Mbps',
      icon: null,
      color: 'text-blue-400'
    },
    { 
      id: '720p', 
      label: '720p', 
      detail: 'HD • 2.5 Mbps',
      icon: null,
      color: 'text-blue-400'
    },
    { 
      id: '480p', 
      label: '480p', 
      detail: 'SD • 1 Mbps',
      icon: null,
      color: 'text-yellow-400'
    },
    { 
      id: 'audio', 
      label: 'Audio Only', 
      detail: 'Save data • 128 kbps',
      icon: SpeakerWaveIcon,
      color: 'text-purple-400'
    }
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQualitySelect = (quality) => {
    setSelectedQuality(quality);
    setIsOpen(false);
    if (onQualityChange) {
      onQualityChange(quality);
    }
  };

  const currentOption = qualityOptions.find(opt => opt.id === selectedQuality);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Quality Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-md rounded-lg hover:bg-black/80 transition-colors border border-white/10"
      >
        <CogIcon className="w-4 h-4 text-white/70" />
        <span className="text-sm font-medium text-white">
          {currentOption?.label}
        </span>
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full mb-2 right-0 w-56 bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden"
          >
            <div className="p-2">
              <div className="text-xs text-gray-400 font-semibold px-3 py-2">
                STREAM QUALITY
              </div>
              
              {qualityOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedQuality === option.id;
                
                return (
                  <motion.button
                    key={option.id}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                    onClick={() => handleQualitySelect(option.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                      isSelected ? 'bg-purple-600/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {Icon ? (
                        <Icon className={`w-5 h-5 ${option.color}`} />
                      ) : (
                        <span className={`text-sm font-bold ${option.color}`}>
                          {option.label}
                        </span>
                      )}
                      
                      <div className="text-left">
                        {Icon && (
                          <div className="text-sm font-medium text-white">
                            {option.label}
                          </div>
                        )}
                        <div className="text-xs text-gray-400">
                          {option.detail}
                        </div>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <CheckIcon className="w-4 h-4 text-purple-400" />
                    )}
                  </motion.button>
                );
              })}
              
              {/* Network Status */}
              <div className="mt-2 pt-2 border-t border-gray-700/50">
                <div className="px-3 py-2 flex items-center justify-between text-xs">
                  <span className="text-gray-400">Connection:</span>
                  <span className="text-green-400 font-medium">Excellent</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StreamQualitySelector;