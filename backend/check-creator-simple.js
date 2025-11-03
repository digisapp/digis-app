const { pool } = require('./utils/db');

async function checkCreatorStatus() {
  try {
    console.log('🔍 Checking creator accounts in database...\n');

    // Check all users with creator indicators
    const result = await pool.query(`
      SELECT id, email, username, is_creator, role, creator_type, is_admin, is_super_admin
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      console.log('❌ No users found in database');
      process.exit(0);
    }

    console.log('📊 Recent users:');
    console.log('='.repeat(80));
    result.rows.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.email || 'No email'}`);
      console.log(`   Username: ${user.username || 'Not set'}`);
      console.log(`   is_creator: ${user.is_creator}`);
      console.log(`   role: ${user.role || 'Not set'}`);
      console.log(`   creator_type: ${user.creator_type || 'Not set'}`);
      console.log(`   is_admin: ${user.is_admin}`);
      console.log(`   is_super_admin: ${user.is_super_admin}`);

      // Calculate what isCreator would be
      const isCreator = user.is_creator === true || user.role === 'creator' || user.creator_type != null;
      const isAdmin = user.is_super_admin === true || user.is_admin === true || user.role === 'admin';
      console.log(`   → Would be detected as Creator: ${isCreator ? '✅ YES' : '❌ NO'}`);
      console.log(`   → Would be detected as Admin: ${isAdmin ? '✅ YES' : '❌ NO'}`);
      console.log('-'.repeat(80));
    });

    console.log('\n💡 To fix a user not detected as creator, run:');
    console.log('   UPDATE users SET is_creator = true WHERE email = \'your@email.com\';');
    console.log('   or');
    console.log('   UPDATE users SET role = \'creator\' WHERE email = \'your@email.com\';');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCreatorStatus();
