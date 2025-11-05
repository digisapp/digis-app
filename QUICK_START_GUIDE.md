# Digis Platform - Quick Start Guide
## Get Up and Running in 30 Minutes

---

## What is Digis?

Digis is a **creator economy platform** where fans can interact with creators through:
- 📹 **Live video streaming** (like Twitch)
- 📞 **1-on-1 video/voice calls** (like Cameo)
- 💬 **Direct messaging** (like OnlyFans)
- 🪙 **Token-based economy** (fans buy tokens, creators earn them)

Think: **Twitch + Cameo + OnlyFans** combined into one platform.

---

## Tech Stack (TL;DR)

### Frontend
- **React** 18 + **TypeScript** + **Vite**
- **TailwindCSS** for styling
- **React Query** for data fetching
- **Agora.io** for video/audio
- **Stripe** for payments

### Backend
- **Node.js** 20 + **Express.js**
- **PostgreSQL** (via Supabase)
- **Serverless** (deployed on Vercel)
- **Ably** for WebSockets (real-time)

### Key Services
- **Supabase**: Auth + Database
- **Agora.io**: Video/audio streaming
- **Stripe**: Payment processing
- **Vercel**: Hosting (serverless)
- **Upstash Redis**: Caching

---

## 5-Minute Setup

### Prerequisites
```bash
node --version  # Should be 20.x or higher
pnpm --version  # Should be 9.x or higher
```

Don't have pnpm? Install it:
```bash
npm install -g pnpm
```

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd digis-app
```

### 2. Install Dependencies
```bash
# Backend
cd backend
pnpm install

# Frontend
cd ../frontend
pnpm install
```

### 3. Environment Variables

**Backend** (`backend/.env`):
```bash
# Database (get from Supabase dashboard)
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres?sslmode=require

# Supabase (get from Supabase dashboard → Settings → API)
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
SUPABASE_ANON_KEY=[your-anon-key]

# Agora (get from Agora.io dashboard)
AGORA_APP_ID=[your-app-id]
AGORA_APP_CERTIFICATE=[your-app-certificate]

# Stripe (get from Stripe dashboard)
STRIPE_SECRET_KEY=sk_test_[your-key]
STRIPE_WEBHOOK_SECRET=whsec_[your-secret]

# Redis (get from Upstash)
UPSTASH_REDIS_REST_URL=https://[your-redis].upstash.io
UPSTASH_REDIS_REST_TOKEN=[your-token]

# Ably (get from Ably dashboard)
ABLY_API_KEY=[your-ably-key]

# Local development
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
PORT=3005
```

**Frontend** (`frontend/.env`):
```bash
# Backend API
VITE_BACKEND_URL=http://localhost:3005/api/v1

# Supabase (same as backend)
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]

# Agora (same as backend)
VITE_AGORA_APP_ID=[your-app-id]

# Stripe (get PUBLIC key from Stripe)
VITE_STRIPE_PUBLIC_KEY=pk_test_[your-key]

