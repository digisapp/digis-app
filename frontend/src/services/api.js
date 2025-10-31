/**
 * Stub for services/api - deprecated, use lib/api instead
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';

export const api = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
};

export const apiClient = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
};

export default api;
