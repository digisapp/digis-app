import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ImageCropModal from './media/ImageCropModal';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import {
  PhotoIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  XMarkIcon,
  SparklesIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';

const SimpleProfileImageUploader = ({ 
  user,
  onImagesUpdated,
  currentImages = {},
  onClose
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [croppedAvatarFile, setCroppedAvatarFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');

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
    setOriginalImageUrl(url);
    setShowCropper(true);
  };

  // Handle avatar crop completion
  const handleAvatarCropped = (croppedFile) => {
    setCroppedAvatarFile(croppedFile);
    setShowCropper(false);
  };

  // Upload both images
  const handleUpload = async () => {
    if (!selectedFile || !croppedAvatarFile) {
      toast.error('Please complete the image selection');
      return;
    }

    setUploading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. Upload original image as creator card
      setUploadStep('Uploading creator card image...');
      const cardFormData = new FormData();
      cardFormData.append('file', selectedFile);
      cardFormData.append('type', 'card');
      
      const cardResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/users/upload-profile-image`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: cardFormData
        }
      );
      
      if (!cardResponse.ok) {
        throw new Error('Failed to upload creator card image');
      }
      
      const cardData = await cardResponse.json();
      
      // 2. Upload cropped avatar
      setUploadStep('Uploading profile avatar...');
      const avatarFormData = new FormData();
      avatarFormData.append('file', croppedAvatarFile);
      avatarFormData.append('type', 'avatar');
      
      const avatarResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/users/upload-profile-image`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: avatarFormData
        }
      );
      
      if (!avatarResponse.ok) {
        throw new Error('Failed to upload avatar image');
      }
      
      const avatarData = await avatarResponse.json();
      
      // 3. Update profile with avatar URL
      setUploadStep('Updating profile...');
      const profileData = {
        uid: user.id,
        profile_pic_url: avatarData.url
      };
      
      const updateResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/users/profile`,
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
        toast.success('Profile images updated successfully!');
        if (onImagesUpdated) {
          onImagesUpdated({
            avatar: avatarData.url,
            card: cardData.url
          });
        }
        onClose();
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  // Reset everything
  const handleReset = () => {
    setSelectedFile(null);
    setOriginalImageUrl(null);
    setCroppedAvatarFile(null);
    setShowCropper(false);
  };

  return (
    <>
      <AnimatePresence>
        {!showCropper && !uploading && (
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
                        <PhotoIcon className="w-6 h-6" />
                        Profile & Creator Card Image
                      </h2>
                      <p className="text-sm text-white/80 mt-1">
                        One image for both uses
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
                  {!originalImageUrl ? (
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
                          Upload a high-quality portrait photo
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
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-800 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm">1</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                Upload Your Best Photo
                              </p>
                              <p className="text-xs text-purple-600 dark:text-purple-400">
                                This full image becomes your creator card
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-800 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm">2</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                Crop Your Face for Avatar
                              </p>
                              <p className="text-xs text-purple-600 dark:text-purple-400">
                                We'll guide you to crop your face for the profile circle
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-800 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm">3</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                Done!
                              </p>
                              <p className="text-xs text-purple-600 dark:text-purple-400">
                                Both images update instantly across the platform
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Preview Section
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Creator Card Preview */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Creator Card
                          </h4>
                          <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                            <img
                              src={originalImageUrl}
                              alt="Creator Card"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            Full image for Explore page
                          </p>
                        </div>
                        
                        {/* Avatar Preview */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Profile Avatar
                          </h4>
                          <div className="aspect-square flex items-center justify-center">
                            <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                              {croppedAvatarFile ? (
                                <img
                                  src={URL.createObjectURL(croppedAvatarFile)}
                                  alt="Avatar"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                  <UserCircleIcon className="w-16 h-16" />
                                  <span className="text-xs mt-2">Click to crop</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            Cropped face for profile circle
                          </p>
                        </div>
                      </div>
                      
                      {!croppedAvatarFile && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            ⚠️ Click "Crop Avatar" to select your face for the profile picture
                          </p>
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div className="flex justify-between">
                        <button
                          onClick={handleReset}
                          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          Choose Different Image
                        </button>
                        
                        <div className="flex gap-3">
                          {!croppedAvatarFile && (
                            <button
                              onClick={() => setShowCropper(true)}
                              className="px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 border border-purple-600 dark:border-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                            >
                              Crop Avatar
                            </button>
                          )}
                          
                          <button
                            onClick={handleUpload}
                            disabled={!croppedAvatarFile}
                            className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                          >
                            <CheckCircleIcon className="w-5 h-5" />
                            Save Both Images
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Image Cropper Modal for Avatar */}
      {showCropper && originalImageUrl && (
        <ImageCropModal
          isOpen={true}
          cropType="avatar"
          file={originalImageUrl}
          onClose={() => setShowCropper(false)}
          onSave={handleAvatarCropped}
        />
      )}
      
      {/* Uploading Overlay */}
      {uploading && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm w-full mx-4">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Uploading Images
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {uploadStep || 'Processing...'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SimpleProfileImageUploader;