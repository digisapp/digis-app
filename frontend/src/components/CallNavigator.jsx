/**
 * CallNavigator (production-hardened)
 *
 * - Auto-navigates on call accept
 * - Prevents double navigation (idempotency)
 * - Preflights mic/cam permissions
 * - Tracks analytics + Sentry breadcrumbs
 * - Handles stale events (15s freshness)
 * - Provides retry UX on permission denial
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';
import { analytics } from '../lib/analytics';
import { addBreadcrumb, captureError } from '../lib/sentry.client';

// Freshness window: ignore events older than 15s
const FRESHNESS_WINDOW_MS = 15000;

async function ensurePermissions(kind, { type, roomId }) {
  // Voice: mic only. Video: cam+mic.
  const constraints = kind === 'video' ? { video: true, audio: true } : { audio: true };
  try {
    if (!navigator?.mediaDevices?.getUserMedia) return true; // skip on unsupported
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    // Immediately stop tracks so we don't leak resources here
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch (err) {
    captureError?.(err, { context: 'permissions', kind });

    // Track permission denial in analytics
    analytics.track?.('call_join_denied', {
      type,
      roomId,
      reason: 'permissions',
      error: err.name,
    });

    // Show retry UX
    toast.error((t) => (
      <div className="flex flex-col gap-2">
        <span>Please allow microphone/camera to join the call.</span>
        <button
          onClick={() => {
            toast.dismiss(t.id);
            // User can click the notification again to retry
          }}
          className="text-xs px-2 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
        >
          Dismiss
        </button>
      </div>
    ), { duration: 6000 });

    return false;
  }
}

export default function CallNavigator() {
  const { callAccepted, clearCallAccepted } = useSocket();
  const navigate = useNavigate();
  const navigatingRef = useRef(false);
  const connectingToastRef = useRef(null);

  useEffect(() => {
    if (!callAccepted || navigatingRef.current) return;

    const { type, roomId, at } = callAccepted || {};
    if (!roomId) {
      // Safety guard: missing room id
      captureError?.(new Error('Missing roomId on callAccepted'), { callAccepted });
      clearCallAccepted?.();
      return;
    }

    // Freshness check: ignore events older than 15s
    if (at && Date.now() - at > FRESHNESS_WINDOW_MS) {
      console.warn('🚫 Ignoring stale call-accepted event:', { roomId, age: Date.now() - at });
      analytics.track?.('call_join_aborted', {
        type,
        roomId,
        reason: 'stale_event',
        age_ms: Date.now() - at,
      });
      clearCallAccepted?.();
      return;
    }

    const path =
      type === 'video'
        ? `/call/video?room=${encodeURIComponent(roomId)}`
        : `/call/voice?room=${encodeURIComponent(roomId)}`;

    (async () => {
      navigatingRef.current = true;

      addBreadcrumb?.('call_accepted', { type, roomId });
      analytics.track?.('call_join_attempt', { type, roomId, to: path });

      // Show "Connecting..." toast
      connectingToastRef.current = toast.loading('Connecting to call...', {
        duration: Infinity,
      });

      // Permission preflight (no-op on unsupported browsers)
      const ok = await ensurePermissions(type, { type, roomId });
      if (!ok) {
        // Dismiss connecting toast
        if (connectingToastRef.current) {
          toast.dismiss(connectingToastRef.current);
          connectingToastRef.current = null;
        }
        clearCallAccepted?.();
        navigatingRef.current = false;
        return;
      }

      // Success UX + navigation
      // Dismiss connecting toast
      if (connectingToastRef.current) {
        toast.dismiss(connectingToastRef.current);
        connectingToastRef.current = null;
      }

      toast.success('Call connected! 🎉', { duration: 2000 });
      addBreadcrumb?.('call_navigate', { path });
      console.log('📞 Auto-navigating to call:', path);

      navigate(path, { replace: true });
      analytics.track?.('call_join_success', { type, roomId, to: path });

      // Clear socket state to avoid loops
      clearCallAccepted?.();

      // Release the guard shortly after nav to tolerate event races
      setTimeout(() => {
        navigatingRef.current = false;
      }, 1000);
    })();
  }, [callAccepted, navigate, clearCallAccepted]);

  return null;
}
