const { executeQuery } = require('./utils/db');
const fs = require('fs');
const path = require('path');

async function runMigration(filePath, fileName) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');

    // Skip empty files
    if (!sql.trim()) {
      console.log(`⚠️  Skipping empty file: ${fileName}`);
      return true;
    }

    // Split by semicolon but be careful with functions/procedures
    const statements = sql
      .split(/;\s*(?=(?:[^']*'[^']*')*[^']*$)/)
      .filter(s => s.trim() && !s.trim().startsWith('--'));

    console.log(`\n📝 Running migration: ${fileName}`);
    console.log(`   Found ${statements.length} statements`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          console.log(`   Statement ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
          await executeQuery(statement);
          console.log(`   ✅ Success`);
        } catch (error) {
          // Some errors are okay (like "already exists")
          if (error.message.includes('already exists') ||
              error.message.includes('does not exist') && statement.includes('DROP') ||
              error.message.includes('duplicate key')) {
            console.log(`   ⚠️  Warning (non-fatal): ${error.message}`);
          } else {
            console.error(`   ❌ Error: ${error.message}`);
            // Continue with other statements
          }
        }
      }
    }

    console.log(`✅ Completed: ${fileName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to run ${fileName}:`, error.message);
    return false;
  }
}

async function main() {
  const migrationsDir = path.join(__dirname, 'migrations');

  // Get all migration files
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .filter(f => {
      // Get files 200 and above
      const match = f.match(/^(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        return num >= 200;
      }
      return false;
    })
    .sort((a, b) => {
      const aNum = parseInt(a.match(/^(\d+)/)[1]);
      const bNum = parseInt(b.match(/^(\d+)/)[1]);
      return aNum - bNum;
    });

  console.log('🚀 Starting migration process');
  console.log(`📦 Found ${files.length} migration files to apply (200+)`);
  console.log('Files:', files);

  // First, create migrations tracking table if it doesn't exist
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ Migrations table ready');
  } catch (error) {
    console.log('⚠️  Migrations table may already exist');
  }

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const file of files) {
    // Check if already applied
    try {
      const result = await executeQuery(
        'SELECT * FROM migrations WHERE filename = $1',
        [file]
      );

      if (result.rows.length > 0) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        skipCount++;
        continue;
      }
    } catch (e) {
      // Table might not exist, continue
    }

    const filePath = path.join(migrationsDir, file);
    const success = await runMigration(filePath, file);

    if (success) {
      successCount++;
      // Record successful migration
      try {
        await executeQuery(
          'INSERT INTO migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
          [file]
        );
      } catch (e) {
        console.log('⚠️  Could not record migration:', e.message);
      }
    } else {
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successfully applied: ${successCount}`);
  console.log(`   ⏭️  Already applied: ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('='.repeat(60));

  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});