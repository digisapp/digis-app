import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DashboardRouter from '../components/pages/DashboardRouter';

const HomePage = lazy(() => import('../components/HomePageNew'));
const AuthPage = lazy(() => import('../components/Auth'));
const ExplorePage = lazy(() => import('../components/pages/ExplorePage'));
const CreatorProfile = lazy(() => import('../components/CreatorPublicProfileEnhanced'));
const MessagesPage = lazy(() => import('../components/pages/MessagesPage'));
const WalletPage = lazy(() => import('../components/pages/WalletPage'));
const TVPage = lazy(() => import('../components/pages/TVPage'));
const ClassesPage = lazy(() => import('../components/pages/ClassesPage'));
const ProfilePage = lazy(() => import('../components/pages/ProfilePage'));
const CallRequestsPage = lazy(() => import('../components/pages/CallRequestsPage'));
const SchedulePage = lazy(() => import('../components/pages/SchedulePage'));
const GoLivePage = lazy(() => import('../components/pages/GoLivePage'));
const StreamPage = lazy(() => import('../components/pages/StreamPage'));

function Private({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/auth?mode=signin" replace state={{ from: loc }} />;
  return <>{children}</>;
}

function Dashboard() {
  const { user, isCreator, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <DashboardRouter
      user={user}
      isCreator={isCreator}
      isAdmin={isAdmin}
      tokenBalance={0}
      sessionStats={null}
      roleResolved={true}
      onNavigate={(path: string) => navigate(path)}
      onShowAvailability={() => navigate('/availability')}
      onShowGoLive={() => navigate('/go-live')}
      onCreatorSelect={(creatorId: string) => navigate(`/creator/${creatorId}`)}
      onTipCreator={() => {}}
      onStartVideoCall={() => {}}
      onStartVoiceCall={() => {}}
      onShowEarnings={() => navigate('/earnings')}
      onShowOffers={() => navigate('/offers')}
      onShowSettings={() => navigate('/settings')}
      onShowExperiences={() => navigate('/experiences')}
      contentData={null}
      onContentUpdate={() => {}}
    />
  );
}

function Explore() {
  const navigate = useNavigate();

  return (
    <ExplorePage
      onCreatorSelect={(creator: any) => {
        console.log('🔷 AppRoutes Explore: onCreatorSelect called', {
          creator,
          username: creator?.username,
          display_name: creator?.display_name,
          id: creator?.id
        });
        const username = creator?.username || creator?.display_name || creator?.id;
        console.log('🔷 AppRoutes Explore: Navigating with username:', username);
        if (username) {
          navigate(`/creator/${username}`);
        } else {
          console.error('❌ AppRoutes Explore: No username found for creator');
        }
      }}
      onStartVideoCall={(creator: any) => {
        const username = creator?.username || creator?.id;
        navigate(`/call/video/${username}`);
      }}
      onStartVoiceCall={(creator: any) => {
        const username = creator?.username || creator?.id;
        navigate(`/call/voice/${username}`);
      }}
      onScheduleSession={(creator: any) => {
        const username = creator?.username || creator?.id;
        navigate(`/schedule/${username}`);
      }}
      onTipCreator={(creator: any) => {
        const username = creator?.username || creator?.id;
        navigate(`/tip/${username}`);
      }}
      onSendMessage={(creator: any) => {
        const username = creator?.username || creator?.id;
        navigate(`/messages/${username}`);
      }}
      onMakeOffer={(creator: any) => {
        const username = creator?.username || creator?.id;
        navigate(`/offer/${username}`);
      }}
    />
  );
}

function Messages() {
  const navigate = useNavigate();

  return (
    <MessagesPage
      onStartVideoCall={(participant: any) => {
        const username = participant?.username || participant?.id;
        navigate(`/call/video/${username}`);
      }}
      onStartVoiceCall={(participant: any) => {
        const username = participant?.username || participant?.id;
        navigate(`/call/voice/${username}`);
      }}
    />
  );
}

function Wallet() {
  const { user, isCreator, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <WalletPage
      user={user}
      isCreator={isCreator}
      isAdmin={isAdmin}
      tokenBalance={0}
      onTokenUpdate={() => {}}
      onViewProfile={() => navigate('/profile')}
      onTokenPurchase={() => {}}
      setCurrentView={(view: string) => {}}
    />
  );
}

function TV() {
  const { user, isCreator } = useAuth();
  const navigate = useNavigate();

  return (
    <TVPage
      user={user}
      isCreator={isCreator}
      onJoinStream={(streamId: string) => navigate(`/stream/${streamId}`)}
      onGoLive={() => navigate('/go-live')}
      tokenBalance={0}
      onTokenPurchase={() => navigate('/wallet')}
    />
  );
}

function Classes() {
  const { user, isCreator } = useAuth();

  return (
    <ClassesPage
      user={user}
      isCreator={isCreator}
      tokenBalance={0}
      onTokenUpdate={() => {}}
    />
  );
}

function Profile() {
  const { user, isCreator, signOut } = useAuth();

  return (
    <ProfilePage
      user={user}
      isCreator={isCreator}
      onLogout={async () => {
        await signOut();
        window.location.href = '/auth?mode=signin';
      }}
    />
  );
}

function CallRequests() {
  const { user } = useAuth();

  return (
    <CallRequestsPage
      user={user}
    />
  );
}

function Schedule() {
  const { user, isCreator } = useAuth();

  return (
    <SchedulePage
      user={user}
      isCreator={isCreator}
    />
  );
}

function GoLive() {
  const { user } = useAuth();

  return (
    <GoLivePage
      user={user}
    />
  );
}

function Stream() {
  const { user } = useAuth();

  return (
    <StreamPage
      user={user}
    />
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-4">This page is being refactored to use the new simple auth system.</p>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <Private>
              <Dashboard />
            </Private>
          }
        />
        <Route
          path="/explore"
          element={
            <Private>
              <Explore />
            </Private>
          }
        />
        <Route
          path="/messages"
          element={
            <Private>
              <Messages />
            </Private>
          }
        />
        <Route
          path="/wallet"
          element={
            <Private>
              <Wallet />
            </Private>
          }
        />
        <Route
          path="/tv"
          element={
            <Private>
              <TV />
            </Private>
          }
        />
        <Route
          path="/classes"
          element={
            <Private>
              <Classes />
            </Private>
          }
        />
        <Route
          path="/profile"
          element={
            <Private>
              <Profile />
            </Private>
          }
        />
        <Route
          path="/calls"
          element={
            <Private>
              <CallRequests />
            </Private>
          }
        />
        <Route
          path="/call-requests"
          element={
            <Private>
              <CallRequests />
            </Private>
          }
        />
        <Route
          path="/schedule"
          element={
            <Private>
              <Schedule />
            </Private>
          }
        />
        <Route
          path="/go-live"
          element={
            <Private>
              <GoLive />
            </Private>
          }
        />
        <Route
          path="/stream/:streamId"
          element={
            <Private>
              <Stream />
            </Private>
          }
        />
        <Route
          path="/settings"
          element={
            <Private>
              <Placeholder title="Settings" />
            </Private>
          }
        />

        {/* Creator profile - public but requires auth */}
        <Route
          path="/creator/:username"
          element={
            <Private>
              <CreatorProfile />
            </Private>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
