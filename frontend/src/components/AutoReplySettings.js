import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  PhotoIcon,
  CurrencyDollarIcon,
  TrashIcon,
  SparklesIcon,
  PlayIcon,
  PauseIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const AutoReplySettings = ({ isOpen, onClose, creatorId }) => {
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [attachedContent, setAttachedContent] = useState(null);
  const [contentPrice, setContentPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const maxChars = 500;

  // Load saved settings
  useEffect(() => {
    const savedSettings = localStorage.getItem(`autoReply_${creatorId}`);
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setAutoReplyEnabled(settings.enabled || false);
      setWelcomeMessage(settings.message || '');
      setAttachedContent(settings.content || null);
      setContentPrice(settings.price || '');
      setCharCount(settings.message?.length || 0);
    }
  }, [creatorId]);

  const handleMessageChange = (e) => {
    const text = e.target.value;
    if (text.length <= maxChars) {
      setWelcomeMessage(text);
      setCharCount(text.length);
    }
  };

  const handleContentUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast.error('Content must be less than 50MB');
        return;
      }
      
      setAttachedContent({
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        type: file.type.startsWith('image/') ? 'image' : 
              file.type.startsWith('video/') ? 'video' : 'file'
      });
    }
  };

  const handleSave = async () => {
    if (autoReplyEnabled && !welcomeMessage.trim()) {
      toast.error('Please enter a welcome message');
      return;
    }

    if (attachedContent && (!contentPrice || isNaN(contentPrice) || contentPrice < 1)) {
      toast.error('Please set a valid token price for the content (minimum 1 token)');
      return;
    }

    setSaving(true);
    
    try {
      // Save to localStorage (in production, this would be an API call)
      const settings = {
        enabled: autoReplyEnabled,
        message: welcomeMessage,
        content: attachedContent,
        price: contentPrice,
        updatedAt: new Date().toISOString()
      };
      
      localStorage.setItem(`autoReply_${creatorId}`, JSON.stringify(settings));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // toast.success(autoReplyEnabled ? 'Auto-reply enabled!' : 'Auto-reply settings saved');
      onClose();
    } catch (error) {
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Preset templates
  const templates = [
    {
      label: 'Warm Welcome',
      message: "Hey there! 💜 Welcome to my exclusive space! I'm so excited to connect with you. Feel free to message me anytime and let's create some amazing memories together!"
    },
    {
      label: 'Professional',
      message: "Welcome! Thank you for joining my community. I'm here to provide exclusive content and personalized interactions. Let me know how I can make your experience special!"
    },
    {
      label: 'Playful',
      message: "OMG hi!! 🎉 So happy you're here! Get ready for exclusive content, fun conversations, and special surprises just for you! Can't wait to get to know you better! ✨"
    },
    {
      label: 'Exclusive Content',
      message: "Welcome to my VIP circle! 🌟 As a special thank you for joining, I've attached an exclusive welcome gift below. Enjoy and let me know what you think!"
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ChatBubbleLeftRightIcon className="w-8 h-8" />
                    <div>
                      <h2 className="text-2xl font-bold">Auto-Reply Settings</h2>
                      <p className="text-purple-100">Welcome new fans automatically</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full ${autoReplyEnabled ? 'bg-green-500' : 'bg-gray-400'}`}>
                      {autoReplyEnabled ? (
                        <PlayIcon className="w-6 h-6 text-white" />
                      ) : (
                        <PauseIcon className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Auto-Reply Status</h3>
                      <p className="text-sm text-gray-600">
                        {autoReplyEnabled ? 'Sending welcome messages to new fans' : 'Auto-reply is currently disabled'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoReplyEnabled ? 'bg-purple-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoReplyEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Templates */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Quick Templates
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map((template, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setWelcomeMessage(template.message);
                          setCharCount(template.message.length);
                        }}
                        className="p-3 bg-purple-50 hover:bg-purple-100 rounded-lg text-left transition-colors"
                      >
                        <p className="font-medium text-purple-700 text-sm">{template.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Welcome Message */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Welcome Message
                    </label>
                    <span className={`text-sm ${charCount > maxChars ? 'text-red-500' : 'text-gray-500'}`}>
                      {charCount}/{maxChars}
                    </span>
                  </div>
                  <textarea
                    value={welcomeMessage}
                    onChange={handleMessageChange}
                    placeholder="Type your welcome message here..."
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This message will be sent automatically to fans when they message you for the first time
                  </p>
                </div>

                {/* Attach Paid Content */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Attach Welcome Gift (Optional)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    {attachedContent ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center gap-3">
                          <div className="p-3 bg-purple-100 rounded-lg">
                            {attachedContent.type === 'image' ? (
                              <PhotoIcon className="w-8 h-8 text-purple-600" />
                            ) : (
                              <PlayIcon className="w-8 h-8 text-purple-600" />
                            )}
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-gray-900">{attachedContent.name}</p>
                            <p className="text-sm text-gray-500">{attachedContent.size}</p>
                          </div>
                          <button
                            onClick={() => {
                              setAttachedContent(null);
                              setContentPrice('');
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                        
                        {/* Price Setting */}
                        <div className="bg-purple-50 rounded-lg p-4">
                          <label className="text-sm font-medium text-purple-700 mb-2 block">
                            Set Token Price
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={contentPrice}
                              onChange={(e) => setContentPrice(e.target.value)}
                              placeholder="10"
                              min="1"
                              className="px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-24"
                            />
                            <span className="text-sm text-purple-600">tokens to unlock</span>
                          </div>
                          <p className="text-xs text-purple-500 mt-1">
                            New fans will see this as a special welcome offer
                          </p>
                        </div>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={handleContentUpload}
                          className="hidden"
                        />
                        <div className="space-y-2">
                          <div className="p-3 bg-purple-100 rounded-full inline-block">
                            <CurrencyDollarIcon className="w-8 h-8 text-purple-600" />
                          </div>
                          <p className="text-gray-600">Click to upload paid content</p>
                          <p className="text-xs text-gray-500">Images or videos up to 50MB</p>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                  <SparklesIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-800">Pro Tip</p>
                    <p className="text-blue-700 mt-1">
                      A warm welcome message helps convert new fans into loyal supporters. Consider offering an exclusive welcome gift to make a great first impression!
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all ${
                    saving
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg transform hover:scale-105'
                  }`}
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-4 h-4" />
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AutoReplySettings;