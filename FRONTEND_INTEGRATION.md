# Frontend Integration Guide - Creator Overview

## Overview

The `/api/v1/creators/overview` endpoint is now live and provides aggregated creator metrics in a single API call. This guide shows you how to integrate it into your React frontend.

## 🚀 Quick Start

### Option 1: Drop-in Component (Fastest)

Add the pre-built component to any dashboard:

```jsx
import CreatorOverviewCards from './components/CreatorOverviewCards';

function CreatorDashboard() {
  return (
    <div>
      <h1>Creator Dashboard</h1>
      <CreatorOverviewCards />
    </div>
  );
}
```

### Option 2: Custom Hook (Full Control)

Use the React Query hook for custom UI:

```jsx
import { useCreatorOverview, formatters } from './hooks/useCreatorOverview';

function CustomDashboard() {
  const { data, isLoading, error, refetch } = useCreatorOverview();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const { usd, number } = formatters;

  return (
    <div>
      <h2>Total Earnings: {usd(data.earnings?.total_cents)}</h2>
      <p>Followers: {number(data.relationships?.followers)}</p>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

---

## 📦 What's Included

### 1. React Query Hook

**File**: `frontend/src/hooks/useCreatorOverview.js`

Features:
- ✅ Automatic caching (60s server + React Query cache)
- ✅ Auto-refresh on window focus
- ✅ Optional time-range filtering
- ✅ Built-in format helpers
- ✅ Loading/error states
- ✅ Cache invalidation

**Basic Usage**:
```jsx
const { data, isLoading, error } = useCreatorOverview();
```

**With Time Range** (last 30 days):
```jsx
const { data } = useCreatorOverviewLastDays(30);

// Or manually:
const from = new Date(Date.now() - 30*24*60*60*1000).toISOString();
const to = new Date().toISOString();
const { data } = useCreatorOverview({ from, to });
```

**Bypass Cache** (real-time data):
```jsx
const { data, refetch } = useCreatorOverview({ noCache: true });
```

### 2. Dashboard Component

**File**: `frontend/src/components/CreatorOverviewCards.jsx`

Features:
- ✅ Responsive grid layout (4 columns → 2 on tablet → 1 on mobile)
- ✅ 16 pre-configured metric cards
- ✅ Loading skeletons
- ✅ Error states with retry
- ✅ Framer Motion animations
- ✅ Heroicons
- ✅ Tailwind CSS styling

**Props**:
```jsx
<CreatorOverviewCards
  days={30}              // Optional: filter to last N days
  showRefreshButton      // Optional: show manual refresh (default: true)
  className="mt-6"       // Optional: additional CSS classes
/>
```

### 3. Format Helpers

**Available formatters**:

```jsx
import { formatters } from './hooks/useCreatorOverview';

const { number, usd, usdCompact, duration, percent } = formatters;

// Number formatting
number(1234567) // "1,234,567"

// Currency formatting
usd(450000) // "$4,500.00"
usdCompact(450000) // "$4.5K"

// Duration formatting
duration(3665) // "1h 1m"

// Percentage
percent(75, 100) // "75.0%"
```

---

## 📊 Data Structure

The hook returns this structure:

```typescript
{
  success: true,
  meta: {
    from: "2025-10-01T00:00:00.000Z",  // null if no filter
    to: "2025-10-18T00:00:00.000Z",
    generatedAt: "2025-10-17T12:34:56.789Z",
    cached: false
  },
  profile: { /* sanitized user data */ },
  pricing: {
    video_rate_cents: 10000,
    voice_rate_cents: 5000,
    stream_rate_cents: 1000,
    message_price_cents: 500
  },
  balances: {
    creator_tokens: 15420,
    fan_tokens: 250
  },
  earnings: {
    total_cents: 450000,
    count: 127
  },
  payouts: {
    total_cents: 300000,
    count: 8,
    pending_count: 1,
    completed_count: 7
  },
  tips: { total_cents: 45000, count: 89 },
  payments: { total_cents: 125000, count: 43 },
  messaging: {
    direct_messages: 342,
    chat_messages: 1580,
    ppv_messages: { count: 15, total_cents: 7500 }
  },
  sessions: {
    total: 67,
    total_seconds: 45600,
    earnings_cents: 228000
  },
  streams: {
    live_count: 0,
    upcoming_count: 2,
    ended_count: 24,
    total_sessions: 24,
    total_viewers: 3420,
    revenue_cents: 68000
  },
  relationships: {
    followers: 1240,
    subscribers: 89,
    active_subscribers: 76
  },
  content: {
    uploads: 145,
    sales_count: 234,
    sales_cents: 93600
  },
  analytics: {
    views: 45230,
    clicks: 3420,
    impressions: 128900
  }
}
```

---

## 🔄 Real-time Updates with Ably (Optional)

### Step 1: Create Real-time Hook

```jsx
// src/hooks/useOverviewRealtime.js
import { useEffect } from 'react';
import * as Ably from 'ably';
import { useInvalidateCreatorOverview } from './useCreatorOverview';

