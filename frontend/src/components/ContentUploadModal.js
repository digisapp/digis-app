import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  PhotoIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
  CloudArrowUpIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import toast from 'react-hot-toast';

const ContentUploadModal = ({
  isOpen,
  onClose,
  contentType,
  onUpload
}) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tokenCost, setTokenCost] = useState(0);
  const [isPaid, setIsPaid] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Get icon based on content type
  const getContentIcon = () => {
    switch (contentType) {
      case 'photo':
        return <PhotoIcon className="w-8 h-8" />;
      case 'video':
        return <VideoCameraIcon className="w-8 h-8" />;
      case 'audio':
        return <MusicalNoteIcon className="w-8 h-8" />;
      default:
        return <DocumentTextIcon className="w-8 h-8" />;
    }
  };

  // Get accepted file types based on content type
  const getAcceptedFileTypes = () => {
    switch (contentType) {
      case 'photo':
        return 'image/*';
      case 'video':
        return 'video/*';
      case 'audio':
        return 'audio/*';
      default:
        return '*';
    }
  };

  // Get max file size based on content type
  const getMaxFileSize = () => {
    switch (contentType) {
      case 'photo':
        return 10 * 1024 * 1024; // 10MB
      case 'video':
        return 500 * 1024 * 1024; // 500MB
      case 'audio':
        return 50 * 1024 * 1024; // 50MB
      default:
        return 10 * 1024 * 1024; // 10MB
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    if (!selectedFile) return;

    // Check file size
    const maxSize = getMaxFileSize();
    if (selectedFile.size > maxSize) {
      toast.error(`File size must be less than ${formatFileSize(maxSize)}`);
      return;
    }

    setFile(selectedFile);

    // Create preview for images and videos
    if (contentType === 'photo' || contentType === 'video') {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    } else if (contentType === 'audio') {
      // For audio, just show the file name
      setPreview(selectedFile.name);
    }

    // Auto-generate title from filename if empty
    if (!title) {
      const fileName = selectedFile.name.split('.').slice(0, -1).join('.');
      setTitle(fileName.replace(/[-_]/g, ' '));
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (isPaid && tokenCost < 1) {
      toast.error('Token cost must be at least 1 for paid content');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Create content object
      const newContent = {
        id: `${contentType}-${Date.now()}`,
        type: contentType,
        title: title.trim(),
        description: description.trim(),
        url: preview || URL.createObjectURL(file),
        thumbnail: preview || URL.createObjectURL(file),
        file: file,
        fileName: file.name,
        fileSize: file.size,
        price: isPaid ? tokenCost : 0,
        isLocked: isPaid,
        uploadedAt: new Date().toISOString(),
        views: 0,
        likes: 0,
        shares: 0,
        purchases: 0
      };

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Call the onUpload callback
      if (onUpload) {
        await onUpload(newContent);
      }

      toast.success(
        <div>
          <p className="font-semibold">Content uploaded successfully!</p>
          <p className="text-sm">{title}</p>
          {isPaid && <p className="text-sm">Price: {tokenCost} tokens</p>}
        </div>
      );

      // Reset form and close modal
      setTimeout(() => {
        resetForm();
        onClose();
      }, 500);

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload content. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setTitle('');
    setDescription('');
    setTokenCost(0);
    setIsPaid(false);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleClose = () => {
    if (isUploading) {
      toast.error('Please wait for the upload to complete');
      return;
    }
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isUploading) {
            handleClose();
          }
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getContentIcon()}
                <div>
                  <h2 className="text-2xl font-bold">
                    Upload {contentType.charAt(0).toUpperCase() + contentType.slice(1)}
                  </h2>
                  <p className="text-purple-100 text-sm mt-1">
                    Add new {contentType} to your gallery
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isUploading}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* File Upload Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select File
              </label>
              {!file ? (
                <label className="block">
                  <input
                    type="file"
                    accept={getAcceptedFileTypes()}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-500 transition-colors cursor-pointer">
                    <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Max size: {formatFileSize(getMaxFileSize())}
                    </p>
                  </div>
                </label>
              ) : (
                <div className="border border-gray-200 rounded-xl p-4">
                  {/* Preview */}
                  {contentType === 'photo' && preview && (
                    <img 
                      src={preview} 
                      alt="Preview" 
                      className="w-full h-48 object-cover rounded-lg mb-3"
                    />
                  )}
                  {contentType === 'video' && preview && (
                    <video 
                      src={preview} 
                      controls 
                      className="w-full h-48 rounded-lg mb-3"
                    />
                  )}
                  {contentType === 'audio' && (
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg mb-3">
                      <MusicalNoteIcon className="w-8 h-8 text-purple-600" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Change File Button */}
                  <label className="block">
                    <input
                      type="file"
                      accept={getAcceptedFileTypes()}
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled={isUploading}
                    >
                      Change File
                    </Button>
                  </label>
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter a title for your content"
                maxLength={100}
                disabled={isUploading}
              />
              <p className="text-xs text-gray-500 mt-1">{title.length}/100</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={3}
                placeholder="Add a description..."
                maxLength={500}
                disabled={isUploading}
              />
              <p className="text-xs text-gray-500 mt-1">{description.length}/500</p>
            </div>

            {/* Monetization */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CurrencyDollarIcon className="w-5 h-5 text-purple-600" />
                  <span className="font-medium">Monetization</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    className="sr-only peer"
                    disabled={isUploading}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    {isPaid ? 'Paid' : 'Free'}
                  </span>
                </label>
              </div>

              {isPaid && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <label className="block text-sm font-medium text-gray-700">
                    Token Cost
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={tokenCost}
                      onChange={(e) => setTokenCost(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full pl-10 pr-20 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter token amount"
                      min="1"
                      max="10000"
                      disabled={isUploading}
                    />
                    <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      ≈ ${(tokenCost * 0.05).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Fans will need to pay {tokenCost} tokens to unlock this content
                  </p>
                </motion.div>
              )}
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {file && !isUploading && (
                  <span className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                    Ready to upload
                  </span>
                )}
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={handleClose}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!file || !title.trim() || isUploading}
                  className="min-w-[120px]"
                >
                  {isUploading ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <CloudArrowUpIcon className="w-5 h-5" />
                      </motion.div>
                      Uploading...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CloudArrowUpIcon className="w-5 h-5" />
                      Upload
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ContentUploadModal;