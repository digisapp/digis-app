import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import socketService from '../services/socketServiceWrapper';

// Time range constants
const TIME_RANGES = {
  '1h': { label: '1 Hour', value: 1, unit: 'hour' },
  '24h': { label: '24 Hours', value: 24, unit: 'hour' },
  '7d': { label: '7 Days', value: 7, unit: 'day' },
  '30d': { label: '30 Days', value: 30, unit: 'day' },
  '90d': { label: '90 Days', value: 90, unit: 'day' }
};

// Default analytics data structure
const defaultAnalytics = {
  realTimeData: {
    currentViewers: 0,
    peakViewers: 0,
    averageWatchTime: 0,
    totalMessages: 0,
    totalTips: 0,
    revenue: 0,
    engagement: 0
  },
  historicalData: {
    viewers: [],
    revenue: [],
    engagement: [],
    messages: [],
    tips: []
  },
  demographics: {
    countries: [],
    ageGroups: [],
    devices: []
  },
  performance: {
    connectionQuality: 0,
    bufferRatio: 0,
    averageBitrate: 0
  }
};

// Analytics store with WebSocket integration and auto-refresh
export const useAnalyticsStore = create(
  devtools(
    persist(
      immer((set, get) => ({
        // ===== Analytics Data =====
        streamAnalytics: {},
        globalAnalytics: defaultAnalytics,
        timeRange: '24h',
        isLoading: false,
        error: null,
        lastUpdated: null,
        autoRefreshEnabled: true,
        refreshInterval: 30000, // 30 seconds

        // ===== Internal State =====
        _refreshTimer: null,
        _socketListeners: [],
        _isSocketConnected: false,

        // ===== Actions =====
        
        // Set time range and refetch data
        setTimeRange: (range) => {
          if (!TIME_RANGES[range]) {
            console.warn(`Invalid time range: ${range}`);
            return;
          }
          
          set((state) => {
            state.timeRange = range;
          });
          
          // Refetch data with new time range
          get().fetchAnalytics();
        },

        // Set loading state
        setLoading: (loading) => set((state) => {
          state.isLoading = loading;
        }),

        // Set error state
        setError: (error) => set((state) => {
          state.error = error;
          state.isLoading = false;
        }),

        // Clear error
        clearError: () => set((state) => {
          state.error = null;
        }),

        // Update stream analytics for specific stream
        updateStreamAnalytics: (streamId, data) => set((state) => {
          if (!state.streamAnalytics[streamId]) {
            state.streamAnalytics[streamId] = { ...defaultAnalytics };
          }
          
          // Merge real-time data
          if (data.realTimeData) {
            Object.assign(state.streamAnalytics[streamId].realTimeData, data.realTimeData);
          }
          
          // Append historical data points
          if (data.historicalData) {
            Object.keys(data.historicalData).forEach(key => {
              if (Array.isArray(data.historicalData[key])) {
                state.streamAnalytics[streamId].historicalData[key].push(...data.historicalData[key]);
                // Keep only recent data to prevent memory issues
                if (state.streamAnalytics[streamId].historicalData[key].length > 1000) {
                  state.streamAnalytics[streamId].historicalData[key] = 
                    state.streamAnalytics[streamId].historicalData[key].slice(-500);
                }
              }
            });
          }
          
          // Update demographics and performance
          if (data.demographics) {
            Object.assign(state.streamAnalytics[streamId].demographics, data.demographics);
          }
          
          if (data.performance) {
            Object.assign(state.streamAnalytics[streamId].performance, data.performance);
          }
          
          state.lastUpdated = new Date().toISOString();
        }),

        // Update global analytics
        updateGlobalAnalytics: (data) => set((state) => {
          // Merge real-time data
          if (data.realTimeData) {
            Object.assign(state.globalAnalytics.realTimeData, data.realTimeData);
          }
          
          // Append historical data
          if (data.historicalData) {
            Object.keys(data.historicalData).forEach(key => {
              if (Array.isArray(data.historicalData[key])) {
                state.globalAnalytics.historicalData[key].push(...data.historicalData[key]);
                // Keep only recent data
                if (state.globalAnalytics.historicalData[key].length > 1000) {
                  state.globalAnalytics.historicalData[key] = 
                    state.globalAnalytics.historicalData[key].slice(-500);
                }
              }
            });
          }
          
          // Update demographics and performance
          if (data.demographics) {
            Object.assign(state.globalAnalytics.demographics, data.demographics);
          }
          
          if (data.performance) {
            Object.assign(state.globalAnalytics.performance, data.performance);
          }
          
          state.lastUpdated = new Date().toISOString();
        }),

        // Fetch analytics from API
        fetchAnalytics: async (streamId = null) => {
          const state = get();
          
          try {
            state.setLoading(true);
            state.clearError();
            
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
            const timeRange = state.timeRange;
            
            const url = streamId 
              ? `${backendUrl}/api/streams/${streamId}/analytics?timeRange=${timeRange}`
              : `${backendUrl}/api/analytics/global?timeRange=${timeRange}`;
            
            const response = await fetch(url, {
              headers: {
                'Authorization': `Bearer ${await getAuthToken()}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (!response.ok) {
              throw new Error(`Analytics fetch failed: ${response.status} ${response.statusText}`);
            }
            
            const analyticsData = await response.json();
            
            if (streamId) {
              state.updateStreamAnalytics(streamId, analyticsData);
            } else {
              state.updateGlobalAnalytics(analyticsData);
            }
            
          } catch (error) {
            console.error('Failed to fetch analytics:', error);
            state.setError(error.message);
          } finally {
            state.setLoading(false);
          }
        },

        // Get analytics for specific stream
        getStreamAnalytics: (streamId) => {
          const state = get();
          return state.streamAnalytics[streamId] || { ...defaultAnalytics };
        },

        // Get global analytics
        getGlobalAnalytics: () => {
          return get().globalAnalytics;
        },

        // Enable/disable auto-refresh
        setAutoRefresh: (enabled) => set((state) => {
          state.autoRefreshEnabled = enabled;
          
          if (enabled) {
            get().startAutoRefresh();
          } else {
            get().stopAutoRefresh();
          }
        }),

        // Set refresh interval (in milliseconds)
        setRefreshInterval: (interval) => {
          if (interval < 5000) {
            console.warn('Refresh interval too short, minimum is 5 seconds');
            interval = 5000;
          }
          
          set((state) => {
            state.refreshInterval = interval;
          });
          
          // Restart auto-refresh with new interval
          if (get().autoRefreshEnabled) {
            get().stopAutoRefresh();
            get().startAutoRefresh();
          }
        },

        // Start auto-refresh timer
        startAutoRefresh: () => {
          const state = get();
          
          // Clear existing timer
          if (state._refreshTimer) {
            clearInterval(state._refreshTimer);
          }
          
          // Set new timer
          const timer = setInterval(() => {
            if (get().autoRefreshEnabled) {
              get().fetchAnalytics();
            }
          }, state.refreshInterval);
          
          set((state) => {
            state._refreshTimer = timer;
          });
        },

        // Stop auto-refresh timer
        stopAutoRefresh: () => {
          const state = get();
          
          if (state._refreshTimer) {
            clearInterval(state._refreshTimer);
            set((state) => {
              state._refreshTimer = null;
            });
          }
        },

        // Initialize WebSocket listeners for real-time updates
        initializeWebSocket: () => {
          const state = get();
          
          // Only initialize once
          if (state._socketListeners.length > 0) {
            return;
          }
          
          // Listen for stream analytics updates
          const streamAnalyticsListener = (data) => {
            console.log('Real-time stream analytics update:', data);
            if (data.streamId) {
              get().updateStreamAnalytics(data.streamId, data.analytics);
            }
          };
          
          // Listen for global analytics updates  
          const globalAnalyticsListener = (data) => {
            console.log('Real-time global analytics update:', data);
            get().updateGlobalAnalytics(data.analytics);
          };
          
          // Listen for viewer count updates
          const viewerCountListener = (data) => {
            console.log('Viewer count update:', data);
            if (data.streamId) {
              get().updateStreamAnalytics(data.streamId, {
                realTimeData: { currentViewers: data.count }
              });
            }
          };
          
          // Socket connection status listener
          const connectionListener = (status) => {
            set((state) => {
              state._isSocketConnected = status === 'connected';
            });
            
            // Fetch fresh data when reconnected
            if (status === 'connected') {
              get().fetchAnalytics();
            }
          };
          
          // Add listeners to socket
          const unsubscribeStreamAnalytics = socketService.on('stream-analytics', streamAnalyticsListener);
          const unsubscribeGlobalAnalytics = socketService.on('global-analytics', globalAnalyticsListener);
          const unsubscribeViewerCount = socketService.on('viewer-count', viewerCountListener);
          const unsubscribeConnection = socketService.onConnectionChange(connectionListener);
          
          // Store cleanup functions
          set((state) => {
            state._socketListeners = [
              unsubscribeStreamAnalytics,
              unsubscribeGlobalAnalytics, 
              unsubscribeViewerCount,
              unsubscribeConnection
            ];
          });
        },

        // Cleanup WebSocket listeners
        cleanupWebSocket: () => {
          const state = get();
          
          // Call all cleanup functions
          state._socketListeners.forEach(cleanup => {
            if (typeof cleanup === 'function') {
              cleanup();
            }
          });
          
          set((state) => {
            state._socketListeners = [];
            state._isSocketConnected = false;
          });
        },

        // Initialize the store (call this when component mounts)
        initialize: () => {
          const state = get();
          
          // Initialize WebSocket listeners
          state.initializeWebSocket();
          
          // Start auto-refresh if enabled
          if (state.autoRefreshEnabled) {
            state.startAutoRefresh();
          }
          
          // Fetch initial data
          state.fetchAnalytics();
        },

        // Cleanup the store (call this when component unmounts)
        cleanup: () => {
          const state = get();
          
          // Stop auto-refresh
          state.stopAutoRefresh();
          
          // Cleanup WebSocket listeners
          state.cleanupWebSocket();
        },

        // Reset all analytics data
        resetAnalytics: () => set((state) => {
          state.streamAnalytics = {};
          state.globalAnalytics = { ...defaultAnalytics };
          state.error = null;
          state.lastUpdated = null;
        }),

        // Get formatted time range for display
        getTimeRangeLabel: () => {
          const timeRange = get().timeRange;
          return TIME_RANGES[timeRange]?.label || 'Unknown';
        },

        // Get available time ranges
        getTimeRanges: () => TIME_RANGES,

        // Check if data is stale (older than refresh interval)
        isDataStale: () => {
          const state = get();
          if (!state.lastUpdated) return true;
          
          const lastUpdate = new Date(state.lastUpdated);
          const now = new Date();
          const timeDiff = now - lastUpdate;
          
          return timeDiff > state.refreshInterval;
        },

        // Get connection status
        getConnectionStatus: () => {
          return get()._isSocketConnected;
        }
      })),
      {
        name: 'digis-analytics-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          // Only persist user preferences, not analytics data
          timeRange: state.timeRange,
          autoRefreshEnabled: state.autoRefreshEnabled,
          refreshInterval: state.refreshInterval
        })
      }
    ),
    {
      name: 'analytics-store'
    }
  )
);

// Helper function to get auth token (you may need to adjust this based on your auth implementation)
const getAuthToken = async () => {
  try {
    // This should match your existing auth token retrieval logic
    if (typeof window !== 'undefined') {
      const { supabase } = await import('../utils/supabase-auth.js');
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token;
    }
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
};

// Export individual selectors for better performance
export const useAnalyticsData = () => useAnalyticsStore((state) => ({
  streamAnalytics: state.streamAnalytics,
  globalAnalytics: state.globalAnalytics,
  isLoading: state.isLoading,
  error: state.error,
  lastUpdated: state.lastUpdated
}));

export const useAnalyticsControls = () => useAnalyticsStore((state) => ({
  timeRange: state.timeRange,
  setTimeRange: state.setTimeRange,
  autoRefreshEnabled: state.autoRefreshEnabled,
  setAutoRefresh: state.setAutoRefresh,
  refreshInterval: state.refreshInterval,
  setRefreshInterval: state.setRefreshInterval,
  fetchAnalytics: state.fetchAnalytics,
  initialize: state.initialize,
  cleanup: state.cleanup
}));

export const useAnalyticsHelpers = () => useAnalyticsStore((state) => ({
  getStreamAnalytics: state.getStreamAnalytics,
  getGlobalAnalytics: state.getGlobalAnalytics,
  getTimeRangeLabel: state.getTimeRangeLabel,
  getTimeRanges: state.getTimeRanges,
  isDataStale: state.isDataStale,
  getConnectionStatus: state.getConnectionStatus
}));

export default useAnalyticsStore;