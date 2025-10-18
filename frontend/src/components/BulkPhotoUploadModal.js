import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CloudArrowUpIcon,
  PhotoIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TagIcon,
  CurrencyDollarIcon,
  LockClosedIcon,
  GlobeAltIcon,
  SparklesIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { getAuthToken } from '../utils/supabase-auth';
import toast from 'react-hot-toast';

const BulkPhotoUploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadResults, setUploadResults] = useState({ success: [], failed: [] });
  const [showResults, setShowResults] = useState(false);

  // Batch metadata that applies to all photos
  const [batchMetadata, setBatchMetadata] = useState({
    category: 'general',
    isPremium: false,
    price: '',
    pricingMode: 'individual', // 'individual' or 'bundle'
    bundleTitle: '',
    bundleDescription: '',
    applyToAll: true
  });

  // Individual metadata for each file
  const [individualMetadata, setIndividualMetadata] = useState({});

  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const categories = [
    { value: 'general', label: 'General', icon: '📷' },
    { value: 'headshots', label: 'Headshots', icon: '👤' },
    { value: 'full-body', label: 'Full Body', icon: '🧍' },
    { value: 'editorial', label: 'Editorial', icon: '📰' },
    { value: 'commercial', label: 'Commercial', icon: '💼' },
    { value: 'lifestyle', label: 'Lifestyle', icon: '🌟' }
  ];

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect({ target: { files: e.dataTransfer.files } });
    }
  }, []);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    // Validate each file
    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      // Check file type
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: Not an image file`);
        return;
      }

      // Check file size (100MB max)
      if (file.size > 100 * 1024 * 1024) {
        errors.push(`${file.name}: File size exceeds 100MB`);
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileWithPreview = Object.assign(file, {
          preview: e.target.result,
          id: Math.random().toString(36).substr(2, 9)
        });

        setSelectedFiles(prev => [...prev, fileWithPreview]);

        // Initialize individual metadata
        setIndividualMetadata(prev => ({
          ...prev,
          [fileWithPreview.id]: {
            title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
            description: '',
            tags: ''
          }
        }));
      };
      reader.readAsDataURL(file);
    });

    if (errors.length > 0) {
      toast.error(
        <div>
          <p className="font-semibold">Some files were skipped:</p>
          <ul className="text-xs mt-1">
            {errors.slice(0, 3).map((err, i) => <li key={i}>{err}</li>)}
            {errors.length > 3 && <li>...and {errors.length - 3} more</li>}
          </ul>
        </div>,
        { duration: 5000 }
      );
    }

    // Clear input
    if (e.target) {
      e.target.value = '';
    }
  };

  const removeFile = (fileId) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
    setIndividualMetadata(prev => {
      const newMetadata = { ...prev };
      delete newMetadata[fileId];
      return newMetadata;
    });
  };

  const updateIndividualMetadata = (fileId, field, value) => {
    setIndividualMetadata(prev => ({
      ...prev,
      [fileId]: {
        ...prev[fileId],
        [field]: value
      }
    }));
  };

  const handleUploadAll = async () => {
    if (selectedFiles.length === 0) {
      toast.error('No files selected');
      return;
    }

    // Validate bundle settings if in bundle mode
    if (batchMetadata.pricingMode === 'bundle' && selectedFiles.length > 1) {
      if (!batchMetadata.bundleTitle) {
        toast.error('Please enter a bundle title');
        return;
      }
    }

    setUploading(true);
    setUploadProgress({});
    setUploadResults({ success: [], failed: [] });
    setShowResults(false);

    const authToken = await getAuthToken();
    const results = { success: [], failed: [] };

    // Handle bundle upload differently
    if (batchMetadata.pricingMode === 'bundle' && selectedFiles.length > 1) {
      try {
        // Create bundle first
        const bundleFormData = new FormData();
        bundleFormData.append('title', batchMetadata.bundleTitle);
        bundleFormData.append('description', batchMetadata.bundleDescription || '');
        bundleFormData.append('category', batchMetadata.category);
        bundleFormData.append('is_premium', batchMetadata.isPremium);
        bundleFormData.append('price', batchMetadata.isPremium ? batchMetadata.price || '0' : '0');
        bundleFormData.append('photo_count', selectedFiles.length);

        // Upload all files as part of the bundle
        selectedFiles.forEach((file, index) => {
          bundleFormData.append(`photos[${index}]`, file);
          const metadata = individualMetadata[file.id] || {};
          bundleFormData.append(`titles[${index}]`, metadata.title || file.name.replace(/\.[^/.]+$/, ''));
          bundleFormData.append(`descriptions[${index}]`, metadata.description || '');
        });

        // Mark all as uploading
        selectedFiles.forEach(file => {
          setUploadProgress(prev => ({
            ...prev,
            [file.id]: { status: 'uploading', progress: 50 }
          }));
        });

        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/content/upload-bundle`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`
          },
          body: bundleFormData
        });

        if (response.ok) {
          const result = await response.json();

          // Mark all as success
          selectedFiles.forEach(file => {
            results.success.push({ file: file.name, content: result.bundle });
            setUploadProgress(prev => ({
              ...prev,
              [file.id]: { status: 'success', progress: 100 }
            }));
          });

          toast.success(`Successfully uploaded bundle: ${batchMetadata.bundleTitle}!`);
        } else {
          const error = await response.json();
          selectedFiles.forEach(file => {
            results.failed.push({ file: file.name, error: error.error || 'Bundle upload failed' });
            setUploadProgress(prev => ({
              ...prev,
              [file.id]: { status: 'failed', progress: 0 }
            }));
          });
        }
      } catch (error) {
        selectedFiles.forEach(file => {
          results.failed.push({ file: file.name, error: error.message || 'Bundle upload failed' });
          setUploadProgress(prev => ({
            ...prev,
            [file.id]: { status: 'failed', progress: 0 }
          }));
        });
      }
    } else {
      // Individual upload mode - upload files sequentially
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const metadata = individualMetadata[file.id] || {};

        try {
          const formData = new FormData();
          formData.append('file', file);

          // Use individual metadata if available, otherwise use batch metadata
          formData.append('title', metadata.title || file.name.replace(/\.[^/.]+$/, ''));
          formData.append('description', metadata.description || '');
          formData.append('category', batchMetadata.category);
          formData.append('tags', metadata.tags || '');
          formData.append('is_premium', batchMetadata.isPremium);
          formData.append('ppv_price', batchMetadata.isPremium ? batchMetadata.price || '0' : '0');
          formData.append('type', 'photo');

          // Update progress
          setUploadProgress(prev => ({
            ...prev,
            [file.id]: { status: 'uploading', progress: 0 }
          }));

          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/content/upload`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authToken}`
            },
            body: formData
          });

          if (response.ok) {
            const result = await response.json();
            results.success.push({ file: file.name, content: result.content });

            setUploadProgress(prev => ({
              ...prev,
              [file.id]: { status: 'success', progress: 100 }
            }));
          } else {
            const error = await response.json();
            results.failed.push({ file: file.name, error: error.error || 'Upload failed' });

            setUploadProgress(prev => ({
              ...prev,
              [file.id]: { status: 'failed', progress: 0 }
            }));
          }
        } catch (error) {
          results.failed.push({ file: file.name, error: error.message || 'Upload failed' });

          setUploadProgress(prev => ({
            ...prev,
            [file.id]: { status: 'failed', progress: 0 }
          }));
        }
      }
    }

    setUploadResults(results);
    setShowResults(true);
    setUploading(false);

    // Show summary toast
    if (results.success.length > 0 && batchMetadata.pricingMode !== 'bundle') {
      toast.success(`Successfully uploaded ${results.success.length} photo${results.success.length > 1 ? 's' : ''}!`);

      if (onUploadSuccess) {
        onUploadSuccess(results.success.map(r => r.content));
      }
    }

    if (results.failed.length > 0) {
      toast.error(`Failed to upload ${results.failed.length} photo${results.failed.length > 1 ? 's' : ''}`);
    }
  };

  const resetAndClose = () => {
    setSelectedFiles([]);
    setIndividualMetadata({});
    setUploadProgress({});
    setUploadResults({ success: [], failed: [] });
    setShowResults(false);
    setBatchMetadata({
      category: 'general',
      isPremium: false,
      price: '',
      pricingMode: 'individual',
      bundleTitle: '',
      bundleDescription: '',
      applyToAll: true
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !uploading) {
            resetAndClose();
          }
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-6 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <PhotoIcon className="w-8 h-8 text-purple-500" />
                  Bulk Photo Upload
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Upload multiple photos at once (up to 100 files)
                </p>
              </div>
              <button
                onClick={resetAndClose}
                disabled={uploading}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Upload Results */}
            {showResults && (
              <div className="space-y-3">
                {uploadResults.success.length > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-green-900 dark:text-green-100">
                          Successfully uploaded {uploadResults.success.length} photo{uploadResults.success.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {uploadResults.failed.length > 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <ExclamationCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-red-900 dark:text-red-100 mb-2">
                          Failed to upload {uploadResults.failed.length} photo{uploadResults.failed.length > 1 ? 's' : ''}
                        </p>
                        <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                          {uploadResults.failed.slice(0, 5).map((fail, i) => (
                            <li key={i}>• {fail.file}: {fail.error}</li>
                          ))}
                          {uploadResults.failed.length > 5 && (
                            <li>• ...and {uploadResults.failed.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* File Upload Area */}
            {selectedFiles.length < 100 && !uploading && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                    dragActive
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 scale-105'
                      : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500'
                  }`}
                >
                  <CloudArrowUpIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {dragActive ? 'Drop your photos here' : 'Click to upload or drag and drop'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    JPEG, PNG, WebP, GIF images up to 100MB each
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected (max 100)`
                      : 'You can select up to 100 photos at once'}
                  </p>
                </div>
              </div>
            )}

            {/* Batch Settings */}
            {selectedFiles.length > 0 && !uploading && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-purple-500" />
                  Batch Settings
                </h3>

                <div className="space-y-4">
                  {/* Pricing Mode Toggle */}
                  {selectedFiles.length > 1 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Pricing Mode
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setBatchMetadata(prev => ({ ...prev, pricingMode: 'individual' }))}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            batchMetadata.pricingMode === 'individual'
                              ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/30'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <PhotoIcon className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                          <p className="text-sm font-medium">Individual</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Each photo priced separately
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setBatchMetadata(prev => ({ ...prev, pricingMode: 'bundle' }))}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            batchMetadata.pricingMode === 'bundle'
                              ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/30'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <TagIcon className="w-5 h-5 mx-auto mb-1 text-green-500" />
                          <p className="text-sm font-medium">Bundle</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            One price for all {selectedFiles.length} photos
                          </p>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bundle Details (only show if bundle mode) */}
                  {batchMetadata.pricingMode === 'bundle' && selectedFiles.length > 1 && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                        <TagIcon className="w-5 h-5" />
                        <span className="font-semibold">Bundle Settings</span>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Bundle Title
                        </label>
                        <input
                          type="text"
                          value={batchMetadata.bundleTitle}
                          onChange={(e) => setBatchMetadata(prev => ({ ...prev, bundleTitle: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., Summer Photoshoot Collection"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Bundle Description
                        </label>
                        <textarea
                          value={batchMetadata.bundleDescription}
                          onChange={(e) => setBatchMetadata(prev => ({ ...prev, bundleDescription: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          rows={2}
                          placeholder="Describe this photo bundle..."
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Category
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {categories.map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => setBatchMetadata(prev => ({ ...prev, category: cat.value }))}
                            className={`p-2 rounded-lg border-2 transition-all text-sm ${
                              batchMetadata.category === cat.value
                                ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                          >
                            <span className="mr-1">{cat.icon}</span>
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Premium Settings */}
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={batchMetadata.isPremium}
                          onChange={(e) => setBatchMetadata(prev => ({ ...prev, isPremium: e.target.checked }))}
                          className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div className="flex items-center gap-2">
                          <LockClosedIcon className="w-5 h-5 text-purple-500" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {batchMetadata.pricingMode === 'bundle' ? 'Premium Bundle' : 'Premium Content'}
                          </span>
                        </div>
                      </label>

                      {batchMetadata.isPremium && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            <CurrencyDollarIcon className="w-4 h-4 inline mr-1" />
                            {batchMetadata.pricingMode === 'bundle'
                              ? `Bundle Price (${selectedFiles.length} photos)`
                              : 'Price per photo'} (tokens)
                          </label>
                          <input
                            type="number"
                            value={batchMetadata.price}
                            onChange={(e) => setBatchMetadata(prev => ({ ...prev, price: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder={batchMetadata.pricingMode === 'bundle' ? '50' : '10'}
                            min="0"
                          />
                          {batchMetadata.pricingMode === 'bundle' && batchMetadata.price && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              ≈ {(parseFloat(batchMetadata.price) / selectedFiles.length).toFixed(1)} tokens per photo
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Selected Photos ({selectedFiles.length})
                  </h3>
                  {!uploading && (
                    <button
                      onClick={() => {
                        setSelectedFiles([]);
                        setIndividualMetadata({});
                      }}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {selectedFiles.map((file) => {
                    const progress = uploadProgress[file.id];
                    const status = progress?.status || 'pending';

                    return (
                      <div
                        key={file.id}
                        className={`relative group bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden ${
                          status === 'success' ? 'ring-2 ring-green-500' :
                          status === 'failed' ? 'ring-2 ring-red-500' :
                          status === 'uploading' ? 'ring-2 ring-purple-500' : ''
                        }`}
                      >
                        {/* Preview Image */}
                        <div className="aspect-square">
                          <img
                            src={file.preview}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Status Overlay */}
                        {status !== 'pending' && (
                          <div className={`absolute inset-0 flex items-center justify-center ${
                            status === 'uploading' ? 'bg-purple-500/80' :
                            status === 'success' ? 'bg-green-500/80' :
                            'bg-red-500/80'
                          }`}>
                            {status === 'uploading' && (
                              <ArrowPathIcon className="w-8 h-8 text-white animate-spin" />
                            )}
                            {status === 'success' && (
                              <CheckCircleIcon className="w-8 h-8 text-white" />
                            )}
                            {status === 'failed' && (
                              <ExclamationCircleIcon className="w-8 h-8 text-white" />
                            )}
                          </div>
                        )}

                        {/* Remove Button */}
                        {!uploading && status === 'pending' && (
                          <button
                            onClick={() => removeFile(file.id)}
                            className="absolute top-2 right-2 p-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/50"
                          >
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </button>
                        )}

                        {/* File Name */}
                        <div className="p-2 bg-white dark:bg-gray-800">
                          <p className="text-xs font-medium text-gray-900 dark:text-white truncate" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {selectedFiles.length > 0 && (
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {uploading ? (
                    <span className="flex items-center gap-2">
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Uploading {Object.values(uploadProgress).filter(p => p.status === 'success').length} of {selectedFiles.length}...
                    </span>
                  ) : showResults ? (
                    <span>
                      Upload complete: {uploadResults.success.length} succeeded, {uploadResults.failed.length} failed
                    </span>
                  ) : (
                    <span>
                      Ready to upload {selectedFiles.length} photo{selectedFiles.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetAndClose}
                    disabled={uploading}
                    className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {showResults ? 'Close' : 'Cancel'}
                  </button>

                  {!showResults && (
                    <button
                      onClick={handleUploadAll}
                      disabled={uploading || selectedFiles.length === 0}
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      {uploading ? (
                        <>
                          <ArrowPathIcon className="w-5 h-5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <CloudArrowUpIcon className="w-5 h-5" />
                          Upload {selectedFiles.length} Photo{selectedFiles.length > 1 ? 's' : ''}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BulkPhotoUploadModal;
