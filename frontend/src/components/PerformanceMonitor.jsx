import React from 'react';
import useRoutePerformance from '../hooks/useRoutePerformance';

/**
 * Higher-Order Component for route performance monitoring
 *
 * Wraps a component and automatically tracks its performance metrics
 *
 * Usage:
 * ```javascript
 * const MonitoredDashboard = withPerformanceMonitor(DashboardRouter, 'dashboard');
 * ```
 *
 * Or as a wrapper component:
 * ```javascript
 * <PerformanceMonitor routeName="dashboard">
 *   <DashboardRouter />
 * </PerformanceMonitor>
 * ```
 */

// HOC version
export function withPerformanceMonitor(Component, routeName) {
  return function PerformanceMonitoredComponent(props) {
    useRoutePerformance(routeName);
    return <Component {...props} />;
  };
}

// Wrapper component version
export default function PerformanceMonitor({ routeName, children }) {
  useRoutePerformance(routeName);
  return <>{children}</>;
}

/**
 * Performance monitoring panel for development
 * Shows real-time performance metrics in dev mode
 */
export function PerformancePanel() {
  const [metrics, setMetrics] = React.useState([]);
  const [isExpanded, setIsExpanded] = React.useState(false);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    // Update metrics every 2 seconds
    const interval = setInterval(() => {
      try {
        const stored = sessionStorage.getItem('route_performance_metrics');
        if (stored) {
          setMetrics(JSON.parse(stored).slice(-10)); // Last 10 navigations
        }
      } catch (error) {
        console.error('Failed to load performance metrics:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== 'development' || metrics.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: '#fff',
        borderRadius: 8,
        padding: 12,
        fontFamily: 'monospace',
        fontSize: 12,
        maxWidth: isExpanded ? 400 : 200,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isExpanded ? 8 : 0,
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <strong>📊 Performance</strong>
        <span style={{ fontSize: 10 }}>{isExpanded ? '▼' : '▲'}</span>
      </div>

      {isExpanded && (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {metrics.map((metric, index) => {
            const isRecent = index === metrics.length - 1;
            const isSlow = metric.interactiveTime > 1000;

            return (
              <div
                key={index}
                style={{
                  marginBottom: 8,
                  padding: 8,
                  backgroundColor: isRecent
                    ? 'rgba(34, 197, 94, 0.2)'
                    : isSlow
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 4,
                  borderLeft: isRecent
                    ? '3px solid #22c55e'
                    : isSlow
                    ? '3px solid #ef4444'
                    : '3px solid transparent',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                  {metric.routeName}
                  {isSlow && ' ⚠️'}
                </div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>
                  Mount: {metric.mountTime.toFixed(0)}ms
                </div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>
                  TTI: {metric.interactiveTime.toFixed(0)}ms
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isExpanded && (
        <div style={{ fontSize: 10, opacity: 0.8, marginTop: 4 }}>
          Click to expand
        </div>
      )}
    </div>
  );
}
