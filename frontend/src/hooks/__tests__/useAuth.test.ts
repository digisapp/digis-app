/**
 * Unit tests for useAuth hook
 * @module tests/useAuth
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAuth } from '../useAuth';
import { supabase } from '../../utils/supabase-auth';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Mock Supabase
vi.mock('../../utils/supabase-auth', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn()
          }
        }
      }))
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis()
    }))
  }
}));

// Mock react-router
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Test wrapper
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('useAuth', () => {
  const mockUser = {
    id: 'user-123',
    supabase_id: 'supabase-123',
    email: 'test@example.com',
    username: 'testuser',
    name: 'Test User',
    is_creator: false,
    is_verified: true,
    token_balance: 1000,
    created_at: '2024-01-01',
    updated_at: '2024-01-01'
  };

  const mockSession = {
    user: {
      id: 'supabase-123',
      email: 'test@example.com'
    },
    access_token: 'test-token',
    refresh_token: 'refresh-token',
    expires_at: Date.now() + 3600000
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  describe('initialization', () => {
    it('initializes with null user when not authenticated', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: null },
        error: null
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('initializes with user when authenticated', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockUser,
          error: null
        })
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('signIn', () => {
    it('signs in user successfully', async () => {
      supabase.auth.signInWithPassword = vi.fn().mockResolvedValue({
        data: {
          user: { id: 'supabase-123' },
          session: mockSession
        },
        error: null
      });

      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockUser,
          error: null
        })
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signIn({
          email: 'test@example.com',
          password: 'password123'
        });
      });

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('handles sign in error', async () => {
      const error = new Error('Invalid credentials');
      supabase.auth.signInWithPassword = vi.fn().mockResolvedValue({
        data: null,
        error
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        result.current.signIn({
          email: 'test@example.com',
          password: 'wrong'
        })
      ).rejects.toThrow('Invalid credentials');

      expect(result.current.error).toEqual(error);
    });

    it('navigates to creator dashboard for creators', async () => {
      const creatorUser = { ...mockUser, is_creator: true };

      supabase.auth.signInWithPassword = vi.fn().mockResolvedValue({
        data: {
          user: { id: 'supabase-123' },
          session: mockSession
        },
        error: null
      });

      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: creatorUser,
          error: null
        })
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.signIn({
          email: 'creator@example.com',
          password: 'password123'
        });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/creator/dashboard');
    });
  });

  describe('signUp', () => {
    it('signs up user successfully', async () => {
      // Mock username check
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' } // No rows found = username available
        })
      });

      supabase.auth.signUp = vi.fn().mockResolvedValue({
        data: {
          user: { id: 'new-user-123' }
        },
        error: null
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signUp({
          email: 'new@example.com',
          password: 'password123',
          name: 'New User',
          username: 'newuser',
          is_creator: false,
          terms_accepted: true
        });
      });

      expect(supabase.auth.signUp).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/auth/verify-email');
    });

    it('prevents signup with taken username', async () => {
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'existing-user' },
          error: null
        })
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        result.current.signUp({
          email: 'new@example.com',
          password: 'password123',
          name: 'New User',
          username: 'taken',
          is_creator: false,
          terms_accepted: true
        })
      ).rejects.toThrow('Username is already taken');
    });
  });

  describe('signOut', () => {
    it('signs out user successfully', async () => {
      supabase.auth.signOut = vi.fn().mockResolvedValue({
        error: null
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signOut();
      });

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('updateProfile', () => {
    it('updates user profile successfully', async () => {
      // Set initial user
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockUser,
          error: null
        }),
        update: vi.fn().mockReturnThis()
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      const updates = { bio: 'Updated bio' };

      await act(async () => {
        await result.current.updateProfile(updates);
      });

      expect(result.current.user?.bio).toBe('Updated bio');
    });
  });

  describe('resetPassword', () => {
    it('sends password reset email', async () => {
      supabase.auth.resetPasswordForEmail = vi.fn().mockResolvedValue({
        error: null
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.resetPassword('test@example.com');
      });

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/reset-password')
        })
      );
    });
  });

  describe('checkUsername', () => {
    it('returns true for available username', async () => {
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      const isAvailable = await result.current.checkUsername('newusername');
      expect(isAvailable).toBe(true);
    });

    it('returns false for taken username', async () => {
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-123' },
          error: null
        })
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      const isAvailable = await result.current.checkUsername('taken');
      expect(isAvailable).toBe(false);
    });
  });
});