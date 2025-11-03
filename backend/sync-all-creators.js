const { pool } = require('./utils/db');
const { initializeSupabaseAdmin } = require('./utils/supabase-admin-v2');
require('dotenv').config();

async function syncAllCreators() {
  try {
    console.log('🔄 Syncing metadata for all creator accounts...\n');

    const admin = initializeSupabaseAdmin();

    // Get all creator accounts from database
    const result = await pool.query(`
      SELECT id, supabase_id, email, username, bio, profile_pic_url,
             is_creator, role, creator_type,
             is_admin, is_super_admin
      FROM users
      WHERE (is_creator = true OR role = 'creator' OR creator_type IS NOT NULL)
        AND supabase_id IS NOT NULL
      ORDER BY created_at DESC
    `);

    console.log(`Found ${result.rows.length} creator accounts\n`);
    console.log('='.repeat(80));

    let successCount = 0;
    let errorCount = 0;

    for (const user of result.rows) {
      try {
        console.log(`\n📝 Syncing: ${user.email}`);

        // Determine creator and admin status from database
        const isCreator = user.is_creator === true ||
                          user.role === 'creator' ||
                          user.creator_type != null;

        const isAdmin = user.is_super_admin === true ||
                        user.is_admin === true ||
                        user.role === 'admin';

        console.log(`   → Will set isCreator: ${isCreator}, isAdmin: ${isAdmin}`);
        console.log(`   → Using Supabase ID: ${user.supabase_id || user.id}`);

        // Update Supabase Auth user metadata - use supabase_id if available
        const authId = user.supabase_id || user.id;
        const { data, error } = await admin.auth.admin.updateUserById(authId, {
          user_metadata: {
            isCreator,
            isAdmin,
            username: user.username,
            bio: user.bio,
            profile_pic_url: user.profile_pic_url
          }
        });

        if (error) {
          console.log(`   ❌ Error: ${error.message}`);
          errorCount++;
        } else {
          console.log(`   ✅ Synced successfully`);
          successCount++;
        }

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Sync complete!`);
    console.log(`   Success: ${successCount}/${result.rows.length}`);
    console.log(`   Errors: ${errorCount}/${result.rows.length}`);

    if (successCount > 0) {
      console.log('\n💡 Creator accounts should now show the Creator menu!');
      console.log('   Try signing out and signing back in to see the changes.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

syncAllCreators();
