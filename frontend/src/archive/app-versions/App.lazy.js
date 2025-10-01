/**
 * Optimized App with lazy loading and code splitting
 * @module App.lazy
 */

import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useApp } from './hooks/useApp';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ErrorBoundary from './components/ui/ErrorBoundary';

// Eagerly load critical components
import MainNavigation from './components/MainNavigation';
import Auth from './components/Auth';

// Lazy load all page components
const HomePage = lazy(() => import('./components/HomePage'));
const ProfilePage = lazy(() => import('./components/pages/ProfilePage'));
const ExplorePage = lazy(() => import('./components/pages/ExplorePage'));
const DashboardPage = lazy(() => import('./components/pages/DashboardPage'));
const WalletPage = lazy(() => import('./components/pages/WalletPage'));
const ClassesPage = lazy(() => import('./components/pages/ClassesPage'));
const TVPage = lazy(() => import('./components/pages/TVPage'));
const SchedulePage = lazy(() => import('./components/pages/SchedulePage'));
const CallsPage = lazy(() => import('./components/pages/CallsPage'));
const RatesPage = lazy(() => import('./components/pages/RatesPage'));

// Lazy load heavy feature components
const VideoCallRefactored = lazy(() => import('./components/video-call/VideoCallRefactored'));
const StreamingLayoutRefactored = lazy(() => import('./components/streaming/StreamingLayoutRefactored'));
const ConnectPageRefactored = lazy(() => import('./components/connect/ConnectPageRefactored'));

// Lazy load creator components
const CreatorPublicProfile = lazy(() => import('./components/CreatorPublicProfile'));
const CreatorPayoutDashboard = lazy(() => import('./components/CreatorPayoutDashboard'));
const ContentManagement = lazy(() => import('./components/ContentManagement'));
const CreatorAnalytics = lazy(() => import('./components/CreatorAnalytics'));

// Lazy load modals
const TokenPurchase = lazy(() => import('./components/TokenPurchase'));
const Settings = lazy(() => import('./components/Settings'));
const NotificationCenter = lazy(() => import('./components/NotificationCenter'));

/**
 * Loading fallback component
 */
const PageLoader = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <LoadingSpinner size="large" />
      <p className="mt-4 text-gray-400">Loading...</p>
    </div>
  </div>
);

/**
 * Route with loading state
 */
const LazyRoute = ({ component: Component, ...props }) => (
  <Suspense fallback={<PageLoader />}>
    <Component {...props} />
  </Suspense>
);

/**
 * Optimized App component with code splitting
 */
function AppLazy() {
  const { state, dispatch } = useApp();
  const { user, isAuthenticated, theme } = state;
  const [showAuth, setShowAuth] = useState(false);
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Preload critical routes
  useEffect(() => {
    // Preload common routes after initial render
    const preloadTimer = setTimeout(() => {
      if (isAuthenticated) {
        import('./components/pages/DashboardPage');
        import('./components/pages/ExplorePage');
      }
    }, 2000);

    return () => clearTimeout(preloadTimer);
  }, [isAuthenticated]);

  // Preload on hover
  const handleRouteHover = (componentPath) => {
    import(componentPath);
  };

  return (
    <ErrorBoundary>
      <Router>
        <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
          {/* Navigation - Always loaded */}
          {isAuthenticated && (
            <MainNavigation
              user={user}
              onAuthClick={() => setShowAuth(true)}
              onTokenPurchase={() => setShowTokenPurchase(true)}
              onSettings={() => setShowSettings(true)}
              onRouteHover={handleRouteHover}
            />
          )}

          {/* Routes with lazy loading */}
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LazyRoute component={HomePage} />} />
            <Route path="/explore" element={<LazyRoute component={ExplorePage} />} />
            <Route path="/tv" element={<LazyRoute component={TVPage} />} />
            
            {/* Auth required routes */}
            <Route
              path="/dashboard"
              element={
                isAuthenticated ? (
                  <LazyRoute component={DashboardPage} user={user} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/profile/:username?"
              element={<LazyRoute component={ProfilePage} user={user} />}
            />
            <Route
              path="/wallet"
              element={
                isAuthenticated ? (
                  <LazyRoute component={WalletPage} user={user} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/classes"
              element={<LazyRoute component={ClassesPage} user={user} />}
            />
            <Route
              path="/connect"
              element={<LazyRoute component={ConnectPageRefactored} user={user} />}
            />
            <Route
              path="/schedule"
              element={
                isAuthenticated ? (
                  <LazyRoute component={SchedulePage} user={user} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/calls"
              element={
                isAuthenticated ? (
                  <LazyRoute component={CallsPage} user={user} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/rates"
              element={
                isAuthenticated ? (
                  <LazyRoute component={RatesPage} user={user} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />

            {/* Creator routes */}
            <Route
              path="/creator/dashboard"
              element={
                isAuthenticated && user?.is_creator ? (
                  <LazyRoute component={EnhancedCreatorDashboard} user={user} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/creator/content"
              element={
                isAuthenticated && user?.is_creator ? (
                  <LazyRoute component={ContentManagement} user={user} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/creator/analytics"
              element={
                isAuthenticated && user?.is_creator ? (
                  <LazyRoute component={CreatorAnalytics} user={user} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/creator/payouts"
              element={
                isAuthenticated && user?.is_creator ? (
                  <LazyRoute component={CreatorPayoutDashboard} user={user} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/c/:username"
              element={<LazyRoute component={CreatorPublicProfile} />}
            />

            {/* Video/Stream routes */}
            <Route
              path="/call/:channelId"
              element={
                isAuthenticated ? (
                  <LazyRoute component={VideoCallRefactored} user={user} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/stream/:streamId"
              element={<LazyRoute component={StreamingLayoutRefactored} user={user} />}
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>

          {/* Lazy loaded modals */}
          {showAuth && (
            <Suspense fallback={<LoadingSpinner />}>
              <Auth onClose={() => setShowAuth(false)} />
            </Suspense>
          )}

          {showTokenPurchase && isAuthenticated && (
            <Suspense fallback={<LoadingSpinner />}>
              <TokenPurchase
                user={user}
                onClose={() => setShowTokenPurchase(false)}
              />
            </Suspense>
          )}

          {showSettings && isAuthenticated && (
            <Suspense fallback={<LoadingSpinner />}>
              <Settings
                user={user}
                onClose={() => setShowSettings(false)}
              />
            </Suspense>
          )}

          {/* Notifications - lazy loaded when user is authenticated */}
          {isAuthenticated && (
            <Suspense fallback={null}>
              <NotificationCenter user={user} />
            </Suspense>
          )}

          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: theme === 'dark' ? '#1f2937' : '#fff',
                color: theme === 'dark' ? '#fff' : '#111827',
              },
            }}
          />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default AppLazy;