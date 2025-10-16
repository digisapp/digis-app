/**
 * Lazy Component Retry Utility
 * Retries failed lazy component imports (useful for flaky networks or SW issues)
 */

/**
 * Wraps a lazy import with automatic retry logic
 * @param {Function} importer - The import function (e.g., () => import('./Component'))
 * @param {number} retries - Number of retries (default: 2)
 * @returns {Promise} - Promise that resolves to the module
 */
export const lazyRetry = (importer, retries = 2) => {
  return new Promise((resolve, reject) => {
    importer()
      .then(resolve)
      .catch((error) => {
        console.warn('[Lazy Retry] Chunk load failed, retries left:', retries, error.message);

        if (retries <= 0) {
          console.error('[Lazy Retry] All retries exhausted, chunk load failed permanently');
          return reject(error);
        }

        // Retry after a short delay
        setTimeout(() => {
          lazyRetry(importer, retries - 1)
            .then(resolve)
            .catch(reject);
        }, 500);
      });
  });
};

/**
 * Usage example:
 *
 * const WalletPage = React.lazy(() => lazyRetry(() => import('./pages/WalletPage')));
 * const ProfilePage = React.lazy(() => lazyRetry(() => import('./pages/ProfilePage')));
 */
