// Load environment variables first
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { pool } = require('../utils/db');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/secureLogger');

async function addIndexes() {
  let client;
  
  try {
    logger.info('Starting database index creation...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../migrations/add_indexes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and filter empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    client = await pool.connect();
    
    logger.info(`Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        logger.info(`Executing statement ${i + 1}/${statements.length}`);
        await client.query(statement);
        logger.info(`✅ Successfully executed statement ${i + 1}`);
      } catch (error) {
        // Log but continue - some constraints might already exist
        if (error.code === '42P07') { // duplicate table/index
          logger.warn(`⚠️  Index/constraint already exists: ${error.message}`);
        } else if (error.code === '42703') { // column doesn't exist
          logger.warn(`⚠️  Column doesn't exist: ${error.message}`);
        } else {
          logger.error(`❌ Error executing statement ${i + 1}:`, error);
        }
      }
    }
    
    // Get index statistics
    const indexStats = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
      FROM 
        pg_stat_user_indexes
      WHERE 
        schemaname = 'public'
      ORDER BY 
        tablename, indexname;
    `);
    
    logger.info('\n📊 Index Statistics:');
    indexStats.rows.forEach(row => {
      logger.info(`  ${row.tablename}.${row.indexname}: ${row.index_size}`);
    });
    
    logger.info('\n✅ Database indexes created successfully!');
    
  } catch (error) {
    logger.error('Failed to add indexes:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the script
addIndexes();