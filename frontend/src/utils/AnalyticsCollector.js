/**
 * Analytics Data Collector
 * 
 * Collects and tracks user interactions, session metrics, and business KPIs
 * for real-time dashboard reporting and creator insights.
 */

import { supabase } from './supabase';

class AnalyticsCollector {
  constructor() {
    this.isEnabled = true;
    this.sessionId = this.generateSessionId();
    this.currentSession = null;
    this.eventQueue = [];
    this.batchSize = 10;
    this.flushInterval = 5000; // 5 seconds
    
    // Real-time metrics
    this.sessionMetrics = {
      startTime: null,
      endTime: null,
      duration: 0,
      quality: {
        video: [],
        audio: [],
        network: []
      },
      interactions: [],
      revenue: {
        tokens: 0,
        usd: 0,
        tips: 0
      },
      technical: {
        reconnections: 0,
        fallbacks: 0,
        errors: []
      }
    };
    
    this.listeners = new Map();
    this.flushTimer = null;
    
    console.log('📊 Analytics Collector initialized');
  }

  /**
   * Initialize analytics for a session
   */
  initSession(sessionData) {
    this.currentSession = {
      sessionId: this.sessionId,
      userId: sessionData.userId,
      creatorId: sessionData.creatorId,
      channelId: sessionData.channelId,
      sessionType: sessionData.sessionType || 'video_call',
      startTime: Date.now(),
      ...sessionData
    };

    this.sessionMetrics.startTime = Date.now();
    
    // Start periodic flushing
    this.startPeriodicFlush();
    
    this.trackEvent('session_started', {
      sessionId: this.sessionId,
      sessionType: this.currentSession.sessionType,
      timestamp: Date.now()
    });

    console.log('📊 Analytics session initialized:', this.sessionId);
  }

  /**
   * Track user events
   */
  trackEvent(eventType, data = {}, immediate = false) {
    if (!this.isEnabled) return;

    const event = {
      eventType,
      sessionId: this.sessionId,
      userId: this.currentSession?.userId,
      creatorId: this.currentSession?.creatorId,
      timestamp: Date.now(),
      data: {
        ...data,
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }
    };

    this.eventQueue.push(event);

    // Notify listeners
    this.notifyListeners('event_tracked', { eventType, data });

    // Flush immediately for critical events
    if (immediate || this.eventQueue.length >= this.batchSize) {
      this.flush();
    }

    console.log(`📊 Event tracked: ${eventType}`, data);
  }

  /**
   * Track session metrics
   */
  trackSessionMetrics(metrics) {
    if (!this.currentSession) return;

    // Quality metrics
    if (metrics.video) {
      this.sessionMetrics.quality.video.push({
        timestamp: Date.now(),
        resolution: metrics.video.resolution,
        frameRate: metrics.video.frameRate,
        bitrate: metrics.video.bitrate
      });
    }

    if (metrics.audio) {
      this.sessionMetrics.quality.audio.push({
        timestamp: Date.now(),
        bitrate: metrics.audio.bitrate,
        sampleRate: metrics.audio.sampleRate,
        volume: metrics.audio.volume
      });
    }

    if (metrics.network) {
      this.sessionMetrics.quality.network.push({
        timestamp: Date.now(),
        rtt: metrics.network.rtt,
        packetLoss: metrics.network.packetLoss,
        uplink: metrics.network.uplink,
        downlink: metrics.network.downlink
      });
    }

    // Technical metrics
    if (metrics.reconnection) {
      this.sessionMetrics.technical.reconnections++;
    }

    if (metrics.fallback) {
      this.sessionMetrics.technical.fallbacks++;
      this.trackEvent('connection_fallback', {
        fromMode: metrics.fallback.from,
        toMode: metrics.fallback.to,
        reason: metrics.fallback.reason
      });
    }

    if (metrics.error) {
      this.sessionMetrics.technical.errors.push({
        timestamp: Date.now(),
        type: metrics.error.type,
        message: metrics.error.message,
        stack: metrics.error.stack
      });
    }
  }

  /**
   * Track revenue events
   */
  trackRevenue(revenueData) {
    const revenue = {
      type: revenueData.type, // 'session', 'tip', 'gift'
      amount: revenueData.amount,
      currency: revenueData.currency || 'tokens',
      usdValue: revenueData.usdValue,
      timestamp: Date.now()
    };

    this.sessionMetrics.revenue.tokens += revenueData.amount;
    this.sessionMetrics.revenue.usd += revenueData.usdValue || 0;

    if (revenueData.type === 'tip') {
      this.sessionMetrics.revenue.tips += revenueData.amount;
    }

    this.trackEvent('revenue_generated', revenue, true);

    console.log('💰 Revenue tracked:', revenue);
  }

  /**
   * Track user interactions
   */
  trackInteraction(interactionType, data = {}) {
    const interaction = {
      type: interactionType,
      timestamp: Date.now(),
      data
    };

    this.sessionMetrics.interactions.push(interaction);

    this.trackEvent('user_interaction', interaction);
  }

