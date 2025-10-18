import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase-auth';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/auth-helpers';

// Types
interface Creator {
  uid: string;
  username: string;
  bio?: string;
  profilePicUrl?: string;
  streamPrice: number;
  videoPrice: number;
  voicePrice: number;
  messagePrice: number;
  isOnline: boolean;
  isLive: boolean;
  followerCount: number;
  totalSessions: number;
  state?: string;
  country?: string;
}

interface CreatorFilters {
  minPrice?: number;
  maxPrice?: number;
  serviceType?: 'video' | 'voice' | 'stream' | 'message';
  isOnline?: boolean;
  isLive?: boolean;
  search?: string;
}

// Fetch all creators with filters
export const useCreators = (filters?: CreatorFilters) => {
  return useQuery({
    queryKey: ['creators', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) params.append(key, String(value));
        });
      }

      const token = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/creators?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch creators');
      }
      
      const data = await response.json();
      return data.creators as Creator[];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

// Fetch single creator profile
export const useCreatorProfile = (username: string) => {
  return useQuery({
    queryKey: ['creator', username],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/public/creator/${username}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch creator profile');
      }
      
      const data = await response.json();
      return data.creator as Creator;
    },
    enabled: !!username,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Fetch featured creators
export const useFeaturedCreators = () => {
  return useQuery({
    queryKey: ['creators', 'featured'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/featured-creators`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch featured creators');
      }
      
      const data = await response.json();
      return data.creators as Creator[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

// Follow/Unfollow creator
export const useFollowCreator = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ creatorId, action }: { creatorId: string; action: 'follow' | 'unfollow' }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const endpoint = action === 'follow' 
        ? `/api/users/follow/${creatorId}`
        : `/api/users/unfollow/${creatorId}`;

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} creator`);
      }
      
      const data = await response.json();
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['creator', variables.creatorId] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      toast.success(variables.action === 'follow' ? 'Following creator!' : 'Unfollowed creator');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Action failed');
    },
  });
};

// Get creators I'm following
export const useFollowing = () => {
  return useQuery({
    queryKey: ['following'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/following`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch following list');
      }
      
      const data = await response.json();
      return data.following as Creator[];
    },
    enabled: true, // Always enabled, will return null if no session
  });
};

// Search creators
export const useSearchCreators = (searchTerm: string, enabled = true) => {
  return useQuery({
    queryKey: ['creators', 'search', searchTerm],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/search-creators?q=${encodeURIComponent(searchTerm)}`);
      
      if (!response.ok) {
        throw new Error('Failed to search creators');
      }
      
      const data = await response.json();
      return data.creators as Creator[];
    },
    enabled: enabled && searchTerm.length > 2,
    staleTime: 1000 * 60, // 1 minute
  });
};

// Get online creators count
export const useOnlineCreatorsCount = () => {
  return useQuery({
    queryKey: ['creators', 'online', 'count'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/users/online-creators-count`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch online creators count');
      }
      
      const data = await response.json();
      return data.count as number;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

// Tip creator
export const useTipCreator = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ creatorId, amount, message }: { 
      creatorId: string; 
      amount: number; 
      message?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/tokens/tip/${creatorId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          amount,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send tip');
      }
      
      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tokens', 'balance'] });
      toast.success('Tip sent successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send tip');
    },
  });
};