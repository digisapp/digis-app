# Analytics & State Management Implementation Guide

## 🎯 Overview
This document describes the newly implemented real-time analytics system and centralized state management using Zustand for the Digis creator economy platform.

## 📊 Features Implemented

### 1. **Centralized State Management (Zustand)**
- **Location**: `/frontend/src/stores/useStore.js`
- **Features**:
  - User, creator, and stream state management
  - WebSocket event handlers
  - LocalStorage persistence
  - UI state management (modals, toggles)

### 2. **Analytics Store**
- **Location**: `/frontend/src/stores/useAnalyticsStore.js`
- **Features**:
  - Real-time analytics data management
  - Time range filtering (1h, 24h, 7d, 30d, 90d)
  - Auto-refresh every 30 seconds
  - WebSocket listeners for live updates
  - Memory-efficient data cleanup

### 3. **Enhanced Analytics Component**
- **Location**: `/frontend/src/components/StreamAnalyticsEnhanced.js`
- **Features**:
  - Interactive charts with Recharts
  - Real-time viewer tracking
  - Revenue analytics
  - Engagement metrics
  - Performance monitoring
  - Data export functionality

### 4. **Backend Analytics API**
- **Endpoints**:
  - `GET /api/streaming/:streamId/analytics` - Stream-specific analytics
  - `GET /api/streaming/analytics/global` - Platform-wide analytics
- **Features**:
  - Time range filtering
  - Role-based access control
  - Aggregated metrics
  - SQL optimization with indexes

## 🚀 Quick Start

### Basic Usage in Components

```javascript
import { useAnalyticsStore } from '../stores/useAnalyticsStore';
import StreamAnalyticsEnhanced from '../components/StreamAnalyticsEnhanced';

function MyComponent() {
  const { streamAnalytics, isLoading } = useAnalyticsStore();
  
  return (
    <StreamAnalyticsEnhanced 
      streamId="stream-123" 
      isCreator={true} 
    />
  );
}
```

### Using the Analytics Store

```javascript
// Import the store and hooks
import { useAnalyticsData, useAnalyticsControls } from '../stores/useAnalyticsStore';

function StreamDashboard({ streamId }) {
  const { initialize, cleanup, fetchAnalytics } = useAnalyticsControls();
  const { streamAnalytics, isLoading, error } = useAnalyticsData();
  
  useEffect(() => {
    // Initialize analytics for this stream
    initialize(streamId);
    
    // Cleanup on unmount
    return cleanup;
  }, [streamId]);
  
  // Access real-time data
  const viewers = streamAnalytics?.realTimeData?.currentViewers || 0;
  const revenue = streamAnalytics?.realTimeData?.revenue || 0;
  
  return (
    <div>
      <p>Current Viewers: {viewers}</p>
      <p>Revenue: ${revenue.toFixed(2)}</p>
    </div>
  );
}
```

### WebSocket Integration

```javascript
// The analytics store automatically listens to these events:
socketService.emit('stream-analytics', {
  streamId: 'stream-123',
  viewers: 150,
  revenue: 25.50
});

// These updates are automatically reflected in the store
```

## 📈 API Usage

### Fetch Stream Analytics

```javascript
// Frontend
const response = await fetch('/api/streaming/stream-123/analytics?timeRange=24h', {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await response.json();

// Response structure
{
  "realTimeData": {
    "currentViewers": 123,
    "peakViewers": 456,
    "averageWatchTime": 300,
    "totalMessages": 789,
    "totalTips": 150.50,
    "revenue": 150.50,
    "engagement": 75.2
  },
  "historicalData": {
    "viewers": [...],
    "engagement": [...],
    "revenue": [...]
  }
}
```

### Global Analytics (Admin/Creator)

```javascript
// Fetch platform-wide analytics
const response = await fetch('/api/streaming/analytics/global?timeRange=7d', {
  headers: { Authorization: `Bearer ${token}` }
});
```

## 🔧 Configuration

### Environment Variables
No additional environment variables needed - uses existing configuration.

