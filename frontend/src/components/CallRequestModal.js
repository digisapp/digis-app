import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  VideoCameraIcon,
  PhoneIcon,
  CalendarIcon,
  ClockIcon,
  PaperAirplaneIcon,
  InformationCircleIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import { customToast } from './ui/EnhancedToaster';
import { getAuthToken } from '../utils/supabase-auth';

const CallRequestModal = ({ 
  isOpen, 
  onClose, 
  creatorData, // Creator being requested
  tokenBalance = 0,
  onRequestSent 
}) => {
  const [requestType, setRequestType] = useState('video'); // video or voice
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [alternateDate, setAlternateDate] = useState('');
  const [alternateTime, setAlternateTime] = useState('');
  const [duration, setDuration] = useState(30); // minutes
  const [message, setMessage] = useState('');
  const [urgency, setUrgency] = useState('normal'); // normal, urgent
  const [sending, setSending] = useState(false);
  const [showSuggestedSlots, setShowSuggestedSlots] = useState(false);
  
  // Mock suggested time slots based on creator availability
  const suggestedTimeSlots = [
    { date: '2024-03-15', time: '14:00', label: 'Tomorrow 2:00 PM', probability: 95 },
    { date: '2024-03-15', time: '15:00', label: 'Tomorrow 3:00 PM', probability: 90 },
    { date: '2024-03-16', time: '14:00', label: 'Saturday 2:00 PM', probability: 85 },
    { date: '2024-03-16', time: '16:00', label: 'Saturday 4:00 PM', probability: 80 },
    { date: '2024-03-17', time: '15:00', label: 'Sunday 3:00 PM', probability: 75 }
  ];

  const calculateCost = () => {
    const baseRate = requestType === 'video' ? (creatorData?.video_price || 8) : (creatorData?.voice_price || 6);
    const urgencyMultiplier = urgency === 'urgent' ? 1.5 : 1;
    return Math.round(duration * baseRate * urgencyMultiplier);
  };

  const canAfford = () => {
    return tokenBalance >= calculateCost();
  };

  const handleSendRequest = async () => {
    if (!preferredDate || !preferredTime) {
      customToast.error('Please select your preferred date and time');
      return;
    }

    if (!canAfford()) {
      customToast.error(`Insufficient tokens. You need ${calculateCost()} tokens for this request.`);
      return;
    }

    setSending(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        customToast.error('Authentication required');
        return;
      }

      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 1500));

      customToast.success(
        `${requestType === 'video' ? 'Video' : 'Voice'} call request sent to ${creatorData.displayName}!`,
        { icon: '📤' }
      );

      if (onRequestSent) {
        onRequestSent({
          type: requestType,
          creator: creatorData,
          preferredDate,
          preferredTime,
          alternateDate,
          alternateTime,
          duration,
          message,
          urgency,
          cost: calculateCost()
        });
      }

      onClose();
      resetForm();
    } catch (error) {
      customToast.error('Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setRequestType('video');
    setPreferredDate('');
    setPreferredTime('');
    setAlternateDate('');
    setAlternateTime('');
    setDuration(30);
    setMessage('');
    setUrgency('normal');
  };

  if (!isOpen) return null;

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
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CalendarDaysIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Request a Call</h2>
                  <p className="text-blue-100 text-sm">Request a call with {creatorData?.displayName}</p>
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

          {/* Creator Info */}
          <div className="p-4 bg-gray-50 border-b flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
              {creatorData?.displayName?.charAt(0) || 'C'}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{creatorData?.displayName}</p>
              <p className="text-sm text-gray-600">
                Video: {creatorData?.video_price || 8} tokens/min • Voice: {creatorData?.voice_price || 6} tokens/min
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Call Type Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Call Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setRequestType('video')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    requestType === 'video'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <VideoCameraIcon className="w-6 h-6 mx-auto mb-2" />
                  <p className="font-medium">Video Call</p>
                  <p className="text-xs text-gray-500 mt-1">{creatorData?.video_price || 8} tokens/min</p>
                </button>
                <button
                  onClick={() => setRequestType('voice')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    requestType === 'voice'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <PhoneIcon className="w-6 h-6 mx-auto mb-2" />
                  <p className="font-medium">Voice Call</p>
                  <p className="text-xs text-gray-500 mt-1">{creatorData?.voice_price || 6} tokens/min</p>
                </button>
              </div>
            </div>

            {/* Urgency */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Priority
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setUrgency('normal')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    urgency === 'normal'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <ClockIcon className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-sm font-medium">Normal</p>
                  <p className="text-xs text-gray-500">Standard rate</p>
                </button>
                <button
                  onClick={() => setUrgency('urgent')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    urgency === 'urgent'
                      ? 'border-orange-600 bg-orange-50 text-orange-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg mb-1 block">🔥</span>
                  <p className="text-sm font-medium">Urgent</p>
                  <p className="text-xs text-gray-500">1.5x rate</p>
                </button>
              </div>
              {urgency === 'urgent' && (
                <p className="text-xs text-orange-600 mt-2">
                  Urgent requests are highlighted to the creator and cost 50% more tokens
                </p>
              )}
            </div>

            {/* Preferred Date/Time */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">
                  Preferred Date & Time
                </label>
                <button
                  type="button"
                  onClick={() => setShowSuggestedSlots(!showSuggestedSlots)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {showSuggestedSlots ? 'Hide' : 'Show'} Suggested Times
                </button>
              </div>
              
              {/* Suggested Time Slots */}
              {showSuggestedSlots && (
                <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs font-medium text-blue-800 mb-2">
                    🎯 Best times based on {creatorData?.displayName}'s availability:
                  </p>
                  <div className="space-y-2">
                    {suggestedTimeSlots.map((slot, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setPreferredDate(slot.date);
                          setPreferredTime(slot.time);
                          setShowSuggestedSlots(false);
                        }}
                        className="w-full flex items-center justify-between p-2 bg-white rounded-lg hover:bg-blue-100 transition-colors text-left"
                      >
                        <span className="text-sm font-medium text-gray-900">{slot.label}</span>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-gray-500">{slot.probability}% chance</div>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${slot.probability}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <select
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
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
            </div>

            {/* Alternate Date/Time */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Alternate Date & Time (Optional)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="date"
                    value={alternateDate}
                    onChange={(e) => setAlternateDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <select
                    value={alternateTime}
                    onChange={(e) => setAlternateTime(e.target.value)}
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
              <p className="text-xs text-gray-500 mt-1">
                Provide an alternate time to increase chances of approval
              </p>
            </div>

            {/* Duration */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Requested Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>

            {/* Message */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Message to Creator
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell the creator what you'd like to discuss..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                A good message increases your chances of approval
              </p>
            </div>

            {/* Cost Summary */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Call Type</span>
                <span className="font-medium">{requestType === 'video' ? 'Video' : 'Voice'} Call</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Duration</span>
                <span className="font-medium">{duration} minutes</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Rate</span>
                <span className="font-medium">
                  {requestType === 'video' ? creatorData?.video_price || 8 : creatorData?.voice_price || 6} tokens/min
                  {urgency === 'urgent' && ' × 1.5'}
                </span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">Total Cost</span>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">{calculateCost()} tokens</p>
                    <p className={`text-xs ${canAfford() ? 'text-green-600' : 'text-red-600'}`}>
                      {canAfford() ? `✓ You have ${tokenBalance} tokens` : `✗ You need ${calculateCost() - tokenBalance} more tokens`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Note */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
              <InformationCircleIcon className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How requests work:</p>
                <ul className="space-y-1 text-xs">
                  <li>• The creator will review your request</li>
                  <li>• They can accept, decline, or propose a different time</li>
                  <li>• You'll be notified of their response</li>
                  <li>• Tokens are only charged when the call starts</li>
                </ul>
              </div>
            </div>
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
              onClick={handleSendRequest}
              disabled={!canAfford() || sending}
              className="flex-1"
              icon={sending ? null : <PaperAirplaneIcon className="w-5 h-5" />}
            >
              {sending ? 'Sending...' : `Send Request (${calculateCost()} tokens)`}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CallRequestModal;