const db = require('./utils/db');

async function fixTotalCostColumn() {
  let client;

  try {
    client = await db.pool.connect();

    console.log('Adding total_cost_cents column if missing...');

    // Check if columns exist
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sessions'
      AND column_name IN ('total_cost_cents', 'total_cost');
    `;

    const checkResult = await client.query(checkQuery);
    const existingColumns = checkResult.rows.map(row => row.column_name);

    // Add total_cost_cents if missing
    if (!existingColumns.includes('total_cost_cents')) {
      await client.query(`
        ALTER TABLE sessions
        ADD COLUMN total_cost_cents INTEGER DEFAULT 0
      `);
      console.log('✅ Added total_cost_cents column');
    } else {
      console.log('✅ total_cost_cents column already exists');
    }

    // Update analytics queries to use total_cost_cents
    console.log('✅ Database columns fixed successfully');

  } catch (error) {
    console.error('Error fixing database columns:', error);
    throw error;
  } finally {
    if (client) client.release();
    process.exit(0);
  }
}

fixTotalCostColumn();