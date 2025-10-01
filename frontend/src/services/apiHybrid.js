// API client integrated with hybrid Zustand store
import axios from 'axios';
import { ENV } from '../config/env';
import { getAuthToken, refreshSession, retry } from '../utils/supabase-auth-enhanced';
import useHybridStore from '../stores/useHybridStore';

const API_BASE_URL = ENV.BACKEND_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token with retry logic
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Use enhanced getAuthToken which handles automatic refresh
      const token = await getAuthToken();
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Failed to get auth token for request:', error);
      // Continue request without token for public endpoints
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling with enhanced retry and store sync
apiClient.interceptors.response.use(
  (response) => {
    // Auto-sync certain responses with the store
    const { data } = response;
    const store = useHybridStore.getState();
    
    // Update token balance if returned
    if (data.tokenBalance !== undefined) {
      store.setTokenBalance(data.tokenBalance);
    }
    
    // Update user profile if returned
    if (data.userProfile) {
      store.setProfile(data.userProfile);
    }
    
    // Add notifications if returned
    if (data.notification) {
      store.addNotification(data.notification);
    }
    
    return response;
  },
  async (error) => {
    console.error('API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      // Token might be expired, try to refresh with retry logic
      try {
        const { session, error: refreshError } = await retry(
          () => refreshSession(),
          2, // Max 2 retries for token refresh
          500 // 500ms delay
        );
        
        if (!refreshError && session) {
          // Retry the original request with new token
          error.config.headers.Authorization = `Bearer ${session.access_token}`;
          return apiClient.request(error.config);
        }
      } catch (refreshError) {
        console.error('Token refresh failed after retries:', refreshError);
        // Clear user state on auth failure
        const store = useHybridStore.getState();
        store.logout();
      }
      
      // If refresh fails, redirect to login
      if (typeof window !== 'undefined' && window.location.pathname !== '/auth') {
        window.location.href = '/auth?redirect=' + encodeURIComponent(window.location.pathname);
      }
    }
    
    // Handle rate limiting - don't auto-retry to avoid loops
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      console.warn(`Rate limited. Please wait ${retryAfter} seconds before retrying.`);
      
      // Add rate limit notification
      const store = useHybridStore.getState();
      store.addNotification({
        type: 'warning',
        title: 'Rate Limited',
        message: `Too many requests. Please wait ${retryAfter} seconds.`,
        timestamp: Date.now()
      });
      
      error.response.data = {
        ...error.response.data,
        retryAfter,
        message: `Too many requests. Please wait ${retryAfter} seconds.`
      };
    }
    
    return Promise.reject(error);
  }
);

// Helper function to sync user data with store
const syncUserData = (userData) => {
  const store = useHybridStore.getState();
  if (userData.user) {
    store.setUser(userData.user);
  }
  if (userData.profile) {
    store.setProfile(userData.profile);
  }
  if (userData.tokenBalance !== undefined) {
    store.setTokenBalance(userData.tokenBalance);
  }
};

