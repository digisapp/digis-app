# Integration Steps for Production-Ready Features

## Backend Integration

### 1. Update Main API File
Add these imports to `backend/api/index.js`:

```javascript
// After existing imports, add:
const { applyCSP } = require('../middleware/csp-headers');
const paymentsEnhanced = require('../routes/payments-enhanced');

// Apply CSP headers (add after security middleware)
applyCSP(app, {
  reportOnly: false, // Set to true initially to test without blocking
  reportUri: '/api/csp-report'
});

// Replace old payment routes with enhanced version
app.use('/api/v1/payments', paymentsEnhanced);
```

### 2. Update Existing Payment Routes
In routes that handle money, add:

```javascript
const { idempotency } = require('../middleware/idempotency');
const { moneyOperationsLimiter } = require('../middleware/financial-rate-limiter');

// On token purchase endpoint:
router.post('/tokens/purchase',
  authenticateToken,
  moneyOperationsLimiter,
  idempotency({ ttl: 86400 }),
  async (req, res) => {
    // existing logic
  }
);
```

## Frontend Integration

### 1. Update API Service
In `frontend/src/services/api.js`:

```javascript
import { v4 as uuidv4 } from 'uuid';

// Add idempotency to payment requests
export const purchaseTokens = async (amountInCents, paymentMethodId) => {
  const idempotencyKey = uuidv4();

  const response = await fetch(`${API_BASE}/api/v1/payments/purchase-tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
      'Idempotency-Key': idempotencyKey // Critical for preventing double charges
    },
    body: JSON.stringify({ amountInCents, paymentMethodId })
  });

  if (response.status === 429) {
    const error = await response.json();
    throw new Error(`Rate limited. Try again in ${error.retryAfter} seconds`);
  }

  return response.json();
};
```

### 2. Update VideoCall Component
Replace Agora imports in components:

```javascript
// Old way:
import AgoraRTC from 'agora-rtc-sdk-ng';

// New way:
import { loadAgoraRTC, createAgoraClient, preloadAgoraSDKs } from '../utils/agoraLazyLoader';

// In component:
useEffect(() => {
  // Preload when component mounts (non-blocking)
  preloadAgoraSDKs();
}, []);

// When starting call:
const client = await createAgoraClient('rtc', 'vp8');
```

### 3. Add TanStack Query
Install and setup in `frontend/src/App.js`:

```javascript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
    }
  }
});

// Wrap app
<QueryClientProvider client={queryClient}>
  {/* Your app */}
</QueryClientProvider>
```

### 4. Use TanStack Query for API State
Example in a component:

```javascript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function TokenBalance() {
  const { data: balance, isLoading } = useQuery({
    queryKey: ['tokenBalance'],
    queryFn: fetchTokenBalance,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const purchaseMutation = useMutation({
    mutationFn: purchaseTokens,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries(['tokenBalance']);
    }
  });

  return (
    <div>
      {isLoading ? 'Loading...' : `Balance: ${balance} tokens`}
      <button onClick={() => purchaseMutation.mutate({ amount: 1000 })}>
        Buy Tokens
      </button>
    </div>
  );
}
```

## Environment Variables

Add to `.env`:

```bash
# Redis (required for rate limiting and idempotency)
REDIS_URL=redis://localhost:6379

# For production Redis (Upstash)
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# CSP Report URI (optional)
CSP_REPORT_URI=/api/csp-report

# Trust levels for progressive rate limiting
RATE_LIMIT_TRUST_LEVELS={"basic":5,"verified":15,"trusted":30,"vip":50}
```

## Testing Checklist

- [ ] Test token purchase with same idempotency key twice (should return same result)
- [ ] Test rate limiting (make 11 purchases in 1 minute, 11th should fail)
- [ ] Test daily spending limit ($100 default)
- [ ] Open browser console, check for CSP violations
- [ ] Test Agora loads only when entering call
- [ ] Test Socket.io works with multiple tabs open
- [ ] Check double-entry ledger balances after transactions

## Monitoring Setup

### 1. Add Monitoring Endpoints
```javascript
// In backend/api/index.js
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await redis.ping();
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

### 2. Log Critical Events
All financial operations now log to:
- Console (development)
- File logs (production)
- Audit table (database)

## Rollback Plan

If issues arise:

1. **Disable enhanced features temporarily**:
```javascript
// In backend/api/index.js
const ENABLE_ENHANCED_FEATURES = false; // Toggle off

if (ENABLE_ENHANCED_FEATURES) {
  app.use('/api/v1/payments', paymentsEnhanced);
} else {
  app.use('/api/payments', oldPaymentRoutes);
}
```

2. **Keep old routes available**:
Don't delete old payment routes until new ones are stable in production.

3. **Database rollback**:
```sql
-- If needed, rollback ledger migration
DROP TABLE IF EXISTS entries CASCADE;
DROP TABLE IF EXISTS journals CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS financial_audit_log CASCADE;
DROP TYPE IF EXISTS account_type CASCADE;
DROP TYPE IF EXISTS transaction_type CASCADE;
```

## Performance Monitoring

Watch for:
- Response time increase on payment endpoints
- Redis memory usage
- Database connection pool exhaustion
- CSP violation reports
- Socket.io connection stability

## Next Phase Features

Once stable, implement:
1. Background job processing (Bull/BullMQ)
2. Webhook signature validation for all external services
3. BFF pattern for httpOnly cookies
4. Comprehensive E2E tests with Playwright
5. OpenTelemetry tracing