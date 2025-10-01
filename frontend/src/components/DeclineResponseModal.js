import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CalendarIcon,
  HeartIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import { customToast } from './ui/EnhancedToaster';

const DeclineResponseModal = ({ 
  isOpen, 
  onClose, 
  request,
  onSendResponse,
  userType = 'creator' // 'creator' or 'fan'
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [suggestAlternative, setSuggestAlternative] = useState(false);
  const [alternativeDate, setAlternativeDate] = useState('');
  const [alternativeTime, setAlternativeTime] = useState('');
  const [sending, setSending] = useState(false);

  const templates = userType === 'creator' ? [
    {
      id: 'busy',
      icon: <ClockIcon className="w-5 h-5" />,
      title: "I'm fully booked",
      message: "Hi! Thanks so much for your request. Unfortunately, I'm fully booked during your requested time. Please check my availability calendar for open slots!"
    },
    {
      id: 'timing',
      icon: <CalendarIcon className="w-5 h-5" />,
      title: "Different timezone",
      message: "Thank you for your request! The timing doesn't work with my current schedule due to timezone differences. Feel free to request another time that works better for both of us."
    },
    {
      id: 'content',
      icon: <ChatBubbleLeftRightIcon className="w-5 h-5" />,
      title: "Not the right fit",
      message: "I appreciate your interest! After reviewing your request, I don't think I'm the best match for what you're looking for. I hope you find the perfect creator for your needs!"
    },
    {
      id: 'grateful',
      icon: <HeartIcon className="w-5 h-5" />,
      title: "Grateful but can't",
      message: "Thank you so much for thinking of me! I'm unable to accept this request at the moment, but I truly appreciate your support. Hope we can connect in the future!"
    }
  ] : [
    {
      id: 'changed_mind',
      icon: <SparklesIcon className="w-5 h-5" />,
      title: "Plans changed",
      message: "Thank you for the invite! My plans have changed and I won't be able to make it. I appreciate you thinking of me!"
    },
    {
      id: 'found_another',
      icon: <HeartIcon className="w-5 h-5" />,
      title: "Found another time",
      message: "Thanks for the invite! I've already scheduled a session for another time. Looking forward to connecting with you in the future!"
    },
    {
      id: 'not_ready',
      icon: <ClockIcon className="w-5 h-5" />,
      title: "Not ready yet",
      message: "I appreciate the invite! I'm not quite ready for a call yet, but I'll definitely reach out when I am. Thank you for understanding!"
    }
  ];

  const handleSendResponse = async () => {
    const finalMessage = customMessage || (selectedTemplate && templates.find(t => t.id === selectedTemplate)?.message) || '';
    
    if (!finalMessage.trim()) {
      customToast.error('Please select a template or write a custom message');
      return;
    }

    setSending(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = {
        message: finalMessage,
        suggestAlternative,
        alternativeDate: suggestAlternative ? alternativeDate : null,
        alternativeTime: suggestAlternative ? alternativeTime : null
      };

      if (onSendResponse) {
        onSendResponse(response);
      }

      customToast.success('Response sent!', { icon: '✉️' });
      onClose();
    } catch (error) {
      customToast.error('Failed to send response');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !request) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-600 to-gray-700 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <XMarkIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Decline Request</h2>
                  <p className="text-gray-200 text-sm">Send a thoughtful response</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Request Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Declining request from:</p>
              <p className="font-semibold text-gray-900">
                {userType === 'creator' ? request.fan?.displayName : request.creator?.displayName}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {request.type === 'video' ? 'Video' : 'Voice'} Call - {request.duration} minutes
              </p>
            </div>

            {/* Response Templates */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Quick Response Templates
              </label>
              <div className="space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      setCustomMessage(template.message);
                    }}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      selectedTemplate === template.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        selectedTemplate === template.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {template.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 mb-1">{template.title}</p>
                        <p className="text-sm text-gray-600">{template.message}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Message */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Custom Message
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Write your own message..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Suggest Alternative */}
            {userType === 'creator' && (
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={suggestAlternative}
                    onChange={(e) => setSuggestAlternative(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Suggest an alternative time
                  </span>
                </label>

                {suggestAlternative && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="date"
                        value={alternativeDate}
                        onChange={(e) => setAlternativeDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <select
                        value={alternativeTime}
                        onChange={(e) => setAlternativeTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Select time</option>
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i;
                          const time24 = `${hour.toString().padStart(2, '0')}:00`;
                          const time12 = new Date(`2000-01-01 ${time24}`).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            hour12: true
                          });
                          return (
                            <option key={hour} value={time24}>{time12}</option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3">
            <Button
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSendResponse}
              disabled={sending || (!customMessage.trim() && !selectedTemplate)}
              className="flex-1"
            >
              {sending ? 'Sending...' : 'Send Response'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DeclineResponseModal;