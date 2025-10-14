import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HybridCreatorDashboard from '../HybridCreatorDashboard';
import MobileCreatorDashboard from '../mobile/MobileCreatorDashboard';
import MobileFanDashboard from '../mobile/MobileFanDashboard';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BREAKPOINTS } from '../../constants/breakpoints';

/**
 * DashboardRouter - Smart routing component for user dashboards
 *
 * Routes users to appropriate dashboard based on role:
 * - Creators (Desktop) → HybridCreatorDashboard
 * - Creators (Mobile) → MobileCreatorDashboard
 * - Fans → Redirects to /explore
 *
 * This is NOT a UI component - it's a routing decision layer.
 */
const DashboardRouter = ({
  user,
  isCreator,
  isAdmin,
  tokenBalance,
  sessionStats,
  roleResolved,  // NEW: Add roleResolved prop
  onShowAvailability,
  onShowGoLive,
  onCreatorSelect,
  onTipCreator,
  onStartVideoCall,
  onStartVoiceCall,
  onShowEarnings,
  onShowOffers,
  onShowSettings,
  onShowExperiences,
  onNavigate,
  contentData,
  onContentUpdate
}) => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery(BREAKPOINTS.MOBILE_QUERY);

  // Debug logging
  console.log('🔀 DashboardRouter - isCreator:', isCreator, 'roleResolved:', roleResolved, 'user:', user?.email, 'isMobile:', isMobile);

  // SINGLE SOURCE OF TRUTH: Use isCreator prop from AuthContext only
  // No fallback to user.is_creator, user.role, or localStorage
  if (isCreator) {
    console.log('✅ Creator status confirmed from AuthContext - showing creator dashboard');

    // For mobile creators, show the MobileCreatorDashboard
    if (isMobile) {
      return (
        <MobileCreatorDashboard
          user={user}
          tokenBalance={tokenBalance}
          onNavigate={onNavigate}
          onShowGoLive={onShowGoLive}
          onShowAvailability={onShowAvailability}
          onShowEarnings={onShowEarnings}
          onShowSettings={onShowSettings}
          onShowContent={() => onNavigate('content')}
          onShowMessages={() => onNavigate('messages')}
        />
      );
    }

    // For desktop creators, show the HybridCreatorDashboard
    return (
      <HybridCreatorDashboard
        user={user}
        contentData={contentData}
        onContentUpdate={onContentUpdate}
        onNavigate={(path) => {
          if (path === '/connect?section=experiences') {
            // Use the onShowExperiences prop which properly navigates
            if (onShowExperiences) {
              onShowExperiences();
            }
          } else if (path === 'calls' || path === 'call-requests') {
            // Navigate to the calls/call-requests page
            if (onNavigate) {
              onNavigate(path);
            }
          } else {
            console.log('Navigate to:', path);
            // Try to navigate using the onNavigate prop for other views
            if (onNavigate) {
              onNavigate(path);
            }
          }
        }}
        onShowGoLive={onShowGoLive}
        onShowAvailability={onShowAvailability}
        onShowEarnings={onShowEarnings}
        onShowOffers={onShowOffers}
        onShowSettings={onShowSettings}
        onShowExperiences={onShowExperiences}
        tokenBalance={tokenBalance}
        sessionStats={sessionStats}
      />
    );
  }

  // Fan Dashboard - Redirect fans to Explore page
  console.log('👤 Fan detected - redirecting to Explore page');

  // Wait for role to be resolved before showing fan dashboard (prevents role-flicker)
  if (!roleResolved) {
    console.log('⏳ Waiting for roleResolved before showing fan content');
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Use React Router navigate for fans
  useEffect(() => {
    if (!isCreator && roleResolved) {
      navigate('/explore', { replace: true });
    }
  }, [isCreator, roleResolved, navigate]);

  // Show mobile fan dashboard while redirecting (only after role is resolved)
  if (isMobile) {
    return (
      <MobileFanDashboard
        user={user}
        tokenBalance={tokenBalance}
        onNavigate={onNavigate}
        onCreatorSelect={onCreatorSelect}
        onTipCreator={onTipCreator}
        onStartVideoCall={onStartVideoCall}
        onStartVoiceCall={onStartVoiceCall}
        onShowTokenPurchase={() => onNavigate('wallet')}
      />
    );
  }

  // For desktop fans, show nothing while redirecting
  return null;
};

export default DashboardRouter;