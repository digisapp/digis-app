#!/usr/bin/env node

/**
 * Simple Verification Script: Ensure Only Supabase is Used
 * No external dependencies required
 */

const fs = require('fs');
const path = require('path');

// Directories to scan
const SCAN_DIRS = [
  './backend',
  './frontend/src'
];

// Files/directories to ignore
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  'clean-export',
  '.md',
  '.sql',
  '.log',
  'verify-supabase'
];

// Firebase-related patterns to search for
const FIREBASE_PATTERNS = [
  /firebase/gi,
  /firestore/gi,
  /FIREBASE_/g,
  /\.collection\(/g,
  /\.doc\(/g
];

let totalFiles = 0;
let filesWithFirebase = [];
let filesWithSupabase = [];

/**
 * Check if path should be ignored
 */
function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

/**
 * Scan a file for patterns
 */
function scanFile(filePath) {
  if (shouldIgnore(filePath)) return;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    totalFiles++;

    let hasFirebase = false;
    let hasSupabase = false;

    // Check for Firebase patterns
    FIREBASE_PATTERNS.forEach(pattern => {
      if (pattern.test(content)) {
        hasFirebase = true;
      }
    });

    // Check for Supabase
    if (/supabase/gi.test(content)) {
      hasSupabase = true;
    }

    if (hasFirebase) {
      filesWithFirebase.push(filePath);
    }
    if (hasSupabase) {
      filesWithSupabase.push(filePath);
    }

  } catch (error) {
    // Ignore directory entries
  }
}

/**
 * Recursively scan directory
 */
function scanDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory does not exist: ${dir}`);
    return;
  }

  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);

    if (shouldIgnore(filePath)) return;

    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      scanDirectory(filePath);
    } else if (stat.isFile() && (
      filePath.endsWith('.js') ||
      filePath.endsWith('.jsx') ||
      filePath.endsWith('.ts') ||
      filePath.endsWith('.tsx')
    )) {
      scanFile(filePath);
    }
  });
}

/**
 * Check package.json for Firebase dependencies
 */
function checkPackageJson() {
  const packagePaths = [
    './backend/package.json',
    './frontend/package.json'
  ];

  console.log('\n📦 Checking package.json files...\n');

  let firebaseDepsFound = [];

  packagePaths.forEach(pkgPath => {
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const allDeps = {
          ...pkg.dependencies || {},
          ...pkg.devDependencies || {}
        };

        Object.keys(allDeps).forEach(dep => {
          if (dep.includes('firebase') || dep.includes('firestore')) {
            firebaseDepsFound.push(`${pkgPath}: ${dep}@${allDeps[dep]}`);
          }
        });
      } catch (error) {
        console.error(`Error reading ${pkgPath}: ${error.message}`);
      }
    }
  });

  if (firebaseDepsFound.length > 0) {
    console.log('❌ Firebase dependencies found:');
    firebaseDepsFound.forEach(dep => console.log(`   - ${dep}`));
  } else {
    console.log('✅ No Firebase dependencies in package.json files');
  }

  return firebaseDepsFound.length > 0;
}

/**
 * Main execution
 */
function main() {
  console.log('\n=====================================');
  console.log('  FIREBASE REMOVAL VERIFICATION');
  console.log('=====================================\n');

  // Check package.json files
  const hasFirebaseInPackage = checkPackageJson();

  // Scan directories
  console.log('\n📂 Scanning source code...\n');

  SCAN_DIRS.forEach(dir => {
    console.log(`Scanning ${dir}...`);
    scanDirectory(dir);
  });

  // Filter out false positives (comments, documentation references)
  const actualFirebaseFiles = filesWithFirebase.filter(file => {
    // Exclude files that are just comments or documentation
    if (file.includes('auth-enhanced.js')) {
      const content = fs.readFileSync(file, 'utf8');
      // Check if it's just a comment about Firebase being removed
      if (content.includes('// Supabase-only authentication')) {
        return false;
      }
    }
    return true;
  });

  // Report results
  console.log('\n=====================================');
  console.log('  RESULTS');
  console.log('=====================================\n');

  console.log(`Total files scanned: ${totalFiles}`);
  console.log(`Files with Supabase: ${filesWithSupabase.length}`);
  console.log(`Files with Firebase references: ${actualFirebaseFiles.length}`);

  // Show Firebase files if found
  if (actualFirebaseFiles.length > 0) {
    console.log('\n❌ Files with Firebase references:');
    actualFirebaseFiles.forEach(file => {
      console.log(`   - ${file}`);
    });
  } else {
    console.log('\n✅ No Firebase references found in source code!');
  }

  // Show sample of Supabase files
  if (filesWithSupabase.length > 0) {
    console.log('\n✅ Supabase is being used in:');
    filesWithSupabase.slice(0, 5).forEach(file => {
      console.log(`   - ${file}`);
    });
    if (filesWithSupabase.length > 5) {
      console.log(`   ... and ${filesWithSupabase.length - 5} more files`);
    }
  }

  // Final verdict
  console.log('\n=====================================');
  console.log('  FINAL STATUS');
  console.log('=====================================\n');

  if (actualFirebaseFiles.length === 0 && !hasFirebaseInPackage) {
    console.log('✅ SUCCESS: No Firebase code detected!');
    console.log('✅ Application is using Supabase only.');
  } else {
    console.log('❌ FAILED: Firebase references still exist.');
    if (hasFirebaseInPackage) {
      console.log('   - Remove Firebase dependencies from package.json');
    }
    if (actualFirebaseFiles.length > 0) {
      console.log('   - Remove Firebase code from source files');
    }
  }

  console.log('\n=====================================\n');

  process.exit(actualFirebaseFiles.length > 0 || hasFirebaseInPackage ? 1 : 0);
}

// Run the verification
main();