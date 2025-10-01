require('dotenv').config();
const { pool } = require('./utils/db');

async function checkCreators() {
  try {
    console.log('Checking for creators in database...\n');
    
    // Count users by type
    const countResult = await pool.query(`
      SELECT 
        COUNT(*) as count,
        is_creator
      FROM users 
      GROUP BY is_creator
    `);
    
    console.log('User counts:');
    countResult.rows.forEach(row => {
      console.log(`- ${row.is_creator ? 'Creators' : 'Fans'}: ${row.count}`);
    });
    
    // Get sample creators
    const creatorsResult = await pool.query(`
      SELECT 
        id,
        username,
        email,
        is_creator,
        bio,
        creator_type
      FROM users 
      WHERE is_creator = true
      LIMIT 5
    `);
    
    if (creatorsResult.rows.length > 0) {
      console.log('\nSample creators:');
      creatorsResult.rows.forEach(creator => {
        console.log(`- @${creator.username || 'no-username'} (${creator.email}) - Type: ${creator.creator_type || 'not set'}`);
      });
    } else {
      console.log('\nNo creators found in database!');
      
      // Check if current user is a creator
      const currentUserResult = await pool.query(`
        SELECT id, username, email, is_creator 
        FROM users 
        WHERE email = $1
      `, [process.env.TEST_USER_EMAIL || 'test@example.com']);
      
      if (currentUserResult.rows.length > 0) {
        const user = currentUserResult.rows[0];
        console.log(`\nCurrent test user (${user.email}): is_creator = ${user.is_creator}`);
        
        if (!user.is_creator) {
          console.log('\nTo make yourself a creator, run:');
          console.log(`UPDATE users SET is_creator = true WHERE email = '${user.email}';`);
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCreators();