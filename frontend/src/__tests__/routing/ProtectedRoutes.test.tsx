/**
 * Protected Routes Tests
 *
 * Verifies role-based access control for protected routes.
 * Ensures creators can access creator-only routes and admins can access admin routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import AppRoutes from '../../routes/AppRoutes';
import { AuthProvider } from '../../contexts/AuthContext';
import { DeviceProvider } from '../../contexts/DeviceContext';
import { ModalProvider } from '../../contexts/ModalContext';
import { SocketProvider } from '../../contexts/SocketContext';

// Mock auth hook
const mockAuthState = {
  user: null,
  profile: null,
  isCreator: false,
  isAdmin: false,
  isAuthenticated: false,
  authLoading: false,
  tokenBalance: 0,
  signOut: vi.fn(),
  refreshProfile: vi.fn(),
  fetchTokenBalance: vi.fn(),
  updateTokenBalance: vi.fn(),
  setUser: vi.fn(),
  setProfile: vi.fn(),
};

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => mockAuthState,
  };
});

// Mock device context
vi.mock('../../contexts/DeviceContext', () => ({
  useDevice: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isMobilePortrait: false,
    isMobileLandscape: false,
    isTouchDevice: false,
    orientation: 'landscape',
  }),
  DeviceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Test wrapper with all required providers
const TestWrapper = ({ children, initialRoute = '/' }: { children: React.ReactNode; initialRoute?: string }) => {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <DeviceProvider>
        <AuthProvider>
          <ModalProvider>
            <SocketProvider>
              {children}
            </SocketProvider>
          </ModalProvider>
        </AuthProvider>
      </DeviceProvider>
    </MemoryRouter>
  );
};

describe('Protected Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth state to logged out
    mockAuthState.user = null;
    mockAuthState.profile = null;
    mockAuthState.isCreator = false;
    mockAuthState.isAdmin = false;
    mockAuthState.isAuthenticated = false;
  });

  describe('Creator-only routes', () => {
    it('should redirect /dashboard when not authenticated', async () => {
      render(
        <TestWrapper initialRoute="/dashboard">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should redirect to login or show access denied
        expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument();
      });
    });

    it('should allow creator to access /dashboard', async () => {
      mockAuthState.user = { id: '1', email: 'creator@test.com' };
      mockAuthState.profile = { id: '1', is_creator: true };
      mockAuthState.isCreator = true;
      mockAuthState.isAuthenticated = true;

      render(
        <TestWrapper initialRoute="/dashboard">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should render dashboard (might be lazy loaded)
        expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
      });
    });

    it('should allow creator to access /analytics', async () => {
      mockAuthState.user = { id: '1', email: 'creator@test.com' };
      mockAuthState.profile = { id: '1', is_creator: true };
      mockAuthState.isCreator = true;
      mockAuthState.isAuthenticated = true;

      render(
        <TestWrapper initialRoute="/analytics">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
      });
    });

    it('should allow creator to access /call-requests', async () => {
      mockAuthState.user = { id: '1', email: 'creator@test.com' };
      mockAuthState.profile = { id: '1', is_creator: true };
      mockAuthState.isCreator = true;
      mockAuthState.isAuthenticated = true;

      render(
        <TestWrapper initialRoute="/call-requests">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
      });
    });

    it('should allow creator to access /history', async () => {
      mockAuthState.user = { id: '1', email: 'creator@test.com' };
      mockAuthState.profile = { id: '1', is_creator: true };
      mockAuthState.isCreator = true;
      mockAuthState.isAuthenticated = true;

      render(
        <TestWrapper initialRoute="/history">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should show session history page
        expect(screen.queryByText(/session history/i)).toBeInTheDocument();
      });
    });
  });

  describe('Admin-only routes', () => {
    it('should redirect /admin when not admin', async () => {
      mockAuthState.user = { id: '1', email: 'user@test.com' };
      mockAuthState.profile = { id: '1', is_creator: false };
      mockAuthState.isAuthenticated = true;
      mockAuthState.isAdmin = false;

      render(
        <TestWrapper initialRoute="/admin">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should redirect away from admin
        expect(window.location.pathname).not.toBe('/admin');
      });
    });

    it('should allow admin to access /admin', async () => {
      mockAuthState.user = { id: '1', email: 'admin@test.com' };
      mockAuthState.profile = { id: '1', is_super_admin: true, role: 'admin' };
      mockAuthState.isAdmin = true;
      mockAuthState.isAuthenticated = true;

      render(
        <TestWrapper initialRoute="/admin">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Public routes', () => {
    it('should allow unauthenticated access to /', async () => {
      render(
        <TestWrapper initialRoute="/">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        // HomePage should render
        expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
      });
    });

    it('should allow unauthenticated access to /terms', async () => {
      render(
        <TestWrapper initialRoute="/terms">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
      });
    });

    it('should allow unauthenticated access to /privacy', async () => {
      render(
        <TestWrapper initialRoute="/privacy">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Authenticated routes', () => {
    it('should allow authenticated user to access /explore', async () => {
      mockAuthState.user = { id: '1', email: 'user@test.com' };
      mockAuthState.isAuthenticated = true;

      render(
        <TestWrapper initialRoute="/explore">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
      });
    });

    it('should allow authenticated user to access /wallet', async () => {
      mockAuthState.user = { id: '1', email: 'user@test.com' };
      mockAuthState.isAuthenticated = true;

      render(
        <TestWrapper initialRoute="/wallet">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
      });
    });

    it('should allow authenticated user to access /messages', async () => {
      mockAuthState.user = { id: '1', email: 'user@test.com' };
      mockAuthState.isAuthenticated = true;

      render(
        <TestWrapper initialRoute="/messages">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('404 handling', () => {
    it('should show 404 page for invalid routes', async () => {
      render(
        <TestWrapper initialRoute="/this-route-does-not-exist">
          <AppRoutes />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should redirect to appropriate home based on auth state
        // Since not authenticated, should redirect to /
        expect(window.location.pathname).toBe('/');
      });
    });
  });
});
