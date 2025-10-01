import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  ComputerDesktopIcon,
  ViewColumnsIcon,
  Squares2X2Icon,
  RectangleStackIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  CogIcon,
  PlusIcon,
  XMarkIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  CameraIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import AgoraRTC from 'agora-rtc-sdk-ng';

// Scene layout templates
const SCENE_LAYOUTS = {
  SINGLE: 'single',
  SIDE_BY_SIDE: 'sideBySide',
  PICTURE_IN_PICTURE: 'pip',
  GRID: 'grid',
  PRESENTER: 'presenter',
  INTERVIEW: 'interview',
  CUSTOM: 'custom'
};

// Layout configurations
const LAYOUT_CONFIGS = {
  [SCENE_LAYOUTS.SINGLE]: {
    name: 'Single Camera',
    icon: RectangleStackIcon,
    description: 'One camera full screen'
  },
  [SCENE_LAYOUTS.SIDE_BY_SIDE]: {
    name: 'Side by Side',
    icon: ViewColumnsIcon,
    description: 'Two cameras split screen'
  },
  [SCENE_LAYOUTS.PICTURE_IN_PICTURE]: {
    name: 'Picture in Picture',
    icon: ArrowsPointingInIcon,
    description: 'Main camera with overlay'
  },
  [SCENE_LAYOUTS.GRID]: {
    name: 'Grid View',
    icon: Squares2X2Icon,
    description: 'Multiple cameras in grid'
  },
  [SCENE_LAYOUTS.PRESENTER]: {
    name: 'Presenter Mode',
    icon: ComputerDesktopIcon,
    description: 'Screen share with camera'
  },
  [SCENE_LAYOUTS.INTERVIEW]: {
    name: 'Interview Mode',
    icon: ViewColumnsIcon,
    description: 'Host and guest side by side'
  }
};

