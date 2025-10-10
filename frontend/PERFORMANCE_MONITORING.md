# Route Performance Monitoring

## Overview

The Digis frontend includes a comprehensive route performance monitoring system that tracks:

- **Route Navigation Time**: How long it takes to navigate between routes
- **Component Mount Time**: Time from route entry to component mount
- **Time to Interactive (TTI)**: Time until the route is fully interactive
- **Route-specific Metrics**: Per-route performance data for optimization

## Quick Start

### 1. Using the Hook Directly

```javascript
import useRoutePerformance from '../hooks/useRoutePerformance';

function DashboardPage() {
  useRoutePerformance('dashboard');

  return (
    <div>
      {/* Your dashboard content */}
    </div>
  );
}
```

### 2. Using the HOC

```javascript
import { withPerformanceMonitor } from '../components/PerformanceMonitor';

function DashboardPage() {
  return <div>Dashboard</div>;
}

export default withPerformanceMonitor(DashboardPage, 'dashboard');
```

### 3. Using the Wrapper Component

```javascript
import PerformanceMonitor from '../components/PerformanceMonitor';

function MyRoute() {
  return (
    <PerformanceMonitor routeName="dashboard">
      <DashboardPage />
    </PerformanceMonitor>
  );
}
```

## Development Tools

### Performance Panel (Dev Mode Only)

Add the performance panel to your `App.js` to see real-time metrics:

```javascript
import { PerformancePanel } from './components/PerformanceMonitor';

function App() {
  return (
    <div>
      {/* Your app content */}
      <PerformancePanel />
    </div>
  );
}
```

The panel will appear in the bottom-right corner and show:
- Last 10 route navigations
- Mount time and TTI for each route
- Visual indicators for slow routes (>1000ms)
- Real-time updates every 2 seconds

### Browser Console Commands

In development mode, the following commands are available in the browser console:

#### Get All Metrics
```javascript
window.getPerformanceMetrics()
// Returns array of all captured metrics
```

#### Get Performance Summary
```javascript
window.getPerformanceSummary()
// Returns aggregated statistics per route
```

#### Log Performance Summary
```javascript
window.logPerformanceSummary()
// Prints formatted summary to console
```

#### Clear Metrics
```javascript
window.clearPerformanceMetrics()
// Clears all stored metrics
```

## Metrics Explained

### Mount Time
Time from route navigation start to React component mount complete.

**Good**: < 300ms
**Acceptable**: 300-800ms
**Slow**: > 800ms

### Time to Interactive (TTI)
Time until the route is fully interactive (all lazy components loaded, data fetched, etc.).

**Good**: < 500ms
**Acceptable**: 500-1000ms
**Slow**: > 1000ms

### Navigation Start
Reference timestamp for when navigation began.

## Production Analytics

In production, metrics are automatically sent to:

### Google Analytics (if configured)
```javascript
gtag('event', 'route_performance', {
  event_category: 'performance',
  event_label: routeName,
  value: Math.round(interactiveTime),
  mount_time: Math.round(mountTime),
  pathname: pathname,
});
```

### Custom Analytics (if configured)
```javascript
window.analytics.track('Route Performance', {
  routeName,
  pathname,
  mountTime: Math.round(mountTime),
  interactiveTime: Math.round(interactiveTime),
});
```

## Integration with Existing Routes

### Current Monitored Routes

All routes in `AppRoutes.jsx` should be monitored. Here's how to add monitoring to each route:

#### Example 1: Simple Route
```javascript
const ExplorePage = lazy(() => import('./components/pages/ExplorePage'));

// In AppRoutes.jsx
<Route path="/explore" element={
  <ProtectedRoute>
    <PerformanceMonitor routeName="explore">
      <ExplorePage />
    </PerformanceMonitor>
  </ProtectedRoute>
} />
```

#### Example 2: Complex Route with Conditionals
```javascript
<Route path="/dashboard" element={
  <ProtectedRoute>
    <PerformanceMonitor routeName="dashboard">
      {isMobile ? (
        isCreator ? <MobileCreatorDashboard /> : <MobileFanDashboard />
      ) : (
        <DashboardRouter />
      )}
    </PerformanceMonitor>
  </ProtectedRoute>
} />
```

#### Example 3: Nested Routes
```javascript
<Route path="/call/video" element={
  <ProtectedRoute>
    <PerformanceMonitor routeName="video-call">
      <VideoCall />
    </PerformanceMonitor>
  </ProtectedRoute>
} />
```

## Route Naming Conventions

Use consistent, descriptive names for routes:

