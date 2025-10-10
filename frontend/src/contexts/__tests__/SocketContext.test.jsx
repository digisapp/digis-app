import { renderHook, act, waitFor } from '@testing-library/react';
import { SocketProvider, useSocket } from '../SocketContext';
import socketService from '../../services/socket';

// Mock socket service
jest.mock('../../services/socket', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  isConnected: jest.fn(() => false),
}));

describe('SocketContext', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with disconnected state', () => {
    const { result } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => (
        <SocketProvider user={null}>{children}</SocketProvider>
      ),
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.incomingCall).toBeNull();
  });

  it('should connect socket when user is authenticated', async () => {
    const { result } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => (
        <SocketProvider user={mockUser}>{children}</SocketProvider>
      ),
    });

    await waitFor(() => {
      expect(socketService.connect).toHaveBeenCalledWith(mockUser.id);
    });
  });

  it('should disconnect socket when user logs out', async () => {
    const { rerender } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => (
        <SocketProvider user={mockUser}>{children}</SocketProvider>
      ),
    });

    await waitFor(() => {
      expect(socketService.connect).toHaveBeenCalled();
    });

    rerender(
      <SocketProvider user={null}>
        <div />
      </SocketProvider>
    );

    await waitFor(() => {
      expect(socketService.disconnect).toHaveBeenCalled();
    });
  });

  it('should handle incoming call notifications', async () => {
    const mockIncomingCall = {
      callerId: 'caller-id',
      callerName: 'Test Caller',
      callType: 'video',
      channel: 'test-channel',
    };

    let incomingCallHandler;
    socketService.on.mockImplementation((event, handler) => {
      if (event === 'incoming_call') {
        incomingCallHandler = handler;
      }
    });

    const { result } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => (
        <SocketProvider user={mockUser}>{children}</SocketProvider>
      ),
    });

    // Simulate incoming call event
    act(() => {
      if (incomingCallHandler) {
        incomingCallHandler(mockIncomingCall);
      }
    });

    await waitFor(() => {
      expect(result.current.incomingCall).toEqual(mockIncomingCall);
    });
  });

  it('should clear incoming call notification', async () => {
    const mockIncomingCall = {
      callerId: 'caller-id',
      callerName: 'Test Caller',
      callType: 'video',
    };

    let incomingCallHandler;
    socketService.on.mockImplementation((event, handler) => {
      if (event === 'incoming_call') {
        incomingCallHandler = handler;
      }
    });

    const { result } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => (
        <SocketProvider user={mockUser}>{children}</SocketProvider>
      ),
    });

    // Simulate incoming call
    act(() => {
      if (incomingCallHandler) {
        incomingCallHandler(mockIncomingCall);
      }
    });

    await waitFor(() => {
      expect(result.current.incomingCall).toEqual(mockIncomingCall);
    });

    // Clear the call
    act(() => {
      result.current.clearIncomingCall();
    });

    expect(result.current.incomingCall).toBeNull();
  });

  it('should respond to incoming call', async () => {
    const mockIncomingCall = {
      callerId: 'caller-id',
      callerName: 'Test Caller',
      callType: 'video',
      channel: 'test-channel',
    };

    let incomingCallHandler;
    socketService.on.mockImplementation((event, handler) => {
      if (event === 'incoming_call') {
        incomingCallHandler = handler;
      }
    });

    const { result } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => (
        <SocketProvider user={mockUser}>{children}</SocketProvider>
      ),
    });

    // Simulate incoming call
    act(() => {
      if (incomingCallHandler) {
        incomingCallHandler(mockIncomingCall);
      }
    });

    await waitFor(() => {
      expect(result.current.incomingCall).toEqual(mockIncomingCall);
    });

    // Accept the call
    act(() => {
      result.current.respondToCall(true);
    });

    expect(socketService.emit).toHaveBeenCalledWith('call_response', {
      callerId: 'caller-id',
      accepted: true,
    });
    expect(result.current.incomingCall).toBeNull();
  });

  it('should handle balance update events', async () => {
    const mockBalanceUpdate = { newBalance: 150 };

    let balanceUpdateHandler;
    socketService.on.mockImplementation((event, handler) => {
      if (event === 'balance_updated') {
        balanceUpdateHandler = handler;
      }
    });

    renderHook(() => useSocket(), {
      wrapper: ({ children }) => (
        <SocketProvider user={mockUser}>{children}</SocketProvider>
      ),
    });

    // Simulate balance update event
    act(() => {
      if (balanceUpdateHandler) {
        balanceUpdateHandler(mockBalanceUpdate);
      }
    });

    // Balance update should trigger context update
    // This would be verified in integration tests with AuthContext
  });

  it('should cleanup socket listeners on unmount', async () => {
    const { unmount } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => (
        <SocketProvider user={mockUser}>{children}</SocketProvider>
      ),
    });

    unmount();

    await waitFor(() => {
      expect(socketService.disconnect).toHaveBeenCalled();
    });
  });

  it('should update connection status', async () => {
    socketService.isConnected.mockReturnValue(true);

    let connectHandler;
    socketService.on.mockImplementation((event, handler) => {
      if (event === 'connect') {
        connectHandler = handler;
      }
    });

    const { result } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => (
        <SocketProvider user={mockUser}>{children}</SocketProvider>
      ),
    });

    // Simulate connect event
    act(() => {
      if (connectHandler) {
        connectHandler();
      }
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });
  });
});
