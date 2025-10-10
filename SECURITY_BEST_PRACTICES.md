# Security Best Practices - Digis Platform

## Authentication & Session Management

### Current Implementation ✅

**Backend (Highly Secure)**:
- ✅ Supabase Auth with JWT tokens
- ✅ Redis session management with TTL
- ✅ httpOnly cookie support via backend sessions
- ✅ Server-side role verification (single source of truth)
- ✅ PKCE flow for OAuth
- ✅ Rate limiting on auth endpoints
- ✅ Session invalidation on logout

**Frontend (Good with Room for Improvement)**:
- ✅ PKCE flow enabled for enhanced OAuth security
- ✅ Auto-refresh tokens
- ⚠️ Tokens stored in localStorage (Supabase SDK limitation)
- ✅ Profile cache with expiry
- ✅ Role verification via backend API

### Known Limitations & Mitigation

#### 1. Tokens in localStorage (XSS Risk)

**Why?**: Supabase SDK doesn't natively support httpOnly cookies for client-side auth

**Current Mitigations**:
- ✅ CSP headers block inline scripts (backend/middleware/csp-headers.js)
- ✅ XSS sanitization on all inputs (backend/middleware/sanitize.js)
- ✅ Content Security Policy in production
- ✅ Regular token rotation (Supabase handles automatically)
- ✅ Short-lived access tokens (1 hour default)

**Future Improvement Options**:

1. **Supabase Edge Functions (Recommended)**:
   ```javascript
   // Create edge function to set httpOnly cookies
   // Then configure frontend to use cookie-based auth
   ```

2. **Custom Auth Wrapper**:
   ```javascript
   // Implement custom storage adapter that uses IndexedDB with encryption
   ```

3. **Backend Proxy for Auth**:
   ```javascript
   // Route all auth through backend, set httpOnly cookies
   ```

#### 2. Profile Cache in localStorage

**Why?**: Better UX - instant profile load on refresh

**Security Measures**:
- ✅ Cache expires with session (7 days max)
- ✅ No sensitive data (passwords, tokens) stored
- ✅ Auto-clears on logout
- ✅ Version-controlled with migration support

**What's Cached** (profileCache.js):
- User ID, email, username, display name
- Profile picture URL
- Role flags (is_creator, is_super_admin)
- Token balance (public info, not payment methods)

**NOT Cached**:
- ❌ Access tokens
- ❌ Payment methods
- ❌ Bank account details
- ❌ Passwords or credentials

### Security Configuration Checklist

#### Frontend
- [x] PKCE flow enabled
- [x] Auto-refresh tokens
- [x] Session detection in URL
- [x] Client-side CSP
- [ ] Consider IndexedDB encryption for sensitive cache
- [ ] Implement Supabase Edge Functions for httpOnly cookies

#### Backend
- [x] Helmet.js security headers
- [x] CORS whitelist
- [x] Rate limiting on sensitive endpoints
- [x] Input validation & sanitization
- [x] SQL injection prevention (parameterized queries)
- [x] XSS protection (DOMPurify)
- [x] CSRF protection via SameSite cookies
- [x] Redis session store
- [x] JWT validation on every request

## Payment Security

### Stripe Integration ✅

- [x] Idempotency keys prevent duplicate charges (payments.js:120-127)
- [x] Webhook signature verification (payments.js:513)
- [x] Webhook event deduplication (payments.js:520-536)
- [x] Amount validation server-side (payments.js:47-60)
- [x] Transactional database writes (payments.js:68-214)
- [x] Never trust client-sent amounts
- [x] Cents-based calculations (avoid float errors)
- [x] Retry logic with exponential backoff

### Payment Data Storage

**What's Stored**:
- Stripe payment intent IDs
- Transaction amounts (in cents)
- Payment status
- Session IDs

**NOT Stored**:
- ❌ Full credit card numbers
- ❌ CVV codes
- ❌ Raw card data (Stripe handles this)

**Bank Account Storage**:
- ⚠️ Last 4 digits only (masked in payments.js:679)
- ⚠️ Encrypted JSON in database
- 🔒 TODO: Use dedicated encryption service (KMS)

## Database Security (RLS)

### Row Level Security ✅

All tables have RLS enabled (ENABLE_RLS_SECURITY.sql):

**Users Table**:
- Users can read their own profile ✅
- Public creator profiles are readable ✅
- Only service role can create users ✅
- Users can update their own data ✅

**Token Balances**:
- Users can only see their own balance ✅
- Only backend can update balances ✅

**Payments**:
- Users see only their transactions ✅
- Creators see their earnings ✅

**Sessions**:
- Only participants can see session ✅

