import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon,
  PaperClipIcon,
  PhotoIcon,
  FaceSmileIcon,
  MicrophoneIcon,
  StopIcon,
  XMarkIcon,
  ChevronDownIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftRightIcon,
  FilmIcon,
  SparklesIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';
import VoiceRecorder from './VoiceRecorder';
import EmojiPicker from './EmojiPicker';
import PPVPricingModal from './PPVPricingModal';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';

const MessageInput = ({
  onSendMessage,
  onScheduleMessage,
  onSendPPVMessage,
  isCreator,
  messageRates,
  showRates,
  onToggleRates,
  websocket,
  conversationId,
  userId,
  replyTo,
  onCancelReply,
  disabled = false
}) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showPPVModal, setShowPPVModal] = useState(false);
  const [pendingPPVFile, setPendingPPVFile] = useState(null);
  const [isPPVMode, setIsPPVMode] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  
  const inputRef = useRef();
  const fileInputRef = useRef();
  const imageInputRef = useRef();
  const typingTimeoutRef = useRef();
  
  // Drag and drop configuration
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      toast.error('Some files were rejected. Please check file type and size.');
    }
    
    // If creator and PPV mode is on, open pricing modal
    if (isCreator && isPPVMode && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const fileType = file.type.startsWith('image/') ? 'image' : 
                      file.type.startsWith('video/') ? 'video' :
                      file.type.startsWith('audio/') ? 'audio' : 'file';
      setPendingPPVFile({ file, fileType });
      setShowPPVModal(true);
      return;
    }
    
    const newAttachments = acceptedFiles.map(file => ({
      id: Date.now() + Math.random(),
      file,
      type: file.type.startsWith('image/') ? 'image' : 'file',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      isPPV: false
    }));
    
    setAttachments(prev => [...prev, ...newAttachments]);
  }, [isCreator, isPPVMode]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    maxSize: 50 * 1024 * 1024, // 50MB
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDropAccepted: () => setIsDragging(false),
    onDropRejected: () => setIsDragging(false)
  });
  
  // Handle typing indicator
  const handleTyping = () => {
    if (!websocket || !conversationId) return;
    
    // Send typing start
    if (websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'typing_start',
        conversationId,
        userId
      }));
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
          type: 'typing_stop',
          conversationId,
          userId
        }));
      }
    }, 2000);
  };
  
  const handleSend = async () => {
    if ((!message.trim() && attachments.length === 0) || sendingMessage) return;
    
    setSendingMessage(true);
    
    try {
      // Check if we have PPV attachments
      const ppvAttachments = attachments.filter(a => a.isPPV);
      const regularAttachments = attachments.filter(a => !a.isPPV);
      
      // Send PPV attachments
      if (ppvAttachments.length > 0) {
        for (const attachment of ppvAttachments) {
          await sendPPVMessage(attachment);
        }
      }
      
      // Send regular attachments
      if (regularAttachments.length > 0) {
        for (const attachment of regularAttachments) {
          await onSendMessage(
            attachment.type === 'image' ? 'Sent an image' : `Sent ${attachment.file.name}`,
            attachment.type,
            attachment.file,
            replyTo?.id
          );
        }
      }
      
      // Send text message if present and no PPV attachments
      if (message.trim() && ppvAttachments.length === 0) {
        await onSendMessage(message.trim(), 'text', null, replyTo?.id);
        setMessage('');
      }
      
      // Clear attachments
      setAttachments([]);
      
      // Clear reply
      onCancelReply?.();
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };
  
  const handleVoiceRecorded = async (audioBlob, duration) => {
    try {
      setSendingMessage(true);
      const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
      await onSendMessage('Voice message', 'voice', audioFile, replyTo?.id);
      toast.success('Voice message sent');
    } catch (error) {
      console.error('Error sending voice message:', error);
      toast.error('Failed to send voice message');
    } finally {
      setSendingMessage(false);
      setIsRecording(false);
    }
  };
  
  const removeAttachment = (id) => {
    setAttachments(prev => {
      const attachment = prev.find(a => a.id === id);
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter(a => a.id !== id);
    });
  };
  
  // Handle PPV pricing confirmation
  const handlePPVConfirm = (ppvData) => {
    const attachment = {
      id: Date.now() + Math.random(),
      file: ppvData.file,
      type: ppvData.fileType,
      preview: ppvData.file.type.startsWith('image/') ? URL.createObjectURL(ppvData.file) : null,
      isPPV: true,
      price: ppvData.price,
      description: ppvData.description,
      isExclusive: ppvData.isExclusive,
      expiresIn: ppvData.expiresIn
    };
    
    setAttachments(prev => [...prev, attachment]);
    setPendingPPVFile(null);
    setIsPPVMode(false); // Reset PPV mode after adding
    
    toast.success(`PPV content added: ${ppvData.price} tokens`);
  };
  
  // Send PPV message
  const sendPPVMessage = async (attachment) => {
    if (!onSendPPVMessage) {
      toast.error('PPV messaging not configured');
      return;
    }
    
    try {
      setSendingMessage(true);
      await onSendPPVMessage({
        file: attachment.file,
        fileType: attachment.type,
        price: attachment.price,
        description: attachment.description,
        isExclusive: attachment.isExclusive,
        expiresIn: attachment.expiresIn,
        message: message.trim()
      });
      
      setAttachments([]);
      setMessage('');
      toast.success('PPV message sent!');
    } catch (error) {
      console.error('Error sending PPV message:', error);
      toast.error('Failed to send PPV message');
    } finally {
      setSendingMessage(false);
    }
  };
  
  const quickEmojis = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '💎', '⭐'];
  
  return (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
      {/* Creator's Message Rates Display */}
      {isCreator && (
        <AnimatePresence>
          {showRates && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-2 overflow-hidden"
            >
              <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <button
                  onClick={onToggleRates}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                >
                  <CurrencyDollarIcon className="w-4 h-4" />
                  <span>Your Message Rates</span>
                  <ChevronDownIcon className="w-3 h-3" />
                </button>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <ChatBubbleLeftRightIcon className="w-3 h-3" />
                    <span>{messageRates?.text || 1} tokens</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <PhotoIcon className="w-3 h-3" />
                    <span>{messageRates?.image || 2} tokens</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MicrophoneIcon className="w-3 h-3" />
                    <span>{messageRates?.audio || 3} tokens</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FilmIcon className="w-3 h-3" />
                    <span>{messageRates?.video || 5} tokens</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
      
      {/* Reply indicator */}
      {replyTo && (
        <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Replying to: {replyTo.content.substring(0, 50)}...
            </span>
          </div>
          <button onClick={onCancelReply} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
            <XMarkIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}
      
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map(attachment => (
            <div key={attachment.id} className="relative group">
              {attachment.isPPV && (
                <div className="absolute top-1 left-1 z-10 px-2 py-1 bg-purple-600 text-white text-xs rounded-full flex items-center gap-1">
                  <LockClosedIcon className="w-3 h-3" />
                  {attachment.price} tokens
                </div>
              )}
              {attachment.type === 'image' ? (
                <img 
                  src={attachment.preview} 
                  alt="Attachment"
                  className={`w-20 h-20 object-cover rounded-lg ${attachment.isPPV ? 'ring-2 ring-purple-500' : ''}`}
                />
              ) : (
                <div className={`w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center ${attachment.isPPV ? 'ring-2 ring-purple-500' : ''}`}>
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* PPV Mode Indicator */}
      {isCreator && isPPVMode && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 p-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                <SparklesIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  PPV Mode Active
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Next media upload will require payment to view
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPPVMode(false)}
              className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
            >
              Deactivate
            </button>
          </div>
        </motion.div>
      )}
      
      {/* Main input area with drag & drop */}
      <div {...getRootProps()} className="relative">
        <input {...getInputProps()} />
        
        {/* Drag overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-purple-500 bg-opacity-10 border-2 border-dashed border-purple-500 rounded-lg flex items-center justify-center z-10"
            >
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-purple-600 font-medium">Drop files here</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex items-end gap-2">
          {/* Voice recording and actions */}
          <>
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onDrop([file], []);
                    e.target.value = '';
                  }
                }}
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onDrop([file], []);
                    e.target.value = '';
                  }
                }}
              />
              
              {/* Action buttons */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={disabled || sendingMessage}
              >
                <PaperClipIcon className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => imageInputRef.current?.click()}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={disabled || sendingMessage}
              >
                <PhotoIcon className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setShowVoiceRecorder(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={disabled || sendingMessage}
              >
                <MicrophoneIcon className="w-5 h-5" />
              </button>
              
              {/* PPV Toggle Button for Creators */}
              {isCreator && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsPPVMode(!isPPVMode)}
                  className={`p-2 rounded-lg transition-all ${
                    isPPVMode 
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
                      : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  disabled={disabled || sendingMessage}
                  title={isPPVMode ? 'PPV Mode Active' : 'Enable PPV Mode'}
                >
                  <CurrencyDollarIcon className="w-5 h-5" />
                </motion.button>
              )}
              
              {/* Message input */}
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={sendingMessage ? "Sending..." : "Type a message..."}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={1}
                  disabled={disabled || sendingMessage}
                  style={{ minHeight: '40px', maxHeight: '120px' }}
                />
                
                {/* Quick emojis */}
                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                  {quickEmojis.slice(0, 3).map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setMessage(prev => prev + emoji)}
                      className="text-lg hover:scale-110 transition-transform"
                      disabled={disabled || sendingMessage}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Emoji picker button */}
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={disabled || sendingMessage}
              >
                <FaceSmileIcon className="w-5 h-5" />
              </button>
              
              {/* Send button */}
              <button
                onClick={handleSend}
                className={`p-2 rounded-lg transition-all ${
                  sendingMessage || (!message.trim() && attachments.length === 0)
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
                }`}
                disabled={disabled || sendingMessage || (!message.trim() && attachments.length === 0)}
              >
                {sendingMessage ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PaperAirplaneIcon className="w-5 h-5" />
                )}
              </button>
            </>
        </div>
        
        {/* Emoji picker */}
        <AnimatePresence>
          {showEmojiPicker && (
            <EmojiPicker
              onSelect={(emoji) => {
                setMessage(prev => prev + emoji);
                setShowEmojiPicker(false);
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}
        </AnimatePresence>
      </div>
      
      {/* PPV Pricing Modal */}
      {showPPVModal && pendingPPVFile && (
        <PPVPricingModal
          isOpen={showPPVModal}
          onClose={() => {
            setShowPPVModal(false);
            setPendingPPVFile(null);
          }}
          onConfirm={handlePPVConfirm}
          file={pendingPPVFile.file}
          fileType={pendingPPVFile.fileType}
        />
      )}
      
      {/* Voice Recorder Modal */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onRecorded={handleVoiceRecorded}
          onCancel={() => setShowVoiceRecorder(false)}
        />
      )}
    </div>
  );
};

export default MessageInput;