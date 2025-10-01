const express = require('express');
const path = require('path');
require('dotenv').config();

console.log('Testing individual routes...\n');

const routesToTest = [
  'auth', 'payments', 'users', 'tokens', 'agora', 'chat',
  'messages', 'notifications', 'subscriptions', 'gifts',
  'tips', 'polls', 'questions', 'badges', 'discovery',
  'goals', 'challenges', 'admin', 'analytics', 'moderation',
  'offers', 'streaming', 'collaborations', 'membership-tiers',
  'classes', 'creators', 'tv-subscription', 'connect',
  'creator-payouts', 'privacy'
];

const testRoute = (routeName) => {
  return new Promise((resolve) => {
    try {
      const app = express();
      const routePath = path.join(__dirname, 'routes', routeName);
      
      console.log(`Testing ${routeName}...`);
      
      // Try to require the route
      const route = require(routePath);
      
      // Try to use it
      app.use(`/api/${routeName}`, route);
      
      console.log(`✅ ${routeName} - Loaded successfully`);
      resolve({ route: routeName, status: 'success' });
    } catch (error) {
      console.log(`❌ ${routeName} - Error: ${error.message}`);
      resolve({ route: routeName, status: 'error', error: error.message });
    }
  });
};

async function testAllRoutes() {
  const results = [];
  
  for (const route of routesToTest) {
    const result = await testRoute(route);
    results.push(result);
  }
  
  console.log('\n📊 Summary:');
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed routes:');
    results.filter(r => r.status === 'error').forEach(r => {
      console.log(`  - ${r.route}: ${r.error}`);
    });
  }
  
  process.exit(0);
}

testAllRoutes();