  /**
   * Track page/component views
   */
  trackPageView(pageName, data = {}) {
    this.trackEvent('page_view', {
      page: pageName,
      referrer: document.referrer,
      url: window.location.href,
      ...data
    });
  }

  /**
   * Track conversion events
   */
  trackConversion(conversionType, value = 0, data = {}) {
    this.trackEvent('conversion', {
      type: conversionType,
      value,
      currency: 'USD',
      ...data
    }, true);
  }

  /**
   * End current session
   */
  endSession(endReason = 'normal') {
    if (!this.currentSession) return;

    this.sessionMetrics.endTime = Date.now();
    this.sessionMetrics.duration = this.sessionMetrics.endTime - this.sessionMetrics.startTime;

    this.trackEvent('session_ended', {
      sessionId: this.sessionId,
      duration: this.sessionMetrics.duration,
      reason: endReason,
      metrics: this.getSessionSummary()
    }, true);

    // Final flush
    this.flush();

    // Stop periodic flushing
    this.stopPeriodicFlush();

    console.log('📊 Analytics session ended:', {
      duration: this.sessionMetrics.duration,
      events: this.eventQueue.length
    });
  }

  /**
   * Get session summary
   */
  getSessionSummary() {
    return {
      duration: this.sessionMetrics.duration,
      totalEvents: this.eventQueue.length,
      revenue: this.sessionMetrics.revenue,
      interactions: this.sessionMetrics.interactions.length,
      technical: {
        reconnections: this.sessionMetrics.technical.reconnections,
        fallbacks: this.sessionMetrics.technical.fallbacks,
        errors: this.sessionMetrics.technical.errors.length
      },
      quality: {
        avgVideoQuality: this.calculateAverageQuality('video'),
        avgAudioQuality: this.calculateAverageQuality('audio'),
        avgNetworkQuality: this.calculateAverageQuality('network')
      }
    };
  }

  /**
   * Calculate average quality metrics
   */
  calculateAverageQuality(type) {
    const metrics = this.sessionMetrics.quality[type];
    if (!metrics || metrics.length === 0) return null;

    switch (type) {
      case 'video':
        return {
          avgFrameRate: metrics.reduce((sum, m) => sum + m.frameRate, 0) / metrics.length,
          avgBitrate: metrics.reduce((sum, m) => sum + m.bitrate, 0) / metrics.length
        };
      case 'audio':
        return {
          avgBitrate: metrics.reduce((sum, m) => sum + m.bitrate, 0) / metrics.length,
          avgVolume: metrics.reduce((sum, m) => sum + m.volume, 0) / metrics.length
        };
      case 'network':
        return {
          avgRtt: metrics.reduce((sum, m) => sum + m.rtt, 0) / metrics.length,
          avgPacketLoss: metrics.reduce((sum, m) => sum + m.packetLoss, 0) / metrics.length
        };
      default:
        return null;
    }
  }

  /**
   * Flush events to backend
   */
  async flush() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token || null;
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/analytics/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(supabaseToken && { 'Authorization': `Bearer ${supabaseToken}` })
        },
        body: JSON.stringify({
          events,
          sessionMetrics: this.sessionMetrics,
          batchId: this.generateBatchId()
        })
      });

      if (!response.ok) {
        throw new Error(`Analytics flush failed: ${response.status}`);
      }

      this.notifyListeners('events_flushed', { count: events.length });
      console.log(`📊 Flushed ${events.length} analytics events`);

    } catch (error) {
      console.error('❌ Analytics flush error:', error);
      // Re-queue events for retry
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * Start periodic flushing
   */
  startPeriodicFlush() {
    this.stopPeriodicFlush(); // Clear any existing timer
    
    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  /**
   * Stop periodic flushing
   */
  stopPeriodicFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    
    if (!enabled) {
      this.stopPeriodicFlush();
    } else if (this.currentSession) {
      this.startPeriodicFlush();
    }
  }

  /**
   * Set user properties
   */
  setUserProperties(properties) {
    this.trackEvent('user_properties_updated', properties);
  }

  /**
   * Track custom metrics
   */
  trackCustomMetric(metricName, value, tags = {}) {
    this.trackEvent('custom_metric', {
      metric: metricName,
      value,
      tags,
      timestamp: Date.now()
    });
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate batch ID
   */
  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Event listeners
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in analytics listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      sessionId: this.sessionId,
      currentSession: !!this.currentSession,
      queuedEvents: this.eventQueue.length,
      flushInterval: this.flushInterval,
      sessionDuration: this.currentSession ? Date.now() - this.sessionMetrics.startTime : 0
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopPeriodicFlush();
    
    if (this.currentSession) {
      this.endSession('cleanup');
    }

    this.listeners.clear();
    this.eventQueue = [];
  }
}

// Create singleton instance
const analyticsCollector = new AnalyticsCollector();

export default analyticsCollector;