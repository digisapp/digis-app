# Digis Platform Deployment Guide

## Quick Start Checklist

### 1. ✅ Environment Setup
- [ ] Copy `.env.example` to `.env` in both backend and frontend
- [ ] Fill in all required environment variables
- [ ] Verify database connection
- [ ] Test Firebase authentication
- [ ] Confirm Stripe keys are working

### 2. ✅ Database Setup
```bash
cd backend
npm run migrate
```

### 3. ✅ Firebase Configuration
- [ ] Create Firebase project
- [ ] Enable Authentication (Email/Password, Google)
- [ ] Set up Firestore with security rules
- [ ] Generate service account key
- [ ] Configure frontend Firebase config

### 4. ✅ Stripe Configuration
- [ ] Create Stripe account
- [ ] Get API keys (test/live)
- [ ] Set up webhook endpoint
- [ ] Configure webhook events
- [ ] Test payment flow

## Development Setup

### Prerequisites:
- Node.js 16+ and npm 8+
- PostgreSQL database (Supabase recommended)
- Firebase project
- Stripe account

### Installation:
```bash
# Clone repository
git clone <your-repo-url>
cd digis-app

# Backend setup
cd backend
npm install
cp .env.example .env
# Fill in your environment variables
npm run migrate
npm run dev

# Frontend setup (new terminal)
cd ../frontend
npm install
cp .env.example .env
# Fill in your environment variables
npm start
```

### Running the Application:
```bash
# Backend (http://localhost:3001)
cd backend && npm run dev

# Frontend (http://localhost:3000)
cd frontend && npm start

# Test endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api/auth/test
```

## Production Deployment

### Backend Deployment (Vercel)

1. **Prepare for deployment:**
```bash
cd backend
npm run build  # Verify no build errors
npm test       # Run tests
```

2. **Deploy to Vercel:**
```bash
npm install -g vercel
vercel login
vercel --prod
```

3. **Configure environment variables in Vercel dashboard:**
- Add all variables from `.env`
- Ensure database URLs point to production
- Update FRONTEND_URL to production domain

### Frontend Deployment (Vercel)

1. **Build and test:**
```bash
cd frontend
npm run build
npm run build:css
```

2. **Deploy:**
```bash
vercel --prod
```

3. **Update environment variables:**
- Set REACT_APP_BACKEND_URL to backend production URL
- Verify all Firebase config variables

### Alternative Deployment Options

#### Docker Deployment:
```dockerfile
# Backend Dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

#### Heroku Deployment:
```bash
# Install Heroku CLI
heroku login
heroku create digis-backend
heroku config:set NODE_ENV=production
heroku config:set DATABASE_URL=your_db_url
# ... add all other environment variables
git push heroku main
```

## Database Management

### Production Database Setup:
1. **Create Supabase project**
2. **Get connection string**
3. **Run migrations:**
```bash
DATABASE_URL=your_production_url npm run migrate
```

### Backup Strategy:
```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore backup
psql $DATABASE_URL < backup_20240120.sql
```

## Monitoring and Logging

### Application Monitoring:
```javascript
// Add to backend for APM
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Health Checks:
```bash
# Backend health
curl https://your-backend.vercel.app/health

# Database health  
curl https://your-backend.vercel.app/api/auth/test

# Stripe connectivity
curl https://your-backend.vercel.app/api/payments/test
```

## Security Configuration

### Production Security Checklist:
- [ ] **Environment Variables**: All secrets in environment, not code
- [ ] **HTTPS**: Enforce HTTPS in production
- [ ] **CORS**: Restrict origins to your domains
- [ ] **Rate Limiting**: Enable for all public endpoints
- [ ] **Helmet**: Security headers configured
- [ ] **Firebase Rules**: Firestore rules are restrictive
- [ ] **Webhook Signatures**: Stripe webhook verification enabled
- [ ] **Database**: SSL connections enforced

### Firebase Production Rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Production rules - restrict access
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Add other restrictive rules...
  }
}
```

## Performance Optimization

### Backend Optimizations:
```bash
# Enable compression
npm install compression
```

```javascript
const compression = require('compression');
app.use(compression());

// Database connection pooling (already implemented)
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
```

### Frontend Optimizations:
```bash
# Build with optimizations
npm run build

# Analyze bundle size
npm install -g webpack-bundle-analyzer
npx webpack-bundle-analyzer build/static/js/*.js
```

### CDN Setup (Optional):
```javascript
// Configure CDN for static assets
const CDN_URL = process.env.REACT_APP_CDN_URL;
```

## Testing

### Backend Testing:
```bash
cd backend
npm test                    # Run all tests
npm run test:coverage      # Coverage report
npm run test:integration   # Integration tests
```

### Frontend Testing:
```bash
cd frontend
npm test                   # Run React tests
npm run test:coverage     # Coverage report
```

### End-to-End Testing:
```bash
# Install Cypress
npm install -g cypress
cypress open
```

## Troubleshooting

### Common Issues:

1. **Database Connection Fails:**
```bash
# Test connection
npm run db:test

# Check connection string format
echo $DATABASE_URL
```

2. **Firebase Authentication Errors:**
```bash
# Verify service account key format
node -e "console.log(JSON.parse(process.env.FIREBASE_PRIVATE_KEY))"
```

3. **Stripe Webhook Issues:**
```bash
# Test webhook endpoint
stripe listen --forward-to localhost:3001/webhooks/stripe
```

4. **CORS Errors:**
```javascript
// Check CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://your-frontend-domain.vercel.app'
  ]
};
```

### Debug Commands:
```bash
# Check environment variables
env | grep -E "(DATABASE|FIREBASE|STRIPE)"

# Test API endpoints
curl -X GET https://your-api.com/health
curl -X GET https://your-api.com/api/auth/test

# Check logs
tail -f logs/app.log
tail -f logs/error.log
```

## Maintenance

### Regular Tasks:
1. **Database backups** (daily)
2. **Security updates** (weekly)
3. **Performance monitoring** (continuous)
4. **Dependency updates** (monthly)

### Update Dependencies:
```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Security audit
npm audit
npm audit fix
```

### Scaling Considerations:
- **Database**: Consider read replicas for high traffic
- **Backend**: Horizontal scaling with load balancer
- **Frontend**: CDN for global distribution
- **Cache**: Redis for session and API caching

## Support and Resources

### Documentation:
- [Firebase Console](https://console.firebase.google.com/)
- [Stripe Dashboard](https://dashboard.stripe.com/)
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Vercel Dashboard](https://vercel.com/dashboard)

### Monitoring Dashboards:
- Application logs in Vercel/Heroku
- Database monitoring in Supabase
- Payment monitoring in Stripe
- Error tracking with Sentry (optional)

### Emergency Contacts:
- **Database**: Supabase support
- **Payments**: Stripe support  
- **Hosting**: Vercel support
- **Authentication**: Firebase support