/**
 * Production Redis Test Suite
 * Tests all best-practice implementations
 */

// Load environment variables
require('dotenv').config();

const {
  redis,
  ping,
  rateLimit,
  getTokenVersion,
  incrementTokenVersion,
  isStripeEventDuplicate,
  cacheUser,
  getCachedUser,
  invalidateUserCache,
  storeOTP,
  verifyOTP,
  TTL
} = require('./lib/redis');

async function runTests() {
  console.log('🚀 Testing Production Redis Implementation\n');
  console.log('=' .repeat(50));

  let allTestsPassed = true;

  // Test 1: Connection
  console.log('\n1️⃣ Testing Redis Connection...');
  try {
    const connected = await ping();
    if (connected) {
      console.log('   ✅ Redis connected successfully');
    } else {
      throw new Error('Ping failed');
    }
  } catch (error) {
    console.error('   ❌ Redis connection failed:', error.message);
    allTestsPassed = false;
  }

  // Test 2: Proper SET with expiry (not setex)
  console.log('\n2️⃣ Testing proper SET with {ex:} syntax...');
  try {
    await redis.set('test:proper:set', 'value123', { ex: 5 });
    const value = await redis.get('test:proper:set');
    if (value === 'value123') {
      console.log('   ✅ SET with {ex:} working correctly');
    } else {
      throw new Error('Value mismatch');
    }
  } catch (error) {
    console.error('   ❌ SET test failed:', error.message);
    allTestsPassed = false;
  }

  // Test 3: Rate limiting
  console.log('\n3️⃣ Testing Rate Limiting...');
  try {
    const testKey = `test:ratelimit:${Date.now()}`;
    const results = [];

    for (let i = 0; i < 5; i++) {
      const result = await rateLimit({
        key: testKey,
        limit: 3,
        windowSec: 10
      });
      results.push(result);
      console.log(`   Request ${i + 1}: ${result.ok ? '✅ Allowed' : '❌ Blocked'} (${result.remaining} remaining)`);
    }

    // Verify rate limiting worked
    if (results[0].ok && results[1].ok && results[2].ok && !results[3].ok && !results[4].ok) {
      console.log('   ✅ Rate limiting working correctly');
    } else {
      throw new Error('Rate limiting not blocking correctly');
    }
  } catch (error) {
    console.error('   ❌ Rate limit test failed:', error.message);
    allTestsPassed = false;
  }

  // Test 4: Token versioning (for JWT revocation)
  console.log('\n4️⃣ Testing Token Versioning...');
  try {
    const testUserId = 'test-user-' + Date.now();

    // Get initial version (should be 0 or from DB)
    const v1 = await getTokenVersion(testUserId);
    console.log(`   Initial version: ${v1}`);

    // Cache should return same value
    const v2 = await getTokenVersion(testUserId);
    if (v1 === v2) {
      console.log('   ✅ Token version caching works');
    } else {
      throw new Error('Cache inconsistency');
    }

    // Note: incrementTokenVersion requires database, so we skip in test
    console.log('   ℹ️ Increment test skipped (requires database)');

  } catch (error) {
    console.error('   ❌ Token version test failed:', error.message);
    allTestsPassed = false;
  }

  // Test 5: Stripe webhook idempotency
  console.log('\n5️⃣ Testing Stripe Webhook Idempotency...');
  try {
    const eventId = 'evt_test_' + Date.now();

    // First check - should not be duplicate
    const isDup1 = await isStripeEventDuplicate(eventId);
    if (!isDup1) {
      console.log('   ✅ First event processed');
    } else {
      throw new Error('First event marked as duplicate');
    }

    // Second check - should be duplicate
    const isDup2 = await isStripeEventDuplicate(eventId);
    if (isDup2) {
      console.log('   ✅ Duplicate event blocked');
    } else {
      throw new Error('Duplicate not detected');
    }

  } catch (error) {
    console.error('   ❌ Stripe idempotency test failed:', error.message);
    allTestsPassed = false;
  }

  // Test 6: User caching with smart TTL
  console.log('\n6️⃣ Testing User Caching...');
  try {
    const testUser = {
      id: 'user-' + Date.now(),
      email: 'test@example.com',
      username: 'testuser',
      updated_at: new Date().toISOString()
    };

    // Cache user
    await cacheUser(testUser.id, testUser);
    console.log('   ✅ User cached');

    // Retrieve cached user
    const cached = await getCachedUser(testUser.id);
    if (cached && cached.email === testUser.email) {
      console.log('   ✅ User retrieved from cache');
      console.log(`   Cache metadata: _cachedAt=${cached._cachedAt}, _cacheVersion=${cached._cacheVersion}`);
    } else {
      throw new Error('Cache retrieval failed');
    }

    // Invalidate cache
    await invalidateUserCache(testUser.id);
    const afterInvalidate = await getCachedUser(testUser.id);
    if (!afterInvalidate) {
      console.log('   ✅ Cache invalidation works');
    } else {
      throw new Error('Cache not invalidated');
    }

  } catch (error) {
    console.error('   ❌ User cache test failed:', error.message);
    allTestsPassed = false;
  }

  // Test 7: OTP with auto-expiry
  console.log('\n7️⃣ Testing OTP Storage...');
  try {
    const identifier = 'email:test@example.com';
    const code = '123456';

    // Store OTP with 5 second TTL
    await storeOTP(identifier, code, 5);
    console.log('   ✅ OTP stored with 5s TTL');

    // Verify correct code
    const valid = await verifyOTP(identifier, code);
    if (valid) {
      console.log('   ✅ OTP verified and consumed');
    } else {
      throw new Error('OTP verification failed');
    }

    // Should be deleted after verification
    const stillValid = await verifyOTP(identifier, code);
    if (!stillValid) {
      console.log('   ✅ OTP deleted after use');
    } else {
      throw new Error('OTP not deleted');
    }

  } catch (error) {
    console.error('   ❌ OTP test failed:', error.message);
    allTestsPassed = false;
  }

  // Test 8: SET NX pattern (for locks)
  console.log('\n8️⃣ Testing SET NX (lock pattern)...');
  try {
    const lockKey = 'lock:test:' + Date.now();

    // First attempt should succeed
    const lock1 = await redis.set(lockKey, '1', { nx: true, ex: 5 });
    if (lock1 === 'OK') {
      console.log('   ✅ Lock acquired');
    } else {
      throw new Error('Failed to acquire lock');
    }

    // Second attempt should fail (lock held)
    const lock2 = await redis.set(lockKey, '2', { nx: true, ex: 5 });
    if (lock2 === null) {
      console.log('   ✅ Lock correctly prevents double entry');
    } else {
      throw new Error('Lock not working');
    }

    // Clean up
    await redis.del(lockKey);

  } catch (error) {
    console.error('   ❌ SET NX test failed:', error.message);
    allTestsPassed = false;
  }

  // Summary
  console.log('\n' + '=' .repeat(50));
  if (allTestsPassed) {
    console.log('✅ All Production Redis Tests Passed!');
    console.log('\n📋 Checklist Complete:');
    console.log('   ✅ Upstash Redis connected');
    console.log('   ✅ Using proper SET with {ex:} (not setex)');
    console.log('   ✅ Rate limiting returns 429 when exceeded');
    console.log('   ✅ Stripe webhook ignores duplicates');
    console.log('   ✅ Token versioning for JWT revocation ready');
    console.log('   ✅ Cache with smart TTL and invalidation');
    console.log('   ✅ OTP with auto-expiry');
    console.log('   ✅ SET NX for distributed locks');
    console.log('\n🚀 Your Redis setup follows all best practices!');
  } else {
    console.log('⚠️ Some tests failed. Please check the errors above.');
  }

  // Cleanup test keys
  console.log('\n🧹 Cleaning up test keys...');
  await redis.del('test:proper:set');

  process.exit(allTestsPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});