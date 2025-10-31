import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DashboardRouter from '../components/pages/DashboardRouter';

const HomePage = lazy(() => import('../components/HomePageNew'));
const AuthPage = lazy(() => import('../components/Auth'));
const ExplorePage = lazy(() => import('../components/pages/ExplorePage'));

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
      onCreatorSelect={(creatorId: string) => navigate(`/creator/${creatorId}`)}
      onStartVideoCall={(creatorId: string) => navigate(`/call/video/${creatorId}`)}
      onStartVoiceCall={(creatorId: string) => navigate(`/call/voice/${creatorId}`)}
      onScheduleSession={(creatorId: string) => navigate(`/schedule/${creatorId}`)}
      onTipCreator={(creatorId: string) => navigate(`/tip/${creatorId}`)}
      onSendMessage={(creatorId: string) => navigate(`/messages/${creatorId}`)}
      onMakeOffer={(creatorId: string) => navigate(`/offer/${creatorId}`)}
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
              <Placeholder title="Messages" />
            </Private>
          }
        />
        <Route
          path="/wallet"
          element={
            <Private>
              <Placeholder title="Wallet" />
            </Private>
          }
        />
        <Route
          path="/profile"
          element={
            <Private>
              <Placeholder title="Profile" />
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

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
