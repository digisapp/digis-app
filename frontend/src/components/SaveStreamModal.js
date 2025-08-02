import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  CurrencyDollarIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  XMarkIcon,
  LockClosedIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Button from './ui/Button';
import Card from './ui/Card';

const SaveStreamModal = ({
  isOpen,
  onClose,
  streamData,
  onSave,
  user
}) => {
  const [title, setTitle] = useState(streamData?.title || 'Live Stream Recording');
  const [description, setDescription] = useState(streamData?.description || '');
  const [accessType, setAccessType] = useState('paid'); // 'free' or 'paid'
  const [tokenPrice, setTokenPrice] = useState(10);
  const [thumbnail, setThumbnail] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title for your stream');
      return;
    }

    if (accessType === 'paid' && tokenPrice < 1) {
      toast.error('Token price must be at least 1');
      return;
    }

    setIsSaving(true);

    try {
      // Simulate save progress
      const progressInterval = setInterval(() => {
        setSaveProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 300);

      const saveData = {
        title,
        description,
        accessType,
        tokenPrice: accessType === 'paid' ? tokenPrice : 0,
        thumbnail,
        streamData,
        recordingUrl: streamData?.recordingUrl,
        duration: streamData?.duration,
        viewCount: 0,
        createdAt: new Date().toISOString()
      };

      await onSave(saveData);
      
      clearInterval(progressInterval);
      setSaveProgress(100);
      
      // toast.success('Stream saved successfully!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error saving stream:', error);
      toast.error('Failed to save stream');
      setIsSaving(false);
      setSaveProgress(0);
    }
  };

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Thumbnail must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnail(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

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
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl"
          >
            <Card className="p-0 overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-pink-600">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <VideoCameraIcon className="w-8 h-8" />
                    <div>
                      <h2 className="text-xl font-semibold">Save Your Stream</h2>
                      <p className="text-sm opacity-90">
                        Save and monetize your live stream recording
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Stream Info */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                      <p className="font-medium">{streamData?.duration || '00:00:00'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Viewers</p>
                      <p className="font-medium">{streamData?.viewerCount || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                      <p className="font-medium">{new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Stream Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-800 dark:text-white"
                    placeholder="Enter stream title"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-800 dark:text-white"
                    placeholder="Describe your stream content"
                  />
                </div>

                {/* Thumbnail */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Thumbnail
                  </label>
                  <div className="flex items-center gap-4">
                    {thumbnail ? (
                      <div className="relative w-32 h-20 rounded-lg overflow-hidden">
                        <img
                          src={thumbnail}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => setThumbnail(null)}
                          className="absolute top-1 right-1 p-1 bg-black/50 rounded-full"
                        >
                          <XMarkIcon className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                        <VideoCameraIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                      className="hidden"
                      id="thumbnail-upload"
                    />
                    <label
                      htmlFor="thumbnail-upload"
                      className="cursor-pointer px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Choose Image
                    </label>
                  </div>
                </div>

                {/* Access Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Access Type
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setAccessType('free')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        accessType === 'free'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <GlobeAltIcon className="w-6 h-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                      <p className="font-medium">Free to View</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Anyone can watch
                      </p>
                    </button>
                    <button
                      onClick={() => setAccessType('paid')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        accessType === 'paid'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <LockClosedIcon className="w-6 h-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                      <p className="font-medium">Pay to View</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Requires tokens
                      </p>
                    </button>
                  </div>
                </div>

                {/* Token Price */}
                {accessType === 'paid' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Token Price
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <CurrencyDollarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="number"
                          value={tokenPrice}
                          onChange={(e) => setTokenPrice(Math.max(1, parseInt(e.target.value) || 0))}
                          min="1"
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      <span className="text-gray-500 dark:text-gray-400">tokens</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Fans will pay {tokenPrice} tokens (${(tokenPrice * 0.05).toFixed(2)}) to watch
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                {isSaving ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CloudArrowUpIcon className="w-5 h-5 text-purple-600 animate-pulse" />
                        <span className="text-sm font-medium">Saving stream...</span>
                      </div>
                      <span className="text-sm text-gray-500">{saveProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <motion.div
                        className="bg-gradient-to-r from-purple-600 to-pink-600 h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${saveProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    {saveProgress === 100 && (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircleIcon className="w-5 h-5" />
                        <span className="text-sm">Stream saved successfully!</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={onClose}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={handleSave}
                      icon={<CloudArrowUpIcon className="w-5 h-5" />}
                    >
                      Save Stream
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SaveStreamModal;