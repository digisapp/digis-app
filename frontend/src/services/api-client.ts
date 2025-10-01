import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { supabase } from '../utils/supabase-auth';

interface RetryConfig {
  retries: number;
  retryDelay: (retryCount: number) => number;
  retryCondition: (error: AxiosError) => boolean;
}

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  key: (config: AxiosRequestConfig) => string;
}

class ApiClient {
  private instance: AxiosInstance;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  
  constructor() {
    this.instance = axios.create({
      baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    this.setupInterceptors();
  }
  
  private setupInterceptors() {
    // Request interceptor for authentication
    this.instance.interceptors.request.use(
      async (config) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const token = session.access_token;
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Failed to get auth token:', error);
        }
        
        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();
        
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor for error handling and retry
    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Handle 401 errors - token might be expired
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              await supabase.auth.refreshSession(); // Force refresh
              const { data: { session: newSession } } = await supabase.auth.getSession();
              const newToken = newSession?.access_token;
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.instance(originalRequest);
            }
          } catch (refreshError) {
            // Redirect to login
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }
        
        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            await this.delay(parseInt(retryAfter) * 1000);
            return this.instance(originalRequest);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Make a GET request with caching
   */
  async get<T>(url: string, config?: AxiosRequestConfig & { cache?: CacheConfig }): Promise<T> {
    // Check cache first
    if (config?.cache) {
      const cacheKey = config.cache.key({ ...config, url, method: 'GET' });
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < config.cache.ttl) {
        return cached.data;
      }
    }
    
    const response = await this.instance.get<T>(url, config);
    
    // Cache the response
    if (config?.cache) {
      const cacheKey = config.cache.key({ ...config, url, method: 'GET' });
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
      });
    }
    
    return response.data;
  }
  
  /**
   * Make a POST request
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.post<T>(url, data, config);
    return response.data;
  }
  
  /**
   * Make a PUT request
   */
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.put<T>(url, data, config);
    return response.data;
  }
  
  /**
   * Make a DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }
  
  /**
   * Make a request with retry logic
   */
  async withRetry<T>(
    request: () => Promise<T>,
    retryConfig: Partial<RetryConfig> = {}
  ): Promise<T> {
    const config: RetryConfig = {
      retries: 3,
      retryDelay: (retryCount) => Math.min(1000 * 2 ** retryCount, 10000),
      retryCondition: (error) => {
        return !error.response || error.response.status >= 500;
      },
      ...retryConfig,
    };
    
    let lastError: Error | null = null;
    
    for (let i = 0; i <= config.retries; i++) {
      try {
        return await request();
      } catch (error) {
        lastError = error as Error;
        
        if (i === config.retries || !config.retryCondition(error as AxiosError)) {
          throw error;
        }
        
        await this.delay(config.retryDelay(i));
      }
    }
    
    throw lastError;
  }
  
  /**
   * Upload file with progress tracking
   */
  async uploadFile(
    url: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.instance.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  }
  
  /**
   * Cancel all pending requests
   */
  cancelAllRequests() {
    // Implementation would require storing cancel tokens
    console.log('Cancelling all requests');
  }
  
  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
  
  /**
   * Helper to generate request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export typed API methods
export const api = {
  // User endpoints
  users: {
    getProfile: (userId: string) => 
      apiClient.get<User>(`/api/users/${userId}`, {
        cache: {
          ttl: 5 * 60 * 1000, // 5 minutes
          key: (_config) => `user-profile-${userId}`,
        },
      }),
    
    updateProfile: (userId: string, data: Partial<User>) =>
      apiClient.put<User>(`/api/users/${userId}`, data),
    
    getCreators: (params?: { page?: number; limit?: number }) =>
      apiClient.get<{ creators: Creator[]; total: number }>('/api/users/creators', { params }),
  },
  
  // Session endpoints
  sessions: {
    create: (data: CreateSessionRequest) =>
      apiClient.post<Session>('/api/sessions', data),
    
    join: (sessionId: string) =>
      apiClient.post<SessionToken>(`/api/sessions/${sessionId}/join`),
    
    end: (sessionId: string) =>
      apiClient.post(`/api/sessions/${sessionId}/end`),
  },
  
  // Token endpoints
  tokens: {
    getBalance: () =>
      apiClient.get<{ balance: number }>('/api/tokens/balance'),
    
    purchase: (data: TokenPurchaseRequest) =>
      apiClient.withRetry(() => 
        apiClient.post<TokenPurchaseResponse>('/api/tokens/purchase', data)
      ),
  },
  
  // Agora endpoints
  agora: {
    getToken: (channel: string, uid: string, role: 'host' | 'audience') =>
      apiClient.get<{ token: string }>('/api/agora/token', {
        params: { channel, uid, role },
      }),
  },
};

// Type definitions
interface User {
  id: string;
  email: string;
  username: string;
  profilePicUrl?: string;
  bio?: string;
  isCreator: boolean;
}

interface Creator extends User {
  pricePerMin: number;
  rating: number;
  totalSessions: number;
}

interface Session {
  id: string;
  creatorId: string;
  fanId: string;
  type: 'video' | 'voice' | 'stream';
  status: 'scheduled' | 'active' | 'ended';
  startTime: string;
  endTime?: string;
}

interface SessionToken {
  sessionId: string;
  agoraToken: string;
  channel: string;
}

interface CreateSessionRequest {
  creatorId: string;
  type: 'video' | 'voice' | 'stream';
  scheduledTime?: string;
}

interface TokenPurchaseRequest {
  packageId: number;
  paymentMethodId: string;
}

interface TokenPurchaseResponse {
  success: boolean;
  newBalance: number;
  transactionId: string;
}