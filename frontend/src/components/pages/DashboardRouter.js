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
  console.log('🔀 DashboardRouter - isCreator:', isCreator, 'user:', user?.email, 'isMobile:', isMobile);

  // Check multiple sources for creator status to be absolutely sure
  const isDefinitelyCreator = isCreator ||
    user?.is_creator === true ||
    user?.role === 'creator' ||
    localStorage.getItem('isCreator') === 'true';

  if (isDefinitelyCreator) {
    console.log('✅ Confirmed creator status - showing creator dashboard');

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

  // Use React Router navigate for fans
  useEffect(() => {
    if (!isDefinitelyCreator) {
      navigate('/explore', { replace: true });
    }
  }, [isDefinitelyCreator, navigate]);

  // Show mobile fan dashboard while redirecting (for smooth transition)
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