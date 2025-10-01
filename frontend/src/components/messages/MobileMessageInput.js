import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon,
  PhotoIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  CalendarIcon,
  GiftIcon,
  CurrencyDollarIcon,
  PlusIcon,
  XMarkIcon,
  LockClosedIcon,
  FaceSmileIcon,
  DocumentIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import VoiceRecorder from './VoiceRecorder';
import EmojiPicker from './EmojiPicker';
import PPVPricingModal from './PPVPricingModal';
import toast from 'react-hot-toast';

const MobileMessageInput = ({
  onSendMessage,
  onScheduleMessage,
  onSendPPVMessage,
  isCreator,
  websocket,
  conversationId,
  userId,
  replyTo,
  onCancelReply,
  disabled = false,
  onRequestCall
}) => {
  const [message, setMessage] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showPPVModal, setShowPPVModal] = useState(false);
  const [pendingPPVFile, setPendingPPVFile] = useState(null);
  const [isPPVMode, setIsPPVMode] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  const inputRef = useRef();
  const fileInputRef = useRef();
  const imageInputRef = useRef();
  const typingTimeoutRef = useRef();
  
  // Handle typing indicator
  const handleTyping = () => {
    if (!websocket || !conversationId) return;
    
    if (websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'typing_start',
        conversationId,
        userId
      }));
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
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
      if (attachments.length > 0) {
        for (const attachment of attachments) {
          if (attachment.isPPV && onSendPPVMessage) {
            await onSendPPVMessage({
              file: attachment.file,
              fileType: attachment.type,
              price: attachment.price,
              description: attachment.description,
              message: message.trim()
            });
          } else {
            await onSendMessage(
              attachment.type === 'image' ? 'Sent an image' : `Sent ${attachment.file.name}`,
              attachment.type,
              attachment.file,
              replyTo?.id
            );
          }
        }
      }
      
      if (message.trim() && attachments.filter(a => a.isPPV).length === 0) {
        await onSendMessage(message.trim(), 'text', null, replyTo?.id);
        setMessage('');
      }
      
      setAttachments([]);
      onCancelReply?.();
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };
  
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isCreator && isPPVMode) {
        setPendingPPVFile({ file, fileType: 'image' });
        setShowPPVModal(true);
      } else {
        const attachment = {
          id: Date.now(),
          file,
          type: 'image',
          preview: URL.createObjectURL(file),
          isPPV: false
        };
        setAttachments(prev => [...prev, attachment]);
      }
      e.target.value = '';
    }
  };
  
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileType = file.type.startsWith('video/') ? 'video' : 'file';
      if (isCreator && isPPVMode) {
        setPendingPPVFile({ file, fileType });
        setShowPPVModal(true);
      } else {
        const attachment = {
          id: Date.now(),
          file,
          type: fileType,
          preview: null,
          isPPV: false
        };
        setAttachments(prev => [...prev, attachment]);
      }
      e.target.value = '';
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
      setShowVoiceRecorder(false);
    }
  };
  
  const handlePPVConfirm = (ppvData) => {
    const attachment = {
      id: Date.now(),
      file: ppvData.file,
      type: ppvData.fileType,
      preview: ppvData.file.type.startsWith('image/') ? URL.createObjectURL(ppvData.file) : null,
      isPPV: true,
      price: ppvData.price,
      description: ppvData.description
    };
    
    setAttachments(prev => [...prev, attachment]);
    setPendingPPVFile(null);
    setIsPPVMode(false);
    toast.success(`PPV content added: ${ppvData.price} tokens`);
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
  
  const actionButtons = [
    {
      icon: PhotoIcon,
      label: 'Photo',
      color: 'text-blue-600',
      onClick: () => imageInputRef.current?.click()
    },
    {
      icon: MicrophoneIcon,
      label: 'Voice',
      color: 'text-green-600',
      onClick: () => setShowVoiceRecorder(true)
    },
    {
      icon: VideoCameraIcon,
      label: 'Video Call',
      color: 'text-purple-600',
      onClick: () => onRequestCall?.('video'),
      show: isCreator
    },
    {
      icon: CalendarIcon,
      label: 'Schedule',
      color: 'text-orange-600',
      onClick: () => setShowScheduleModal(true),
      show: isCreator
    },
    {
      icon: GiftIcon,
      label: 'Gift',
      color: 'text-pink-600',
      onClick: () => toast.info('Gift feature coming soon!')
    },
    {
      icon: CurrencyDollarIcon,
      label: 'PPV',
      color: isPPVMode ? 'text-yellow-600' : 'text-gray-600',
      onClick: () => setIsPPVMode(!isPPVMode),
      show: isCreator,
      active: isPPVMode
    }
  ];
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 safe-bottom">
      {/* Reply indicator */}
      {replyTo && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                Replying to: {replyTo.content.substring(0, 50)}...
              </span>
            </div>
            <button onClick={onCancelReply} className="p-1">
              <XMarkIcon className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      )}
      
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2 overflow-x-auto">
            {attachments.map(attachment => (
              <div key={attachment.id} className="relative flex-shrink-0">
                {attachment.isPPV && (
                  <div className="absolute top-1 left-1 z-10 px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full flex items-center gap-1">
                    <LockClosedIcon className="w-3 h-3" />
                    {attachment.price}
                  </div>
                )}
                {attachment.type === 'image' ? (
                  <img 
                    src={attachment.preview} 
                    alt="Attachment"
                    className={`w-16 h-16 object-cover rounded-lg ${attachment.isPPV ? 'ring-2 ring-purple-500' : ''}`}
                  />
                ) : (
                  <div className={`w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center ${attachment.isPPV ? 'ring-2 ring-purple-500' : ''}`}>
                    <DocumentIcon className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* PPV Mode Indicator */}
      {isCreator && isPPVMode && (
        <div className="px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-purple-200 dark:border-purple-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CurrencyDollarIcon className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                PPV Mode Active
              </span>
            </div>
            <button
              onClick={() => setIsPPVMode(false)}
              className="text-xs text-purple-600 hover:text-purple-700"
            >
              Deactivate
            </button>
          </div>
        </div>
      )}
      
      {/* Message input area */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={sendingMessage ? "Sending..." : "Type a message..."}
            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            disabled={disabled || sendingMessage}
          />
          
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <FaceSmileIcon className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleSend}
            disabled={disabled || sendingMessage || (!message.trim() && attachments.length === 0)}
            className={`p-2.5 rounded-full transition-all ${
              sendingMessage || (!message.trim() && attachments.length === 0)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
            }`}
          >
            {sendingMessage ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <PaperAirplaneIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
      
      {/* Action buttons row */}
      <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-around py-2">
          {actionButtons.filter(btn => btn.show !== false).map((button, index) => (
            <button
              key={index}
              onClick={button.onClick}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                button.active 
                  ? 'bg-purple-100 dark:bg-purple-900/30' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <button.icon className={`w-5 h-5 ${button.active ? button.color : 'text-gray-600 dark:text-gray-400'}`} />
              <span className={`text-xs ${button.active ? button.color : 'text-gray-600 dark:text-gray-400'}`}>
                {button.label}
              </span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
      
      {/* Emoji picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <div className="absolute bottom-full left-0 right-0 mb-2">
            <EmojiPicker
              onSelect={(emoji) => {
                setMessage(prev => prev + emoji);
                setShowEmojiPicker(false);
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}
      </AnimatePresence>
      
      {/* PPV Modal */}
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
      
      {/* Voice Recorder */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onRecorded={handleVoiceRecorded}
          onCancel={() => setShowVoiceRecorder(false)}
        />
      )}
    </div>
  );
};

export default MobileMessageInput;