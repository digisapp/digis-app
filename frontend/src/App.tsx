import React from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth, supabase } from './contexts/AuthContext';
import { ModalProvider } from './contexts/ModalContext';
import { NavigationProvider } from './contexts/NavigationContext';
import AppRoutes from './routes/AppRoutes';
import Modals from './components/modals/Modals';
import NavigationShell from './components/navigation/NavigationShell';
import useViewRouter from './routes/useViewRouter';

function AppInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Enable legacy view router adapter for backward compatibility
  useViewRouter();

  // Don't show navigation on public homepage or auth page
  const isAuthPage = location.pathname === '/auth' || location.pathname === '/';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth?mode=signin');
  };

  const handleGoLive = () => {
    navigate('/go-live');
  };

  return (
    <NavigationProvider
      user={user}
      tokenBalance={0}
      onGoLive={handleGoLive}
    >
      {user && !isAuthPage && (
        <NavigationShell
          onLogout={handleLogout}
          onShowGoLive={handleGoLive}
        />
      )}
      <AppRoutes />
      <Modals
        user={user}
        tokenBalance={0}
        onTokenUpdate={() => {}}
        onNavigate={(path: string) => navigate(path)}
      />
    </NavigationProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ModalProvider>
          <AppInner />
        </ModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
