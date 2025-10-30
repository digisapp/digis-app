# Digis Platform - Complete Tech Stack

**Version:** 2.0.0
**Last Updated:** October 30, 2025

---

## 📋 Overview

Digis is a full-stack creator economy platform enabling video calls, live streaming, messaging, and content monetization between creators and fans using a token-based economy.

---

## 🎨 Frontend Stack

### **Core Framework**
- **React 18.2** - Component-based UI framework
- **Vite 7.0.6** - Next-generation build tool & dev server
- **TypeScript 5.7.3** - Static type checking
- **React Router DOM 7.7.1** - Client-side routing

### **State Management**
- **Zustand 5.0.3** - Lightweight state management
- **React Query (TanStack) 5.62.11** - Server state management, caching, and data fetching
- **React Context API** - Authentication and device context

### **Styling & UI**
- **Tailwind CSS 3.4.10** - Utility-first CSS framework
- **Framer Motion 12.23.6** - Animation library
- **Headless UI 2.2.4** - Unstyled accessible components
- **Heroicons 2.2.0** - Icon library
- **Lucide React 0.525.0** - Additional icon set

### **Real-Time Features**
- **Ably 2.14.0** - Real-time messaging and presence
- **WebSockets (WS) 8.18.0** - Real-time bidirectional communication

### **Video/Voice Infrastructure**
- **Agora RTC SDK NG 4.24.0** - Video/voice calling engine
- **Agora RTC React 2.4.0** - React wrappers for Agora
- **Agora Chat 1.3.1** - Real-time chat SDK
- **Agora RTM SDK 2.2.2** - Real-time messaging
- **HLS.js 1.6.13** - HTTP Live Streaming player

### **Payment Processing**
- **Stripe React 3.8.0** - Payment UI components
- **Stripe.js 7.6.1** - Stripe integration

### **Authentication & Security**
- **Supabase JS 2.53.0** - Authentication and database client
- **DOMPurify 3.2.6** - XSS sanitization

### **Forms & Validation**
- **React Hook Form 7.54.2** - Form state management
- **Zod 3.24.1** - Schema validation
- **Hookform Resolvers 3.9.1** - Validation resolvers

### **Data Visualization**
- **Recharts 3.1.2** - Charting library for analytics

### **Image Handling**
- **React Image Crop 11.0.10** - Image cropping
- **React Avatar Editor 13.0.2** - Avatar editing
- **React Easy Crop 5.5.0** - Advanced cropping
- **HTML2Canvas 1.4.1** - Screenshot generation

### **Performance & Optimization**
- **React Window 1.8.11** - Virtual scrolling
- **React Virtualized Auto Sizer 1.0.26** - Auto-sizing for virtual lists
- **React Intersection Observer 9.16.0** - Lazy loading
- **Use Debounce 10.0.5** - Debouncing hooks

### **Utilities**
- **Axios 1.7.9** - HTTP client
- **Date-fns 4.1.0** - Date manipulation
- **Lodash 4.17.21** - Utility functions
- **ClassNames 2.5.1** - Conditional CSS classes
- **React Hot Toast 2.5.2** - Toast notifications

### **Error Tracking & Monitoring**
- **Sentry React 10.15.0** - Error tracking and performance monitoring
- **Web Vitals 2.1.4** - Core Web Vitals tracking

### **Testing**
- **Vitest 1.6.0** - Unit testing framework
- **Playwright 1.49.1** - End-to-end testing
- **Testing Library (React) 16.3.0** - Component testing
- **MSW 2.7.2** - API mocking

### **Development Tools**
- **ESLint 8.57.0** - JavaScript linting
- **Prettier 3.3.3** - Code formatting
- **PostCSS 8.5.6** - CSS processing
- **Autoprefixer 10.4.21** - CSS vendor prefixes

---

## 🔧 Backend Stack

### **Core Framework**
- **Node.js 20.0.0+** - JavaScript runtime
- **Express 4.18.2** - Web application framework
- **pnpm 9.0.0+** - Package manager

### **Database**
- **PostgreSQL** (via Supabase) - Primary database
- **pg 8.11.3** - PostgreSQL client for Node.js
- **Redis 4.6.12** - Caching and session store
- **IORedis 5.6.1** - Advanced Redis client

