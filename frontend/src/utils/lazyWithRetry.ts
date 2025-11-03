/**
 * Lazy load component with automatic retry on chunk load failure
 *
 * This handles the "Failed to fetch dynamically imported module" error
 * that occurs when users have old cached HTML but new JS chunks are deployed
 *
 * @param componentImport - The dynamic import function
 * @param retries - Number of retry attempts (default: 3)
 * @returns Lazy-loaded component
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retries = 3
) {
  return React.lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      // If chunk loading fails and we haven't force refreshed yet, do it now
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        console.log('🔄 Chunk load failed, reloading page to fetch new assets...');
        window.location.reload();
        // Return a never-resolving promise to prevent further execution
        return new Promise(() => {});
      }

      // If we already tried refreshing, try retrying the import
      if (retries > 0) {
        console.log(`⚠️ Chunk load failed, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        return lazyWithRetry(componentImport, retries - 1);
      }

      // If all retries failed, throw the error
      console.error('❌ Failed to load component after retries:', error);
      throw error;
    }
  });
}

// Import React at the top
import React from 'react';
