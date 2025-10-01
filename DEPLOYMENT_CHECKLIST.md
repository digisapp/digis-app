# Digis Platform Deployment Checklist

## 🔴 Critical Issues (Must Fix Before Deploy)

### 1. Environment Variables
- [ ] Create `.env.example` with dummy values
- [ ] Add `.env` to `.gitignore`
- [ ] Set up environment variables in hosting platform (Vercel/Railway/etc)
- [ ] Remove all sensitive data from code

### 2. API Endpoints
- [ ] Replace all `localhost:3001` with `process.env.VITE_BACKEND_URL`
- [ ] Update WebSocket URLs to use `wss://` in production
- [ ] Ensure all API calls use HTTPS in production

### 3. Database
- [ ] Run all migrations on production database
- [ ] Test database connection with SSL
- [ ] Set up database backups
- [ ] Review indexes for performance

### 4. Security
- [ ] Remove all console.log statements (468 found)
- [ ] Enable HTTPS everywhere
- [ ] Update CORS for production domain only
- [ ] Review rate limiting settings
- [ ] Check authentication token expiry

### 5. Third-Party Services
- [ ] Stripe: Switch to production keys
- [ ] Agora.io: Verify production credentials
- [ ] Supabase: Check row-level security policies
- [ ] Set up error tracking (Sentry/LogRocket)

## 🟡 Important Checks

### 6. Frontend Build
```bash
cd frontend
npm run build
# Check for any build errors
# Test the production build locally
```

### 7. Backend Health
- [ ] Test all API endpoints
- [ ] Check error handling
- [ ] Verify file upload limits
- [ ] Test WebSocket connections

### 8. Performance
- [ ] Enable gzip compression
- [ ] Set up CDN for static assets
- [ ] Optimize images
- [ ] Enable caching headers

### 9. Testing Critical Flows
- [ ] User registration/login
- [ ] Token purchase via Stripe
- [ ] Video/Voice calls via Agora
- [ ] Live streaming
- [ ] Creator dashboard
- [ ] Messaging system
- [ ] Payment processing

## 🟢 Nice to Have

### 10. Monitoring
- [ ] Set up uptime monitoring
- [ ] Configure error alerts
- [ ] Set up performance monitoring
- [ ] Create admin dashboard for metrics

### 11. Documentation
- [ ] Update README with deployment steps
- [ ] Document environment variables
- [ ] Create API documentation
- [ ] Write deployment runbook

## Deployment Commands

### Frontend (Vercel)
```bash
vercel --prod
```

### Backend (Railway/Render)
```bash
# Ensure package.json has start script
npm start
```

### Database Migrations
```bash
cd backend
npm run migrate
```

## Post-Deployment

1. Test all critical user flows
2. Monitor error logs for first 24 hours
3. Check performance metrics
4. Verify payment processing
5. Test on multiple devices/browsers

## Emergency Rollback Plan

1. Keep previous deployment version tagged
2. Have database backup ready
3. Document rollback steps
4. Test rollback procedure

---
**Remember: Never deploy on Friday! 🚫**