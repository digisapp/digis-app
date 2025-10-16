require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: connectionString && !connectionString.includes('localhost') ? {
    rejectUnauthorized: false
  } : false
});

async function verify() {
  const client = await pool.connect();

  try {
    console.log('🔍 Verifying Vanity URL System Setup\n');
    console.log('='.repeat(60));

    // Check username column
    console.log('\n1️⃣ Username Column');
    const columnCheck = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'username'
    `);

    if (columnCheck.rows.length > 0) {
      const col = columnCheck.rows[0];
      console.log(`   ✅ Column exists: ${col.column_name} (${col.data_type})`);
      console.log(`   - Nullable: ${col.is_nullable}`);
    } else {
      console.log('   ❌ Username column NOT found!');
    }

    // Check unique indexes
    console.log('\n2️⃣ Unique Indexes');
    const uniqueIndexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'users'
      AND indexdef LIKE '%UNIQUE%'
      AND indexname LIKE '%username%'
    `);

    if (uniqueIndexes.rows.length > 0) {
      uniqueIndexes.rows.forEach(idx => {
        console.log(`   ✅ ${idx.indexname}`);
      });
    } else {
      console.log('   ❌ No unique indexes on username!');
    }

    // Check case-insensitive index
    console.log('\n3️⃣ Case-Insensitive Index');
    const caseInsensitive = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'users'
      AND indexdef ILIKE '%lower(%username%'
    `);

    if (caseInsensitive.rows.length > 0) {
      caseInsensitive.rows.forEach(idx => {
        console.log(`   ✅ ${idx.indexname}`);
      });
    } else {
      console.log('   ❌ No case-insensitive index!');
    }

    // Check constraints
    console.log('\n4️⃣ Username Constraints');
    const constraints = await client.query(`
      SELECT
        conname,
        CASE contype
          WHEN 'c' THEN 'CHECK'
          WHEN 'u' THEN 'UNIQUE'
          WHEN 'p' THEN 'PRIMARY KEY'
          WHEN 'f' THEN 'FOREIGN KEY'
        END as constraint_type
      FROM pg_constraint
      WHERE conrelid = 'users'::regclass
      AND conname LIKE '%username%'
    `);

    if (constraints.rows.length > 0) {
      constraints.rows.forEach(con => {
        console.log(`   ✅ ${con.conname} (${con.constraint_type})`);
      });
    } else {
      console.log('   ⚠️ No username constraints');
    }

    // Check quarantine table
    console.log('\n5️⃣ Username Quarantine Table');
    const quarantineTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'username_quarantine'
      ) as exists
    `);

    if (quarantineTable.rows[0].exists) {
      console.log('   ✅ Table exists');
    } else {
      console.log('   ❌ Table NOT found!');
    }

    // Check username changes table
    console.log('\n6️⃣ Username Changes (Audit) Table');
    const changesTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'username_changes'
      ) as exists
    `);

    if (changesTable.rows[0].exists) {
      console.log('   ✅ Table exists');
    } else {
      console.log('   ❌ Table NOT found!');
    }

    // Check additional columns
    console.log('\n7️⃣ Additional User Columns');
    const additionalCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name IN ('username_changed_at', 'previous_username')
    `);

    if (additionalCols.rows.length > 0) {
      additionalCols.rows.forEach(col => {
        console.log(`   ✅ ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('   ⚠️ No additional tracking columns found');
    }

    // Check for duplicates
    console.log('\n8️⃣ Duplicate Check');
    const duplicates = await client.query(`
      SELECT LOWER(username) as normalized, COUNT(*) as count
      FROM users
      WHERE username IS NOT NULL
      GROUP BY LOWER(username)
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rows.length > 0) {
      console.log(`   ❌ Found ${duplicates.rows.length} duplicate usernames:`);
      duplicates.rows.forEach(dup => {
        console.log(`     - ${dup.normalized} (${dup.count} occurrences)`);
      });
    } else {
      console.log('   ✅ No duplicate usernames found!');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Vanity URL System Verification Complete!\n');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
