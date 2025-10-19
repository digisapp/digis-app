/**
 * Clear Service Worker and Caches
 *
 * Call this function to:
 * - Unregister all service workers
 * - Clear all caches
 * - Reload the page
 *
 * Useful for fixing:
 * - Stale chunk 404 errors
 * - Suspense hanging on missing modules
 * - Old cached JavaScript after deployments
 *
 * Usage:
 * 1. Run in browser console: clearServiceWorkerAndReload()
 * 2. Add as debug button: <button onClick={clearServiceWorkerAndReload}>Clear Cache</button>
 * 3. Auto-run on app init (if needed)
 */
export async function clearServiceWorkerAndReload() {
  try {
    console.log('🧹 Starting service worker and cache cleanup...');

    let clearedSomething = false;

    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        console.log(`🧹 Found ${registrations.length} service worker(s) to unregister`);
        await Promise.all(registrations.map(reg => reg.unregister()));
        clearedSomething = true;
      } else {
        console.log('✅ No service workers to unregister');
      }
    }

    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      if (cacheNames.length > 0) {
        console.log(`🧹 Found ${cacheNames.length} cache(s) to delete:`, cacheNames);
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        clearedSomething = true;
      } else {
        console.log('✅ No caches to delete');
      }
    }

    if (clearedSomething) {
      console.log('✅ Service worker and cache cleanup complete! Reloading...');
      // Force reload from server (no cache)
      window.location.reload(true);
    } else {
      console.log('✅ Nothing to clean up');
    }

    return true;
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    return false;
  }
}

/**
 * Auto-cleanup stale service workers on app start
 *
 * Only unregisters workers if they're blocking chunk loading.
 * Doesn't reload the page.
 */
export async function autoCleanupStaleServiceWorkers() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();

      if (registrations.length > 0) {
        console.warn(`⚠️ Found ${registrations.length} registered service worker(s)`);
        console.warn('⚠️ Service workers were removed from this app but are still registered');
        console.warn('⚠️ Unregistering them now to prevent stale chunk errors...');

        await Promise.all(registrations.map(reg => reg.unregister()));

        // Clear caches too (might contain old chunks)
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }

        console.log('✅ Stale service workers cleaned up successfully');
      }
    }
  } catch (error) {
    // Non-critical error, don't block app startup
    console.warn('Service worker cleanup failed (non-critical):', error);
  }
}

// Make available globally for console debugging
if (typeof window !== 'undefined') {
  window.clearServiceWorkerAndReload = clearServiceWorkerAndReload;
  console.log('💡 Tip: Run clearServiceWorkerAndReload() in console to clear all caches and reload');
}
