#!/bin/bash
# Smoke test for Digis backend after deployment
# Usage: ./smoke-test.sh https://your-preview.vercel.app

BASE_URL=${1:-"http://localhost:3005"}
JWT_TOKEN=${2:-"your-jwt-token-here"}

echo "🧪 Running Digis Backend Smoke Test"
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Health check
echo "1️⃣ Testing health endpoint..."
curl -s "$BASE_URL/health" | jq -r '.status' || echo "❌ Health check failed"
echo ""

# Test 2: Healthz endpoint (new)
echo "2️⃣ Testing healthz endpoint..."
curl -s "$BASE_URL/api/healthz" | jq -r '.ok' || echo "❌ Healthz failed"
echo ""

# Test 3: Database readiness
echo "3️⃣ Testing database readiness..."
curl -s "$BASE_URL/ready" | jq -r '.checks.database' || echo "❌ DB check failed"
echo ""

# Test 4: Redis cache (requires auth)
echo "4️⃣ Testing Redis-backed auth caching..."
curl -s "$BASE_URL/api/auth/sync-user" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq -r '.success' || echo "❌ Auth sync failed"
echo ""

# Test 5: Token balance (tests DB pool)
echo "5️⃣ Testing token balance endpoint..."
curl -s "$BASE_URL/api/tokens/balance" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq -r '.success' || echo "❌ Token balance failed"
echo ""

# Test 6: Stripe webhook (test idempotency)
echo "6️⃣ Testing webhook idempotency..."
echo "⚠️  Manual test required - send duplicate webhook from Stripe CLI"
echo ""

echo "✅ Smoke test complete!"
echo ""
echo "📊 Next steps:"
echo "   1. Check Vercel logs for Redis connection messages"
echo "   2. Monitor /api/healthz for pool stats"
echo "   3. Send test Stripe webhook to verify deduplication"
