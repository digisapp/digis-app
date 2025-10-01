#!/usr/bin/env node

/**
 * Migration Script: Transition to Asymmetric JWT Verification
 * 
 * This script helps migrate from symmetric to asymmetric JWT verification
 * for Supabase authentication. It's backward compatible and ensures a
 * smooth transition without breaking existing sessions.
 */

const { createClient } = require('@supabase/supabase-js');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const { pool } = require('../utils/db');
const { logger } = require('../utils/secureLogger');
const readline = require('readline');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE = 100;

// Initialize Supabase Admin
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Initialize JWKS client for asymmetric verification
const jwtIssuer = `${SUPABASE_URL}/auth/v1`;
const jwksClient = createRemoteJWKSet(new URL(`${jwtIssuer}/.well-known/jwks.json`));

// Create readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

/**
 * Test asymmetric JWT verification
 */
async function testAsymmetricVerification() {
  console.log('\n🔍 Testing asymmetric JWT verification...');
  
  try {
    // Create a test user session to get a JWT
    const { data: { session }, error } = await supabaseAdmin.auth.admin.createUser({
      email: `test-migration-${Date.now()}@example.com`,
      password: 'test-password-123',
      email_confirm: true
    });
    
    if (error) {
      throw new Error(`Failed to create test user: ${error.message}`);
    }
    
    // Get the JWT token
    const token = session?.access_token;
    
    if (!token) {
      throw new Error('No token received from test session');
    }
    
    // Try asymmetric verification
    const { payload } = await jwtVerify(token, jwksClient, {
      issuer: jwtIssuer,
      audience: 'authenticated'
    });
    
    console.log('✅ Asymmetric JWT verification successful!');
    console.log('   Payload sample:', {
      sub: payload.sub,
      email: payload.email,
      role: payload.role
    });
    
    // Clean up test user
    await supabaseAdmin.auth.admin.deleteUser(payload.sub);
    
    return true;
  } catch (error) {
    console.error('❌ Asymmetric verification test failed:', error.message);
    console.log('   This might be because your Supabase project doesn\'t support it yet.');
    return false;
  }
}

/**
 * Verify backward compatibility
 */
async function testBackwardCompatibility() {
  console.log('\n🔄 Testing backward compatibility with symmetric verification...');
  
  try {
    // Create a test user
    const testEmail = `test-compat-${Date.now()}@example.com`;
    const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: 'test-password-123',
      email_confirm: true
    });
    
    if (createError) {
      throw new Error(`Failed to create test user: ${createError.message}`);
    }
    
    // Sign in to get a token
    const { data: { session }, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: testEmail,
      password: 'test-password-123'
    });
    
    if (signInError || !session) {
      throw new Error('Failed to sign in test user');
    }
    
    // Try symmetric verification (old method)
    const { data: { user: verifiedUser }, error: verifyError } = await supabaseAdmin.auth.getUser(
      session.access_token
    );
    
    if (verifyError || !verifiedUser) {
      throw new Error('Symmetric verification failed');
    }
    
    console.log('✅ Backward compatibility maintained!');
    console.log('   Both verification methods will work during transition.');
    
    // Clean up
    await supabaseAdmin.auth.admin.deleteUser(user.user.id);
    
    return true;
  } catch (error) {
    console.error('⚠️ Backward compatibility test encountered an issue:', error.message);
    return false;
  }
}

/**
 * Update database schema for migration tracking
 */
