require('dotenv').config();
const { pool } = require('./utils/db');

async function createAdminTables() {
  try {
    console.log('Creating admin tables...\n');
    
    // Create audit_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID REFERENCES users(supabase_id),
        action VARCHAR(255) NOT NULL,
        details JSONB,
        timestamp TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ audit_logs table created');
    
    // Create content_reports table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_id UUID REFERENCES users(supabase_id),
        reported_user_id UUID REFERENCES users(supabase_id),
        content_type VARCHAR(50),
        content_id UUID,
        reason VARCHAR(255),
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        reviewed_by UUID REFERENCES users(supabase_id),
        review_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ content_reports table created');
    
    // Add indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_content_reports_reported_user ON content_reports(reported_user_id)');
    console.log('✅ Indexes created');
    
    // Insert sample audit log
    const result = await pool.query(`
      INSERT INTO audit_logs (admin_id, action, details, timestamp)
      SELECT 
        supabase_id,
        'admin_dashboard_setup',
        '{"message": "Admin dashboard initialized with Supabase integration"}'::jsonb,
        NOW()
      FROM users 
      WHERE email = 'admin@digis.cc'
      LIMIT 1
      ON CONFLICT DO NOTHING
      RETURNING *
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Sample audit log created');
    } else {
      console.log('ℹ️  Audit log already exists or admin not found');
    }
    
    console.log('\n✅ All admin tables created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating tables:', error.message);
    
    // If it's a conflict error, try without ON CONFLICT
    if (error.code === '42601') {
      try {
        const result = await pool.query(`
          INSERT INTO audit_logs (admin_id, action, details, timestamp)
          SELECT 
            supabase_id,
            'admin_dashboard_setup',
            '{"message": "Admin dashboard initialized with Supabase integration"}'::jsonb,
            NOW()
          FROM users 
          WHERE email = 'admin@digis.cc'
          AND NOT EXISTS (
            SELECT 1 FROM audit_logs 
            WHERE action = 'admin_dashboard_setup'
          )
          LIMIT 1
        `);
        
        console.log('✅ Sample audit log created (alternative method)');
        console.log('\n✅ All admin tables created successfully');
        process.exit(0);
      } catch (error2) {
        console.error('Alternative insert also failed:', error2.message);
      }
    }
    
    process.exit(1);
  }
}

createAdminTables();