const MultiCameraStreamingManager = ({
  client,
  channel,
  uid,
  isStreaming,
  onLayoutChange,
  onCameraSwitch,
  className = ''
}) => {
  // State management
  const [availableCameras, setAvailableCameras] = useState([]);
  const [availableMicrophones, setAvailableMicrophones] = useState([]);
  const [activeCameras, setActiveCameras] = useState([]);
  const [currentLayout, setCurrentLayout] = useState(SCENE_LAYOUTS.SINGLE);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [pipPosition, setPipPosition] = useState('bottom-right');
  const [cameraPresets, setCameraPresets] = useState([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Video track refs
  const videoTracks = useRef({});
  const screenTrack = useRef(null);
  const previewRef = useRef(null);
  const containerRef = useRef(null);

  // Device enumeration
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Get all available cameras
        const cameras = await AgoraRTC.getCameras();
        const microphones = await AgoraRTC.getMicrophones();
        
        setAvailableCameras(cameras.map(camera => ({
          deviceId: camera.deviceId,
          label: camera.label || `Camera ${cameras.indexOf(camera) + 1}`,
          kind: 'videoinput',
          active: false,
          track: null
        })));
        
        setAvailableMicrophones(microphones);
        
        // Auto-select first camera if available
        if (cameras.length > 0 && activeCameras.length === 0) {
          await activateCamera(cameras[0].deviceId);
        }
      } catch (error) {
        console.error('Error getting devices:', error);
        toast.error('Failed to detect cameras');
      }
    };

    getDevices();
    
    // Listen for device changes (camera plugged in/out)
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    };
  }, []);

  // Activate a camera
  const activateCamera = async (deviceId, label = '') => {
    try {
      setIsTransitioning(true);
      
      // Check if camera is already active
      if (videoTracks.current[deviceId]) {
        toast.info('Camera already active');
        return;
      }

      // Create video track for this camera
      const videoTrack = await AgoraRTC.createCameraVideoTrack({
        cameraId: deviceId,
        encoderConfig: '720p_2',
        optimizationMode: 'balanced'
      });

      // Store the track
      videoTracks.current[deviceId] = videoTrack;
      
      // Update active cameras
      setActiveCameras(prev => [...prev, {
        deviceId,
        label: label || `Camera ${prev.length + 1}`,
        track: videoTrack,
        isMain: prev.length === 0
      }]);

      // Publish if streaming
      if (isStreaming && client) {
        await client.publish(videoTrack);
      }

      toast.success(`${label || 'Camera'} activated`);
    } catch (error) {
      console.error('Error activating camera:', error);
      toast.error('Failed to activate camera');
    } finally {
      setIsTransitioning(false);
    }
  };

  // Deactivate a camera
  const deactivateCamera = async (deviceId) => {
    try {
      setIsTransitioning(true);
      
      const track = videoTracks.current[deviceId];
      if (track) {
        // Unpublish if streaming
        if (isStreaming && client) {
          await client.unpublish(track);
        }
        
        // Stop and close the track
        track.stop();
        track.close();
        
        // Remove from refs
        delete videoTracks.current[deviceId];
        
        // Update active cameras
        setActiveCameras(prev => prev.filter(cam => cam.deviceId !== deviceId));
        
        toast.success('Camera deactivated');
      }
    } catch (error) {
      console.error('Error deactivating camera:', error);
      toast.error('Failed to deactivate camera');
    } finally {
      setIsTransitioning(false);
    }
  };

  // Switch main camera
  const switchMainCamera = (deviceId) => {
    setActiveCameras(prev => prev.map(cam => ({
      ...cam,
      isMain: cam.deviceId === deviceId
    })));
    
    if (onCameraSwitch) {
      onCameraSwitch(deviceId);
    }
  };

  // Start screen sharing
  const startScreenShare = async () => {
    try {
      setIsTransitioning(true);
      
      // Create screen track
      screenTrack.current = await AgoraRTC.createScreenVideoTrack({
        encoderConfig: '1080p_1',
        optimizationMode: 'detail'
      }, 'auto'); // 'auto' includes audio if available

      // Publish if streaming
      if (isStreaming && client) {
        if (Array.isArray(screenTrack.current)) {
          // Screen track with audio
          await client.publish(screenTrack.current);
        } else {
          // Screen track only
          await client.publish(screenTrack.current);
        }
      }

      setIsScreenSharing(true);
      
      // Switch to presenter layout automatically
      if (currentLayout !== SCENE_LAYOUTS.PRESENTER) {
        changeLayout(SCENE_LAYOUTS.PRESENTER);
      }
      
      toast.success('Screen sharing started');
      
      // Listen for screen share end
      if (Array.isArray(screenTrack.current)) {
        screenTrack.current[0].on('track-ended', () => {
          stopScreenShare();
        });
      } else {
        screenTrack.current.on('track-ended', () => {
          stopScreenShare();
        });
      }
    } catch (error) {
      console.error('Error starting screen share:', error);
      if (error.message.includes('Permission denied')) {
        toast.error('Screen sharing permission denied');
      } else {
        toast.error('Failed to start screen sharing');
      }
    } finally {
      setIsTransitioning(false);
    }
  };

  // Stop screen sharing
  const stopScreenShare = async () => {
    try {
      if (screenTrack.current) {
        // Unpublish if streaming
        if (isStreaming && client) {
          if (Array.isArray(screenTrack.current)) {
            await client.unpublish(screenTrack.current);
          } else {
            await client.unpublish(screenTrack.current);
          }
        }
        
        // Stop and close tracks
        if (Array.isArray(screenTrack.current)) {
          screenTrack.current.forEach(track => {
            track.stop();
            track.close();
          });
        } else {
          screenTrack.current.stop();
          screenTrack.current.close();
        }
        
        screenTrack.current = null;
        setIsScreenSharing(false);
        
        // Switch back to previous layout
        if (currentLayout === SCENE_LAYOUTS.PRESENTER) {
          changeLayout(SCENE_LAYOUTS.SINGLE);
        }
        
        toast.success('Screen sharing stopped');
      }
    } catch (error) {
      console.error('Error stopping screen share:', error);
      toast.error('Failed to stop screen sharing');
    }
  };

  // Change scene layout
  const changeLayout = (newLayout) => {
    setIsTransitioning(true);
    setCurrentLayout(newLayout);
    
    if (onLayoutChange) {
      onLayoutChange(newLayout);
    }
    
    setTimeout(() => setIsTransitioning(false), 300);
  };

  // Save camera preset
  const saveCameraPreset = () => {
    const preset = {
      id: Date.now(),
      name: `Preset ${cameraPresets.length + 1}`,
      cameras: activeCameras.map(cam => ({
        deviceId: cam.deviceId,
        label: cam.label,
        isMain: cam.isMain
      })),
      layout: currentLayout,
      timestamp: new Date().toISOString()
    };
    
    setCameraPresets(prev => [...prev, preset]);
    localStorage.setItem('cameraPresets', JSON.stringify([...cameraPresets, preset]));
    toast.success('Camera preset saved');
  };

  // Load camera preset
  const loadCameraPreset = async (preset) => {
    try {
      setIsTransitioning(true);
      
      // Deactivate all current cameras
      for (const cam of activeCameras) {
        await deactivateCamera(cam.deviceId);
      }
      
      // Activate preset cameras
      for (const cam of preset.cameras) {
        await activateCamera(cam.deviceId, cam.label);
        if (cam.isMain) {
          switchMainCamera(cam.deviceId);
        }
      }
      
      // Apply layout
      changeLayout(preset.layout);
      
      toast.success('Preset loaded');
    } catch (error) {
      console.error('Error loading preset:', error);
      toast.error('Failed to load preset');
    } finally {
      setIsTransitioning(false);
    }
  };

  // Preview camera before adding
  const previewCamera = async (deviceId) => {
    try {
      const previewTrack = await AgoraRTC.createCameraVideoTrack({
        cameraId: deviceId,
        encoderConfig: '480p_1'
      });
      
      if (previewRef.current) {
        previewTrack.play(previewRef.current);
      }
      
      setSelectedCamera({ deviceId, track: previewTrack });
      setShowPreview(true);
    } catch (error) {
      console.error('Error previewing camera:', error);
      toast.error('Failed to preview camera');
    }
  };

  // Close preview
  const closePreview = () => {
    if (selectedCamera?.track) {
      selectedCamera.track.stop();
      selectedCamera.track.close();
    }
    setSelectedCamera(null);
    setShowPreview(false);
  };

  // Render video layout
  const renderVideoLayout = () => {
    switch (currentLayout) {
      case SCENE_LAYOUTS.SINGLE:
        return (
          <div className="relative w-full h-full">
            {activeCameras.find(cam => cam.isMain) && (
              <VideoFeed
                camera={activeCameras.find(cam => cam.isMain)}
                isMain={true}
                className="w-full h-full"
              />
            )}
          </div>
        );

      case SCENE_LAYOUTS.SIDE_BY_SIDE:
        return (
          <div className="flex h-full">
            {activeCameras.slice(0, 2).map((camera, index) => (
              <VideoFeed
                key={camera.deviceId}
                camera={camera}
                isMain={camera.isMain}
                className="flex-1 h-full"
              />
            ))}
          </div>
        );

      case SCENE_LAYOUTS.PICTURE_IN_PICTURE:
        const mainCam = activeCameras.find(cam => cam.isMain);
        const pipCam = activeCameras.find(cam => !cam.isMain);
        return (
          <div className="relative w-full h-full">
            {mainCam && (
              <VideoFeed
                camera={mainCam}
                isMain={true}
                className="w-full h-full"
              />
            )}
            {pipCam && (
              <motion.div
                drag
                dragMomentum={false}
                className={`absolute ${pipPosition} w-1/4 h-1/4 min-w-[200px] min-h-[150px] z-10 rounded-lg overflow-hidden shadow-2xl border-2 border-white`}
              >
                <VideoFeed
                  camera={pipCam}
                  isMain={false}
                  className="w-full h-full"
                />
              </motion.div>
            )}
          </div>
        );

      case SCENE_LAYOUTS.GRID:
        const gridCols = activeCameras.length <= 2 ? 2 : activeCameras.length <= 4 ? 2 : 3;
        return (
          <div className={`grid grid-cols-${gridCols} gap-2 h-full p-2`}>
            {activeCameras.map(camera => (
              <VideoFeed
                key={camera.deviceId}
                camera={camera}
                isMain={camera.isMain}
                className="w-full h-full rounded-lg"
                showLabel={true}
              />
            ))}
          </div>
        );

      case SCENE_LAYOUTS.PRESENTER:
        return (
          <div className="relative w-full h-full">
            {isScreenSharing ? (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <div ref={el => screenTrack.current?.play(el)} className="w-full h-full" />
              </div>
            ) : (
              <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                <ComputerDesktopIcon className="w-32 h-32 text-gray-600" />
                <p className="text-gray-500 mt-4">Share your screen to begin</p>
              </div>
            )}
            {activeCameras.find(cam => cam.isMain) && (
              <div className="absolute bottom-4 right-4 w-1/5 h-1/5 min-w-[160px] min-h-[120px] rounded-lg overflow-hidden shadow-2xl border-2 border-white">
                <VideoFeed
                  camera={activeCameras.find(cam => cam.isMain)}
                  isMain={false}
                  className="w-full h-full"
                />
              </div>
            )}
          </div>
        );

      case SCENE_LAYOUTS.INTERVIEW:
        return (
          <div className="flex h-full">
            <div className="flex-1 relative">
              {activeCameras[0] && (
                <VideoFeed
                  camera={activeCameras[0]}
                  isMain={true}
                  className="w-full h-full"
                  showLabel={true}
                  label="Host"
                />
              )}
            </div>
            <div className="flex-1 relative">
              {activeCameras[1] ? (
                <VideoFeed
                  camera={activeCameras[1]}
                  isMain={false}
                  className="w-full h-full"
                  showLabel={true}
                  label="Guest"
                />
              ) : (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                  <UserCircleIcon className="w-32 h-32 text-gray-600" />
                  <p className="text-gray-500 mt-4">Waiting for guest...</p>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Video feed component
  const VideoFeed = ({ camera, isMain, className, showLabel, label }) => {
    const videoRef = useRef(null);
    
    useEffect(() => {
      if (camera?.track && videoRef.current) {
        camera.track.play(videoRef.current);
      }
      
      return () => {
        if (camera?.track) {
          camera.track.stop();
        }
      };
    }, [camera]);

    return (
      <div className={`relative bg-black ${className}`}>
        <div ref={videoRef} className="w-full h-full" />
        {showLabel && (
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-sm rounded">
            {label || camera.label}
          </div>
        )}
        {isMain && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-purple-600 text-white text-xs rounded flex items-center gap-1">
            <StarIcon className="w-3 h-3" />
            Main
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Control Bar */}
      <div className="bg-gray-900 border-b border-gray-700 p-3">
        <div className="flex items-center justify-between">
          {/* Layout Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 mr-2">Layout:</span>
            {Object.entries(LAYOUT_CONFIGS).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  onClick={() => changeLayout(key)}
                  className={`p-2 rounded-lg transition-all ${
                    currentLayout === key
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                  title={config.description}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>

          {/* Camera Controls */}
          <div className="flex items-center gap-2">
            {/* Add Camera */}
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="text-sm">Add Camera</span>
            </button>

            {/* Screen Share Toggle */}
            <button
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isScreenSharing
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              <ComputerDesktopIcon className="w-4 h-4" />
              <span className="text-sm">{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              <CogIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Active Cameras Count */}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <VideoCameraIcon className="w-4 h-4" />
            <span>{activeCameras.length} / {availableCameras.length} cameras</span>
          </div>
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 relative bg-gray-950 overflow-hidden" ref={containerRef}>
        {isTransitioning && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
            <ArrowPathIcon className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
        {renderVideoLayout()}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Camera Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Available Cameras */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">Available Cameras</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableCameras.map(camera => {
                    const isActive = activeCameras.some(c => c.deviceId === camera.deviceId);
                    return (
                      <div
                        key={camera.deviceId}
                        className="bg-gray-700 rounded-lg p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <VideoCameraIcon className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-white font-medium">{camera.label}</p>
                            <p className="text-xs text-gray-400">
                              {isActive ? 'Active' : 'Inactive'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => previewCamera(camera.deviceId)}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => isActive 
                              ? deactivateCamera(camera.deviceId)
                              : activateCamera(camera.deviceId, camera.label)
                            }
                            className={`px-3 py-1 text-white text-sm rounded transition-colors ${
                              isActive
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-green-600 hover:bg-green-700'
                            }`}
                          >
                            {isActive ? 'Remove' : 'Add'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Cameras */}
              {activeCameras.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Active Cameras</h3>
                  <div className="space-y-2">
                    {activeCameras.map(camera => (
                      <div
                        key={camera.deviceId}
                        className="bg-gray-700 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <VideoCameraIcon className="w-5 h-5 text-green-400" />
                          <span className="text-white">{camera.label}</span>
                          {camera.isMain && (
                            <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                              Main
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!camera.isMain && (
                            <button
                              onClick={() => switchMainCamera(camera.deviceId)}
                              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
                            >
                              Set as Main
                            </button>
                          )}
                          <button
                            onClick={() => deactivateCamera(camera.deviceId)}
                            className="p-1 hover:bg-gray-600 rounded transition-colors"
                          >
                            <XMarkIcon className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Camera Presets */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">Camera Presets</h3>
                  <button
                    onClick={saveCameraPreset}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
                  >
                    Save Current Setup
                  </button>
                </div>
                {cameraPresets.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {cameraPresets.map(preset => (
                      <div
                        key={preset.id}
                        className="bg-gray-700 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-white font-medium">{preset.name}</p>
                          <p className="text-xs text-gray-400">
                            {preset.cameras.length} cameras, {LAYOUT_CONFIGS[preset.layout].name}
                          </p>
                        </div>
                        <button
                          onClick={() => loadCameraPreset(preset)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        >
                          Load
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No presets saved yet</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera Preview Modal */}
      <AnimatePresence>
        {showPreview && selectedCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={closePreview}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-gray-800 rounded-xl p-4 max-w-2xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Camera Preview</h3>
                <button
                  onClick={closePreview}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <div ref={previewRef} className="w-full h-full" />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={closePreview}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const camera = availableCameras.find(c => c.deviceId === selectedCamera.deviceId);
                    activateCamera(selectedCamera.deviceId, camera?.label);
                    closePreview();
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Add Camera
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MultiCameraStreamingManager;