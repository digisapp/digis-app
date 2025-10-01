/**
 * Supabase Client v2 - Frontend Implementation with Latest Features
 * Implements asymmetric JWT, real-time enhancements, and observability
 */

import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';

// Retry utility for resilience
const retry = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on specific errors
      if (error.message?.includes('Invalid login credentials') ||
          error.message?.includes('Email not confirmed') ||
          error.status === 422) {
        throw error;
      }
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      const waitTime = delay * Math.pow(2, i);
      console.warn(`Retry ${i + 1}/${maxRetries} after ${waitTime}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
};

// Environment validation
const validateEnvironment = () => {
  const supabaseUrl = ENV.SUPABASE?.URL || import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = ENV.SUPABASE?.ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase configuration');
    return null;
  }
  
  return { supabaseUrl, supabaseAnonKey };
};

// Initialize enhanced Supabase client
const initializeSupabase = () => {
  const config = validateEnvironment();
  
  if (!config) {
    console.error('❌ Supabase initialization failed');
    return null;
  }
  
  const { supabaseUrl, supabaseAnonKey } = config;
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce', // Enhanced security with PKCE flow
      storage: window.localStorage,
      storageKey: 'digis-auth-token-v2',
      debug: import.meta.env.DEV,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
        log_level: import.meta.env.DEV ? 'debug' : 'error',
      },
      heartbeatIntervalMs: 30000,
      timeout: 10000,
      reconnectAfterMs: (tries) => {
        // Exponential backoff
        return Math.min(1000 * Math.pow(2, tries), 30000);
      },
    },
    global: {
      headers: {
        'x-client-info': 'digis-frontend/2.0.0'
      },
    },
    // New: Add query configuration
    db: {
      schema: 'public',
    },
  });
};

// Initialize Supabase
export const supabase = initializeSupabase();

/**
 * Analytics Bucket Integration
 * For frontend analytics tracking
 */
export const analytics = {
  /**
   * Track page view
   */
  async trackPageView(page, metadata = {}) {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('page_views')
        .insert({
          page_url: page,
          user_id: (await supabase.auth.getUser())?.data?.user?.id,
          metadata,
          timestamp: new Date().toISOString(),
          session_id: sessionStorage.getItem('session_id') || generateSessionId(),
        });
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Page view tracking error:', error);
    }
  },
  
  /**
   * Track custom event
   */
  async trackEvent(eventName, properties = {}) {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('analytics_events')
        .insert({
          event_name: eventName,
          event_data: properties, // Changed from 'properties' to 'event_data' to match table schema
          user_id: (await supabase.auth.getUser())?.data?.user?.id,
          created_at: new Date().toISOString(), // Changed from 'timestamp' to 'created_at'
        });
      
      if (error) throw error;
      
      // Also send to real-time analytics
      await supabase
        .channel('analytics')
        .send({
          type: 'broadcast',
          event: 'custom_event',
          payload: { eventName, properties }
        });
      
      return data;
    } catch (error) {
      console.error('Event tracking error:', error);
    }
  },
  
  /**
   * Track performance metrics
   */
  trackPerformance() {
    if (!window.performance || !supabase) return;
    
    const perfData = window.performance.getEntriesByType('navigation')[0];
    
    if (perfData) {
      this.trackEvent('performance_metrics', {
        dns: perfData.domainLookupEnd - perfData.domainLookupStart,
        tcp: perfData.connectEnd - perfData.connectStart,
        request: perfData.responseStart - perfData.requestStart,
        response: perfData.responseEnd - perfData.responseStart,
        dom: perfData.domInteractive - perfData.responseEnd,
        load: perfData.loadEventEnd - perfData.navigationStart,
      });
    }
  },
};

/**
 * Real-time Enhanced Features
 */
export const realtime = {
  channels: new Map(),
  
  /**
   * Subscribe to database changes with enhanced filtering
   */
  subscribeToTable(table, filters = {}, callback) {
    if (!supabase) return () => {};
    
    const channelName = `${table}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: filters.event || '*',
          schema: filters.schema || 'public',
          table: table,
          filter: filters.filter,
        },
        (payload) => {
          console.log(`[Realtime] ${table} event:`, payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to ${table}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Subscription error for ${table}`);
        } else if (status === 'TIMED_OUT') {
          console.error(`⏱️ Subscription timeout for ${table}`);
        }
      });
    
    this.channels.set(channelName, channel);
    
    // Return cleanup function
    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    };
  },
  
  /**
   * Broadcast to channel
   */
  async broadcast(channelName, event, payload) {
    if (!supabase) return;
    
    const channel = supabase.channel(channelName);
    
    const result = await channel.send({
      type: 'broadcast',
      event,
      payload: {
        ...payload,
        timestamp: Date.now(),
        sender_id: (await supabase.auth.getUser())?.data?.user?.id,
      }
    });
    
    return result;
  },
  
  /**
   * Presence tracking with enhanced features
   */
  trackPresence(channelName, userInfo = {}) {
    if (!supabase) return;
    
    const channel = supabase.channel(channelName);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.log('Presence sync:', state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', { key, newPresences });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', { key, leftPresences });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const user = (await supabase.auth.getUser())?.data?.user;
          await channel.track({
            user_id: user?.id,
            email: user?.email,
            online_at: new Date().toISOString(),
            ...userInfo
          });
        }
      });
    
    this.channels.set(`presence-${channelName}`, channel);
    
    return channel;
  },
  
  /**
   * Cleanup all channels
   */
  cleanup() {
    this.channels.forEach(channel => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }
};

/**
 * Observability Features
 */
export const observability = {
  logs: [],
  maxLogs: 100,
  
  /**
   * Log client-side event
   */
  log(level, message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        url: window.location.href,
        userAgent: navigator.userAgent,
        sessionId: sessionStorage.getItem('session_id'),
      }
    };
    
    // Store locally
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Console output in development
    if (import.meta.env.DEV) {
      console[level](message, context);
    }
    
    // Send to server in batches
    this.flushLogs();
    
    return logEntry;
  },
  
  /**
   * Flush logs to server
   */
  async flushLogs() {
    if (!supabase || this.logs.length === 0) return;
    
    // Batch logs every 10 entries or 5 seconds
    if (this.logs.length >= 10 || 
        Date.now() - (this.lastFlush || 0) > 5000) {
      
      const logsToSend = [...this.logs];
      this.logs = [];
      this.lastFlush = Date.now();
      
      try {
        await supabase
          .from('client_logs')
          .insert(logsToSend);
      } catch (error) {
        console.error('Failed to send logs:', error);
        // Re-add logs if send failed
        this.logs.unshift(...logsToSend.slice(-50));
      }
    }
  },
  
  /**
   * Track error with context
   */
  trackError(error, context = {}) {
    this.log('error', error.message || 'Unknown error', {
      ...context,
      stack: error.stack,
      name: error.name,
    });
    
    // Also track in analytics
    analytics.trackEvent('error', {
      message: error.message,
      stack: error.stack,
      ...context
    });
  },
  
  /**
   * Create performance observer
   */
  observePerformance() {
    if (!window.PerformanceObserver) return;
    
    // Observe long tasks
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            this.log('warn', 'Long task detected', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
            });
          }
        }
      });
      
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      console.warn('Performance observer not supported');
    }
  }
};

/**
 * Edge Functions Client
 */
export const edge = {
  /**
   * Invoke edge function
   */
  async invoke(functionName, payload = {}, options = {}) {
    if (!supabase) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
        headers: options.headers || {},
      });
      
      if (error) throw error;
      
      observability.log('info', `Edge function ${functionName} invoked`, {
        payload,
        response: data
      });
      
      return data;
    } catch (error) {
      observability.trackError(error, { 
        function: functionName, 
        payload 
      });
      throw error;
    }
  }
};

/**
 * Vector/AI Features
 */
export const ai = {
  /**
   * Search with embeddings
   */
  async semanticSearch(query, options = {}) {
    if (!supabase) return [];
    
    try {
      const { data, error } = await supabase
        .rpc('semantic_search', {
          query_text: query,
          match_count: options.limit || 10,
          match_threshold: options.threshold || 0.5,
        });
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      observability.trackError(error, { query, options });
      throw error;
    }
  },
  
  /**
   * Get AI recommendations
   */
  async getRecommendations(userId, type = 'content') {
    if (!supabase) return [];
    
    try {
      const { data, error } = await edge.invoke('recommendations', {
        user_id: userId,
        recommendation_type: type,
        limit: 10,
      });
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      observability.trackError(error, { userId, type });
      return [];
    }
  }
};

/**
 * Authentication Enhancements
 */
export const auth = {
  /**
   * Sign in with enhanced error handling
   */
  async signIn(email, password) {
    if (!supabase) throw new Error('Supabase not initialized');
    
    return retry(async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // Track sign in
      analytics.trackEvent('sign_in', { method: 'password' });
      
      return data;
    });
  },
  
  /**
   * Sign in with OAuth provider
   */
  async signInWithProvider(provider) {
    if (!supabase) throw new Error('Supabase not initialized');
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: provider === 'google' ? 'openid profile email' : undefined,
      }
    });
    
    if (error) throw error;
    
    analytics.trackEvent('sign_in', { method: provider });
    
    return data;
  },
  
  /**
   * Sign out with cleanup
   */
  async signOut() {
    if (!supabase) return;
    
    // Clean up real-time subscriptions
    realtime.cleanup();
    
    // Clear local storage
    localStorage.removeItem('digis-user-cache');
    sessionStorage.clear();
    
    const { error } = await supabase.auth.signOut();
    
    if (error) throw error;
    
    analytics.trackEvent('sign_out');
    
    // Flush remaining logs
    await observability.flushLogs();
  },
  
  /**
   * Get current session with caching
   */
  async getSession() {
    if (!supabase) return null;
    
    const cached = sessionStorage.getItem('session-cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < 60000) { // 1 minute cache
        return parsed.session;
      }
    }
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    
    if (session) {
      sessionStorage.setItem('session-cache', JSON.stringify({
        session,
        timestamp: Date.now()
      }));
    }
    
    return session;
  }
};

// Helper functions
function generateSessionId() {
  const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('session_id', id);
  return id;
}

// Initialize session ID
if (typeof window !== 'undefined' && !sessionStorage.getItem('session_id')) {
  generateSessionId();
}

// Initialize performance observer
if (typeof window !== 'undefined') {
  observability.observePerformance();
  
  // Track page performance on load
  window.addEventListener('load', () => {
    analytics.trackPerformance();
  });
  
  // Cleanup on unload
  window.addEventListener('beforeunload', async () => {
    await observability.flushLogs();
    realtime.cleanup();
  });
}

// Export everything
export default {
  supabase,
  analytics,
  realtime,
  observability,
  edge,
  ai,
  auth,
  retry,
};