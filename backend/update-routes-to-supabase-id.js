#!/usr/bin/env node

/**
 * Script to update all backend routes to use supabase_id consistently
 * This script will update req.user.id references to req.user.supabase_id
 * and fix related database queries
 */

const fs = require('fs').promises;
const path = require('path');

const ROUTES_DIR = path.join(__dirname, 'routes');

// Files to update based on grep results
const filesToUpdate = [
  'badges.js',
  'notifications.js',
  'tips.js',
  'content.js',
  'creators.js',
  'privacy.js',
  'recording.js',
  'discovery.js',
  'auth.js',
  'tokens.js',
  'tv-subscription.js',
  'sessions.js',
  'users.js',
  'payments.js',
  'classes.js'
];

// Replacement patterns
const replacements = [
  {
    // Replace req.user.id with req.user.supabase_id
    pattern: /const\s+(\w+)\s*=\s*req\.user\.id(?!\.)/g,
    replacement: 'const $1 = req.user.supabase_id'
  },
  {
    // Replace req.user.id in direct usage
    pattern: /req\.user\.id(?!\.)/g,
    replacement: 'req.user.supabase_id'
  },
  {
    // Update SELECT queries that use integer id
    pattern: /SELECT\s+(.*)FROM\s+users\s+WHERE\s+id\s*=\s*\$(\d+)/gi,
    replacement: 'SELECT $1FROM users WHERE supabase_id = $$$2'
  },
  {
    // Update INSERT queries with user_id
    pattern: /INSERT\s+INTO\s+(\w+)\s*\(([^)]*)\buser_id\b/gi,
    replacement: (match, table, columns) => {
      // Special handling for tables that need user_id as UUID
      if (['content_likes', 'notifications', 'follows', 'sessions', 'tokens'].includes(table)) {
        return match; // These should already be using UUID
      }
      return match;
    }
  },
  {
    // Fix mixed usage patterns like: req.user.supabase_id || req.user.id
    pattern: /req\.user\.supabase_id\s*\|\|\s*req\.user\.id(?:\s*\|\|\s*req\.user\.uid)?/g,
    replacement: 'req.user.supabase_id'
  },
  {
    // Fix reverse pattern: req.user.id || req.user.supabase_id
    pattern: /req\.user\.id\s*\|\|\s*req\.user\.supabase_id/g,
    replacement: 'req.user.supabase_id'
  }
];

async function updateFile(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    let originalContent = content;
    let changesMade = false;

    // Apply all replacements
    for (const { pattern, replacement } of replacements) {
      if (typeof replacement === 'function') {
        const newContent = content.replace(pattern, replacement);
        if (newContent !== content) {
          content = newContent;
          changesMade = true;
        }
      } else {
        const newContent = content.replace(pattern, replacement);
        if (newContent !== content) {
          content = newContent;
          changesMade = true;
        }
      }
    }

    // Special handling for specific files
    if (path.basename(filePath) === 'auth.js') {
      // Fix the specific auth.js pattern
      content = content.replace(
        /const userIdValue = req\.user\.supabase_id \|\| userId;/g,
        'const userIdValue = req.user.supabase_id || req.body.userId;'
      );
    }

    if (path.basename(filePath) === 'users.js') {
      // Fix follow-related queries
      content = content.replace(
        /const followerId = req\.user\.supabase_id;/g,
        'const followerId = req.user.supabase_id;'
      );
      
      // Ensure follows table uses supabase_id
      content = content.replace(
        /INSERT INTO follows.*follower_id.*creator_id/gi,
        (match) => {
          if (!match.includes('supabase_id')) {
            console.log(`Updating follows query: ${match}`);
          }
          return match;
        }
      );
    }

    if (changesMade) {
      await fs.writeFile(filePath, content, 'utf8');
      console.log(`✅ Updated: ${path.basename(filePath)}`);
      
      // Show a sample of changes
      const lines = content.split('\n');
      const originalLines = originalContent.split('\n');
      let sampleShown = 0;
      
      for (let i = 0; i < lines.length && sampleShown < 3; i++) {
        if (lines[i] !== originalLines[i]) {
          console.log(`   Line ${i + 1}: ${lines[i].trim()}`);
          sampleShown++;
        }
      }
    } else {
      console.log(`ℹ️  No changes needed: ${path.basename(filePath)}`);
    }

    return changesMade;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔄 Updating backend routes to use supabase_id consistently...\n');

  let totalUpdated = 0;

  for (const fileName of filesToUpdate) {
    const filePath = path.join(ROUTES_DIR, fileName);
    const updated = await updateFile(filePath);
    if (updated) totalUpdated++;
  }

  console.log(`\n✨ Update complete! ${totalUpdated} files were modified.`);
  
  if (totalUpdated > 0) {
    console.log('\n📋 Next steps:');
    console.log('1. Review the changes to ensure they are correct');
    console.log('2. Run tests to verify functionality');
    console.log('3. Update any middleware that sets req.user to include supabase_id');
    console.log('4. Ensure all new routes use req.user.supabase_id');
  }
}

// Run the script
main().catch(console.error);