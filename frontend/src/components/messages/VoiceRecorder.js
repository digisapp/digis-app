import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MicrophoneIcon,
  StopIcon,
  XMarkIcon,
  PauseIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const VoiceRecorder = ({ onRecorded, onCancel, maxDuration = 300 }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [waveformData, setWaveformData] = useState([]);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  
  useEffect(() => {
    startRecording();
    return () => {
      stopRecording();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup audio context for visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      // Start visualization
      visualize();
      
      // Setup media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      
      // Start duration counter
      intervalRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= maxDuration) {
            stopRecording();
            toast.error(`Maximum recording duration (${maxDuration}s) reached`);
          }
          return newDuration;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Unable to access microphone');
      onCancel();
    }
  };
  
  const visualize = () => {
    if (!analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Convert to waveform data (simplified visualization)
      const waveform = [];
      const sliceWidth = Math.ceil(bufferLength / 20);
      
      for (let i = 0; i < 20; i++) {
        const start = i * sliceWidth;
        const end = start + sliceWidth;
        const slice = dataArray.slice(start, end);
        const average = slice.reduce((a, b) => a + b, 0) / slice.length;
        waveform.push((average / 255) * 100);
      }
      
      setWaveformData(waveform);
    };
    
    draw();
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };
  
  const handleSend = () => {
    stopRecording();
    
    // Wait for blob to be created
    setTimeout(() => {
      if (chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecorded(blob, duration);
      } else {
        toast.error('No audio recorded');
        onCancel();
      }
    }, 100);
  };
  
  const handleCancel = () => {
    stopRecording();
    onCancel();
  };
  
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Resume duration counter
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      
      // Pause duration counter
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  };
  
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"
    >
      {/* Recording indicator */}
      <div className="relative">
        <div className={`w-4 h-4 bg-red-500 rounded-full ${!isPaused ? 'animate-pulse' : ''}`} />
        {!isPaused && (
          <div className="absolute inset-0 w-4 h-4 bg-red-500 rounded-full animate-ping" />
        )}
      </div>
      
      {/* Waveform visualization */}
      <div className="flex-1 flex items-center gap-0.5 h-8">
        {waveformData.map((height, index) => (
          <motion.div
            key={index}
            className="flex-1 bg-red-500 rounded-full"
            animate={{ height: `${Math.max(10, height)}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          />
        ))}
        {waveformData.length === 0 && (
          // Default waveform when no data
          Array.from({ length: 20 }).map((_, index) => (
            <div
              key={index}
              className="flex-1 h-2 bg-red-300 rounded-full"
            />
          ))
        )}
      </div>
      
      {/* Duration */}
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[50px]">
        {formatDuration(duration)}
      </span>
      
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={togglePause}
          className="p-2 hover:bg-red-100 dark:hover:bg-red-800/30 rounded-lg transition-colors"
          title={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? (
            <PlayIcon className="w-5 h-5 text-red-600" />
          ) : (
            <PauseIcon className="w-5 h-5 text-red-600" />
          )}
        </button>
        
        <button
          onClick={handleCancel}
          className="p-2 hover:bg-red-100 dark:hover:bg-red-800/30 rounded-lg transition-colors"
          title="Cancel"
        >
          <XMarkIcon className="w-5 h-5 text-red-600" />
        </button>
        
        <button
          onClick={handleSend}
          className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          title="Send"
          disabled={duration < 1}
        >
          <PaperAirplaneIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
};

export default VoiceRecorder;