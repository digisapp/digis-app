#!/bin/bash

# Bi-Monthly Withdrawal System Setup Script
# Run this to complete the deployment

set -e  # Exit on error

echo "========================================="
echo "Bi-Monthly Withdrawal System Setup"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must run from backend directory${NC}"
    exit 1
fi

# Step 1: Check for DATABASE_URL
echo -e "${YELLOW}Step 1: Checking DATABASE_URL...${NC}"
if [ -z "$DATABASE_URL" ] && [ ! -f ".env" ]; then
    echo -e "${RED}Error: DATABASE_URL not set and no .env file found${NC}"
    echo ""
    echo "Please create a .env file with your database credentials:"
    echo ""
    echo "DATABASE_URL=postgresql://username:password@host:5432/database"
    echo ""
    echo "Or set individual DB variables:"
    echo "DB_USER=..."
    echo "DB_PASSWORD=..."
    echo "DB_HOST=..."
    echo "DB_NAME=..."
    echo ""
    exit 1
fi

if [ -f ".env" ]; then
    source .env
fi

if [ -z "$DATABASE_URL" ] && [ -z "$DB_USER" ]; then
    echo -e "${RED}Error: No database configuration found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Database configuration found${NC}"
echo ""

# Step 2: Test database connection
echo -e "${YELLOW}Step 2: Testing database connection...${NC}"
npm run db:test || {
    echo -e "${RED}Error: Database connection failed${NC}"
    echo "Please check your DATABASE_URL and ensure the database is accessible"
    exit 1
}
echo -e "${GREEN}✓ Database connection successful${NC}"
echo ""

# Step 3: Run migration
echo -e "${YELLOW}Step 3: Running database migration...${NC}"
echo "This will create:"
echo "  - withdrawal_requests table"
echo "  - creator_payout_history view"
echo "  - get_creator_earnings_summary() function"
echo "  - get_pending_payouts_for_date() function"
echo ""
read -p "Continue with migration? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration skipped"
    exit 0
fi

npm run migrate || {
    echo -e "${RED}Error: Migration failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Migration completed successfully${NC}"
echo ""

# Step 4: Verify tables were created
echo -e "${YELLOW}Step 4: Verifying database schema...${NC}"
node -e "
const { pool } = require('./utils/db');
(async () => {
    try {
        const result = await pool.query(\`
            SELECT table_name FROM information_schema.tables
            WHERE table_name IN ('withdrawal_requests')
            AND table_schema = 'public'
        \`);
        if (result.rows.length > 0) {
            console.log('✓ withdrawal_requests table created');
        } else {
            console.log('✗ withdrawal_requests table not found');
            process.exit(1);
        }
        await pool.end();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
" || {
    echo -e "${RED}Error: Schema verification failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Schema verified${NC}"
echo ""

# Step 5: Check Stripe configuration
echo -e "${YELLOW}Step 5: Checking Stripe configuration...${NC}"
if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo -e "${YELLOW}Warning: STRIPE_SECRET_KEY not set${NC}"
    echo "You'll need to add this to process payouts:"
    echo "  STRIPE_SECRET_KEY=sk_test_... (or sk_live_...)"
else
    echo -e "${GREEN}✓ Stripe configuration found${NC}"
fi
echo ""

# Step 6: Summary
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Set up cron job for automated payouts:"
echo "   • Vercel: Add cron configuration to vercel.json"
echo "   • VPS: Add to crontab (0 2 1,15 * * npm run payout:run)"
echo "   • Node.js: Import utils/scheduler.js in api/index.js"
echo ""
echo "2. Configure Stripe Connect:"
echo "   • Enable Stripe Connect in dashboard"
echo "   • Test creator onboarding flow"
echo "   • POST /api/stripe-connect/create-account"
echo "   • POST /api/stripe-connect/onboarding-link"
echo ""
echo "3. Test the withdrawal system:"
echo "   • GET /api/tokens/earnings (view available balance)"
echo "   • POST /api/tokens/request-withdrawal (create request)"
echo "   • GET /api/tokens/withdrawal-requests (view requests)"
echo ""
echo "4. Manual payout test:"
echo "   • npm run payout:test"
echo ""
echo "Documentation:"
echo "  • WITHDRAWAL_SYSTEM.md - Complete system documentation"
echo "  • DEPLOYMENT_STEPS.md - Detailed deployment guide"
echo ""
echo -e "${GREEN}Ready to accept withdrawal requests!${NC}"
echo ""
