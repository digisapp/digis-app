import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase-auth';
import { useAppStore } from '../../stores/useAppStore';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/auth-helpers';

// Types
interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupData extends LoginCredentials {
  username: string;
  isCreator?: boolean;
}

interface UserProfile {
  uid: string;
  supabase_id: string;
  email: string;
  username: string;
  isCreator: boolean;
  isAdmin: boolean;
  bio?: string;
  profilePicUrl?: string;
  tokenBalance: number;
}

// Hooks
export const useLogin = () => {
  const queryClient = useQueryClient();
  const { setUser, setAuthLoading } = useAppStore();

  return useMutation({
    mutationFn: async ({ email, password }: LoginCredentials) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      const token = data.session?.access_token;
      
      // Fetch user profile
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }
      
      const profileData = await response.json();
      
      return profileData;
    },
    onSuccess: (data) => {
      setUser(data.user);
      setAuthLoading(false);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Welcome back!');
    },
    onError: (error: any) => {
      setAuthLoading(false);
      toast.error(error.message || 'Login failed');
    },
  });
};

export const useSignup = () => {
  const queryClient = useQueryClient();
  const { setUser, setAuthLoading } = useAppStore();

  return useMutation({
    mutationFn: async ({ email, password, username, isCreator }: SignupData) => {
      // Create Supabase user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) throw error;
      
      const token = data.session?.access_token;
      
      // Create profile in backend
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username,
          isCreator,
          email,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create profile');
      }
      
      const profileData = await response.json();
      return profileData;
    },
    onSuccess: (data) => {
      setUser(data.user);
      setAuthLoading(false);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Account created successfully!');
    },
    onError: (error: any) => {
      setAuthLoading(false);
      toast.error(error.message || 'Signup failed');
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  const { reset } = useAppStore();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => {
      reset();
      queryClient.clear();
      toast.success('Logged out successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Logout failed');
    },
  });
};

export const useCurrentUser = () => {
  const { setUser, setAuthLoading } = useAppStore();

  const query = useQuery({
    queryKey: ['user', 'current'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const token = session.access_token;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }
      
      const data = await response.json();
      return data.user as UserProfile;
    },
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Handle side effects outside of config
  React.useEffect(() => {
    if (query.data) {
      setUser(query.data);
    }
    if (query.isSuccess || query.isError) {
      setAuthLoading(false);
    }
  }, [query.data, query.isSuccess, query.isError, setUser, setAuthLoading]);
  
  return query;
};

export const useTokenBalance = () => {
  const { updateTokenBalance } = useAppStore();

  const query = useQuery({
    queryKey: ['tokens', 'balance'],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/tokens/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch token balance');
      }
      
      const data = await response.json();
      return data.balance;
    },
    enabled: true,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  
  // Handle side effects outside of config
  React.useEffect(() => {
    if (query.data !== undefined) {
      updateTokenBalance(query.data);
    }
  }, [query.data, updateTokenBalance]);
  
  return query;
};