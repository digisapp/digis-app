import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  PaperAirplaneIcon,
  PhotoIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  DocumentIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const SimpleMobileMessageInput = ({
  onSendMessage,
  isCreator,
  disabled = false
}) => {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const imageInputRef = useRef();
  const videoInputRef = useRef();
  const fileInputRef = useRef();
  
  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message.trim(), 'text');
    setMessage('');
  };
  
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendMessage('Sent an image', 'image', file);
      toast.success('Image sent');
      e.target.value = '';
    }
  };
  
  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendMessage('Sent a video', 'video', file);
      toast.success('Video sent');
      e.target.value = '';
    }
  };
  
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendMessage('Sent a file', 'file', file);
      toast.success('File sent');
      e.target.value = '';
    }
  };
  
  const startRecording = () => {
    setIsRecording(true);
    // Start recording logic here
    toast.info('Recording started...');
    
    // Simulate recording for 3 seconds
    setTimeout(() => {
      setIsRecording(false);
      toast.success('Voice message sent');
      // Create a dummy audio file for now
      const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
      const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
      onSendMessage('Voice message', 'voice', audioFile);
    }, 3000);
  };
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700 z-50">
      {/* Message Input Row */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={disabled}
        />
        
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className={`p-2.5 rounded-full transition-all ${
            message.trim()
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
          }`}
        >
          <PaperAirplaneIcon className="w-5 h-5" />
        </motion.button>
      </div>
      
      {/* Action Icons Row */}
      <div className="flex items-center justify-around px-3 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
        {/* Image Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => imageInputRef.current?.click()}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          disabled={disabled}
        >
          <PhotoIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <span className="text-xs text-gray-600 dark:text-gray-400">Photo</span>
        </motion.button>
        
        {/* Video Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => videoInputRef.current?.click()}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          disabled={disabled}
        >
          <VideoCameraIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          <span className="text-xs text-gray-600 dark:text-gray-400">Video</span>
        </motion.button>
        
        {/* Voice Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={startRecording}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
            isRecording 
              ? 'bg-red-100 dark:bg-red-900/30' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          disabled={disabled || isRecording}
        >
          <MicrophoneIcon className={`w-6 h-6 ${
            isRecording 
              ? 'text-red-600 dark:text-red-400 animate-pulse' 
              : 'text-green-600 dark:text-green-400'
          }`} />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {isRecording ? 'Recording...' : 'Voice'}
          </span>
        </motion.button>
        
        {/* File Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          disabled={disabled}
        >
          <DocumentIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          <span className="text-xs text-gray-600 dark:text-gray-400">File</span>
        </motion.button>
        
        {/* Schedule Button (Creator only) */}
        {isCreator && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => toast.info('Schedule feature coming soon!')}
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            disabled={disabled}
          >
            <CalendarIcon className="w-6 h-6 text-pink-600 dark:text-pink-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Schedule</span>
          </motion.button>
        )}
      </div>
      
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideoSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
      
      {/* Add safe area padding for iOS */}
      <div className="pb-safe" />
    </div>
  );
};

export default SimpleMobileMessageInput;