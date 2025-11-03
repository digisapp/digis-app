/**
 * Stub for services/api - deprecated, use lib/api instead
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';

export const api = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,

  // Creator Payouts API
  creatorPayouts: {
    getDashboard: async () => ({ data: await apiGet('/creator-payouts/dashboard') }),
    getStripeAccount: async () => ({ data: await apiGet('/creator-payouts/stripe-account') }),
    getSettings: async () => ({ data: await apiGet('/creator-payouts/settings') }),
    updateSettings: async (settings) => ({ data: await apiPut('/creator-payouts/settings', settings) }),
    getHistory: async (params) => ({ data: await apiGet('/creator-payouts/history', params) }),
    createStripeAccount: async () => ({ data: await apiPost('/creator-payouts/stripe-account/create') }),
    requestPayout: async () => ({ data: await apiPost('/creator-payouts/request-payout') }),
  },

  // Stripe API
  stripe: {
    getAccount: async () => ({ data: await apiGet('/stripe/account') }),
    createAccountLink: async () => ({ data: await apiPost('/stripe/account-link') }),
    refreshAccount: async () => ({ data: await apiPost('/stripe/refresh-account') }),
  }
};

export const apiClient = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
};

export default api;
