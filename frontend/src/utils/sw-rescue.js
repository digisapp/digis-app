/**
 * Service Worker Rescue Utility
 * Automatically unregisters broken service workers when detecting a storm of failed requests
 */

let failCount = 0;
const FAIL_BURST = 5; // 5 consecutive failures
const WINDOW_MS = 10_000; // within 10 seconds
let windowStart = Date.now();
let rescueInProgress = false;

/**
 * Call this function when a network request fails
 * It will automatically unregister service workers if too many failures occur
 */
export function noteRequestFailure() {
  if (rescueInProgress) return;

  const now = Date.now();

  // Reset window if too much time has passed
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    failCount = 0;
  }

  failCount++;

  // If we hit the failure threshold, rescue the app
  if (failCount >= FAIL_BURST) {
    console.warn('[SW Rescue] Detected request storm, clearing service workers...');
    rescueInProgress = true;
    rescueServiceWorker();
  }
}

/**
 * Manually trigger service worker rescue
 * Useful for debugging or manual recovery
 */
export async function rescueServiceWorker() {
  try {
    if ('serviceWorker' in navigator) {
      // Unregister all service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));

      console.log('[SW Rescue] Unregistered', registrations.length, 'service workers');
    }

    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));

      console.log('[SW Rescue] Cleared', cacheNames.length, 'caches');
    }

    console.log('[SW Rescue] Recovery complete, reloading...');

    // Reload the page to get fresh content
    window.location.reload();
  } catch (error) {
    console.error('[SW Rescue] Failed to rescue service worker:', error);
    // Still try to reload
    window.location.reload();
  }
}

/**
 * Reset the failure counter
 * Call this after successful requests to prevent false positives
 */
export function resetFailureCount() {
  failCount = 0;
  windowStart = Date.now();
}

// Export for manual use in console
if (typeof window !== 'undefined') {
  window.rescueServiceWorker = rescueServiceWorker;
}
