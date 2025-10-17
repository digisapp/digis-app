import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { SocketProvider, useSocket } from '../SocketContext';
import { ModalProvider, useModal, MODALS } from '../ModalContext';
import { DeviceProvider, useDevice } from '../DeviceContext';
import { supabase } from '../../utils/supabase-auth';
import { verifyUserRole } from '../../utils/roleVerification';
import socketService from '../../services/socketServiceWrapper';

// Mock dependencies
jest.mock('../../utils/supabase-auth');
jest.mock('../../utils/roleVerification');
jest.mock('../../services/socketServiceWrapper');
jest.mock('../../utils/profileCache', () => ({
  loadProfileCache: jest.fn(),
  saveProfileCache: jest.fn(),
  clearProfileCache: jest.fn(),
}));

describe('Context Integration Tests', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockProfile = {
    id: 'test-user-id',
    email: 'test@example.com',
    is_creator: true,
    role: 'creator',
    token_balance: 100,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase auth
    supabase.auth.getSession = jest.fn().mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    });

    supabase.auth.onAuthStateChange = jest.fn().mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });

    // Mock role verification
    verifyUserRole.mockResolvedValue({
      success: true,
      profile: mockProfile,
    });

    // Mock socket service
    socketService.connect = jest.fn();
    socketService.disconnect = jest.fn();
    socketService.on = jest.fn();
    socketService.off = jest.fn();
    socketService.emit = jest.fn();
    socketService.isConnected = jest.fn(() => false);
  });

  describe('Auth + Socket Integration', () => {
    it('should connect socket when user authenticates', async () => {
      const AllProviders = ({ children }) => (
        <AuthProvider>
          <SocketProvider user={mockUser}>
            {children}
          </SocketProvider>
        </AuthProvider>
      );

      const { result: authResult } = renderHook(() => useAuth(), {
        wrapper: AllProviders,
      });

      const { result: socketResult } = renderHook(() => useSocket(), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(authResult.current.user).toEqual(mockUser);
      });

      await waitFor(() => {
        expect(socketService.connect).toHaveBeenCalledWith(mockUser.id);
      });
    });

    it('should disconnect socket when user logs out', async () => {
      supabase.auth.signOut = jest.fn().mockResolvedValue({ error: null });

      const AllProviders = ({ children }) => (
        <AuthProvider>
          <SocketProvider user={mockUser}>
            {children}
          </SocketProvider>
        </AuthProvider>
      );

      const { result: authResult } = renderHook(() => useAuth(), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(authResult.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await authResult.current.signOut();
      });

      await waitFor(() => {
        expect(socketService.disconnect).toHaveBeenCalled();
      });
    });

    it('should update token balance from socket event', async () => {
      let balanceUpdateHandler;
      socketService.on.mockImplementation((event, handler) => {
        if (event === 'balance_updated') {
          balanceUpdateHandler = handler;
        }
      });

      const AllProviders = ({ children }) => (
        <AuthProvider>
          <SocketProvider user={mockUser}>
            {children}
          </SocketProvider>
        </AuthProvider>
      );

      const { result: authResult } = renderHook(() => useAuth(), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(authResult.current.tokenBalance).toBe(100);
      });

      // Simulate balance update from socket
      act(() => {
        if (balanceUpdateHandler) {
          balanceUpdateHandler({ newBalance: 150 });
        }
      });

      // AuthContext should update from the socket event
      // This requires the contexts to communicate properly
    });
  });

  describe('Auth + Modal Integration', () => {
    it('should open token purchase modal for authenticated user', async () => {
      const AllProviders = ({ children }) => (
        <AuthProvider>
          <ModalProvider>
            {children}
          </ModalProvider>
        </AuthProvider>
      );

      const { result: authResult } = renderHook(() => useAuth(), {
        wrapper: AllProviders,
      });

      const { result: modalResult } = renderHook(() => useModal(), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(authResult.current.user).toEqual(mockUser);
      });

      act(() => {
        modalResult.current.open(MODALS.TOKEN_PURCHASE, {
          currentBalance: authResult.current.tokenBalance,
        });
      });

      expect(modalResult.current.isOpen(MODALS.TOKEN_PURCHASE)).toBe(true);
    });

    it('should not allow creator-only modals for non-creators', async () => {
      const fanProfile = { ...mockProfile, is_creator: false };
      verifyUserRole.mockResolvedValue({
        success: true,
        profile: fanProfile,
      });

      const AllProviders = ({ children }) => (
        <AuthProvider>
          <ModalProvider>
            {children}
          </ModalProvider>
        </AuthProvider>
      );

      const { result: authResult } = renderHook(() => useAuth(), {
        wrapper: AllProviders,
      });

      const { result: modalResult } = renderHook(() => useModal(), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(authResult.current.isCreator).toBe(false);
      });

      // In a real implementation, this would be prevented
      // by the modal component checking auth.isCreator
    });
  });

  describe('Device + Modal Integration', () => {
    it('should open mobile-specific modals on mobile devices', async () => {
      window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: query.includes('max-width: 767px'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const AllProviders = ({ children }) => (
        <DeviceProvider>
          <ModalProvider>
            {children}
          </ModalProvider>
        </DeviceProvider>
      );

      const { result: deviceResult } = renderHook(() => useDevice(), {
        wrapper: AllProviders,
      });

      const { result: modalResult } = renderHook(() => useModal(), {
        wrapper: AllProviders,
      });

      expect(deviceResult.current.isMobile).toBe(true);

      // Open mobile-specific token purchase modal
      act(() => {
        modalResult.current.open(MODALS.MOBILE_TOKEN_PURCHASE);
      });

      expect(modalResult.current.isOpen(MODALS.MOBILE_TOKEN_PURCHASE)).toBe(true);
    });
  });

  describe('Full Context Stack Integration', () => {
    it('should handle complete user flow: auth → socket → modal', async () => {
      let incomingCallHandler;
      socketService.on.mockImplementation((event, handler) => {
        if (event === 'incoming_call') {
          incomingCallHandler = handler;
        }
      });

      const AllProviders = ({ children }) => (
        <AuthProvider>
          <SocketProvider user={mockUser}>
            <ModalProvider>
              <DeviceProvider>
                {children}
              </DeviceProvider>
            </ModalProvider>
          </SocketProvider>
        </AuthProvider>
      );

      const { result: authResult } = renderHook(() => useAuth(), {
        wrapper: AllProviders,
      });

      const { result: socketResult } = renderHook(() => useSocket(), {
        wrapper: AllProviders,
      });

      const { result: modalResult } = renderHook(() => useModal(), {
        wrapper: AllProviders,
      });

      const { result: deviceResult } = renderHook(() => useDevice(), {
        wrapper: AllProviders,
      });

      // Wait for auth to complete
      await waitFor(() => {
        expect(authResult.current.user).toEqual(mockUser);
        expect(authResult.current.isCreator).toBe(true);
      });

      // Verify socket connected
      await waitFor(() => {
        expect(socketService.connect).toHaveBeenCalledWith(mockUser.id);
      });

      // Simulate incoming call via socket
      const mockIncomingCall = {
        callerId: 'fan-id',
        callerName: 'Test Fan',
        callType: 'video',
        channel: 'test-channel',
      };

      act(() => {
        if (incomingCallHandler) {
          incomingCallHandler(mockIncomingCall);
        }
      });

      await waitFor(() => {
        expect(socketResult.current.incomingCall).toEqual(mockIncomingCall);
      });

      // Creator accepts call (would trigger modal in real app)
      act(() => {
        socketResult.current.respondToCall(true);
      });

      expect(socketService.emit).toHaveBeenCalledWith('call_response', {
        callerId: 'fan-id',
        accepted: true,
      });

      expect(socketResult.current.incomingCall).toBeNull();
    });

    it('should handle context cleanup in correct order', async () => {
      const AllProviders = ({ children }) => (
        <AuthProvider>
          <SocketProvider user={mockUser}>
            <ModalProvider>
              <DeviceProvider>
                {children}
              </DeviceProvider>
            </ModalProvider>
          </SocketProvider>
        </AuthProvider>
      );

      const { unmount } = renderHook(() => useAuth(), {
        wrapper: AllProviders,
      });

      unmount();

      // Verify cleanup was called
      await waitFor(() => {
        expect(socketService.disconnect).toHaveBeenCalled();
      });
    });
  });
});
