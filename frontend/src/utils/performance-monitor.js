/**
 * Performance monitoring utility
 * @module utils/performance-monitor
 */

import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

/**
 * Performance thresholds
 */
const THRESHOLDS = {
  CLS: { good: 0.1, needs_improvement: 0.25 }, // Cumulative Layout Shift
  FID: { good: 100, needs_improvement: 300 }, // First Input Delay (ms)
  FCP: { good: 1800, needs_improvement: 3000 }, // First Contentful Paint (ms)
  LCP: { good: 2500, needs_improvement: 4000 }, // Largest Contentful Paint (ms)
  TTFB: { good: 800, needs_improvement: 1800 } // Time to First Byte (ms)
};

/**
 * Performance data collector
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.observers = new Map();
    this.reportQueue = [];
    this.isEnabled = true;
    this.endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT || null;
  }

  /**
   * Initialize performance monitoring
   */
  init() {
    if (!this.isEnabled) return;

    // Core Web Vitals
    getCLS(this.handleMetric.bind(this, 'CLS'));
    getFID(this.handleMetric.bind(this, 'FID'));
    getFCP(this.handleMetric.bind(this, 'FCP'));
    getLCP(this.handleMetric.bind(this, 'LCP'));
    getTTFB(this.handleMetric.bind(this, 'TTFB'));

    // Custom metrics
    this.measureNavigationTiming();
    this.measureResourceTiming();
    this.observeLongTasks();
    this.measureMemoryUsage();
    this.trackJSErrors();
    
    // Report metrics periodically
    this.startReporting();
  }

  /**
   * Handle Web Vitals metric
   */
  handleMetric(name, metric) {
    const value = metric.value;
    const rating = this.getRating(name, value);
    
    this.metrics[name] = {
      value,
      rating,
      timestamp: Date.now(),
      id: metric.id,
      navigationType: metric.navigationType
    };

    // Log to console in development
    if (import.meta.env.DEV) {
      const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
      console.log(`${emoji} ${name}: ${value.toFixed(2)}${name === 'CLS' ? '' : 'ms'} (${rating})`);
    }

    // Add to report queue
    this.reportQueue.push({
      metric: name,
      ...this.metrics[name]
    });
  }

  /**
   * Get rating for metric value
   */
  getRating(metric, value) {
    const threshold = THRESHOLDS[metric];
    if (!threshold) return 'unknown';
    
    if (value <= threshold.good) return 'good';
    if (value <= threshold.needs_improvement) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Measure navigation timing
   */
  measureNavigationTiming() {
    if (!window.performance || !window.performance.timing) return;

    window.addEventListener('load', () => {
      const timing = window.performance.timing;
      const navigationStart = timing.navigationStart;

      const metrics = {
        domContentLoaded: timing.domContentLoadedEventEnd - navigationStart,
        loadComplete: timing.loadEventEnd - navigationStart,
        domInteractive: timing.domInteractive - navigationStart,
        domainLookup: timing.domainLookupEnd - timing.domainLookupStart,
        tcpConnection: timing.connectEnd - timing.connectStart,
        request: timing.responseStart - timing.requestStart,
        response: timing.responseEnd - timing.responseStart,
        domProcessing: timing.domComplete - timing.domLoading
      };

      Object.entries(metrics).forEach(([key, value]) => {
        this.metrics[`navigation.${key}`] = {
          value,
          timestamp: Date.now()
        };
      });

      if (import.meta.env.DEV) {
        console.log('📊 Navigation Timing:', metrics);
      }
    });
  }

  /**
   * Measure resource timing
   */
  measureResourceTiming() {
    if (!window.performance || !window.performance.getEntriesByType) return;

    window.addEventListener('load', () => {
      const resources = window.performance.getEntriesByType('resource');
      
      const resourceMetrics = {
        totalResources: resources.length,
        totalSize: 0,
        slowestResource: null,
        byType: {}
      };

      resources.forEach(resource => {
        const type = resource.initiatorType;
        if (!resourceMetrics.byType[type]) {
          resourceMetrics.byType[type] = {
            count: 0,
            totalDuration: 0,
            totalSize: 0
          };
        }

        resourceMetrics.byType[type].count++;
        resourceMetrics.byType[type].totalDuration += resource.duration;
        
        if (resource.transferSize) {
          resourceMetrics.totalSize += resource.transferSize;
          resourceMetrics.byType[type].totalSize += resource.transferSize;
        }

        if (!resourceMetrics.slowestResource || resource.duration > resourceMetrics.slowestResource.duration) {
          resourceMetrics.slowestResource = {
            name: resource.name,
            duration: resource.duration,
            type: resource.initiatorType
          };
        }
      });

      this.metrics.resources = resourceMetrics;

      if (import.meta.env.DEV) {
        console.log('📦 Resource Metrics:', resourceMetrics);
      }
    });
  }

  /**
   * Observe long tasks
   */
  observeLongTasks() {
    if (!window.PerformanceObserver || !PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      return;
    }

    const longTaskCount = { count: 0, totalDuration: 0 };

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTaskCount.count++;
        longTaskCount.totalDuration += entry.duration;

        if (import.meta.env.DEV) {
          console.warn(`⚠️ Long Task detected: ${entry.duration.toFixed(2)}ms`);
        }

        this.reportQueue.push({
          metric: 'longTask',
          duration: entry.duration,
          timestamp: Date.now()
        });
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
    this.observers.set('longtask', observer);

    this.metrics.longTasks = longTaskCount;
  }

  /**
   * Measure memory usage
   */
  measureMemoryUsage() {
    if (!performance.memory) return;

    setInterval(() => {
      const memory = performance.memory;
      this.metrics.memory = {
        usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1048576), // MB
        totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1048576), // MB
        jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
        timestamp: Date.now()
      };

      // Detect memory leaks
      const usage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      if (usage > 90) {
        console.error('⚠️ High memory usage detected:', `${usage.toFixed(2)}%`);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Track JavaScript errors
   */
  trackJSErrors() {
    window.addEventListener('error', (event) => {
      this.reportQueue.push({
        metric: 'jsError',
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
        timestamp: Date.now()
      });

      if (import.meta.env.DEV) {
        console.error('🚨 JS Error tracked:', event.message);
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.reportQueue.push({
        metric: 'unhandledRejection',
        reason: event.reason,
        timestamp: Date.now()
      });

      if (import.meta.env.DEV) {
        console.error('🚨 Unhandled Promise Rejection:', event.reason);
      }
    });
  }

  /**
   * Start reporting metrics
   */
  startReporting() {
    // Report every 10 seconds if there are metrics
    setInterval(() => {
      if (this.reportQueue.length > 0) {
        this.sendReport();
      }
    }, 10000);

    // Also report on page unload
    window.addEventListener('beforeunload', () => {
      this.sendReport(true);
    });
  }

  /**
   * Send performance report
   */
  async sendReport(isBeacon = false) {
    if (!this.endpoint || this.reportQueue.length === 0) return;

    const report = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      metrics: [...this.reportQueue],
      summary: this.getSummary()
    };

    this.reportQueue = [];

    try {
      if (isBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(this.endpoint, JSON.stringify(report));
      } else {
        await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report)
        });
      }
    } catch (error) {
      console.error('Failed to send performance report:', error);
    }
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const scores = {
      overall: 100,
      metrics: {}
    };

    // Calculate scores for each metric
    Object.entries(this.metrics).forEach(([key, data]) => {
      if (THRESHOLDS[key]) {
        const rating = data.rating;
        let score = rating === 'good' ? 100 : rating === 'needs-improvement' ? 50 : 0;
        scores.metrics[key] = score;
        scores.overall = Math.min(scores.overall, score);
      }
    });

    return {
      score: scores.overall,
      metrics: scores.metrics,
      timestamp: Date.now()
    };
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return this.metrics;
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = {};
    this.reportQueue = [];
  }

  /**
   * Destroy monitor
   */
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.clear();
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Auto-initialize in browser
if (typeof window !== 'undefined') {
  performanceMonitor.init();
}

export default performanceMonitor;