# Environment
VITE_ENV=development
```

### 4. Run Database Migrations
```bash
cd backend
pnpm run migrate
```

### 5. Start Development Servers

**Terminal 1** - Backend:
```bash
cd backend
pnpm run dev
```
Backend runs on: http://localhost:3005

**Terminal 2** - Frontend:
```bash
cd frontend
pnpm run dev
```
Frontend runs on: http://localhost:5173

### 6. Open Browser
Visit: **http://localhost:5173**

---

## First Test: Create Accounts

### Create a Fan Account
1. Click "Sign Up"
2. Enter email: `fan@test.com`
3. Enter password: `password123`
4. Verify email (check console logs for magic link)
5. Complete profile

### Create a Creator Account
1. Sign out
2. Click "Sign Up"
3. Enter email: `creator@test.com`
4. Enter password: `password123`
5. Verify email
6. Go to Settings → "Become a Creator"
7. Fill out creator application
8. Approve yourself in admin panel (or use database)

---

## How Features Work

### 1. Token Economy
```
User buys tokens → Stripe processes payment → Backend adds tokens to balance
Creator earns tokens → Backend tracks earnings → Creator requests payout → Stripe payout
```

**Test it**:
1. Sign in as fan
2. Go to "Wallet" or "Buy Tokens"
3. Enter test credit card: `4242 4242 4242 4242` (Stripe test mode)
4. Buy tokens
5. Check balance updates

### 2. Live Streaming
```
Creator clicks "Go Live" → Backend generates Agora token → Creator publishes video
Fans join stream → Backend generates viewer tokens → Fans see live video
```

**Test it**:
1. Sign in as creator
2. Click "Go Live"
3. Allow camera/microphone
4. Enter stream title
5. Click "Start Streaming"
6. Open incognito window, sign in as fan
7. Join the live stream

### 3. Video Calls
```
Fan requests call → Creator accepts → Backend creates session → Agora connects peers
Call starts → Per-minute billing → Call ends → Tokens deducted from fan
```

**Test it**:
1. Sign in as fan
2. Find creator profile
3. Click "Request Call"
4. Sign in as creator (different browser)
5. Accept call invitation
6. Allow camera/microphone
7. Call connects

### 4. Messaging
```
Fan sends message → Backend saves to database → Real-time via Ably → Creator receives
Creator replies → Same flow in reverse
```

**Test it**:
1. Sign in as fan
2. Go to Messages
3. Start conversation with creator
4. Send a message
5. Sign in as creator (different browser)
6. See message appear in real-time

---

## Key Files to Know

### Frontend
```
src/
├── components/
│   ├── VideoCall.js          # Video call UI
│   ├── HybridStreamingLayout.jsx  # Streaming UI
│   ├── pages/
│   │   ├── TVPage.js         # Main streaming feed
│   │   ├── GoLivePage.js     # Creator go-live flow
│   │   └── StreamPage.js     # Individual stream view
├── lib/
│   ├── api.ts                # API client functions
│   └── agoraClient.ts        # Agora singleton (video/audio)
├── contexts/
│   ├── AuthContext.tsx       # User authentication state
└── App.tsx                   # Root component
```

### Backend
```
api/
├── index.js                  # Main Express app (routing, middleware)
routes/
├── auth.js                   # Login, signup, JWT verification
├── streaming.js              # Go live, end stream, viewer join
├── agora.js                  # Generate Agora tokens
├── messages.js               # Conversations, send/receive messages
├── tokens.js                 # Buy tokens, balance, transactions
└── payments.js               # Stripe payment processing
middleware/
├── auth.js                   # JWT verification middleware
└── rate-limiters.js          # Rate limiting per endpoint
utils/
├── db.js                     # PostgreSQL client
├── supabase-admin-v2.js      # Supabase admin client
└── secureLogger.js           # Winston logger
```

---

## Common Issues & Fixes

### Port Already in Use
```bash
# Kill process on port 3005 (backend)
lsof -ti:3005 | xargs kill -9

# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9
```

### Database Connection Error
- Check `DATABASE_URL` is correct
- Use **connection pooler URL** (ends with `:5432/postgres`)
- Include `?sslmode=require` at the end

### Video Not Working
- Check camera/microphone permissions in browser
- Verify `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` are correct
- Look for `UID_CONFLICT` errors in console (restart browser)

### CORS Error
- Check `FRONTEND_URL` in backend `.env` matches frontend URL
- Default should be `http://localhost:5173`

### Tokens Not Updating After Purchase
- Check Stripe webhook is configured
- For local dev: Use `stripe listen --forward-to localhost:3005/webhooks/stripe`

---

## API Testing with cURL

### Get Current User
```bash
# First, sign in to get JWT token
curl -X POST http://localhost:3005/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"fan@test.com","password":"password123"}'

# Copy the access_token from response, then:
curl http://localhost:3005/api/v1/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Active Streams
```bash
curl http://localhost:3005/api/v1/streaming/active
```

### Get Token Balance
```bash
curl http://localhost:3005/api/v1/tokens/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Development Commands

### Backend
```bash
pnpm run dev              # Start dev server (with hot reload)
pnpm run dev:debug        # Start with debugger
pnpm test                 # Run tests
pnpm run lint             # Check code style
pnpm run migrate          # Run database migrations
pnpm run migrate:down     # Rollback last migration
pnpm run db:test          # Test database connection
```