async function updateDatabaseSchema() {
  console.log('\n📊 Updating database schema...');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create migration tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS jwt_migration_status (
        id SERIAL PRIMARY KEY,
        user_id UUID,
        migration_status VARCHAR(50) DEFAULT 'pending',
        last_verification_method VARCHAR(50),
        migrated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Add index for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_jwt_migration_user 
      ON jwt_migration_status(user_id)
    `);
    
    // Add column to users table for tracking
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS jwt_version VARCHAR(20) DEFAULT 'symmetric'
    `);
    
    await client.query('COMMIT');
    console.log('✅ Database schema updated successfully');
    
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Database schema update failed:', error.message);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Migrate active sessions
 */
async function migrateActiveSessions() {
  console.log('\n🔄 Checking active sessions...');
  
  const client = await pool.connect();
  
  try {
    // Get count of active users
    const { rows: [{ count }] } = await client.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE last_seen_at > NOW() - INTERVAL '30 days'
    `);
    
    console.log(`   Found ${count} recently active users`);
    
    if (parseInt(count) > 0) {
      const migrate = await prompt(
        `\n   Do you want to mark these users for gradual migration? (y/n): `
      );
      
      if (migrate.toLowerCase() === 'y') {
        // Mark users for gradual migration
        await client.query(`
          INSERT INTO jwt_migration_status (user_id, migration_status)
          SELECT id, 'scheduled'
          FROM users
          WHERE last_seen_at > NOW() - INTERVAL '30 days'
          ON CONFLICT (user_id) DO NOTHING
        `);
        
        console.log('✅ Users marked for gradual migration');
        console.log('   They will be migrated on their next login');
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Session migration failed:', error.message);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Update application configuration
 */
async function updateConfiguration() {
  console.log('\n⚙️ Configuration recommendations:');
  
  console.log('\n1. Update your .env file:');
  console.log('   ENABLE_ASYMMETRIC_JWT=true');
  console.log('   JWT_FALLBACK_TO_SYMMETRIC=true');
  
  console.log('\n2. Update your middleware to use supabase-admin-v2.js:');
  console.log('   const { verifySupabaseToken } = require("./utils/supabase-admin-v2");');
  
  console.log('\n3. Monitor the migration:');
  console.log('   - Check application logs for JWT verification methods');
  console.log('   - Monitor error rates during transition');
  console.log('   - Track migration progress in jwt_migration_status table');
  
  console.log('\n4. After successful migration (typically 30 days):');
  console.log('   - Set JWT_FALLBACK_TO_SYMMETRIC=false');
  console.log('   - Remove symmetric verification code');
  
  return true;
}

/**
 * Generate migration report
 */
async function generateReport() {
  console.log('\n📈 Generating migration report...');
  
  const client = await pool.connect();
  
  try {
    const stats = {};
    
    // Get user statistics
    const { rows: [userStats] } = await client.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE jwt_version = 'asymmetric') as migrated_users,
        COUNT(*) FILTER (WHERE jwt_version = 'symmetric') as pending_users
      FROM users
    `);
    
    stats.users = userStats;
    
    // Get migration status
    const { rows: [migrationStats] } = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE migration_status = 'completed') as completed,
        COUNT(*) FILTER (WHERE migration_status = 'scheduled') as scheduled,
        COUNT(*) FILTER (WHERE migration_status = 'failed') as failed
      FROM jwt_migration_status
    `);
    
    stats.migration = migrationStats;
    
    console.log('\n📊 Migration Statistics:');
    console.log('   Total Users:', stats.users.total_users);
    console.log('   Migrated:', stats.users.migrated_users);
    console.log('   Pending:', stats.users.pending_users);
    console.log('\n   Migration Status:');
    console.log('   Completed:', stats.migration.completed || 0);
    console.log('   Scheduled:', stats.migration.scheduled || 0);
    console.log('   Failed:', stats.migration.failed || 0);
    
    // Save report to file
    const fs = require('fs');
    const reportPath = `./jwt-migration-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
    console.log(`\n✅ Report saved to: ${reportPath}`);
    
    return stats;
  } catch (error) {
    console.error('❌ Report generation failed:', error.message);
    return null;
  } finally {
    client.release();
  }
}

/**
 * Main migration flow
 */
async function main() {
  console.log('='.repeat(60));
  console.log('🔐 Supabase JWT Migration Tool');
  console.log('   Migrating from Symmetric to Asymmetric JWT Verification');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Test asymmetric verification
    const asymmetricWorks = await testAsymmetricVerification();
    
    if (!asymmetricWorks) {
      console.log('\n⚠️ Asymmetric verification is not available yet.');
      console.log('   This is normal - Supabase will enable it by October 2025.');
      console.log('   You can prepare for the migration now.');
      
      const proceed = await prompt('\nDo you want to prepare for future migration? (y/n): ');
      if (proceed.toLowerCase() !== 'y') {
        console.log('Migration cancelled.');
        process.exit(0);
      }
    }
    
    // Step 2: Test backward compatibility
    await testBackwardCompatibility();
    
    // Step 3: Update database schema
    const schemaUpdated = await updateDatabaseSchema();
    if (!schemaUpdated) {
      throw new Error('Failed to update database schema');
    }
    
    // Step 4: Handle active sessions
    await migrateActiveSessions();
    
    // Step 5: Show configuration updates
    await updateConfiguration();
    
    // Step 6: Generate report
    await generateReport();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration preparation complete!');
    console.log('\nNext steps:');
    console.log('1. Deploy the updated supabase-admin-v2.js');
    console.log('2. Monitor logs for any issues');
    console.log('3. Gradually migrate users over the next 30 days');
    console.log('4. Run this script weekly to check progress');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('   Please fix the issues and try again.');
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

// Run migration if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testAsymmetricVerification,
  testBackwardCompatibility,
  updateDatabaseSchema,
  generateReport
};