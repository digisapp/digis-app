require('dotenv').config();
const supabaseAdmin = require('../utils/supabase-admin');
const fs = require('fs');
const path = require('path');

async function createDigitalsTables() {
  try {
    console.log('🔄 Creating digitals tables...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../migrations/134_create_digitals_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL statements and execute them
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      try {
        console.log('Executing:', statement.substring(0, 50) + '...');
        const { error } = await supabaseAdmin.rpc('exec_sql', {
          sql: statement + ';'
        });
        
        if (error) {
          // Try direct execution if RPC doesn't work
          const { error: directError } = await supabaseAdmin
            .from('digitals')
            .select('count')
            .limit(1);
          
          if (!directError || directError.code === '42P01') {
            // Table doesn't exist, create it manually
            console.log('Creating tables through Supabase client...');
            
            // Create digitals table
            const createDigitalsTable = `
              CREATE TABLE IF NOT EXISTS digitals (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                creator_id UUID NOT NULL,
                title VARCHAR(255),
                description TEXT,
                file_url TEXT NOT NULL,
                thumbnail_url TEXT,
                file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('image', 'video')),
                category VARCHAR(100) DEFAULT 'general',
                tags TEXT[],
                width INTEGER,
                height INTEGER,
                duration INTEGER,
                file_size BIGINT,
                mime_type VARCHAR(100),
                is_public BOOLEAN DEFAULT true,
                allow_download BOOLEAN DEFAULT false,
                watermarked BOOLEAN DEFAULT false,
                view_count INTEGER DEFAULT 0,
                download_count INTEGER DEFAULT 0,
                display_order INTEGER DEFAULT 0,
                is_featured BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              )`;
            
            // We'll create these through the Supabase dashboard instead
            console.log('⚠️  Tables need to be created through Supabase dashboard');
            console.log('Please run the SQL in migrations/134_create_digitals_tables.sql in your Supabase SQL editor');
          }
        }
      } catch (err) {
        console.error('Error executing statement:', err.message);
      }
    }
    
    // Check if tables were created
    const { data: tables } = await supabaseAdmin
      .from('digitals')
      .select('id')
      .limit(1);
    
    if (tables !== null) {
      console.log('✅ Digitals tables appear to be ready!');
    } else {
      console.log('⚠️  Digitals tables may not be created yet');
      console.log('Please run the following SQL in your Supabase dashboard:');
      console.log('\n' + sql);
    }
    
  } catch (error) {
    console.error('Error creating digitals tables:', error);
    console.log('\n📝 Manual steps required:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the SQL from: backend/migrations/134_create_digitals_tables.sql');
  }
  
  process.exit(0);
}

createDigitalsTables();