import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  VideoCameraIcon,
  PhoneIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { getAuthToken } from '../../utils/supabase-auth';
import toast from 'react-hot-toast';

const MobileCallRequest = ({ 
  isOpen, 
  onClose, 
  recipient, 
  callType = 'video',
  userTokenBalance = 0,
  onCallStart 
}) => {
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [recipientRates, setRecipientRates] = useState({
    video: 10,
    voice: 5
  });

  // Fetch recipient's call rates
  useEffect(() => {
    const fetchRates = async () => {
      if (!recipient?.id) return;
      
      try {
        const token = await getAuthToken();
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/creators/${recipient.id}/rates`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          setRecipientRates({
            video: data.video_rate || data.creator_rate || 10,
            voice: data.voice_rate || 5
          });
        }
      } catch (error) {
        console.error('Error fetching creator rates:', error);
      }
    };
    
    fetchRates();
  }, [recipient]);

  const rate = callType === 'video' ? recipientRates.video : recipientRates.voice;
  const callTypeLabel = callType === 'video' ? 'Video Call' : 'Voice Call';
  const CallIcon = callType === 'video' ? VideoCameraIcon : PhoneIcon;
  
  // Calculate estimated cost for different durations
  const estimatedCosts = [
    { duration: 5, cost: rate * 5 },
    { duration: 10, cost: rate * 10 },
    { duration: 30, cost: rate * 30 }
  ];
  
  const canAfford = userTokenBalance >= rate * 5; // Minimum 5 minutes

  const sendCallRequest = async () => {
    if (!canAfford) {
      toast.error('Insufficient tokens for this call');
      return;
    }

    setLoading(true);
    
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/calls/request`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipientId: recipient.id,
            callType,
            estimatedDuration: 10 // Default 10 minutes
          })
        }
      );
      
      if (response.ok) {
        setRequestSent(true);
        toast.success(`${callTypeLabel} request sent to ${recipient.name || recipient.username}`);
        
        // Auto close after showing success
        setTimeout(() => {
          onClose();
          setRequestSent(false);
        }, 2000);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to send call request');
      }
    } catch (error) {
      console.error('Error sending call request:', error);
      toast.error('Failed to send call request');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-3xl shadow-2xl z-50 max-w-sm mx-auto overflow-hidden"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <CallIcon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{callTypeLabel} Request</h3>
                  <p className="text-white/90">to {recipient?.name || recipient?.username}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {!requestSent ? (
                <>
                  {/* Rate Information */}
                  <div className="bg-purple-50 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-600 font-medium">Rate per minute</span>
                      <div className="flex items-center gap-1 text-purple-600 font-bold text-lg">
                        <CurrencyDollarIcon className="w-5 h-5" />
                        {rate} tokens
                      </div>
                    </div>
                    
                    {/* Estimated costs */}
                    <div className="space-y-2 pt-3 border-t border-purple-100">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Estimated Cost</p>
                      <div className="grid grid-cols-3 gap-2">
                        {estimatedCosts.map(({ duration, cost }) => (
                          <div key={duration} className="text-center p-2 bg-white rounded-lg">
                            <div className="text-xs text-gray-500">{duration} min</div>
                            <div className="text-sm font-semibold text-gray-900">{cost} tokens</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Balance Check */}
                  <div className={`rounded-2xl p-4 ${canAfford ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center gap-3">
                      {canAfford ? (
                        <CheckCircleIcon className="w-6 h-6 text-green-600" />
                      ) : (
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                      )}
                      <div>
                        <p className={`font-medium ${canAfford ? 'text-green-900' : 'text-red-900'}`}>
                          Your balance: {userTokenBalance} tokens
                        </p>
                        {!canAfford && (
                          <p className="text-sm text-red-700 mt-1">
                            You need at least {rate * 5} tokens for a 5-minute call
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                    <div className="flex items-start gap-3">
                      <ClockIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div className="text-sm text-gray-600">
                        <p className="font-medium text-gray-900 mb-1">How it works:</p>
                        <ul className="space-y-1">
                          <li>• Request will be sent to {recipient?.name || 'creator'}</li>
                          <li>• They'll see your request with token rate</li>
                          <li>• Call starts when they accept</li>
                          <li>• Tokens deducted per minute during call</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 py-3 px-4 border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={sendCallRequest}
                      disabled={!canAfford || loading}
                      className={`flex-1 py-3 px-4 rounded-xl font-semibold text-white transition-all ${
                        canAfford && !loading
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg active:scale-95'
                          : 'bg-gray-300 cursor-not-allowed'
                      }`}
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Sending...
                        </span>
                      ) : (
                        `Send ${callTypeLabel} Request`
                      )}
                    </button>
                  </div>

                  {!canAfford && (
                    <button
                      onClick={() => {
                        onClose();
                        // Navigate to token purchase
                        window.location.href = '/wallet';
                      }}
                      className="w-full py-3 px-4 bg-purple-100 text-purple-700 rounded-xl font-semibold hover:bg-purple-200 transition-colors"
                    >
                      Buy More Tokens
                    </button>
                  )}
                </>
              ) : (
                /* Success State */
                <div className="text-center py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', duration: 0.5 }}
                    className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <CheckCircleIcon className="w-10 h-10 text-green-600" />
                  </motion.div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">Request Sent!</h4>
                  <p className="text-gray-600">
                    Your {callTypeLabel.toLowerCase()} request has been sent to {recipient?.name || recipient?.username}.
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    You'll be notified when they respond.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileCallRequest;