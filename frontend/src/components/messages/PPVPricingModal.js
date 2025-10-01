import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  PhotoIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  DocumentIcon,
  InformationCircleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const PPVPricingModal = ({
  isOpen,
  onClose,
  onConfirm,
  file,
  fileType,
  suggestedPrices = {
    image: { min: 5, max: 50, default: 10 },
    video: { min: 10, max: 200, default: 25 },
    audio: { min: 5, max: 100, default: 15 },
    file: { min: 5, max: 100, default: 10 }
  }
}) => {
  const [price, setPrice] = useState(suggestedPrices[fileType]?.default || 10);
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState(null);
  const [isExclusive, setIsExclusive] = useState(false);
  const [expiresIn, setExpiresIn] = useState('never');
  
  // Get file info and icon
  const getFileInfo = () => {
    switch (fileType) {
      case 'image':
        return {
          icon: PhotoIcon,
          label: 'Photo',
          color: 'from-purple-500 to-pink-500'
        };
      case 'video':
        return {
          icon: VideoCameraIcon,
          label: 'Video',
          color: 'from-blue-500 to-purple-500'
        };
      case 'audio':
        return {
          icon: MicrophoneIcon,
          label: 'Audio',
          color: 'from-green-500 to-teal-500'
        };
      default:
        return {
          icon: DocumentIcon,
          label: 'File',
          color: 'from-gray-500 to-gray-600'
        };
    }
  };
  
  const fileInfo = getFileInfo();
  const FileIcon = fileInfo.icon;
  const priceRange = suggestedPrices[fileType] || suggestedPrices.file;
  
  // Generate preview for images
  React.useEffect(() => {
    if (file && fileType === 'image') {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }, [file, fileType]);
  
  const handleConfirm = () => {
    if (price < priceRange.min || price > priceRange.max) {
      toast.error(`Price must be between ${priceRange.min} and ${priceRange.max} tokens`);
      return;
    }
    
    onConfirm({
      price,
      description,
      isExclusive,
      expiresIn,
      file,
      fileType
    });
    
    handleClose();
  };
  
  const handleClose = () => {
    setPrice(priceRange.default);
    setDescription('');
    setIsExclusive(false);
    setExpiresIn('never');
    setPreview(null);
    onClose();
  };
  
  // Popular price presets
  const pricePresets = [
    { value: priceRange.min, label: 'Budget' },
    { value: Math.round((priceRange.min + priceRange.default) / 2), label: 'Standard' },
    { value: priceRange.default, label: 'Premium' },
    { value: Math.round((priceRange.default + priceRange.max) / 2), label: 'Exclusive' }
  ];
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 bg-gradient-to-r ${fileInfo.color} rounded-full flex items-center justify-center`}>
                  <FileIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Set PPV Price
                  </h2>
                  <p className="text-sm text-gray-500">Premium {fileInfo.label}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-4">
            {/* File preview */}
            {preview && (
              <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img 
                  src={preview} 
                  alt="Content preview"
                  className="w-full h-32 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-white text-sm truncate">{file.name}</p>
                  <p className="text-white/70 text-xs">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            )}
            
            {/* Price input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <CurrencyDollarIcon className="w-4 h-4 inline mr-1" />
                Price in Tokens *
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  min={priceRange.min}
                  max={priceRange.max}
                  className="w-full px-4 py-3 pr-20 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                  <SparklesIcon className="w-5 h-5 text-purple-500" />
                  <span className="text-gray-600 dark:text-gray-400">tokens</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Suggested: {priceRange.min} - {priceRange.max} tokens
              </p>
            </div>
            
            {/* Price presets */}
            <div className="flex gap-2">
              {pricePresets.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => setPrice(preset.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    price === preset.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {preset.value} 
                  <span className="block text-xs opacity-75">{preset.label}</span>
                </button>
              ))}
            </div>
            
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Give fans a preview of what they're unlocking..."
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {description.length}/200 characters
              </p>
            </div>
            
            {/* Options */}
            <div className="space-y-3">
              {/* Exclusive content */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isExclusive}
                  onChange={(e) => setIsExclusive(e.target.checked)}
                  className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Exclusive Content
                  </p>
                  <p className="text-xs text-gray-500">
                    Mark as exclusive to increase perceived value
                  </p>
                </div>
              </label>
              
              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content Expires
                </label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="never">Never</option>
                  <option value="24h">After 24 hours</option>
                  <option value="48h">After 48 hours</option>
                  <option value="7d">After 7 days</option>
                  <option value="30d">After 30 days</option>
                </select>
              </div>
            </div>
            
            {/* Tips */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex gap-2">
                <InformationCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Pricing Tips:</p>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li>You keep 100% of all tokens earned</li>
                    <li>Exclusive content typically sells for 2-3x standard prices</li>
                    <li>Limited-time offers create urgency</li>
                    <li>Bundle similar content for better value</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <ChartBarIcon className="w-4 h-4" />
                <span>You earn: {price} tokens per unlock (100% yours)</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                >
                  Set Price & Send
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PPVPricingModal;