export function useOverviewRealtime(creatorId) {
  const invalidate = useInvalidateCreatorOverview();

  useEffect(() => {
    if (!creatorId) return;

    const client = new Ably.Realtime({
      authUrl: `${import.meta.env.VITE_BACKEND_URL}/api/v1/realtime/ably-auth`
    });

    const channel = client.channels.get(`creator:${creatorId}:overview`);

    const handler = (message) => {
      console.log('Overview updated:', message.data);
      invalidate(); // Trigger refetch
    };

    channel.subscribe('overview_updated', handler);

    return () => {
      channel.unsubscribe('overview_updated', handler);
      client.close();
    };
  }, [creatorId, invalidate]);
}
```

### Step 2: Use in Component

```jsx
import CreatorOverviewCards from './components/CreatorOverviewCards';
import { useOverviewRealtime } from './hooks/useOverviewRealtime';

function Dashboard({ user }) {
  // Enable real-time updates
  useOverviewRealtime(user?.supabase_id);

  return <CreatorOverviewCards />;
}
```

### Step 3: Emit Events from Backend

When creator data changes (tips, new follower, etc.):

```javascript
// backend/routes/tips.js (example)
const Ably = require('ably');
const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });

// After inserting tip
await ably.channels.get(`creator:${creatorId}:overview`)
  .publish('overview_updated', { reason: 'tip_received', amount: tipAmount });
