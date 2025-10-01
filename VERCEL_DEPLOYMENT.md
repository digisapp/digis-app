# Vercel Deployment Guide for Digis Platform

## Overview
This guide covers deploying the Digis platform (both frontend and backend) to Vercel.

## Prerequisites
- Vercel account (https://vercel.com)
- Supabase project configured
- Stripe account for payments
- Agora.io account for video/voice features

## Deployment Structure

### Option 1: Monorepo Deployment (Recommended)
Deploy both frontend and backend from a single repository.

### Option 2: Separate Deployments
Deploy frontend and backend as separate Vercel projects.

## Step-by-Step Deployment

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy Backend

#### Navigate to backend directory:
```bash
cd backend
vercel
```

#### Follow prompts:
- Set up and deploy: Y
- Which scope: Select your team/personal account
- Link to existing project?: N (first time) / Y (updates)
- Project name: digis-backend
- Directory: ./
- Override settings?: N

### 4. Deploy Frontend

#### Navigate to frontend directory:
```bash
cd frontend
vercel
```

#### Follow prompts:
- Set up and deploy: Y
- Which scope: Select your team/personal account  
- Link to existing project?: N (first time) / Y (updates)
- Project name: digis-frontend
- Directory: ./
- Override settings?: N

### 5. Configure Environment Variables

#### Backend Environment Variables (Set in Vercel Dashboard):
```
DATABASE_URL=your_supabase_connection_string
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_certificate
FRONTEND_URL=https://your-frontend.vercel.app
NODE_ENV=production
```

#### Frontend Environment Variables (Set in Vercel Dashboard):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_BACKEND_URL=https://your-backend.vercel.app
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_key
VITE_AGORA_APP_ID=your_agora_app_id
VITE_APP_NAME=Digis
VITE_APP_VERSION=2.0.0
```

### 6. Database Setup

#### Run migrations before first deployment:
```bash
cd backend
npm run migrate
```

#### Verify database connection:
```bash
npm run db:test
```

### 7. Configure Custom Domains (Optional)

#### In Vercel Dashboard:
1. Go to Project Settings > Domains
2. Add your custom domain
3. Follow DNS configuration instructions

#### Recommended setup:
- Frontend: `app.yourdomain.com` or `www.yourdomain.com`
- Backend: `api.yourdomain.com`

### 8. Post-Deployment Checklist

- [ ] Test authentication flow
- [ ] Verify Stripe payment processing
- [ ] Test video/voice calls with Agora
- [ ] Check WebSocket connections
- [ ] Verify file uploads
- [ ] Test push notifications
- [ ] Check analytics tracking
- [ ] Verify SSL certificates
- [ ] Test CORS configuration
- [ ] Monitor error logs

## Deployment Commands

### Quick Deploy (After Initial Setup)
```bash
# Deploy both
npm run deploy

# Deploy backend only
cd backend && vercel --prod

# Deploy frontend only  
cd frontend && vercel --prod
```

### Rollback
```bash
# List deployments
vercel ls

# Rollback to previous
vercel rollback
```

## Production Optimizations

### Frontend
- Build optimization is configured in `vite.config.js`
- PWA is enabled for offline support
- Code splitting for better performance
- Assets are compressed with gzip

### Backend
- Rate limiting configured
- Security headers with Helmet.js
- Database connection pooling
- Redis caching (if configured)

## Monitoring

### Vercel Dashboard
- Monitor build logs
- Check function execution
- Review analytics
- Set up alerts

### External Monitoring
- Configure Sentry for error tracking
- Set up uptime monitoring
- Configure performance monitoring

## Troubleshooting

### Common Issues

#### Build Failures
- Check Node.js version compatibility
- Verify all dependencies are listed in package.json
- Check environment variables

#### Function Timeouts
- Default timeout is 10 seconds
- Can be increased to 60 seconds (Pro) or 900 seconds (Enterprise)
- Configure in vercel.json

#### CORS Issues
- Verify FRONTEND_URL environment variable
- Check CORS configuration in backend

#### Database Connection
- Verify DATABASE_URL is correct
- Check SSL settings for production
- Ensure IP whitelisting if required

## CI/CD Integration

### GitHub Integration
1. Connect GitHub repository in Vercel Dashboard
2. Enable automatic deployments
3. Configure preview deployments for PRs

### Environment-based Deployments
- Production: main/master branch
- Staging: staging branch
- Development: dev branch

## Support

For deployment issues:
- Vercel Documentation: https://vercel.com/docs
- Vercel Support: https://vercel.com/support
- Project Issues: https://github.com/your-org/digis-app/issues

## Version History
- v2.0.0 - Current version with Supabase integration
- v1.0.0 - Initial release