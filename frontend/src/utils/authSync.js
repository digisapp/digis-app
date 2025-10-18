/**
 * Singleton Auth Sync Orchestrator
 *
 * Ensures only one sync happens at a time, with toast cooldown and retry limits.
 * Prevents "dueling auth listeners" and retry spam.
 * Persists role hints to prevent downgrade on transient errors.
 */

import { supabase } from './supabase-auth';
import { fetchWithTimeout } from './fetchWithTimeout';
import toast from 'react-hot-toast';
import { api } from './apiClient';
import { normalizeSession, persistRoleHint } from './normalizeSession';

// Singleton tracking
let inFlightSync = null;         // Promise | null
let lastToastAt = 0;
let lastRunAt = 0;
let retryCount = 0;

// Cooldowns
const TOAST_COOLDOWN_MS = 60_000;  // 60 seconds between toasts
const SYNC_COOLDOWN_MS = 10_000;   // 10 seconds between syncs
const MAX_RETRIES = 3;              // Stop after 3 failed attempts

// Sequence guard for preventing stale responses
let syncSequence = 0;

/**
 * Check if we should show the sync toast
 * Uses sessionStorage to guarantee once-per-session behavior
 */
function shouldShowSyncToast() {
  const key = 'syncToastShownAt';
  const now = Date.now();

  try {
    const lastShown = Number(sessionStorage.getItem(key) || 0);
    if (now - lastShown > TOAST_COOLDOWN_MS) {
      sessionStorage.setItem(key, String(now));
      return true;
    }
    return false;
  } catch (e) {
    // Safari private mode - use in-memory cooldown
    if (now - lastToastAt > TOAST_COOLDOWN_MS) {
      lastToastAt = now;
      return true;
    }
    return false;
  }
}

/**
 * Singleton account sync orchestrator
 * Guarantees one network sequence, one toast, proper retry limits
 *
 * @param {string} reason - Why sync was triggered (for debugging)
 * @returns {Promise<Object|null>} Normalized session data or null on failure
 */
export async function syncAccountOnce(reason = 'manual') {
  const now = Date.now();

  // Protect against hammering
  if (inFlightSync) {
    console.log(`[AuthSync] Sync already in flight (reason: ${reason}), sharing promise`);
    return inFlightSync;
  }

  if (now - lastRunAt < SYNC_COOLDOWN_MS) {
    console.log(`[AuthSync] Cooldown active, skipping sync (reason: ${reason})`);
    return null;
  }

  // Check retry limit
  if (retryCount >= MAX_RETRIES) {
    console.warn(`[AuthSync] Max retries (${MAX_RETRIES}) reached, stopping sync attempts`);
    return null;
  }

  // Increment sequence for this sync attempt
  const mySequence = ++syncSequence;
  console.log(`[AuthSync] Starting sync #${mySequence} (reason: ${reason})`);

  inFlightSync = (async () => {
    try {
      // Show toast at most once per minute (session-scoped)
      if (shouldShowSyncToast()) {
        toast("We're syncing your account. You can keep browsing.", {
          duration: 4000,
          icon: '🔄',
          position: 'bottom-center',
          style: {
            background: '#6366f1',
            color: '#fff',
            fontSize: '14px'
          }
        });
      }

      // 1) Ensure session exists locally
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        throw new Error('No Supabase session');
      }

      // Check sequence - abort if stale
      if (mySequence !== syncSequence) {
        console.log(`[AuthSync] Sequence ${mySequence} stale (current: ${syncSequence}), aborting`);
        return null;
      }

      // 2) Idempotent user sync (server handles email-linking + defaults)
      try {
        const session = data.session;
        const requestBody = {
          supabaseId: session.user.id,
          email: session.user.email || `${session.user.id}@placeholder.local`,
          metadata: {
            username: session.user.user_metadata?.username || session.user.email?.split('@')[0],
            account_type: session.user.user_metadata?.account_type || 'fan',
            role: session.user.user_metadata?.role || 'fan',
            is_creator: session.user.user_metadata?.is_creator || false
          }
        };

        await api.post('/auth/sync-user', requestBody, { withAuth: true });
        console.log(`[AuthSync] sync-user completed`);
      } catch (syncError) {
        // Non-blocking: Continue to session fetch even if sync-user fails
        console.warn(`[AuthSync] sync-user failed (non-blocking):`, syncError);
      }

      // Check sequence after sync-user
      if (mySequence !== syncSequence) {
        console.log(`[AuthSync] Sequence ${mySequence} stale after sync-user, aborting`);
        return null;
      }

      // 3) Canonical session from backend (single source of truth)
      const sessionData = await api.get('/auth/session', { withAuth: true });

      // Check sequence again - abort if stale
      if (mySequence !== syncSequence) {
        console.log(`[AuthSync] Sequence ${mySequence} stale after session fetch, discarding`);
        return null;
      }

      // 4) Normalize response to handle both API formats
      const normalized = normalizeSession(sessionData);

      if (!normalized) {
        throw new Error('Invalid session payload');
      }

      // 5) Persist role hint to prevent downgrade on transient errors
      persistRoleHint(normalized.role, normalized.user.id);

      // Success - reset retry count
      retryCount = 0;
      console.log(`[AuthSync] Sync #${mySequence} succeeded, role: ${normalized.role}`);

      return normalized;

    } catch (error) {
      retryCount++;
      console.error(`[AuthSync] Sync #${mySequence} failed (attempt ${retryCount}/${MAX_RETRIES}):`, error);

      // Only show error toast if we've hit max retries
      if (retryCount >= MAX_RETRIES) {
        toast.error('Unable to sync your account. Please refresh the page.', {
          duration: 6000
        });
      }

      return null;

    } finally {
      lastRunAt = Date.now();
      inFlightSync = null;
    }
  })();

  return inFlightSync;
}

/**
 * Reset retry count and cooldowns
 * Call this on successful login or manual refresh
 */
export function resetSyncState() {
  retryCount = 0;
  lastRunAt = 0;
  lastToastAt = 0;
  syncSequence = 0;
  inFlightSync = null;

  try {
    sessionStorage.removeItem('syncToastShownAt');
  } catch (e) {
    // Ignore storage errors
  }

  console.log('[AuthSync] State reset');
}

/**
 * Get current sync status (for debugging)
 */
export function getSyncStatus() {
  return {
    inFlight: !!inFlightSync,
    retryCount,
    sequence: syncSequence,
    lastRunAt,
    cooldownRemaining: Math.max(0, SYNC_COOLDOWN_MS - (Date.now() - lastRunAt))
  };
}
