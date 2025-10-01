const { pool } = require('./utils/db');

async function checkApplicationsTable() {
  try {
    console.log('Checking creator_applications table...\n');
    
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'creator_applications'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Table creator_applications does not exist!');
      console.log('Creating table...');
      
      // Create the table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS creator_applications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(supabase_id),
          bio TEXT,
          specialties JSONB,
          experience TEXT,
          social_media JSONB,
          pricing JSONB,
          availability JSONB,
          status VARCHAR(50) DEFAULT 'pending',
          submitted_at TIMESTAMP DEFAULT NOW(),
          reviewed_at TIMESTAMP,
          reviewed_by UUID REFERENCES users(supabase_id),
          review_notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      
      console.log('✅ Table created successfully');
    } else {
      console.log('✅ Table exists');
      
      // Get column info
      const columnsQuery = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'creator_applications'
        ORDER BY ordinal_position;
      `);
      
      console.log('\nTable columns:');
      console.table(columnsQuery.rows);
    }
    
    // Check for any data
    const dataCheck = await pool.query('SELECT COUNT(*) FROM creator_applications');
    console.log(`\nTotal applications: ${dataCheck.rows[0].count}`);
    
    // Add sample application if none exist
    if (dataCheck.rows[0].count === '0') {
      console.log('\nAdding sample application...');
      
      // First get a user to link to
      const userQuery = await pool.query(`
        SELECT supabase_id FROM users 
        WHERE is_creator = false 
        LIMIT 1
      `);
      
      if (userQuery.rows.length > 0) {
        await pool.query(`
          INSERT INTO creator_applications (
            user_id, bio, specialties, experience, social_media, 
            pricing, availability, status
          ) VALUES (
            $1,
            'Experienced content creator specializing in fitness and wellness',
            '["Fitness", "Wellness", "Lifestyle"]',
            '5 years',
            '{"instagram": "@fitcreator", "tiktok": "@fitcreator"}',
            '{"videoCall": 30, "voiceCall": 20, "privateStream": 50}',
            '{"monday": true, "tuesday": true, "wednesday": true}',
            'pending'
          )
        `, [userQuery.rows[0].supabase_id]);
        
        console.log('✅ Sample application added');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking applications table:', error);
    process.exit(1);
  }
}

checkApplicationsTable();