import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SpeakerWaveIcon,
  MicrophoneIcon,
  MusicalNoteIcon,
  CpuChipIcon,
  DocumentTextIcon,
  CubeIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';
import Card from './ui/Card';
import Button from './ui/Button';
import Slider from './ui/Slider';
import toast from 'react-hot-toast';

const AIAudioEnhancements = ({
  isOpen,
  onClose,
  audioTrack,
  onEnhancementsChanged,
  currentSettings = {},
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState('noise');
  const [enhancements, setEnhancements] = useState({
    aiNoiseSuppression: currentSettings.aiNoiseSuppression || {
      enabled: true,
      level: 'high', // 'low', 'medium', 'high'
      mode: 'stationary' // 'stationary', 'non-stationary'
    },
    spatialAudio: currentSettings.spatialAudio || {
      enabled: false,
      mode: '3d', // '3d', 'stereo'
      position: { x: 0, y: 0, z: 1 },
      roomSize: 'medium' // 'small', 'medium', 'large'
    },
    voiceEnhancement: currentSettings.voiceEnhancement || {
      enabled: true,
      clarity: 0.7,
      warmth: 0.5,
      brightness: 0.6
    },
    echoCancellation: currentSettings.echoCancellation || {
      enabled: true,
      mode: 'aggressive' // 'conservative', 'moderate', 'aggressive'
    },
    musicMode: currentSettings.musicMode || {
      enabled: false,
      preset: 'vocal', // 'vocal', 'instrument', 'balanced'
      highFidelity: true
    },
    realTimeStt: currentSettings.realTimeStt || {
      enabled: false,
      language: 'en-US',
      showCaptions: true,
      punctuation: true
    }
  });

  const [sttTranscript, setSttTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Apply AI enhancements to audio track
  const applyEnhancements = useCallback(async () => {
    if (!audioTrack) return;

    setIsProcessing(true);
    
    try {
      // AI Noise Suppression
      if (enhancements.aiNoiseSuppression.enabled) {
        await audioTrack.setAINSMode(true, enhancements.aiNoiseSuppression.mode);
        
        // Set noise suppression level
        const levelMap = { low: 0, medium: 1, high: 2 };
        await audioTrack.setParameters({
          "che.audio.ains_mode": levelMap[enhancements.aiNoiseSuppression.level],
          "che.audio.nsng.lowerBound": 80,
          "che.audio.nsng.upperBound": 10000
        });
      } else {
        await audioTrack.setAINSMode(false);
      }

      // 3D Spatial Audio
      if (enhancements.spatialAudio.enabled) {
        await audioTrack.setParameters({
          "che.audio.enable_3d_voice": true,
          "che.audio.3d_voice_mode": enhancements.spatialAudio.mode === '3d' ? 1 : 0,
          "che.audio.3d_room_size": getRoomSizeValue(enhancements.spatialAudio.roomSize)
        });
        
        // Set spatial position
        await audioTrack.setSpatialPosition(
          enhancements.spatialAudio.position.x,
          enhancements.spatialAudio.position.y,
          enhancements.spatialAudio.position.z
        );
      } else {
        await audioTrack.setParameters({
          "che.audio.enable_3d_voice": false
        });
      }

      // Voice Enhancement
      if (enhancements.voiceEnhancement.enabled) {
        await audioTrack.setParameters({
          "che.audio.morph.voice_changer": 1,
          "che.audio.voice_clarity": enhancements.voiceEnhancement.clarity,
          "che.audio.voice_warmth": enhancements.voiceEnhancement.warmth,
          "che.audio.voice_brightness": enhancements.voiceEnhancement.brightness
        });
      }

      // Echo Cancellation
      if (enhancements.echoCancellation.enabled) {
        const modeMap = { conservative: 0, moderate: 1, aggressive: 2 };
        await audioTrack.setParameters({
          "che.audio.aec_mode": modeMap[enhancements.echoCancellation.mode],
          "che.audio.enable_aec": true
        });
      }

      // Music Mode
      if (enhancements.musicMode.enabled) {
        await audioTrack.setParameters({
          "che.audio.profile": "music_high_quality",
          "che.audio.scenario": "chorus",
          "che.audio.music_mode_preset": enhancements.musicMode.preset,
          "che.audio.enable_high_fidelity": enhancements.musicMode.highFidelity
        });
      }

      // Real-Time Speech to Text
      if (enhancements.realTimeStt.enabled) {
        startSpeechToText();
      } else {
        stopSpeechToText();
      }

      // toast.success('Audio enhancements applied! 🎵', {
        duration: 2000
      });
      
      if (onEnhancementsChanged) {
        onEnhancementsChanged(enhancements);
      }
    } catch (error) {
      console.error('Error applying audio enhancements:', error);
      toast.error('Failed to apply some enhancements');
    } finally {
      setIsProcessing(false);
    }
  }, [audioTrack, enhancements, onEnhancementsChanged]);

  const getRoomSizeValue = (size) => {
    const sizeMap = { small: 0, medium: 1, large: 2 };
    return sizeMap[size] || 1;
  };

  const startSpeechToText = useCallback(() => {
    if (!audioTrack) return;

    // Initialize Agora STT
    try {
      audioTrack.startAudioRecognition({
        language: enhancements.realTimeStt.language,
        punctuation: enhancements.realTimeStt.punctuation,
        interim: true,
        onResult: (result) => {
          setSttTranscript(result.transcript);
          if (result.isFinal && enhancements.realTimeStt.showCaptions) {
            // Emit caption event for display
            window.dispatchEvent(new CustomEvent('caption', {
              detail: { text: result.transcript, timestamp: Date.now() }
            }));
          }
        },
        onError: (error) => {
          console.error('STT error:', error);
        }
      });
    } catch (error) {
      console.error('Failed to start STT:', error);
    }
  }, [audioTrack, enhancements.realTimeStt]);

  const stopSpeechToText = useCallback(() => {
    if (!audioTrack) return;
    
    try {
      audioTrack.stopAudioRecognition();
      setSttTranscript('');
    } catch (error) {
      console.error('Failed to stop STT:', error);
    }
  }, [audioTrack]);

  const updateEnhancement = (category, key, value) => {
    setEnhancements(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const presets = {
    podcast: {
      aiNoiseSuppression: { enabled: true, level: 'high', mode: 'stationary' },
      voiceEnhancement: { enabled: true, clarity: 0.9, warmth: 0.6, brightness: 0.7 },
      echoCancellation: { enabled: true, mode: 'aggressive' }
    },
    music: {
      musicMode: { enabled: true, preset: 'balanced', highFidelity: true },
      aiNoiseSuppression: { enabled: false },
      voiceEnhancement: { enabled: false }
    },
    gaming: {
      spatialAudio: { enabled: true, mode: '3d' },
      aiNoiseSuppression: { enabled: true, level: 'medium', mode: 'non-stationary' },
      echoCancellation: { enabled: true, mode: 'moderate' }
    }
  };

  const applyPreset = (presetName) => {
    const preset = presets[presetName];
    if (preset) {
      setEnhancements(prev => ({ ...prev, ...preset }));
      // toast.success(`${presetName.charAt(0).toUpperCase() + presetName.slice(1)} preset applied!`);
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
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={`bg-white dark:bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl ${className}`}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <CpuChipIcon className="w-8 h-8" />
                    AI Audio Enhancements
                  </h2>
                  <p className="text-purple-100 mt-1">
                    Powered by Agora's advanced audio processing
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Quick Presets:
                </span>
                <div className="flex gap-2">
                  {Object.keys(presets).map(preset => (
                    <Button
                      key={preset}
                      size="sm"
                      variant="secondary"
                      onClick={() => applyPreset(preset)}
                    >
                      {preset.charAt(0).toUpperCase() + preset.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('noise')}
                className={`flex-1 py-3 px-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'noise'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <MicrophoneIcon className="w-5 h-5" />
                Noise & Echo
              </button>
              <button
                onClick={() => setActiveTab('spatial')}
                className={`flex-1 py-3 px-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'spatial'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <CubeIcon className="w-5 h-5" />
                3D Spatial
              </button>
              <button
                onClick={() => setActiveTab('voice')}
                className={`flex-1 py-3 px-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'voice'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <SpeakerWaveIcon className="w-5 h-5" />
                Voice Enhancement
              </button>
              <button
                onClick={() => setActiveTab('stt')}
                className={`flex-1 py-3 px-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'stt'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <DocumentTextIcon className="w-5 h-5" />
                Speech to Text
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 overflow-y-auto" style={{ maxHeight: '400px' }}>
              {activeTab === 'noise' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* AI Noise Suppression */}
                  <Card className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <SparklesIcon className="w-5 h-5 text-purple-600" />
                          AI Noise Suppression
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Remove background noise using advanced AI
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enhancements.aiNoiseSuppression.enabled}
                          onChange={(e) => updateEnhancement('aiNoiseSuppression', 'enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    
                    {enhancements.aiNoiseSuppression.enabled && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Suppression Level
                          </label>
                          <div className="flex gap-2 mt-2">
                            {['low', 'medium', 'high'].map(level => (
                              <button
                                key={level}
                                onClick={() => updateEnhancement('aiNoiseSuppression', 'level', level)}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                  enhancements.aiNoiseSuppression.level === level
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {level.charAt(0).toUpperCase() + level.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Noise Type
                          </label>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => updateEnhancement('aiNoiseSuppression', 'mode', 'stationary')}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                enhancements.aiNoiseSuppression.mode === 'stationary'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              Stationary (Fan, AC)
                            </button>
                            <button
                              onClick={() => updateEnhancement('aiNoiseSuppression', 'mode', 'non-stationary')}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                enhancements.aiNoiseSuppression.mode === 'non-stationary'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              Non-Stationary (Traffic, Typing)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* Echo Cancellation */}
                  <Card className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Echo Cancellation
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Eliminate audio feedback and echo
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enhancements.echoCancellation.enabled}
                          onChange={(e) => updateEnhancement('echoCancellation', 'enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    
                    {enhancements.echoCancellation.enabled && (
                      <div className="flex gap-2">
                        {['conservative', 'moderate', 'aggressive'].map(mode => (
                          <button
                            key={mode}
                            onClick={() => updateEnhancement('echoCancellation', 'mode', mode)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              enhancements.echoCancellation.mode === mode
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </button>
                        ))}
                      </div>
                    )}
                  </Card>
                </motion.div>
              )}

              {activeTab === 'spatial' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <Card className="p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <CubeIcon className="w-5 h-5 text-purple-600" />
                          3D Spatial Audio
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Create immersive audio experiences
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enhancements.spatialAudio.enabled}
                          onChange={(e) => updateEnhancement('spatialAudio', 'enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    
                    {enhancements.spatialAudio.enabled && (
                      <div className="space-y-6">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Audio Mode
                          </label>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => updateEnhancement('spatialAudio', 'mode', '3d')}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                enhancements.spatialAudio.mode === '3d'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              3D Audio
                            </button>
                            <button
                              onClick={() => updateEnhancement('spatialAudio', 'mode', 'stereo')}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                enhancements.spatialAudio.mode === 'stereo'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              Stereo
                            </button>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Room Size
                          </label>
                          <div className="flex gap-2 mt-2">
                            {['small', 'medium', 'large'].map(size => (
                              <button
                                key={size}
                                onClick={() => updateEnhancement('spatialAudio', 'roomSize', size)}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                  enhancements.spatialAudio.roomSize === size
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {size.charAt(0).toUpperCase() + size.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 3D Position Visualizer */}
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Spatial Position
                          </p>
                          <div className="relative w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-32 h-32 border-2 border-dashed border-gray-400 rounded-full" />
                              <div className="w-16 h-16 border-2 border-dashed border-gray-400 rounded-full absolute" />
                              <motion.div
                                drag
                                dragConstraints={{ left: -64, right: 64, top: -64, bottom: 64 }}
                                className="absolute w-8 h-8 bg-purple-600 rounded-full cursor-move flex items-center justify-center"
                                style={{
                                  x: enhancements.spatialAudio.position.x * 64,
                                  y: -enhancements.spatialAudio.position.y * 64
                                }}
                                onDrag={(e, info) => {
                                  updateEnhancement('spatialAudio', 'position', {
                                    ...enhancements.spatialAudio.position,
                                    x: info.offset.x / 64,
                                    y: -info.offset.y / 64
                                  });
                                }}
                              >
                                <SpeakerWaveIcon className="w-4 h-4 text-white" />
                              </motion.div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                            Drag to position audio source
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )}

              {activeTab === 'voice' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <Card className="p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <SpeakerWaveIcon className="w-5 h-5 text-purple-600" />
                          Voice Enhancement
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Enhance voice clarity and quality
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enhancements.voiceEnhancement.enabled}
                          onChange={(e) => updateEnhancement('voiceEnhancement', 'enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    
                    {enhancements.voiceEnhancement.enabled && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <AdjustmentsHorizontalIcon className="w-4 h-4" />
                            Voice Clarity
                          </label>
                          <Slider
                            value={enhancements.voiceEnhancement.clarity}
                            onChange={(value) => updateEnhancement('voiceEnhancement', 'clarity', value)}
                            min={0}
                            max={1}
                            step={0.1}
                            className="mt-2"
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <SunIcon className="w-4 h-4" />
                            Voice Warmth
                          </label>
                          <Slider
                            value={enhancements.voiceEnhancement.warmth}
                            onChange={(value) => updateEnhancement('voiceEnhancement', 'warmth', value)}
                            min={0}
                            max={1}
                            step={0.1}
                            className="mt-2"
                            color="pink"
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <SparklesIcon className="w-4 h-4" />
                            Voice Brightness
                          </label>
                          <Slider
                            value={enhancements.voiceEnhancement.brightness}
                            onChange={(value) => updateEnhancement('voiceEnhancement', 'brightness', value)}
                            min={0}
                            max={1}
                            step={0.1}
                            className="mt-2"
                            color="blue"
                          />
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* Music Mode */}
                  <Card className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <MusicalNoteIcon className="w-5 h-5 text-purple-600" />
                          Music Mode
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Optimize for musical performances
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enhancements.musicMode.enabled}
                          onChange={(e) => updateEnhancement('musicMode', 'enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    
                    {enhancements.musicMode.enabled && (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          {['vocal', 'instrument', 'balanced'].map(preset => (
                            <button
                              key={preset}
                              onClick={() => updateEnhancement('musicMode', 'preset', preset)}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                enhancements.musicMode.preset === preset
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {preset.charAt(0).toUpperCase() + preset.slice(1)}
                            </button>
                          ))}
                        </div>
                        
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enhancements.musicMode.highFidelity}
                            onChange={(e) => updateEnhancement('musicMode', 'highFidelity', e.target.checked)}
                            className="rounded text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            High Fidelity Mode (48kHz)
                          </span>
                        </label>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )}

              {activeTab === 'stt' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <Card className="p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <DocumentTextIcon className="w-5 h-5 text-purple-600" />
                          Real-Time Speech to Text
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Live transcription and captions
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enhancements.realTimeStt.enabled}
                          onChange={(e) => updateEnhancement('realTimeStt', 'enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    
                    {enhancements.realTimeStt.enabled && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Language
                          </label>
                          <select
                            value={enhancements.realTimeStt.language}
                            onChange={(e) => updateEnhancement('realTimeStt', 'language', e.target.value)}
                            className="mt-1 block w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                          >
                            <option value="en-US">English (US)</option>
                            <option value="en-GB">English (UK)</option>
                            <option value="es-ES">Spanish</option>
                            <option value="fr-FR">French</option>
                            <option value="de-DE">German</option>
                            <option value="ja-JP">Japanese</option>
                            <option value="zh-CN">Chinese (Mandarin)</option>
                          </select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={enhancements.realTimeStt.showCaptions}
                              onChange={(e) => updateEnhancement('realTimeStt', 'showCaptions', e.target.checked)}
                              className="rounded text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              Show live captions
                            </span>
                          </label>
                          
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={enhancements.realTimeStt.punctuation}
                              onChange={(e) => updateEnhancement('realTimeStt', 'punctuation', e.target.checked)}
                              className="rounded text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              Add punctuation
                            </span>
                          </label>
                        </div>
                        
                        {sttTranscript && (
                          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Live Transcript
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 italic">
                              {sttTranscript}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Changes apply in real-time
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={onClose}
                  >
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    onClick={applyEnhancements}
                    disabled={isProcessing}
                    icon={<CpuChipIcon className="w-5 h-5" />}
                  >
                    {isProcessing ? 'Applying...' : 'Apply All'}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIAudioEnhancements;