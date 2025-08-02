# Digis - Creator Economy Platform

A full-stack platform connecting creators with their audience through video calls, live streaming, and a token-based economy.

## Features

- <¥ **Video/Voice Calls** - Powered by Agora.io
- =ú **Live Streaming** - Interactive streaming with chat
- =° **Token Economy** - Virtual currency for interactions
- =³ **Payments** - Stripe integration for purchases
- = **Authentication** - Secure auth with Supabase
- =ñ **Mobile Responsive** - PWA-ready design

## Tech Stack

### Frontend
- React 18 with Vite
- Tailwind CSS
- Agora.io SDK
- Supabase Client
- Framer Motion

### Backend
- Node.js + Express
- PostgreSQL (Supabase)
- Stripe API
- Socket.io
- Winston Logging

## Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL database (or Supabase account)
- Stripe account
- Agora.io account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/digisapp/digis-app.git
cd digis-app
```

2. Install dependencies:
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. Set up environment variables:
```bash
# Backend (.env)
cp backend/.env.example backend/.env
# Edit with your credentials

# Frontend (.env)
cp frontend/.env.example frontend/.env
# Edit with your credentials
```

4. Run database migrations:
```bash
cd backend
npm run migrate
```

5. Start the servers:
```bash
# Backend (in one terminal)
cd backend
npm run dev

# Frontend (in another terminal)
cd frontend
npm run dev
```

## Environment Variables

### Backend
- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `AGORA_APP_ID` - Agora.io app ID
- `AGORA_APP_CERTIFICATE` - Agora.io certificate

### Frontend
- `VITE_BACKEND_URL` - Backend API URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

## License

MIT

## Contributing

Pull requests are welcome. For major changes, please open an issue first.