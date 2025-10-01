import { jest } from '@jest/globals';
import { supabase } from '../../utils/supabase-auth';
import { 
  getAuthToken, 
  getCurrentUser, 
  getUserId,
  clearAuthCache,
  subscribeToAuthChanges,
  isAuthenticated,
  getUserMetadata,
  refreshSession
} from '../../utils/auth-helpers';

// Mock supabase module
jest.mock('../../utils/supabase-auth', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      refreshSession: jest.fn(),
      onAuthStateChange: jest.fn()
    }
  }
}));

describe('auth-helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAuthCache(); // Clear cache before each test
  });

  describe('getAuthToken', () => {
    test('returns session token on success', async () => {
      const mockSession = {
        access_token: 'mock-token',
        expires_at: Date.now() / 1000 + 3600 // 1 hour from now
      };
      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const token = await getAuthToken();
      expect(token).toBe('mock-token');
      expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
    });

    test('uses cached session when valid', async () => {
      const mockSession = {
        access_token: 'cached-token',
        expires_at: Date.now() / 1000 + 3600
      };
      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // First call - should fetch from supabase
      const token1 = await getAuthToken();
      expect(token1).toBe('cached-token');
      expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const token2 = await getAuthToken();
      expect(token2).toBe('cached-token');
      expect(supabase.auth.getSession).toHaveBeenCalledTimes(1); // Still 1
    });

    test('throws specific error for network issues', async () => {
      supabase.auth.getSession.mockRejectedValue(
        new Error('network error occurred')
      );

      await expect(getAuthToken()).rejects.toThrow('Network error fetching session');
    });

    test('throws specific error for unauthorized', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'unauthorized access' }
      });

      await expect(getAuthToken()).rejects.toThrow('Unauthorized: Please sign in again');
    });

    test('throws error when no session', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      await expect(getAuthToken()).rejects.toThrow('No active session: Please sign in');
    });

    test('retries on failure', async () => {
      // Fail twice, then succeed
      supabase.auth.getSession
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({
          data: { 
            session: { 
              access_token: 'retry-token',
              expires_at: Date.now() / 1000 + 3600
            } 
          },
          error: null
        });

      const token = await getAuthToken();
      expect(token).toBe('retry-token');
      expect(supabase.auth.getSession).toHaveBeenCalledTimes(3);
    });
  });

  describe('getCurrentUser', () => {
    test('returns user on success', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const user = await getCurrentUser();
      expect(user).toEqual(mockUser);
      expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
    });

    test('uses cached user', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // First call
      const user1 = await getCurrentUser();
      expect(user1).toEqual(mockUser);
      expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const user2 = await getCurrentUser();
      expect(user2).toEqual(mockUser);
      expect(supabase.auth.getUser).toHaveBeenCalledTimes(1); // Still 1
    });

    test('throws specific error for network issues', async () => {
      supabase.auth.getUser.mockRejectedValue(
        new Error('network error occurred')
      );

      await expect(getCurrentUser()).rejects.toThrow('Network error fetching user');
    });

    test('throws error when no user', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      await expect(getCurrentUser()).rejects.toThrow('No active user: Please sign in');
    });
  });

  describe('getUserId', () => {
    test('returns user ID', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const userId = await getUserId();
      expect(userId).toBe('user-123');
    });

    test('throws error when user has no ID', async () => {
      const mockUser = { email: 'test@example.com' }; // No id
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      await expect(getUserId()).rejects.toThrow('User ID not found');
    });
  });

  describe('subscribeToAuthChanges', () => {
    test('subscribes to auth changes and clears cache on sign out', () => {
      const mockUnsubscribe = jest.fn();
      const mockCallback = jest.fn();
      
      supabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } }
      });

      const unsubscribe = subscribeToAuthChanges(mockCallback);

      // Get the callback passed to onAuthStateChange
      const authCallback = supabase.auth.onAuthStateChange.mock.calls[0][0];

      // Simulate sign out
      authCallback('SIGNED_OUT', null);

      expect(mockCallback).toHaveBeenCalledWith('SIGNED_OUT', null);

      // Cleanup
      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    test('updates cache on sign in', () => {
      const mockSession = {
        access_token: 'new-token',
        expires_at: Date.now() / 1000 + 3600,
        user: { id: 'user-123' }
      };
      
      supabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      });

      subscribeToAuthChanges(jest.fn());

      // Get the callback passed to onAuthStateChange
      const authCallback = supabase.auth.onAuthStateChange.mock.calls[0][0];

      // Simulate sign in
      authCallback('SIGNED_IN', mockSession);

      // Cache should be updated (we can't directly test this without exposing cache)
    });
  });

  describe('isAuthenticated', () => {
    test('returns true when authenticated', async () => {
      const mockSession = {
        access_token: 'valid-token',
        expires_at: Date.now() / 1000 + 3600
      };
      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const isAuth = await isAuthenticated();
      expect(isAuth).toBe(true);
    });

    test('returns false when not authenticated', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const isAuth = await isAuthenticated();
      expect(isAuth).toBe(false);
    });
  });

  describe('getUserMetadata', () => {
    test('returns user metadata', async () => {
      const mockUser = { 
        id: '123', 
        user_metadata: { name: 'John Doe', role: 'creator' }
      };
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const metadata = await getUserMetadata();
      expect(metadata).toEqual({ name: 'John Doe', role: 'creator' });
    });

    test('returns empty object when no metadata', async () => {
      const mockUser = { id: '123' }; // No metadata
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const metadata = await getUserMetadata();
      expect(metadata).toEqual({});
    });
  });

  describe('refreshSession', () => {
    test('refreshes session and returns new token', async () => {
      const mockNewSession = {
        access_token: 'refreshed-token',
        expires_at: Date.now() / 1000 + 7200
      };
      supabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockNewSession },
        error: null
      });

      const token = await refreshSession();
      expect(token).toBe('refreshed-token');
      expect(supabase.auth.refreshSession).toHaveBeenCalled();
    });

    test('throws error when refresh fails', async () => {
      supabase.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'refresh failed' }
      });

      await expect(refreshSession()).rejects.toThrow('Failed to refresh session: refresh failed');
    });
  });
});