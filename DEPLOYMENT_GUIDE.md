# Deployment Guide

## 🚀 Staging Deployment

### Prerequisites
- Vercel account with project configured
- Supabase project set up
- Stripe test account configured
- Agora.io app credentials
- Sentry project for error tracking

### Environment Variables

#### Frontend (.env.staging)
```env
VITE_BACKEND_URL=https://digis-backend-staging.vercel.app
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_AGORA_APP_ID=your-agora-app-id
VITE_STRIPE_PUBLIC_KEY=pk_test_xxx
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

#### Backend (.env.staging)
```env
NODE_ENV=staging
DATABASE_URL=postgresql://user:pass@host:5432/db
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-certificate
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
FRONTEND_URL=https://digis-staging.vercel.app
```

### Deployment Steps

#### 1. Manual Deployment

**Frontend:**
```bash
cd frontend
npm run build
vercel --prod --env-file=.env.staging
```

**Backend:**
```bash
cd backend
vercel --prod --env-file=.env.staging
```

#### 2. Automated Deployment (GitHub Actions)

Push to `staging` branch:
```bash
git checkout staging
git merge develop
git push origin staging
```

This triggers:
- ✅ Code quality checks (ESLint, TypeScript)
- ✅ Unit tests with coverage
- ✅ E2E tests with Playwright
- ✅ Bundle size analysis
- ✅ Lighthouse performance audit
- ✅ Automated deployment to Vercel
- ✅ Health checks
- ✅ Slack notifications

### Post-Deployment Checklist

#### 🔍 Verification Steps

- [ ] **Frontend Health Check**
  ```bash
  curl https://digis-staging.vercel.app/api/health
  ```

- [ ] **Backend Health Check**
  ```bash
  curl https://digis-backend-staging.vercel.app/health
  ```

- [ ] **Database Connection**
  - Check Supabase dashboard for active connections
  - Verify migrations are applied

- [ ] **Authentication Flow**
  - Test sign up with email
  - Test sign in
  - Test password reset
  - Verify email notifications

- [ ] **Payment Integration**
  - Test token purchase with Stripe test cards
  - Verify webhook events in Stripe dashboard

- [ ] **Video Calls**
  - Test Agora token generation
  - Verify WebRTC connections
  - Check call quality settings

- [ ] **Real-time Features**
  - Test WebSocket connections
  - Verify chat messages
  - Check presence updates

- [ ] **Error Tracking**
  - Verify Sentry is receiving events
  - Test error boundaries
  - Check source maps are uploaded

- [ ] **Performance Metrics**
  - Review Web Vitals in Sentry
  - Check bundle size reports
  - Verify lazy loading works

### Monitoring

#### Key Metrics to Watch

1. **Performance**
   - Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1)
   - API response times < 200ms
   - WebSocket latency < 50ms

2. **Errors**
   - JavaScript error rate < 1%
   - API error rate < 0.5%
   - Failed video calls < 2%

3. **Business Metrics**
   - User sign-up conversion
   - Token purchase success rate
   - Average session duration

#### Monitoring Tools

- **Sentry**: Error tracking and performance monitoring
- **Vercel Analytics**: Traffic and Web Vitals
- **Supabase Dashboard**: Database metrics
- **Stripe Dashboard**: Payment metrics
- **Agora Console**: Call quality metrics

### Rollback Procedure

If issues are detected:

1. **Immediate Rollback**
   ```bash
   vercel rollback [deployment-id]
   ```

2. **Database Rollback** (if needed)
   ```bash
   cd backend
   npm run migrate:down
   ```

3. **Clear CDN Cache**
   ```bash
   vercel purge
   ```

4. **Notify Team**
   - Post in #deployments Slack channel
   - Create incident ticket

### Security Checklist

- [ ] HTTPS enforced on all endpoints
- [ ] Environment variables properly secured
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Input validation active
- [ ] SQL injection protection verified
- [ ] XSS protection headers set
- [ ] CSP headers configured
- [ ] Secrets rotated regularly

### Performance Optimization

Before deploying to production:

1. **Bundle Optimization**
   ```bash
   npm run build:analyze
   ```
   - Ensure no bundle > 200KB
   - Verify tree shaking works
   - Check for duplicate dependencies

2. **Image Optimization**
   - Convert to WebP format
   - Implement responsive images
   - Use lazy loading

3. **Caching Strategy**
   - Static assets: 1 year
   - API responses: Varies by endpoint
   - HTML: No cache

4. **Database Optimization**
   - Indexes on frequently queried columns
   - Connection pooling configured
   - Query performance analyzed

## 🎯 Production Deployment

### Additional Requirements

- [ ] Load testing completed (>1000 concurrent users)
- [ ] Security audit passed
- [ ] GDPR compliance verified
- [ ] Backup strategy tested
- [ ] Disaster recovery plan documented
- [ ] SLA agreements in place

### Production Environment Variables

Use production keys and URLs:
- Production database
- Live Stripe keys
- Production CDN
- Enhanced monitoring

### Go-Live Checklist

1. **Pre-deployment** (T-24 hours)
   - [ ] Freeze feature development
   - [ ] Run full test suite
   - [ ] Backup production database
   - [ ] Notify users of maintenance window

2. **Deployment** (T-0)
   - [ ] Enable maintenance mode
   - [ ] Deploy backend
   - [ ] Run migrations
   - [ ] Deploy frontend
   - [ ] Verify health checks
   - [ ] Disable maintenance mode

3. **Post-deployment** (T+1 hour)
   - [ ] Monitor error rates
   - [ ] Check performance metrics
   - [ ] Verify critical user flows
   - [ ] Announce successful deployment

### Support Escalation

**Level 1**: On-call engineer
- Monitor alerts
- Initial triage
- Basic rollback if needed

**Level 2**: Backend team lead
- Database issues
- Complex debugging
- Performance problems

**Level 3**: CTO/Infrastructure team
- Critical outages
- Security incidents
- Major rollbacks

## 📞 Emergency Contacts

- **On-Call Engineer**: Via PagerDuty
- **Backend Lead**: [email/phone]
- **Frontend Lead**: [email/phone]
- **DevOps**: [email/phone]
- **CTO**: [email/phone]

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Guides](https://supabase.com/docs)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Agora.io Best Practices](https://docs.agora.io/en)
- [Sentry Performance](https://docs.sentry.io/product/performance/)