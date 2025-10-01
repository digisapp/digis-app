import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  XMarkIcon,
  CogIcon,
  SignalIcon
} from '@heroicons/react/24/outline';
import {
  VideoCameraIcon as VideoCameraIconSolid,
  MicrophoneIcon as MicrophoneIconSolid,
  SpeakerWaveIcon as SpeakerWaveIconSolid
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const CallPreparationSetup = ({
  isOpen,
  onClose,
  onProceed,
  sessionType,
  creator,
  estimatedDuration = 10,
  estimatedCost = 0,
  user
}) => {
  const [mediaPermissions, setMediaPermissions] = useState({
    camera: null,
    microphone: null,
    speaker: null
  });
  const [mediaDevices, setMediaDevices] = useState({
    cameras: [],
    microphones: [],
    speakers: []
  });
  const [selectedDevices, setSelectedDevices] = useState({
    camera: '',
    microphone: '',
    speaker: ''
  });
  const [testingStates, setTestingStates] = useState({
    camera: 'idle', // idle, testing, success, error
    microphone: 'idle',
    speaker: 'idle'
  });
  const [mediaStream, setMediaStream] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [networkQuality, setNetworkQuality] = useState('checking'); // checking, excellent, good, poor
  const [allChecksComplete, setAllChecksComplete] = useState(false);
  
  const videoRef = useRef(null);
  const audioContext = useRef(null);
  const analyzer = useRef(null);
  const dataArray = useRef(null);
  const animationFrame = useRef(null);

  // Initialize media devices and permissions
  useEffect(() => {
    if (isOpen) {
      initializeMediaSetup();
      checkNetworkQuality();
    }

    return () => {
      cleanupMedia();
    };
  }, [isOpen]);

  // Cleanup media resources
  const cleanupMedia = useCallback(() => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext.current) {
      audioContext.current.close();
    }
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }
  }, [mediaStream]);

  // Initialize media setup
  const initializeMediaSetup = async () => {
    try {
      // Request permissions and get devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const microphones = devices.filter(device => device.kind === 'audioinput');
      const speakers = devices.filter(device => device.kind === 'audiooutput');

      setMediaDevices({ cameras, microphones, speakers });

      // Set default devices
      if (cameras.length > 0) setSelectedDevices(prev => ({ ...prev, camera: cameras[0].deviceId }));
      if (microphones.length > 0) setSelectedDevices(prev => ({ ...prev, microphone: microphones[0].deviceId }));
      if (speakers.length > 0) setSelectedDevices(prev => ({ ...prev, speaker: speakers[0].deviceId }));

      // Check initial permissions
      checkMediaPermissions();
    } catch (error) {
      console.error('Error initializing media setup:', error);
      toast.error('Failed to initialize media devices');
    }
  };

  // Check media permissions
  const checkMediaPermissions = async () => {
    try {
      if (sessionType === 'video') {
        const videoPermission = await navigator.permissions.query({ name: 'camera' });
        const audioPermission = await navigator.permissions.query({ name: 'microphone' });
        
        setMediaPermissions(prev => ({
          ...prev,
          camera: videoPermission.state,
          microphone: audioPermission.state
        }));
      } else {
        const audioPermission = await navigator.permissions.query({ name: 'microphone' });
        
        setMediaPermissions(prev => ({
          ...prev,
          microphone: audioPermission.state
        }));
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  // Test camera
  const testCamera = async () => {
    setTestingStates(prev => ({ ...prev, camera: 'testing' }));
    
    try {
      const constraints = {
        video: { 
          deviceId: selectedDevices.camera ? { exact: selectedDevices.camera } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setMediaStream(stream);
      setTestingStates(prev => ({ ...prev, camera: 'success' }));
      setMediaPermissions(prev => ({ ...prev, camera: 'granted' }));
      
      // toast.success('Camera test successful!');
      
      // Auto-stop preview after 5 seconds
      setTimeout(() => {
        if (stream) {
          stream.getVideoTracks().forEach(track => track.stop());
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }, 5000);
      
    } catch (error) {
      console.error('Camera test failed:', error);
      setTestingStates(prev => ({ ...prev, camera: 'error' }));
      setMediaPermissions(prev => ({ ...prev, camera: 'denied' }));
      
      if (error.name === 'NotAllowedError') {
        toast.error('Camera permission denied. Please allow camera access.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No camera found. Please connect a camera.');
      } else {
        toast.error('Camera test failed. Please check your camera.');
      }
    }
  };

  // Test microphone
  const testMicrophone = async () => {
    setTestingStates(prev => ({ ...prev, microphone: 'testing' }));
    
    try {
      const constraints = {
        audio: {
          deviceId: selectedDevices.microphone ? { exact: selectedDevices.microphone } : undefined
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Setup audio analysis
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      analyzer.current = audioContext.current.createAnalyser();
      const microphone = audioContext.current.createMediaStreamSource(stream);
      
      microphone.connect(analyzer.current);
      analyzer.current.fftSize = 256;
      
      const bufferLength = analyzer.current.frequencyBinCount;
      dataArray.current = new Uint8Array(bufferLength);
      
      // Start monitoring audio levels
      const monitorAudio = () => {
        if (analyzer.current && dataArray.current) {
          analyzer.current.getByteFrequencyData(dataArray.current);
          const average = dataArray.current.reduce((a, b) => a + b) / bufferLength;
          setAudioLevel(Math.round((average / 255) * 100));
          
          animationFrame.current = requestAnimationFrame(monitorAudio);
        }
      };
      
      monitorAudio();
      
      setTestingStates(prev => ({ ...prev, microphone: 'success' }));
      setMediaPermissions(prev => ({ ...prev, microphone: 'granted' }));
      // toast.success('Microphone test successful! Speak to see the audio level.');
      
      // Stop test after 10 seconds
      setTimeout(() => {
        if (stream) {
          stream.getAudioTracks().forEach(track => track.stop());
        }
        if (animationFrame.current) {
          cancelAnimationFrame(animationFrame.current);
        }
        if (audioContext.current) {
          audioContext.current.close();
        }
        setAudioLevel(0);
      }, 10000);
      
    } catch (error) {
      console.error('Microphone test failed:', error);
      setTestingStates(prev => ({ ...prev, microphone: 'error' }));
      setMediaPermissions(prev => ({ ...prev, microphone: 'denied' }));
      
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone permission denied. Please allow microphone access.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone.');
      } else {
        toast.error('Microphone test failed. Please check your microphone.');
      }
    }
  };

  // Test speaker
  const testSpeaker = async () => {
    setTestingStates(prev => ({ ...prev, speaker: 'testing' }));
    
    try {
      // Create test audio
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1);
      
      setTestingStates(prev => ({ ...prev, speaker: 'success' }));
      // toast.success('Speaker test complete! Did you hear the sound?');
      
      setTimeout(() => audioContext.close(), 1500);
      
    } catch (error) {
      console.error('Speaker test failed:', error);
      setTestingStates(prev => ({ ...prev, speaker: 'error' }));
      toast.error('Speaker test failed. Please check your speakers.');
    }
  };

  // Check network quality
  const checkNetworkQuality = async () => {
    try {
      const startTime = performance.now();
      
      // Simple network test - fetch a small resource
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/health`, { 
        cache: 'no-cache' 
      });
      
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      if (latency < 100) {
        setNetworkQuality('excellent');
      } else if (latency < 300) {
        setNetworkQuality('good');
      } else {
        setNetworkQuality('poor');
      }
    } catch (error) {
      console.error('Network quality check failed:', error);
      setNetworkQuality('poor');
    }
  };

  // Check if all required tests are complete
  useEffect(() => {
    const cameraOk = sessionType === 'voice' || testingStates.camera === 'success';
    const micOk = testingStates.microphone === 'success';
    const speakerOk = testingStates.speaker === 'success';
    const networkOk = networkQuality !== 'checking';
    
    setAllChecksComplete(cameraOk && micOk && speakerOk && networkOk);
  }, [testingStates, networkQuality, sessionType]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'error':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />;
      case 'testing':
        return <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      default:
        return <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'border-green-500 bg-green-50';
      case 'error':
        return 'border-red-500 bg-red-50';
      case 'testing':
        return 'border-blue-500 bg-blue-50';
      default:
        return 'border-gray-300 bg-white';
    }
  };

  const getNetworkQualityColor = (quality) => {
    switch (quality) {
      case 'excellent':
        return 'text-green-600';
      case 'good':
        return 'text-yellow-600';
      case 'poor':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900">Call Setup</h3>
                <p className="text-sm text-gray-600">
                  Let's make sure everything works before your {sessionType} call with @{creator?.username}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Call Details */}
            <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-blue-900">Call Details</h4>
                  <p className="text-sm text-blue-700">
                    {sessionType} call • {estimatedDuration} minutes • {estimatedCost} tokens
                  </p>
                </div>
                <div className="text-2xl">
                  {sessionType === 'video' ? '📹' : '🎙️'}
                </div>
              </div>
            </div>

            {/* Media Tests */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Media Check</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Camera Test */}
                {sessionType === 'video' && (
                  <div className={`p-4 rounded-xl border-2 ${getStatusColor(testingStates.camera)}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <VideoCameraIconSolid className="w-6 h-6 text-gray-700" />
                        <span className="font-medium">Camera</span>
                      </div>
                      {getStatusIcon(testingStates.camera)}
                    </div>
                    
                    {/* Video Preview */}
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      className="w-full h-32 bg-gray-900 rounded-lg mb-3 object-cover"
                    />
                    
                    {/* Camera Selection */}
                    {mediaDevices.cameras.length > 1 && (
                      <select
                        value={selectedDevices.camera}
                        onChange={(e) => setSelectedDevices(prev => ({ ...prev, camera: e.target.value }))}
                        className="w-full mb-3 px-2 py-1 text-sm border border-gray-300 rounded"
                      >
                        {mediaDevices.cameras.map(camera => (
                          <option key={camera.deviceId} value={camera.deviceId}>
                            {camera.label || `Camera ${camera.deviceId.substring(0, 8)}`}
                          </option>
                        ))}
                      </select>
                    )}
                    
                    <button
                      onClick={testCamera}
                      disabled={testingStates.camera === 'testing'}
                      className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {testingStates.camera === 'testing' ? 'Testing...' : 'Test Camera'}
                    </button>
                  </div>
                )}

                {/* Microphone Test */}
                <div className={`p-4 rounded-xl border-2 ${getStatusColor(testingStates.microphone)}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MicrophoneIconSolid className="w-6 h-6 text-gray-700" />
                      <span className="font-medium">Microphone</span>
                    </div>
                    {getStatusIcon(testingStates.microphone)}
                  </div>
                  
                  {/* Audio Level Indicator */}
                  <div className="mb-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-100"
                        style={{ width: `${audioLevel}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Audio Level: {audioLevel}%
                    </p>
                  </div>
                  
                  {/* Microphone Selection */}
                  {mediaDevices.microphones.length > 1 && (
                    <select
                      value={selectedDevices.microphone}
                      onChange={(e) => setSelectedDevices(prev => ({ ...prev, microphone: e.target.value }))}
                      className="w-full mb-3 px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      {mediaDevices.microphones.map(mic => (
                        <option key={mic.deviceId} value={mic.deviceId}>
                          {mic.label || `Microphone ${mic.deviceId.substring(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  )}
                  
                  <button
                    onClick={testMicrophone}
                    disabled={testingStates.microphone === 'testing'}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {testingStates.microphone === 'testing' ? 'Testing...' : 'Test Microphone'}
                  </button>
                </div>

                {/* Speaker Test */}
                <div className={`p-4 rounded-xl border-2 ${getStatusColor(testingStates.speaker)}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <SpeakerWaveIconSolid className="w-6 h-6 text-gray-700" />
                      <span className="font-medium">Speakers</span>
                    </div>
                    {getStatusIcon(testingStates.speaker)}
                  </div>
                  
                  <div className="mb-3 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <SpeakerWaveIcon className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-sm text-gray-600">
                      Test your speakers or headphones
                    </p>
                  </div>
                  
                  <button
                    onClick={testSpeaker}
                    disabled={testingStates.speaker === 'testing'}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {testingStates.speaker === 'testing' ? 'Playing...' : 'Test Speakers'}
                  </button>
                </div>
              </div>
            </div>

            {/* Network Quality */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Connection Quality</h4>
              <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl">
                <SignalIcon className={`w-6 h-6 ${getNetworkQualityColor(networkQuality)}`} />
                <div>
                  <p className="font-medium">
                    Network: <span className={getNetworkQualityColor(networkQuality)}>
                      {networkQuality === 'checking' ? 'Checking...' : networkQuality.charAt(0).toUpperCase() + networkQuality.slice(1)}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600">
                    {networkQuality === 'excellent' && 'Perfect for high-quality video calls'}
                    {networkQuality === 'good' && 'Good for video and voice calls'}
                    {networkQuality === 'poor' && 'May experience quality issues'}
                    {networkQuality === 'checking' && 'Testing connection speed...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Ready Status */}
            {allChecksComplete && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircleIcon className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-900">All systems ready!</p>
                    <p className="text-sm text-green-700">Your device is set up for a great call experience.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              
              <button
                onClick={onProceed}
                disabled={!allChecksComplete}
                className={`flex-1 px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                  allChecksComplete
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {allChecksComplete ? (
                  <>
                    Start Call
                    <ArrowRightIcon className="w-5 h-5" />
                  </>
                ) : (
                  'Complete Setup First'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CallPreparationSetup;