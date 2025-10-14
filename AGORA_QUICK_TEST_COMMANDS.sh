#!/bin/bash
#
# Agora Privacy Calls - Quick Test Commands
# Run these to verify your integration
#

# =============================================================================
# SETUP
# =============================================================================

# Set your environment
export API_BASE="http://localhost:3000"
export CREATOR_JWT="your_creator_jwt_token_here"
export FAN_JWT="your_fan_jwt_token_here"
export CREATOR_ID="creator_supabase_id_here"
export FAN_ID="fan_supabase_id_here"

# =============================================================================
# TEST 1: Initiate Call (Creator → Fan)
# =============================================================================

echo "🧪 Test 1: Initiating call..."
CALL_RESPONSE=$(curl -s -X POST $API_BASE/api/calls/initiate \
  -H "Authorization: Bearer $CREATOR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "fanId": "'$FAN_ID'",
    "callType": "video",
    "message": "Test call"
  }')

echo "$CALL_RESPONSE" | jq

# Extract callId for next tests
export CALL_ID=$(echo "$CALL_RESPONSE" | jq -r '.callId')
echo "📝 Call ID: $CALL_ID"

# Expected: {"success":true,"callId":"uuid","channel":"call_...","state":"ringing"}

# =============================================================================
# TEST 2: Get Pending Invitations (Fan)
# =============================================================================

echo ""
echo "🧪 Test 2: Getting pending invitations..."
curl -s -H "Authorization: Bearer $FAN_JWT" \
  $API_BASE/api/calls/pending | jq

# Expected: {"invitations":[{...}]}

# =============================================================================
# TEST 3: Accept Call (Fan)
# =============================================================================

echo ""
echo "🧪 Test 3: Accepting call..."
curl -s -X POST $API_BASE/api/calls/$CALL_ID/accept \
  -H "Authorization: Bearer $FAN_JWT" | jq

# Expected: {"success":true,"token":"006...","appId":"...","uid":12345}

# =============================================================================
# TEST 4: Check Call Status
# =============================================================================

echo ""
echo "🧪 Test 4: Checking call status..."
curl -s -H "Authorization: Bearer $CREATOR_JWT" \
  $API_BASE/api/calls/$CALL_ID/status | jq

# Expected: {"state":"connected","callType":"video",...}

# =============================================================================
# TEST 5: End Call (Either Party)
# =============================================================================

echo ""
echo "🧪 Test 5: Ending call..."
curl -s -X POST $API_BASE/api/calls/$CALL_ID/end \
  -H "Authorization: Bearer $FAN_JWT" | jq

# Expected: {"success":true,"durationSeconds":45,"totalCost":1.00}

# =============================================================================
# TEST 6: Get Call History
# =============================================================================

echo ""
echo "🧪 Test 6: Getting call history..."
curl -s -H "Authorization: Bearer $CREATOR_JWT" \
  $API_BASE/api/calls/history | jq

# Expected: {"calls":[{"id":"uuid","state":"ended",...}]}

# =============================================================================
# TEST 7: Test Cooldown (Should fail with 429)
# =============================================================================

echo ""
echo "🧪 Test 7: Testing call cooldown (should fail)..."
curl -i -X POST $API_BASE/api/calls/initiate \
  -H "Authorization: Bearer $CREATOR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "fanId": "'$FAN_ID'",
    "callType": "video"
  }' 2>&1 | grep -E "HTTP/|code|error"

# Expected: 429 with {"code":"CALL_COOLDOWN","retryAfter":60}

# =============================================================================
# TEST 8: Test Feature Flag (Requires manual .env edit)
# =============================================================================

echo ""
echo "🧪 Test 8: To test feature flag:"
echo "  1. Set FEATURE_CALLS=false in backend/.env"
echo "  2. Restart backend"
echo "  3. Run: curl -X POST $API_BASE/api/calls/initiate ..."
echo "  4. Expected: 403 with {\"code\":\"FEATURE_DISABLED\"}"

# =============================================================================
# DATABASE CHECKS
# =============================================================================

echo ""
echo "📊 Database checks (run these manually):"
echo ""
echo "# Check tables exist:"
echo "psql \$DATABASE_URL -c \"\\dt\" | grep -E \"calls|call_invitations|creator_fan_relationships\""
echo ""
echo "# Check call record:"
echo "psql \$DATABASE_URL -c \"SELECT * FROM calls WHERE id = '$CALL_ID';\""
echo ""
echo "# Check billing:"
echo "psql \$DATABASE_URL -c \"SELECT state, duration_seconds, total_cost FROM calls WHERE id = '$CALL_ID';\""
echo ""
echo "# Call statistics:"
echo "psql \$DATABASE_URL -c \"SELECT state, COUNT(*) FROM calls GROUP BY state;\""

# =============================================================================
# SOCKET.IO TEST
# =============================================================================

echo ""
echo "🔌 To test Socket.io real-time events:"
echo "  1. Open frontend/test-socket.html in browser"
echo "  2. Replace FAN_JWT and FAN_ID in the file"
echo "  3. Open browser console"
echo "  4. Run: curl -X POST $API_BASE/api/calls/initiate ... (as creator)"
echo "  5. Expected: Browser console shows '📞 INCOMING CALL: {...}'"

echo ""
echo "✅ All test commands ready!"
echo ""
echo "Quick reference:"
echo "  CALL_ID: $CALL_ID"
echo "  API_BASE: $API_BASE"
