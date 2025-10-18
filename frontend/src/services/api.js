// API client using enhanced Supabase authentication
import axios from 'axios';
import { BACKEND_URL } from '../config/runtime';
import { getAuthToken, refreshSession, retry } from '../utils/supabase-auth-enhanced';

const API_BASE_URL = BACKEND_URL;

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

// Response interceptor for error handling with enhanced retry
apiClient.interceptors.response.use(
  (response) => response,
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
      
      // Don't auto-retry, just reject with the error
      // This prevents infinite retry loops
      error.response.data = {
        ...error.response.data,
        retryAfter,
        message: `Too many requests. Please wait ${retryAfter} seconds.`
      };
    }
    
    return Promise.reject(error);
  }
);

export const api = {
  // Auth endpoints
  auth: {
    syncUser: (data) => apiClient.post('/auth/sync-user', data),
    getProfile: () => apiClient.get('/auth/profile'),
    updateProfile: (data) => apiClient.put('/auth/profile', data),
    applyCreator: (data) => apiClient.post('/auth/apply-creator', data),
    checkUsername: (username) => apiClient.get(`/auth/check-username/${username}`),
    deleteAccount: (data) => apiClient.delete('/auth/account', { data }),
  },

  // User endpoints
  users: {
    search: (query) => apiClient.get(`/users/search?q=${query}`),
    getById: (id) => apiClient.get(`/users/${id}`),
    update: (id, data) => apiClient.put(`/users/${id}`, data),
    follow: (creatorId) => apiClient.post(`/users/${creatorId}/follow`),
    unfollow: (creatorId) => apiClient.delete(`/users/${creatorId}/follow`),
    getFollowers: (id) => apiClient.get(`/users/${id}/followers`),
    getFollowing: (id) => apiClient.get(`/users/${id}/following`),
    getCreators: (params) => apiClient.get('/users/creators', { params }),
    startSession: (creatorId, type) => apiClient.post(`/users/${creatorId}/session`, { type }),
    endSession: (sessionId) => apiClient.post(`/users/sessions/${sessionId}/end`),
    getCurrentSession: () => apiClient.get('/users/sessions/current'),
    getSessionHistory: () => apiClient.get('/users/sessions/history'),
    uploadProfilePicture: (formData) => apiClient.post('/users/upload-avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  },

  // Token endpoints
  tokens: {
    getBalance: () => apiClient.get('/tokens/balance'),
    purchase: (data) => apiClient.post('/tokens/purchase', data),
    getTransactions: () => apiClient.get('/tokens/transactions'),
    sendTip: (data) => apiClient.post('/tokens/tip', data),
    calculateCost: (minutes, ratePerMin) => apiClient.post('/tokens/calculate-cost', { minutes, ratePerMin }),
  },

  // Payment endpoints
  payments: {
    createIntent: (data) => apiClient.post('/payments/create-intent', data),
    confirmPayment: (data) => apiClient.post('/payments/confirm', data),
    getHistory: () => apiClient.get('/payments/history'),
    setupPaymentMethod: (data) => apiClient.post('/payments/setup-method', data),
    getPaymentMethods: () => apiClient.get('/payments/methods'),
    deletePaymentMethod: (methodId) => apiClient.delete(`/payments/methods/${methodId}`),
  },

  // Agora endpoints
  agora: {
    getToken: (channelName, role = 'publisher') => 
      apiClient.post('/agora/token', { channelName, role }),
    getRtmToken: (userId) => apiClient.post('/agora/rtm-token', { userId }),
    recordingStart: (data) => apiClient.post('/agora/recording/start', data),
    recordingStop: (data) => apiClient.post('/agora/recording/stop', data),
    recordingQuery: (sid, resourceId) => 
      apiClient.get(`/agora/recording/query/${sid}/${resourceId}`),
  },

  // Subscription endpoints
  subscriptions: {
    subscribe: (creatorId, tierId) => apiClient.post(`/subscriptions/${creatorId}/subscribe`, { tierId }),
    unsubscribe: (subscriptionId) => apiClient.delete(`/subscriptions/${subscriptionId}`),
    getMySubscriptions: () => apiClient.get('/subscriptions/my-subscriptions'),
    getSubscribers: () => apiClient.get('/subscriptions/my-subscribers'),
    getTiers: (creatorId) => apiClient.get(`/subscriptions/${creatorId}/tiers`),
    createTier: (data) => apiClient.post('/subscriptions/tiers', data),
    updateTier: (tierId, data) => apiClient.put(`/subscriptions/tiers/${tierId}`, data),
    deleteTier: (tierId) => apiClient.delete(`/subscriptions/tiers/${tierId}`),
    // Additional subscription endpoints
    getCreatorTiers: (creatorId) => apiClient.get(`/subscriptions/creator/${creatorId}/tier-pricing`),
    getMySubscribers: () => apiClient.get('/subscriptions/my-subscribers'),
    updateTierPricing: (data) => apiClient.put('/subscriptions/tier-pricing', data),
  },

  // Chat/Message endpoints
  chat: {
    sendMessage: (sessionId, message) => apiClient.post(`/chat/${sessionId}/message`, { message }),
    getMessages: (sessionId) => apiClient.get(`/chat/${sessionId}/messages`),
    deleteMessage: (messageId) => apiClient.delete(`/chat/messages/${messageId}`),
    markAsRead: (sessionId) => apiClient.post(`/chat/${sessionId}/read`),
  },

  // Notification endpoints
  notifications: {
    getAll: () => apiClient.get('/notifications'),
    markAsRead: (notificationId) => apiClient.put(`/notifications/${notificationId}/read`),
    markAllAsRead: () => apiClient.put('/notifications/read-all'),
    updateSettings: (settings) => apiClient.put('/notifications/settings', settings),
    getSettings: () => apiClient.get('/notifications/settings'),
  },

  // Creator endpoints
  creators: {
    getAll: (params) => apiClient.get('/creators', { params }),
    getById: (id) => apiClient.get(`/creators/${id}`),
    search: (query) => apiClient.get(`/creators/search?q=${query}`),
    getCategories: () => apiClient.get('/creators/categories'),
    getRecommended: () => apiClient.get('/creators/recommended'),
    getTrending: () => apiClient.get('/creators/trending'),
  },

  // Analytics endpoints
  analytics: {
    getCreatorStats: () => apiClient.get('/analytics/creator-stats'),
    getEarnings: (period) => apiClient.get(`/analytics/earnings?period=${period}`),
    getViewerStats: () => apiClient.get('/analytics/viewer-stats'),
    getSessionAnalytics: (sessionId) => apiClient.get(`/analytics/sessions/${sessionId}`),
  },

  // Streaming endpoints
  streaming: {
    startStream: (data) => apiClient.post('/streaming/start', data),
    endStream: (streamId) => apiClient.post(`/streaming/${streamId}/end`),
    getActiveStreams: () => apiClient.get('/streaming/active'),
    joinStream: (streamId) => apiClient.post(`/streaming/${streamId}/join`),
    leaveStream: (streamId) => apiClient.post(`/streaming/${streamId}/leave`),
    sendStreamTip: (streamId, amount) => apiClient.post(`/streaming/${streamId}/tip`, { amount }),
  },

  // Classes endpoints
  classes: {
    create: (data) => apiClient.post('/classes', data),
    getAll: (params) => apiClient.get('/classes', { params }),
    getById: (id) => apiClient.get(`/classes/${id}`),
    update: (id, data) => apiClient.put(`/classes/${id}`, data),
    delete: (id) => apiClient.delete(`/classes/${id}`),
    enroll: (classId) => apiClient.post(`/classes/${classId}/enroll`),
    unenroll: (classId) => apiClient.delete(`/classes/${classId}/enroll`),
    getMyClasses: () => apiClient.get('/classes/my-classes'),
    getMyEnrollments: () => apiClient.get('/classes/my-enrollments'),
  },

  // Collaboration endpoints
  collaborations: {
    invite: (data) => apiClient.post('/collaborations/invite', data),
    accept: (inviteId) => apiClient.post(`/collaborations/${inviteId}/accept`),
    decline: (inviteId) => apiClient.post(`/collaborations/${inviteId}/decline`),
    getInvites: () => apiClient.get('/collaborations/invites'),
    getActive: () => apiClient.get('/collaborations/active'),
  },

  // Privacy endpoints
  privacy: {
    getSettings: () => apiClient.get('/privacy/settings'),
    updateSettings: (settings) => apiClient.put('/privacy/settings', settings),
    blockUser: (userId) => apiClient.post(`/privacy/block/${userId}`),
    unblockUser: (userId) => apiClient.delete(`/privacy/block/${userId}`),
    getBlockedUsers: () => apiClient.get('/privacy/blocked-users'),
  },

  // Creator Payouts endpoints
  creatorPayouts: {
    getDashboard: () => apiClient.get('/creator-payouts/dashboard'),
    getStripeAccount: () => apiClient.get('/creator-payouts/stripe-account'),
    getSettings: () => apiClient.get('/creator-payouts/settings'),
    updateSettings: (settings) => apiClient.put('/creator-payouts/settings', settings),
    requestPayout: (data) => apiClient.post('/creator-payouts/request', data),
    getPayoutHistory: () => apiClient.get('/creator-payouts/history'),
    setupStripe: () => apiClient.post('/creator-payouts/stripe/onboard'),
    refreshStripeLink: () => apiClient.post('/creator-payouts/stripe/refresh-link'),
    createStripeAccount: () => apiClient.post('/creator-payouts/stripe/create'),
  },
  
  // Messages endpoints
  messages: {
    getConversations: () => apiClient.get('/messages/conversations'),
    getMessages: (userId) => apiClient.get(`/messages/conversation/${userId}`),
    sendMessage: (data) => apiClient.post('/messages/send', data),
    markAsRead: (userId) => apiClient.put(`/messages/conversation/${userId}/read`),
    deleteMessage: (messageId) => apiClient.delete(`/messages/${messageId}`),
    getUnreadCount: () => apiClient.get('/messages/unread-count'),
  },
  
  // Earnings endpoints
  earnings: {
    getCreatorEarnings: () => apiClient.get('/earnings/creator'),
    getEarningsHistory: () => apiClient.get('/earnings/history'),
    requestPayout: (data) => apiClient.post('/earnings/payout', data),
  },

  // Schedule endpoints
  schedule: {
    getUpcoming: () => apiClient.get('/schedule/upcoming'),
    createEvent: (data) => apiClient.post('/schedule/events', data),
    updateEvent: (id, data) => apiClient.put(`/schedule/events/${id}`, data),
    deleteEvent: (id) => apiClient.delete(`/schedule/events/${id}`),
  },
  
  // Call requests endpoints
  calls: {
    getRequests: () => apiClient.get('/calls/requests'),
    sendRequest: (data) => apiClient.post('/calls/request', data),
    acceptRequest: (requestId) => apiClient.post(`/calls/request/${requestId}/accept`),
    declineRequest: (requestId) => apiClient.post(`/calls/request/${requestId}/decline`),
    cancelRequest: (requestId) => apiClient.delete(`/calls/request/${requestId}`),
  },
};

// Export both the client and the main api object
export { apiClient };
export default api;