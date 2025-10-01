import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ComputerDesktopIcon,
  WindowIcon,
  CursorArrowRaysIcon,
  StopIcon,
  CogIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  VideoCameraIcon,
  ArrowsPointingOutIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Card from './ui/Card';
import Button from './ui/Button';
import Slider from './ui/Slider';
import toast from 'react-hot-toast';

const EnhancedScreenShare = ({
  onStartShare,
  onStopShare,
  isSharing,
  currentShareType,
  className = ''
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const [shareConfig, setShareConfig] = useState({
    type: 'screen', // 'screen', 'window', 'tab'
    withAudio: true,
    withCursor: true,
    quality: 'high', // 'low', 'medium', 'high', 'ultra'
    frameRate: 30,
    resolution: '1080p',
    optimizeFor: 'motion' // 'motion', 'detail', 'text'
  });

  const qualityPresets = {
    low: { bitrate: 500, resolution: '720p', frameRate: 15 },
    medium: { bitrate: 1000, resolution: '1080p', frameRate: 30 },
    high: { bitrate: 2000, resolution: '1080p', frameRate: 30 },
    ultra: { bitrate: 4000, resolution: '4k', frameRate: 60 }
  };

  const startScreenShare = useCallback(async (type) => {
    try {
      let constraints = {
        video: {
          cursor: shareConfig.withCursor ? 'always' : 'never',
          displaySurface: type === 'screen' ? 'monitor' : type === 'window' ? 'window' : 'browser',
          frameRate: { ideal: shareConfig.frameRate },
          width: { ideal: getResolutionWidth(shareConfig.resolution) },
          height: { ideal: getResolutionHeight(shareConfig.resolution) }
        }
      };

      // Add audio if enabled
      if (shareConfig.withAudio) {
        constraints.audio = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        };
      }

      // Get display media
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      
      // Configure based on optimization type
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        
        // Apply optimization settings
        await videoTrack.applyConstraints({
          frameRate: shareConfig.frameRate,
          width: getResolutionWidth(shareConfig.resolution),
          height: getResolutionHeight(shareConfig.resolution),
          aspectRatio: 16/9
        });

        // Log share info
        console.log('Screen share started:', {
          type,
          displaySurface: settings.displaySurface,
          resolution: `${settings.width}x${settings.height}`,
          frameRate: settings.frameRate
        });

        // Show appropriate toast based on share type
        const shareTypeText = {
          screen: 'Sharing entire screen',
          window: `Sharing ${settings.displaySurface === 'window' ? 'application window' : 'window'}`,
          tab: 'Sharing browser tab'
        };

        // toast.success(shareTypeText[type] || 'Screen sharing started', {
        //   duration: 3000,
        //   icon: '🖥️'
        // });
      }

      // Pass stream to parent
      if (onStartShare) {
        onStartShare(stream, {
          ...shareConfig,
          type,
          actualResolution: videoTrack ? `${videoTrack.getSettings().width}x${videoTrack.getSettings().height}` : 'unknown'
        });
      }

      setShowOptions(false);

      // Listen for share end
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        handleStopShare();
      });

    } catch (error) {
      if (error.name === 'NotAllowedError') {
        toast.error('Screen share permission denied');
      } else {
        console.error('Screen share error:', error);
        toast.error('Failed to start screen sharing');
      }
    }
  }, [shareConfig, onStartShare]);

  const handleStopShare = useCallback(() => {
    if (onStopShare) {
      onStopShare();
    }
    // toast.success('Screen sharing stopped', {
    //   duration: 2000
    // });
  }, [onStopShare]);

  const getResolutionWidth = (resolution) => {
    const resMap = {
      '720p': 1280,
      '1080p': 1920,
      '1440p': 2560,
      '4k': 3840
    };
    return resMap[resolution] || 1920;
  };

  const getResolutionHeight = (resolution) => {
    const resMap = {
      '720p': 720,
      '1080p': 1080,
      '1440p': 1440,
      '4k': 2160
    };
    return resMap[resolution] || 1080;
  };

  const ShareOption = ({ type, icon: Icon, title, description, badge }) => (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => startScreenShare(type)}
      className="relative p-6 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 transition-all text-left group"
    >
      {badge && (
        <span className="absolute top-3 right-3 bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
          {badge}
        </span>
      )}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
          <Icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>
    </motion.button>
  );

  return (
    <>
      {/* Main Button */}
      {!isSharing ? (
        <Button
          variant="secondary"
          size="sm"
          icon={<ComputerDesktopIcon className="w-4 h-4" />}
          onClick={() => setShowOptions(true)}
          className={className}
        >
          Share Screen
        </Button>
      ) : (
        <Button
          variant="danger"
          size="sm"
          icon={<StopIcon className="w-4 h-4" />}
          onClick={handleStopShare}
          className={className}
        >
          Stop Sharing
        </Button>
      )}

      {/* Options Modal */}
      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowOptions(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <ComputerDesktopIcon className="w-8 h-8" />
                      Enhanced Screen Sharing
                    </h2>
                    <p className="text-purple-100 mt-1">
                      Choose what to share with advanced options
                    </p>
                  </div>
                  <button
                    onClick={() => setShowOptions(false)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Share Options */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    What would you like to share?
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ShareOption
                      type="screen"
                      icon={ComputerDesktopIcon}
                      title="Entire Screen"
                      description="Share everything on your display"
                      badge="Recommended"
                    />
                    <ShareOption
                      type="window"
                      icon={WindowIcon}
                      title="Application Window"
                      description="Share a specific application"
                    />
                    <ShareOption
                      type="tab"
                      icon={CursorArrowRaysIcon}
                      title="Browser Tab"
                      description="Share a single browser tab"
                    />
                  </div>
                </div>

                {/* Advanced Settings */}
                <Card className="p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <CogIcon className="w-5 h-5" />
                    Advanced Settings
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Quality Preset */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Quality Preset
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {Object.entries(qualityPresets).map(([quality, preset]) => (
                          <button
                            key={quality}
                            onClick={() => setShareConfig(prev => ({
                              ...prev,
                              quality,
                              frameRate: preset.frameRate,
                              resolution: preset.resolution
                            }))}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              shareConfig.quality === quality
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            {quality.charAt(0).toUpperCase() + quality.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Resolution */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Resolution
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {['720p', '1080p', '1440p', '4k'].map(res => (
                          <button
                            key={res}
                            onClick={() => setShareConfig(prev => ({ ...prev, resolution: res }))}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              shareConfig.resolution === res
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            {res.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Frame Rate */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Frame Rate: {shareConfig.frameRate} FPS
                      </label>
                      <Slider
                        value={shareConfig.frameRate}
                        onChange={(value) => setShareConfig(prev => ({ ...prev, frameRate: value }))}
                        min={15}
                        max={60}
                        step={15}
                        className="mt-2"
                      />
                    </div>

                    {/* Optimization */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Optimize For
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setShareConfig(prev => ({ ...prev, optimizeFor: 'motion' }))}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            shareConfig.optimizeFor === 'motion'
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Motion
                        </button>
                        <button
                          onClick={() => setShareConfig(prev => ({ ...prev, optimizeFor: 'detail' }))}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            shareConfig.optimizeFor === 'detail'
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => setShareConfig(prev => ({ ...prev, optimizeFor: 'text' }))}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            shareConfig.optimizeFor === 'text'
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Text
                        </button>
                      </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shareConfig.withAudio}
                          onChange={(e) => setShareConfig(prev => ({ ...prev, withAudio: e.target.checked }))}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <MicrophoneIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Share system audio
                        </span>
                      </label>
                      
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shareConfig.withCursor}
                          onChange={(e) => setShareConfig(prev => ({ ...prev, withCursor: e.target.checked }))}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <CursorArrowRaysIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Show cursor movements
                        </span>
                      </label>
                    </div>
                  </div>
                </Card>

                {/* Tips */}
                <Card className="p-4 bg-purple-50 dark:bg-purple-900/20">
                  <h4 className="font-medium text-purple-900 dark:text-purple-300 mb-2">
                    Pro Tips
                  </h4>
                  <ul className="space-y-1 text-sm text-purple-700 dark:text-purple-400">
                    <li>• Use "Browser Tab" for sharing web content with audio</li>
                    <li>• Select "Text" optimization for code demonstrations</li>
                    <li>• Higher frame rates provide smoother motion but use more bandwidth</li>
                    <li>• Window sharing hides other applications for privacy</li>
                  </ul>
                </Card>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default EnhancedScreenShare;