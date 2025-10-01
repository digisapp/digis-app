// Load env first
require('dotenv').config();

const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testAdminEndpoints() {
  console.log('Testing Admin Endpoints...\n');
  
  // Login as admin
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@digis.cc',
    password: 'Admin123!'
  });
  
  if (authError) {
    console.error('❌ Failed to login:', authError.message);
    return;
  }
  
  const token = authData.session.access_token;
  console.log('✅ Logged in as admin\n');
  
  const baseUrl = 'http://localhost:3001/api/admin';
  const endpoints = [
    { path: '/creator-applications', name: 'Creator Applications' },
    { path: '/activity-feed', name: 'Activity Feed' },
    { path: '/analytics/dashboard', name: 'Analytics Dashboard' },
    { path: '/audit-logs', name: 'Audit Logs' },
    { path: '/moderation/reports', name: 'Moderation Reports' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.name}...`);
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${endpoint.name}: Success`);
        console.log(`   Data keys: ${Object.keys(data).join(', ')}`);
        
        // Show sample data
        if (data.applications) {
          console.log(`   Applications: ${data.applications.length}`);
        }
        if (data.activities) {
          console.log(`   Activities: ${data.activities.length}`);
        }
        if (data.metrics) {
          console.log(`   Metrics:`, data.metrics);
        }
      } else {
        const error = await response.text();
        console.log(`❌ ${endpoint.name}: Failed (${response.status})`);
        console.log(`   Error: ${error}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name}: Network error`);
      console.log(`   Error: ${error.message}`);
    }
    console.log('');
  }
  
  // Sign out
  await supabase.auth.signOut();
  console.log('✅ Test complete');
}

// Run tests
testAdminEndpoints().catch(console.error);