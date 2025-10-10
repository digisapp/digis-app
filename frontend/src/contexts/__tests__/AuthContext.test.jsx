import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { supabase } from '../../utils/supabase-auth';
import { verifyUserRole } from '../../utils/roleVerification';

// Mock dependencies
jest.mock('../../utils/supabase-auth');
jest.mock('../../utils/roleVerification');
jest.mock('../../utils/profileCache', () => ({
  loadProfileCache: jest.fn(),
  saveProfileCache: jest.fn(),
  clearProfileCache: jest.fn(),
}));

describe('AuthContext', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockProfile = {
    id: 'test-user-id',
    email: 'test@example.com',
    is_creator: false,
    role: 'user',
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
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.authLoading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it('should fetch user profile on mount', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.authLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should correctly identify creator status', async () => {
    const creatorProfile = { ...mockProfile, is_creator: true };
    verifyUserRole.mockResolvedValue({
      success: true,
      profile: creatorProfile,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isCreator).toBe(true);
    });
  });

  it('should correctly identify admin status', async () => {
    const adminProfile = { ...mockProfile, role: 'admin' };
    verifyUserRole.mockResolvedValue({
      success: true,
      profile: adminProfile,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAdmin).toBe(true);
    });
  });

  it('should handle sign out', async () => {
    supabase.auth.signOut = jest.fn().mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('should refresh profile on demand', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.profile).toEqual(mockProfile);
    });

    const updatedProfile = { ...mockProfile, token_balance: 200 };
    verifyUserRole.mockResolvedValue({
      success: true,
      profile: updatedProfile,
    });

    await act(async () => {
      await result.current.refreshProfile();
    });

    await waitFor(() => {
      expect(result.current.profile.token_balance).toBe(200);
    });
  });

  it('should update token balance optimistically', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.tokenBalance).toBe(100);
    });

    act(() => {
      result.current.updateTokenBalance(150);
    });

    expect(result.current.tokenBalance).toBe(150);
  });

  it('should handle authentication errors gracefully', async () => {
    verifyUserRole.mockResolvedValue({
      success: false,
      error: 'Authentication failed',
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.authLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should not fetch profile when no user is authenticated', async () => {
    supabase.auth.getSession = jest.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.authLoading).toBe(false);
    });

    expect(verifyUserRole).not.toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
