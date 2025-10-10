/**
 * SocketContext Tests
 *
 * Verifies socket connection lifecycle:
 * - Connects on login
 * - Disconnects on logout
 * - Handles incoming calls
 * - Updates token balance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SocketProvider, useSocket } from '../../contexts/SocketContext';
import { AuthProvider } from '../../contexts/AuthContext';
import React from 'react';

// Mock socket service
const mockSocketService = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  on: vi.fn((event, callback) => {
    // Return cleanup function
    return () => {};
  }),
  off: vi.fn(),
  emit: vi.fn(),
};

vi.mock('../../services/socket', () => ({
  default: mockSocketService,
}));

// Mock AuthContext
const mockAuthState = {
  user: null,
  profile: null,
  isCreator: false,
  isAdmin: false,
  isAuthenticated: false,
  authLoading: false,
  tokenBalance: 0,
  updateTokenBalance: vi.fn(),
  signOut: vi.fn(),
  refreshProfile: vi.fn(),
  fetchTokenBalance: vi.fn(),
  setUser: vi.fn(),
  setProfile: vi.fn(),
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('SocketContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = null;
    mockAuthState.isCreator = false;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Connection lifecycle', () => {
    it('should not connect when user is not logged in', async () => {
      const { result } = renderHook(() => useSocket(), {
        wrapper: ({ children }) => (
          <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
          </AuthProvider>
        ),
      });

      expect(result.current.connected).toBe(false);
      expect(mockSocketService.connect).not.toHaveBeenCalled();
    });

    it('should connect when user logs in', async () => {
      // Set user as logged in
      mockAuthState.user = { id: '1', email: 'user@test.com' };
      mockAuthState.isAuthenticated = true;

      const { result } = renderHook(() => useSocket(), {
        wrapper: ({ children }) => (
          <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
          </AuthProvider>
        ),
      });

      // Wait for connection (has 1.5s delay)
      await waitFor(() => {
        expect(mockSocketService.connect).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('should disconnect when user logs out', async () => {
      mockAuthState.user = { id: '1', email: 'user@test.com' };
      mockAuthState.isAuthenticated = true;

      const { unmount } = renderHook(() => useSocket(), {
        wrapper: ({ children }) => (
          <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
          </AuthProvider>
        ),
      });

      // Unmount simulates logout cleanup
      unmount();

      await waitFor(() => {
        expect(mockSocketService.disconnect).toHaveBeenCalled();
      });
    });
  });

  describe('Event listeners', () => {
    it('should register call-request listener for creators', async () => {
      mockAuthState.user = { id: '1', email: 'creator@test.com' };
      mockAuthState.isCreator = true;
      mockAuthState.isAuthenticated = true;

      renderHook(() => useSocket(), {
        wrapper: ({ children }) => (
          <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
          </AuthProvider>
        ),
      });

      await waitFor(() => {
        expect(mockSocketService.on).toHaveBeenCalledWith('call-request', expect.any(Function));
      }, { timeout: 2000 });
    });

    it('should register balance-update listener', async () => {
      mockAuthState.user = { id: '1', email: 'user@test.com' };
      mockAuthState.isAuthenticated = true;

      renderHook(() => useSocket(), {
        wrapper: ({ children }) => (
          <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
          </AuthProvider>
        ),
      });

      await waitFor(() => {
        expect(mockSocketService.on).toHaveBeenCalledWith('balance-update', expect.any(Function));
      }, { timeout: 2000 });
    });
  });

  describe('Emit functions', () => {
    it('should expose requestCall function', () => {
      mockAuthState.user = { id: '1', email: 'user@test.com' };

      const { result } = renderHook(() => useSocket(), {
        wrapper: ({ children }) => (
          <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
          </AuthProvider>
        ),
      });

      expect(result.current.requestCall).toBeDefined();
      expect(typeof result.current.requestCall).toBe('function');
    });

    it('should expose respondToCall function', () => {
      mockAuthState.user = { id: '1', email: 'creator@test.com' };
      mockAuthState.isCreator = true;

      const { result } = renderHook(() => useSocket(), {
        wrapper: ({ children }) => (
          <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
          </AuthProvider>
        ),
      });

      expect(result.current.respondToCall).toBeDefined();
      expect(typeof result.current.respondToCall).toBe('function');
    });

    it('should expose sendMessage function', () => {
      mockAuthState.user = { id: '1', email: 'user@test.com' };

      const { result } = renderHook(() => useSocket(), {
        wrapper: ({ children }) => (
          <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
          </AuthProvider>
        ),
      });

      expect(result.current.sendMessage).toBeDefined();
      expect(typeof result.current.sendMessage).toBe('function');
    });
  });

  describe('Incoming call state', () => {
    it('should start with no incoming call', () => {
      const { result } = renderHook(() => useSocket(), {
        wrapper: ({ children }) => (
          <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
          </AuthProvider>
        ),
      });

      expect(result.current.incomingCall).toBeNull();
    });

    it('should expose clearIncomingCall function', () => {
      const { result } = renderHook(() => useSocket(), {
        wrapper: ({ children }) => (
          <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
          </AuthProvider>
        ),
      });

      expect(result.current.clearIncomingCall).toBeDefined();
      expect(typeof result.current.clearIncomingCall).toBe('function');
    });
  });
});
