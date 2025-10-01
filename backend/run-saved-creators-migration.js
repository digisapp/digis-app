const { query } = require('./utils/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔄 Running saved_creators migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '147_create_saved_creators.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('📊 Created saved_creators table with indexes and RLS policies');

    // Verify the table was created
    const tableCheck = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'saved_creators'
      ORDER BY ordinal_position
    `);

    if (tableCheck.rows.length > 0) {
      console.log('✅ Table structure verified:');
      tableCheck.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();