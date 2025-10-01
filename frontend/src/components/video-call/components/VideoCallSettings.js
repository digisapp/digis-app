/**
 * Video call settings component
 * @module components/VideoCallSettings
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CogIcon,
  XMarkIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  ComputerDesktopIcon,
  SpeakerWaveIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

/**
 * Settings panel for video call configuration
 */
const VideoCallSettings = ({ 
  localTracks, 
  onClose, 
  onUpdateSettings,
  currentSettings = {} 
}) => {
  // Video settings
  const [videoQuality, setVideoQuality] = useState(currentSettings.videoQuality || 'auto');
  const [frameRate, setFrameRate] = useState(currentSettings.frameRate || 30);
  const [videoDevice, setVideoDevice] = useState('default');
  
  // Audio settings
  const [audioQuality, setAudioQuality] = useState(currentSettings.audioQuality || 'high');
  const [audioDevice, setAudioDevice] = useState('default');
  const [outputDevice, setOutputDevice] = useState('default');
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [autoGainControl, setAutoGainControl] = useState(true);
  
  // Available devices
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);

  /**
   * Get available media devices
   */
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        setVideoDevices(
          devices.filter(device => device.kind === 'videoinput')
        );
        setAudioInputDevices(
          devices.filter(device => device.kind === 'audioinput')
        );
        setAudioOutputDevices(
          devices.filter(device => device.kind === 'audiooutput')
        );
      } catch (error) {
        console.error('Error getting devices:', error);
      }
    };

    getDevices();
  }, []);

  /**
   * Apply video settings
   */
  const applyVideoSettings = async () => {
    try {
      if (localTracks?.video) {
        // Apply quality settings
        const constraints = {
          width: videoQuality === '1080p' ? 1920 : 
                 videoQuality === '720p' ? 1280 : 
                 videoQuality === '480p' ? 640 : undefined,
          height: videoQuality === '1080p' ? 1080 : 
                  videoQuality === '720p' ? 720 : 
                  videoQuality === '480p' ? 480 : undefined,
          frameRate: frameRate
        };
        
        // Apply constraints to track
        await localTracks.video.applyConstraints(constraints);
      }
      
      toast.success('Video settings applied');
    } catch (error) {
      console.error('Error applying video settings:', error);
      toast.error('Failed to apply video settings');
    }
  };

  /**
   * Apply audio settings
   */
  const applyAudioSettings = async () => {
    try {
      if (localTracks?.audio) {
        const constraints = {
          echoCancellation,
          noiseSuppression,
          autoGainControl,
          sampleRate: audioQuality === 'high' ? 48000 : 
                      audioQuality === 'medium' ? 24000 : 16000
        };
        
        await localTracks.audio.applyConstraints(constraints);
      }
      
      toast.success('Audio settings applied');
    } catch (error) {
      console.error('Error applying audio settings:', error);
      toast.error('Failed to apply audio settings');
    }
  };

  /**
   * Save all settings
   */
  const saveSettings = () => {
    const settings = {
      videoQuality,
      frameRate,
      videoDevice,
      audioQuality,
      audioDevice,
      outputDevice,
      noiseSuppression,
      echoCancellation,
      autoGainControl
    };
    
    onUpdateSettings?.(settings);
    applyVideoSettings();
    applyAudioSettings();
    
    toast.success('Settings saved');
    onClose();
  };

  return (
    <motion.div
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
      className="absolute left-0 top-20 bottom-24 w-80 bg-gray-900/95 backdrop-blur-xl border-r border-gray-700 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CogIcon className="w-5 h-5 text-purple-400" />
            <h3 className="text-white font-semibold">Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Video Settings */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <VideoCameraIcon className="w-5 h-5 text-purple-400" />
            <h4 className="text-white font-medium">Video Settings</h4>
          </div>
          
          <div className="space-y-4">
            {/* Quality */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">
                Video Quality
              </label>
              <select
                value={videoQuality}
                onChange={(e) => setVideoQuality(e.target.value)}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="auto">Auto (Recommended)</option>
                <option value="1080p">1080p HD</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
                <option value="360p">360p (Low bandwidth)</option>
              </select>
            </div>

            {/* Frame Rate */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">
                Frame Rate
              </label>
              <select
                value={frameRate}
                onChange={(e) => setFrameRate(Number(e.target.value))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value={15}>15 FPS (Low)</option>
                <option value={24}>24 FPS</option>
                <option value={30}>30 FPS (Recommended)</option>
                <option value={60}>60 FPS (Smooth)</option>
              </select>
            </div>

            {/* Camera Selection */}
            {videoDevices.length > 0 && (
              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Camera
                </label>
                <select
                  value={videoDevice}
                  onChange={(e) => setVideoDevice(e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {videoDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Audio Settings */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <MicrophoneIcon className="w-5 h-5 text-purple-400" />
            <h4 className="text-white font-medium">Audio Settings</h4>
          </div>
          
          <div className="space-y-4">
            {/* Audio Quality */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">
                Audio Quality
              </label>
              <select
                value={audioQuality}
                onChange={(e) => setAudioQuality(e.target.value)}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="high">High (48 kHz)</option>
                <option value="medium">Medium (24 kHz)</option>
                <option value="low">Low (16 kHz)</option>
              </select>
            </div>

            {/* Microphone Selection */}
            {audioInputDevices.length > 0 && (
              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Microphone
                </label>
                <select
                  value={audioDevice}
                  onChange={(e) => setAudioDevice(e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {audioInputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Speaker Selection */}
            {audioOutputDevices.length > 0 && (
              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Speaker
                </label>
                <select
                  value={outputDevice}
                  onChange={(e) => setOutputDevice(e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {audioOutputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Speaker ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Audio Processing */}
            <div>
              <h5 className="text-gray-400 text-sm mb-3">Audio Processing</h5>
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-white text-sm">Noise Suppression</span>
                  <input
                    type="checkbox"
                    checked={noiseSuppression}
                    onChange={(e) => setNoiseSuppression(e.target.checked)}
                    className="w-4 h-4 text-purple-500 bg-gray-700 rounded focus:ring-purple-500"
                  />
                </label>
                
                <label className="flex items-center justify-between">
                  <span className="text-white text-sm">Echo Cancellation</span>
                  <input
                    type="checkbox"
                    checked={echoCancellation}
                    onChange={(e) => setEchoCancellation(e.target.checked)}
                    className="w-4 h-4 text-purple-500 bg-gray-700 rounded focus:ring-purple-500"
                  />
                </label>
                
                <label className="flex items-center justify-between">
                  <span className="text-white text-sm">Auto Gain Control</span>
                  <input
                    type="checkbox"
                    checked={autoGainControl}
                    onChange={(e) => setAutoGainControl(e.target.checked)}
                    className="w-4 h-4 text-purple-500 bg-gray-700 rounded focus:ring-purple-500"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AdjustmentsHorizontalIcon className="w-5 h-5 text-purple-400" />
            <h4 className="text-white font-medium">Advanced</h4>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => {
                // Test audio
                const audio = new Audio();
                audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhCiuBzvLZiTcIG2m98OScTgwOUKve6by2';
                audio.play();
                toast.success('Testing audio output');
              }}
              className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Test Audio Output
            </button>
            
            <button
              onClick={() => {
                navigator.mediaDevices.getUserMedia({ audio: true, video: true })
                  .then(() => toast.success('Permissions granted'))
                  .catch(() => toast.error('Permissions denied'));
              }}
              className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Check Permissions
            </button>
          </div>
        </div>
      </div>

      {/* Footer with save button */}
      <div className="p-4 border-t border-gray-700 bg-gray-800/50">
        <button
          onClick={saveSettings}
          className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:shadow-lg transition-all"
        >
          Save Settings
        </button>
      </div>
    </motion.div>
  );
};

export default VideoCallSettings;