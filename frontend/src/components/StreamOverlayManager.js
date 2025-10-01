import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhotoIcon, XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const StreamOverlayManager = ({
  isCreator,
  onOverlayChange,
  currentOverlay = null,
  className = ''
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [overlayImage, setOverlayImage] = useState(currentOverlay);
  const [overlayPosition, setOverlayPosition] = useState('top-left');
  const [overlaySize, setOverlaySize] = useState('small');
  const [overlayOpacity, setOverlayOpacity] = useState(0.8);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    // Convert to base64 for preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUrl = reader.result;
      setOverlayImage(imageUrl);

      // Notify parent component
      if (onOverlayChange) {
        onOverlayChange({
          image: imageUrl,
          position: overlayPosition,
          size: overlaySize,
          opacity: overlayOpacity
        });
      }

      toast.success('Overlay image uploaded!');
    };
    reader.readAsDataURL(file);
  };

  const removeOverlay = () => {
    setOverlayImage(null);
    if (onOverlayChange) {
      onOverlayChange(null);
    }
    toast.success('Overlay removed');
  };

  const updateOverlaySettings = (key, value) => {
    const newSettings = {
      image: overlayImage,
      position: key === 'position' ? value : overlayPosition,
      size: key === 'size' ? value : overlaySize,
      opacity: key === 'opacity' ? value : overlayOpacity
    };

    if (key === 'position') setOverlayPosition(value);
    if (key === 'size') setOverlaySize(value);
    if (key === 'opacity') setOverlayOpacity(value);

    if (onOverlayChange && overlayImage) {
      onOverlayChange(newSettings);
    }
  };

  if (!isCreator) return null;

  return (
    <>
      {/* Settings Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowSettings(!showSettings)}
        className={`bg-gray-800/80 hover:bg-gray-700/90 text-white p-2 rounded-lg backdrop-blur-sm transition-all ${className}`}
        title="Stream Overlay Settings"
      >
        <PhotoIcon className="w-5 h-5" />
      </motion.button>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 20 }}
            className="absolute top-16 left-4 z-50 bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-800 p-4 w-80"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Stream Overlay</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Upload Section */}
            <div className="space-y-4">
              {!overlayImage ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-purple-500 transition-colors"
                >
                  <ArrowUpTrayIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-400 text-sm">
                    Click to upload overlay image
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    PNG recommended (Max 2MB)
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={overlayImage}
                    alt="Overlay"
                    className="w-full h-32 object-contain bg-gray-800 rounded-lg"
                  />
                  <button
                    onClick={removeOverlay}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full transition-colors"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              {/* Settings Controls */}
              {overlayImage && (
                <>
                  {/* Size */}
                  <div>
                    <label className="text-gray-400 text-xs uppercase tracking-wider">Size</label>
                    <div className="flex gap-2 mt-2">
                      {['small', 'medium', 'large'].map(size => (
                        <button
                          key={size}
                          onClick={() => updateOverlaySettings('size', size)}
                          className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-all ${
                            overlaySize === size
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {size.charAt(0).toUpperCase() + size.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Opacity */}
                  <div>
                    <label className="text-gray-400 text-xs uppercase tracking-wider">
                      Opacity: {Math.round(overlayOpacity * 100)}%
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={overlayOpacity * 100}
                      onChange={(e) => updateOverlaySettings('opacity', e.target.value / 100)}
                      className="w-full mt-2 accent-purple-600"
                    />
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Overlay Display Component - Fixed to top-left for creator logo
export const StreamOverlay = ({ settings }) => {
  if (!settings?.image) return null;

  const sizeClasses = {
    'small': 'h-12 md:h-16',
    'medium': 'h-16 md:h-20',
    'large': 'h-20 md:h-24'
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: settings.opacity || 0.8 }}
      transition={{ duration: 0.3 }}
      className="absolute top-4 left-4 z-20 pointer-events-none"
    >
      <img
        src={settings.image}
        alt="Creator Logo"
        className={`${sizeClasses[settings.size || 'small']} w-auto object-contain`}
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
        }}
      />
    </motion.div>
  );
};

export default StreamOverlayManager;