export const api = {
  // Auth endpoints with store sync
  auth: {
    syncUser: async (data) => {
      const response = await apiClient.post('/api/auth/sync-user', data);
      syncUserData(response.data);
      return response;
    },
    
    getProfile: async () => {
      const response = await apiClient.get('/api/auth/profile');
      if (response.data) {
        const store = useHybridStore.getState();
        store.setProfile(response.data);
      }
      return response;
    },
    
    updateProfile: async (data) => {
      const response = await apiClient.put('/api/auth/profile', data);
      if (response.data) {
        const store = useHybridStore.getState();
        store.setProfile(response.data);
      }
      return response;
    },
    
    applyCreator: (data) => apiClient.post('/api/auth/apply-creator', data),
    checkUsername: (username) => apiClient.get(`/api/auth/check-username/${username}`),
    deleteAccount: (data) => apiClient.delete('/api/auth/account', { data }),
    
    logout: async () => {
      const store = useHybridStore.getState();
      store.logout();
      return apiClient.post('/api/auth/logout');
    }
  },

  // User endpoints
  users: {
    search: (query) => apiClient.get(`/api/users/search?q=${query}`),
    getById: (id) => apiClient.get(`/api/users/${id}`),
    update: (id, data) => apiClient.put(`/api/users/${id}`, data),
    follow: async (creatorId) => {
      const response = await apiClient.post(`/api/users/${creatorId}/follow`);
      // Could add follow notification to store
      const store = useHybridStore.getState();
      store.addNotification({
        type: 'follow',
        title: 'Following',
        message: `You are now following this creator`,
        timestamp: Date.now()
      });
      return response;
    },
    unfollow: (creatorId) => apiClient.delete(`/api/users/${creatorId}/follow`),
    getFollowers: (userId) => apiClient.get(`/api/users/${userId}/followers`),
    getFollowing: (userId) => apiClient.get(`/api/users/${userId}/following`),
    getCreators: (params) => apiClient.get('/api/users/creators', { params }),
    getCreatorByUsername: (username) => apiClient.get(`/api/users/creator/${username}`),
    updateAvailability: (data) => apiClient.put('/api/users/availability', data),
  },

  // Token endpoints with automatic balance sync
  tokens: {
    getBalance: async () => {
      const response = await apiClient.get('/api/tokens/balance');
      if (response.data?.balance !== undefined) {
        const store = useHybridStore.getState();
        store.setTokenBalance(response.data.balance);
      }
      return response;
    },
    
    purchase: async (data) => {
      const response = await apiClient.post('/api/tokens/purchase', data);
      if (response.data?.newBalance !== undefined) {
        const store = useHybridStore.getState();
        store.setTokenBalance(response.data.newBalance);
        store.addNotification({
          type: 'success',
          title: 'Tokens Purchased',
          message: `Successfully purchased ${data.amount} tokens`,
          timestamp: Date.now()
        });
      }
      return response;
    },
    
    transfer: async (data) => {
      const response = await apiClient.post('/api/tokens/transfer', data);
      if (response.data?.newBalance !== undefined) {
        const store = useHybridStore.getState();
        store.updateTokenBalance(-data.amount);
      }
      return response;
    },
    
    getHistory: (params) => apiClient.get('/api/tokens/history', { params }),
    createPaymentIntent: (data) => apiClient.post('/api/tokens/create-payment-intent', data),
  },

  // Messages with chat store integration
  messages: {
    getConversations: () => apiClient.get('/api/messages/conversations'),
    getMessages: async (conversationId) => {
      const response = await apiClient.get(`/api/messages/${conversationId}`);
      if (response.data?.messages) {
        const store = useHybridStore.getState();
        store.setMessages(conversationId, response.data.messages);
      }
      return response;
    },
    
    sendMessage: async (data) => {
      const response = await apiClient.post('/api/messages', data);
      if (response.data?.message) {
        const store = useHybridStore.getState();
        store.addMessage(data.conversationId, response.data.message);
      }
      return response;
    },
    
    markAsRead: async (conversationId) => {
      const response = await apiClient.put(`/api/messages/${conversationId}/read`);
      const store = useHybridStore.getState();
      store.clearUnread(conversationId);
      return response;
    },
    
    deleteMessage: (messageId) => apiClient.delete(`/api/messages/${messageId}`),
  },

  // Streaming with store integration
  streaming: {
    getToken: (channelName, role) => 
      apiClient.get('/api/agora/rtc-token', { params: { channelName, role } }),
    
    startStream: async (data) => {
      const response = await apiClient.post('/api/streaming/start', data);
      if (response.data?.stream) {
        const store = useHybridStore.getState();
        store.startStream(response.data.stream);
      }
      return response;
    },
    
    endStream: async (streamId) => {
      const response = await apiClient.post(`/api/streaming/${streamId}/end`);
      const store = useHybridStore.getState();
      store.endStream();
      return response;
    },
    
    joinStream: async (streamId) => {
      const response = await apiClient.post(`/api/streaming/${streamId}/join`);
      if (response.data?.stream) {
        const store = useHybridStore.getState();
        store.joinStream(response.data.stream);
      }
      return response;
    },
    
    leaveStream: async (streamId) => {
      const response = await apiClient.post(`/api/streaming/${streamId}/leave`);
      const store = useHybridStore.getState();
      store.leaveStream();
      return response;
    },
    
    getActiveStreams: async () => {
      const response = await apiClient.get('/api/streaming/active');
      if (response.data?.streams) {
        const store = useHybridStore.getState();
        store.setActiveStreams(response.data.streams);
      }
      return response;
    },
    
    updateViewerCount: (streamId, count) => 
      apiClient.put(`/api/streaming/${streamId}/viewers`, { count }),
  },

  // Notifications
  notifications: {
    getAll: async () => {
      const response = await apiClient.get('/api/notifications');
      if (response.data?.notifications) {
        const store = useHybridStore.getState();
        // Clear existing and add all notifications
        store.clearNotifications();
        response.data.notifications.forEach(n => store.addNotification(n));
      }
      return response;
    },
    
    markAsRead: async (notificationId) => {
      const response = await apiClient.put(`/api/notifications/${notificationId}/read`);
      const store = useHybridStore.getState();
      store.markNotificationRead(notificationId);
      return response;
    },
    
    markAllAsRead: async () => {
      const response = await apiClient.put('/api/notifications/read-all');
      const store = useHybridStore.getState();
      store.markAllNotificationsRead();
      return response;
    },
    
    delete: async (notificationId) => {
      const response = await apiClient.delete(`/api/notifications/${notificationId}`);
      const store = useHybridStore.getState();
      store.removeNotification(notificationId);
      return response;
    },
  },

  // Video calls
  calls: {
    initiate: async (data) => {
      const response = await apiClient.post('/api/calls/initiate', data);
      if (response.data?.call) {
        const store = useHybridStore.getState();
        store.setIncomingCall(response.data.call);
      }
      return response;
    },
    
    accept: (callId) => apiClient.post(`/api/calls/${callId}/accept`),
    decline: (callId) => apiClient.post(`/api/calls/${callId}/decline`),
    end: (callId) => apiClient.post(`/api/calls/${callId}/end`),
    getToken: (channelName) => apiClient.get(`/api/calls/token/${channelName}`),
  },

  // Creator specific
  creator: {
    getDashboard: () => apiClient.get('/api/creator/dashboard'),
    getAnalytics: (params) => apiClient.get('/api/creator/analytics', { params }),
    getEarnings: (params) => apiClient.get('/api/creator/earnings', { params }),
    updateRates: (data) => apiClient.put('/api/creator/rates', data),
    getSubscribers: (params) => apiClient.get('/api/creator/subscribers', { params }),
    sendMassMessage: (data) => apiClient.post('/api/creator/mass-message', data),
  },

  // Admin endpoints
  admin: {
    getDashboard: () => apiClient.get('/api/admin/dashboard'),
    getUsers: (params) => apiClient.get('/api/admin/users', { params }),
    updateUser: (userId, data) => apiClient.put(`/api/admin/users/${userId}`, data),
    getApplications: (params) => apiClient.get('/api/admin/applications', { params }),
    reviewApplication: (applicationId, data) => 
      apiClient.put(`/api/admin/applications/${applicationId}`, data),
    getReports: (params) => apiClient.get('/api/admin/reports', { params }),
    resolveReport: (reportId, data) => apiClient.put(`/api/admin/reports/${reportId}`, data),
  },

  // Content management
  content: {
    upload: (formData) => apiClient.post('/api/content/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    getAll: (params) => apiClient.get('/api/content', { params }),
    getById: (contentId) => apiClient.get(`/api/content/${contentId}`),
    update: (contentId, data) => apiClient.put(`/api/content/${contentId}`, data),
    delete: (contentId) => apiClient.delete(`/api/content/${contentId}`),
    like: (contentId) => apiClient.post(`/api/content/${contentId}/like`),
    unlike: (contentId) => apiClient.delete(`/api/content/${contentId}/like`),
  },

  // Payments
  payments: {
    createCheckout: (data) => apiClient.post('/api/payments/create-checkout', data),
    confirmPayment: (data) => apiClient.post('/api/payments/confirm', data),
    getHistory: (params) => apiClient.get('/api/payments/history', { params }),
    refund: (paymentId, data) => apiClient.post(`/api/payments/${paymentId}/refund`, data),
  },
};

export default api;