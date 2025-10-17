# Redis vs Ably Architecture Overview

This document clarifies the distinct responsibilities of Redis (Upstash) and Ably in the Digis full-stack application.

---

## 🔴 **Redis (Upstash)** - State & Caching Layer

**Purpose:** Serverless-friendly persistent state management and caching

### Core Responsibilities

#### 1. **Rate Limiting** 🚦
- **Dual-tier rate limiting:** Burst (10/sec) + sustained (100/min) windows
- **Environment-namespaced keys:** Prevents staging/prod collisions
- **Atomic operations:** `INCR` with automatic TTL expiry
- **Windowed buckets:** Time-based keys for efficient rate tracking
- **Fail-open pattern:** Allows requests if Redis is unavailable

**Files:**
- `backend/middleware/dual-tier-rate-limiter.js` - Main rate limiting middleware
- `backend/middleware/idempotency.js` - Idempotency key storage
- `backend/utils/upstash-cache.js` - Redis utilities

**Example Keys:**
```
rl:production:tips:user123:burst:1234567890
rl:production:tips:user123:sustained:1234567890
idempotency:tip:abc123def456
```

---

#### 2. **Idempotency Protection** 🔒
- **Duplicate request prevention:** Stores idempotency keys for 24 hours
- **Financial operations:** Tips, ticket purchases, token purchases
- **Mobile-friendly:** Prevents double-charges on flaky networks
- **Atomic checks:** Uses Redis `SET NX` for race-condition-free deduplication

**Example Flow:**
```javascript
// POST /tips/send with Idempotency-Key: abc123
1. Redis check: GET idempotency:tip:abc123 → null (first request)
2. Process tip transaction
3. Redis store: SET idempotency:tip:abc123 = {result} EX 86400
4. Return success

// Retry with same Idempotency-Key
1. Redis check: GET idempotency:tip:abc123 → {cached result}
2. Return cached result immediately (no duplicate charge)
```

---

#### 3. **Data Caching** 💾
- **Creator profiles:** 5-minute TTL (reduces DB load)
- **Analytics dashboards:** 30-minute TTL (heavy aggregations)
- **Feature flags:** 24-hour TTL (config changes)
- **Cache-aside pattern:** `getOrCompute()` helper

**Files:**
- `backend/utils/upstash-cache.js` - Caching utilities

**Example Keys:**
```
creator:user123:profile
analytics:creator456:earnings:2025-01
feature:enable_live_streaming
```

**Cache Strategy:**
```javascript
// 1. Check cache
const cached = await redis.get('creator:123:profile');
if (cached) return JSON.parse(cached);

// 2. Query database
const profile = await db.query('SELECT ...');

// 3. Store in cache
await redis.set('creator:123:profile', JSON.stringify(profile), 300);
```

---

#### 4. **Distributed Locks** 🔐
- **Prevent duplicate operations:** Payout processing, webhook handling
- **Lock acquisition:** Uses `SET key NX EX ttl` (atomic)
- **TTL-based expiry:** Auto-releases locks if process crashes
- **Critical sections:** Ensures single execution across serverless instances

**Example:**
```javascript
// Acquire lock for payout processing
const locked = await acquireLock('payout:user123', 60);
if (!locked) {
  return { error: 'Payout already processing' };
}

try {
  // Process payout
  await processPayoutForUser(user123);
} finally {
  // Release lock
  await releaseLock('payout:user123');
}
```

---

#### 5. **Session Data** 🗂️
- **Temporary user state:** Session IDs, CSRF tokens
- **Short TTLs:** Typically 15-60 minutes
- **Serverless-friendly:** No local memory persistence

---

### ❌ **Redis Does NOT Handle**

- ~~Real-time messaging~~ → **Ably handles this**
- ~~WebSocket connections~~ → **Ably handles this**
- ~~Presence tracking~~ → **Ably Presence API handles this** (deprecated in Redis)
- ~~Pub/Sub for live events~~ → **Ably handles this**

---

## 🟣 **Ably** - Real-time Messaging & Presence Layer

**Purpose:** Serverless-compatible WebSocket/real-time communication

### Core Responsibilities

