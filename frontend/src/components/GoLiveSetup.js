import React, { useState, useRef, useEffect, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CurrencyDollarIcon,
  CheckCircleIcon,
  SparklesIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  CogIcon,
  AdjustmentsHorizontalIcon,
  SignalIcon,
  WifiIcon,
  TrophyIcon,
  PhotoIcon,
  HashtagIcon,
  CalendarIcon,
  LockClosedIcon,
  ClipboardDocumentCheckIcon,
  ShareIcon,
  GiftIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  BeakerIcon,
  DocumentDuplicateIcon,
  XMarkIcon,
  PlusIcon,
  ClockIcon,
  UserGroupIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';

const GoLiveSetup = ({ onGoLive, onCancel, user }) => {
  const [localTracks, setLocalTracks] = useState({ video: null, audio: null });
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamCategory, setStreamCategory] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceError, setDeviceError] = useState('');
  const [streamGoal, setStreamGoal] = useState({
    enabled: false,
    currentLevel: 1,
    level1: { amount: 5000, description: 'Level 1 Goal' },
    level2: { amount: 10000, description: 'Level 2 Goal' },
    level3: { amount: 25000, description: 'Level 3 Goal' }
  });
  
  // New state for enhancements
  const [thumbnailImage, setThumbnailImage] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [streamTags, setStreamTags] = useState([]);
  const [currentTag, setCurrentTag] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [streamPrivacy, setStreamPrivacy] = useState('public'); // public, followers, subscribers
  const [preStreamChecklist, setPreStreamChecklist] = useState({
    camera: false,
    audio: false,
    lighting: false,
    background: false,
    internet: false
  });
  const [shareToSocial, setShareToSocial] = useState({
    twitter: false,
    instagram: false,
    facebook: false
  });
  const [tipSettings, setTipSettings] = useState({
    enabled: true,
    minAmount: 100,
    suggestedAmounts: [100, 500, 1000, 5000]
  });
  const [moderationTools, setModerationTools] = useState({
    autoModEnabled: true,
    blockedWords: [],
    slowMode: false,
    slowModeDelay: 5
  });
  const [showAnalyticsPreview, setShowAnalyticsPreview] = useState(false);
  const [testStreamMode, setTestStreamMode] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  
  const streamTemplates = [
    { id: 'gaming', name: 'Gaming Stream', category: 'Gaming', tags: ['gaming', 'gameplay', 'live'], goals: { level1: 2000, level2: 5000, level3: 10000 } },
    { id: 'fitness', name: 'Workout Session', category: 'Fitness', tags: ['fitness', 'workout', 'health'], goals: { level1: 1000, level2: 3000, level3: 5000 } },
    { id: 'music', name: 'Live Concert', category: 'Music', tags: ['music', 'concert', 'performance'], goals: { level1: 5000, level2: 10000, level3: 20000 } },
    { id: 'education', name: 'Tutorial/Class', category: 'Education', tags: ['education', 'tutorial', 'learning'], goals: { level1: 1500, level2: 3500, level3: 7000 } }
  ];
  
  // Simplified audience control with just pricing
  const [audienceControl, setAudienceControl] = useState({
    visibility: 'public',
    joinPrice: 0,
    privateStreamPrice: 0,
    tokenRequirement: 0,
    minTokensPerMinute: 0,
    maxViewers: 0,
    ageRestriction: false,
    chatMode: 'everyone',
    chatMinTokens: 100
  });
  
  // Default advanced settings (hidden from UI)
  const [advancedSettings] = useState({
    videoResolution: '720p',
    frameRate: '30',
    autoRecord: true,
    allowDownloads: false,
    enableChatFilters: true,
    slowMode: false,
    notifySubscribers: true,
    scheduleStream: false
  });
  
  const videoRef = useRef(null);
  const clientRef = useRef(null);
  const fileInputRef = useRef(null);

  const categories = [
    'Gaming', 'Music', 'Art', 'Fitness', 'Yoga', 'Cooking', 'Dance', 'Comedy',
    'Education', 'Lifestyle', 'Fashion', 'Tech', 'Sports', 'Travel',
    'Photography', 'Crafts', 'Beauty', 'Business', 'Meditation', 'Other'
  ];

  const cleanupTracks = useCallback(() => {
    if (localTracks.video) {
      localTracks.video.stop();
      localTracks.video.close();
    }
    if (localTracks.audio) {
      localTracks.audio.stop();
      localTracks.audio.close();
    }
  }, [localTracks.video, localTracks.audio]);

  useEffect(() => {
    initializeCamera();
    return () => {
      cleanupTracks();
    };
  }, [cleanupTracks]);

  const initializeCamera = async () => {
    try {
      setDeviceError('');
      
      // Create Agora client
      clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      
      // Create local tracks
      const [videoTrack, audioTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      
      setLocalTracks({ video: videoTrack, audio: audioTrack });
      
      // Play video track in preview
      if (videoRef.current) {
        videoTrack.play(videoRef.current);
      }
      
    } catch (error) {
      console.error('Camera initialization error:', error);
      
      // User-friendly error messages
      let errorMessage = '';
      if (error.message?.includes('Permission denied')) {
        errorMessage = 'Camera/microphone access denied. Please check your browser permissions.';
      } else if (error.message?.includes('NotFoundError') || error.message?.includes('DEVICE_NOT_FOUND')) {
        errorMessage = 'No camera or microphone detected. Please connect a device and try again.';
      } else if (error.message?.includes('NotAllowedError')) {
        errorMessage = 'Permission to access camera/microphone was denied.';
      } else if (error.message?.includes('NotReadableError')) {
        errorMessage = 'Camera/microphone is already in use by another application.';
      } else {
        errorMessage = 'Unable to access camera or microphone. Please check your device settings.';
      }
      
      setDeviceError(errorMessage);
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video) {
      if (isVideoEnabled) {
        await localTracks.video.setEnabled(false);
        setIsVideoEnabled(false);
      } else {
        await localTracks.video.setEnabled(true);
        setIsVideoEnabled(true);
      }
    }
  };

  const toggleAudio = async () => {
    if (localTracks.audio) {
      if (isAudioEnabled) {
        await localTracks.audio.setEnabled(false);
        setIsAudioEnabled(false);
      } else {
        await localTracks.audio.setEnabled(true);
        setIsAudioEnabled(true);
      }
    }
  };

  const handleGoLive = async () => {
    if (!streamTitle.trim()) {
      toast.error('Please enter a stream title');
      return;
    }

    if (!streamCategory) {
      toast.error('Please select a category');
      return;
    }
    
    // Check pre-stream checklist if not in test mode
    if (!testStreamMode) {
      const checklistComplete = Object.values(preStreamChecklist).every(item => item);
      if (!checklistComplete) {
        toast.error('Please complete the pre-stream checklist');
        return;
      }
    }
    
    // Check scheduled time if scheduled
    if (isScheduled && !scheduledTime) {
      toast.error('Please select a scheduled time');
      return;
    }

    setLoading(true);
    
    try {
      // Pass the local tracks and stream info to parent
      const streamConfig = {
        title: streamTitle.trim(),
        category: streamCategory,
        description: streamDescription.trim(),
        tracks: localTracks,
        client: clientRef.current,
        audienceControl: audienceControl,
        advancedSettings: advancedSettings,
        streamGoal: streamGoal.enabled ? streamGoal : null,
        // New fields
        thumbnail: thumbnailImage,
        tags: streamTags,
        isScheduled: isScheduled,
        scheduledTime: scheduledTime,
        privacy: streamPrivacy,
        shareToSocial: shareToSocial,
        tipSettings: tipSettings,
        moderationTools: moderationTools,
        isTestStream: testStreamMode
      };
      
      // Show social share notification if enabled
      if (Object.values(shareToSocial).some(v => v)) {
        // toast.success('Stream will be shared to your social media');
      }
      
      await onGoLive(streamConfig);
      
    } catch (error) {
      console.error('Go live error:', error);
      toast.error('Failed to start live stream');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    cleanupTracks();
    onCancel();
  };
  
  // Handle thumbnail upload
  const handleThumbnailUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      setThumbnailImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result);
      };
      reader.readAsDataURL(file);
      // toast.success('Thumbnail uploaded successfully');
    } else {
      toast.error('Please upload a valid image file');
    }
  };
  
  // Handle tag addition
  const handleAddTag = () => {
    if (currentTag.trim() && streamTags.length < 5) {
      const tag = currentTag.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!streamTags.includes(tag)) {
        setStreamTags([...streamTags, tag]);
        setCurrentTag('');
      }
    } else if (streamTags.length >= 5) {
      toast.error('Maximum 5 tags allowed');
    }
  };
  
  // Handle tag removal
  const handleRemoveTag = (tagToRemove) => {
    setStreamTags(streamTags.filter(tag => tag !== tagToRemove));
  };
  
  // Apply template
  const applyTemplate = (template) => {
    setStreamCategory(template.category);
    setStreamTags(template.tags);
    if (template.goals) {
      setStreamGoal(prev => ({
        ...prev,
        enabled: true,
        level1: { ...prev.level1, amount: template.goals.level1 },
        level2: { ...prev.level2, amount: template.goals.level2 },
        level3: { ...prev.level3, amount: template.goals.level3 }
      }));
    }
    setSelectedTemplate(template.id);
    setShowTemplates(false);
    // toast.success(`Applied ${template.name} template`);
  };
  
  // Get minimum scheduled time (30 minutes from now)
  const getMinScheduledTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="relative bg-white/95 backdrop-blur-md rounded-3xl w-full max-w-sm sm:max-w-4xl lg:max-w-7xl max-h-[95vh] overflow-hidden shadow-2xl border border-white/20 flex flex-col"
      >
        {/* Header with gradient overlay */}
        <div className="relative bg-gradient-to-br from-purple-600 via-pink-600 to-purple-600 p-6 overflow-hidden">
          <div className="absolute inset-0 bg-black/10" />
          <motion.div 
            className="absolute inset-0"
            initial={{ backgroundPosition: "0% 0%" }}
            animate={{ backgroundPosition: "100% 100%" }}
            transition={{ duration: 20, ease: "linear", repeat: Infinity }}
            style={{
              backgroundImage: "linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)",
              backgroundSize: "200% 200%"
            }}
          />
          <div className="relative flex items-center justify-between">
            <div className="text-white">
              <motion.h2 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold flex items-center gap-3"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="bg-white/20 backdrop-blur-sm p-2 rounded-xl"
                >
                  <VideoCameraIcon className="w-8 h-8" />
                </motion.div>
                <div className="flex items-center gap-3">
                  <img 
                    src="/digis-logo-white.png" 
                    alt="Digis" 
                    className="h-8 w-auto opacity-90"
                  />
                  <span className="text-white/80">|</span>
                  <span>Go Live Setup</span>
                </div>
              </motion.h2>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleCancel}
              className="text-white/80 hover:text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-3 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
          {/* Stream Templates */}
          {showTemplates && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-purple-900 flex items-center gap-2">
                  <DocumentDuplicateIcon className="w-5 h-5" />
                  Quick Start Templates
                </h3>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {streamTemplates.map(template => (
                  <motion.button
                    key={template.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => applyTemplate(template)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedTemplate === template.id 
                        ? 'border-purple-500 bg-purple-100' 
                        : 'border-gray-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <div className="text-sm font-medium">{template.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{template.category}</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
          
          {/* Pre-Stream Checklist (Test Mode Toggle) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-amber-900 flex items-center gap-2">
                  <ClipboardDocumentCheckIcon className="w-5 h-5" />
                  Pre-Stream Checklist
                </h3>
                <button
                  onClick={() => setTestStreamMode(!testStreamMode)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    testStreamMode 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  <BeakerIcon className="w-4 h-4 inline mr-1" />
                  {testStreamMode ? 'Test Mode ON' : 'Test Mode OFF'}
                </button>
              </div>
              
              {!testStreamMode && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {Object.entries({
                    camera: 'Camera Ready',
                    audio: 'Audio Clear',
                    lighting: 'Good Lighting',
                    background: 'Clean Background',
                    internet: 'Stable Internet'
                  }).map(([key, label]) => (
                    <label
                      key={key}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                        preStreamChecklist[key] 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={preStreamChecklist[key]}
                        onChange={(e) => setPreStreamChecklist(prev => ({
                          ...prev,
                          [key]: e.target.checked
                        }))}
                        className="sr-only"
                      />
                      <CheckCircleIcon className={`w-4 h-4 ${preStreamChecklist[key] ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className="text-xs font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              )}
              
              {testStreamMode && (
                <div className="text-sm text-amber-700 bg-amber-100 rounded-lg p-3 mt-2">
                  <p className="font-medium mb-1">Test Mode Active</p>
                  <p className="text-xs">Stream will not be visible to viewers. Perfect for testing your setup!</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Stream Setup */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
              {/* Thumbnail Upload and Video Preview Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Thumbnail Upload */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="lg:col-span-1"
                >
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg">
                      <PhotoIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    Stream Thumbnail
                  </h3>
                  
                  <div className="space-y-3">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="relative bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden aspect-video cursor-pointer hover:from-gray-200 hover:to-gray-300 transition-all duration-300 group"
                    >
                      {thumbnailPreview ? (
                        <>
                          <img 
                            src={thumbnailPreview} 
                            alt="Stream thumbnail" 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <PhotoIcon className="w-12 h-12 text-white" />
                            <p className="text-white text-sm mt-2">Change Thumbnail</p>
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <PhotoIcon className="w-12 h-12 text-gray-400 mb-2" />
                          <p className="text-gray-600 text-sm font-medium">Upload Thumbnail</p>
                          <p className="text-gray-400 text-xs mt-1">16:9 ratio, max 5MB</p>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailUpload}
                        className="hidden"
                      />
                    </div>
                    
                    {thumbnailPreview && (
                      <button
                        onClick={() => {
                          setThumbnailImage(null);
                          setThumbnailPreview(null);
                        }}
                        className="w-full py-2 text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Remove Thumbnail
                      </button>
                    )}
                  </div>
                </motion.div>
                
                {/* Video Preview */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="lg:col-span-2 space-y-4"
                >
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                      <VideoCameraIcon className="w-5 h-5 text-purple-600" />
                    </div>
                    Camera Preview
                    <span className="ml-auto text-sm font-normal text-gray-500">
                      {isVideoEnabled ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <SignalIcon className="w-4 h-4" />
                          Live
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400">
                          <SignalIcon className="w-4 h-4" />
                          Camera Off
                        </span>
                      )}
                    </span>
                  </h3>
            
                <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl overflow-hidden aspect-video shadow-xl h-[300px] sm:h-[400px] lg:h-[500px]">
                  {deviceError ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm">
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center p-8 max-w-sm"
                      >
                        <motion.div 
                          animate={{ 
                            scale: [1, 1.1, 1],
                            rotate: [0, 5, -5, 0]
                          }}
                          transition={{ 
                            duration: 2,
                            repeat: Infinity,
                            repeatDelay: 1
                          }}
                          className="inline-block mb-4"
                        >
                          <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center">
                            <VideoCameraIcon className="w-10 h-10 text-purple-400" />
                          </div>
                        </motion.div>
                        <h4 className="text-white font-semibold text-lg mb-2">Camera Setup Required</h4>
                        <p className="text-gray-300 text-sm mb-6 leading-relaxed">{deviceError}</p>
                        <div className="flex gap-3 justify-center">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={initializeCamera}
                            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 font-medium shadow-lg"
                          >
                            Try Again
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setDeviceError('')}
                            className="px-6 py-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all duration-300 font-medium backdrop-blur-sm"
                          >
                            Skip
                          </motion.button>
                        </div>
                        <p className="text-gray-400 text-xs mt-4">
                          Tip: Make sure your camera is connected and not being used by another app
                        </p>
                      </motion.div>
                    </div>
                  ) : !isVideoEnabled ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm">
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center"
                      >
                        <div className="w-20 h-20 bg-gradient-to-br from-gray-700/50 to-gray-800/50 rounded-full flex items-center justify-center mb-4 mx-auto">
                          <VideoCameraIcon className="w-10 h-10 text-gray-400" />
                        </div>
                        <p className="text-gray-300 font-medium">Camera is Off</p>
                        <p className="text-gray-500 text-sm mt-1">Click the camera button to enable</p>
                      </motion.div>
                    </div>
                  ) : (
                    <div ref={videoRef} className="w-full h-full" />
                  )}
                  
                  {/* User info overlay */}
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2"
                  >
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    {user?.displayName || user?.email || 'Creator'}
                  </motion.div>
                  
                  {/* Video quality indicator */}
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-lg text-xs flex items-center gap-2"
                  >
                    <WifiIcon className="w-4 h-4" />
                    HD 720p
                  </motion.div>
                </div>

                {/* Camera Controls */}
                <div className="flex justify-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleVideo}
                    className={`relative p-4 rounded-2xl transition-all duration-300 ${
                      isVideoEnabled 
                        ? 'bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 shadow-lg' 
                        : 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/30'
                    }`}
                    title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {isVideoEnabled ? (
                      <VideoCameraIcon className="w-6 h-6 text-gray-700" />
                    ) : (
                      <VideoCameraIcon className="w-6 h-6 text-white" />
                    )}
                    <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${isVideoEnabled ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleAudio}
                    className={`relative p-4 rounded-2xl transition-all duration-300 ${
                      isAudioEnabled 
                        ? 'bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 shadow-lg' 
                        : 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/30'
                    }`}
                    title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                  >
                    {isAudioEnabled ? (
                      <MicrophoneIcon className="w-6 h-6 text-gray-700" />
                    ) : (
                      <MicrophoneIcon className="w-6 h-6 text-white" />
                    )}
                    <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${isAudioEnabled ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                  </motion.button>
                </div>
                </motion.div>
              </div>

              {/* Stream Settings - Horizontal Layout */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stream Title *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={streamTitle}
                        onChange={(e) => setStreamTitle(e.target.value)}
                        placeholder="What's your stream about?"
                        className="w-full px-4 py-3 pr-20 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all duration-200"
                        maxLength={100}
                        required
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {streamTitle && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-green-500"
                          >
                            <CheckCircleIcon className="w-5 h-5" />
                          </motion.div>
                        )}
                        <span className="text-xs text-gray-400">{streamTitle.length}/100</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <div className="relative">
                      <select
                        value={streamCategory}
                        onChange={(e) => setStreamCategory(e.target.value)}
                        className="w-full px-4 py-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all duration-200 appearance-none cursor-pointer"
                        required
                      >
                        <option value="">Select a category</option>
                        {categories.map(category => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={streamDescription}
                      onChange={(e) => setStreamDescription(e.target.value)}
                      placeholder="Tell viewers what to expect in your stream..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      maxLength={300}
                    />
                    <div className="text-right text-sm text-gray-500 mt-1">
                      {streamDescription.length}/300 characters
                    </div>
                  </div>
                  
                  {/* Stream Tags */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <HashtagIcon className="w-4 h-4 inline mr-1" />
                      Stream Tags (max 5)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                        placeholder="Add a tag..."
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        maxLength={20}
                      />
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleAddTag}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        disabled={!currentTag.trim() || streamTags.length >= 5}
                      >
                        <PlusIcon className="w-5 h-5" />
                      </motion.button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {streamTags.map(tag => (
                        <motion.span
                          key={tag}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                        >
                          #{tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-purple-900"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </motion.span>
                      ))}
                    </div>
                  </div>
                  
                  {/* Schedule Stream */}
                  <div className="lg:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <CalendarIcon className="w-4 h-4 inline mr-1" />
                      Schedule Stream
                    </label>
                    <label className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={isScheduled}
                        onChange={(e) => setIsScheduled(e.target.checked)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm">Schedule for later</span>
                    </label>
                    {isScheduled && (
                      <input
                        type="datetime-local"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        min={getMinScheduledTime()}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    )}
                  </div>
                  
                  {/* Stream Privacy */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <LockClosedIcon className="w-4 h-4 inline mr-1" />
                      Stream Privacy
                    </label>
                    <select
                      value={streamPrivacy}
                      onChange={(e) => setStreamPrivacy(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="public">
                        <GlobeAltIcon className="w-4 h-4 inline mr-1" />
                        Public - Anyone can join
                      </option>
                      <option value="followers">
                        <UserGroupIcon className="w-4 h-4 inline mr-1" />
                        Followers Only
                      </option>
                      <option value="subscribers">
                        <LockClosedIcon className="w-4 h-4 inline mr-1" />
                        Subscribers Only
                      </option>
                    </select>
                  </div>
                  
                  {/* Social Media Sharing */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <ShareIcon className="w-4 h-4 inline mr-1" />
                      Share to Social Media
                    </label>
                    <div className="flex gap-4">
                      {Object.entries({
                        twitter: 'Twitter/X',
                        instagram: 'Instagram',
                        facebook: 'Facebook'
                      }).map(([platform, label]) => (
                        <label key={platform} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={shareToSocial[platform]}
                            onChange={(e) => setShareToSocial(prev => ({
                              ...prev,
                              [platform]: e.target.checked
                            }))}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Enhanced Stream Goals with Visual Progress */}
                  <div className="lg:col-span-3 space-y-4 p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-orange-800 flex items-center gap-2">
                        <TrophyIcon className="w-5 h-5" />
                        Stream Goals
                        <button
                          onClick={() => setShowTemplates(!showTemplates)}
                          className="ml-2 text-xs text-orange-600 hover:text-orange-700 underline"
                        >
                          Use Template
                        </button>
                      </h4>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={streamGoal.enabled}
                          onChange={(e) => setStreamGoal(prev => ({ ...prev, enabled: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                      </label>
                    </div>

                    {streamGoal.enabled && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
                      >
                        {/* Visual Goal Preview */}
                        <div className="bg-white rounded-lg p-3 border border-yellow-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Goal Preview</span>
                            <span className="text-xs text-gray-500">During Stream</span>
                          </div>
                          <div className="space-y-2">
                            {[1, 2, 3].map((level) => (
                              <div key={level} className="relative">
                                <div className="bg-gray-200 rounded-full h-6 overflow-hidden">
                                  <motion.div
                                    className={`h-full ${
                                      level === 1 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                                      level === 2 ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                                      'bg-gradient-to-r from-purple-400 to-purple-600'
                                    }`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, (level === 1 ? 65 : level === 2 ? 30 : 10))}%` }}
                                    transition={{ duration: 1, delay: level * 0.2 }}
                                  />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-between px-2">
                                  <span className="text-xs font-medium text-white drop-shadow">
                                    {streamGoal[`level${level}`].description || `Level ${level}`}
                                  </span>
                                  <span className="text-xs font-medium text-gray-700">
                                    ${(streamGoal[`level${level}`].amount * 0.05).toFixed(0)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Goal Level Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {[1, 2, 3].map((level) => (
                            <motion.div 
                              key={level} 
                              className={`border-2 rounded-lg p-3 bg-white transition-all ${
                                level === 1 ? 'border-green-300 hover:border-green-400' :
                                level === 2 ? 'border-blue-300 hover:border-blue-400' :
                                'border-purple-300 hover:border-purple-400'
                              }`}
                              whileHover={{ scale: 1.02 }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold ${
                                  level === 1 ? 'bg-green-600' :
                                  level === 2 ? 'bg-blue-600' :
                                  'bg-purple-600'
                                }`}>
                                  {level}
                                </span>
                                <span className="text-sm font-medium text-gray-700">
                                  {level === 1 ? 'Starting Goal' : level === 2 ? 'Stretch Goal' : 'Ultimate Goal'}
                                </span>
                              </div>
                              
                              <input
                                type="text"
                                value={streamGoal[`level${level}`].description}
                                onChange={(e) => setStreamGoal(prev => ({
                                  ...prev,
                                  [`level${level}`]: {
                                    ...prev[`level${level}`],
                                    description: e.target.value
                                  }
                                }))}
                                placeholder={`${level === 1 ? 'e.g., Dance party!' : level === 2 ? 'e.g., Q&A session' : 'e.g., Special giveaway'}`}
                                className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent mb-2"
                                maxLength={30}
                              />
                              
                              <div className="relative">
                                <input
                                  type="number"
                                  min="100"
                                  step="100"
                                  value={streamGoal[`level${level}`].amount}
                                  onChange={(e) => setStreamGoal(prev => ({
                                    ...prev,
                                    [`level${level}`]: {
                                      ...prev[`level${level}`],
                                      amount: Math.max(100, parseInt(e.target.value) || 0)
                                    }
                                  }))}
                                  className="w-full pl-8 pr-2 py-1 bg-gray-50 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                />
                                <SparklesIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-600" />
                              </div>
                              
                              <p className="text-xs text-gray-500 mt-1 text-center">
                                ≈ ${(streamGoal[`level${level}`].amount * 0.05).toFixed(2)}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Stream Pricing & Tips */}
                  <div className="space-y-4 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                    <h4 className="font-semibold text-purple-800 flex items-center gap-2">
                      <CurrencyDollarIcon className="w-5 h-5" />
                      Stream Pricing & Tips
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Join Stream Price (tokens)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={audienceControl.joinPrice || 0}
                            onChange={(e) => setAudienceControl(prev => ({ 
                              ...prev, 
                              joinPrice: Math.max(0, parseInt(e.target.value) || 0)
                            }))}
                            placeholder="0 for free stream"
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                          />
                          <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-600" />
                          {audienceControl.joinPrice > 0 && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-purple-600 font-medium">
                              ≈ ${(audienceControl.joinPrice * 0.05).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Private Stream Price (tokens)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={audienceControl.privateStreamPrice || 0}
                            onChange={(e) => setAudienceControl(prev => ({ 
                              ...prev, 
                              privateStreamPrice: Math.max(0, parseInt(e.target.value) || 0)
                            }))}
                            placeholder="0 to disable"
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                          />
                          <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-600" />
                          {audienceControl.privateStreamPrice > 0 && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-pink-600 font-medium">
                              ≈ ${(audienceControl.privateStreamPrice * 0.05).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Tip Settings */}
                    <div className="border-t border-purple-200 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="flex items-center gap-2">
                          <GiftIcon className="w-5 h-5 text-purple-600" />
                          <span className="font-medium text-gray-700">Enable Tips</span>
                        </label>
                        <input
                          type="checkbox"
                          checked={tipSettings.enabled}
                          onChange={(e) => setTipSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                      </div>
                      
                      {tipSettings.enabled && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-3"
                        >
                          <div>
                            <label className="text-sm font-medium text-gray-600 mb-1 block">
                              Minimum Tip Amount (tokens)
                            </label>
                            <input
                              type="number"
                              min="10"
                              value={tipSettings.minAmount}
                              onChange={(e) => setTipSettings(prev => ({ 
                                ...prev, 
                                minAmount: Math.max(10, parseInt(e.target.value) || 10)
                              }))}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-600 mb-1 block">
                              Quick Tip Amounts
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                              {tipSettings.suggestedAmounts.map((amount, index) => (
                                <div key={index} className="relative">
                                  <input
                                    type="number"
                                    min="10"
                                    value={amount}
                                    onChange={(e) => {
                                      const newAmounts = [...tipSettings.suggestedAmounts];
                                      newAmounts[index] = Math.max(10, parseInt(e.target.value) || 10);
                                      setTipSettings(prev => ({ ...prev, suggestedAmounts: newAmounts }));
                                    }}
                                    className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded text-sm text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  />
                                  <span className="text-xs text-gray-500 absolute -bottom-5 left-0 right-0 text-center">
                                    ${(amount * 0.05).toFixed(0)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                  
                  {/* Moderation Tools */}
                  <div className="lg:col-span-2 space-y-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                      <ShieldCheckIcon className="w-5 h-5" />
                      Stream Moderation
                    </h4>
                    
                    <div className="space-y-3">
                      <label className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Auto-Moderation</span>
                        <input
                          type="checkbox"
                          checked={moderationTools.autoModEnabled}
                          onChange={(e) => setModerationTools(prev => ({ ...prev, autoModEnabled: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </label>
                      
                      <label className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Slow Mode</span>
                        <input
                          type="checkbox"
                          checked={moderationTools.slowMode}
                          onChange={(e) => setModerationTools(prev => ({ ...prev, slowMode: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </label>
                      
                      {moderationTools.slowMode && (
                        <div className="pl-6">
                          <label className="text-xs text-gray-600">Delay (seconds)</label>
                          <input
                            type="number"
                            min="1"
                            max="120"
                            value={moderationTools.slowModeDelay}
                            onChange={(e) => setModerationTools(prev => ({ 
                              ...prev, 
                              slowModeDelay: Math.max(1, Math.min(120, parseInt(e.target.value) || 5))
                            }))}
                            className="w-20 px-2 py-1 bg-white border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Blocked Words (comma separated)
                        </label>
                        <input
                          type="text"
                          placeholder="spam, inappropriate, etc."
                          value={moderationTools.blockedWords.join(', ')}
                          onChange={(e) => setModerationTools(prev => ({ 
                            ...prev, 
                            blockedWords: e.target.value.split(',').map(w => w.trim()).filter(Boolean)
                          }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Analytics Preview */}
                  <div className="space-y-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                    <h4 className="font-semibold text-green-800 flex items-center gap-2">
                      <ChartBarIcon className="w-5 h-5" />
                      Analytics Preview
                    </h4>
                    
                    <button
                      onClick={() => setShowAnalyticsPreview(!showAnalyticsPreview)}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      {showAnalyticsPreview ? 'Hide' : 'Show'} Analytics
                    </button>
                    
                    {showAnalyticsPreview && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-2 gap-3"
                      >
                        <div className="bg-white rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-green-600">0</p>
                          <p className="text-xs text-gray-600">Expected Viewers</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-green-600">
                            ${((audienceControl.joinPrice || 0) * 0.05 * 50).toFixed(0)}
                          </p>
                          <p className="text-xs text-gray-600">Potential Earnings</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {isScheduled ? '📅' : '🔴'}
                          </p>
                          <p className="text-xs text-gray-600">
                            {isScheduled ? 'Scheduled' : 'Live Now'}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {streamTags.length}
                          </p>
                          <p className="text-xs text-gray-600">Tags</p>
                        </div>
                      </motion.div>
                    )}
                  </div>

              </motion.div>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <div className="relative bg-gradient-to-t from-gray-50 to-white p-6 pb-10 border-t border-gray-200 mb-6">
          <div className="flex justify-between items-center">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCancel}
              className="px-6 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium shadow-sm"
            >
              Cancel
            </motion.button>
            
            <motion.button
                whileHover={{ scale: loading ? 1 : 1.05 }}
                whileTap={{ scale: loading ? 1 : 0.95 }}
                onClick={handleGoLive}
                disabled={loading || !streamTitle || !streamCategory || !localTracks.video || !localTracks.audio}
                className={`relative px-8 py-3 rounded-xl font-semibold shadow-lg transition-all duration-300 ${
                  loading || !streamTitle || !streamCategory || !localTracks.video || !localTracks.audio
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 hover:shadow-xl'
                }`}
              >
                <span className="relative flex items-center gap-2">
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      <span>Starting Stream...</span>
                    </>
                  ) : (
                    <>
                      <motion.span
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="text-lg"
                      >
                        🔴
                      </motion.span>
                      <span>Go Live!</span>
                    </>
                  )}
                </span>
                {!loading && streamTitle && streamCategory && localTracks.video && localTracks.audio && (
                  <motion.div
                    className="absolute inset-0 rounded-xl bg-white"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.2, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.button>
          </div>
        </div>
      </motion.div>
      
      {/* Global styles for animations */}
      <style>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default GoLiveSetup;