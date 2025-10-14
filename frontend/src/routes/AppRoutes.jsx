import React, { Suspense, lazy, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';
import { useModal, MODALS } from '../contexts/ModalContext';
import ProtectedRoute from '../components/ProtectedRoute';
import RouteErrorBoundary from '../components/ui/RouteErrorBoundary';
import { RouteFallback, MobileRouteFallback } from '../components/ui/RouteFallback';
import DebugHUD from '../components/ui/DebugHUD';
import useRouteObservability from '../hooks/useRouteMonitoring';
import { defaultPathFor, isRoleReady } from '../utils/routeHelpers';
import toast from 'react-hot-toast';

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
  const { currentUser, isCreator, isAdmin, tokenBalance, roleResolved, role, roleHint } = useAuth();
  const { isMobile } = useDevice();
  const { open: openModal, close: closeModal } = useModal();
  const location = useLocation();
  const navigate = useNavigate();

  // Route observability - tracks navigation performance and errors
  useRouteObservability();

  // Handlers for HomePage sign in/up buttons
  const handleSignIn = useCallback(() => {
    if (isMobile) {
      // Mobile users will be redirected to MobileLandingPage
      navigate('/', { replace: true });
    } else {
      // Desktop: Open auth modal (if we add one) or navigate to auth page
      // For now, let's just show a toast - you can add a proper auth modal later
      toast('Please sign in through the auth page');
      // TODO: Add SIGN_IN modal to MODALS and open it here
    }
  }, [isMobile, navigate]);

  const handleSignUp = useCallback(() => {
    if (isMobile) {
      // Mobile users will be redirected to MobileLandingPage
      navigate('/', { replace: true });
    } else {
      // Desktop: Open auth modal (if we add one) or navigate to auth page
      toast('Please sign up through the auth page');
      // TODO: Add SIGN_UP modal to MODALS and open it here
    }
  }, [isMobile, navigate]);

  // Unified Go Live handler for mobile creators
  const handleShowGoLive = useCallback(() => {
    console.log('🎬 AppRoutes: Opening Go Live setup for mobile');
    if (isMobile) {
      console.log('📱 Mobile detected - opening mobile live stream modal');
      openModal(MODALS.MOBILE_LIVE_STREAM, {
        onGoLive: (config) => {
          console.log('🔴 Starting mobile stream with config:', config);
          navigate('/streaming');
          toast.success('Going live! 🎉');
        }
      });
    } else {
      console.log('🖥️ Desktop detected - opening desktop go live setup modal');
      openModal(MODALS.GO_LIVE_SETUP, {
        onGoLive: (config) => {
          console.log('🔴 Starting desktop stream with config:', config);
          navigate('/streaming');
          toast.success('Going live! 🎉');
        }
      });
    }
  }, [isMobile, openModal, navigate]);

  // Loading fallback - branded for consistency
  const LoadingFallback = isMobile ? <MobileRouteFallback /> : <RouteFallback />;

  return (
    <RouteErrorBoundary>
      {/* Debug HUD - shows when ?debug=1 is in URL */}
      <DebugHUD />

      <Suspense fallback={LoadingFallback}>
        <Routes>
        {/* Public Routes */}
        <Route path="/" element={
          currentUser ? (
            // Fast routing: Use roleHint for immediate redirect, fallback to roleResolved
            (roleResolved || roleHint) ? (
              <Navigate to={defaultPathFor(role || roleHint)} replace />
            ) : (
              // Small placeholder while waiting for role resolution (not a spinner)
              <RouteFallback />
            )
          ) : (
            <HomePage onSignIn={handleSignIn} onSignUp={handleSignUp} />
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
            {isMobile ? <MobileExplore user={currentUser} /> : <ExplorePage user={currentUser} currentUserId={currentUser?.id} tokenBalance={tokenBalance} />}
          </ProtectedRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            {isMobile ? (
              isCreator ? (
                <MobileDashboard
                  user={currentUser}
                  tokenBalance={tokenBalance}
                  onShowGoLive={handleShowGoLive}
                  onNavigate={(view) => navigate(`/${view}`)}
                />
              ) : (
                <MobileFanDashboard
                  user={currentUser}
                  tokenBalance={tokenBalance}
                />
              )
            ) : (
              <DashboardRouter user={currentUser} isCreator={isCreator} isAdmin={isAdmin} roleResolved={roleResolved} tokenBalance={tokenBalance} />
            )}
          </ProtectedRoute>
        } />

        <Route path="/messages" element={
          <ProtectedRoute>
            {isMobile ? <MobileMessages user={currentUser} isCreator={isCreator} /> : <MessagesPage user={currentUser} isCreator={isCreator} />}
          </ProtectedRoute>
        } />

        <Route path="/wallet" element={
          <ProtectedRoute>
            {isMobile ? <MobileWallet user={currentUser} tokenBalance={tokenBalance} /> : <WalletPage user={currentUser} tokenBalance={tokenBalance} isCreator={isCreator} isAdmin={isAdmin} />}
          </ProtectedRoute>
        } />

        <Route path="/call-requests" element={
          <ProtectedRoute requireCreator>
            {isMobile ? <MobileCalls user={currentUser} /> : <CallRequestsPage user={currentUser} />}
          </ProtectedRoute>
        } />

        <Route path="/schedule" element={
          <ProtectedRoute>
            {isMobile ? <MobileSchedule user={currentUser} /> : <SchedulePage user={currentUser} isCreator={isCreator} />}
          </ProtectedRoute>
        } />

        <Route path="/analytics" element={
          <ProtectedRoute requireCreator>
            {isMobile ? <MobileAnalytics user={currentUser} /> : <AnalyticsDashboard user={currentUser} />}
          </ProtectedRoute>
        } />

        <Route path="/content" element={
          <ProtectedRoute requireCreator>
            {isMobile ? <MobileContent user={currentUser} /> : <DashboardRouter user={currentUser} isCreator={isCreator} isAdmin={isAdmin} roleResolved={roleResolved} tokenBalance={tokenBalance} />}
          </ProtectedRoute>
        } />

        <Route path="/tv" element={
          <ProtectedRoute>
            <TVPage user={currentUser} />
          </ProtectedRoute>
        } />

        <Route path="/classes" element={
          <ProtectedRoute>
            <ClassesPage user={currentUser} />
          </ProtectedRoute>
        } />

        <Route path="/shop" element={
          <ProtectedRoute>
            <ShopPage user={currentUser} />
          </ProtectedRoute>
        } />

        <Route path="/collections" element={
          <ProtectedRoute>
            <CollectionsPage user={currentUser} />
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
            <ImprovedProfile user={currentUser} isCreator={isCreator} />
          </ProtectedRoute>
        } />

        <Route path="/settings" element={
          <ProtectedRoute>
            {isMobile ? <MobileSettingsPage user={currentUser} /> : <Settings user={currentUser} />}
          </ProtectedRoute>
        } />

        <Route path="/followers" element={
          <ProtectedRoute requireCreator>
            <FollowersSubscribersPage user={currentUser} isCreator={isCreator} initialTab="followers" />
          </ProtectedRoute>
        } />

        <Route path="/subscribers" element={
          <ProtectedRoute requireCreator>
            <FollowersSubscribersPage user={currentUser} isCreator={isCreator} initialTab="subscribers" />
          </ProtectedRoute>
        } />

        {/* Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute requireAdmin>
            <EnhancedAdminDashboard user={currentUser} />
          </ProtectedRoute>
        } />

        {/* Call Routes */}
        <Route path="/call/video" element={
          <ProtectedRoute>
            <VideoCall user={currentUser} audioOnly={false} />
          </ProtectedRoute>
        } />

        <Route path="/call/voice" element={
          <ProtectedRoute>
            <VideoCall user={currentUser} audioOnly={true} />
          </ProtectedRoute>
        } />

        {/* Streaming Routes */}
        <Route path="/streaming" element={
          <ProtectedRoute>
            {isCreator ? <StreamingDashboard user={currentUser} /> : <StreamingLayout user={currentUser} />}
          </ProtectedRoute>
        } />

        <Route path="/stream/:username" element={
          <ProtectedRoute>
            <StreamingLayout user={currentUser} />
          </ProtectedRoute>
        } />

        {/* Phase 3: Final 5 routes */}
        <Route path="/history" element={
          <ProtectedRoute requireCreator>
            <SessionHistory user={currentUser} />
          </ProtectedRoute>
        } />

        <Route path="/following" element={<FollowingSystem user={currentUser} />} />

        <Route path="/shop-management" element={
          <ProtectedRoute requireCreator>
            <ShopManagementPage user={currentUser} />
          </ProtectedRoute>
        } />

        <Route path="/kyc" element={
          <ProtectedRoute>
            <CreatorKYCVerification user={currentUser} />
          </ProtectedRoute>
        } />

        <Route path="/supabase-test" element={<SupabaseTestPage user={currentUser} />} />

        {/* Direct Username Routes (must be last before catch-all) */}
        <Route path="/:username" element={
          isMobile ? (
            <MobileCreatorProfile user={currentUser} />
          ) : (
            <CreatorPublicProfileEnhanced user={currentUser} />
          )
        } />

        {/* 404 Not Found */}
        <Route path="/404" element={<NotFound />} />

        {/* Catch-all - Redirect to appropriate home */}
        <Route path="*" element={
          currentUser ? (
            // Fast routing: Use roleHint for immediate redirect, fallback to roleResolved
            (roleResolved || roleHint) ? (
              <Navigate to={defaultPathFor(role || roleHint)} replace />
            ) : (
              <RouteFallback />
            )
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
