// Test script for Agora Chat REST API
const fetch = require('node-fetch');

const testAgoraChatAPI = async () => {
  const chatAppKey = '411305034#1504278';
  const chatOrgName = '411305034';
  const chatAppName = '1504278';
  const chatRestApi = 'a41.chat.agora.io';
  const chatAppToken = '007eJxTYHD4vUPaxWz9x8/JvzsN1kxQ8n1gVRIa3/hSNvPaOY1EC08FBlMz0xTT5LSURIOUJBNTC4vEFIM0sxRLg5Q0U1MTI5PUeUorMxoCGRnSpixjZWRgZWBkYGIA8RkYAL03Hkg=';
  
  const testUserId = `test_user_${Date.now()}`;
  
  console.log('🔧 Testing Agora Chat REST API...');
  console.log('AppKey:', chatAppKey);
  console.log('API URL:', chatRestApi);
  console.log('Test User ID:', testUserId);
  
  try {
    // Step 1: Try to register a test user
    console.log('\n📝 Step 1: Registering test user...');
    const registerUrl = `https://${chatRestApi}/${chatOrgName}/${chatAppName}/users`;
    
    const registerResponse = await fetch(registerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chatAppToken}`
      },
      body: JSON.stringify({
        username: testUserId,
        password: testUserId
      })
    });
    
    const registerData = await registerResponse.json();
    console.log('Registration Response:', registerResponse.status);
    console.log('Registration Data:', JSON.stringify(registerData, null, 2));
    
    // Step 2: Generate a token for the user
    console.log('\n🔑 Step 2: Generating user token...');
    const tokenUrl = `https://${chatRestApi}/${chatOrgName}/${chatAppName}/token`;
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chatAppToken}`
      },
      body: JSON.stringify({
        grant_type: 'password',
        username: testUserId,
        password: testUserId,
        ttl: 86400 // 24 hours
      })
    });
    
    const tokenData = await tokenResponse.json();
    console.log('Token Response:', tokenResponse.status);
    console.log('Token Data:', JSON.stringify(tokenData, null, 2));
    
    if (tokenData.access_token) {
      console.log('\n✅ SUCCESS! Agora Chat API is working correctly.');
      console.log('Access Token:', tokenData.access_token.substring(0, 50) + '...');
      console.log('Expires In:', tokenData.expires_in, 'seconds');
    } else {
      console.log('\n⚠️ Warning: Token generation succeeded but no access_token received');
    }
    
    // Step 3: Test getting app info
    console.log('\n📊 Step 3: Getting app info...');
    const appInfoUrl = `https://${chatRestApi}/${chatOrgName}/${chatAppName}`;
    
    const appInfoResponse = await fetch(appInfoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${chatAppToken}`
      }
    });
    
    if (appInfoResponse.ok) {
      const appInfo = await appInfoResponse.json();
      console.log('App Info:', JSON.stringify(appInfo, null, 2));
    }
    
  } catch (error) {
    console.error('\n❌ Error testing Agora Chat API:', error);
    console.error('Error details:', error.message);
  }
};

// Run the test
testAgoraChatAPI();