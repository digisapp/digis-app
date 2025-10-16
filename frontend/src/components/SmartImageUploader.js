import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ImageCropModal from './media/ImageCropModal';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import {
  PhotoIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  PencilIcon,
  XMarkIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const SmartImageUploader = ({ 
  user,
  onImagesUpdated,
  currentImages = {},
  onClose
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [currentCropType, setCurrentCropType] = useState(null);
  const [currentCropIndex, setCurrentCropIndex] = useState(0);
  const [croppedImages, setCroppedImages] = useState({
    avatar: null,
    card: null
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  
  // Define crop configurations - Avatar for face, Card for full body/scene
  const cropConfigs = [
    {
      type: 'avatar',
      title: 'Profile Picture (Face)',
      aspectRatio: 1,
      description: 'Square crop focused on your face',
      icon: '👤',
      preview: 'Your profile circle - crop close to your face',
      instructions: 'Zoom in and focus on your face for the best avatar'
    },
    {
      type: 'card',
      title: 'Creator Card Display',
      aspectRatio: 3/4,
      description: 'Full portrait for your creator card',
      icon: '🎴',
      preview: 'Shows on the Explore page - include more of yourself',
      instructions: 'Show more of yourself or your scene for the card'
    }
  ];

  // Handle file selection
  const handleFileSelect = (file) => {
    if (!file) return;
    
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, GIF, or WebP image');
      return;
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('Image is too large. Max size is 10MB');
      return;
    }
    
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    
    // Start with first crop type
    setCurrentCropType(cropConfigs[0].type);
    setCurrentCropIndex(0);
  };

  // Handle crop completion for current type
  const handleCropComplete = async (croppedFile) => {
    const currentConfig = cropConfigs[currentCropIndex];
    
    // Store the cropped image
    setCroppedImages(prev => ({
      ...prev,
      [currentConfig.type]: croppedFile
    }));
    
    // Move to next crop type or finish
    if (currentCropIndex < cropConfigs.length - 1) {
      setCurrentCropIndex(currentCropIndex + 1);
      setCurrentCropType(cropConfigs[currentCropIndex + 1].type);
    } else {
      // All crops complete, upload them
      setCurrentCropType(null);
      await uploadAllImages();
    }
  };

  // Upload all cropped images
  const uploadAllImages = async () => {
    setUploading(true);
    const uploadedUrls = {};
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      for (const [type, file] of Object.entries(croppedImages)) {
        if (!file) continue;
        
        setUploadProgress(prev => ({ ...prev, [type]: 0 }));
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/users/upload-profile-image`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: formData
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          uploadedUrls[type] = data.url;
          setUploadProgress(prev => ({ ...prev, [type]: 100 }));
        } else {
          throw new Error(`Failed to upload ${type} image`);
        }
      }
      
      // Update profile with new avatar URL
      const profileData = {
        uid: user.id,
        profile_pic_url: uploadedUrls.avatar || currentImages.avatar
        // Banner remains separate and unchanged
      };
      
      const updateResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/users/profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify(profileData)
        }
      );
      
      if (updateResponse.ok) {
        toast.success('All images updated successfully!');
        if (onImagesUpdated) {
          onImagesUpdated(uploadedUrls);
        }
        onClose();
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  // Skip current crop and use existing or auto-crop
  const handleSkipCrop = () => {
    const currentConfig = cropConfigs[currentCropIndex];
    
    // Use existing image or set as null
    setCroppedImages(prev => ({
      ...prev,
      [currentConfig.type]: null
    }));
    
    // Move to next crop
    if (currentCropIndex < cropConfigs.length - 1) {
      setCurrentCropIndex(currentCropIndex + 1);
      setCurrentCropType(cropConfigs[currentCropIndex + 1].type);
    } else {
      setCurrentCropType(null);
      uploadAllImages();
    }
  };

  return (
    <>
      <AnimatePresence>
        {!currentCropType && !uploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto"
          >
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
              />
              
              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, type: "spring", bounce: 0.3 }}
                className="relative inline-block align-bottom bg-white dark:bg-gray-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6" />
                        Smart Profile Image
                      </h2>
                      <p className="text-sm text-white/80 mt-1">
                        One image, perfectly cropped for avatar and card
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <XMarkIcon className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
                
                {/* Content */}
                <div className="px-6 py-6">
                  {!imagePreview ? (
                    // File Upload Section
                    <div className="space-y-6">
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center">
                        <PhotoIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                        <label className="cursor-pointer">
                          <span className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105">
                            <ArrowUpTrayIcon className="w-5 h-5" />
                            Choose Image
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileSelect(e.target.files[0])}
                            className="hidden"
                          />
                        </label>
                        <p className="text-sm text-gray-500 mt-4">
                          Upload a high-quality image (recommended: 2000x2000px or larger)
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          JPG, PNG, GIF or WebP • Max 10MB
                        </p>
                      </div>
                      
                      {/* How it works */}
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                        <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-3">
                          ✨ How It Works
                        </h3>
                        <div className="space-y-2 text-sm text-purple-600 dark:text-purple-400">
                          <div className="flex items-start gap-2">
                            <span className="text-purple-500">1.</span>
                            <span>Upload your best photo</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-purple-500">2.</span>
                            <span>Crop close to your face for the avatar</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-purple-500">3.</span>
                            <span>Show more of yourself for the creator card</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Preview Cards */}
                      <div className="grid grid-cols-3 gap-4">
                        {cropConfigs.map((config, index) => (
                          <div key={config.type} className="text-center">
                            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-2">
                              <div className="text-2xl mb-2">{config.icon}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {config.title}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // Crop Progress Section
                    <div className="space-y-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Crop Progress
                        </h3>
                        <div className="flex items-center gap-2">
                          {cropConfigs.map((config, index) => (
                            <div
                              key={config.type}
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                                croppedImages[config.type]
                                  ? 'bg-green-500 text-white'
                                  : index === currentCropIndex
                                  ? 'bg-purple-600 text-white animate-pulse'
                                  : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {croppedImages[config.type] ? '✓' : index + 1}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Cropped Images Preview */}
                      <div className="grid grid-cols-3 gap-4">
                        {cropConfigs.map((config) => (
                          <div key={config.type} className="space-y-2">
                            <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                              {croppedImages[config.type] ? (
                                <img
                                  src={URL.createObjectURL(croppedImages[config.type])}
                                  alt={config.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                  <span className="text-2xl">{config.icon}</span>
                                  <span className="text-xs mt-1">Pending</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-center text-gray-600 dark:text-gray-400">
                              {config.title}
                            </p>
                          </div>
                        ))}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex justify-between">
                        <button
                          onClick={() => {
                            setImagePreview(null);
                            setSelectedFile(null);
                            setCroppedImages({
                              avatar: null,
                              card: null
                            });
                            setCurrentCropIndex(0);
                          }}
                          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          Start Over
                        </button>
                        <button
                          onClick={() => uploadAllImages()}
                          disabled={!Object.values(croppedImages).some(img => img !== null)}
                          className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          Upload All Images
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Image Cropper Modal */}
      {currentCropType && imagePreview && (
        <ImageCropModal
          isOpen={true}
          cropType={currentCropType}
          file={imagePreview}
          onClose={handleSkipCrop}
          onSave={handleCropComplete}
          aspectRatio={currentCropType === 'card' ? '3:4' : undefined}
          allowRatioChange={false}
        />
      )}
      
      {/* Show instructions overlay */}
      {currentCropType && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[10001] max-w-md">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-purple-600 text-white rounded-lg px-6 py-3 shadow-lg"
          >
            <p className="text-sm font-medium">
              💡 {cropConfigs[currentCropIndex].instructions}
            </p>
          </motion.div>
        </div>
      )}

      {/* Uploading Overlay */}
      {uploading && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Uploading Images...
            </h3>
            <div className="space-y-3">
              {cropConfigs.map((config) => (
                <div key={config.type} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {config.title}
                  </span>
                  {uploadProgress[config.type] !== undefined ? (
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all"
                          style={{ width: `${uploadProgress[config.type]}%` }}
                        />
                      </div>
                      {uploadProgress[config.type] === 100 && (
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Waiting...</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SmartImageUploader;