#!/bin/bash
# Automated script to set Vercel environment variables

set -e

echo "🚀 Setting up Vercel environment variables for Digis Backend..."
echo ""

# Navigate to backend directory
cd "$(dirname "$0")"

# Function to set env var
set_env_var() {
  local name=$1
  local value=$2
  echo "Setting $name..."
  echo "$value" | vercel env add "$name" production --force
}

echo "📝 Setting SUPABASE_URL..."
echo "https://lpphsjowsivjtcmafxnj.supabase.co" | vercel env add SUPABASE_URL production --force

echo ""
echo "📝 Setting SUPABASE_ANON_KEY..."
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwcGhzam93c2l2anRjbWFmeG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDg5ODQsImV4cCI6MjA2ODEyNDk4NH0.QnkIphnDGyB5jsO1IEq3p2ZQYSrRbPhXI8Me9lnC-SM" | vercel env add SUPABASE_ANON_KEY production --force

echo ""
echo "📝 Setting SUPABASE_SERVICE_ROLE_KEY..."
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwcGhzam93c2l2anRjbWFmeG5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU0ODk4NCwiZXhwIjoyMDY4MTI0OTg0fQ.18aQNtkp5QCm99D6mZMbTWiKdlqyygdSZ02Kpm_oWuI" | vercel env add SUPABASE_SERVICE_ROLE_KEY production --force

echo ""
echo "✅ All environment variables set!"
echo ""
echo "🔄 Redeploying backend..."
vercel --prod

echo ""
echo "✨ Done! Wait 1-2 minutes for deployment, then try logging in as Miriam."
