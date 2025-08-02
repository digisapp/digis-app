import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { supabase } from '../utils/supabase-auth';
import { env } from '../config/env';
import toast from 'react-hot-toast';

// Types
interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

interface ApiResponse<T = any> {
  data: T;
  message?: string;
  timestamp?: string;
}

// Create axios instance with defaults
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: env.BACKEND_URL || import.meta.env.VITE_BACKEND_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - add auth token
  client.interceptors.request.use(
    async (config) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const token = session.access_token;
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error('Error getting auth token:', error);
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - handle errors
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiError>) => {
      // Network error
      if (!error.response) {
        toast.error('Network error. Please check your connection.');
        return Promise.reject(error);
      }

      const { status, data } = error.response;

      // Handle specific status codes
      switch (status) {
        case 401:
          // Token expired or invalid
          try {
            await supabase.auth.refreshSession(); // Force refresh
            // Retry the original request
            return client.request(error.config!);
          } catch {
            // Refresh failed, sign out
            await supabase.auth.signOut();
            window.location.href = '/login';
          }
          break;

        case 403:
          toast.error('Access denied. You don\'t have permission to perform this action.');
          break;

        case 404:
          toast.error('Resource not found.');
          break;

        case 429:
          toast.error('Too many requests. Please try again later.');
          break;

        case 500:
          toast.error('Server error. Please try again later.');
          break;

        default:
          if (data?.message) {
            toast.error(data.message);
          }
      }

      return Promise.reject(error);
    }
  );

  return client;
};

// Create the API client instance
export const apiClient = createApiClient();

// Type-safe API methods
export const api = {
  // GET request
  get: <T = any>(url: string, config?: AxiosRequestConfig) =>
    apiClient.get<ApiResponse<T>>(url, config).then(res => res.data),

  // POST request
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.post<ApiResponse<T>>(url, data, config).then(res => res.data),

  // PUT request
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.put<ApiResponse<T>>(url, data, config).then(res => res.data),

  // PATCH request
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.patch<ApiResponse<T>>(url, data, config).then(res => res.data),

  // DELETE request
  delete: <T = any>(url: string, config?: AxiosRequestConfig) =>
    apiClient.delete<ApiResponse<T>>(url, config).then(res => res.data),
};

// Specialized API services
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
    
  signup: (data: any) =>
    api.post('/auth/signup', data),
    
  logout: () =>
    api.post('/auth/logout'),
    
  refreshToken: () =>
    api.post('/auth/refresh'),
};

export const userApi = {
  getProfile: () =>
    api.get('/users/profile'),
    
  updateProfile: (data: any) =>
    api.put('/users/profile', data),
    
  getCreators: (params?: any) =>
    api.get('/users/creators', { params }),
    
  getCreatorProfile: (username: string) =>
    api.get(`/users/public/creator/${username}`),
};

export const tokenApi = {
  getBalance: () =>
    api.get('/tokens/balance'),
    
  purchase: (amount: number) =>
    api.post('/tokens/purchase', { amount }),
    
  tip: (creatorId: string, amount: number, message?: string) =>
    api.post(`/tokens/tip/${creatorId}`, { amount, message }),
};

export const sessionApi = {
  create: (data: any) =>
    api.post('/sessions/create', data),
    
  join: (sessionId: string) =>
    api.post(`/sessions/join/${sessionId}`),
    
  end: (sessionId: string) =>
    api.post(`/sessions/end/${sessionId}`),
};

// File upload helper
export const uploadFile = async (
  url: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);

  return apiClient.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  }).then(res => res.data);
};