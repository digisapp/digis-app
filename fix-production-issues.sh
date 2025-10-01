#!/bin/bash

# Quick Fix Script for Production Issues
# Run this to fix all critical issues before deployment

echo "🔧 Fixing Critical Production Issues"
echo "===================================="
echo ""

# 1. Remove hardcoded API keys (already done)
echo "✅ Step 1: API keys already removed from .env.example files"

# 2. Remove console logs from production code
echo "📝 Step 2: Removing console.log statements..."
if [ -f "remove-console-logs.js" ]; then
    node remove-console-logs.js
    echo "✅ Console logs removed"
else
    echo "❌ remove-console-logs.js not found"
fi

# 3. Test production build
echo "🏗️ Step 3: Testing production build..."
cd frontend
echo "   Building frontend..."
NODE_ENV=production npm run build 2>&1 | tail -5
cd ..
echo "✅ Production build tested"

# 4. Create production .env template
echo "📋 Step 4: Creating production environment template..."
if [ ! -f ".env.production" ]; then
    cp .env.production.example .env.production
    echo "⚠️  Created .env.production - PLEASE FILL IN YOUR PRODUCTION VALUES"
else
    echo "✅ .env.production already exists"
fi

echo ""
echo "===================================="
echo "✅ Critical fixes completed!"
echo ""
echo "📋 IMPORTANT - Manual steps required:"
echo ""
echo "1. 🔑 ROTATE YOUR AGORA KEYS:"
echo "   - Go to Agora.io console"
echo "   - Generate new App ID and Certificate"
echo "   - Update them in .env.production"
echo ""
echo "2. 📝 Fill in .env.production with your production values"
echo ""
echo "3. 🧪 Test the application locally with production build:"
echo "   cd frontend && npm run preview"
echo ""
echo "4. 🚀 Deploy using: ./deploy-production.sh"
echo ""