```

---

## 🎨 Customization Examples

### Example 1: Compact Card Grid

```jsx
function CompactOverview() {
  const { data, isLoading } = useCreatorOverview();
  const { usd, number } = formatters;

  if (isLoading) return <Skeleton />;

  return (
    <div className="grid gap-3 grid-cols-4">
      <StatCard label="Earnings" value={usd(data.earnings?.total_cents)} />
      <StatCard label="Followers" value={number(data.relationships?.followers)} />
      <StatCard label="Streams" value={number(data.streams?.total_sessions)} />
      <StatCard label="Revenue" value={usd(data.streams?.revenue_cents)} />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
```

### Example 2: Earnings Chart

```jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function EarningsChart() {
  const { data } = useCreatorOverview();

  // You'd fetch time-series data separately or extend the endpoint
  const chartData = [
    { date: 'Oct 1', cents: 12000 },
    { date: 'Oct 8', cents: 18000 },
    { date: 'Oct 15', cents: 25000 },
  ];

  return (
    <div className="rounded-2xl border p-6">
      <h3 className="mb-4 text-lg font-semibold">Earnings Trend</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData}>
          <XAxis dataKey="date" />
          <YAxis tickFormatter={(v) => `$${(v/100).toFixed(0)}`} />
          <Tooltip formatter={(v) => `$${(v/100).toFixed(2)}`} />
          <Line type="monotone" dataKey="cents" stroke="#3b82f6" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Example 3: Top Metrics Summary

```jsx
function MetricsSummary() {
  const { data, isLoading } = useCreatorOverview();

  if (isLoading) return <div>Loading...</div>;

  const metrics = [
    { label: 'Total Earnings', value: formatters.usd(data.earnings?.total_cents), trend: '+12%' },
    { label: 'Active Subscribers', value: data.relationships?.active_subscribers, trend: '+8%' },
    { label: 'Avg. Session Time', value: formatters.duration(data.sessions?.total_seconds / data.sessions?.total), trend: '+5%' },
  ];

  return (
    <div className="flex gap-6">
      {metrics.map(m => (
        <div key={m.label} className="flex-1 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-6 text-white">
          <div className="text-sm opacity-90">{m.label}</div>
          <div className="mt-2 text-3xl font-bold">{m.value}</div>
          <div className="mt-1 text-xs opacity-75">{m.trend} vs last month</div>
        </div>
      ))}
    </div>
  );
}
```

---

## 🐛 Error Handling

### Handle 401 (Unauthorized)

```jsx
function Dashboard() {
  const { data, unauthorized, refetch } = useCreatorOverview();

  if (unauthorized) {
    // Option 1: Redirect to login
    window.location.href = '/login';

    // Option 2: Refresh Supabase session
    const refreshSession = async () => {
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session) refetch();
    };
    refreshSession();

    return <div>Re-authenticating...</div>;
  }

  return <CreatorOverviewCards />;
}
```

### Handle 404 (User Not Found)

```jsx
function Dashboard() {
  const { data, notFound } = useCreatorOverview();

  if (notFound) {
    // Sync user with backend
    const syncUser = async () => {
      await apiClient.post('/api/v1/auth/sync-user');
      window.location.reload();
    };

    return (
      <div>
        <p>Profile not found. Syncing...</p>
        <button onClick={syncUser}>Sync Now</button>
      </div>
    );
  }

  return <CreatorOverviewCards />;
}
```

---

## 🚀 Performance Tips

### 1. Prefetch on Navigation

```jsx
import { useQueryClient } from '@tanstack/react-query';

function NavLink() {
  const queryClient = useQueryClient();

  const prefetch = () => {
    queryClient.prefetchQuery({
      queryKey: ['creator-overview'],
      queryFn: () => apiClient.get('/api/v1/creators/overview').then(r => r.data),
    });
  };

  return (
    <a href="/dashboard" onMouseEnter={prefetch}>
      Dashboard
    </a>
  );
}
```

### 2. Invalidate After Mutations

```jsx
import { useInvalidateCreatorOverview } from './hooks/useCreatorOverview';

function TipButton() {
  const invalidate = useInvalidateCreatorOverview();

  const sendTip = async () => {
    await apiClient.post('/api/v1/tips', { amount: 1000 });
    invalidate(); // Refresh overview
  };

  return <button onClick={sendTip}>Send Tip</button>;
}
```

### 3. Stale-While-Revalidate

The hook already implements SWR by default:
- Shows cached data instantly (stale)
- Fetches fresh data in background (revalidate)
- Updates UI when new data arrives

---

## 📱 Mobile Responsive Layout

The `CreatorOverviewCards` component automatically adapts:

- **Desktop (lg)**: 4 columns
- **Tablet (sm)**: 2 columns
- **Mobile**: 1 column

To customize:

```jsx
<CreatorOverviewCards className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6" />
```

---

## ✅ Integration Checklist

- [ ] Install dependencies (already installed: `@tanstack/react-query`, `framer-motion`, `@heroicons/react`)
- [ ] Copy `frontend/src/hooks/useCreatorOverview.js`
- [ ] Copy `frontend/src/components/CreatorOverviewCards.jsx`
- [ ] Import and use in dashboard:
  ```jsx
  import CreatorOverviewCards from './components/CreatorOverviewCards';
  <CreatorOverviewCards />
  ```
- [ ] Test loading state (slow 3G throttling)
- [ ] Test error states (disconnect network)
- [ ] Test authentication (clear tokens)
- [ ] Test refresh button
- [ ] Optional: Add real-time updates with Ably

---

## 🔗 API Reference

**Endpoint**: `GET /api/v1/creators/overview`

**Auth**: Required (Supabase JWT via `Authorization: Bearer <token>`)

**Query Params**:
- `from` (optional): ISO 8601 start date
- `to` (optional): ISO 8601 end date
- `noCache` (optional): `true` to bypass server cache

**Response**: See "Data Structure" section above

**Caching**:
- Server: 60 seconds (Upstash Redis)
- Client: 60 seconds stale time + 5 minutes cache time

**Performance**:
- First load: ~200ms (database queries)
- Cache hit: ~5-10ms (Redis)
- Subsequent loads: ~5-50ms (React Query cache)

---

## 🎯 Next Steps

1. **Deploy**: Files already committed to `frontend/src/`
2. **Import**: Add `<CreatorOverviewCards />` to your creator dashboard
3. **Test**: Verify data loads correctly
4. **Customize**: Adjust layout, colors, metrics as needed
5. **Real-time** (optional): Add Ably integration for live updates

Need help? Check the example implementations in this guide or review the component source code.