#### 1. **Real-time Event Broadcasting** 📡
- **Backend → Frontend:** Server publishes, clients subscribe
- **Channel-based:** `user:{userId}`, `stream:{streamId}`, `stream:{streamId}:chat`
- **Event types:** Tips, tickets, calls, balance updates, notifications
- **Automatic reconnection:** Exponential backoff, connection recovery

**81 usages across the backend** in routes for:
- Tips received (`tip:new`)
- Token balance updates (`balance:update`)
- Call requests/responses (`call:request`, `call:accepted`, `call:rejected`)
- Stream events (`stream:started`, `stream:ended`)
- Notifications (`notification:new`)
- Chat messages (`message:new`)
- Reactions (`reaction:new`)

**Files:**
- `backend/utils/ably-adapter.js` - Server-side Ably publisher
- `backend/utils/ably-publish.js` - Alternative publisher
- `backend/api/ably-auth.js` - Token generation for clients
- `frontend/src/services/ablyService.js` - Client-side Ably consumer

**Example Flow:**
```javascript
// Backend: User sends tip
await publishToChannel(`stream:${streamId}`, 'tip:new', {
  tipId: 'tip123',
  amountTokens: 50,
  fromUsername: 'fan1',
  message: 'Great stream!'
});

// Frontend: Stream overlay listens
ably.channels.get(`stream:${streamId}`).subscribe('tip:new', (msg) => {
  showTipOverlay(msg.data); // Animate tip on screen
});
```

---

#### 2. **Presence Tracking** 👥
- **Live viewer counts:** Real-time stream viewer tracking
- **Automatic cleanup:** Leaves presence on disconnect (no stale data)
- **Member lists:** Who's watching, with avatars and usernames
- **Presence events:** `enter`, `leave`, `update`

**Files:**
- `frontend/src/services/presence.js` - Presence utilities
- `frontend/src/hooks/useAblyPresence.js` - React hook for presence
- `frontend/src/hooks/useAblyPresence.js` - Visibility change handling (mobile)

**Example:**
```javascript
// Join stream presence
const presence = await joinStreamPresence(ably, streamId, {
  id: user.id,
  username: user.username,
  avatar: user.avatar
});

// Get live viewer count
const members = await presence.getMembers(); // [{clientId, data}, ...]
console.log(`${members.length} viewers watching`);

// Subscribe to presence changes
presence.subscribeMemberChanges((action, member) => {
  if (action === 'enter') console.log(`${member.data.username} joined!`);
  if (action === 'leave') console.log(`${member.data.username} left`);
});
```

**Mobile Lifecycle Handling:**
```javascript
// App backgrounded → leave presence (accurate counts)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    channel.presence.leave();
  } else {
    // App foregrounded → rejoin presence
    channel.presence.enter({ userId, name, avatar });
  }
});
```

---

#### 3. **Scoped Token Authentication** 🔐
- **Server-side token generation:** Backend validates access, issues scoped tokens
- **Stream-specific capabilities:** Can only subscribe to specific `stream:{streamId}`
- **No wildcards:** Prevents cross-stream access
- **Backend-only publishing:** Clients can only subscribe (no publish rights)
- **Access validation:** Checks if user can join stream (public, follower-only, ticketed, private)

**Files:**
- `backend/api/ably-auth.js` - Token generation endpoint
- `backend/utils/stream-access.js` - Stream access validation

**Token Scoping:**
```javascript
// User requests token for streamId=abc123
POST /api/ably-auth
Body: { streamId: 'abc123' }

// Backend validates access
const access = await canUserJoinStream(userId, 'abc123');
if (!access.allowed) return 403;

// Issue scoped token
{
  capabilities: {
    "user:user456": ["subscribe", "history"],           // Personal notifications
    "stream:abc123": ["subscribe", "presence", "history"] // Only this stream
  },
  ttl: 7200000 // 2 hours
}
```

**Security Hierarchy:**
1. **Public/free streams:** Anyone can subscribe
2. **Creator's own stream:** Always allowed
3. **Follower-only streams:** Must be following creator
4. **Ticketed streams:** Must have purchased ticket
5. **Private streams:** Creator only

---

#### 4. **Connection State Management** 🔌
- **Comprehensive logging:** Connected, connecting, disconnected, suspended, etc.
- **Connection state events:** Frontend can show "reconnecting..." badges
- **Exponential backoff:** 3s disconnected retry, 10s suspended retry
- **Connection recovery:** Rejoins channels with last 50 messages

