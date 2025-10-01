import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SparklesIcon,
  AdjustmentsHorizontalIcon,
  FaceSmileIcon,
  SunIcon,
  PhotoIcon,
  PaintBrushIcon,
  EyeDropperIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import Slider from './ui/Slider';
import Button from './ui/Button';
import Card from './ui/Card';
import toast from 'react-hot-toast';

const BeautyFilters = ({
  isOpen,
  onClose,
  onApplyFilters,
  currentSettings = {},
  localVideoTrack = null,
  className = ''
}) => {
  // Beauty enhancement settings
  const [beautySettings, setBeautySettings] = useState({
    smoothness: currentSettings.smoothness || 0.5,
    brightness: currentSettings.brightness || 0.5,
    redness: currentSettings.redness || 0.3,
    sharpness: currentSettings.sharpness || 0.2,
    contrast: currentSettings.contrast || 0.5,
    saturation: currentSettings.saturation || 0.5
  });

  // AR Effects
  const [selectedEffect, setSelectedEffect] = useState(currentSettings.effect || null);
  const [arEffects] = useState([
    { id: 'none', name: 'None', icon: XMarkIcon, preview: '🚫' },
    { id: 'sparkles', name: 'Sparkles', icon: SparklesIcon, preview: '✨' },
    { id: 'hearts', name: 'Hearts', icon: FaceSmileIcon, preview: '💕' },
    { id: 'sunglasses', name: 'Sunglasses', icon: SunIcon, preview: '🕶️' },
    { id: 'cat-ears', name: 'Cat Ears', icon: FaceSmileIcon, preview: '🐱' },
    { id: 'flower-crown', name: 'Flowers', icon: PaintBrushIcon, preview: '🌸' },
    { id: 'rainbow', name: 'Rainbow', icon: PhotoIcon, preview: '🌈' },
    { id: 'party', name: 'Party', icon: StarIcon, preview: '🎉' },
    { id: 'neon', name: 'Neon Glow', icon: EyeDropperIcon, preview: '💫' }
  ]);

  // Background options
  const [backgroundMode, setBackgroundMode] = useState(currentSettings.backgroundMode || 'none');
  const [backgrounds] = useState([
    { id: 'none', name: 'None', preview: '🚫' },
    { id: 'blur', name: 'Blur', preview: '🌫️' },
    { id: 'beach', name: 'Miami Beach', preview: '🏖️' },
    { id: 'city', name: 'City Lights', preview: '🌃' },
    { id: 'space', name: 'Space', preview: '🌌' },
    { id: 'studio', name: 'Studio', preview: '🎬' },
    { id: 'abstract', name: 'Abstract', preview: '🎨' },
    { id: 'gaming', name: 'Gaming', preview: '🎮' }
  ]);

  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('beauty');

  // Apply settings to video track
  useEffect(() => {
    if (localVideoTrack && previewEnabled) {
      applyBeautySettings();
    }
  }, [beautySettings, selectedEffect, backgroundMode, previewEnabled]);

  const applyBeautySettings = async () => {
    if (!localVideoTrack) return;

    try {
      // Apply beauty options
      await localVideoTrack.setBeautyEffect(true, {
        lighteningContrastLevel: 1,
        lighteningLevel: beautySettings.brightness,
        smoothnessLevel: beautySettings.smoothness,
        rednessLevel: beautySettings.redness,
        sharpnessLevel: beautySettings.sharpness
      });

      // Apply virtual background if selected
      if (backgroundMode !== 'none') {
        if (backgroundMode === 'blur') {
          await localVideoTrack.setBlurLevel(3);
        } else {
          // Apply virtual background
          await localVideoTrack.setVirtualBackground({
            backgroundType: 'img',
            source: `/backgrounds/${backgroundMode}.jpg`
          });
        }
      } else {
        await localVideoTrack.setVirtualBackground(null);
      }

      // Note: AR effects would require additional Agora extensions
      // This is a placeholder for the UI
    } catch (error) {
      console.error('Error applying beauty settings:', error);
      toast.error('Failed to apply filters');
    }
  };

  const handleSliderChange = (setting, value) => {
    setBeautySettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const resetSettings = () => {
    const defaultSettings = {
      smoothness: 0.5,
      brightness: 0.5,
      redness: 0.3,
      sharpness: 0.2,
      contrast: 0.5,
      saturation: 0.5
    };
    setBeautySettings(defaultSettings);
    setSelectedEffect(null);
    setBackgroundMode('none');
  };

  const saveAndApply = () => {
    const settings = {
      ...beautySettings,
      effect: selectedEffect,
      backgroundMode: backgroundMode
    };
    onApplyFilters(settings);
    // toast.success('Beauty filters applied!');
    onClose();
  };

  const BeautySlider = ({ label, value, onChange, icon: Icon }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" />}
          {label}
        </label>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {Math.round(value * 100)}%
        </span>
      </div>
      <Slider
        value={value}
        onChange={onChange}
        min={0}
        max={1}
        step={0.1}
        className="w-full"
      />
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={`bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl ${className}`}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <SparklesIcon className="w-8 h-8" />
                    Beauty Filters
                  </h2>
                  <p className="text-purple-100 mt-1">Enhance your appearance on stream</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('beauty')}
                className={`flex-1 py-3 px-4 font-medium transition-colors ${
                  activeTab === 'beauty'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Beauty Enhancement
              </button>
              <button
                onClick={() => setActiveTab('effects')}
                className={`flex-1 py-3 px-4 font-medium transition-colors ${
                  activeTab === 'effects'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                AR Effects
              </button>
              <button
                onClick={() => setActiveTab('background')}
                className={`flex-1 py-3 px-4 font-medium transition-colors ${
                  activeTab === 'background'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Backgrounds
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 overflow-y-auto" style={{ maxHeight: '400px' }}>
              {activeTab === 'beauty' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <BeautySlider
                    label="Skin Smoothness"
                    value={beautySettings.smoothness}
                    onChange={(value) => handleSliderChange('smoothness', value)}
                    icon={FaceSmileIcon}
                  />
                  <BeautySlider
                    label="Brightness"
                    value={beautySettings.brightness}
                    onChange={(value) => handleSliderChange('brightness', value)}
                    icon={SunIcon}
                  />
                  <BeautySlider
                    label="Redness"
                    value={beautySettings.redness}
                    onChange={(value) => handleSliderChange('redness', value)}
                    icon={PaintBrushIcon}
                  />
                  <BeautySlider
                    label="Sharpness"
                    value={beautySettings.sharpness}
                    onChange={(value) => handleSliderChange('sharpness', value)}
                    icon={AdjustmentsHorizontalIcon}
                  />
                  <BeautySlider
                    label="Contrast"
                    value={beautySettings.contrast}
                    onChange={(value) => handleSliderChange('contrast', value)}
                    icon={PhotoIcon}
                  />
                  <BeautySlider
                    label="Saturation"
                    value={beautySettings.saturation}
                    onChange={(value) => handleSliderChange('saturation', value)}
                    icon={EyeDropperIcon}
                  />
                </motion.div>
              )}

              {activeTab === 'effects' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-3 gap-3"
                >
                  {arEffects.map((effect) => (
                    <motion.button
                      key={effect.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedEffect(effect.id)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedEffect === effect.id
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="text-3xl mb-2">{effect.preview}</div>
                      <p className="text-sm font-medium">{effect.name}</p>
                    </motion.button>
                  ))}
                </motion.div>
              )}

              {activeTab === 'background' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-4 gap-3"
                >
                  {backgrounds.map((bg) => (
                    <motion.button
                      key={bg.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setBackgroundMode(bg.id)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        backgroundMode === bg.id
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="text-3xl mb-2">{bg.preview}</div>
                      <p className="text-xs font-medium">{bg.name}</p>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={previewEnabled}
                      onChange={(e) => setPreviewEnabled(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Live Preview</span>
                  </label>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={resetSettings}
                  >
                    Reset All
                  </Button>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={saveAndApply}
                    icon={<SparklesIcon className="w-5 h-5" />}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BeautyFilters;