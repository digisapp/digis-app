import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const HomePage = lazy(() => import('../components/HomePageNew'));
const AuthPage = lazy(() => import('../components/Auth'));

// For now, simplify - just show basic routes that work
// Complex components can be added back later after refactoring to use useAuth() directly
function Private({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/auth?mode=signin" replace state={{ from: loc }} />;
  return <>{children}</>;
}

// Simple placeholder for protected pages
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

        {/* Protected routes - showing placeholders for now */}
        <Route
          path="/dashboard"
          element={
            <Private>
              <Placeholder title="Dashboard" />
            </Private>
          }
        />
        <Route
          path="/explore"
          element={
            <Private>
              <Placeholder title="Explore" />
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