**Files:**
- `frontend/src/services/ablyService.js` - Connection state handlers

**States Monitored:**
```
✅ connected     - Fully connected, ready to send/receive
🔄 connecting    - Establishing connection
⚠️  disconnected - Lost connection, will retry
⏸️  suspended    - Connection issues, retrying with backoff
👋 closing       - Gracefully closing connection
❌ closed        - Connection fully closed
💥 failed        - Connection failed permanently
🔄 update        - Connection state changed
```

---

#### 5. **Channel Organization** 🗂️

**Channel Naming Conventions:**

| Channel Pattern | Purpose | Publish Rights | Subscribe Rights |
|----------------|---------|----------------|------------------|
| `user:{userId}` | Personal notifications, call requests, balance updates | Backend only | User only |
| `stream:{streamId}` | Stream events (tips, tickets, reactions) | Backend only | Stream viewers (scoped) |
| `stream:{streamId}:chat` | Stream chat messages | Backend only* | Stream viewers (scoped) |

*Optional: Can enable client-side chat publishing with additional capability

---

### ❌ **Ably Does NOT Handle**

- ~~Caching~~ → **Redis handles this**
- ~~Rate limiting~~ → **Redis handles this**
- ~~Idempotency~~ → **Redis handles this**
- ~~Distributed locks~~ → **Redis handles this**
- ~~Persistent state~~ → **PostgreSQL + Redis handle this**

---

## 🔄 **Integration Pattern**

### Typical Request Flow

```
1. User action (e.g., "Send Tip")
   ↓
2. Frontend → Backend API (POST /tips/send)
   ↓
3. Backend checks REDIS for:
   - Rate limit (dual-tier: burst + sustained)
   - Idempotency key (prevent duplicate)
   ↓
4. Backend processes transaction:
   - Deduct tokens from tipper
   - Add tokens to creator
   - Record in PostgreSQL
   ↓
5. Backend publishes to ABLY:
   publishToChannel(`stream:${streamId}`, 'tip:new', data)
   publishToChannel(`user:${creatorId}`, 'balance:update', { balance })
   ↓
6. Frontend ABLY clients receive events:
   - Stream overlay shows animated tip
   - Creator's balance updates in real-time
   ↓
7. Backend caches in REDIS:
   - Updated creator profile (5 min TTL)
   - Analytics aggregations (30 min TTL)
```

---

## 📊 **Key Metrics**

### Redis Usage
- **Rate limit checks:** 100-500 req/sec (atomic INCR operations)
- **Idempotency checks:** ~10-50 req/sec (financial operations)
- **Cache hits:** ~60-80% hit rate (reduces DB load)
- **Distributed locks:** ~5-10 concurrent locks (payout processing)

### Ably Usage
- **Active channels:** 50-200 simultaneous streams
- **Messages/minute:** 1000-5000 (tips, reactions, chat, notifications)
- **Presence updates:** 100-500/min (viewers joining/leaving)
- **Connection states:** ~95% uptime with automatic reconnection

---

## 🛡️ **Security Model**