### Database
Analytics tables are automatically created via migrations:
- `stream_analytics` - Real-time metrics
- `stream_analytics_history` - Historical data

## 🎨 UI Components

### StreamAnalyticsEnhanced
Full-featured analytics dashboard with:
- Tab navigation (Overview, Viewers, Revenue, Engagement)
- Time range selector
- Auto-refresh toggle
- Interactive charts
- Export functionality
- Performance metrics

### Usage Example

```javascript
import StreamAnalyticsEnhanced from './components/StreamAnalyticsEnhanced';

function CreatorDashboard() {
  const { user, creator } = useStore();
  
  return (
    <div>
      <h1>Creator Analytics</h1>
      <StreamAnalyticsEnhanced 
        streamId={creator.activeStreamId}
        isCreator={true}
      />
    </div>
  );
}
```

## 🔐 Security

- **Authentication**: All endpoints require valid JWT tokens
- **Authorization**: Creators can only access their own analytics
- **Rate Limiting**: Integrated with existing middleware
- **Data Validation**: Input sanitization and validation
- **SQL Injection Protection**: Parameterized queries

## 📊 Performance Optimizations

1. **Data Cleanup**: Automatic removal of old data points (max 1000)
2. **Selective Re-renders**: Zustand's shallow comparison
3. **Memoization**: Components use React.memo
4. **Batch Updates**: WebSocket events are batched
5. **Index Optimization**: Database indexes on frequently queried columns

## 🧪 Testing

### Test Analytics Store

```javascript
import { renderHook, act } from '@testing-library/react-hooks';
import { useAnalyticsStore } from '../stores/useAnalyticsStore';

test('updates viewer count', () => {
  const { result } = renderHook(() => useAnalyticsStore());
  
  act(() => {
    result.current.updateViewerCount(150);
  });
  
  expect(result.current.streamAnalytics.realTimeData.currentViewers).toBe(150);
});
```

### Test API Endpoints

```javascript
// backend/__tests__/analytics.test.js
describe('Analytics API', () => {
  it('should return stream analytics', async () => {
    const response = await request(app)
      .get('/api/streaming/stream-123/analytics')
      .set('Authorization', `Bearer ${token}`)
      .query({ timeRange: '24h' });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('realTimeData');
    expect(response.body).toHaveProperty('historicalData');
  });
});
```

## 🚨 Troubleshooting

### Analytics Not Updating
1. Check WebSocket connection: `socketService.isConnected`
2. Verify stream ID is correct
3. Check browser console for errors
4. Ensure authentication token is valid

### Performance Issues
1. Reduce auto-refresh interval
2. Limit historical data range
3. Check network latency
4. Verify database indexes exist

### Data Accuracy
1. Check timezone settings
2. Verify aggregation intervals
3. Ensure WebSocket events are firing
4. Check for duplicate event handlers

## 📝 Migration from Old System

### Before (Props/Context)
```javascript
// Old way with props drilling
<StreamAnalytics 
  streamStats={streamStats}
  viewerData={viewerData}
  revenueData={revenueData}
  onUpdate={handleUpdate}
/>
```

### After (Zustand)
```javascript
// New way with Zustand
<StreamAnalyticsEnhanced 
  streamId={streamId}
  isCreator={true}
/>
// Data is automatically fetched and managed by the store
```

## 🎯 Benefits

1. **Real-time Accuracy**: Live data directly from backend
2. **Better Performance**: Optimized re-renders with Zustand
3. **Simplified Code**: No more prop drilling
4. **Automatic Updates**: WebSocket integration
5. **Persistent State**: LocalStorage integration
6. **Type Safety**: TypeScript-ready structure
7. **Scalability**: Handles thousands of concurrent viewers

## 📚 Additional Resources

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Recharts Documentation](https://recharts.org/)
- [WebSocket Best Practices](https://socket.io/docs/)

## 🤝 Support

For issues or questions:
1. Check browser console for errors
2. Verify database migrations have run
3. Ensure WebSocket connection is established
4. Check authentication token validity

---

*Last Updated: 2025-08-05*
*Version: 1.0.0*