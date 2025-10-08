const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://postgres:JWiYM6v3bq4Imaot@db.lpphsjowsivjtcmafxnj.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runSQL() {
  const client = await pool.connect();
  try {
    console.log('Connected to Supabase database');
    
    const sql = fs.readFileSync('VERIFY_AND_FIX_DATABASE.sql', 'utf8');
    
    console.log('Executing SQL script...');
    
    const statements = sql.split(';').filter(s => s.trim());
    
    let successCount = 0;
    let skipCount = 0;
    
    for (let idx = 0; idx < statements.length; idx++) {
      const statement = statements[idx].trim();
      if (!statement || statement.startsWith('--')) continue;
      
      try {
        const result = await client.query(statement);
        successCount++;
        if (result.rows && result.rows.length > 0) {
          console.log('\nQuery results:');
          console.table(result.rows);
        }
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          skipCount++;
        } else {
          console.log('Warning:', err.message.substring(0, 100));
        }
      }
    }
    
    console.log('\nSummary:');
    console.log('- Successful operations:', successCount);
    console.log('- Skipped (already exists):', skipCount);
    console.log('\nDatabase verification completed!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runSQL();
