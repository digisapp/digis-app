import { useState } from 'react';
import { requireAuthSimple, authedFetch } from '../../utils/requireAuth';
import toast from 'react-hot-toast';

/**
 * CallButton - Initiates voice or video calls from creator to fan
 *
 * Features:
 * - Soft auth (session-based, not profile-based)
 * - Rate limit friendly error handling
 * - Permission checks
 * - Loading states
 * - User-friendly error messages
 *
 * @param {string} fanId - Target fan's user ID
 * @param {string} callType - 'voice' or 'video'
 * @param {boolean} disabled - External disable state
 * @param {Function} onCallInitiated - Called after successful initiation with { callId, channel }
 * @param {string} className - Additional CSS classes
 * @param {boolean} iconOnly - Show only icon, no text
 */
export default function CallButton({
  fanId,
  callType = 'voice',
  disabled = false,
  onCallInitiated,
  className = '',
  iconOnly = false
}) {
  const [busy, setBusy] = useState(false);

  const startCall = async () => {
    if (!fanId || busy || disabled) return;

    // Soft auth check - session-based, not profile-based
    const ok = await requireAuthSimple({
      intent: 'call_fan',
      metadata: { fanId, callType }
    });

    if (!ok) {
      // Auth wall was opened, user needs to sign in
      return;
    }

    setBusy(true);

    try {
      const res = await authedFetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fanId,
          callType,
          message: `Starting a ${callType} call`
        })
      });

      if (!res.ok) {
        const error = await res.json();
        const code = error.code;

        // Handle specific error codes with user-friendly messages
        if (code === 'CALL_COOLDOWN') {
          toast.error(`Please wait ${error.retryAfter || 60}s before calling again`, {
            icon: '⏱️',
            duration: 4000
          });
        } else if (code === 'CALL_NOT_ALLOWED') {
          toast(
            'This fan only accepts calls from creators they follow or have interacted with.',
            {
              icon: '🚫',
              duration: 5000
            }
          );
        } else if (code === 'FAN_BLOCKED') {
          toast('Unable to call this fan', {
            icon: '🚫',
            duration: 4000
          });
        } else if (code === 'FEATURE_DISABLED') {
          toast('Calls are not available yet', {
            icon: 'ℹ️',
            duration: 4000
          });
        } else if (code === 'NOT_CREATOR') {
          toast('Only creators can initiate calls', {
            icon: '⚠️',
            duration: 4000
          });
        } else {
          toast.error(error.error || 'Failed to start call');
        }

        setBusy(false);
        return;
      }

      const data = await res.json();

      // Show success feedback
      toast.success('Ringing...', {
        icon: '📞',
        duration: 3000
      });

      // Notify parent component
      onCallInitiated?.({
        callId: data.callId,
        channel: data.channel,
        state: data.state
      });

    } catch (error) {
      console.error('Error starting call:', error);
      toast.error('Failed to start call');
    } finally {
      setBusy(false);
    }
  };

  // Icon component
  const Icon = callType === 'video' ? VideoIcon : VoiceIcon;

  if (iconOnly) {
    return (
      <button
        onClick={startCall}
        disabled={disabled || busy}
        className={`p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        title={`${callType === 'video' ? 'Video' : 'Voice'} call`}
      >
        {busy ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Icon className="w-5 h-5" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={startCall}
      disabled={disabled || busy}
      className={`px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${className}`}
    >
      {busy ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <Icon className="w-5 h-5" />
          {callType === 'video' ? 'Video Call' : 'Voice Call'}
        </>
      )}
    </button>
  );
}

// Icon components
function VideoIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function VoiceIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  );
}
