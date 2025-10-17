import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CurrencyDollarIcon,
  HashtagIcon,
  PhotoIcon,
  ShoppingBagIcon,
  TrophyIcon,
  CogIcon,
  CheckCircleIcon,
  SparklesIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { VideoCameraIcon as VideoCameraSolid, MicrophoneIcon as MicrophoneSolid } from '@heroicons/react/24/solid';
import useMobileAgora from '../../hooks/useMobileAgora';
import { useMobileStream } from '../../contexts/MobileStreamContext';

/**
 * MobileGoLive - Production-ready mobile live streaming with wizard flow
 *
 * Combines comprehensive onboarding (title, category, pricing, goals)
 * with production-safe Agora integration via useMobileAgora hook
 *
 * Features:
 * - 3-step wizard: Camera Setup → Stream Info → Settings
 * - Safe Agora init/cleanup (no duplicate mounts, proper teardown)
 * - Permission-first flow (prompts before creating tracks)
 * - Stream configuration (title, category, tags, pricing, goals)
 *
 * @param {Function} onGoLive - Callback with full stream config
 * @param {Function} onCancel - Callback to close modal
 * @param {Object} user - Current user object
 * @param {string} appId - Agora App ID (from env or props)
 * @param {string} channel - Unique channel name for this stream
 * @param {string} token - Server-generated Agora token (or null for test mode)
 */
