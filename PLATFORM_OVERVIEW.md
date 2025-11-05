# Digis Platform - Comprehensive Technical Documentation
## For New Development Team

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Platform Vision & Concept](#platform-vision--concept)
3. [Core Features](#core-features)
4. [Technical Architecture](#technical-architecture)
5. [Full Stack Breakdown](#full-stack-breakdown)
6. [Database Architecture](#database-architecture)
7. [API Structure](#api-structure)
8. [Development Setup](#development-setup)
9. [Deployment Architecture](#deployment-architecture)
10. [Security & Performance](#security--performance)
11. [Key Integration Points](#key-integration-points)
12. [Development Workflow](#development-workflow)

---

## Executive Summary

**Digis** is a creator economy platform that connects fans with content creators through paid interactions using a token-based economy. The platform enables real-time video calls, voice calls, live streaming, and messaging between creators and their audience.

**Current Version:** 2.0.0 (Frontend), 1.0.7 (Backend)
**Architecture:** Modern serverless web application
**Hosting:** Vercel (Frontend & Backend)
**Database:** PostgreSQL (Supabase)
**Status:** Production-ready, actively deployed

---

## Platform Vision & Concept

### Core Value Proposition
Digis enables monetization of creator-fan interactions through a token-based economy, providing:
- **Direct Creator-Fan Connections**: Real-time 1-on-1 and broadcast interactions
- **Flexible Monetization**: Multiple revenue streams (calls, streams, messages, tips, subscriptions)
- **Built-in Payment Processing**: Secure token economy with Stripe integration
- **Professional Streaming**: High-quality video/audio using Agora.io infrastructure

### Target Users
1. **Creators**: Content creators, influencers, educators, performers
2. **Fans**: Supporters seeking exclusive access and direct interaction
3. **Admins**: Platform administrators managing users and content

### Revenue Model
- **Token Purchases**: Fans buy tokens using Stripe
- **Platform Fee**: Commission on creator earnings
- **Subscription Tiers**: Recurring revenue from fan subscriptions
- **Premium Features**: Enhanced visibility, analytics, tools

---

## Core Features

### 1. Live Streaming (Digis TV)
- **Real-time broadcasting** to unlimited viewers
- **Interactive features**: Tips, reactions, chat
- **Live shopping**: Sell products during streams
- **Stream analytics**: Viewer counts, engagement metrics
- **Recording & VOD**: Save and replay past streams

### 2. Video & Voice Calls
- **1-on-1 Video Calls**: Private paid sessions with creators
- **Voice Calls**: Lower-bandwidth alternative
- **Call Scheduling**: Book future sessions
- **Per-Minute Billing**: Automatic token deduction
- **Call History**: Track past sessions and recordings

### 3. Messaging System
- **Direct Messages**: Text, images, audio, video
- **Premium Messages**: Paid messages to creators
- **Pay-Per-View Content**: Locked media requiring token unlock
- **Read Receipts**: Delivery and read status
- **Typing Indicators**: Real-time presence

### 4. Token Economy
- **Token Purchase**: Buy tokens via Stripe
- **Token Balance**: Real-time balance tracking
- **Token Transactions**: Complete transaction history
- **Creator Earnings**: Token-to-USD conversion
- **Automatic Payouts**: Scheduled withdrawals to bank accounts

### 5. Creator Tools
- **Profile Management**: Bio, rates, media, availability
- **Earnings Dashboard**: Analytics and revenue tracking
- **Stream Management**: Go live, end stream, configure settings
- **Fan Management**: View subscribers, followers, top supporters
- **Schedule Management**: Set availability, book slots

### 6. Fan Features
- **Creator Discovery**: Browse, search, filter creators
- **Subscriptions**: Monthly/annual recurring access
- **Gifting**: Send virtual gifts during streams
- **Tipping**: Send tips during calls or streams
- **Saved Creators**: Bookmark favorite creators

### 7. Subscription System
- **Tiered Subscriptions**: Multiple levels per creator
- **Subscriber Perks**: Exclusive content, discounts, badges
- **Loyalty System**: Rewards for long-term subscribers
- **Auto-Renewal**: Automatic subscription management

### 8. E-commerce Integration
- **Shop Management**: Creators sell physical/digital products
- **Live Shopping**: Purchase during streams
- **Order Management**: Track orders and fulfillment
- **Product Catalog**: Images, descriptions, variants

### 9. Admin Panel
- **User Management**: View, edit, ban users
- **Content Moderation**: Review flagged content
- **Analytics Dashboard**: Platform-wide metrics
- **Creator Approval**: Review and approve applications

---

## Technical Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Web Browser │  │ Mobile Web   │  │  Admin Panel │     │
│  │   (React)    │  │   (React)    │  │   (React)    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼────────────┘
          │                  │                  │
          ├──────────────────┴──────────────────┤
          │         HTTPS (REST API)             │
          ▼                                      │
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Express.js API (Node.js 20)                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │
│  │  │   Auth       │  │   Routes     │  │   Jobs   │ │   │
│  │  │ (Supabase)   │  │   (78 modules)│  │ (Cron)   │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────┬───────────────────────────────────┬───────────────┘
          │                                   │
          ├───────────────────┬───────────────┤
          │                   │               │
┌─────────▼────────┐ ┌────────▼────────┐ ┌──▼──────────────┐
│   Data Layer     │ │  External APIs  │ │ Real-time Layer │
│                  │ │                 │ │                 │
│  PostgreSQL      │ │  Stripe         │ │  Ably           │
│  (Supabase)      │ │  Agora.io       │ │  (WebSocket)    │
│  - 161 Tables    │ │  Sentry         │ │  - Chat         │
│  - Row Level     │ │  Upstash Redis  │ │  - Presence     │
│  - Security      │ │  Postmark       │ │  - Notifications│
│                  │ │                 │ │                 │
└──────────────────┘ └─────────────────┘ └─────────────────┘
```

### Technology Stack Philosophy
- **Serverless-First**: Built for Vercel serverless deployment
- **Scalable**: Stateless architecture for horizontal scaling
- **Secure**: Row-Level Security, JWT auth, input sanitization
- **Real-time**: WebSocket via Ably for live updates
- **Modern**: Latest React patterns, TypeScript, ES6+

---

## Full Stack Breakdown

### Frontend Stack

#### Core Technologies
| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 18.2.0 | UI framework |
| **TypeScript** | 5.7.3 | Type safety |
| **Vite** | 7.0.6 | Build tool & dev server |
| **React Router** | 7.7.1 | Client-side routing |
| **TailwindCSS** | 3.4.10 | Utility-first CSS |

#### State Management
- **React Query** (TanStack Query 5.62.11): Server state, caching, mutations
- **Zustand** (5.0.3): Client state management
- **React Context**: Auth state, global settings

#### Real-Time Communication
- **Agora RTC SDK** (4.24.0): Video/voice calls and streaming
- **Agora RTM SDK** (2.2.2): Real-time messaging during calls
- **Ably** (2.14.0): WebSocket for presence, notifications

#### UI Components & Libraries
- **Framer Motion** (12.23.6): Animations
- **Headless UI** (2.2.4): Accessible components
- **Heroicons** (2.2.0): Icon library
- **Lucide React** (0.525.0): Additional icons
- **React Hot Toast** (2.5.2): Notifications
- **React Hook Form** (7.54.2): Form management
- **Zod** (3.24.1): Schema validation

#### Payment Processing
- **Stripe React** (3.8.0): Payment UI components
- **Stripe.js** (7.6.1): Payment processing

#### Media & Graphics
- **HLS.js** (1.6.13): Video streaming playback
- **HTML2Canvas** (1.4.1): Screenshots
- **React Avatar Editor** (13.0.2): Image cropping
- **Canvas Confetti** (1.9.3): Celebration effects

#### Development Tools
- **Vitest** (1.6.0): Unit testing
- **Playwright** (1.49.1): E2E testing
- **ESLint** (8.57.0): Linting
- **Prettier** (3.3.3): Code formatting
- **Sentry** (10.15.0): Error tracking

---

### Backend Stack

#### Core Technologies
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | 20.x | Runtime environment |
| **Express.js** | 4.18.2 | Web framework |
| **PostgreSQL** | Latest | Database (via Supabase) |
| **Supabase** | 2.51.0 | Backend-as-a-Service |

#### Authentication & Security
- **Supabase Auth**: User authentication (JWT)
- **Argon2** (0.43.1): Password hashing
- **BCrypt** (6.0.0): Legacy password support
- **Helmet** (8.1.0): Security headers
- **CORS** (2.8.5): Cross-origin requests
- **XSS-Clean** (0.1.4): XSS protection
- **Express Rate Limit** (8.0.1): Rate limiting
- **HPP** (0.2.3): HTTP parameter pollution protection
- **Express Validator** (7.2.1): Input validation
- **Joi** (18.0.1): Schema validation
- **Zod** (3.25.76): TypeScript schema validation

#### Payment & Monetization
- **Stripe** (18.3.0): Payment processing
- **Agora Token** (2.0.5): Video/audio token generation

#### Real-Time & Messaging
- **Ably** (2.14.0): Serverless WebSocket
- **ws** (8.14.0): WebSocket client

#### Background Jobs & Queues
- **BullMQ** (5.14.1): Job queue (local dev only)
- **Inngest** (3.44.2): Serverless workflows
- **Node-Cron** (3.0.2): Scheduled tasks
- **Upstash QStash** (2.8.4): Serverless cron

#### Caching & Storage
- **Upstash Redis** (1.35.3): Serverless Redis cache
- **IORedis** (5.6.1): Redis client (fallback)
- **Sharp** (0.34.3): Image processing

#### Logging & Monitoring
- **Winston** (3.11.0): Logging framework
- **Pino** (9.3.2): High-performance logger
- **Sentry** (10.12.0): Error tracking
- **Express Prom Bundle** (7.0.0): Prometheus metrics

#### Email & Notifications
- **Postmark** (4.0.5): Transactional email
- **Nodemailer** (6.9.8): Email fallback
- **Web Push** (3.6.7): Browser push notifications

#### Development Tools
- **Nodemon** (3.0.2): Auto-restart on changes
- **Jest** (29.7.0): Testing framework
- **Supertest** (6.3.3): API testing
- **ESLint** (8.55.0): Linting
- **Prettier** (3.1.0): Code formatting
- **Swagger** (6.2.8): API documentation

---

### Database Architecture (PostgreSQL via Supabase)

#### Schema Overview
- **161 Migration Files**: Comprehensive database schema
- **Row-Level Security (RLS)**: Fine-grained access control
- **Realtime Subscriptions**: Live data updates
- **Foreign Keys**: Referential integrity
- **Triggers**: Automated data management

#### Core Tables (Simplified)

**Users & Authentication**
```sql
users (
  id UUID PRIMARY KEY,
  supabase_id UUID UNIQUE,
  email VARCHAR UNIQUE,
  username VARCHAR UNIQUE,
  display_name VARCHAR,
  bio TEXT,
  profile_pic_url TEXT,
  is_creator BOOLEAN,
  role VARCHAR ('admin', 'creator', 'fan'),
  creator_type VARCHAR,
  token_balance INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Token Economy**
```sql
token_balances (
  user_id UUID REFERENCES users(id),
  balance INTEGER DEFAULT 0,
  lifetime_earned INTEGER DEFAULT 0,
  lifetime_spent INTEGER DEFAULT 0
)

token_transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type VARCHAR ('purchase', 'earning', 'deduction', 'payout'),
  amount INTEGER,
  description TEXT,
  stripe_payment_id VARCHAR,
  created_at TIMESTAMPTZ
)
```

**Streaming**
```sql
streams (
  id UUID PRIMARY KEY,
  channel_name VARCHAR UNIQUE,
  creator_id UUID REFERENCES users(id),
  title VARCHAR,
  description TEXT,
  category VARCHAR,
  status VARCHAR ('live', 'ended', 'scheduled'),
  viewer_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_url TEXT
)

stream_viewers (
  stream_id UUID REFERENCES streams(id),
  user_id UUID REFERENCES users(id),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ
)
```

**Calls & Sessions**
```sql
sessions (
  id UUID PRIMARY KEY,
  creator_id UUID REFERENCES users(id),
  fan_id UUID REFERENCES users(id),
  session_type VARCHAR ('video', 'voice'),
  status VARCHAR ('scheduled', 'active', 'completed', 'cancelled'),
  channel_name VARCHAR,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  tokens_charged INTEGER,
  rate_per_minute INTEGER
)

call_invitations (
  id UUID PRIMARY KEY,
  creator_id UUID REFERENCES users(id),
  fan_id UUID REFERENCES users(id),
  call_type VARCHAR ('video', 'voice'),
  status VARCHAR ('pending', 'accepted', 'declined', 'expired'),
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
```

**Messaging**
```sql
conversations (
  id UUID PRIMARY KEY,
  user1_id UUID REFERENCES users(id),
  user2_id UUID REFERENCES users(id),
  last_message_id UUID,
  last_message_at TIMESTAMPTZ,
  UNIQUE(user1_id, user2_id)
)

messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  sender_id UUID REFERENCES users(id),
  recipient_id UUID REFERENCES users(id),
  content TEXT,
  media_url TEXT,
  media_type VARCHAR,
  message_type VARCHAR ('text', 'tip', 'offer', 'media'),
  tokens_spent INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ
)
```

**Subscriptions**
```sql
subscriptions (
  id UUID PRIMARY KEY,
  fan_id UUID REFERENCES users(id),
  creator_id UUID REFERENCES users(id),
  tier_id UUID REFERENCES subscription_tiers(id),
  status VARCHAR ('active', 'cancelled', 'expired'),
  stripe_subscription_id VARCHAR,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

subscription_tiers (
  id UUID PRIMARY KEY,
  creator_id UUID REFERENCES users(id),
  name VARCHAR,
  description TEXT,
  price_tokens INTEGER,
  price_usd DECIMAL,
  perks JSONB,
  active BOOLEAN DEFAULT TRUE
)
```

**E-commerce**
```sql
products (
  id UUID PRIMARY KEY,
  creator_id UUID REFERENCES users(id),
  name VARCHAR,
  description TEXT,
  price_tokens INTEGER,
  price_usd DECIMAL,
  images JSONB,
  stock INTEGER,
  active BOOLEAN DEFAULT TRUE
)

orders (
  id UUID PRIMARY KEY,
  buyer_id UUID REFERENCES users(id),
  seller_id UUID REFERENCES users(id),
  total_tokens INTEGER,
  total_usd DECIMAL,
  status VARCHAR ('pending', 'paid', 'shipped', 'completed'),
  stripe_payment_id VARCHAR,
  created_at TIMESTAMPTZ
)
```

#### Database Functions (PostgreSQL)
```sql
-- Get or create conversation between users
get_or_create_conversation(p_user1_id UUID, p_user2_id UUID) RETURNS UUID

-- Mark messages as read
mark_messages_as_read(p_conversation_id UUID, p_user_id UUID) RETURNS INTEGER

-- Get unread message count
get_unread_count(p_user_id UUID) RETURNS INTEGER

-- Calculate creator earnings
calculate_creator_earnings(p_creator_id UUID, p_start_date TIMESTAMPTZ) RETURNS TABLE

-- Get active stream viewers
get_active_viewers(p_stream_id UUID) RETURNS TABLE
```

---

## API Structure

### API Versioning
- **Base URL**: `https://backend-digis.vercel.app`
- **Current Version**: `/api/v1/`
- **Legacy Support**: `/api/` (will be deprecated)

### Authentication
All authenticated endpoints require:
```
Authorization: Bearer <JWT_TOKEN>
```

### Major API Endpoints (78 Route Modules)

#### Authentication (`/api/v1/auth`)
- `POST /register` - User registration
- `POST /login` - Email/password login
- `POST /login/otp` - Magic link login
- `POST /logout` - End session
- `POST /refresh` - Refresh JWT token
- `POST /sync-metadata` - Sync user metadata

#### Users (`/api/v1/users`)
- `GET /me` - Get current user profile
- `PUT /me` - Update profile
- `GET /:userId` - Get user by ID
- `GET /username/:username` - Get user by username
- `POST /become-creator` - Apply to be creator

#### Tokens (`/api/v1/tokens`)
- `GET /balance` - Get token balance
- `POST /purchase` - Buy tokens with Stripe
- `GET /transactions` - Get transaction history
- `POST /transfer` - Transfer tokens to another user

#### Streaming (`/api/v1/streaming`)
- `POST /go-live` - Start live stream
- `POST /end-stream/:streamId` - End stream
- `GET /stream/:channelName` - Get stream info
- `GET /active` - Get all active streams
- `POST /viewer/join/:streamId` - Join as viewer
- `POST /viewer/leave/:streamId` - Leave stream

#### Agora (`/api/v1/agora`)
- `POST /token/rtc` - Generate RTC token (video/voice)
- `POST /token/rtm` - Generate RTM token (messaging)
- `POST /token/stream` - Generate streaming token

#### Calls (`/api/calls`)
- `POST /invite` - Send call invitation
- `POST /accept/:inviteId` - Accept invitation
- `POST /decline/:inviteId` - Decline invitation
- `POST /start` - Start call session
- `POST /end/:sessionId` - End call session

#### Messages (`/api/v1/messages`)
- `GET /conversations` - Get all conversations
- `POST /conversations` - Create conversation
- `GET /conversation/:conversationId` - Get messages
- `POST /send` - Send message
- `GET /unread/count` - Get unread count
- `PATCH /:messageId` - Update message (read status)

#### Subscriptions (`/api/v1/subscriptions`)
- `GET /creator/:creatorId` - Get creator's tiers
- `POST /subscribe` - Subscribe to creator
- `POST /cancel/:subscriptionId` - Cancel subscription
- `GET /my-subscriptions` - Get active subscriptions
- `POST /tier` - Create subscription tier (creator)

#### Payments (`/api/payments`)
- `POST /intent` - Create payment intent
- `POST /confirm` - Confirm payment
- `GET /history` - Get payment history
- `POST /refund/:paymentId` - Process refund

#### Shop (`/api/v1/shop`)
- `GET /products/:creatorId` - Get creator's products
- `POST /product` - Create product (creator)
- `PUT /product/:productId` - Update product
- `POST /order` - Create order
- `GET /orders` - Get order history

#### Analytics (`/api/analytics`)
- `GET /creator/earnings` - Earnings breakdown
- `GET /creator/viewers` - Viewer analytics
- `GET /creator/subscribers` - Subscriber metrics
- `GET /platform/stats` - Platform-wide stats (admin)

#### Admin (`/api/v1/admin`)
- `GET /users` - List all users
- `PUT /user/:userId` - Update user
- `POST /user/:userId/ban` - Ban user
- `GET /moderation/queue` - Content moderation queue
- `GET /platform/metrics` - Platform metrics

### Error Responses
All errors follow this format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "requestId": "uuid"
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

Common Error Codes:
- `AUTH_REQUIRED` - Not authenticated
- `INSUFFICIENT_TOKENS` - Not enough tokens
- `CREATOR_ONLY` - Creator access required
- `ADMIN_ONLY` - Admin access required
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid input
- `RATE_LIMIT_EXCEEDED` - Too many requests

---

## Development Setup

### Prerequisites
```bash
# Required versions
Node.js >= 20.0.0
pnpm >= 9.0.0
PostgreSQL (via Supabase - cloud hosted)
```

### Environment Variables

#### Frontend (`.env`)
```bash
# API
VITE_BACKEND_URL=https://backend-digis.vercel.app/api/v1

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Agora
VITE_AGORA_APP_ID=your_agora_app_id

# Stripe (Public Key)
VITE_STRIPE_PUBLIC_KEY=pk_live_...

# Environment
VITE_ENV=production
```

#### Backend (`.env`)
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/database?sslmode=require

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# Agora
AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_app_certificate

# Stripe (Secret Key)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token

# Ably (Real-time)
ABLY_API_KEY=your_ably_key

# Email (Postmark)
POSTMARK_API_KEY=your_postmark_key
POSTMARK_FROM_EMAIL=noreply@digis.com

# Sentry
SENTRY_DSN=https://...@sentry.io/...

# Frontend URL (for CORS)
FRONTEND_URL=https://digis.com

# Environment
NODE_ENV=production
PORT=3005
```

### Local Development

#### 1. Install Dependencies
```bash
# Backend
cd backend
pnpm install

# Frontend
cd frontend
pnpm install
```

#### 2. Run Database Migrations
```bash
cd backend
pnpm run migrate
```

#### 3. Start Development Servers

**Backend** (Port 3005)
```bash
cd backend
pnpm run dev
```

**Frontend** (Port 5173)
```bash
cd frontend
pnpm run dev
```

#### 4. Access Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:3005
- API Docs: http://localhost:3005/api-docs

### Testing

#### Backend Tests
```bash
cd backend
pnpm test                # Run all tests
pnpm test:watch          # Watch mode
pnpm test:coverage       # With coverage report
```

#### Frontend Tests
```bash
cd frontend
pnpm test                # Unit tests (Vitest)
pnpm test:ui             # Test UI
pnpm test:e2e            # E2E tests (Playwright)
```

### Code Quality

#### Linting
```bash
# Backend
cd backend
pnpm run lint
pnpm run lint:fix

# Frontend
cd frontend
pnpm run lint
pnpm run lint:fix
```

#### Type Checking
```bash
cd frontend
pnpm run type-check
```

#### Formatting
```bash
# Backend
cd backend
pnpm run format
pnpm run format:check

# Frontend
cd frontend
pnpm run format
```

---

## Deployment Architecture

### Platform: Vercel (Serverless)

#### Frontend Deployment
```yaml
Framework: Vite (React)
Build Command: npm run build
Output Directory: dist
Environment: Node.js 20
Auto-Deploy: Yes (on push to main)
Custom Domain: digis.com
```

#### Backend Deployment
```yaml
Framework: Express.js
Entry Point: api/index.js
Serverless Functions: Yes
Region: Global (Edge Network)
Auto-Deploy: Yes (on push to main)
Custom Domain: backend-digis.vercel.app
```

### CI/CD Pipeline

#### GitHub Actions Workflow
```yaml
Trigger: Push to main branch
Steps:
  1. Checkout code
  2. Install dependencies (pnpm)
  3. Run linting (ESLint)
  4. Run type checking (TypeScript)
  5. Run tests (Jest/Vitest)
  6. Build frontend (Vite)
  7. Deploy to Vercel
  8. Run smoke tests
  9. Notify team (on failure)
```

### Monitoring & Observability

#### Sentry Integration
- **Error Tracking**: Automatic error capture
- **Performance Monitoring**: Transaction tracing
- **Release Tracking**: Version-based error grouping
- **Source Maps**: Original code in stack traces

#### Logging Strategy
- **Winston**: Structured logging to files (local)
- **Pino**: High-performance JSON logging
- **Console**: Development debugging
- **Log Levels**: ERROR, WARN, INFO, DEBUG

#### Metrics Collection
- **Prometheus**: Custom metrics via express-prom-bundle
- **Vercel Analytics**: Built-in performance metrics
- **Supabase Logs**: Database query performance

---

## Security & Performance

### Security Measures

#### Authentication & Authorization
- **JWT Tokens**: Supabase-issued, short-lived (1 hour)
- **Refresh Tokens**: Automatic renewal
- **Row-Level Security**: Database-enforced access control
- **Role-Based Access**: Admin, Creator, Fan roles
- **API Key Rotation**: Regular credential updates

#### Input Validation
- **XSS Protection**: Input sanitization (xss-clean)
- **SQL Injection**: Parameterized queries only
- **CSRF Protection**: Token-based validation
- **File Upload**: Type and size restrictions (10MB max)
- **Rate Limiting**: Per-endpoint throttling

#### Data Protection
- **Encryption at Rest**: Supabase default encryption
- **Encryption in Transit**: TLS 1.3 (HTTPS only)
- **Password Hashing**: Argon2 (industry-leading)
- **Sensitive Data**: Never logged or exposed
- **GDPR Compliance**: User data export/deletion

#### Security Headers (Helmet.js)
```javascript
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: [custom policy]
Referrer-Policy: strict-origin-when-cross-origin
```

### Performance Optimization

#### Frontend Optimization
- **Code Splitting**: Route-based lazy loading
- **Tree Shaking**: Remove unused code
- **Image Optimization**: Sharp for image processing
- **Bundle Size**: Monitored with rollup-plugin-visualizer
- **Caching**: Service Worker for offline support
- **Compression**: Gzip/Brotli for assets

#### Backend Optimization
- **Caching**: Upstash Redis for frequent queries
- **Connection Pooling**: PostgreSQL connection reuse
- **Response Compression**: Gzip middleware
- **CDN**: Vercel Edge Network for static assets
- **Query Optimization**: Database indexes on foreign keys

#### Real-Time Optimization
- **Agora Edge Network**: Global CDN for video/audio
- **Ably**: Serverless WebSocket with auto-scaling
- **Presence Debouncing**: Reduce unnecessary updates
- **Batch Updates**: Group real-time events

---

## Key Integration Points

### 1. Stripe Payment Integration
**Purpose**: Process token purchases and payouts

**Flow**:
```
User → Frontend → Create Payment Intent → Backend → Stripe API
                                                    ↓
                                            Stripe Response
                                                    ↓
Backend → Confirm Payment → Update Token Balance → Notify User
```

**Key Files**:
- `backend/routes/payments.js` - Payment endpoints
- `backend/routes/tokens.js` - Token purchase logic
- `frontend/src/components/TokenPurchase.js` - UI

### 2. Agora.io Video/Audio Integration
**Purpose**: Real-time video calls and streaming

**Flow**:
```
User → Request Stream → Backend → Generate Agora Token → Return to Frontend
                                                              ↓
Frontend → Initialize Agora Client → Join Channel → Publish Tracks
                                                              ↓
                                                    Other users receive stream
```

**Key Files**:
- `backend/routes/agora.js` - Token generation
- `frontend/src/lib/agoraClient.ts` - Client singleton
- `frontend/src/components/VideoCall.js` - Call UI
- `frontend/src/components/HybridStreamingLayout.jsx` - Stream UI

### 3. Supabase Authentication
**Purpose**: User authentication and database access

**Flow**:
```
User → Sign In → Supabase Auth → JWT Token → Store in Frontend
                                                     ↓
                            API Request with Bearer Token
                                                     ↓
Backend → Verify Token → Supabase Admin → Access Database
```

**Key Files**:
- `backend/routes/auth.js` - Auth endpoints
- `backend/middleware/auth.js` - Token verification
- `frontend/src/contexts/AuthContext.tsx` - Auth state
- `backend/utils/supabase-admin-v2.js` - Supabase client

### 4. Ably Real-Time Integration
**Purpose**: WebSocket connections for presence, notifications

**Flow**:
```
User → Connect to Ably → Backend → Generate Ably Token
                                            ↓
                              Subscribe to Channels
                                            ↓
                        Receive Real-Time Updates
```

**Key Files**:
- `backend/api/ably-auth.js` - Token endpoint
- `backend/routes/realtime.js` - Channel management
- `frontend/src/hooks/useAbly.js` - Ably hook

### 5. Upstash Redis Caching
**Purpose**: Cache JWT verification and frequent queries

**Flow**:
```
API Request → Check Redis Cache → Cache Hit? → Return Cached Data
                     ↓ (Cache Miss)
              Query Database → Store in Redis → Return Data
```

**Key Files**:
- `backend/utils/supabase-admin-v2.js` - Redis client
- Caching used in: JWT verification, user profiles

---

## Development Workflow

### Git Workflow
```
main (production)
  ↓
develop (staging)
  ↓
feature/feature-name (feature branches)
```

### Branch Strategy
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Emergency production fixes

### Commit Convention
```
feat: Add new feature
fix: Bug fix
docs: Documentation changes
style: Code formatting
refactor: Code restructuring
test: Add/update tests
chore: Maintenance tasks
```

### Pull Request Process
1. Create feature branch from `develop`
2. Make changes with clear commits
3. Run tests and linting locally
4. Create PR with description
5. Request code review
6. Address feedback
7. Merge to `develop`
8. Deploy to staging
9. Test on staging
10. Merge to `main` for production

### Code Review Checklist
- [ ] Code follows project style guide
- [ ] All tests passing
- [ ] No console.log or debug code
- [ ] Security considerations addressed
- [ ] Performance implications considered
- [ ] Documentation updated
- [ ] Error handling implemented
- [ ] Type safety (TypeScript)

---

## Key Files & Directories

### Backend Structure
```
backend/
├── api/
│   ├── index.js              # Main Express app
│   ├── ably-auth.js          # Ably token generation
│   └── inngest.js            # Serverless workflows
├── routes/                   # API routes (78 files)
│   ├── auth.js
│   ├── users.js
│   ├── streaming.js
│   ├── messages.js
│   └── ...
├── middleware/               # Express middleware
│   ├── auth.js               # JWT verification
│   ├── cors-config.js
│   ├── rate-limiters.js
│   └── security.js
├── utils/                    # Utility functions
│   ├── db.js                 # PostgreSQL client
│   ├── supabase-admin-v2.js  # Supabase admin
│   ├── secureLogger.js       # Winston logger
│   └── migrate.js            # Database migrations
├── migrations/               # SQL migration files (161)
├── jobs/                     # Cron jobs
│   ├── expire-call-invitations.js
│   └── loyalty-perk-delivery.js
└── package.json
```

### Frontend Structure
```
frontend/
├── src/
│   ├── components/           # React components
│   │   ├── pages/           # Page components (33)
│   │   ├── mobile/          # Mobile-specific UI
│   │   ├── ui/              # Reusable UI components
│   │   ├── VideoCall.js     # Call component
│   │   └── HybridStreamingLayout.jsx
│   ├── contexts/            # React contexts
│   │   ├── AuthContext.tsx
│   │   └── SocketContext.jsx
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useMessages.js
│   │   └── useConversations.js
│   ├── lib/                 # Libraries
│   │   ├── api.ts           # API client
│   │   ├── agoraClient.ts   # Agora singleton
│   │   └── supabase.ts
│   ├── routes/              # Routing configuration
│   │   └── AppRoutes.jsx
│   ├── utils/               # Utility functions
│   ├── App.tsx              # Root component
│   └── main.tsx             # Entry point
└── package.json
```

---

## Troubleshooting Common Issues

### 1. CORS Errors
**Symptom**: Frontend can't call backend API
**Solution**:
- Check `FRONTEND_URL` in backend .env
- Verify Vercel domain whitelist in `backend/middleware/cors-config.js`

### 2. Database Connection Errors
**Symptom**: 500 errors on API calls
**Solution**:
- Check `DATABASE_URL` format (must include `?sslmode=require`)
- Verify Supabase connection pooler URL (not direct connection)
- Check Supabase project is active

### 3. Agora Video Not Working
**Symptom**: Black screen or no video/audio
**Solution**:
- Check `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` are correct
- Verify Agora token is generated with correct UID
- Check browser permissions for camera/microphone
- Look for `UID_CONFLICT` errors in console

### 4. Token Balance Not Updating
**Symptom**: Balance doesn't reflect purchases
**Solution**:
- Check Stripe webhook is configured (use `stripe listen` for local)
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check `token_transactions` table for transaction record

### 5. Real-Time Not Working
**Symptom**: No live updates (chat, presence)
**Solution**:
- Check `ABLY_API_KEY` is set
- Verify Ably channels are subscribed correctly
- Look for WebSocket connection errors in console

---

## Next Steps for New Team

### Week 1: Onboarding
- [ ] Set up local development environment
- [ ] Run frontend and backend locally
- [ ] Create test account (fan and creator)
- [ ] Test core features (streaming, calling, messaging)
- [ ] Review codebase structure

### Week 2: Deep Dive
- [ ] Study authentication flow (Supabase Auth)
- [ ] Understand token economy logic
- [ ] Review Agora integration
- [ ] Explore database schema
- [ ] Run test suite

### Week 3: First Tasks
- [ ] Fix a small bug from backlog
- [ ] Add a minor feature
- [ ] Write tests for your changes
- [ ] Create first pull request
- [ ] Deploy to staging

### Ongoing Learning Resources
- Supabase Docs: https://supabase.com/docs
- Agora Docs: https://docs.agora.io/
- Stripe Docs: https://stripe.com/docs
- React Query Docs: https://tanstack.com/query/latest
- Vercel Docs: https://vercel.com/docs

---

## Contact & Support

### Documentation
- `CLAUDE.md` - AI assistant instructions
- `README.md` - Project readme
- `/api-docs` - Swagger API documentation (when running locally)

### Key Repositories
- Main Repo: GitHub (check with admin for URL)
- Frontend Deployment: Vercel Dashboard
- Backend Deployment: Vercel Dashboard

### Support Channels
- Sentry: Error tracking and monitoring
- GitHub Issues: Bug reports and feature requests
- Team Chat: [Your communication platform]

---

**Document Version**: 1.0
**Last Updated**: January 2025
**Maintained By**: Development Team

---

*This document provides a comprehensive overview of the Digis platform for new team members. For specific implementation details, refer to inline code comments and individual component documentation.*
