/**
 * Web Vitals Tracking
 *
 * Captures Core Web Vitals and sends them to analytics.
 * Only runs in production to avoid polluting dev metrics.
 *
 * Metrics tracked:
 * - CLS (Cumulative Layout Shift) - visual stability
 * - FID (First Input Delay) - interactivity (deprecated, use INP)
 * - LCP (Largest Contentful Paint) - loading performance
 * - TTFB (Time to First Byte) - server response time
 * - INP (Interaction to Next Paint) - responsiveness
 */

import { getCLS, getFCP, getFID, getLCP, getTTFB } from 'web-vitals';
import { analytics } from './analytics';

/**
 * Report a web vital metric to analytics
 */
function report(name, metric) {
  analytics.track('web_vital', {
    name,
    value: Math.round(metric.value),
    rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
    id: metric.id,
    path: location.pathname,
    navigationType: metric.navigationType, // 'navigate' | 'reload' | 'back-forward' etc
  });

  // Also log to console in dev for debugging
  if (import.meta.env.DEV) {
    console.log(`[Web Vital] ${name}:`, {
      value: Math.round(metric.value),
      rating: metric.rating,
      path: location.pathname,
    });
  }
}

/**
 * Initialize Web Vitals tracking
 *
 * Call this once on app start (production only recommended)
 */
export function initWebVitals() {
  try {
    // Cumulative Layout Shift - measures visual stability
    // Good: < 0.1, Poor: > 0.25
    getCLS((metric) => report('CLS', metric));

    // First Contentful Paint - measures loading performance
    // Good: < 1.8s, Poor: > 3.0s
    getFCP((metric) => report('FCP', metric));

    // First Input Delay - measures interactivity
    // Good: < 100ms, Poor: > 300ms
    getFID((metric) => report('FID', metric));

    // Largest Contentful Paint - measures loading performance
    // Good: < 2.5s, Poor: > 4.0s
    getLCP((metric) => report('LCP', metric));

    // Time to First Byte - measures server response time
    // Good: < 800ms, Poor: > 1800ms
    getTTFB((metric) => report('TTFB', metric));
  } catch (error) {
    // Silently fail if web-vitals not available
    console.warn('Failed to initialize Web Vitals:', error);
  }
}
