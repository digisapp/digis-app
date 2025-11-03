const { initializeSupabaseAdmin } = require('./utils/supabase-admin-v2');
require('dotenv').config();

async function checkSupabaseMetadata() {
  try {
    console.log('🔍 Checking Supabase Auth metadata for creator accounts...\n');

    const admin = initializeSupabaseAdmin();

    // Get all users from Supabase Auth
    const { data: { users }, error } = await admin.auth.admin.listUsers();

    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }

    console.log(`Found ${users.length} users in Supabase Auth\n`);
    console.log('='.repeat(100));

    users.forEach((user, idx) => {
      console.log(`\n${idx + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   user_metadata:`, JSON.stringify(user.user_metadata, null, 4));

      const isCreator = user.user_metadata?.isCreator;
      const isAdmin = user.user_metadata?.isAdmin;

      console.log(`   → isCreator in metadata: ${isCreator ? '✅ true' : '❌ false or missing'}`);
      console.log(`   → isAdmin in metadata: ${isAdmin ? '✅ true' : '❌ false or missing'}`);
      console.log('-'.repeat(100));
    });

    // Check for specific creator emails
    console.log('\n\n🎯 Checking specific creator accounts:');
    const creatorEmails = ['creator@test.com', 'miriam@digis.cc', 'nathan@examodels.com', 'nathan@digis.cc'];

    for (const email of creatorEmails) {
      const user = users.find(u => u.email === email);
      if (user) {
        console.log(`\n${email}:`);
        console.log(`   Has isCreator metadata: ${user.user_metadata?.isCreator ? '✅ YES' : '❌ NO'}`);
        console.log(`   Metadata value: ${JSON.stringify(user.user_metadata)}`);
      } else {
        console.log(`\n${email}: ❌ Not found in Supabase Auth`);
      }
    }

    console.log('\n\n💡 To manually sync metadata for a specific user, run:');
    console.log('   curl -X POST http://localhost:5001/auth/sync-metadata \\');
    console.log('        -H "Authorization: Bearer YOUR_ACCESS_TOKEN"');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkSupabaseMetadata();
