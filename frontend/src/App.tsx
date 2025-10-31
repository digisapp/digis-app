import React from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ModalProvider } from './contexts/ModalContext';
import AppRoutes from './routes/AppRoutes';
import Modals from './components/modals/Modals';

function AppInner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <AppRoutes />
      <Modals
        user={user}
        tokenBalance={0}
        onTokenUpdate={() => {}}
        onNavigate={(path: string) => navigate(path)}
      />
    </>
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
