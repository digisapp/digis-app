# 🚀 Deployment Checklist - Digis Platform

## Pre-Deployment Security Audit

### 1. **Dependencies Update** ⚠️ CRITICAL
```bash
# Backend
cd backend
npm update stripe@latest firebase-admin@latest helmet@latest express-rate-limit@latest
npm uninstall bcryptjs
npm install argon2

# Frontend
cd ../frontend
npm update @stripe/stripe-js@latest firebase@latest react-router-dom@latest
```

### 2. **Environment Variables**
- [ ] All secrets in environment variables (not in code)
- [ ] Different keys for development/staging/production
- [ ] Stripe webhook secrets configured
- [ ] Firebase service account keys secured
- [ ] Database connection strings use SSL

### 3. **Security Headers**
- [ ] Helmet.js properly configured
- [ ] CORS whitelist updated for production domains
- [ ] CSP headers restrict external resources
- [ ] HSTS enabled for HTTPS enforcement

### 4. **Database Security**
- [ ] Connection pooling configured
- [ ] SSL/TLS enforced for connections
- [ ] Query timeouts set
- [ ] Prepared statements used everywhere
- [ ] Regular backups configured

### 5. **API Security**
- [ ] Rate limiting on all endpoints
- [ ] Input validation on all routes
- [ ] Authentication required on sensitive endpoints
- [ ] API versioning implemented
- [ ] Request size limits configured

## Performance Optimization

### 1. **Backend Optimization**
```javascript
// Add to backend/api/index.js
const compression = require('compression');
app.use(compression());

// Enable clustering for multi-core
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster && process.env.NODE_ENV === 'production') {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Start server
}
```

### 2. **Frontend Optimization**
```javascript
// vite.config.js updates
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/auth'],
          'agora-vendor': ['agora-rtc-sdk-ng'],
          'ui-vendor': ['framer-motion', '@headlessui/react'],
        }
      }
    },
    // Enable gzip compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
}
```

## Monitoring & Logging

### 1. **Application Monitoring**
```javascript
// Add APM (Application Performance Monitoring)
npm install @sentry/node @sentry/react

// Backend
const Sentry = require("@sentry/node");
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

// Frontend
import * as Sentry from "@sentry/react";
Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
  tracesSampleRate: 1.0,
});
```

### 2. **Health Checks**
```javascript
// Add to backend
app.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    status: 'OK',
    timestamp: Date.now(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      firebase: await checkFirebase(),
    }
  };
  
  const allHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
  res.status(allHealthy ? 200 : 503).json(health);
});
```

## Deployment Steps

### 1. **Backend Deployment (Vercel)**
```json
// vercel.json updates
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "regions": ["iad1"], // US East for low latency
  "functions": {
    "api/index.js": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

### 2. **Frontend Deployment**
```bash
# Build optimized production bundle
cd frontend
npm run build

# Deploy to Vercel
vercel --prod
```

### 3. **Database Migrations**
```bash
# Run migrations before deploying new code
cd backend
npm run migrate:status
npm run migrate
```

## Post-Deployment Verification

### 1. **Security Scan**
```bash
# Run security audit
npm audit --production
npm run security:scan

# Check for exposed secrets
git secrets --scan
```

### 2. **Performance Testing**
```bash
# Load testing with k6
k6 run load-test.js

# Lighthouse audit
lighthouse https://digis.app --view
```

### 3. **Monitoring Setup**
- [ ] Error tracking configured (Sentry)
- [ ] Uptime monitoring active
- [ ] Database query monitoring
- [ ] API response time alerts
- [ ] Token balance alerts

## Rollback Plan

### 1. **Quick Rollback**
```bash
# Vercel rollback
vercel rollback

# Database rollback
npm run migrate:down
```

### 2. **Feature Flags**
```javascript
// Implement feature flags for safe rollout
const features = {
  newPaymentFlow: process.env.FEATURE_NEW_PAYMENT === 'true',
  enhancedSecurity: process.env.FEATURE_ENHANCED_SECURITY === 'true',
};
```

## Critical Metrics to Monitor

1. **Business Metrics**
   - Token purchase conversion rate
   - Session completion rate
   - Creator earnings accuracy
   - Payment success rate

2. **Technical Metrics**
   - API response time (p50, p95, p99)
   - Database query performance
   - WebSocket connection stability
   - Error rate by endpoint

3. **Security Metrics**
   - Failed authentication attempts
   - Rate limit violations
   - Suspicious transaction patterns
   - API abuse detection

## Emergency Contacts

- **On-Call Engineer**: [Phone/Slack]
- **Database Admin**: [Contact]
- **Security Team**: [Contact]
- **Payment Provider**: Stripe Support

## Final Checklist

- [ ] All tests passing
- [ ] Security audit complete
- [ ] Performance benchmarks met
- [ ] Monitoring configured
- [ ] Rollback plan tested
- [ ] Documentation updated
- [ ] Team notified
- [ ] Customer support briefed

Remember: Deploy during low-traffic hours and monitor closely for the first 24 hours!