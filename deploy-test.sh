#!/bin/bash

# Digis Test Deployment Script
# This deploys to Vercel for testing (not production)

set -e

echo "🚀 Digis Test Deployment to Vercel"
echo "===================================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
fi

echo "📦 Step 1: Deploy Backend"
echo "------------------------"
cd backend
echo "Current directory: $(pwd)"
echo ""
echo "This will deploy your backend with test credentials..."
echo "Press Enter to continue or Ctrl+C to cancel"
read

vercel --prod

echo ""
echo "✅ Backend deployed!"
echo "📝 Copy the URL shown above (it will look like: https://digis-backend-xxx.vercel.app)"
echo ""
echo "Paste your backend URL here: "
read BACKEND_URL

echo ""
echo "📦 Step 2: Deploy Frontend"
echo "------------------------"
cd ../frontend
echo "Current directory: $(pwd)"
echo ""
echo "⚠️  IMPORTANT: You'll need to add this environment variable in Vercel dashboard:"
echo "   VITE_BACKEND_URL = $BACKEND_URL"
echo ""
echo "Press Enter to continue..."
read

vercel --prod

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================="
echo ""
echo "📋 Next Steps:"
echo "1. Go to https://vercel.com/dashboard"
echo "2. Click on 'digis-frontend' project"
echo "3. Go to Settings → Environment Variables"
echo "4. Add: VITE_BACKEND_URL = $BACKEND_URL"
echo "5. Redeploy frontend (Deployments tab → Click '...' → Redeploy)"
echo ""
echo "Your backend: $BACKEND_URL"
echo "Your frontend: (will be shown in Vercel dashboard)"
echo ""
echo "💡 Both are running with TEST credentials - perfect for testing!"
