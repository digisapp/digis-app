#!/bin/bash

# Digis Deployment Validation Script
# Run this after deployment to verify all fixes are working

set -e

SITE_URL="${1:-https://digis.cc}"
BACKEND_URL="${2:-https://backend-nathans-projects-43dfdae0.vercel.app}"

echo "🔍 Validating Digis deployment at $SITE_URL"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

# 1. Check main page loads
echo "1️⃣  Checking main page..."
MAIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL")
if [ "$MAIN_STATUS" = "200" ]; then
  pass "Main page loads (200 OK)"
else
  fail "Main page returned $MAIN_STATUS"
fi
echo ""

# 2. Check index.html has no-cache headers
echo "2️⃣  Checking index.html caching..."
CACHE_CONTROL=$(curl -s -I "$SITE_URL" | grep -i "cache-control" | tr -d '\r')
if echo "$CACHE_CONTROL" | grep -qi "no-store"; then
  pass "index.html has no-store header"
else
  warn "index.html cache header: $CACHE_CONTROL"
  warn "Expected: no-store, no-cache, must-revalidate"
fi
echo ""

# 3. Check JavaScript MIME type
echo "3️⃣  Checking JavaScript MIME types..."
# Get the actual JS file from index.html
JS_FILE=$(curl -s "$SITE_URL" | grep -o '/assets/[^"]*\.js' | head -1)
if [ -n "$JS_FILE" ]; then
  MIME_TYPE=$(curl -s -I "$SITE_URL$JS_FILE" | grep -i "content-type" | tr -d '\r')
  if echo "$MIME_TYPE" | grep -qi "application/javascript\|text/javascript"; then
    pass "JavaScript files served with correct MIME type"
    echo "   File: $JS_FILE"
    echo "   $MIME_TYPE"
  else
    fail "JavaScript MIME type incorrect: $MIME_TYPE"
  fi
else
  warn "Could not find JS file in index.html"
fi
echo ""

# 4. Check asset caching
echo "4️⃣  Checking asset caching..."
if [ -n "$JS_FILE" ]; then
  ASSET_CACHE=$(curl -s -I "$SITE_URL$JS_FILE" | grep -i "cache-control" | tr -d '\r')
  if echo "$ASSET_CACHE" | grep -qi "max-age=31536000\|immutable"; then
    pass "Assets have long-term caching"
  else
    warn "Asset cache header: $ASSET_CACHE"
  fi
fi
echo ""

# 5. Check SPA fallback
echo "5️⃣  Checking SPA fallback routing..."
SPA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/explore")
if [ "$SPA_STATUS" = "200" ]; then
  pass "SPA routes work (/explore → 200)"
else
  fail "SPA route failed: /explore returned $SPA_STATUS"
fi
echo ""

# 6. Check 404 doesn't serve index.html
echo "6️⃣  Checking 404 handling for missing assets..."
MISSING_ASSET="$SITE_URL/assets/missing-file-$(date +%s).js"
MISSING_CONTENT=$(curl -s "$MISSING_ASSET" | head -c 50)
if echo "$MISSING_CONTENT" | grep -qi "<!DOCTYPE html"; then
  fail "404 assets are serving HTML (route order issue)"
else
  pass "404 assets return proper 404 (not HTML)"
fi
echo ""

# 7. Check backend health
echo "7️⃣  Checking backend health..."
BACKEND_HEALTH=$(curl -s "$BACKEND_URL/health" | grep -o '"status":"[^"]*"' || echo "")
if echo "$BACKEND_HEALTH" | grep -qi "healthy"; then
  pass "Backend is healthy"
else
  warn "Backend health check failed or returned unexpected response"
  warn "Response: $BACKEND_HEALTH"
fi
echo ""

# 8. Check auth endpoints (expect 401, not 500)
echo "8️⃣  Checking auth endpoints..."
AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/auth/session")
if [ "$AUTH_STATUS" = "401" ]; then
  pass "Auth endpoint returns 401 (not 500) - working correctly"
elif [ "$AUTH_STATUS" = "500" ]; then
  fail "Auth endpoint returns 500 - DATABASE_URL or env issue"
else
  warn "Auth endpoint returned $AUTH_STATUS (expected 401)"
fi
echo ""

# 9. Check API endpoints don't cache
echo "9️⃣  Checking API no-cache headers..."
API_CACHE=$(curl -s -I "$BACKEND_URL/api/healthz" | grep -i "cache-control" | tr -d '\r')
if echo "$API_CACHE" | grep -qi "no-store\|no-cache"; then
  pass "API endpoints have no-cache headers"
else
  warn "API cache header: $API_CACHE"
fi
echo ""

echo "=========================================="
echo -e "${GREEN}✓ Deployment validation complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "   1. Clear Service Worker cache in DevTools"
echo "   2. Hard refresh (Cmd/Ctrl+Shift+R)"
echo "   3. Test user flows (signup, login, etc.)"
echo ""
echo "💡 If you see issues:"
echo "   - Check Vercel deployment logs"
echo "   - Verify environment variables (vercel env ls)"
echo "   - Ensure DATABASE_URL uses direct connection (port 5432)"
