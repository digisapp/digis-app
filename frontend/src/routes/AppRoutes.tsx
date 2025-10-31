/**
 * AppRoutes - Simple, boring routing that works every day
 *
 * No complex guards, no abstractions, just inline checks.
 * location.pathname is the single source of truth.
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import RouteErrorBoundary from '../components/ui/RouteErrorBoundary';
import { RouteFallback } from '../components/ui/RouteFallback';

// Critical imports - NOT lazy loaded
import HomePage from '../components/HomePageNew';
import Auth from '../components/Auth';

// Lazy-loaded pages
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
const AdminDashboard = lazy(() => import('../components/EnhancedAdminDashboard'));
const ImprovedProfile = lazy(() => import('../components/ImprovedProfile'));
const Settings = lazy(() => import('../components/Settings'));
const VideoCall = lazy(() => import('../components/VideoCall'));
const StreamingLayout = lazy(() => import('../components/StreamingLayout'));
const StreamingDashboard = lazy(() => import('../components/StreamingDashboard'));
const CreatorPublicProfile = lazy(() => import('../components/CreatorPublicProfileEnhanced'));
const PublicCreatorShop = lazy(() => import('../components/PublicCreatorShop'));
const TermsOfService = lazy(() => import('../components/pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('../components/pages/PrivacyPolicy'));
const FollowersSubscribersPage = lazy(() => import('../components/pages/FollowersSubscribersPage'));
const SessionHistory = lazy(() => import('../components/pages/SessionHistory'));
const FollowingSystem = lazy(() => import('../components/FollowingSystem'));
const ShopManagementPage = lazy(() => import('../components/pages/ShopManagementPage'));
const CreatorKYCVerification = lazy(() => import('../components/CreatorKYCVerification'));
const CreatorPending = lazy(() => import('../components/pages/CreatorPending'));
const NotFound = lazy(() => import('./NotFound'));

const AppRoutes = () => {
  const { user, isCreator, isAdmin, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect authenticated users away from /auth
  React.useEffect(() => {
    if (user && location.pathname === '/auth') {
      const defaultPath = isAdmin ? '/admin/dashboard' : isCreator ? '/dashboard' : '/explore';
      navigate(defaultPath, { replace: true });
    }
  }, [user, isAdmin, isCreator, location.pathname, navigate]);

  // Show loading while checking auth
  if (loading) {
    return <RouteFallback />;
  }

  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />

          {/* Public creator profiles */}
          <Route path="/:username" element={<CreatorPublicProfile />} />
          <Route path="/:username/shop" element={<PublicCreatorShop />} />

          {/* Public stream watch */}
          <Route path="/stream/:username" element={<StreamingLayout />} />

          {/* Protected Routes - Inline guards */}
          <Route
            path="/explore"
            element={user ? <ExplorePage /> : <Navigate to="/auth?mode=signin" replace />}
          />

          <Route
            path="/dashboard"
            element={user ? <DashboardRouter /> : <Navigate to="/auth?mode=signin" replace />}
          />

          <Route
            path="/messages"
            element={user ? <MessagesPage /> : <Navigate to="/auth?mode=signin" replace />}
          />

          <Route
            path="/wallet"
            element={user ? <WalletPage /> : <Navigate to="/auth?mode=signin" replace />}
          />

          <Route
            path="/schedule"
            element={user ? <SchedulePage /> : <Navigate to="/auth?mode=signin" replace />}
          />

          <Route
            path="/tv"
            element={user ? <TVPage /> : <Navigate to="/auth?mode=signin" replace />}
          />

          <Route
            path="/classes"
            element={user ? <ClassesPage /> : <Navigate to="/auth?mode=signin" replace />}
          />

          <Route
            path="/shop"
            element={user ? <ShopPage /> : <Navigate to="/auth?mode=signin" replace />}
          />

          <Route
            path="/collections"
            element={user ? <CollectionsPage /> : <Navigate to="/auth?mode=signin" replace />}
          />

          <Route
            path="/profile"
            element={user ? <ImprovedProfile /> : <Navigate to="/auth?mode=signin" replace />}
          />

          <Route
            path="/settings"
            element={user ? <Settings /> : <Navigate to="/auth?mode=signin" replace />}
          />

          <Route
            path="/following"
            element={user ? <FollowingSystem /> : <Navigate to="/auth?mode=signin" replace />}
          />

          <Route
            path="/kyc"
            element={user ? <CreatorKYCVerification /> : <Navigate to="/auth?mode=signin" replace />}
          />

          {/* Creator-only routes */}
          <Route
            path="/call-requests"
            element={
              user && isCreator ? (
                <CallRequestsPage />
              ) : (
                <Navigate to={user ? '/explore' : '/auth?mode=signin'} replace />
              )
            }
          />

          <Route
            path="/analytics"
            element={
              user && isCreator ? (
                <AnalyticsDashboard />
              ) : (
                <Navigate to={user ? '/explore' : '/auth?mode=signin'} replace />
              )
            }
          />

          <Route
            path="/followers"
            element={
              user && isCreator ? (
                <FollowersSubscribersPage initialTab="followers" />
              ) : (
                <Navigate to={user ? '/explore' : '/auth?mode=signin'} replace />
              )
            }
          />

          <Route
            path="/subscribers"
            element={
              user && isCreator ? (
                <FollowersSubscribersPage initialTab="subscribers" />
              ) : (
                <Navigate to={user ? '/explore' : '/auth?mode=signin'} replace />
              )
            }
          />

          <Route
            path="/history"
            element={
              user && isCreator ? (
                <SessionHistory />
              ) : (
                <Navigate to={user ? '/explore' : '/auth?mode=signin'} replace />
              )
            }
          />

          <Route
            path="/shop-management"
            element={
              user && isCreator ? (
                <ShopManagementPage />
              ) : (
                <Navigate to={user ? '/explore' : '/auth?mode=signin'} replace />
              )
            }
          />

          <Route
            path="/streaming"
            element={
              user ? (
                isCreator ? <StreamingDashboard /> : <StreamingLayout />
              ) : (
                <Navigate to="/auth?mode=signin" replace />
              )
            }
          />

          {/* Creator pending */}
          <Route
            path="/creator/pending"
            element={user ? <CreatorPending /> : <Navigate to="/auth?mode=signin" replace />}
          />

          {/* Call routes */}
          <Route
            path="/call/video"
            element={user ? <VideoCall isVoiceOnly={false} /> : <Navigate to="/auth?mode=signin" replace />}
          />

          <Route
            path="/call/voice"
            element={user ? <VideoCall isVoiceOnly={true} /> : <Navigate to="/auth?mode=signin" replace />}
          />

          {/* Admin routes */}
          <Route
            path="/admin/dashboard"
            element={
              user && isAdmin ? <AdminDashboard /> : <Navigate to={user ? '/explore' : '/auth?mode=signin'} replace />
            }
          />

          <Route
            path="/admin/login"
            element={user && isAdmin ? <Navigate to="/admin/dashboard" replace /> : <Auth />}
          />

          {/* 404 */}
          <Route path="/404" element={<NotFound />} />

          {/* Catch-all */}
          <Route
            path="*"
            element={
              <Navigate
                to={user ? (isAdmin ? '/admin/dashboard' : isCreator ? '/dashboard' : '/explore') : '/'}
                replace
              />
            }
          />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
};

export default AppRoutes;
