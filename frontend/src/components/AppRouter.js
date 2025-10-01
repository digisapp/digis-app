import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import LoadingSpinner from './ui/LoadingSpinner';
import { RESERVED_ROUTES } from '../utils/reservedRoutes';

// Lazy load page components for better performance
const HomePage = lazy(() => import('./HomePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClassesPage = lazy(() => import('./pages/ClassesPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const WalletPage = lazy(() => import('./pages/WalletPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
// const CreatorStudioPage = lazy(() => import('./pages/CreatorStudioPage')); // Removed - using Enhanced Content Gallery
// const CreatorStudioPage = lazy(() => import('./pages/ContentStudioPage')); // Removed - consolidated into dashboard
const TokenPurchasePage = lazy(() => import('./pages/TokenPurchasePage'));
const PrivacySettingsPage = lazy(() => import('./pages/PrivacySettingsPage'));
const CreatorApplicationPage = lazy(() => import('./pages/CreatorApplicationPage'));
const VideoCallPage = lazy(() => import('./pages/VideoCallPage'));
const PublicCreatorProfile = lazy(() => import('./CreatorPublicProfile'));
const CreatorProfilePreview = lazy(() => import('./CreatorProfilePreview'));
const ForceLogin = lazy(() => import('./ForceLogin'));
const AuthCallback = lazy(() => import('./AuthCallback'));

// Component to handle username routes and check if they're reserved
const UsernameRoute = ({ user, ...props }) => {
  const { username } = useParams();
  
  // Check if this is a reserved route
  if (RESERVED_ROUTES.includes(username?.toLowerCase())) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Otherwise, show the creator profile
  return <PublicCreatorProfile user={user} username={username} {...props} />;
};

const AppRouter = ({ user, isCreator, isAdmin, ...props }) => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Homepage */}
        <Route 
          path="/" 
          element={<HomePage user={user} isCreator={isCreator} isAdmin={isAdmin} {...props} />} 
        />
        
        {/* Main Pages */}
        <Route 
          path="/dashboard" 
          element={<DashboardPage user={user} isCreator={isCreator} isAdmin={isAdmin} {...props} />} 
        />
        <Route 
          path="/classes" 
          element={<ClassesPage user={user} isCreator={isCreator} isAdmin={isAdmin} {...props} />} 
        />
        <Route 
          path="/messages" 
          element={<MessagesPage user={user} {...props} />} 
        />
        <Route 
          path="/tokens" 
          element={<TokenPurchasePage user={user} {...props} />} 
        />
        <Route 
          path="/wallet" 
          element={<WalletPage user={user} isCreator={isCreator} {...props} />} 
        />
        <Route 
          path="/profile" 
          element={<ProfilePage user={user} isCreator={isCreator} {...props} />} 
        />

        {/* Creator-only pages */}
        {isCreator && (
          <>
            {/* Creator Studio removed - content management is now in the dashboard */}
            <Route 
              path="/creator-studio" 
              element={<Navigate to="/dashboard" replace />} 
            />
            <Route 
              path="/earnings" 
              element={<Navigate to="/wallet" replace />} 
            />
            <Route 
              path="/settings/privacy" 
              element={<PrivacySettingsPage user={user} {...props} />} 
            />
          </>
        )}

        {/* Public pages */}
        <Route 
          path="/apply" 
          element={<CreatorApplicationPage user={user} {...props} />} 
        />
        
        {/* Creator Profile Preview (for testing) */}
        <Route 
          path="/preview/creator-profile" 
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <CreatorProfilePreview />
            </Suspense>
          } 
        />
        
        {/* Force Login Helper */}
        <Route 
          path="/fix" 
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <ForceLogin />
            </Suspense>
          } 
        />
        
        {/* Auth Callback for OAuth redirects */}
        <Route 
          path="/auth/callback" 
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <AuthCallback />
            </Suspense>
          } 
        />

        {/* Call pages */}
        <Route 
          path="/call/:type/:channel" 
          element={<VideoCallPage user={user} {...props} />} 
        />

        {/* Username profile pages - this must be last to avoid conflicts */}
        <Route 
          path="/:username" 
          element={<UsernameRoute user={user} {...props} />} 
        />

        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;