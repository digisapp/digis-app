/**
 * Runtime Service Worker Hotfix
 *
 * Clears stale service workers and caches that may be causing loading issues.
 * Runs automatically on version change or when ?nocache=1 is in URL.
 *
 * Usage:
 * - Add ?nocache=1 to URL to force SW unregistration
 * - Bump SW_VERSION to force re-run for all users
 */

const SW_VERSION = '2025-10-14a'; // Bump this to force re-run
const STORAGE_KEY = '__sw_fix';

export function initServiceWorkerHotfix() {
  try {
    const url = new URL(window.location.href);
    const nocache = url.searchParams.get('nocache');
    const lastFixVersion = localStorage.getItem(STORAGE_KEY);

    // Run if either nocache param is present OR version has changed
    if ('serviceWorker' in navigator && (nocache || lastFixVersion !== SW_VERSION)) {
      console.log('🔄 Running Service Worker hotfix...');

      navigator.serviceWorker.getRegistrations().then(regs => {
        if (regs.length > 0) {
          console.log(`🧹 Unregistering ${regs.length} service worker(s)...`);
          regs.forEach(r => r.unregister());
        }

        // Clear all caches created by workbox/PWA
        if (window.caches) {
          caches.keys().then(keys => {
            if (keys.length > 0) {
              console.log(`🧹 Deleting ${keys.length} cache(s)...`);
              keys.forEach(k => caches.delete(k));
            }
          });
        }
      }).finally(() => {
        // Mark this version as fixed
        localStorage.setItem(STORAGE_KEY, SW_VERSION);

        // If nocache param was used, remove it and reload
        if (nocache) {
          url.searchParams.delete('nocache');
          window.location.replace(url.toString());
        } else {
          // Version changed - reload to get fresh code
          window.location.reload();
        }
      });
    }
  } catch (e) {
    console.warn('Service Worker hotfix error (non-critical):', e);
  }
}
