const { pool } = require('./utils/db');
const { initializeSupabaseAdmin } = require('./utils/supabase-admin-v2');

async function ensureAdminUser() {
  try {
    const supabaseAdmin = initializeSupabaseAdmin();
    
    console.log('Ensuring admin user exists...\n');
    
    // Check if admin exists in database
    const dbCheck = await pool.query(
      "SELECT * FROM users WHERE email = 'admin@digis.cc'"
    );
    
    if (dbCheck.rows.length > 0) {
      console.log('✅ Admin user exists in database');
      console.log('Admin info:', {
        username: dbCheck.rows[0].username,
        is_super_admin: dbCheck.rows[0].is_super_admin,
        role: dbCheck.rows[0].role,
        supabase_id: dbCheck.rows[0].supabase_id
      });
      
      // Check if exists in Supabase Auth
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        console.error('Error listing users:', listError);
        return;
      }
      
      const adminAuthUser = authUsers.users.find(u => u.email === 'admin@digis.cc');
      
      if (!adminAuthUser) {
        console.log('\n❌ Admin user not found in Supabase Auth');
        console.log('Creating admin user in Supabase Auth...');
        
        // Create user in Supabase Auth
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: 'admin@digis.cc',
          password: 'Admin@Digis2024!',
          email_confirm: true,
          user_metadata: {
            username: 'admin',
            role: 'admin'
          }
        });
        
        if (createError) {
          console.error('Error creating admin user:', createError);
          return;
        }
        
        console.log('✅ Admin user created in Supabase Auth');
        console.log('Supabase ID:', newUser.user.id);
        
        // Update database with Supabase ID if different
        if (dbCheck.rows[0].supabase_id !== newUser.user.id) {
          await pool.query(
            'UPDATE users SET supabase_id = $1 WHERE email = $2',
            [newUser.user.id, 'admin@digis.cc']
          );
          console.log('✅ Updated database with Supabase ID');
        }
      } else {
        console.log('✅ Admin user exists in Supabase Auth');
        console.log('Supabase ID:', adminAuthUser.id);
        
        // Update database with correct Supabase ID if needed
        if (dbCheck.rows[0].supabase_id !== adminAuthUser.id) {
          await pool.query(
            'UPDATE users SET supabase_id = $1 WHERE email = $2',
            [adminAuthUser.id, 'admin@digis.cc']
          );
          console.log('✅ Updated database with correct Supabase ID');
        }
      }
    } else {
      console.log('❌ Admin user not found in database');
      console.log('Please run the SQL to create admin user first');
    }
    
    console.log('\n✅ Admin user check complete');
    console.log('Login credentials:');
    console.log('  Email: admin@digis.cc');
    console.log('  Password: Admin@Digis2024!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

ensureAdminUser();