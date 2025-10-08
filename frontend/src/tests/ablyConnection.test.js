/**
 * Ably Connection Test
 *
 * Tests that the frontend can connect to Ably and authenticate properly.
 */

import ablyService from '../services/ablyService';

async function testAblyConnection() {
  console.log('🧪 Testing Ably Connection...\n');

  try {
    // Test 1: Connect to Ably
    console.log('1️⃣ Testing connection...');
    await ablyService.connect();
    console.log('✅ Connected successfully!\n');

    // Test 2: Get connection status
    console.log('2️⃣ Testing connection status...');
    const status = ablyService.getStatus();
    console.log('Status:', status);
    console.log('✅ Status check passed!\n');

    // Test 3: Update presence
    console.log('3️⃣ Testing presence update...');
    await ablyService.updatePresence('online');
    console.log('✅ Presence updated!\n');

    // Test 4: Join a test stream
    console.log('4️⃣ Testing stream join...');
    const streamResult = await ablyService.joinStream('test-stream-123');
    console.log('Stream result:', streamResult);
    console.log('✅ Stream joined!\n');

    // Test 5: Send a test message
    console.log('5️⃣ Testing message emission...');
    await ablyService.emit('test-message', {
      streamId: 'test-stream-123',
      text: 'Hello from Ably test!',
      timestamp: Date.now()
    });
    console.log('✅ Message sent!\n');

    // Test 6: Leave stream
    console.log('6️⃣ Testing stream leave...');
    await ablyService.leaveStream('test-stream-123');
    console.log('✅ Stream left!\n');

    console.log('🎉 All tests passed!');
    console.log('\nFinal status:', ablyService.getStatus());

    // Cleanup
    setTimeout(() => {
      console.log('\n🧹 Cleaning up...');
      ablyService.disconnect();
      console.log('✅ Disconnected');
    }, 2000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
    throw error;
  }
}

// Run test if executed directly
if (typeof window !== 'undefined') {
  window.testAblyConnection = testAblyConnection;
  console.log('💡 Run testAblyConnection() in console to test Ably connection');
}

export default testAblyConnection;
