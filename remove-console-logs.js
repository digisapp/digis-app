#!/usr/bin/env node

/**
 * Script to remove console.log statements from production code
 * Usage: node remove-console-logs.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DIRECTORIES_TO_PROCESS = [
  './frontend/src',
  './backend/api',
  './backend/routes',
  './backend/utils',
  './backend/middleware'
];

const FILE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

const EXCLUDE_PATTERNS = [
  'node_modules',
  '.test.',
  '.spec.',
  '__tests__',
  'test-',
  'sentry.js', // Keep logging in sentry config
  'logger.js',  // Keep logging in logger utilities
  'env-validator.js' // Keep validation logging
];

let filesProcessed = 0;
let consolesRemoved = 0;
const isDryRun = process.argv.includes('--dry-run');

function shouldProcessFile(filePath) {
  // Check if file has valid extension
  const hasValidExtension = FILE_EXTENSIONS.some(ext => filePath.endsWith(ext));
  if (!hasValidExtension) return false;

  // Check if file should be excluded
  const shouldExclude = EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
  return !shouldExclude;
}

function removeConsoleLogs(content, filePath) {
  let modified = false;
  let localConsolesRemoved = 0;

  // Pattern to match console.log, console.error, console.warn, console.info, console.debug
  // But keep console.error for error handling
  const patterns = [
    // Multi-line console.log
    /console\.(log|debug|info|warn)\([^)]*\([^)]*\)[^)]*\);?/gm,
    // Single line console.log
    /console\.(log|debug|info|warn)\([^;)]*\);?/g,
    // Console.log with template literals
    /console\.(log|debug|info|warn)\(`[^`]*`\);?/g,
    // Console.log that spans multiple lines
    /console\.(log|debug|info|warn)\(([\s\S]*?)\);/gm
  ];

  let newContent = content;

  patterns.forEach(pattern => {
    const matches = newContent.match(pattern);
    if (matches) {
      localConsolesRemoved += matches.length;
      newContent = newContent.replace(pattern, '');
      modified = true;
    }
  });

  // Clean up empty lines left behind
  newContent = newContent.replace(/^\s*[\r\n]/gm, '\n');
  newContent = newContent.replace(/\n{3,}/g, '\n\n');

  if (modified) {
    consolesRemoved += localConsolesRemoved;
    console.log(`  📝 ${filePath}: Removed ${localConsolesRemoved} console statements`);
  }

  return { content: newContent, modified };
}

function processFile(filePath) {
  if (!shouldProcessFile(filePath)) return;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { content: newContent, modified } = removeConsoleLogs(content, filePath);

    if (modified && !isDryRun) {
      fs.writeFileSync(filePath, newContent, 'utf8');
    }

    if (modified) {
      filesProcessed++;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

function processDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  Directory not found: ${dir}`);
    return;
  }

  const items = fs.readdirSync(dir);

  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !item.includes('node_modules')) {
      processDirectory(fullPath);
    } else if (stat.isFile()) {
      processFile(fullPath);
    }
  });
}

// Main execution
console.log('🧹 Console Log Removal Tool');
console.log('===========================');
console.log(isDryRun ? '🔍 DRY RUN MODE - No files will be modified' : '✏️  LIVE MODE - Files will be modified');
console.log('');

DIRECTORIES_TO_PROCESS.forEach(dir => {
  console.log(`\n📁 Processing: ${dir}`);
  processDirectory(dir);
});

console.log('\n===========================');
console.log('📊 Summary:');
console.log(`   Files modified: ${filesProcessed}`);
console.log(`   Console statements removed: ${consolesRemoved}`);

if (isDryRun) {
  console.log('\n💡 This was a dry run. To actually remove console statements, run:');
  console.log('   node remove-console-logs.js');
} else {
  console.log('\n✅ Console statements have been removed!');
  console.log('⚠️  Remember to test your application after these changes.');
}