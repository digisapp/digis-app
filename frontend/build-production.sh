#!/bin/bash

echo "🚀 Building Digis for production deployment..."

# Set production environment
export NODE_ENV=production
export VITE_MODE=production

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist

# Install dependencies if needed
echo "📦 Checking dependencies..."
npm ci --prefer-offline --no-audit

# Build the application
echo "🔨 Building production bundle..."
npm run build

# Verify build completed successfully
if [ -d "dist" ]; then
    echo "✅ Production build completed successfully!"
    echo "📁 Build output in: dist/"
    echo ""
    echo "🎯 Next steps for deployment:"
    echo "1. Test the build locally: npm run preview"
    echo "2. Deploy the 'dist' folder to your hosting service"
    echo ""
    echo "⚠️  Production build features:"
    echo "• All console outputs suppressed"
    echo "• Error messages hidden from users"
    echo "• Source maps disabled"
    echo "• Code minified and optimized"
    echo "• Clean error fallback UI"
else
    echo "❌ Build failed. Please check the error messages above."
    exit 1
fi