### Frontend
```bash
pnpm run dev              # Start dev server (with hot reload)
pnpm run build            # Production build
pnpm run preview          # Preview production build
pnpm test                 # Run unit tests
pnpm run test:e2e         # Run E2E tests
pnpm run lint             # Check code style
pnpm run type-check       # TypeScript type checking
```

---

## Git Workflow

### Create a Feature
```bash
# Create branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# Make changes, commit
git add .
git commit -m "feat: add your feature"

# Push to remote
git push origin feature/your-feature-name
```

### Create Pull Request
1. Go to GitHub repository
2. Click "New Pull Request"
3. Select your feature branch → develop
4. Add description of changes
5. Request code review
6. Address feedback
7. Merge when approved

---

## Debugging Tips

### Frontend Debugging
```javascript
// Check user auth state
console.log('User:', user);
console.log('Session:', session);

// Check API calls
// Open DevTools → Network tab → Filter by "Fetch/XHR"

// React Query DevTools (shows all queries)
// Already installed - look for floating icon in bottom-left
```

### Backend Debugging
```javascript
// Add console logs
console.log('📥 Request:', req.body);
console.log('✅ Response:', response);

// Check logs
tail -f backend/logs/app.log

// Database queries
console.log('🔍 Query:', query);
console.log('📊 Result:', result.rows);
```

### Video/Audio Debugging
```javascript
// Check Agora client state
console.log('Agora client:', client);
console.log('Connection state:', client.connectionState);
console.log('Local tracks:', client.localTracks);

// Check for errors
window.addEventListener('error', (e) => {
  console.error('Global error:', e);
});
```

---

## What to Work On First

### Easy Tasks (Good for Day 1)
- [ ] Fix a UI bug (typo, alignment, color)
- [ ] Add a console.log to understand data flow
- [ ] Update an API endpoint response format
- [ ] Write a test for an existing function
- [ ] Add JSDoc comments to a function

### Medium Tasks (Good for Week 1)
- [ ] Add a new field to user profile
- [ ] Create a new UI component
- [ ] Add validation to a form
- [ ] Fix a database query performance issue
- [ ] Add a new API endpoint

### Complex Tasks (Good for Week 2+)
- [ ] Implement a new feature (e.g., polls during streams)
- [ ] Refactor a large component
- [ ] Add real-time notifications
- [ ] Optimize video streaming performance
- [ ] Add comprehensive test coverage

---

## Getting Help

### Documentation
- **API Docs**: http://localhost:3005/api-docs (when backend is running)
- **PLATFORM_OVERVIEW.md**: Full technical documentation
- **CLAUDE.md**: AI assistant context (useful for understanding architecture)

### External Docs
- [Supabase Docs](https://supabase.com/docs) - Database & Auth
- [Agora Docs](https://docs.agora.io/) - Video/Audio
- [Stripe Docs](https://stripe.com/docs) - Payments
- [React Query Docs](https://tanstack.com/query/latest) - Data fetching
- [Vercel Docs](https://vercel.com/docs) - Deployment

### Team Communication
- Ask questions in team chat
- Create GitHub issues for bugs
- Use PR comments for code discussions

---

## Production Deployment

### Automatic Deployment
- **Push to `main` branch** → Automatically deploys to production
- **Push to `develop` branch** → Automatically deploys to staging (if configured)

### Manual Deployment
```bash
# Via Vercel CLI
cd frontend
vercel --prod

cd backend
vercel --prod
```

### Check Deployment Status
1. Go to Vercel Dashboard
2. Click on project (digis-frontend or digis-backend)
3. View deployment logs
4. Test deployed URL

---

## Success Checklist

After completing this guide, you should be able to:
- [ ] Run frontend and backend locally
- [ ] Sign up as a fan and creator
- [ ] Buy tokens and check balance
- [ ] Go live as a creator
- [ ] Join a live stream as a fan
- [ ] Send a direct message
- [ ] Make code changes and see them reflected
- [ ] Understand the overall architecture
- [ ] Know where to find key files
- [ ] Debug common issues

**Congratulations! You're ready to start contributing! 🎉**

---

## Next Steps

1. Read **PLATFORM_OVERVIEW.md** for deep technical details
2. Pick an issue from the backlog
3. Create a feature branch
4. Make your changes
5. Write tests
6. Submit a pull request
7. Get code review
8. Deploy to production

Welcome to the Digis team! 🚀