### Redis Security
- ✅ Environment-namespaced keys (staging vs production)
- ✅ Fail-open pattern (don't block traffic on Redis errors)
- ✅ TTL-based auto-expiry (no manual cleanup needed)
- ✅ Atomic operations (INCR, SET NX) prevent race conditions

### Ably Security
- ✅ Server-generated tokens (API key never exposed to client)
- ✅ Scoped capabilities per stream (no wildcards)
- ✅ Backend-only publishing (clients can only subscribe)
- ✅ Stream access validation (public, follower-only, ticketed, private)
- ✅ 2-hour token TTL (automatic rotation)
- ✅ Fail-closed validation (deny access on errors)

---

## 🚀 **Serverless Compatibility**

Both Redis (Upstash) and Ably are **fully serverless-compatible**:

### Why Serverless-Friendly?

| Feature | Redis (Upstash) | Ably |
|---------|----------------|------|
| **Connection pooling** | REST API (no persistent connections) | REST + WebSocket (auto-managed) |
| **Cold starts** | ~10ms latency | Token-based auth (fast) |
| **Stateless** | ✅ REST-based | ✅ Channels auto-rejoin |
| **Vercel-compatible** | ✅ Upstash KV | ✅ Native support |
| **Auto-scaling** | ✅ Elastic | ✅ Global CDN |

### Traditional Alternatives (NOT serverless-friendly)

❌ **Self-hosted Redis** - Requires persistent connections, connection pooling
❌ **Socket.io** - Requires long-lived server processes, sticky sessions
❌ **In-memory rate limiting** - State lost on serverless cold starts

---

## 📈 **Performance Characteristics**

### Redis (Upstash)
- **GET latency:** 5-15ms (global)
- **SET latency:** 5-15ms (global)
- **INCR latency:** 5-15ms (atomic)
- **Throughput:** 10,000+ ops/sec (per instance)
- **TTL expiry:** Automatic, no manual cleanup

### Ably
- **Message latency:** 50-200ms (global pub/sub)
- **Presence updates:** 100-500ms (real-time reconciliation)
- **Connection recovery:** 3-10s (exponential backoff)
- **Throughput:** 1M+ messages/sec (global)
- **History rewind:** Last 50 messages on rejoin

---

## 🔧 **Configuration**

### Environment Variables

```bash
# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Ably
ABLY_API_KEY=...  # Backend only (server-to-server)

# Frontend gets token from:
# POST ${VITE_BACKEND_URL}/api/ably-auth
```

### Feature Flags

```javascript
// Stored in Redis with 24h TTL
await setFeatureFlag('enable_live_streaming', true);
const enabled = await getFeatureFlag('enable_live_streaming');
```

---

## 🧪 **Testing Tips**

### Redis Testing
```bash
# Test rate limiting
for i in {1..15}; do curl -X POST http://localhost:3005/tips/send; done
# → Should see 429 after 10 requests (burst limit)

# Test idempotency
curl -X POST http://localhost:3005/tips/send -H "Idempotency-Key: test123"
curl -X POST http://localhost:3005/tips/send -H "Idempotency-Key: test123"
# → Second request returns cached result
```

### Ably Testing
```javascript
// Open DevTools console on stream page
const ably = window.ablyService.client;

// Check token capabilities (should be scoped)
console.log(ably.auth.tokenDetails.capability);
// → { "user:abc": ["subscribe"], "stream:123": ["subscribe","presence"] }

// Try to publish (should fail)
ably.channels.get('stream:123').publish('tip:new', {});
// → Error: Insufficient privileges

// Monitor connection state
ably.connection.on(state => console.log('[Ably]', state.current));
```

---

## 📚 **Summary**

| Responsibility | Redis (Upstash) | Ably |
|---------------|----------------|------|
| **Real-time messaging** | ❌ | ✅ |
| **Presence tracking** | ❌ (deprecated) | ✅ |
| **Rate limiting** | ✅ | ❌ |
| **Idempotency** | ✅ | ❌ |
| **Caching** | ✅ | ❌ |
| **Distributed locks** | ✅ | ❌ |
| **Session storage** | ✅ | ❌ |
| **WebSocket connections** | ❌ | ✅ |
| **Channel-based pub/sub** | ❌ | ✅ |
| **Token-based auth** | ❌ | ✅ |
| **Serverless-compatible** | ✅ | ✅ |

**Rule of Thumb:**
- Need to **store/cache/limit**? → Use **Redis**
- Need to **broadcast/notify/track presence**? → Use **Ably**

---

## 🔮 **Future Optimizations**

### Redis
- [ ] Implement circuit breaker wrapper for Redis calls
- [ ] Tune cache TTLs based on production metrics
- [ ] Add Redis key expiry monitoring (track TTL distributions)
- [ ] Implement cache warming for popular creators

### Ably
- [ ] Enable client-side chat publishing with rate limiting
- [ ] Add admin-only Ably REST endpoints for viewer analytics
- [ ] Implement presence debouncing for large streams (>500 viewers)
- [ ] Add connection state badges in UI ("reconnecting...")

---

## 📖 **Further Reading**

- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Ably Realtime Documentation](https://ably.com/docs/realtime)
- [Rate Limiting Patterns](https://blog.upstash.com/rate-limiting)
- [Presence API Best Practices](https://ably.com/docs/presence-occupancy)

---

**Last Updated:** 2025-10-17
**Architecture Version:** 2.0 (Post Socket.io → Ably migration)
