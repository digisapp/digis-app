import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon,
  PhotoIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  PaperClipIcon,
  MapPinIcon,
  FaceSmileIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  CheckCircleIcon,
  LanguageIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';
import Card from './ui/Card';
import Button from './ui/Button';
import { useAgoraChat } from '../hooks/useAgoraChat';
import toast from 'react-hot-toast';

const AgoraChatEnhanced = ({ 
  conversationId, 
  conversationType = 'singleChat',
  user,
  className = '' 
}) => {
  const {
    isConnected,
    messages,
    typingUsers,
    presence,
    sendTextMessage,
    sendImageMessage,
    sendAudioMessage,
    sendVideoMessage,
    sendFileMessage,
    sendLocationMessage,
    sendCustomMessage,
    startTyping,
    stopTyping,
    recallMessage,
    deleteMessage,
    markAsRead,
    translateMessage,
    getConversationMessages,
    getPresenceStatus,
    isUserTyping
  } = useAgoraChat();

  const [inputMessage, setInputMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [translatedMessages, setTranslatedMessages] = useState(new Map());
  
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Get messages for this conversation
  const conversationMessages = getConversationMessages(conversationId);
  const recipientPresence = getPresenceStatus(conversationId);
  const recipientTyping = isUserTyping(conversationId);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages]);

  // Mark messages as read
  useEffect(() => {
    conversationMessages.forEach(msg => {
      if (msg.from !== user?.uid && !msg.isRead) {
        markAsRead(msg);
      }
    });
  }, [conversationMessages, user, markAsRead]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    await sendTextMessage(conversationId, inputMessage, conversationType);
    setInputMessage('');
    stopTyping(conversationId);
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    
    // Handle typing indicator
    if (e.target.value) {
      startTyping(conversationId);
    } else {
      stopTyping(conversationId);
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Show progress toast
    const toastId = toast.loading('Uploading image...');
    
    await sendImageMessage(conversationId, file, conversationType, {
      onProgress: (progress) => {
        toast.loading(`Uploading... ${Math.round(progress)}%`, { id: toastId });
      },
      onComplete: () => {
        // toast.success('Image sent!', { id: toastId });
      },
      onError: () => {
        toast.error('Failed to send image', { id: toastId });
      }
    });
    
    setShowAttachments(false);
  };

  const handleVideoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Get video duration
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = async () => {
      const duration = Math.floor(video.duration);
      
      const toastId = toast.loading('Uploading video...');
      
      await sendVideoMessage(conversationId, file, duration, conversationType, {
        onProgress: (progress) => {
          toast.loading(`Uploading... ${Math.round(progress)}%`, { id: toastId });
        },
        onComplete: () => {
          // toast.success('Video sent!', { id: toastId });
        }
      });
    };
    
    setShowAttachments(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const toastId = toast.loading('Uploading file...');
    
    await sendFileMessage(conversationId, file, conversationType, {
      onProgress: (progress) => {
        toast.loading(`Uploading... ${Math.round(progress)}%`, { id: toastId });
      },
      onComplete: () => {
        // toast.success('File sent!', { id: toastId });
      }
    });
    
    setShowAttachments(false);
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
        
        await sendAudioMessage(
          conversationId, 
          audioFile, 
          recordingDuration, 
          conversationType
        );
        
        setRecordingDuration(0);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      // Start duration counter
      const startTime = Date.now();
      const interval = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 100);
      
      // Store interval to clear later
      mediaRecorderRef.current.durationInterval = interval;
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to access microphone');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(mediaRecorderRef.current.durationInterval);
      setIsRecording(false);
    }
  };

  const sendLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported');
      return;
    }
    
    const toastId = toast.loading('Getting location...');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Get address from coordinates (you'd use a geocoding service)
        const address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        
        await sendLocationMessage(
          conversationId,
          latitude,
          longitude,
          address,
          conversationType
        );
        
        // toast.success('Location sent!', { id: toastId });
        setShowAttachments(false);
      },
      (error) => {
        toast.error('Failed to get location', { id: toastId });
      }
    );
  };

  const sendReaction = async (emoji) => {
    await sendCustomMessage(
      conversationId,
      'reaction',
      { emoji, timestamp: Date.now() },
      conversationType
    );
  };

  const handleRecallMessage = async (message) => {
    const success = await recallMessage(message.id);
    if (success) {
      setSelectedMessage(null);
    }
  };

  const handleDeleteMessage = async (message) => {
    const success = await deleteMessage(message.id);
    if (success) {
      setSelectedMessage(null);
    }
  };

  const handleTranslateMessage = async (message, targetLang = 'es') => {
    const translation = await translateMessage(message, [targetLang]);
    if (translation) {
      setTranslatedMessages(prev => {
        const newMap = new Map(prev);
        newMap.set(message.id, translation[0]);
        return newMap;
      });
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const MessageBubble = ({ message, isOwn }) => {
    const translation = translatedMessages.get(message.id);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div
          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
            isOwn 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
          }`}
          onClick={() => setSelectedMessage(message)}
        >
          {/* Message content based on type */}
          {message.type === 'txt' && (
            <p className="whitespace-pre-wrap break-words">{message.msg}</p>
          )}
          
          {message.type === 'img' && (
            <img 
              src={message.url} 
              alt="Shared image" 
              className="rounded-lg max-w-full cursor-pointer"
              onClick={() => window.open(message.url, '_blank')}
            />
          )}
          
          {message.type === 'audio' && (
            <div className="flex items-center gap-3">
              <button className="p-2 bg-white/20 rounded-full">
                <MicrophoneIcon className="w-5 h-5" />
              </button>
              <span className="text-sm">{formatDuration(message.length)}</span>
              <audio src={message.url} controls className="hidden" />
            </div>
          )}
          
          {message.type === 'video' && (
            <video 
              src={message.url} 
              controls 
              className="rounded-lg max-w-full"
              poster={message.thumb}
            />
          )}
          
          {message.type === 'file' && (
            <a 
              href={message.url}
              download={message.filename}
              className="flex items-center gap-2 hover:underline"
            >
              <PaperClipIcon className="w-5 h-5" />
              <span className="text-sm">{message.filename}</span>
            </a>
          )}
          
          {message.type === 'loc' && (
            <div 
              className="cursor-pointer"
              onClick={() => window.open(`https://maps.google.com/?q=${message.lat},${message.lng}`, '_blank')}
            >
              <div className="flex items-center gap-2 mb-1">
                <MapPinIcon className="w-5 h-5" />
                <span className="font-medium">Location</span>
              </div>
              <p className="text-sm opacity-90">{message.addr}</p>
            </div>
          )}
          
          {message.type === 'custom' && message.customEvent === 'reaction' && (
            <div className="text-3xl">{message.customExts.emoji}</div>
          )}
          
          {/* Translation */}
          {translation && (
            <div className="mt-2 pt-2 border-t border-white/20">
              <p className="text-sm italic">{translation.text}</p>
              <p className="text-xs opacity-70 mt-1">
                Translated to {translation.targetLanguage}
              </p>
            </div>
          )}
          
          {/* Message info */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs opacity-70">{formatTime(message.time)}</span>
            
            {/* Status indicators for own messages */}
            {isOwn && (
              <>
                {message.isDelivered && (
                  <CheckIcon className="w-3 h-3 opacity-70" />
                )}
                {message.isRead && (
                  <CheckCircleIcon className="w-3 h-3 text-blue-300" />
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <Card className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full" />
              {recipientPresence.status === 'online' && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white dark:ring-gray-900" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {conversationId}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {recipientTyping ? 'Typing...' : recipientPresence.description || recipientPresence.status}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<SparklesIcon className="w-5 h-5" />}
            >
              Features
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {conversationMessages.map((message) => (
          <MessageBubble 
            key={message.id} 
            message={message} 
            isOwn={message.from === user?.uid}
          />
        ))}
        
        {/* Typing indicator */}
        {recipientTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-4"
          >
            <div className="flex gap-1">
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                className="w-2 h-2 bg-gray-400 rounded-full"
              />
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                className="w-2 h-2 bg-gray-400 rounded-full"
              />
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                className="w-2 h-2 bg-gray-400 rounded-full"
              />
            </div>
            <span className="text-sm">{conversationId} is typing</span>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {/* Recording indicator */}
        {isRecording && (
          <div className="mb-3 flex items-center justify-between bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-2">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-600 dark:text-red-400 font-medium">
                Recording... {formatDuration(recordingDuration)}
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={stopAudioRecording}
            >
              Stop & Send
            </Button>
          </div>
        )}
        
        <div className="flex items-end gap-2">
          {/* Attachments button */}
          <div className="relative">
            <button
              onClick={() => setShowAttachments(!showAttachments)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <PaperClipIcon className="w-5 h-5" />
            </button>
            
            <AnimatePresence>
              {showAttachments && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 flex flex-col gap-1"
                >
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                  >
                    <PhotoIcon className="w-5 h-5" />
                    <span className="text-sm">Image</span>
                  </button>
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                  >
                    <VideoCameraIcon className="w-5 h-5" />
                    <span className="text-sm">Video</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                  >
                    <PaperClipIcon className="w-5 h-5" />
                    <span className="text-sm">File</span>
                  </button>
                  <button
                    onClick={sendLocation}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                  >
                    <MapPinIcon className="w-5 h-5" />
                    <span className="text-sm">Location</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Audio recording */}
          <button
            onClick={isRecording ? stopAudioRecording : startAudioRecording}
            className={`p-2 ${
              isRecording 
                ? 'text-red-500 hover:text-red-600' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <MicrophoneIcon className="w-5 h-5" />
          </button>

          {/* Message input */}
          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isRecording}
          />

          {/* Send button */}
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isRecording}
            className="p-2 bg-purple-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoSelect}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Message options modal */}
      <AnimatePresence>
        {selectedMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedMessage(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 max-w-sm w-full"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Message Options
              </h3>
              
              <div className="space-y-2">
                {/* Reactions */}
                <div className="flex gap-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  {['❤️', '👍', '😂', '😮', '😢', '🙏'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        sendReaction(emoji);
                        setSelectedMessage(null);
                      }}
                      className="text-2xl hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                
                {/* Actions */}
                <button
                  onClick={() => handleTranslateMessage(selectedMessage)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <LanguageIcon className="w-5 h-5" />
                  <span>Translate</span>
                </button>
                
                {selectedMessage.from === user?.uid && (
                  <>
                    <button
                      onClick={() => handleRecallMessage(selectedMessage)}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <ArrowUturnLeftIcon className="w-5 h-5" />
                      <span>Recall Message</span>
                    </button>
                    
                    <button
                      onClick={() => handleDeleteMessage(selectedMessage)}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-red-600"
                    >
                      <TrashIcon className="w-5 h-5" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
              
              <button
                onClick={() => setSelectedMessage(null)}
                className="mt-4 w-full py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

export default AgoraChatEnhanced;