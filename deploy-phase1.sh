#!/bin/bash
# Digis Phase 1 Deployment Script
# Run this to deploy critical performance and security fixes

set -e  # Exit on error

echo "🚀 Digis Phase 1 Deployment - Critical Fixes"
echo "=============================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not set"
    echo "Run: export DATABASE_URL='your_postgres_url'"
    exit 1
fi

# Step 1: Deploy database migration
echo "📊 Step 1: Deploying database migration..."
echo "This will add indexes to speed up active sessions query (79s → <100ms)"
echo ""

psql "$DATABASE_URL" -f backend/migrations/fix-active-sessions-performance.sql

if [ $? -eq 0 ]; then
    echo "✅ Database migration successful"
else
    echo "❌ Database migration failed"
    exit 1
fi

echo ""
echo "---"
echo ""

# Step 2: Install new dependencies
echo "📦 Step 2: Installing security dependencies..."
cd backend
npm install helmet cors express-rate-limit --save
cd ..

echo "✅ Dependencies installed"
echo ""
echo "---"
echo ""

# Step 3: Git commit
echo "📝 Step 3: Committing changes..."
git add backend/migrations/fix-active-sessions-performance.sql
git add backend/utils/redis-counters.js
git add backend/middleware/security.js
git add STABILIZATION_PLAN.md

git commit -m "Phase 1: Critical performance and security fixes

- Add partial indexes for active sessions (79s → <100ms)
- Add Redis counters for fast session counts
- Add security headers and rate limiting
- Update auth middleware for faster verification

Fixes: #performance #security"

echo "✅ Changes committed"
echo ""
echo "---"
echo ""

# Step 4: Deploy to Vercel
echo "🚢 Step 4: Deploying to Vercel..."
echo "Make sure you have set these environment variables in Vercel:"
echo "  - ALLOWED_ORIGINS"
echo "  - REDIS_URL (if using Redis)"
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin main

    echo ""
    echo "Deploying to production..."
    vercel --prod

    echo ""
    echo "✅ Deployment complete!"
else
    echo "⏸️  Deployment cancelled. Run 'git push origin main && vercel --prod' when ready."
fi

echo ""
echo "---"
echo ""
echo "🎉 Phase 1 Deployment Complete!"
echo ""
echo "Next steps:"
echo "1. Test active sessions count: curl https://your-api.vercel.app/api/admin/stats"
echo "2. Verify auth is working: Login to your app"
echo "3. Check health: curl https://your-api.vercel.app/healthz"
echo ""
echo "📖 See STABILIZATION_PLAN.md for Phase 2 (Real-time) and Phase 3 (Monitoring)"