### **Authentication & Security**
- **Supabase JS 2.51.0** - Authentication provider
- **JSON Web Tokens (jsonwebtoken) 9.0.2** - JWT handling
- **Jose 6.0.12** - JWT encryption/decryption
- **Argon2 0.43.1** - Password hashing
- **Bcrypt 6.0.0** - Password hashing (legacy)
- **Helmet 8.1.0** - Security headers
- **CORS 2.8.5** - Cross-origin resource sharing
- **Express Rate Limit 8.0.1** - Rate limiting
- **Rate Limiter Flexible 5.0.5** - Advanced rate limiting
- **Express Mongo Sanitize 2.2.0** - Query injection prevention
- **XSS Clean 0.1.4** - XSS prevention
- **XSS 1.0.15** - XSS sanitization
- **HPP 0.2.3** - HTTP parameter pollution prevention

### **Real-Time Infrastructure**
- **Ably 2.14.0** - Real-time messaging platform
- **WebSockets (WS) 8.14.0** - WebSocket server
- **Socket.io Redis Adapter 8.3.0** - Socket.io scaling

### **Video/Voice Infrastructure**
- **Agora Token 2.0.5** - Agora token generation

### **Payment Processing**
- **Stripe 18.3.0** - Payment processing API

### **Background Jobs & Queues**
- **BullMQ 5.14.1** - Job queue system
- **Inngest 3.44.2** - Serverless job orchestration
- **Upstash QStash 2.8.4** - Serverless message queue
- **Node Cron 3.0.2** - Scheduled tasks

### **File Handling**
- **Multer 1.4.5-lts.1** - File upload middleware
- **Sharp 0.34.3** - Image processing
- **File Type 16.5.4** - File type detection

### **Email**
- **Nodemailer 6.9.8** - Email sending
- **Postmark 4.0.5** - Email delivery service

### **Logging & Monitoring**
- **Sentry Node 10.12.0** - Error tracking
- **Sentry Profiling 10.12.0** - Performance profiling
- **Winston 3.11.0** - Logging framework
- **Morgan 1.10.0** - HTTP request logger
- **Pino 9.3.2** - Fast JSON logger
- **Pino HTTP 10.3.1** - HTTP logging
- **Pino Pretty 13.0.0** - Log formatting

### **Monitoring & Metrics**
- **Prometheus Client 15.1.3** - Metrics collection
- **Express Prom Bundle 7.0.0** - Express metrics

### **API Documentation**
- **Swagger JSDoc 6.2.8** - API documentation generation
- **Swagger UI Express 5.0.1** - API documentation UI

### **Validation**
- **Joi 18.0.1** - Schema validation
- **Express Validator 7.2.1** - Request validation
- **Zod 3.25.76** - TypeScript-first schema validation

### **Utilities**
- **Axios 1.11.0** - HTTP client
- **UUID 9.0.1** - Unique ID generation
- **DOMPurify (Isomorphic) 2.26.0** - XSS sanitization
- **Compression 1.8.1** - Response compression
- **Body Parser 1.20.2** - Request body parsing
- **Cookie Parser 1.4.6** - Cookie parsing
- **Raw Body 3.0.0** - Raw request body access

### **Push Notifications**
- **Web Push 3.6.7** - Web push notifications

### **Testing**
- **Jest 29.7.0** - Testing framework
- **Supertest 6.3.3** - HTTP testing

### **Development Tools**
- **Nodemon 3.0.2** - Auto-restart on file changes
- **ESLint 8.55.0** - JavaScript linting
- **Prettier 3.1.0** - Code formatting

---

## 🗄️ Database & Storage

### **Primary Database**
- **Supabase (PostgreSQL)** - Hosted PostgreSQL with real-time subscriptions
  - Connection pooling (Pooler mode)
  - Direct connection for DDL operations
  - Row Level Security (RLS)
  - Real-time subscriptions

### **Caching Layer**
- **Redis** - In-memory data store
  - Session management
  - Rate limiting
  - Token balance caching
  - Real-time presence

### **File Storage**
- **Supabase Storage** - Object storage for user content
  - Images (avatars, banners, content)
  - Videos (recorded streams, content)
  - Audio files

---

## 🔐 Authentication & Authorization

