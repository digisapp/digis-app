/**
 * Script to update all backend routes to use req.user.supabase_id consistently
 * This ensures compatibility with the Supabase migration
 */

const fs = require('fs').promises;
const path = require('path');

// Patterns to replace
const replacements = [
  {
    pattern: /req\.user\.id(?!\.)/g,
    replacement: 'req.user.supabase_id',
    description: 'Replace req.user.id with req.user.supabase_id'
  },
  {
    pattern: /req\.user\.uid/g,
    replacement: 'req.user.supabase_id',
    description: 'Replace req.user.uid with req.user.supabase_id'
  },
  {
    pattern: /const\s+userId\s*=\s*req\.user\.id/g,
    replacement: 'const userId = req.user.supabase_id',
    description: 'Update userId assignments'
  },
  {
    pattern: /const\s+creatorId\s*=\s*req\.user\.id/g,
    replacement: 'const creatorId = req.user.supabase_id',
    description: 'Update creatorId assignments'
  },
  {
    pattern: /WHERE\s+user_id\s*=\s*\$1.*?\[req\.user\.id\]/g,
    replacement: (match) => match.replace('[req.user.id]', '[req.user.supabase_id]'),
    description: 'Update SQL query parameters'
  },
  {
    pattern: /WHERE\s+creator_id\s*=\s*\$1.*?\[req\.user\.id\]/g,
    replacement: (match) => match.replace('[req.user.id]', '[req.user.supabase_id]'),
    description: 'Update SQL query parameters for creator_id'
  }
];

// Files to update
const routeFiles = [
  'routes/recording.js',
  'routes/streaming.js',
  'routes/moderation.js',
  'routes/analytics.js',
  'routes/auth.js',
  'routes/content.js',
  'routes/creators.js',
  'routes/payments.js',
  'routes/tokens.js',
  'routes/users.js',
  'routes/sessions.js',
  'routes/offers.js',
  'routes/membership-tiers.js',
  'routes/tv-subscription.js',
  'routes/admin.js'
];

// Additional middleware files
const middlewareFiles = [
  'middleware/auth.js',
  'middleware/enhanced-auth-example.js',
  'middleware/rateLimiter.js'
];

async function updateFile(filePath) {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    
    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      console.log(`⚠️  File not found: ${filePath}`);
      return { file: filePath, status: 'not_found', changes: 0 };
    }

    // Read file content
    let content = await fs.readFile(fullPath, 'utf8');
    const originalContent = content;
    let changeCount = 0;

    // Apply replacements
    for (const { pattern, replacement, description } of replacements) {
      const matches = content.match(pattern);
      if (matches) {
        content = content.replace(pattern, replacement);
        changeCount += matches.length;
        console.log(`  ✓ ${description}: ${matches.length} occurrences`);
      }
    }

    // Write back if changes were made
    if (content !== originalContent) {
      // Create backup
      await fs.writeFile(`${fullPath}.backup`, originalContent);
      
      // Write updated content
      await fs.writeFile(fullPath, content);
      
      console.log(`✅ Updated ${filePath}: ${changeCount} changes`);
      return { file: filePath, status: 'updated', changes: changeCount };
    } else {
      console.log(`ℹ️  No changes needed in ${filePath}`);
      return { file: filePath, status: 'no_changes', changes: 0 };
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return { file: filePath, status: 'error', changes: 0, error: error.message };
  }
}

async function updateAllFiles() {
  console.log('Starting route updates for Supabase ID migration...\n');
  
  const allFiles = [...routeFiles, ...middlewareFiles];
  const results = [];

  for (const file of allFiles) {
    const result = await updateFile(file);
    results.push(result);
  }

  // Summary
  console.log('\n=== Update Summary ===');
  const updated = results.filter(r => r.status === 'updated');
  const noChanges = results.filter(r => r.status === 'no_changes');
  const notFound = results.filter(r => r.status === 'not_found');
  const errors = results.filter(r => r.status === 'error');

  console.log(`Updated: ${updated.length} files (${updated.reduce((sum, r) => sum + r.changes, 0)} total changes)`);
  console.log(`No changes needed: ${noChanges.length} files`);
  console.log(`Not found: ${notFound.length} files`);
  console.log(`Errors: ${errors.length} files`);

  if (errors.length > 0) {
    console.log('\nFiles with errors:');
    errors.forEach(r => console.log(`  - ${r.file}: ${r.error}`));
  }

  // Create a migration guide
  const guide = `
# Route Update Guide

## Changes Made
- Replaced all instances of \`req.user.id\` with \`req.user.supabase_id\`
- Replaced all instances of \`req.user.uid\` with \`req.user.supabase_id\`
- Updated SQL query parameters to use supabase_id

## Files Updated
${updated.map(r => `- ${r.file} (${r.changes} changes)`).join('\n')}

## Verification Steps
1. Test authentication flow
2. Verify all API endpoints work correctly
3. Check database queries use correct ID format (UUID)
4. Ensure middleware properly sets req.user.supabase_id

## Rollback
Backup files created with .backup extension
`;

  await fs.writeFile(path.join(__dirname, '..', 'ROUTE_UPDATE_GUIDE.md'), guide);
  console.log('\n✅ Migration guide created: ROUTE_UPDATE_GUIDE.md');
}

// Helper function to create auth middleware update
async function createAuthMiddlewareUpdate() {
  const authMiddleware = `
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../utils/supabase-admin-v2');

/**
 * Updated authentication middleware for Supabase
 * Ensures req.user.supabase_id is always set
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Ensure consistent user object structure
    req.user = {
      supabase_id: user.id, // Primary identifier
      id: user.id,          // Backward compatibility
      email: user.email,
      role: user.user_metadata?.role || 'user',
      ...user.user_metadata
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({ error: 'Token verification failed' });
  }
};

module.exports = { authenticateToken };
`;

  const middlewarePath = path.join(__dirname, '..', 'middleware', 'auth-supabase.js');
  await fs.writeFile(middlewarePath, authMiddleware);
  console.log('✅ Created updated auth middleware: middleware/auth-supabase.js');
}

// Run the update
(async () => {
  try {
    await createAuthMiddlewareUpdate();
    await updateAllFiles();
    console.log('\n🎉 Route update complete!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();