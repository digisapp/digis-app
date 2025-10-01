# Sentry Setup Guide for Digis

## ✅ Installation Complete

Sentry has been successfully integrated into both backend and frontend of the Digis platform.

## 🚀 Quick Start

### 1. Create a Sentry Account

1. Go to [https://sentry.io](https://sentry.io)
2. Sign up for a free account (supports 5K errors/month free)
3. Create a new organization (e.g., "digis")

### 2. Create Projects

Create two projects in Sentry:

1. **Backend Project** (Node.js)
   - Name: `digis-backend`
   - Platform: Node.js

2. **Frontend Project** (React)
   - Name: `digis-frontend`
   - Platform: React

### 3. Get Your DSN Keys

After creating each project, get the DSN from:
- Settings → Projects → [Project Name] → Client Keys (DSN)

### 4. Configure Environment Variables

#### Backend (.env)
```env
# Sentry Error Tracking
SENTRY_DSN=https://YOUR_BACKEND_DSN@sentry.io/YOUR_PROJECT_ID
```

#### Frontend (.env)
```env
# Sentry Error Tracking
VITE_SENTRY_DSN=https://YOUR_FRONTEND_DSN@sentry.io/YOUR_PROJECT_ID
VITE_SENTRY_ENABLED=true
```

## 🧪 Testing Sentry Integration

### Backend Testing

The backend includes test endpoints (development only):

```bash
# Test error capture
curl http://localhost:3001/api/sentry-test/test-error

# Test message capture
curl http://localhost:3001/api/sentry-test/test-message

# Test async error
curl http://localhost:3001/api/sentry-test/test-async-error

# Test performance monitoring
curl http://localhost:3001/api/sentry-test/test-performance

# Test with breadcrumbs
curl http://localhost:3001/api/sentry-test/test-breadcrumbs
```

### Frontend Testing

In the browser console:

```javascript
// Test error capture
throw new Error('Test error from frontend');

// Test message capture
import { captureMessage } from './utils/sentry';
captureMessage('Test message from frontend');
```

## 🎯 What's Being Tracked

### Backend
- ✅ All unhandled errors (500+ status codes)
- ✅ Critical business logic errors
- ✅ Performance monitoring for API endpoints
- ✅ Database query failures
- ✅ Stripe webhook errors
- ✅ Agora.io integration issues

### Frontend
- ✅ JavaScript runtime errors
- ✅ React component errors (via Error Boundaries)
- ✅ Network request failures (filtered for relevance)
- ✅ Performance metrics
- ✅ Session replays on errors (masked for privacy)

## 🔒 Privacy & Security

### Data Filtering
- ❌ Passwords are never sent
- ❌ Tokens and API keys are redacted
- ❌ Credit card info is filtered
- ❌ Personal identifiable information (PII) is masked
- ✅ User IDs are tracked (not emails by default)

### What's NOT Sent to Sentry
- 404 errors (normal user navigation)
- Validation errors (expected user input issues)
- Network errors when offline
- Browser extension errors
- ResizeObserver warnings

## 📊 Monitoring in Production

### Key Metrics to Watch

1. **Error Rate** - Should stay below 1%
2. **Performance (P95)** - API responses < 1 second
3. **Crash Free Sessions** - Target > 99.5%
4. **Transaction Volume** - Monitor for anomalies

### Alerts to Configure

In Sentry, set up alerts for:
- Error rate spike (> 5% in 5 minutes)
- New error types
- Performance degradation
- Payment processing errors
- Video call failures

## 🔧 Advanced Features

### User Context

The integration automatically tracks:
- User ID
- Username
- Account type (creator/fan)
- Session information

### Performance Monitoring

Tracks:
- API endpoint response times
- Database query performance
- Frontend rendering performance
- Route navigation timing

### Session Replay

On errors, Sentry captures:
- User actions leading to error
- Console logs
- Network requests
- DOM mutations (with privacy masking)

## 📝 Best Practices

1. **Don't Log Sensitive Data**
   - Never log passwords, tokens, or payment info
   - Use context instead of embedding in error messages

2. **Use Breadcrumbs**
   ```javascript
   addBreadcrumb('User clicked purchase', 'ui.click', 'info', {
     item: 'token-package-100'
   });
   ```

3. **Mark Critical Errors**
   ```javascript
   error.critical = true; // Ensures capture even with sampling
   ```

4. **Add Context to Errors**
   ```javascript
   captureException(error, {
     user: { id: userId },
     transaction: { amount, status }
   });
   ```

## 🚨 Troubleshooting

### Sentry Not Receiving Events?

1. Check environment variables are set
2. Verify DSN is correct
3. Check browser console for Sentry initialization
4. Ensure `NODE_ENV` is not 'test'
5. Check network tab for Sentry requests

### Too Many Events?

Adjust sampling rates in configuration:
```javascript
// Backend
tracesSampleRate: 0.1  // Only 10% of transactions

// Frontend
sessionSampleRate: 0.1  // Only 10% of sessions
```

## 🎁 Free Tier Limits

Sentry's free tier includes:
- 5,000 errors/month
- 10,000 performance events/month
- 50 replays/month
- 1GB attachments
- 30-day retention

## 📚 Resources

- [Sentry Docs](https://docs.sentry.io/)
- [React Integration Guide](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Node.js Integration Guide](https://docs.sentry.io/platforms/node/)
- [Best Practices](https://docs.sentry.io/product/best-practices/)

## ⚠️ Production Checklist

Before going to production:

- [ ] Remove test endpoints (`/api/sentry-test/*`)
- [ ] Set production DSN keys
- [ ] Configure alert rules
- [ ] Set appropriate sampling rates
- [ ] Test error capture in staging
- [ ] Configure release tracking
- [ ] Set up Slack/email notifications