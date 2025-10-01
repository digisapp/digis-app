import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  MegaphoneIcon,
  UserGroupIcon,
  ClockIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const BroadcastMessageModal = ({ isOpen, onClose, totalFans = 0 }) => {
  const [message, setMessage] = useState('');
  const [selectedAudience, setSelectedAudience] = useState('all');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const audiences = [
    { id: 'all', label: 'All Fans', count: totalFans },
    { id: 'vip', label: 'VIP Fans Only', count: Math.floor(totalFans * 0.2) },
    { id: 'recent', label: 'Recently Active', count: Math.floor(totalFans * 0.5) },
    { id: 'new', label: 'New Fans', count: Math.floor(totalFans * 0.3) }
  ];

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsSending(true);
    
    // Simulate sending
    setTimeout(() => {
      const audience = audiences.find(a => a.id === selectedAudience);
      // toast.success(`Message sent to ${audience.count} ${audience.label.toLowerCase()}!`);
      setMessage('');
      setIsSending(false);
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-2xl max-w-lg w-full shadow-xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <MegaphoneIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Broadcast Message</h2>
                <p className="text-sm text-gray-600">Send a message to multiple fans at once</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Audience Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Select Audience
              </label>
              <div className="grid grid-cols-2 gap-3">
                {audiences.map((audience) => (
                  <motion.button
                    key={audience.id}
                    onClick={() => setSelectedAudience(audience.id)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedAudience === audience.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-2">
                      <UserGroupIcon className="w-5 h-5 text-gray-600" />
                      <span className="font-medium text-gray-900">{audience.label}</span>
                    </div>
                    <span className="text-sm text-gray-500">{audience.count} fans</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={4}
              />
              <div className="mt-1 text-right">
                <span className={`text-sm ${message.length > 500 ? 'text-red-500' : 'text-gray-500'}`}>
                  {message.length}/500
                </span>
              </div>
            </div>

            {/* Schedule Option */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="schedule"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <label htmlFor="schedule" className="text-sm text-gray-700 flex items-center gap-2">
                <ClockIcon className="w-4 h-4" />
                Schedule for later
              </label>
            </div>

            {isScheduled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              This will send to {audiences.find(a => a.id === selectedAudience)?.count || 0} fans
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <motion.button
                onClick={handleSend}
                disabled={isSending || !message.trim()}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <PaperAirplaneIcon className="w-4 h-4" />
                    {isScheduled ? 'Schedule' : 'Send Now'}
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BroadcastMessageModal;