import React, { lazy, Suspense } from 'react';

// Lazy load to avoid circular dependency issues
const ShopManagementPage = lazy(() => import('./ShopManagementPage'));

const ShopPage = ({ user }) => {
  // Use the existing shop management page with lazy loading
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    }>
      <ShopManagementPage user={user} />
    </Suspense>
  );
};

export default ShopPage;