import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';
import ProtectedRoute from '../components/ProtectedRoute';
import RouteErrorBoundary from '../components/ui/RouteErrorBoundary';
import { RouteFallback, MobileRouteFallback } from '../components/ui/RouteFallback';
import useRouteObservability from '../hooks/useRouteMonitoring';

/**
 * Lazy-loaded pages - moved from App.js
 * Route files own their imports, not App.js
 */
const HomePage = lazy(() => import('../components/HomePage'));
const ExplorePage = lazy(() => import('../components/pages/ExplorePage'));
const DashboardRouter = lazy(() => import('../components/pages/DashboardRouter'));
const MessagesPage = lazy(() => import('../components/pages/MessagesPage'));
const WalletPage = lazy(() => import('../components/pages/WalletPage'));
const CallRequestsPage = lazy(() => import('../components/pages/CallRequestsPage'));
const SchedulePage = lazy(() => import('../components/pages/SchedulePage'));
const AnalyticsDashboard = lazy(() => import('../components/AnalyticsDashboard'));
const TVPage = lazy(() => import('../components/pages/TVPage'));
const ClassesPage = lazy(() => import('../components/pages/ClassesPage'));
const ShopPage = lazy(() => import('../components/pages/ShopPage'));
const CollectionsPage = lazy(() => import('../components/pages/CollectionsPage'));
const EnhancedAdminDashboard = lazy(() => import('../components/EnhancedAdminDashboard'));
const ImprovedProfile = lazy(() => import('../components/ImprovedProfile'));
const Settings = lazy(() => import('../components/Settings'));
const VideoCall = lazy(() => import('../components/VideoCall'));
const StreamingLayout = lazy(() => import('../components/StreamingLayout'));
const StreamingDashboard = lazy(() => import('../components/StreamingDashboard'));
const CreatorPublicProfileEnhanced = lazy(() => import('../components/CreatorPublicProfileEnhanced'));
const PublicCreatorShop = lazy(() => import('../components/PublicCreatorShop'));
const DigitalsPage = lazy(() => import('../components/pages/DigitalsPage'));
const TermsOfService = lazy(() => import('../components/pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('../components/pages/PrivacyPolicy'));
const FollowersSubscribersPage = lazy(() => import('../components/pages/FollowersSubscribersPage'));
const NotFound = lazy(() => import('./NotFound'));

// Phase 3: Final 5 screens
const SessionHistory = lazy(() => import('../components/pages/SessionHistory'));
const FollowingSystem = lazy(() => import('../components/FollowingSystem'));
const ShopManagementPage = lazy(() => import('../components/pages/ShopManagementPage'));
const CreatorKYCVerification = lazy(() => import('../components/CreatorKYCVerification'));
const SupabaseTestPage = lazy(() => import('../components/SupabaseTestPage'));

// Mobile-specific pages
const MobileExplore = lazy(() => import('../components/mobile/MobileExplore'));
const MobileDashboard = lazy(() => import('../components/mobile/MobileCreatorDashboard'));
const MobileFanDashboard = lazy(() => import('../components/mobile/MobileFanDashboard'));
const MobileMessages = lazy(() => import('../components/mobile/MobileMessages'));
const MobileWallet = lazy(() => import('../components/mobile/MobileWallet'));
const MobileCalls = lazy(() => import('../components/mobile/MobileCalls'));
const MobileAnalytics = lazy(() => import('../components/mobile/MobileAnalytics'));
const MobileSchedule = lazy(() => import('../components/mobile/MobileSchedule'));
const MobileContent = lazy(() => import('../components/mobile/MobileContent'));
const MobileSettingsPage = lazy(() => import('../components/mobile/pages/MobileSettingsPage'));
const MobileCreatorProfile = lazy(() => import('../components/mobile/MobileCreatorProfile'));

/**
 * AppRoutes - Single source of truth for routing
 *
 * Replaces:
 * - currentView state in App.js
 * - URL ⇄ view syncing effects
 * - 600+ lines of conditional rendering
 *
 * Routes own their lazy imports (not App.js)
 * location.pathname is the single source of truth
 */
const AppRoutes = () => {
  const { user, profile, isCreator, isAdmin, tokenBalance, roleResolved } = useAuth();
  const { isMobile } = useDevice();
  const location = useLocation();

  // Route observability - tracks navigation performance and errors
  useRouteObservability();

  // Merge user and profile for complete user data
  const mergedUser = user && profile ? { ...user, ...profile } : (user || profile);

  // Loading fallback - branded for consistency
  const LoadingFallback = isMobile ? <MobileRouteFallback /> : <RouteFallback />;

  return (
    <RouteErrorBoundary>
      <Suspense fallback={LoadingFallback}>
        <Routes>
        {/* Public Routes */}
        <Route path="/" element={
          user ? (
            isAdmin ? <Navigate to="/admin" replace /> :
            isCreator ? <Navigate to="/dashboard" replace /> :
            <Navigate to="/explore" replace />
          ) : (
            <HomePage />
          )
        } />

        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        {/* Creator Public Profiles */}
        <Route path="/creator/:username" element={<CreatorPublicProfileEnhanced />} />
        <Route path="/:username/shop" element={<PublicCreatorShop />} />
        <Route path="/:username/digitals" element={<DigitalsPage />} />

        {/* Protected Routes - Require Authentication */}
        <Route path="/explore" element={
          <ProtectedRoute>
            {isMobile ? <MobileExplore user={mergedUser} /> : <ExplorePage user={mergedUser} currentUserId={mergedUser?.id} tokenBalance={tokenBalance} />}
          </ProtectedRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            {isMobile ? (
              isCreator ? <MobileDashboard user={mergedUser} tokenBalance={tokenBalance} /> : <MobileFanDashboard user={mergedUser} tokenBalance={tokenBalance} />
            ) : (
              <DashboardRouter user={mergedUser} isCreator={isCreator} isAdmin={isAdmin} roleResolved={roleResolved} tokenBalance={tokenBalance} />
            )}
          </ProtectedRoute>
        } />

        <Route path="/messages" element={
          <ProtectedRoute>
            {isMobile ? <MobileMessages user={mergedUser} /> : <MessagesPage user={mergedUser} />}
          </ProtectedRoute>
        } />

        <Route path="/wallet" element={
          <ProtectedRoute>
            {isMobile ? <MobileWallet user={mergedUser} tokenBalance={tokenBalance} /> : <WalletPage user={mergedUser} tokenBalance={tokenBalance} />}
          </ProtectedRoute>
        } />

        <Route path="/call-requests" element={
          <ProtectedRoute requireCreator>
            {isMobile ? <MobileCalls user={mergedUser} /> : <CallRequestsPage user={mergedUser} />}
          </ProtectedRoute>
        } />

        <Route path="/schedule" element={
          <ProtectedRoute>
            {isMobile ? <MobileSchedule user={mergedUser} /> : <SchedulePage user={mergedUser} isCreator={isCreator} />}
          </ProtectedRoute>
        } />

        <Route path="/analytics" element={
          <ProtectedRoute requireCreator>
            {isMobile ? <MobileAnalytics user={mergedUser} /> : <AnalyticsDashboard user={mergedUser} />}
          </ProtectedRoute>
        } />

        <Route path="/content" element={
          <ProtectedRoute requireCreator>
            {isMobile ? <MobileContent user={mergedUser} /> : <DashboardRouter user={mergedUser} isCreator={isCreator} isAdmin={isAdmin} roleResolved={roleResolved} tokenBalance={tokenBalance} />}
          </ProtectedRoute>
        } />

        <Route path="/tv" element={
          <ProtectedRoute>
            <TVPage user={mergedUser} />
          </ProtectedRoute>
        } />

        <Route path="/classes" element={
          <ProtectedRoute>
            <ClassesPage user={mergedUser} />
          </ProtectedRoute>
        } />

        <Route path="/shop" element={
          <ProtectedRoute>
            <ShopPage user={mergedUser} />
          </ProtectedRoute>
        } />

        <Route path="/collections" element={
          <ProtectedRoute>
            <CollectionsPage user={mergedUser} />
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
            <ImprovedProfile user={mergedUser} isCreator={isCreator} />
          </ProtectedRoute>
        } />

        <Route path="/settings" element={
          <ProtectedRoute>
            {isMobile ? <MobileSettingsPage user={mergedUser} /> : <Settings user={mergedUser} />}
          </ProtectedRoute>
        } />

        <Route path="/followers" element={
          <ProtectedRoute requireCreator>
            <FollowersSubscribersPage user={mergedUser} isCreator={isCreator} initialTab="followers" />
          </ProtectedRoute>
        } />

        <Route path="/subscribers" element={
          <ProtectedRoute requireCreator>
            <FollowersSubscribersPage user={mergedUser} isCreator={isCreator} initialTab="subscribers" />
          </ProtectedRoute>
        } />

        {/* Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute requireAdmin>
            <EnhancedAdminDashboard user={mergedUser} />
          </ProtectedRoute>
        } />

        {/* Call Routes */}
        <Route path="/call/video" element={
          <ProtectedRoute>
            <VideoCall user={mergedUser} audioOnly={false} />
          </ProtectedRoute>
        } />

        <Route path="/call/voice" element={
          <ProtectedRoute>
            <VideoCall user={mergedUser} audioOnly={true} />
          </ProtectedRoute>
        } />

        {/* Streaming Routes */}
        <Route path="/streaming" element={
          <ProtectedRoute>
            {isCreator ? <StreamingDashboard user={mergedUser} /> : <StreamingLayout user={mergedUser} />}
          </ProtectedRoute>
        } />

        <Route path="/stream/:username" element={
          <ProtectedRoute>
            <StreamingLayout user={mergedUser} />
          </ProtectedRoute>
        } />

        {/* Phase 3: Final 5 routes */}
        <Route path="/history" element={
          <ProtectedRoute requireCreator>
            <SessionHistory user={mergedUser} />
          </ProtectedRoute>
        } />

        <Route path="/following" element={<FollowingSystem user={mergedUser} />} />

        <Route path="/shop-management" element={
          <ProtectedRoute requireCreator>
            <ShopManagementPage user={mergedUser} />
          </ProtectedRoute>
        } />

        <Route path="/kyc" element={
          <ProtectedRoute>
            <CreatorKYCVerification user={mergedUser} />
          </ProtectedRoute>
        } />

        <Route path="/supabase-test" element={<SupabaseTestPage user={mergedUser} />} />

        {/* Direct Username Routes (must be last before catch-all) */}
        <Route path="/:username" element={
          isMobile ? (
            <MobileCreatorProfile user={mergedUser} />
          ) : (
            <CreatorPublicProfileEnhanced user={mergedUser} />
          )
        } />

        {/* 404 Not Found */}
        <Route path="/404" element={<NotFound />} />

        {/* Catch-all - Redirect to appropriate home */}
        <Route path="*" element={
          user ? (
            isAdmin ? <Navigate to="/admin" replace /> :
            isCreator ? <Navigate to="/dashboard" replace /> :
            <Navigate to="/explore" replace />
          ) : (
            <Navigate to="/" replace />
          )
        } />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
};

export default AppRoutes;
