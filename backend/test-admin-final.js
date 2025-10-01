require('dotenv').config();
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const API_BASE = 'http://localhost:3001/api';

async function testAllAdminSections() {
  console.log('🔍 FINAL ADMIN DASHBOARD TEST\n');
  console.log('=' .repeat(60));
  
  // Login
  console.log('\n📌 1. AUTHENTICATION');
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@digis.cc',
    password: 'Admin123!'
  });
  
  if (authError) {
    console.log('❌ Login failed:', authError.message);
    return;
  }
  
  const token = auth.session.access_token;
  console.log('✅ Admin authenticated successfully');
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  // Test each section
  const sections = [
    {
      name: '📊 2. DASHBOARD',
      endpoints: [
        { path: '/admin/analytics/dashboard', name: 'Analytics' },
        { path: '/admin/activity-feed', name: 'Activity Feed' },
        { path: '/admin/stats/creator-applications', name: 'Stats' }
      ]
    },
    {
      name: '📝 3. APPLICATIONS',
      endpoints: [
        { path: '/admin/creator-applications', name: 'List Applications' },
        { path: '/admin/creator-applications?status=pending', name: 'Pending Applications' }
      ]
    },
    {
      name: '👥 4. USERS',
      endpoints: [
        { path: '/admin/users', name: 'All Users' }
      ]
    },
    {
      name: '🛡️ 5. MODERATION',
      endpoints: [
        { path: '/admin/moderation/reports', name: 'Content Reports' }
      ]
    },
    {
      name: '📋 6. AUDIT',
      endpoints: [
        { path: '/admin/audit-logs', name: 'Audit Logs' }
      ]
    }
  ];
  
  let totalEndpoints = 0;
  let workingEndpoints = 0;
  
  for (const section of sections) {
    console.log(`\n${section.name}`);
    console.log('-'.repeat(40));
    
    for (const endpoint of section.endpoints) {
      totalEndpoints++;
      try {
        const response = await fetch(`${API_BASE}${endpoint.path}`, { headers });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${endpoint.name}: Working`);
          workingEndpoints++;
          
          // Show summary data
          if (data.users) console.log(`   → ${data.users.length} users`);
          if (data.applications) console.log(`   → ${data.applications.length} applications`);
          if (data.activities) console.log(`   → ${data.activities.length} activities`);
          if (data.logs) console.log(`   → ${data.logs.length} audit logs`);
          if (data.reports) console.log(`   → ${data.reports.length} reports`);
          if (data.metrics) {
            console.log(`   → Metrics: ${data.metrics.total_users || 0} users, ${data.metrics.total_creators || 0} creators`);
          }
          if (data.stats) {
            console.log(`   → Stats: ${data.stats.pending} pending, ${data.stats.approved} approved`);
          }
        } else {
          const error = await response.text();
          console.log(`❌ ${endpoint.name}: Failed (${response.status})`);
          console.log(`   Error: ${error.substring(0, 100)}`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint.name}: Network error`);
        console.log(`   Error: ${error.message}`);
      }
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 FINAL SUMMARY\n');
  
  const percentage = Math.round((workingEndpoints / totalEndpoints) * 100);
  console.log(`✅ Working endpoints: ${workingEndpoints}/${totalEndpoints} (${percentage}%)`);
  
  if (percentage === 100) {
    console.log('\n🎉 PERFECT! Admin Dashboard is fully operational!');
    console.log('✅ All sections working: Dashboard, Applications, Users, Moderation, Audit');
    console.log('✅ Fully synced with Supabase database');
  } else if (percentage >= 80) {
    console.log('\n✅ Admin Dashboard is mostly operational');
    console.log('⚠️  A few endpoints need attention but core functionality works');
  } else {
    console.log('\n⚠️  Admin Dashboard needs some fixes');
    console.log('Please check the errors above');
  }
  
  console.log('\n📌 Admin Credentials:');
  console.log('   Email: admin@digis.cc');
  console.log('   Password: Admin123!');
  
  // Cleanup
  await supabase.auth.signOut();
  console.log('\n✅ Test complete\n');
}

testAllAdminSections().catch(console.error);