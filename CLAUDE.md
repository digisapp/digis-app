# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Digis is a creator-economy platform connecting fans with creators through paid interactions using a token-based economy. The platform enables video calls, voice calls, live streaming, and real-time chat between creators and their audience.

## Architecture

### Frontend (React)
- **Location**: `/frontend/`
- **Framework**: React 18 with functional components and hooks
- **State Management**: React Context API (`AppContext.js`)
- **Styling**: Tailwind CSS with custom design system
- **Real-time**: Agora.io SDK for video/voice calls and streaming
- **Authentication**: Supabase Auth integration
- **Payments**: Stripe integration for token purchases
- **Animation**: Framer Motion for UI animations

### Backend (Node.js/Express)
- **Location**: `/backend/`
- **Framework**: Express.js with comprehensive security middleware
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth for user authentication
- **Real-time**: WebSocket integration and Socket.io
- **Payments**: Stripe API for payment processing
- **Video/Voice**: Agora.io token generation and management
- **Logging**: Winston with file-based logging in `/logs/`

### Key Components

#### Backend Routes (`/backend/routes/`)
- `auth.js` - Supabase authentication and user management
- `users.js` - User profiles, creator management, session handling
- `tokens.js` - Token economy, purchases, balance management
- `payments.js` - Stripe payment processing
- `agora.js` - Agora.io token generation for video/voice services

#### Frontend Components (`/frontend/src/components/`)
- `VideoCall.js` - Agora.io video/voice call implementation
- `Chat.js` - Real-time messaging during sessions
- `TokenPurchase.js` - Token purchasing interface
- `CreatorCard.js` - Creator discovery and session joining
- `SessionBilling.js` - Session cost calculation and billing
- `Auth.js` - Supabase authentication UI

#### Database Layer (`/backend/utils/`)
- `db.js` - PostgreSQL connection pool management
- `supabase.js` - Supabase client configuration
- `migrate.js` - Database migration system

## Development Commands

### Backend Development
```bash
cd backend
npm run dev          # Start development server with nodemon
npm run dev:debug    # Start with Node.js inspector
npm start           # Production start
npm run migrate     # Run database migrations
npm run migrate:down # Rollback migrations
npm run db:test     # Test database connection
npm run test        # Run Jest tests
npm run test:watch  # Run tests in watch mode
npm run lint        # ESLint code checking
npm run lint:fix    # Auto-fix linting issues
npm run logs        # Tail application logs
```

### Frontend Development
```bash
cd frontend
npm start           # Start development server
npm run build       # Production build
npm run test        # Run tests
npm run build:css   # Build Tailwind CSS
npm run dev:css     # Watch and build CSS
```

## Environment Configuration

### Backend Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (Supabase)
- `AGORA_APP_ID` - Agora.io application ID
- `AGORA_APP_CERTIFICATE` - Agora.io app certificate
- `STRIPE_SECRET_KEY` - Stripe secret key for payments
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key for admin operations
- `FRONTEND_URL` - Frontend URL for CORS configuration

### Frontend Environment Variables
- `VITE_BACKEND_URL` - Backend API URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key for client-side auth

## Database Schema

The application uses PostgreSQL with the following key tables:
- **users** - User profiles and creator information
- **sessions** - Video/voice call sessions with billing
- **tokens** - Token transactions and balance tracking
- **payments** - Payment history and Stripe integration

## Token Economy

- Users purchase tokens to interact with creators
- Token rates: ~$0.05 per token (configurable)
- Creators earn tokens from video calls, voice calls, and tips
- Sessions are billed per minute based on creator-set rates
- Real-time token balance updates via WebSocket

## Security Features

- Supabase Auth for secure authentication
- Helmet.js for security headers
- Rate limiting on sensitive endpoints
- CORS protection with whitelist
- Input validation and sanitization
- Secure database connections with SSL

## Testing

- Backend: Jest test framework with coverage reporting
- Frontend: React Testing Library with Jest
- Integration tests for API endpoints
- Database connection and migration testing

## Deployment

- **Backend**: Vercel deployment with `vercel.json` configuration
- **Frontend**: Vercel static build with React build artifacts
- **Database**: Supabase PostgreSQL hosting
- **Environment**: Production environment variables configured in deployment platform

## Development Notes

- All routes require Supabase authentication tokens
- Database migrations must be run before starting the application
- WebSocket connections are established for real-time features
- Agora.io tokens are generated server-side for security
- Payment processing is handled through Stripe webhooks
- Session billing is calculated based on duration and creator rates