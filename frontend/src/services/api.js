// API client using Supabase authentication
import axios from 'axios';
import { ENV } from '../config/env';
import { getAuthToken } from '../utils/supabase-auth';

const API_BASE_URL = ENV.BACKEND_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.error('API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      // Token might be expired, try to refresh
      try {
        const { refreshSession } = await import('../utils/supabase-auth');
        const { session, error: refreshError } = await refreshSession();
        
        if (!refreshError && session) {
          // Retry the original request with new token
          error.config.headers.Authorization = `Bearer ${session.access_token}`;
          return apiClient.request(error.config);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
      
      // If refresh fails, redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export const api = {
  // Auth endpoints
  auth: {
    syncUser: (data) => apiClient.post('/api/auth/sync-user', data),
    getProfile: () => apiClient.get('/api/auth/profile'),
    updateProfile: (data) => apiClient.put('/api/auth/profile', data),
    applyCreator: (data) => apiClient.post('/api/auth/apply-creator', data),
    checkUsername: (username) => apiClient.get(`/api/auth/check-username/${username}`),
    deleteAccount: (data) => apiClient.delete('/api/auth/account', { data }),
  },

  // User endpoints
  users: {
    search: (query) => apiClient.get(`/api/users/search?q=${query}`),
    getById: (id) => apiClient.get(`/api/users/${id}`),
    update: (id, data) => apiClient.put(`/api/users/${id}`, data),
    follow: (creatorId) => apiClient.post(`/api/users/${creatorId}/follow`),
    unfollow: (creatorId) => apiClient.delete(`/api/users/${creatorId}/follow`),
    getFollowers: (id) => apiClient.get(`/api/users/${id}/followers`),
    getFollowing: (id) => apiClient.get(`/api/users/${id}/following`),
    getCreators: (params) => apiClient.get('/api/users/creators', { params }),
    startSession: (creatorId, type) => apiClient.post(`/api/users/${creatorId}/session`, { type }),
    endSession: (sessionId) => apiClient.post(`/api/users/sessions/${sessionId}/end`),
    getCurrentSession: () => apiClient.get('/api/users/sessions/current'),
    getSessionHistory: () => apiClient.get('/api/users/sessions/history'),
    uploadProfilePicture: (formData) => apiClient.post('/api/users/upload-avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  },

  // Token endpoints
  tokens: {
    getBalance: () => apiClient.get('/api/tokens/balance'),
    purchase: (data) => apiClient.post('/api/tokens/purchase', data),
    getTransactions: () => apiClient.get('/api/tokens/transactions'),
    sendTip: (data) => apiClient.post('/api/tokens/tip', data),
    calculateCost: (minutes, ratePerMin) => apiClient.post('/api/tokens/calculate-cost', { minutes, ratePerMin }),
  },

  // Payment endpoints
  payments: {
    createIntent: (data) => apiClient.post('/api/payments/create-intent', data),
    confirmPayment: (data) => apiClient.post('/api/payments/confirm', data),
    getHistory: () => apiClient.get('/api/payments/history'),
    setupPaymentMethod: (data) => apiClient.post('/api/payments/setup-method', data),
    getPaymentMethods: () => apiClient.get('/api/payments/methods'),
    deletePaymentMethod: (methodId) => apiClient.delete(`/api/payments/methods/${methodId}`),
  },

  // Agora endpoints
  agora: {
    getToken: (channelName, role = 'publisher') => 
      apiClient.post('/api/agora/token', { channelName, role }),
    getRtmToken: (userId) => apiClient.post('/api/agora/rtm-token', { userId }),
    recordingStart: (data) => apiClient.post('/api/agora/recording/start', data),
    recordingStop: (data) => apiClient.post('/api/agora/recording/stop', data),
    recordingQuery: (sid, resourceId) => 
      apiClient.get(`/api/agora/recording/query/${sid}/${resourceId}`),
  },

  // Subscription endpoints
  subscriptions: {
    subscribe: (creatorId, tierId) => apiClient.post(`/api/subscriptions/${creatorId}/subscribe`, { tierId }),
    unsubscribe: (subscriptionId) => apiClient.delete(`/api/subscriptions/${subscriptionId}`),
    getMySubscriptions: () => apiClient.get('/api/subscriptions/my-subscriptions'),
    getSubscribers: () => apiClient.get('/api/subscriptions/my-subscribers'),
    getTiers: (creatorId) => apiClient.get(`/api/subscriptions/${creatorId}/tiers`),
    createTier: (data) => apiClient.post('/api/subscriptions/tiers', data),
    updateTier: (tierId, data) => apiClient.put(`/api/subscriptions/tiers/${tierId}`, data),
    deleteTier: (tierId) => apiClient.delete(`/api/subscriptions/tiers/${tierId}`),
  },

  // Chat/Message endpoints
  chat: {
    sendMessage: (sessionId, message) => apiClient.post(`/api/chat/${sessionId}/message`, { message }),
    getMessages: (sessionId) => apiClient.get(`/api/chat/${sessionId}/messages`),
    deleteMessage: (messageId) => apiClient.delete(`/api/chat/messages/${messageId}`),
    markAsRead: (sessionId) => apiClient.post(`/api/chat/${sessionId}/read`),
  },

  // Notification endpoints
  notifications: {
    getAll: () => apiClient.get('/api/notifications'),
    markAsRead: (notificationId) => apiClient.put(`/api/notifications/${notificationId}/read`),
    markAllAsRead: () => apiClient.put('/api/notifications/read-all'),
    updateSettings: (settings) => apiClient.put('/api/notifications/settings', settings),
    getSettings: () => apiClient.get('/api/notifications/settings'),
  },

  // Creator endpoints
  creators: {
    getAll: (params) => apiClient.get('/api/creators', { params }),
    getById: (id) => apiClient.get(`/api/creators/${id}`),
    search: (query) => apiClient.get(`/api/creators/search?q=${query}`),
    getCategories: () => apiClient.get('/api/creators/categories'),
    getRecommended: () => apiClient.get('/api/creators/recommended'),
    getTrending: () => apiClient.get('/api/creators/trending'),
  },

  // Analytics endpoints
  analytics: {
    getCreatorStats: () => apiClient.get('/api/analytics/creator-stats'),
    getEarnings: (period) => apiClient.get(`/api/analytics/earnings?period=${period}`),
    getViewerStats: () => apiClient.get('/api/analytics/viewer-stats'),
    getSessionAnalytics: (sessionId) => apiClient.get(`/api/analytics/sessions/${sessionId}`),
  },

  // Streaming endpoints
  streaming: {
    startStream: (data) => apiClient.post('/api/streaming/start', data),
    endStream: (streamId) => apiClient.post(`/api/streaming/${streamId}/end`),
    getActiveStreams: () => apiClient.get('/api/streaming/active'),
    joinStream: (streamId) => apiClient.post(`/api/streaming/${streamId}/join`),
    leaveStream: (streamId) => apiClient.post(`/api/streaming/${streamId}/leave`),
    sendStreamTip: (streamId, amount) => apiClient.post(`/api/streaming/${streamId}/tip`, { amount }),
  },

  // Classes endpoints
  classes: {
    create: (data) => apiClient.post('/api/classes', data),
    getAll: (params) => apiClient.get('/api/classes', { params }),
    getById: (id) => apiClient.get(`/api/classes/${id}`),
    update: (id, data) => apiClient.put(`/api/classes/${id}`, data),
    delete: (id) => apiClient.delete(`/api/classes/${id}`),
    enroll: (classId) => apiClient.post(`/api/classes/${classId}/enroll`),
    unenroll: (classId) => apiClient.delete(`/api/classes/${classId}/enroll`),
    getMyClasses: () => apiClient.get('/api/classes/my-classes'),
    getMyEnrollments: () => apiClient.get('/api/classes/my-enrollments'),
  },

  // Collaboration endpoints
  collaborations: {
    invite: (data) => apiClient.post('/api/collaborations/invite', data),
    accept: (inviteId) => apiClient.post(`/api/collaborations/${inviteId}/accept`),
    decline: (inviteId) => apiClient.post(`/api/collaborations/${inviteId}/decline`),
    getInvites: () => apiClient.get('/api/collaborations/invites'),
    getActive: () => apiClient.get('/api/collaborations/active'),
  },

  // Privacy endpoints
  privacy: {
    getSettings: () => apiClient.get('/api/privacy/settings'),
    updateSettings: (settings) => apiClient.put('/api/privacy/settings', settings),
    blockUser: (userId) => apiClient.post(`/api/privacy/block/${userId}`),
    unblockUser: (userId) => apiClient.delete(`/api/privacy/block/${userId}`),
    getBlockedUsers: () => apiClient.get('/api/privacy/blocked-users'),
  },
};

// Export both the client and the main api object
export { apiClient };
export default api;