- **Format**: `kebab-case`
- **Examples**:
  - `dashboard` (main dashboard)
  - `video-call` (video call interface)
  - `token-purchase` (token purchase flow)
  - `creator-profile` (creator public profile)
  - `messages` (messaging interface)

## Performance Budgets

Target performance budgets per route type:

### Static Pages (Home, Terms, Privacy)
- Mount Time: < 200ms
- TTI: < 400ms

### Data-Heavy Pages (Dashboard, Analytics)
- Mount Time: < 500ms
- TTI: < 1000ms

### Interactive Pages (Video Call, Streaming)
- Mount Time: < 800ms
- TTI: < 1500ms

### Complex Modals
- Mount Time: < 300ms
- TTI: < 600ms

## Debugging Slow Routes

If a route is consistently slow:

1. **Check Lazy Loading**: Ensure heavy components are lazy loaded
2. **Check Data Fetching**: Move data fetching to Suspense boundaries
3. **Check Bundle Size**: Use `npm run build -- --analyze` to check bundle
4. **Check Re-renders**: Use React DevTools Profiler
5. **Check Network**: Ensure API calls are optimized

### Example: Optimizing a Slow Route

**Before** (Slow: 2000ms TTI):
```javascript
function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData().then(setData);
  }, []);

  return data ? <Dashboard data={data} /> : <Skeleton />;
}
```

**After** (Fast: 500ms TTI):
```javascript
// Use React.lazy with Suspense
const Dashboard = lazy(() => import('./Dashboard'));

function DashboardPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Dashboard />
    </Suspense>
  );
}

// Move data fetching to component
function Dashboard() {
  const { data } = useQuery('dashboard', fetchData);
  return <DashboardContent data={data} />;
}
```

## Storage and Privacy

- Metrics are stored in **sessionStorage** (cleared on tab close)
- Only last **50 metrics** are kept to avoid storage bloat
- No personally identifiable information (PII) is stored
- Metrics are anonymous and aggregated

## Testing Performance Monitoring

```javascript
// src/hooks/__tests__/useRoutePerformance.test.js
import { renderHook } from '@testing-library/react';
import useRoutePerformance from '../useRoutePerformance';

describe('useRoutePerformance', () => {
  it('should log performance metrics', () => {
    const consoleSpy = jest.spyOn(console, 'log');

    renderHook(() => useRoutePerformance('test-route'));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Route Performance')
    );
  });
});
```

## Continuous Monitoring

### Weekly Review Checklist

1. Run `window.logPerformanceSummary()` in production
2. Identify routes with TTI > 1000ms
3. Review bundle size for slow routes
4. Check for unnecessary re-renders
5. Optimize data fetching strategies
6. Update performance budgets if needed

### Monthly Analysis

1. Export metrics from analytics dashboard
2. Compare month-over-month performance
3. Identify performance regressions
4. Create optimization tickets for slow routes
5. Update team on performance improvements

## Advanced Usage

### Custom Metrics

Add custom performance marks:

```javascript
function MyComponent() {
  useRoutePerformance('my-route');

  useEffect(() => {
    performance.mark('data-fetch-start');
    fetchData().then(() => {
      performance.mark('data-fetch-end');
      performance.measure(
        'data-fetch',
        'data-fetch-start',
        'data-fetch-end'
      );
    });
  }, []);

  return <div>Content</div>;
}
```

### Performance Alerts

Set up alerts for slow routes:

```javascript
// In useRoutePerformance.js, modify logRoutePerformance()
if (interactiveTime > 2000) {
  // Send alert to monitoring service
  fetch('/api/performance-alert', {
    method: 'POST',
    body: JSON.stringify({ routeName, interactiveTime }),
  });
}
```

## FAQ

### Q: Why is TTI different from Mount Time?
A: Mount Time is when the component mounts. TTI includes lazy loading, data fetching, and animations.

### Q: Do metrics impact performance?
A: No, metrics are logged asynchronously using `requestIdleCallback` to avoid blocking the main thread.

### Q: Can I disable monitoring?
A: Yes, set `REACT_APP_DISABLE_PERFORMANCE_MONITORING=true` in your `.env` file.

### Q: How long are metrics stored?
A: Metrics are stored in sessionStorage and cleared when the browser tab closes.

### Q: Can I export metrics?
A: Yes, use `window.getPerformanceMetrics()` to get all metrics as JSON.

## Resources

- [Web Vitals](https://web.dev/vitals/)
- [React Performance](https://reactjs.org/docs/optimizing-performance.html)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

## Contributing

When adding new routes:

1. Add performance monitoring wrapper
2. Set appropriate route name
3. Test performance in dev mode
4. Update this documentation
5. Add to performance budget tracking

---

**Last Updated**: October 10, 2025
**Maintainer**: Development Team
