#!/bin/bash

# Production Deployment Script for Digis Platform
# This script prepares and deploys the application to production

set -e  # Exit on error

echo "🚀 Digis Production Deployment Script"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Function to check environment variables
check_env() {
    if [ ! -f ".env.production" ]; then
        echo "❌ Error: .env.production file not found"
        echo "   Please copy .env.production.example to .env.production and fill in values"
        exit 1
    fi
    echo "✅ Production environment file found"
}

# Function to remove console logs
remove_console_logs() {
    echo "🧹 Removing console.log statements..."
    if [ -f "remove-console-logs.js" ]; then
        node remove-console-logs.js
        echo "✅ Console logs removed"
    else
        echo "⚠️  Console log removal script not found, skipping..."
    fi
}

# Function to build frontend
build_frontend() {
    echo "📦 Building frontend for production..."
    cd frontend

    # Clean previous builds
    rm -rf dist

    # Install dependencies
    npm ci --legacy-peer-deps

    # Build for production
    NODE_ENV=production npm run build

    # Check build size
    echo "📊 Build size analysis:"
    du -sh dist
    du -sh dist/assets/js/*.js | sort -h

    cd ..
    echo "✅ Frontend built successfully"
}

# Function to prepare backend
prepare_backend() {
    echo "🔧 Preparing backend..."
    cd backend

    # Install production dependencies only
    npm ci --production

    # Run database migrations
    echo "🗄️ Running database migrations..."
    npm run migrate

    cd ..
    echo "✅ Backend prepared"
}

# Function to run security checks
security_checks() {
    echo "🔒 Running security checks..."

    # Check for exposed secrets
    echo "   Checking for exposed secrets..."
    if grep -r "565d5cfda0db4588ad0f6d90df55424e\|dbad2a385798493390ac0c5b37344417" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null; then
        echo "❌ CRITICAL: Hardcoded API keys found in source code!"
        echo "   Please remove them before deploying"
        exit 1
    fi

    # Check for console.log in production code
    echo "   Checking for console.log statements..."
    CONSOLE_COUNT=$(grep -r "console.log" frontend/src --exclude-dir=node_modules | wc -l)
    if [ "$CONSOLE_COUNT" -gt 50 ]; then
        echo "⚠️  Warning: $CONSOLE_COUNT console.log statements found"
        echo "   Consider running: node remove-console-logs.js"
    fi

    echo "✅ Security checks passed"
}

# Function to create deployment package
create_package() {
    echo "📦 Creating deployment package..."

    # Create deployment directory
    rm -rf deployment
    mkdir -p deployment

    # Copy backend files
    cp -r backend deployment/
    rm -rf deployment/backend/node_modules
    rm -rf deployment/backend/.env*

    # Copy frontend build
    cp -r frontend/dist deployment/frontend-dist

    # Copy configuration files
    cp package.json deployment/
    cp .env.production.example deployment/

    # Create deployment info
    cat > deployment/DEPLOYMENT_INFO.txt << EOF
Digis Platform Deployment
========================
Build Date: $(date)
Version: 2.0.0
Node Version: $(node -v)
NPM Version: $(npm -v)

Deployment Steps:
1. Upload files to server
2. Set environment variables from .env.production.example
3. Install backend dependencies: cd backend && npm install --production
4. Run migrations: npm run migrate
5. Start server: npm start
6. Configure nginx/Apache to serve frontend-dist
EOF

    # Create tarball
    tar -czf digis-deployment-$(date +%Y%m%d-%H%M%S).tar.gz deployment/

    echo "✅ Deployment package created"
}

# Main deployment flow
main() {
    echo "Starting deployment process..."
    echo ""

    # Step 1: Environment check
    check_env

    # Step 2: Security checks
    security_checks

    # Step 3: Remove console logs
    remove_console_logs

    # Step 4: Build frontend
    build_frontend

    # Step 5: Prepare backend
    prepare_backend

    # Step 6: Create deployment package
    create_package

    echo ""
    echo "======================================"
    echo "✅ DEPLOYMENT PREPARATION COMPLETE!"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Review the deployment package"
    echo "2. Upload to your production server"
    echo "3. Set up environment variables"
    echo "4. Configure your web server (nginx/Apache)"
    echo "5. Set up SSL certificates"
    echo "6. Configure monitoring (Sentry)"
    echo ""
    echo "📦 Package: digis-deployment-*.tar.gz"
    echo ""
    echo "🚀 Good luck with your launch!"
}

# Run main function
main