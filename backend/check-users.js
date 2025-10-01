require('dotenv').config();
const { pool } = require('./utils/db');

async function checkUsers() {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        email, 
        username, 
        is_creator, 
        is_super_admin, 
        role,
        created_at,
        updated_at
      FROM users 
      WHERE email IN ('nathan@digis.cc', 'admin@digis.cc')
      ORDER BY email
    `);
    
    console.log('\n📊 User Database Check:\n');
    console.log('═'.repeat(80));
    
    if (result.rows.length === 0) {
      console.log('❌ No users found with those emails');
    } else {
      result.rows.forEach(user => {
        console.log(`Email: ${user.email}`);
        console.log(`Username: ${user.username || 'NULL'}`);
        console.log(`Is Creator: ${user.is_creator ? '✅ YES' : '❌ NO'}`);
        console.log(`Is Admin: ${user.is_super_admin ? '✅ YES' : '❌ NO'}`);
        console.log(`Role: ${user.role || 'NULL'}`);
        console.log(`Created: ${user.created_at}`);
        console.log(`Updated: ${user.updated_at}`);
        console.log('─'.repeat(80));
      });
    }
    
    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('Error checking users:', error.message);
    process.exit(1);
  }
}

checkUsers();