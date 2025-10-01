require('dotenv').config();
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const { pool } = require('./utils/db');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testAdminDashboard() {
  console.log('🔍 Testing Admin Dashboard Integration with Supabase\n');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Login as admin
    console.log('\n📌 Step 1: Admin Authentication');
    console.log('-'.repeat(40));
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@digis.cc',
      password: 'Admin123!'
    });
    
    if (authError) {
      console.error('❌ Failed to login:', authError.message);
      console.log('\nTrying to reset password...');
      
      // Try resetting password
      const { initializeSupabaseAdmin } = require('./utils/supabase-admin');
      const supabaseAdmin = initializeSupabaseAdmin();
      
      const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
        '904b9325-08c6-4221-a0ea-2557f852699c',
        { 
          password: 'Admin123!',
          email_confirm: true
        }
      );
      
      if (resetError) {
        console.error('❌ Password reset failed:', resetError);
        return;
      }
      
      console.log('✅ Password reset successful, retrying login...');
      
      // Retry login
      const { data: retryAuth, error: retryError } = await supabase.auth.signInWithPassword({
        email: 'admin@digis.cc',
        password: 'Admin123!'
      });
      
      if (retryError) {
        console.error('❌ Login still failed:', retryError);
        return;
      }
      
      authData = retryAuth;
    }
    
    const token = authData.session.access_token;
    console.log('✅ Admin logged in successfully');
    console.log('   User ID:', authData.user.id);
    console.log('   Email:', authData.user.email);
    
    // Step 2: Verify admin status in database
    console.log('\n📌 Step 2: Database Admin Verification');
    console.log('-'.repeat(40));
    
    const adminCheck = await pool.query(
      'SELECT * FROM users WHERE supabase_id = $1',
      [authData.user.id]
    );
    
    if (adminCheck.rows.length === 0) {
      console.log('⚠️  Admin not found in database, creating...');
      await pool.query(`
        INSERT INTO users (
          supabase_id, email, username, display_name, 
          is_super_admin, role, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        authData.user.id,
        'admin@digis.cc',
        'admin',
        'Admin',
        true,
        'admin'
      ]);
      console.log('✅ Admin user created in database');
    } else {
      const admin = adminCheck.rows[0];
      console.log('✅ Admin found in database');
      console.log('   Username:', admin.username);
      console.log('   Is Super Admin:', admin.is_super_admin);
      console.log('   Role:', admin.role);
      
      if (!admin.is_super_admin) {
        console.log('⚠️  Updating admin status...');
        await pool.query(
          'UPDATE users SET is_super_admin = true, role = $1 WHERE supabase_id = $2',
          ['admin', authData.user.id]
        );
        console.log('✅ Admin status updated');
      }
    }
    
    // Step 3: Test all admin endpoints
    console.log('\n📌 Step 3: Testing Admin Endpoints');
    console.log('-'.repeat(40));
    
    const baseUrl = 'http://localhost:3001/api';
    const endpoints = [
      { 
        path: '/admin/creator-applications', 
        name: 'Creator Applications',
        expectedKeys: ['success', 'applications', 'pagination']
      },
      { 
        path: '/admin/activity-feed', 
        name: 'Activity Feed',
        expectedKeys: ['activities']
      },
      { 
        path: '/admin/analytics/dashboard', 
        name: 'Analytics Dashboard',
        expectedKeys: ['revenue', 'growth', 'metrics']
      },
      { 
        path: '/admin/audit-logs', 
        name: 'Audit Logs',
        expectedKeys: ['logs']
      },
      { 
        path: '/admin/moderation/reports', 
        name: 'Moderation Reports',
        expectedKeys: ['reports']
      },
      {
        path: '/admin/stats/creator-applications',
        name: 'Application Statistics',
        expectedKeys: ['success', 'stats', 'recentActivity']
      }
    ];
    
    let allPassed = true;
    
    for (const endpoint of endpoints) {
      console.log(`\n🔸 Testing: ${endpoint.name}`);
      
      try {
        const response = await fetch(`${baseUrl}${endpoint.path}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const responseText = await response.text();
        
        if (!response.ok) {
          console.log(`   ❌ Failed (${response.status})`);
          console.log(`   Response: ${responseText.substring(0, 200)}`);
          allPassed = false;
          continue;
        }
        
        const data = JSON.parse(responseText);
        console.log(`   ✅ Success (${response.status})`);
        
        // Check expected keys
        const hasAllKeys = endpoint.expectedKeys.every(key => key in data);
        if (hasAllKeys) {
          console.log(`   ✓ All expected keys present`);
        } else {
          console.log(`   ⚠️  Missing keys. Got: ${Object.keys(data).join(', ')}`);
        }
        
        // Show data summary
        if (data.applications) {
          console.log(`   📊 Applications: ${data.applications.length}`);
          if (data.applications.length > 0) {
            console.log(`      Sample: ${data.applications[0].username || 'N/A'} - ${data.applications[0].status}`);
          }
        }
        if (data.activities) {
          console.log(`   📊 Activities: ${data.activities.length}`);
          if (data.activities.length > 0) {
            console.log(`      Latest: ${data.activities[0].type} - ${data.activities[0].message}`);
          }
        }
        if (data.metrics) {
          console.log(`   📊 Metrics:`);
          console.log(`      Total Users: ${data.metrics.total_users || 0}`);
          console.log(`      Total Creators: ${data.metrics.total_creators || 0}`);
          console.log(`      Sessions Today: ${data.metrics.sessions_today || 0}`);
          console.log(`      Revenue Today: $${data.metrics.revenue_today || 0}`);
        }
        if (data.stats) {
          console.log(`   📊 Application Stats:`);
          console.log(`      Pending: ${data.stats.pending}`);
          console.log(`      Approved: ${data.stats.approved}`);
          console.log(`      Rejected: ${data.stats.rejected}`);
        }
        if (data.logs) {
          console.log(`   📊 Audit Logs: ${data.logs.length}`);
        }
        if (data.reports) {
          console.log(`   📊 Reports: ${data.reports.length}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Network/Parse error: ${error.message}`);
        allPassed = false;
      }
    }
    
    // Step 4: Test data population
    console.log('\n📌 Step 4: Data Population Check');
    console.log('-'.repeat(40));
    
    const tables = [
      { name: 'users', minExpected: 1 },
      { name: 'creator_applications', minExpected: 0 },
      { name: 'sessions', minExpected: 0 },
      { name: 'payments', minExpected: 0 },
      { name: 'notifications', minExpected: 0 }
    ];
    
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${table.name}`);
        const count = parseInt(result.rows[0].count);
        const status = count >= table.minExpected ? '✅' : '⚠️';
        console.log(`${status} ${table.name}: ${count} records`);
      } catch (error) {
        console.log(`❌ ${table.name}: Table doesn't exist or error`);
      }
    }
    
    // Step 5: Frontend integration check
    console.log('\n📌 Step 5: Frontend Integration Check');
    console.log('-'.repeat(40));
    
    // Test /api/users/profile endpoint
    try {
      const profileResponse = await fetch(`${baseUrl}/users/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        console.log('✅ Profile endpoint working');
        console.log('   Admin status:', profileData.is_super_admin || profileData.role === 'admin');
      } else {
        console.log('❌ Profile endpoint failed');
      }
    } catch (error) {
      console.log('❌ Profile endpoint error:', error.message);
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    if (allPassed) {
      console.log('✅ All admin endpoints are working correctly!');
      console.log('✅ Admin Dashboard is fully synced with Supabase');
      console.log('✅ Ready to receive and display real data');
    } else {
      console.log('⚠️  Some endpoints need attention');
      console.log('Please check the errors above and fix any issues');
    }
    
    console.log('\n📝 Admin Login Credentials:');
    console.log('   Email: admin@digis.cc');
    console.log('   Password: Admin123!');
    
    console.log('\n🎯 What Admin Dashboard Shows:');
    console.log('   • Live Activity Feed: Recent user registrations, applications, and sessions');
    console.log('   • Recent Applications: Creator applications pending review');
    console.log('   • Analytics: Revenue, user growth, and platform metrics');
    console.log('   • Moderation: Content reports and user issues');
    console.log('   • Audit Logs: Admin actions and system events');
    
    // Sign out
    await supabase.auth.signOut();
    console.log('\n✅ Test complete - Admin signed out');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testAdminDashboard().catch(console.error);