### **Authentication Provider**
- **Supabase Auth** - User authentication
  - Email/password authentication
  - OAuth (Google, Twitter/X)
  - Magic links
  - JWT-based sessions

### **Authorization**
- **Role-Based Access Control (RBAC)**
  - Fan role
  - Creator role
  - Admin/Super Admin role
- **Row Level Security (RLS)** in PostgreSQL

---

## 💳 Payment Infrastructure

### **Payment Gateway**
- **Stripe** - Payment processing
  - Credit/debit card payments
  - ACH transfers
  - Webhooks for real-time payment events
  - Subscription management
  - Payout processing (Stripe Connect)

### **Token Economy**
- Custom token system built on PostgreSQL
- Real-time balance updates via Ably
- Token purchase flows with Stripe
- Creator earnings and payouts

---

## 📹 Video/Voice Infrastructure

### **Video Calling**
- **Agora.io** - Real-time video/voice communication
  - 1-on-1 video calls
  - Voice calls
  - Screen sharing
  - Token-based authentication
  - Multiple quality profiles

### **Live Streaming**
- **Agora RTC** - Live streaming engine
  - Host streaming
  - Viewer watching
  - Co-streaming with multiple creators
  - Chat integration
  - Recording capabilities
- **HLS.js** - Stream playback on web

---

## 💬 Real-Time Messaging

### **Primary Real-Time Provider**
- **Ably** - Enterprise-grade real-time messaging
  - WebSocket connections
  - Pub/Sub messaging
  - Presence detection
  - Token balance updates
  - Notification delivery
  - Connection recovery

### **Features**
- Direct messaging between users
- In-stream chat
- Typing indicators
- Read receipts
- Message history

---

## 🚀 Deployment & Hosting

### **Frontend Hosting**
- **Vercel** - Static site hosting with edge network
  - Automatic deployments from GitHub
  - Edge functions
  - Custom domain (digis.cc)
  - SSL/TLS certificates

### **Backend Hosting**
- **Vercel Serverless Functions** - Backend API hosting
  - Automatic scaling
  - Environment variables management
  - Geographic distribution

### **Database Hosting**
- **Supabase** - Managed PostgreSQL
  - Automatic backups
  - Point-in-time recovery
  - Connection pooling
  - Real-time subscriptions

### **CDN & Assets**
- **Vercel Edge Network** - Global content delivery
- **Supabase Storage CDN** - Media file delivery

---

## 🔄 CI/CD Pipeline

### **Version Control**
- **GitHub** - Source code management
  - Protected main branch
  - Pull request workflows

### **Continuous Integration**
- **GitHub Actions** - Automated testing and deployment
  - ESLint checks
  - TypeScript type checking
  - Unit tests
  - Build verification

### **Continuous Deployment**
- **Vercel** - Automatic deployments
  - Preview deployments for PRs
  - Production deployments on merge to main
  - Instant rollbacks

---

## 📊 Monitoring & Analytics

### **Error Tracking**
- **Sentry** - Application monitoring
  - Frontend error tracking
  - Backend error tracking
  - Performance monitoring
  - User session replay
  - Release tracking

### **Application Metrics**
- **Prometheus** - Metrics collection
  - API endpoint metrics
  - Response times
  - Error rates
  - Custom business metrics

### **Logging**
- **Winston/Pino** - Structured logging
  - Application logs
  - HTTP request logs
  - Error logs
  - Audit logs

### **Web Analytics**
- **Web Vitals** - Core Web Vitals tracking
  - LCP (Largest Contentful Paint)
  - FID (First Input Delay)
  - CLS (Cumulative Layout Shift)

---

## 🧪 Testing Infrastructure

### **Frontend Testing**
- **Vitest** - Unit and integration tests
- **Playwright** - End-to-end tests
- **Testing Library** - Component tests
- **MSW** - API mocking

### **Backend Testing**
- **Jest** - Unit and integration tests
- **Supertest** - HTTP endpoint tests
- **Coverage reports** - Test coverage tracking

---

## 🔧 Development Tools

### **Code Quality**
- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **TypeScript** - Static type checking (frontend)

### **Git Hooks**
- Pre-commit: Lint and format
- Pre-push: Run tests

### **API Development**
- **Swagger/OpenAPI** - API documentation
- **Postman/Thunder Client** - API testing

---

