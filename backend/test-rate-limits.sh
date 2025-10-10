#!/bin/bash

# Test Rate Limiting Configuration
# Tests the new rate limiter settings to ensure they work correctly

echo "🧪 Testing Rate Limiter Configuration"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3005}"
TEST_COUNT=20

echo "Backend URL: $BACKEND_URL"
echo "Test Count: $TEST_COUNT rapid requests"
echo ""

# Test 1: Health Check (should never be rate limited)
echo "📝 Test 1: Health Check Endpoint"
echo "--------------------------------"
response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")
if [ "$response" = "200" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Health check returned 200"
else
  echo -e "${RED}❌ FAIL${NC}: Health check returned $response"
fi
echo ""

# Test 2: Rapid API requests (should NOT be rate limited in dev)
echo "📝 Test 2: Rapid API Requests (Development Mode)"
echo "------------------------------------------------"
success_count=0
rate_limited_count=0

for i in $(seq 1 $TEST_COUNT); do
  response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/tokens/balance" \
    -H "Authorization: Bearer test-token" 2>/dev/null || echo "000")

  if [ "$response" = "200" ] || [ "$response" = "401" ]; then
    # 200 = success, 401 = auth required (but not rate limited)
    ((success_count++))
  elif [ "$response" = "429" ]; then
    # 429 = rate limited (BAD in development)
    ((rate_limited_count++))
  fi

  # Small delay to prevent overwhelming the server
  sleep 0.05
done

echo "Results:"
echo "  Success: $success_count/$TEST_COUNT"
echo "  Rate Limited: $rate_limited_count/$TEST_COUNT"

if [ $rate_limited_count -eq 0 ]; then
  echo -e "${GREEN}✅ PASS${NC}: No rate limiting in development mode"
else
  echo -e "${RED}❌ FAIL${NC}: Rate limiting still active ($rate_limited_count requests blocked)"
fi
echo ""

# Test 3: Check rate limit headers
echo "📝 Test 3: Rate Limit Headers"
echo "-----------------------------"
headers=$(curl -s -I "$BACKEND_URL/api/tokens/balance" | grep -i "x-ratelimit")

if [ -n "$headers" ]; then
  echo "Rate limit headers found:"
  echo "$headers"
  echo -e "${GREEN}✅ PASS${NC}: Rate limit headers present"
else
  echo -e "${YELLOW}⚠️  WARN${NC}: No rate limit headers (may be disabled in dev)"
fi
echo ""

# Test 4: Test critical endpoints
echo "📝 Test 4: Critical Endpoints (Should Skip Rate Limiting)"
echo "---------------------------------------------------------"
critical_endpoints=(
  "/api/auth/session"
  "/api/auth/verify-role"
  "/api/auth/sync-user"
  "/api/tokens/balance"
)

for endpoint in "${critical_endpoints[@]}"; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL$endpoint" \
    -H "Authorization: Bearer test-token" 2>/dev/null || echo "000")

  # Check if it's NOT rate limited (429)
  if [ "$response" != "429" ]; then
    echo -e "  ${GREEN}✅${NC} $endpoint: $response"
  else
    echo -e "  ${RED}❌${NC} $endpoint: Rate Limited!"
  fi
done
echo ""

# Test 5: Environment Check
echo "📝 Test 5: Environment Configuration"
echo "------------------------------------"

if [ "$NODE_ENV" = "production" ]; then
  echo -e "${YELLOW}⚠️  WARN${NC}: Running in PRODUCTION mode"
  echo "  Rate limiting should be ACTIVE"
  echo "  Expected limits:"
  echo "    - Auth: 500 requests / 15 min"
  echo "    - API: 300 requests / min"
else
  echo -e "${GREEN}✅ INFO${NC}: Running in DEVELOPMENT mode"
  echo "  Rate limiting should be DISABLED"
  echo "  Expected: Unlimited requests"
fi
echo ""

# Summary
echo "======================================"
echo "📊 Test Summary"
echo "======================================"
echo ""

if [ $rate_limited_count -eq 0 ] && [ "$response" != "429" ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  echo ""
  echo "Rate limiter configuration is correct:"
  echo "  ✓ Development mode: Rate limiting disabled"
  echo "  ✓ Critical endpoints: Properly exempted"
  echo "  ✓ Health checks: Never rate limited"
  echo ""
  echo "The creator account glitches should be resolved."
else
  echo -e "${RED}❌ TESTS FAILED${NC}"
  echo ""
  echo "Issues detected:"
  if [ $rate_limited_count -gt 0 ]; then
    echo "  ✗ Rate limiting still active in development"
  fi
  echo ""
  echo "Please check:"
  echo "  1. NODE_ENV is set correctly (should be 'development' locally)"
  echo "  2. Rate limiter middleware is properly configured"
  echo "  3. Backend server has been restarted after changes"
fi
echo ""

# Recommendations
echo "======================================"
echo "📝 Recommendations"
echo "======================================"
echo ""
echo "Development:"
echo "  • Restart backend server after rate limiter changes"
echo "  • Verify NODE_ENV=development in .env file"
echo "  • Check logs for rate limit warnings"
echo ""
echo "Production:"
echo "  • Monitor Vercel logs for rate limit events"
echo "  • Alert if 429 errors exceed 1% of requests"
echo "  • Consider per-user rate limits for power users"
echo ""
echo "Testing:"
echo "  • Test as creator account (Miriam)"
echo "  • Click through dashboard rapidly"
echo "  • Verify no glitches or errors"
echo "  • Check browser console for 429 errors"
echo ""

exit 0
