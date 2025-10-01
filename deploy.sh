#!/bin/bash

# Digis Platform Deployment Script
# This script deploys both frontend and backend to Vercel

set -e

echo "🚀 Starting Digis Platform Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Vercel CLI is installed
if ! command_exists vercel; then
    echo -e "${RED}Error: Vercel CLI is not installed${NC}"
    echo "Please install it with: npm i -g vercel"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Parse arguments
DEPLOY_ENV=${1:-production}
SKIP_BUILD=${2:-false}

echo -e "${YELLOW}Deployment Environment: $DEPLOY_ENV${NC}"

# Build frontend if not skipped
if [ "$SKIP_BUILD" != "true" ]; then
    echo -e "${YELLOW}Building frontend...${NC}"
    cd frontend
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}Frontend build failed${NC}"
        exit 1
    fi
    cd ..
    echo -e "${GREEN}✓ Frontend build complete${NC}"
fi

# Deploy backend
echo -e "${YELLOW}Deploying backend to Vercel...${NC}"
cd backend

if [ "$DEPLOY_ENV" == "production" ]; then
    vercel --prod
else
    vercel
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}Backend deployment failed${NC}"
    exit 1
fi

cd ..
echo -e "${GREEN}✓ Backend deployed successfully${NC}"

# Deploy frontend
echo -e "${YELLOW}Deploying frontend to Vercel...${NC}"
cd frontend

if [ "$DEPLOY_ENV" == "production" ]; then
    vercel --prod
else
    vercel
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}Frontend deployment failed${NC}"
    exit 1
fi

cd ..
echo -e "${GREEN}✓ Frontend deployed successfully${NC}"

echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify your deployments in the Vercel dashboard"
echo "2. Test all critical functionality"
echo "3. Monitor logs for any issues"
echo ""
echo "To view your deployments:"
echo "  vercel ls"
echo ""
echo "To view logs:"
echo "  vercel logs [deployment-url]"