### Database Indexes ✅

Performance indexes on RLS filters (ENABLE_RLS_SECURITY.sql:356-373):
- `idx_users_supabase_id` - Fast user lookup
- `idx_token_balances_user` - Balance queries
- `idx_sessions_creator` - Creator sessions
- `idx_sessions_fan` - Fan sessions

## API Security

### Rate Limiting ✅

Configured in `backend/middleware/rate-limiters.js`:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Auth | 10 req | 15 min |
| Payments | 20 req | 15 min |
| Token Purchase | 30 req | 15 min |
| Streaming | 100 req | 15 min |
| API (general) | 100 req | 15 min |
| Public | 50 req | 15 min |

**Implementation**: Redis-backed rate limiter with IP tracking

### Input Validation ✅

**Backend** (middleware/sanitize.js):
- XSS protection via DOMPurify
- SQL injection prevention via parameterized queries
- Schema validation via Zod
- File upload validation (size, type)

**Frontend**:
- Form validation via React Hook Form
- Client-side sanitization (not trusted)
- Type checking via PropTypes/TypeScript

## Vercel Deployment Security

### Environment Variables

**NEVER commit** (already in .gitignore):
- ❌ DATABASE_URL
- ❌ STRIPE_SECRET_KEY
- ❌ SUPABASE_SERVICE_ROLE_KEY
- ❌ AGORA_APP_CERTIFICATE
- ❌ JWT_SECRET

**Set in Vercel Dashboard**:
1. Go to Project Settings → Environment Variables
2. Add production, preview, and development values
3. Use `decrypt=true` for Vercel API access

### Serverless Adaptations ✅

**What's Disabled on Vercel**:
- ❌ Socket.io (replaced with Ably)
- ❌ BullMQ (replaced with Inngest)
- ❌ node-cron (replaced with QStash)
- ❌ Persistent workers

**Enabled** (backend/api/index.js):
- ✅ Ably for realtime
- ✅ Inngest for background jobs
- ✅ QStash for scheduled tasks
- ✅ Conditional logic detects serverless

## Monitoring & Incident Response

### Logging ✅

**Sentry** (backend/instrument.js):
- Error tracking
- Performance monitoring
- Request tracing
- Source maps uploaded via CI

**Winston** (backend/utils/secureLogger.js):
- Structured logging
- File-based logs
- Sensitive data filtering
- Log rotation

### Alerts

**Set up monitoring for**:
- [ ] Failed auth attempts (>10/min)
- [ ] Payment failures
- [ ] Database connection errors
- [ ] API response time >2s
- [ ] Error rate >1%

## Compliance

### Data Handling

**GDPR Compliance**:
- ✅ User can delete account (auth.js:684-751)
- ✅ Data export available via API
- ✅ Cookie consent (frontend responsibility)
- [ ] Data retention policy (TODO)

**PCI Compliance**:
- ✅ No card data stored (Stripe handles)
- ✅ TLS/SSL required
- ✅ Secure webhooks

### Age Verification ✅

- Users must be 18+ (auth.js:154-173)
- Date of birth validated server-side
- Age gate on signup

## Security Incident Response

### If Credentials Are Compromised

1. **Immediately rotate**:
   ```bash
   # Generate new keys in services
   # Update Vercel environment variables
   vercel env pull .env.production.local
   vercel env rm DATABASE_URL production
   vercel env add DATABASE_URL production
   ```

2. **Invalidate sessions**:
   ```bash
   # Clear Redis cache
   # Force all users to re-login
   ```

3. **Audit logs**:
   ```bash
   # Check backend/logs/
   # Review Sentry for suspicious activity
   ```

### If XSS Attack Detected

1. Review CSP violations in Sentry
2. Check input sanitization
3. Update CSP headers if needed
4. Deploy hotfix immediately

## Security Roadmap

### High Priority
- [ ] Migrate to httpOnly cookies via Supabase Edge Functions
- [ ] Add Web Application Firewall (Cloudflare)
- [ ] Implement API key rotation schedule
- [ ] Add 2FA for creator accounts

### Medium Priority
- [ ] Encrypt bank account data with KMS
- [ ] Add security headers to frontend
- [ ] Implement CAPTCHA on auth endpoints
- [ ] Add IP geolocation anomaly detection

### Low Priority
- [ ] Add session device tracking
- [ ] Implement biometric auth (optional)
- [ ] Add security audit trail for admins

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Stripe Security](https://stripe.com/docs/security/guide)
- [Vercel Security](https://vercel.com/docs/security)

## Contact

For security concerns, email: security@digis.com

**Do NOT** disclose security vulnerabilities publicly.
