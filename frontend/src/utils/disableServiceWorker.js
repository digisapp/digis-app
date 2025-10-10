/**
 * Disable and clean up all service workers
 * This prevents caching issues that interfere with authentication
 */

export async function disableAllServiceWorkers() {
  if (!('serviceWorker' in navigator)) {
    console.log('✅ Service workers not supported - nothing to disable');
    return;
  }

  try {
    console.log('🧹 Starting aggressive service worker cleanup...');

    // Get all registrations
    const registrations = await navigator.serviceWorker.getRegistrations();

    if (registrations.length === 0) {
      console.log('✅ No service workers found');
      return;
    }

    console.log(`🧹 Found ${registrations.length} service worker(s) to unregister`);

    // Unregister all service workers
    const unregisterPromises = registrations.map(async (registration, index) => {
      try {
        const success = await registration.unregister();
        if (success) {
          console.log(`✅ Service worker ${index + 1} unregistered successfully`);
        } else {
          console.warn(`⚠️ Service worker ${index + 1} failed to unregister`);
        }
        return success;
      } catch (error) {
        console.error(`❌ Error unregistering service worker ${index + 1}:`, error);
        return false;
      }
    });

    await Promise.all(unregisterPromises);

    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log(`🧹 Found ${cacheNames.length} cache(s) to delete`);

      await Promise.all(
        cacheNames.map(async (cacheName) => {
          await caches.delete(cacheName);
          console.log(`✅ Cache deleted: ${cacheName}`);
        })
      );
    }

    console.log('✅ Service worker cleanup complete - page will reload');

    // Reload the page to ensure clean state
    // Use a flag to prevent infinite reload loops
    if (!sessionStorage.getItem('sw-cleanup-done')) {
      sessionStorage.setItem('sw-cleanup-done', 'true');
      window.location.reload();
    }
  } catch (error) {
    console.error('❌ Service worker cleanup failed:', error);
  }
}

// Export a function to check if cleanup was just done
export function wasCleanupJustDone() {
  return sessionStorage.getItem('sw-cleanup-done') === 'true';
}

// Export a function to clear the cleanup flag (call after successful auth)
export function clearCleanupFlag() {
  sessionStorage.removeItem('sw-cleanup-done');
}
