const { createClient } = require('@supabase/supabase-js');
const { pool } = require('./utils/db');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function forceSyncNathan() {
  try {
    console.log('\n=== Force Syncing nathan@examodels.com ===\n');
    
    // Get user from database
    const dbResult = await pool.query(`
      SELECT 
        id, email, username, is_creator, role, creator_type,
        is_admin, is_super_admin, bio, profile_pic_url
      FROM users 
      WHERE email = $1
    `, ['nathan@examodels.com']);
    
    if (dbResult.rows.length === 0) {
      console.log('❌ User not found in database');
      return;
    }
    
    const dbUser = dbResult.rows[0];
    
    // Compute role
    const isCreator = dbUser.is_creator === true || 
                      dbUser.role === 'creator' || 
                      dbUser.creator_type != null;
    
    const isAdmin = dbUser.is_super_admin === true ||
                    dbUser.is_admin === true ||
                    dbUser.role === 'admin';
    
    console.log('Database user:');
    console.log('- is_creator:', dbUser.is_creator);
    console.log('- role:', dbUser.role);
    console.log('- creator_type:', dbUser.creator_type);
    console.log('\nComputed:');
    console.log('- isCreator:', isCreator);
    console.log('- isAdmin:', isAdmin);
    
    // Get Supabase user
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }
    
    const authUser = users.find(u => u.email === 'nathan@examodels.com');
    
    if (!authUser) {
      console.log('❌ User not found in Supabase Auth');
      return;
    }
    
    console.log('\nCurrent Supabase Auth metadata:');
    console.log(JSON.stringify(authUser.user_metadata, null, 2));
    
    // Update metadata
    console.log('\n🔄 Updating Supabase Auth metadata...');
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      {
        user_metadata: {
          isCreator: isCreator,
          isAdmin: isAdmin,
          username: dbUser.username,
          bio: dbUser.bio,
          profile_pic_url: dbUser.profile_pic_url
        }
      }
    );
    
    if (updateError) {
      console.error('❌ Error updating:', updateError);
    } else {
      console.log('\n✅ Metadata updated successfully!');
      console.log('\nNew metadata:');
      console.log(JSON.stringify(updateData.user.user_metadata, null, 2));
      console.log('\n🎉 Nathan should now see CREATOR interface!');
      console.log('\n📝 Next steps:');
      console.log('1. Hard refresh your browser (Cmd+Shift+R or Ctrl+Shift+R)');
      console.log('2. Or logout and login again');
      console.log('3. You should see the creator navigation!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

forceSyncNathan();