const MobileGoLive = ({ onGoLive, onCancel, user, appId, channel, token }) => {
  console.log('📱 MobileGoLive component rendered with user:', user?.username);
  const [currentStep, setCurrentStep] = useState(0);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [loading, setLoading] = useState(false);
  const localVideoEl = useRef(null);

  // Stream settings
  const [streamTitle, setStreamTitle] = useState('');
  const [streamCategory, setStreamCategory] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [streamTags, setStreamTags] = useState([]);
  const [currentTag, setCurrentTag] = useState('');
  const [streamPrivacy, setStreamPrivacy] = useState('public');
  const [joinPrice, setJoinPrice] = useState(0);
  const [privatePrice, setPrivatePrice] = useState(0);
  const [enableShopping, setEnableShopping] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [streamGoals, setStreamGoals] = useState({
    level1: { amount: 5000, description: 'Level 1' },
    level2: { amount: 10000, description: 'Level 2' },
    level3: { amount: 25000, description: 'Level 3' }
  });

  const categories = [
    'Gaming', 'Music', 'Art', 'Model', 'Fitness', 'Yoga',
    'Cooking', 'Dance', 'Comedy', 'Education', 'Lifestyle',
    'Fashion', 'Tech', 'Sports', 'Travel', 'Other'
  ];

  const steps = [
    { id: 0, title: 'Camera Setup', icon: VideoCameraIcon },
    { id: 1, title: 'Stream Info', icon: SparklesIcon },
    { id: 2, title: 'Settings', icon: CogIcon }
  ];

  // Use shared streaming context for global state
  const { canStartStream, startStream, endStream } = useMobileStream();

  // Use production-safe Agora hook
  const {
    isInitializing,
    isJoined,
    error: agoraError,
    connectionState,
    localAudioTrack,
    localVideoTrack,
    init: initAgora,
    leave: leaveAgora,
    toggleCamera: agoraToggleCamera,
    toggleMic: agoraToggleMic,
    flipCamera: agoraFlipCamera,
    resetError,
    attemptReconnect
  } = useMobileAgora({
    appId,
    mode: 'live',
    codec: 'vp8',
    initialVideo: true,
    initialAudio: true
  });

  // Initialize camera on mount using Agora hook
  useEffect(() => {
    // Check if another stream is active before initializing
    if (!canStartStream()) {
      toast.error('Another stream is already active');
      onCancel();
      return;
    }

    initializeCamera();
    return () => {
      // Cleanup handled by useMobileAgora hook
      resetError();
    };
  }, []);

  // Handle page visibility changes (iOS backgrounding)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isJoined) {
        console.log('📱 App backgrounded while live - ending stream');
        handleCancel();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isJoined]);

  const initializeCamera = async () => {
    try {
      console.log('📷 Initializing camera via Agora...');
      await initAgora();

      // Play local preview - iOS requires video element to be ready first
      if (localVideoTrack.current && localVideoEl.current) {
        // Ensure video element is in DOM and visible
        localVideoEl.current.style.display = 'block';
        localVideoEl.current.muted = true;
        localVideoEl.current.playsInline = true;

        try {
          await localVideoTrack.current.play(localVideoEl.current, { fit: 'cover' });
          console.log('✅ Local video playing');
        } catch (playErr) {
          console.error('Video play error:', playErr);
          // Retry once after a short delay for iOS
          setTimeout(() => {
            if (localVideoTrack.current && localVideoEl.current) {
              localVideoTrack.current.play(localVideoEl.current, { fit: 'cover' }).catch(e =>
                console.error('Retry play failed:', e)
              );
            }
          }, 300);
        }
      }

      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
    } catch (error) {
      console.error('Camera initialization error:', error);
      toast.error('Unable to access camera. Please check permissions.');
    }
  };

  const toggleVideo = async () => {
    const newState = await agoraToggleCamera();
    setIsVideoEnabled(newState);
  };

  const toggleAudio = async () => {
    const newState = await agoraToggleMic();
    setIsAudioEnabled(newState);
  };

  const handleFlipCamera = async () => {
    const success = await agoraFlipCamera();
    if (success) {
      setIsFrontCamera(prev => !prev);
    }
  };

  const handleAddTag = () => {
    if (currentTag.trim() && streamTags.length < 3) {
      const tag = currentTag.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!streamTags.includes(tag)) {
        setStreamTags([...streamTags, tag]);
        setCurrentTag('');
      }
    }
  };

  const validateAndProceed = () => {
    if (currentStep === 0) {
      // Camera setup - just proceed
      setCurrentStep(1);
    } else if (currentStep === 1) {
      // Stream info validation
      if (!streamTitle.trim()) {
        toast.error('Please enter a stream title');
        return;
      }
      if (!streamCategory) {
        toast.error('Please select a category');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Final step - go live
      handleGoLive();
    }
  };

  const handleGoLive = async () => {
    setLoading(true);

    try {
      const streamConfig = {
        title: streamTitle.trim(),
        category: streamCategory,
        description: streamDescription.trim(),
        channel,
        token,
        appId,
        audienceControl: {
          visibility: streamPrivacy,
          joinPrice: joinPrice,
          privateStreamPrice: privatePrice
        },
        tags: streamTags,
        privacy: streamPrivacy,
        shoppingEnabled: enableShopping,
        selectedProducts: selectedProducts,
        streamGoal: streamGoals,
        // Include Agora track refs for parent component
        localAudioTrack: localAudioTrack.current,
        localVideoTrack: localVideoTrack.current
      };

      console.log('🎬 Going live with config:', streamConfig);
      await onGoLive(streamConfig);

      // Set global stream lock ONLY after successful go live
      startStream({
        channel,
        uid: user?.id,
        mode: 'live',
        client: null,
        audioTrack: localAudioTrack.current,
        videoTrack: localVideoTrack.current
      });
      console.log('✅ Global stream lock acquired');
    } catch (error) {
      console.error('Go live error:', error);
      toast.error('Failed to start live stream');
      setLoading(false);
      // Release lock on failure
      endStream();
    }
  };

  const handleCancel = async () => {
    await leaveAgora();
    endStream(); // Clear global stream lock
    onCancel();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        // Camera Setup Step
        return (
          <div className="flex flex-col h-full">
            {/* Camera Preview */}
            <div className="flex-1 bg-black relative overflow-hidden">
              {/* iOS-safe video element with required attributes */}
              <video
                ref={localVideoEl}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  transform: isFrontCamera ? 'scaleX(-1)' : 'none', // Mirror only front camera
                  display: agoraError || !isVideoEnabled ? 'none' : 'block'
                }}
              />

              {agoraError ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center p-6">
                    <VideoCameraIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-white text-sm mb-4">{agoraError}</p>
                    <button
                      onClick={initializeCamera}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : !isVideoEnabled ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center">
                    <VideoCameraIcon className="w-20 h-20 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-300">Camera is Off</p>
                  </div>
                </div>
              ) : null}

              {/* Connection Status Badge */}
              {connectionState === 'RECONNECTING' && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-yellow-500 text-white text-xs px-3 py-1 rounded-full animate-pulse flex items-center gap-1 shadow-lg z-10">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                  Reconnecting…
                </div>
              )}
              {connectionState === 'FAILED' && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs px-3 py-2 rounded-lg shadow-lg z-10">
                  <div className="flex flex-col items-center gap-1">
                    <span>Connection lost</span>
                    <button
                      onClick={attemptReconnect}
                      className="text-[10px] underline hover:no-underline"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Camera Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex justify-center items-center gap-4">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleVideo}
                    className={`p-4 rounded-full backdrop-blur-sm transition-all ${
                      isVideoEnabled
                        ? 'bg-white/20 hover:bg-white/30'
                        : 'bg-red-500/80 hover:bg-red-600/80'
                    }`}
                    aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {isVideoEnabled ? (
                      <VideoCameraIcon className="w-6 h-6 text-white" />
                    ) : (
                      <VideoCameraSolid className="w-6 h-6 text-white" />
                    )}
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleAudio}
                    className={`p-4 rounded-full backdrop-blur-sm transition-all ${
                      isAudioEnabled
                        ? 'bg-white/20 hover:bg-white/30'
                        : 'bg-red-500/80 hover:bg-red-600/80'
                    }`}
                    aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                  >
                    {isAudioEnabled ? (
                      <MicrophoneIcon className="w-6 h-6 text-white" />
                    ) : (
                      <MicrophoneSolid className="w-6 h-6 text-white" />
                    )}
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.9, rotate: 180 }}
                    onClick={handleFlipCamera}
                    className="p-4 rounded-full backdrop-blur-sm transition-all bg-white/20 hover:bg-white/30"
                    aria-label="Flip camera"
                  >
                    <ArrowPathIcon className="w-6 h-6 text-white" />
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        );

      case 1:
        // Stream Info Step
        return (
          <div className="flex flex-col h-full bg-white">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stream Title *
                </label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="What's your stream about?"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  maxLength={100}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-400">{streamTitle.length}/100</span>
                  {streamTitle && (
                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                  )}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  value={streamCategory}
                  onChange={(e) => setStreamCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none appearance-none"
                >
                  <option value="">Select a category</option>
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={streamDescription}
                  onChange={(e) => setStreamDescription(e.target.value)}
                  placeholder="Tell viewers about your stream..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                  rows={3}
                  maxLength={200}
                />
                <span className="text-xs text-gray-400">{streamDescription.length}/200</span>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <HashtagIcon className="w-4 h-4 inline mr-1" />
                  Tags (max 3)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Add tag..."
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    maxLength={15}
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!currentTag.trim() || streamTags.length >= 3}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {streamTags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                    >
                      #{tag}
                      <button
                        onClick={() => setStreamTags(streamTags.filter(t => t !== tag))}
                        className="ml-1 hover:text-purple-900"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        // Settings Step
        return (
          <div className="flex flex-col h-full bg-white">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Privacy */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Privacy Settings
                </label>
                <select
                  value={streamPrivacy}
                  onChange={(e) => setStreamPrivacy(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="public">Public - Anyone can join</option>
                  <option value="followers">Followers Only</option>
                  <option value="subscribers">Subscribers Only</option>
                </select>
              </div>

              {/* Pricing */}
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-purple-800 mb-3 flex items-center gap-2">
                  <CurrencyDollarIcon className="w-4 h-4" />
                  Stream Pricing
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Join Price (tokens)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={joinPrice}
                      onChange={(e) => setJoinPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    {joinPrice > 0 && (
                      <span className="text-xs text-purple-600">
                        ≈ ${(joinPrice * 0.05).toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Private Stream Price (tokens)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={privatePrice}
                      onChange={(e) => setPrivatePrice(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    {privatePrice > 0 && (
                      <span className="text-xs text-pink-600">
                        ≈ ${(privatePrice * 0.05).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stream Goals */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-orange-800 mb-3 flex items-center gap-2">
                  <TrophyIcon className="w-4 h-4" />
                  Stream Goals
                </h4>

                <div className="space-y-2">
                  {Object.entries(streamGoals).map(([level, goal], index) => (
                    <div key={level} className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold ${
                        index === 0 ? 'bg-green-500' :
                        index === 1 ? 'bg-blue-500' :
                        'bg-purple-500'
                      }`}>
                        {index + 1}
                      </span>
                      <input
                        type="number"
                        min="100"
                        value={goal.amount}
                        onChange={(e) => setStreamGoals(prev => ({
                          ...prev,
                          [level]: { ...goal, amount: parseInt(e.target.value) || 0 }
                        }))}
                        className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={goal.description}
                        onChange={(e) => setStreamGoals(prev => ({
                          ...prev,
                          [level]: { ...goal, description: e.target.value }
                        }))}
                        placeholder="Goal..."
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        maxLength={20}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Shopping Toggle */}
              <div className="bg-pink-50 p-4 rounded-lg">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <ShoppingBagIcon className="w-4 h-4" />
                    Enable Live Shopping
                  </span>
                  <input
                    type="checkbox"
                    checked={enableShopping}
                    onChange={(e) => setEnableShopping(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                </label>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" data-golive-modal="true">
      {/* Global Error Toast */}
      {agoraError && (
        <div className="absolute top-20 left-4 right-4 z-50 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg animate-slide-down">
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              <p className="font-medium text-sm">Connection Error</p>
              <p className="text-xs opacity-90 mt-1">{agoraError}</p>
            </div>
            <button
              onClick={resetError}
              className="text-white/80 hover:text-white"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={currentStep > 0 ? () => setCurrentStep(currentStep - 1) : handleCancel}
              className="text-white/80 hover:text-white transition-colors"
            >
              {currentStep > 0 ? (
                <ChevronLeftIcon className="w-6 h-6" />
              ) : (
                <XMarkIcon className="w-6 h-6" />
              )}
            </button>
            <h2 className="text-white font-semibold text-lg">
              {steps[currentStep].title}
            </h2>
          </div>

          {/* Step Indicator */}
          <div className="flex gap-1">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'w-6 bg-white'
                    : index < currentStep
                    ? 'bg-white/60'
                    : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderStepContent()}
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 safe-area-bottom">
        <motion.button
          whileHover={{ scale: loading || isInitializing ? 1 : 1.02 }}
          whileTap={{ scale: loading || isInitializing ? 1 : 0.98 }}
          onClick={validateAndProceed}
          disabled={loading || isInitializing}
          className={`w-full py-3 rounded-lg font-semibold transition-all ${
            loading || isInitializing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : currentStep === 2
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {loading || isInitializing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              {isInitializing ? 'Initializing...' : 'Starting...'}
            </span>
          ) : currentStep === 2 ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-pulse">🔴</span>
              Go Live!
            </span>
          ) : (
            'Next'
          )}
        </motion.button>
      </div>

      {/* Safe area styles for iOS + animations */}
      <style>{`
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default MobileGoLive;
