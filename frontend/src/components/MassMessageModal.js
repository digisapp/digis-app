import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  PaperAirplaneIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PhotoIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const MassMessageModal = ({ isOpen, onClose, totalFans = 0, filterType = 'all' }) => {
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [includeImage, setIncludeImage] = useState(false);
  const [attachedContent, setAttachedContent] = useState(null);
  const [contentPrice, setContentPrice] = useState('');
  const [sending, setSending] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [recurringOption, setRecurringOption] = useState('once'); // once, daily, 3days, weekly
  const [uploadedImage, setUploadedImage] = useState(null);
  const maxChars = 500;

  const recurringOptions = [
    { value: 'once', label: 'Send Once', icon: PaperAirplaneIcon },
    { value: 'daily', label: 'Daily', icon: CalendarDaysIcon },
    { value: '3days', label: 'Every 3 Days', icon: ClockIcon },
    { value: 'weekly', label: 'Weekly', icon: ArrowPathIcon }
  ];

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (message.length > maxChars) {
      toast.error(`Message must be under ${maxChars} characters`);
      return;
    }

    if (attachedContent && (!contentPrice || isNaN(contentPrice) || contentPrice < 1)) {
      toast.error('Please set a valid token price for the content (minimum 1 token)');
      return;
    }

    setSending(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const recurringText = recurringOption !== 'once' ? ` (${recurringOptions.find(o => o.value === recurringOption).label})` : '';
      // toast.success(`Message sent to ${totalFans} fans${recurringText}!`);
      
      if (recurringOption !== 'once') {
        // toast.success(`Recurring messages scheduled ${recurringOptions.find(o => o.value === recurringOption).label.toLowerCase()}`, {
        //   duration: 5000
        // });
      }
      
      onClose();
      resetForm();
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setMessage('');
    setSubject('');
    setCharCount(0);
    setAttachedContent(null);
    setContentPrice('');
    setRecurringOption('once');
    setUploadedImage(null);
  };

  const handleMessageChange = (e) => {
    const text = e.target.value;
    if (text.length <= maxChars) {
      setMessage(text);
      setCharCount(text.length);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('Image must be less than 10MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage({
          name: file.name,
          url: reader.result,
          type: file.type
        });
      };
      reader.readAsDataURL(file);
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

  // Preset message templates
  const messageTemplates = [
    { 
      label: 'New Content Alert', 
      subject: '🎉 New Content Available!',
      message: "Hey loves! I just posted exclusive new content that I think you'll really enjoy. Check it out and let me know what you think! 💜"
    },
    { 
      label: 'Special Offer', 
      subject: '⭐ Special Offer Just for You!',
      message: "Hi beautiful souls! For the next 24 hours, I'm offering 20% off all video calls. Don't miss this chance to connect! Use code: SPECIAL20 ✨"
    },
    { 
      label: 'Thank You', 
      subject: '💖 Thank You So Much!',
      message: "I just wanted to take a moment to thank each and every one of you for your amazing support. You make this journey so special! 🙏"
    },
    { 
      label: 'Going Live', 
      subject: '🔴 Going Live Soon!',
      message: "Get ready! I'm going live in 30 minutes for an exclusive stream. Can't wait to see you all there! Set your notifications on 🔔"
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
                    <UserGroupIcon className="w-8 h-8" />
                    <div>
                      <h2 className="text-2xl font-bold">
                        {filterType === 'vip' ? 'Message VIPs Only' : 
                         filterType === 'top_spenders' ? 'Message Top Spenders' : 
                         'Message All Fans'}
                      </h2>
                      <p className="text-purple-100">
                        Send a message to {
                          filterType === 'vip' ? `${Math.floor(totalFans * 0.15)} VIP members` : 
                          filterType === 'top_spenders' ? `${Math.floor(totalFans * 0.2)} top spenders` : 
                          `${totalFans} followers`
                        }
                      </p>
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
                {/* Target Audience Indicator */}
                {filterType !== 'all' && (
                  <div className={`p-4 rounded-lg flex items-center gap-3 ${
                    filterType === 'vip' ? 'bg-purple-50 border border-purple-200' : 
                    'bg-green-50 border border-green-200'
                  }`}>
                    <div className={`p-2 rounded-full ${
                      filterType === 'vip' ? 'bg-purple-100' : 'bg-green-100'
                    }`}>
                      {filterType === 'vip' ? (
                        <span className="text-2xl">👑</span>
                      ) : (
                        <span className="text-2xl">💰</span>
                      )}
                    </div>
                    <div>
                      <p className={`font-medium ${
                        filterType === 'vip' ? 'text-purple-900' : 'text-green-900'
                      }`}>
                        {filterType === 'vip' ? 'VIP Members Only' : 'Top Spenders Only'}
                      </p>
                      <p className={`text-sm ${
                        filterType === 'vip' ? 'text-purple-700' : 'text-green-700'
                      }`}>
                        {filterType === 'vip' 
                          ? 'This message will only be sent to your VIP tier members' 
                          : 'This message will only be sent to your top 20% highest spending fans'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Recurring Options */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Message Frequency
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {recurringOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          onClick={() => setRecurringOption(option.value)}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            recurringOption === option.value
                              ? 'border-purple-600 bg-purple-50 text-purple-700'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600'
                          }`}
                        >
                          <Icon className="w-5 h-5 mx-auto mb-1" />
                          <p className="text-xs font-medium">{option.label}</p>
                        </button>
                      );
                    })}
                  </div>
                  {recurringOption !== 'once' && (
                    <p className="text-xs text-gray-500 mt-2">
                      This message will be sent automatically {recurringOptions.find(o => o.value === recurringOption).label.toLowerCase()} to all fans
                    </p>
                  )}
                </div>

                {/* Templates */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Quick Templates
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {messageTemplates.map((template, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSubject(template.subject);
                          setMessage(template.message);
                          setCharCount(template.message.length);
                        }}
                        className="p-3 bg-purple-50 hover:bg-purple-100 rounded-lg text-left transition-colors"
                      >
                        <p className="font-medium text-purple-700 text-sm">{template.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject Line */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Subject (Optional)
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Add a catchy subject line..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Message */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Message
                    </label>
                    <span className={`text-sm ${charCount > maxChars ? 'text-red-500' : 'text-gray-500'}`}>
                      {charCount}/{maxChars}
                    </span>
                  </div>
                  <textarea
                    value={message}
                    onChange={handleMessageChange}
                    placeholder="Type your message here..."
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                  
                  {/* Attachment Options */}
                  <div className="flex items-center gap-4 mt-3">
                    {/* Add Image Button */}
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer">
                      <PhotoIcon className="w-4 h-4" />
                      Add Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>

                    {/* Upload Paid Content Button */}
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors cursor-pointer">
                      <CurrencyDollarIcon className="w-4 h-4" />
                      Upload Paid Content
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleContentUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Uploaded Image Preview */}
                  {uploadedImage && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PhotoIcon className="w-5 h-5 text-gray-400" />
                          <span className="text-sm text-gray-600">{uploadedImage.name}</span>
                        </div>
                        <button
                          onClick={() => setUploadedImage(null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Paid Content Settings */}
                {attachedContent && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-purple-700">Paid Content Attached</p>
                        <p className="text-sm text-purple-600 mt-1">
                          {attachedContent.name} ({attachedContent.size})
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setAttachedContent(null);
                          setContentPrice('');
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-purple-700 mb-1 block">
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
                        <span className="text-sm text-purple-600">tokens per view</span>
                      </div>
                    </div>
                  </div>
                )}

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
                  onClick={handleSend}
                  disabled={!message.trim() || sending || charCount > maxChars}
                  className={`px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all ${
                    !message.trim() || sending || charCount > maxChars
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg transform hover:scale-105'
                  }`}
                >
                  {sending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="w-4 h-4" />
                      {recurringOption === 'once' ? `Send to ${totalFans} Fans` : `Schedule ${recurringOptions.find(o => o.value === recurringOption).label}`}
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

export default MassMessageModal;