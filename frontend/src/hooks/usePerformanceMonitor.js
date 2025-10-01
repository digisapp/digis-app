import { useEffect, useCallback, useRef } from 'react';

export const usePerformanceMonitor = () => {
  const metricsRef = useRef({});
  const observerRef = useRef(null);

  useEffect(() => {
    // Setup Performance Observer for various metrics
    if ('PerformanceObserver' in window) {
      try {
        // Monitor Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          metricsRef.current.lcp = lastEntry.renderTime || lastEntry.loadTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Monitor First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            metricsRef.current.fid = entry.processingStart - entry.startTime;
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Monitor Cumulative Layout Shift
        const clsObserver = new PerformanceObserver((list) => {
          let clsScore = 0;
          list.getEntries().forEach((entry) => {
            if (!entry.hadRecentInput) {
              clsScore += entry.value;
            }
          });
          metricsRef.current.cls = clsScore;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        observerRef.current = { lcpObserver, fidObserver, clsObserver };
      } catch (error) {
        console.error('Failed to setup performance observers:', error);
      }
    }

    // Monitor memory usage if available
    if (performance.memory) {
      const memoryInterval = setInterval(() => {
        metricsRef.current.memory = {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        };
      }, 5000);

      return () => {
        clearInterval(memoryInterval);
        if (observerRef.current) {
          Object.values(observerRef.current).forEach(observer => observer.disconnect());
        }
      };
    }
  }, []);

  const reportMetric = useCallback((name, value, metadata = {}) => {
    const metric = {
      name,
      value,
      timestamp: Date.now(),
      ...metadata
    };

    // Store locally
    metricsRef.current[name] = value;

    // Send to analytics if available
    if (window.gtag) {
      window.gtag('event', 'performance_metric', {
        metric_name: name,
        value: value,
        ...metadata
      });
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Performance Metric:', metric);
    }
  }, []);

  const getMetrics = useCallback(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    
    return {
      ...metricsRef.current,
      // Navigation timing
      dns: navigation?.domainLookupEnd - navigation?.domainLookupStart,
      tcp: navigation?.connectEnd - navigation?.connectStart,
      ttfb: navigation?.responseStart - navigation?.requestStart,
      download: navigation?.responseEnd - navigation?.responseStart,
      domInteractive: navigation?.domInteractive,
      domComplete: navigation?.domComplete,
      loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
      // Core Web Vitals
      lcp: metricsRef.current.lcp,
      fid: metricsRef.current.fid,
      cls: metricsRef.current.cls,
      // Memory
      memory: metricsRef.current.memory
    };
  }, []);

  const measureTime = useCallback((fn, name) => {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    reportMetric(`${name}_duration`, duration);
    
    return result;
  }, [reportMetric]);

  return {
    reportMetric,
    getMetrics,
    measureTime
  };
};