import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  CurrencyDollarIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  XMarkIcon,
  LockClosedIcon,
  GlobeAltIcon,
  ClockIcon,
  EyeIcon,
  SparklesIcon,
  ChartBarIcon,
  PhotoIcon,
  CalendarIcon,
  TagIcon,
  UserGroupIcon,
  GiftIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import Button from './ui/Button';
import Card from './ui/Card';
import { createClient } from '@supabase/supabase-js';
import { getAuthToken } from '../utils/supabase-auth';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const SaveStreamModal = ({
  isOpen,
  onClose,
  streamData,
  onSave,
  user
}) => {
  // Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState([]);
  const [currentTag, setCurrentTag] = useState('');
  
  // Monetization
  const [accessType, setAccessType] = useState('paid'); // 'free', 'paid', 'subscribers'
  const [tokenPrice, setTokenPrice] = useState(10);
  const [earlyBirdPrice, setEarlyBirdPrice] = useState(0);
  const [earlyBirdHours, setEarlyBirdHours] = useState(24);
  const [previewDuration, setPreviewDuration] = useState(60); // seconds
  
  // Publishing
  const [publishType, setPublishType] = useState('immediate'); // 'immediate', 'scheduled', 'private'
  const [scheduledDate, setScheduledDate] = useState('');
  const [visibility, setVisibility] = useState('public'); // 'public', 'unlisted', 'private'
  
  // Media
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [autoGenerateThumbnail, setAutoGenerateThumbnail] = useState(true);
  
  // Progress
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Initialize with stream data
  useEffect(() => {
    if (streamData) {
      setTitle(streamData.title || `Stream Recording ${new Date().toLocaleDateString()}`);
      setDescription(streamData.description || '');
      setTokenPrice(streamData.suggestedPrice || 10);
      setThumbnailUrl(streamData.thumbnail_url);
      
      // Set early bird price (20% discount)
      if (streamData.suggestedPrice) {
        setEarlyBirdPrice(Math.ceil(streamData.suggestedPrice * 0.8));
      }
    }
  }, [streamData]);

  // Categories for streams
  const categories = [
    'Gaming', 'Music', 'Art', 'Model', 'Fitness', 'Yoga', 'Cooking', 'Dance', 
    'Comedy', 'Education', 'Lifestyle', 'Fashion', 'Tech', 'Sports', 
    'Travel', 'Photography', 'Crafts', 'Beauty', 'Business', 'Meditation', 'Other'
  ];

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const handleAddTag = () => {
    if (currentTag.trim() && tags.length < 5) {
      const tag = currentTag.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!tags.includes(tag)) {
        setTags([...tags, tag]);
        setCurrentTag('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title for your stream');
      return;
    }

    if (accessType === 'paid' && tokenPrice < 1) {
      toast.error('Token price must be at least 1');
      return;
    }

    if (!streamData?.streamId) {
      toast.error('Stream ID is required');
      return;
    }

    setIsSaving(true);

    try {
      // Upload thumbnail to Supabase if provided
      let finalThumbnailUrl = thumbnailUrl;
      if (thumbnail && !isUploading) {
        setIsUploading(true);
        setSaveProgress(10);
        
        // Convert base64 to blob if needed
        const blob = thumbnail.startsWith('data:') 
          ? await fetch(thumbnail).then(r => r.blob())
          : thumbnail;
        
        const fileName = `thumbnails/${streamData.streamId}/${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('stream-recordings')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: false
          });
        
        if (uploadError) {
          console.error('Thumbnail upload error:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('stream-recordings')
            .getPublicUrl(fileName);
          finalThumbnailUrl = urlData.publicUrl;
        }
        setSaveProgress(30);
      }

      // Save recording metadata with enhanced options
      setSaveProgress(50);
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/recording/streams/${streamData.streamId}/save-recording`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken()}`
          },
          body: JSON.stringify({
            title,
            description,
            category,
            tags,
            accessType,
            tokenPrice: accessType === 'paid' ? tokenPrice : 0,
            earlyBirdPrice: accessType === 'paid' && earlyBirdPrice > 0 ? earlyBirdPrice : null,
            earlyBirdHours: earlyBirdPrice > 0 ? earlyBirdHours : null,
            previewDuration,
            publishType,
            scheduledDate: publishType === 'scheduled' ? scheduledDate : null,
            visibility,
            thumbnailUrl: finalThumbnailUrl,
            duration: streamData.duration,
            viewerCount: streamData.viewerCount,
            peakViewers: streamData.peakViewers,
            totalRevenue: streamData.totalRevenue
          })
        }
      );

      setSaveProgress(80);

      if (!response.ok) {
        throw new Error('Failed to save recording');
      }

      const result = await response.json();
      setSaveProgress(100);
      
      // Call onSave callback with the saved recording data
      // Format it to match the Modern Content Gallery's streams format
      if (onSave) {
        const formattedStream = {
          id: result.recording.id || `stream-${Date.now()}`,
          title: result.recording.title,
          description: result.recording.description,
          thumbnail: finalThumbnailUrl || '/api/placeholder/400/300',
          url: result.recording.url || result.recording.recording_url,
          duration: result.recording.duration,
          viewerCount: result.recording.viewer_count || streamData.viewerCount,
          peakViewers: result.recording.peak_viewers || streamData.peakViewers,
          recordedAt: result.recording.created_at || new Date().toISOString(),
          category: result.recording.category,
          tags: result.recording.tags,
          price: result.recording.token_price || tokenPrice,
          isLocked: accessType === 'paid',
          revenue: result.recording.total_revenue || streamData.totalRevenue,
          gifts: result.recording.total_gifts || streamData.totalGifts,
          visibility: result.recording.visibility,
          publishType: result.recording.publish_type,
          accessType: result.recording.access_type || accessType
        };
        await onSave(formattedStream);
      }
      
      // Show success message with details
      const priceDisplay = accessType === 'paid' 
        ? `${tokenPrice} tokens ($${(tokenPrice * 0.05).toFixed(2)})`
        : 'Free';
      
      toast.success(
        <div>
          <p className="font-semibold">🎬 Recording Saved Successfully!</p>
          <p className="text-sm mt-1">Title: {title}</p>
          <p className="text-sm">Price: {priceDisplay}</p>
          {earlyBirdPrice > 0 && (
            <p className="text-sm">Early Bird: {earlyBirdPrice} tokens for {earlyBirdHours}h</p>
          )}
          <p className="text-sm mt-1">
            {publishType === 'immediate' 
              ? 'Now live on your profile!' 
              : publishType === 'scheduled'
              ? `Will be published on ${new Date(scheduledDate).toLocaleDateString()}`
              : 'Saved as private (only you can see it)'}
          </p>
        </div>,
        { duration: 5000 }
      );
      
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error saving stream:', error);
      toast.error('Failed to save stream recording');
      setIsSaving(false);
      setSaveProgress(0);
      setIsUploading(false);
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
        setThumbnailUrl(reader.result);
        setAutoGenerateThumbnail(false);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSaving) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <VideoCameraIcon className="w-8 h-8" />
                <div>
                  <h2 className="text-2xl font-bold">Save Your Recording</h2>
                  <p className="text-purple-100 text-sm mt-1">
                    Customize and monetize your stream recording
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={isSaving}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Stream Stats Bar */}
            {streamData && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4 bg-white/10 rounded-lg p-3">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    <span className="text-xs opacity-80">Duration</span>
                  </div>
                  <p className="font-semibold">{formatDuration(streamData.duration || 0)}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <UserGroupIcon className="w-4 h-4" />
                    <span className="text-xs opacity-80">Viewers</span>
                  </div>
                  <p className="font-semibold">{streamData.viewerCount || 0}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <ChartBarIcon className="w-4 h-4" />
                    <span className="text-xs opacity-80">Peak</span>
                  </div>
                  <p className="font-semibold">{streamData.peakViewers || 0}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <GiftIcon className="w-4 h-4" />
                    <span className="text-xs opacity-80">Gifts</span>
                  </div>
                  <p className="font-semibold">{streamData.totalGifts || 0}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <CurrencyDollarIcon className="w-4 h-4" />
                    <span className="text-xs opacity-80">Revenue</span>
                  </div>
                  <p className="font-semibold">${((streamData.totalRevenue || 0) * 0.05).toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Basic Info */}
              <div className="space-y-4">
                <Card className="p-4">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                    <SparklesIcon className="w-5 h-5 text-purple-600" />
                    Basic Information
                  </h3>
                  
                  {/* Title */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Give your recording a catchy title..."
                      maxLength={100}
                    />
                    <p className="text-xs text-gray-500 mt-1">{title.length}/100</p>
                  </div>

                  {/* Description */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={3}
                      placeholder="Describe what viewers will see..."
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500 mt-1">{description.length}/500</p>
                  </div>

                  {/* Category */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (max 5)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Add a tag..."
                        maxLength={20}
                      />
                      <Button
                        onClick={handleAddTag}
                        variant="secondary"
                        disabled={!currentTag.trim() || tags.length >= 5}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                        >
                          <TagIcon className="w-3 h-3" />
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-purple-900"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* Thumbnail */}
                <Card className="p-4">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <PhotoIcon className="w-5 h-5 text-purple-600" />
                    Thumbnail
                  </h3>
                  
                  <div className="space-y-3">
                    {thumbnailUrl ? (
                      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                        <img 
                          src={thumbnailUrl} 
                          alt="Thumbnail preview" 
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => {
                            setThumbnail(null);
                            setThumbnailUrl(null);
                            setAutoGenerateThumbnail(true);
                          }}
                          className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <PhotoIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">No thumbnail uploaded</p>
                          <p className="text-gray-400 text-xs mt-1">Auto-generated from stream</p>
                        </div>
                      </div>
                    )}
                    
                    <label className="block">
                      <span className="sr-only">Choose thumbnail</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailChange}
                        className="block w-full text-sm text-gray-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-lg file:border-0
                          file:text-sm file:font-medium
                          file:bg-purple-50 file:text-purple-700
                          hover:file:bg-purple-100
                          cursor-pointer"
                      />
                    </label>
                  </div>
                </Card>
              </div>

              {/* Right Column - Monetization & Publishing */}
              <div className="space-y-4">
                {/* Monetization */}
                <Card className="p-4">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <CurrencyDollarIcon className="w-5 h-5 text-purple-600" />
                    Monetization
                  </h3>

                  {/* Access Type */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Access Type
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setAccessType('free')}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          accessType === 'free'
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <GlobeAltIcon className="w-5 h-5 mx-auto mb-1" />
                        <span className="text-sm">Free</span>
                      </button>
                      <button
                        onClick={() => setAccessType('paid')}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          accessType === 'paid'
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <CurrencyDollarIcon className="w-5 h-5 mx-auto mb-1" />
                        <span className="text-sm">Paid</span>
                      </button>
                      <button
                        onClick={() => setAccessType('subscribers')}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          accessType === 'subscribers'
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <StarIcon className="w-5 h-5 mx-auto mb-1" />
                        <span className="text-sm">Subscribers</span>
                      </button>
                    </div>
                  </div>

                  {/* Pricing Options */}
                  {accessType === 'paid' && (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Regular Price (tokens)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={tokenPrice}
                            onChange={(e) => setTokenPrice(Math.max(1, parseInt(e.target.value) || 0))}
                            className="w-full pl-10 pr-20 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            min="1"
                            max="10000"
                          />
                          <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                            ≈ ${(tokenPrice * 0.05).toFixed(2)}
                          </span>
                        </div>
                        {streamData?.suggestedPrice && (
                          <p className="text-xs text-gray-500 mt-1">
                            Suggested: {streamData.suggestedPrice} tokens based on {streamData.durationMinutes}min duration
                          </p>
                        )}
                      </div>

                      {/* Early Bird Pricing */}
                      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-center gap-2 mb-2">
                          <BoltIcon className="w-5 h-5 text-yellow-600" />
                          <span className="font-medium text-sm">Early Bird Special</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Early Price (tokens)
                            </label>
                            <input
                              type="number"
                              value={earlyBirdPrice}
                              onChange={(e) => setEarlyBirdPrice(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="0 to disable"
                              min="0"
                              max={tokenPrice - 1}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Duration (hours)
                            </label>
                            <input
                              type="number"
                              value={earlyBirdHours}
                              onChange={(e) => setEarlyBirdHours(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              min="1"
                              max="168"
                            />
                          </div>
                        </div>
                        {earlyBirdPrice > 0 && (
                          <p className="text-xs text-yellow-700 mt-2">
                            {Math.round((1 - earlyBirdPrice/tokenPrice) * 100)}% discount for first {earlyBirdHours} hours
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Preview Settings */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Free Preview Duration
                    </label>
                    <select
                      value={previewDuration}
                      onChange={(e) => setPreviewDuration(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value={0}>No preview</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                      <option value={120}>2 minutes</option>
                      <option value={180}>3 minutes</option>
                    </select>
                  </div>
                </Card>

                {/* Publishing Options */}
                <Card className="p-4">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-purple-600" />
                    Publishing
                  </h3>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      When to Publish
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          value="immediate"
                          checked={publishType === 'immediate'}
                          onChange={(e) => setPublishType(e.target.value)}
                          className="text-purple-600"
                        />
                        <div>
                          <p className="font-medium">Publish Immediately</p>
                          <p className="text-xs text-gray-500">Make available right away</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          value="scheduled"
                          checked={publishType === 'scheduled'}
                          onChange={(e) => setPublishType(e.target.value)}
                          className="text-purple-600"
                        />
                        <div>
                          <p className="font-medium">Schedule for Later</p>
                          <p className="text-xs text-gray-500">Set a future publish date</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          value="private"
                          checked={publishType === 'private'}
                          onChange={(e) => setPublishType(e.target.value)}
                          className="text-purple-600"
                        />
                        <div>
                          <p className="font-medium">Save as Private</p>
                          <p className="text-xs text-gray-500">Only you can see it</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {publishType === 'scheduled' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Publish Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* Visibility */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visibility
                    </label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="public">Public - Anyone can find it</option>
                      <option value="unlisted">Unlisted - Only with link</option>
                      <option value="private">Private - Only you</option>
                    </select>
                  </div>
                </Card>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t">
            {isSaving ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Saving your recording...</span>
                  <span>{saveProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${saveProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {accessType === 'paid' && (
                    <p>
                      Estimated earnings: {tokenPrice} tokens × viewers = 
                      <span className="font-semibold ml-1">
                        ${((tokenPrice * (streamData?.viewerCount || 1)) * 0.05).toFixed(2)}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={onClose}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !title.trim()}
                    className="min-w-[120px]"
                  >
                    <CloudArrowUpIcon className="w-5 h-5 mr-2" />
                    Save & Publish
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SaveStreamModal;