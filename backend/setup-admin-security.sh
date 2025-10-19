#!/bin/bash
set -e

echo "🔐 Digis Admin Security 2025 - Quick Setup"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from /backend directory"
  exit 1
fi

# Step 1: Install dependencies
echo "📦 Step 1: Installing dependencies..."
npm install express-rate-limit jsonwebtoken ip-range-check --save

# Step 2: Generate secrets
echo ""
echo "🔑 Step 2: Generating secrets..."
STEP_UP_SECRET=$(openssl rand -hex 32)
BREAK_GLASS_CODE=$(openssl rand -base64 24)

# Step 3: Update .env
echo ""
echo "📝 Step 3: Updating .env file..."

if [ ! -f ".env" ]; then
  echo "⚠️  No .env file found. Creating one..."
  touch .env
fi

# Backup existing .env
cp .env .env.backup-$(date +%Y%m%d-%H%M%S)

# Add admin security config
cat >> .env << EOF

# ============================================================================
# ADMIN SECURITY (2025) - Added $(date +%Y-%m-%d)
# ============================================================================

# Enable/disable admin security (use 'false' for emergency bypass only)
ADMIN_SECURITY_ENFORCED=true

# Admin session timeout (minutes)
ADMIN_SESSION_MINUTES=30

# Rate limiting
ADMIN_RATE_LIMIT_WINDOW_MS=60000  # 1 minute
ADMIN_RATE_LIMIT_MAX=60           # 60 requests per minute

# Step-up re-auth secret
STEP_UP_SECRET=$STEP_UP_SECRET

# Optional: IP allowlist (comma-separated)
ADMIN_ALLOWED_IPS=

# Optional: Break-glass bypass code (for emergencies)
BREAK_GLASS_CODE=$BREAK_GLASS_CODE

EOF

echo "✅ Environment variables added to .env"
echo ""
echo "⚠️  IMPORTANT: Add these to Vercel environment variables too!"
echo ""

# Step 4: Run migration
echo "🗄️  Step 4: Running database migration..."
echo ""
echo "Do you want to run the migration now? (y/n)"
read -r RUN_MIGRATION

if [ "$RUN_MIGRATION" = "y" ] || [ "$RUN_MIGRATION" = "Y" ]; then
  if [ -z "$DATABASE_URL" ]; then
    echo ""
    echo "Please enter your DATABASE_URL:"
    read -r DATABASE_URL
    export DATABASE_URL
  fi

  psql "$DATABASE_URL" -f migrations/016_admin_security_2025.sql

  echo ""
  echo "✅ Migration completed!"
else
  echo ""
  echo "⏭️  Skipped migration. Run it manually later:"
  echo "   psql \$DATABASE_URL -f migrations/016_admin_security_2025.sql"
fi

# Step 5: Summary
echo ""
echo "=========================================="
echo "✅ Admin Security Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Set admin role in Supabase Dashboard:"
echo "   Authentication → Users → Edit your user"
echo "   app_metadata: { \"role\": \"admin\", \"is_staff\": true }"
echo ""
echo "2. Update backend/routes/admin.js with security middlewares"
echo "   See: /FINISH_LINE_PLAN.md for exact code"
echo ""
echo "3. Create frontend/public/robots.txt:"
echo "   User-agent: *"
echo "   Disallow: /admin/"
echo ""
echo "4. Test with: npm run dev"
echo "   Then visit: http://localhost:3001/api/admin/health"
echo ""
echo "5. Deploy to Vercel:"
echo "   - Add env vars to Vercel dashboard"
echo "   - Run: vercel --prod"
echo ""
echo "📖 Full guide: /FINISH_LINE_PLAN.md"
echo ""
echo "🔑 Your secrets (save these securely):"
echo "   STEP_UP_SECRET: $STEP_UP_SECRET"
echo "   BREAK_GLASS_CODE: $BREAK_GLASS_CODE"
echo ""
echo "=========================================="
