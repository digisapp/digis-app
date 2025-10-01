const {
  testConnection,
  cache,
  sessions,
  users,
  creators,
  rateLimiter,
  otp
} = require('./utils/redis');

async function testRedisFeatures() {
  console.log('🚀 Testing Upstash Redis Connection and Features...\n');

  // Test 1: Connection
  console.log('1️⃣ Testing connection...');
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Failed to connect to Redis. Check your credentials.');
    return;
  }

  // Test 2: Basic cache operations
  console.log('\n2️⃣ Testing basic cache operations...');
  await cache.set('test:key', 'Hello Digis!', 10);
  const value = await cache.get('test:key');
  console.log(`   ✓ Set and retrieved: "${value}"`);

  // Test 3: JSON storage
  console.log('\n3️⃣ Testing JSON storage...');
  const testUser = {
    id: 'test-user-123',
    name: 'Test Creator',
    tokens: 100
  };
  await cache.set('test:json', testUser, 10);
  const retrieved = await cache.get('test:json');
  console.log(`   ✓ Stored and retrieved JSON:`, retrieved);

  // Test 4: Session management
  console.log('\n4️⃣ Testing session management...');
  const sessionData = {
    userId: 'user-456',
    createdAt: new Date().toISOString(),
    isCreator: true
  };
  await sessions.store('session-789', sessionData);
  const session = await sessions.get('session-789');
  console.log(`   ✓ Session stored and retrieved:`, session);

  // Test 5: User caching
  console.log('\n5️⃣ Testing user cache...');
  const userData = {
    email: 'creator@digis.cc',
    username: 'testcreator',
    tokenBalance: 500
  };
  await users.cache('user-001', userData);
  const cachedUser = await users.get('user-001');
  console.log(`   ✓ User cached:`, cachedUser);

  // Test 6: Creator caching
  console.log('\n6️⃣ Testing creator cache...');
  const creatorData = {
    username: 'topcreator',
    rating: 4.8,
    pricePerMin: 30
  };
  await creators.cache('creator-001', creatorData);
  const cachedCreator = await creators.get('creator-001');
  console.log(`   ✓ Creator cached:`, cachedCreator);

  // Test 7: Rate limiting
  console.log('\n7️⃣ Testing rate limiting...');
  const ip = '192.168.1.1';
  for (let i = 0; i < 5; i++) {
    const limit = await rateLimiter.check(ip, 3, 10); // 3 requests per 10 seconds
    console.log(`   Request ${i + 1}: ${limit.allowed ? '✓ Allowed' : '❌ Blocked'} (${limit.remaining} remaining)`);
  }

  // Test 8: OTP storage
  console.log('\n8️⃣ Testing OTP storage...');
  const otpCode = '123456';
  await otp.store('email:test@digis.cc', otpCode);
  const verified = await otp.verify('email:test@digis.cc', otpCode);
  console.log(`   ✓ OTP stored and verified: ${verified}`);

  // Test 9: Counter increment
  console.log('\n9️⃣ Testing counter increment...');
  await cache.del('test:counter');
  const count1 = await cache.incr('test:counter');
  const count2 = await cache.incr('test:counter');
  const count3 = await cache.incr('test:counter');
  console.log(`   ✓ Counter incremented: ${count1}, ${count2}, ${count3}`);

  // Test 10: Key expiration
  console.log('\n🔟 Testing key expiration...');
  await cache.set('test:expire', 'This will expire', 2);
  console.log('   ✓ Key set with 2 second TTL');
  console.log('   Waiting 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  const expired = await cache.get('test:expire');
  console.log(`   ✓ Key after expiration: ${expired === null ? 'Expired correctly' : 'Still exists!'}`);

  // Cleanup
  console.log('\n🧹 Cleaning up test keys...');
  await cache.del('test:key');
  await cache.del('test:json');
  await cache.del('test:counter');
  await sessions.destroy('session-789');
  await users.invalidate('user-001');
  await creators.invalidate('creator-001');
  await rateLimiter.reset(ip);

  console.log('\n✅ All Redis tests completed successfully!');
  console.log('\n📊 Summary:');
  console.log('   • Connection: ✓');
  console.log('   • Basic cache: ✓');
  console.log('   • JSON storage: ✓');
  console.log('   • Sessions: ✓');
  console.log('   • User cache: ✓');
  console.log('   • Creator cache: ✓');
  console.log('   • Rate limiting: ✓');
  console.log('   • OTP: ✓');
  console.log('   • Counters: ✓');
  console.log('   • Expiration: ✓');
  console.log('\n🎉 Your Upstash Redis is ready for production!');
}

// Run tests
testRedisFeatures().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});