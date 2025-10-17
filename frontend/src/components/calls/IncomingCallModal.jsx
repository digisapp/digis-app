import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authedFetch } from '../../utils/requireAuth';
import toast from 'react-hot-toast';

/**
 * Incoming Call Modal - Shows when a creator calls a fan
 *
 * Features:
 * - Auto-dismisses after 2 minutes (expiration)
 * - Shows creator info and call type
 * - Countdown timer
 * - Accept/Decline buttons
 * - Handles auth and API calls
 *
 * @param {Object} invite - Call invitation details
 * @param {string} invite.callId - UUID of the call
 * @param {string} invite.creatorId - Creator's user ID
 * @param {string} invite.creatorName - Creator's display name
 * @param {string} invite.avatar - Creator's avatar URL
 * @param {string} invite.callType - 'voice' or 'video'
 * @param {string} invite.expiresAt - ISO timestamp when invitation expires
 * @param {string} invite.message - Optional message from creator
 * @param {Function} onClose - Called when modal closes
 * @param {Function} onAccepted - Called when call is accepted with Agora credentials
 */
export default function IncomingCallModal({ invite, onClose, onAccepted }) {
  // ✅ Early return BEFORE hooks (fixes React error #310)
  if (!invite) return null;

  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Calculate remaining time
  useEffect(() => {
    const updateRemaining = () => {
      const remaining = Math.max(0, Math.floor((new Date(invite.expiresAt) - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      // Auto-close when expired
      if (remaining === 0) {
        toast('Call invitation expired', { icon: '⏱️' });
        onClose?.();
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [invite.expiresAt, onClose]); // invite guaranteed to exist now

  const handleAccept = async () => {
    if (!invite || accepting) return;

    setAccepting(true);

    try {
      const res = await authedFetch(`/api/calls/${invite.callId}/accept`, {
        method: 'POST'
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || 'Failed to accept call');
        setAccepting(false);
        return;
      }

      const data = await res.json();

      // Pass Agora credentials to parent
      onAccepted?.({
        callId: invite.callId,
        appId: data.appId,
        token: data.token,
        channel: data.channel,
        uid: data.uid,
        creatorUid: data.creatorUid,
        callType: data.callType,
        ratePerMinute: data.ratePerMinute
      });

      onClose?.();
    } catch (error) {
      console.error('Error accepting call:', error);
      toast.error('Failed to accept call');
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!invite || declining) return;

    setDeclining(true);

    try {
      await authedFetch(`/api/calls/${invite.callId}/decline`, {
        method: 'POST'
      });

      toast('Call declined', { icon: '📵' });
      onClose?.();
    } catch (error) {
      console.error('Error declining call:', error);
      setDeclining(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => {
          // Close on backdrop click
          if (e.target === e.currentTarget) {
            handleDecline();
          }
        }}
      >
        <motion.div
          className="w-full max-w-sm rounded-2xl p-6 bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Incoming {invite.callType === 'video' ? 'Video' : 'Voice'} Call
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Expires in {remainingSeconds}s
            </div>
          </div>

          {/* Creator Info */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div className="relative">
              <img
                src={invite.avatar || '/default-avatar.png'}
                alt={invite.creatorName}
                className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-700"
              />
              {/* Pulsing ring animation */}
              <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-ping" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 dark:text-white truncate">
                {invite.creatorName}
              </div>
              {invite.message && (
                <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                  "{invite.message}"
                </div>
              )}
            </div>
          </div>

          {/* Call Type Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              {invite.callType === 'video' ? (
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDecline}
              disabled={declining || accepting}
              className="px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-medium hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {declining ? 'Declining...' : 'Decline'}
            </button>
            <button
              onClick={handleAccept}
              disabled={accepting || declining}
              className="px-4 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {accepting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Accept
                </>
              )}
            </button>
          </div>

          {/* Info Text */}
          <div className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            By accepting, you agree to the call pricing and terms
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
