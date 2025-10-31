/**
 * App - Simple, boring, works every day
 *
 * No complex state management, no abstractions.
 * Just auth provider and routes.
 */

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { ModalProvider } from './contexts/ModalContext';
import AppRoutes from './routes/AppRoutes';
import ErrorBoundary from './components/ui/ErrorBoundary';
import EnhancedToaster from './components/ui/EnhancedToaster';
import Modals from './components/modals/Modals';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <DeviceProvider>
            <ModalProvider>
              {/* Toast notifications */}
              <EnhancedToaster />

              {/* Main app routes */}
              <AppRoutes />

              {/* Global modals */}
              <Modals />
            </ModalProvider>
          </DeviceProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
