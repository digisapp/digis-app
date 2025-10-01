const { pool } = require('./utils/db');

async function checkAdminRole() {
  try {
    console.log('Checking admin users in database...\n');
    
    // Check for admin users
    const adminQuery = `
      SELECT 
        email, 
        username, 
        is_creator, 
        is_super_admin, 
        role,
        supabase_id
      FROM users 
      WHERE 
        email LIKE '%admin%' 
        OR is_super_admin = true 
        OR role = 'admin'
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const adminResult = await pool.query(adminQuery);
    
    if (adminResult.rows.length === 0) {
      console.log('No admin users found in database');
    } else {
      console.log('Admin users found:');
      console.table(adminResult.rows);
    }
    
    // Check if there's a specific user you're looking for
    console.log('\n\nChecking latest users created:');
    const latestQuery = `
      SELECT 
        email, 
        username, 
        is_creator, 
        is_super_admin, 
        role,
        created_at
      FROM users 
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    const latestResult = await pool.query(latestQuery);
    console.table(latestResult.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking admin role:', error);
    process.exit(1);
  }
}

checkAdminRole();