## 📦 Package Management

### **Frontend**
- **pnpm** - Fast, disk-efficient package manager

### **Backend**
- **pnpm** - Fast, disk-efficient package manager

---

## 🌐 Browser Support

### **Production**
- Modern browsers (>0.2% market share)
- Excludes Opera Mini
- Excludes IE11

### **Development**
- Latest Chrome
- Latest Firefox
- Latest Safari

---

## 📱 Mobile Support

### **Responsive Design**
- Mobile-first approach
- Tailwind CSS breakpoints
- Touch-optimized interactions

### **Progressive Web App (PWA)**
- Service worker for offline support
- Web app manifest
- Install prompts

---

## 🔒 Security Features

### **Backend Security**
- Helmet.js security headers
- CORS protection
- Rate limiting (IP-based and user-based)
- XSS prevention
- SQL injection prevention
- Input validation and sanitization
- JWT token authentication
- Secure password hashing (Argon2)
- HTTPS enforcement

### **Frontend Security**
- DOMPurify for XSS prevention
- Content Security Policy
- Secure cookie handling
- HTTPS-only requests

### **Database Security**
- Row Level Security (RLS)
- Parameterized queries
- Connection pooling with SSL
- Encrypted connections

---

## 📈 Scalability Features

### **Backend Scalability**
- Serverless architecture (auto-scaling)
- Redis caching layer
- Connection pooling
- Background job queues (BullMQ)
- Rate limiting
- Response compression

### **Frontend Scalability**
- Code splitting
- Lazy loading
- Virtual scrolling
- Image optimization
- CDN delivery
- Edge caching

### **Database Scalability**
- Connection pooling
- Read replicas (via Supabase)
- Query optimization
- Indexes on critical tables

---

## 🎯 Key Features & Capabilities

### **Creator Features**
- Live streaming with co-streaming
- Video/voice calls with fans
- Content publishing (photos, videos, audio)
- Ticketed shows
- Classes/courses
- Shop/merchandise
- Subscriber tiers
- Analytics dashboard
- Earnings tracking
- Payout management

### **Fan Features**
- Creator discovery and search
- Video/voice call requests
- Live stream watching
- Direct messaging
- Tipping/gifts
- Token purchases
- Subscription management
- Content access
- Recently viewed creators
- Following system

### **Admin Features**
- User management
- Content moderation
- Analytics dashboard
- System monitoring
- Financial oversight
- Creator application review

---

## 📋 Database Schema

### **Core Tables**
- `users` - User accounts and profiles
- `sessions` - Video/voice call sessions
- `tokens` - Token transactions
- `payments` - Payment history
- `streams` - Live streaming sessions
- `messages` - Direct messages
- `subscriptions` - Subscriber relationships
- `content` - User-generated content
- `creator_payout_intents` - Payout tracking

### **Relationships**
- Foreign keys with ON DELETE CASCADE
- ON UPDATE CASCADE for flexibility
- Indexes on frequently queried columns

---

## 🌍 Environment Variables

### **Frontend**
- `VITE_BACKEND_URL` - Backend API URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase public key

### **Backend**
- `DATABASE_URL` - PostgreSQL connection string
- `AGORA_APP_ID` - Agora application ID
- `AGORA_APP_CERTIFICATE` - Agora app certificate
- `STRIPE_SECRET_KEY` - Stripe secret key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key
- `ABLY_API_KEY` - Ably API key
- `INNGEST_SIGNING_KEY` - Inngest webhook signing key

---

## 📚 Documentation

### **Code Documentation**
- JSDoc comments in critical functions
- README files in major directories
- CLAUDE.md for AI context

### **API Documentation**
- Swagger/OpenAPI specs
- Endpoint descriptions
- Request/response examples

---

## 🎨 Design System

### **Colors**
- Purple/Pink gradient theme
- Tailwind CSS color palette
- Dark mode support

### **Typography**
- System font stack
- Responsive font sizes

### **Components**
- Reusable UI components
- Accessible components (Headless UI)
- Animation with Framer Motion

---

## 📞 Contact & Support

For technical questions or issues, please contact the development team at dev@digis.com

---

**Last Updated:** October 30, 2025
**Tech Stack Version:** 2.0.0
**Platform:** Digis Creator Economy Platform
