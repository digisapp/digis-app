import React, { Suspense, lazy } from 'react';
import { useModal, MODALS } from '../../contexts/ModalContext';
import ErrorBoundary from '../ui/ErrorBoundary';

// Lazy load modal components
const ImprovedTokenPurchase = lazy(() => import('../ImprovedTokenPurchase'));
const MobileTokenPurchase = lazy(() => import('../mobile/MobileTokenPurchase'));
const EnhancedCreatorDiscovery = lazy(() => import('../EnhancedCreatorDiscovery'));
const PrivacySettings = lazy(() => import('../PrivacySettings'));
const CreatorApplication = lazy(() => import('../CreatorApplication'));
const GoLiveSetup = lazy(() => import('../GoLiveSetup'));
const EnhancedMobileLiveStream = lazy(() => import('../mobile/EnhancedMobileLiveStream'));
const TipModal = lazy(() => import('../TipModal'));
const EnhancedSchedule = lazy(() => import('../EnhancedSchedule'));
const FanEngagement = lazy(() => import('../FanEngagement'));

// Simple loading spinner for modal suspense boundaries
const ModalLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
    <div style={{
      width: '24px',
      height: '24px',
      border: '3px solid rgba(147, 51, 234, 0.3)',
      borderTop: '3px solid rgb(147, 51, 234)',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
  </div>
);

/**
 * Modals - Centralized modal rendering
 *
 * Renders all modals based on ModalContext state.
 * Each modal is lazy-loaded and wrapped in ErrorBoundary.
 */
const Modals = ({ user, tokenBalance, onTokenUpdate, onNavigate }) => {
  const { isOpen, getProps, close } = useModal();

  return (
    <>
      {/* Token Purchase Modal */}
      {isOpen(MODALS.TOKEN_PURCHASE) && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              close(MODALS.TOKEN_PURCHASE);
            }
          }}
        >
          <ErrorBoundary variant="compact">
            <Suspense fallback={<div className="text-white">Loading...</div>}>
              <ImprovedTokenPurchase
                user={user}
                onSuccess={(tokensAdded) => {
                  const props = getProps(MODALS.TOKEN_PURCHASE);
                  props.onSuccess?.(tokensAdded);
                  close(MODALS.TOKEN_PURCHASE);
                }}
                onClose={() => close(MODALS.TOKEN_PURCHASE)}
                isModal={true}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {/* Mobile Token Purchase Modal */}
      {isOpen(MODALS.MOBILE_TOKEN_PURCHASE) && (
        <Suspense fallback={<ModalLoader />}>
          <MobileTokenPurchase
            isOpen={true}
            onClose={() => close(MODALS.MOBILE_TOKEN_PURCHASE)}
            user={user}
            onPurchaseSuccess={(tokensAdded) => {
              const props = getProps(MODALS.MOBILE_TOKEN_PURCHASE);
              props.onPurchaseSuccess?.(tokensAdded);
              close(MODALS.MOBILE_TOKEN_PURCHASE);
            }}
          />
        </Suspense>
      )}

      {/* Enhanced Creator Discovery Modal */}
      {isOpen(MODALS.CREATOR_DISCOVERY) && (
        <Suspense fallback={<ModalLoader />}>
          <EnhancedCreatorDiscovery
            user={user}
            onClose={() => close(MODALS.CREATOR_DISCOVERY)}
          />
        </Suspense>
      )}

      {/* Privacy Settings Modal */}
      {isOpen(MODALS.PRIVACY_SETTINGS) && (
        <Suspense fallback={<ModalLoader />}>
          <PrivacySettings
            user={user}
            onClose={() => close(MODALS.PRIVACY_SETTINGS)}
          />
        </Suspense>
      )}

      {/* Creator Application Modal */}
      {isOpen(MODALS.CREATOR_APPLICATION) && (
        <Suspense fallback={<ModalLoader />}>
          <CreatorApplication
            onClose={() => close(MODALS.CREATOR_APPLICATION)}
            onSuccess={() => {
              const props = getProps(MODALS.CREATOR_APPLICATION);
              props.onSuccess?.();
              close(MODALS.CREATOR_APPLICATION);
            }}
          />
        </Suspense>
      )}

      {/* Go Live Setup Modal - Desktop only */}
      {isOpen(MODALS.GO_LIVE_SETUP) && (
        <Suspense fallback={<ModalLoader />}>
          <GoLiveSetup
            user={user}
            onCancel={() => {
              console.log('GoLiveSetup cancelled');
              close(MODALS.GO_LIVE_SETUP);
            }}
            onGoLive={(config) => {
              const props = getProps(MODALS.GO_LIVE_SETUP);
              props.onGoLive?.(config);
              close(MODALS.GO_LIVE_SETUP);
            }}
          />
        </Suspense>
      )}

      {/* Enhanced Mobile Live Stream */}
      {isOpen(MODALS.MOBILE_LIVE_STREAM) && (
        <Suspense fallback={<ModalLoader />}>
          <div data-golive-modal="true">
            <EnhancedMobileLiveStream
              user={user}
              onEnd={() => {
                console.log('Mobile stream ended');
                close(MODALS.MOBILE_LIVE_STREAM);
              }}
              streamConfig={getProps(MODALS.MOBILE_LIVE_STREAM).streamConfig}
              channel={getProps(MODALS.MOBILE_LIVE_STREAM).channel || `stream_${user?.id}_${Date.now()}`}
              isCreator={getProps(MODALS.MOBILE_LIVE_STREAM).isCreator !== undefined ?
                getProps(MODALS.MOBILE_LIVE_STREAM).isCreator : true}
            />
          </div>
        </Suspense>
      )}

      {/* Tip Modal */}
      {isOpen(MODALS.TOKEN_TIPPING) && (
        <Suspense fallback={<ModalLoader />}>
          <TipModal
            isOpen={true}
            onClose={() => close(MODALS.TOKEN_TIPPING)}
            creator={getProps(MODALS.TOKEN_TIPPING).creator}
            tokenBalance={tokenBalance}
            onTipSent={() => {
              const props = getProps(MODALS.TOKEN_TIPPING);
              props.onTipSent?.();
              close(MODALS.TOKEN_TIPPING);
            }}
          />
        </Suspense>
      )}

      {/* Availability Calendar Modal */}
      {isOpen(MODALS.AVAILABILITY_CALENDAR) && (
        <Suspense fallback={<ModalLoader />}>
          <EnhancedSchedule
            user={user}
            onClose={() => close(MODALS.AVAILABILITY_CALENDAR)}
          />
        </Suspense>
      )}

      {/* Fan Engagement Modal */}
      {isOpen(MODALS.FAN_ENGAGEMENT) && (
        <Suspense fallback={<ModalLoader />}>
          <FanEngagement
            user={user}
            tokenBalance={tokenBalance}
            onCreatorSelect={(creator) => {
              const props = getProps(MODALS.FAN_ENGAGEMENT);
              props.onCreatorSelect?.(creator);
            }}
            onClose={() => close(MODALS.FAN_ENGAGEMENT)}
          />
        </Suspense>
      )}
    </>
  );
};

export default Modals;
