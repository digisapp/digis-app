#!/usr/bin/env node

/**
 * Verification Script: Ensure Only Supabase Authentication is Used
 * This script verifies that all Firebase references have been removed
 * and only Supabase is being used for authentication and database.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Directories to scan
const SCAN_DIRS = [
  './backend',
  './frontend/src',
  './frontend/public'
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
  '*.md',
  '*.sql',
  '*.log',
  'verify-supabase-only.js'
];

// Firebase-related patterns to search for
const FIREBASE_PATTERNS = [
  // Import statements
  /require\s*\(\s*['"]firebase/gi,
  /from\s+['"]firebase/gi,
  /import.*firebase-admin/gi,

  // Firebase SDK methods
  /firebase\.initializeApp/gi,
  /firebase\.auth\(\)/gi,
  /firebase\.firestore\(\)/gi,
  /firebase\.database\(\)/gi,
  /firebase\.storage\(\)/gi,
  /firebase\.functions\(\)/gi,

  // Firebase Auth methods
  /signInWithEmailAndPassword/gi,
  /createUserWithEmailAndPassword/gi,
  /signInWithPopup/gi,
  /GoogleAuthProvider/gi,
  /onAuthStateChanged/gi,

  // Firestore methods (not Supabase)
  /\.collection\(/gi,
  /\.doc\(/gi,
  /\.onSnapshot\(/gi,

  // Firebase environment variables
  /FIREBASE_API_KEY/gi,
  /FIREBASE_AUTH_DOMAIN/gi,
  /FIREBASE_PROJECT_ID/gi,
  /FIREBASE_STORAGE_BUCKET/gi,
  /FIREBASE_MESSAGING_SENDER_ID/gi,
  /FIREBASE_APP_ID/gi,
  /REACT_APP_FIREBASE/gi
];

// Supabase patterns to look for (to confirm proper usage)
const SUPABASE_PATTERNS = [
  /supabase\.auth\.signIn/gi,
  /supabase\.auth\.signUp/gi,
  /supabase\.auth\.getUser/gi,
  /supabase\.from\(/gi,
  /createClient.*@supabase/gi,
  /SUPABASE_URL/gi,
  /SUPABASE_ANON_KEY/gi,
  /SUPABASE_SERVICE_ROLE_KEY/gi
];

let totalFiles = 0;
let filesWithFirebase = 0;
let filesWithSupabase = 0;
let firebaseOccurrences = [];
let supabaseOccurrences = [];

/**
 * Check if path should be ignored
 */
function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(pattern => {
    if (pattern.includes('*')) {
      const ext = pattern.replace('*', '');
      return filePath.endsWith(ext);
    }
    return filePath.includes(pattern);
  });
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
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        hasFirebase = true;
        firebaseOccurrences.push({
          file: filePath,
          pattern: pattern.toString(),
          matches: matches.slice(0, 3) // Show first 3 matches
        });
      }
    });

    // Check for Supabase patterns
    SUPABASE_PATTERNS.forEach(pattern => {
      if (pattern.test(content)) {
        hasSupabase = true;
      }
    });

    if (hasFirebase) filesWithFirebase++;
    if (hasSupabase) {
      filesWithSupabase++;
      supabaseOccurrences.push(filePath);
    }

  } catch (error) {
    if (error.code !== 'EISDIR') {
      console.error(chalk.red(`Error reading ${filePath}: ${error.message}`));
    }
  }
}

/**
 * Recursively scan directory
 */
function scanDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.log(chalk.yellow(`Directory does not exist: ${dir}`));
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
      filePath.endsWith('.tsx') ||
      filePath.endsWith('.json') ||
      filePath.endsWith('.env')
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
    './package.json',
    './backend/package.json',
    './frontend/package.json'
  ];

  console.log(chalk.blue('\n📦 Checking package.json files for Firebase dependencies...'));

  let hasFirebaseDeps = false;

  packagePaths.forEach(pkgPath => {
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const allDeps = {
          ...pkg.dependencies || {},
          ...pkg.devDependencies || {}
        };

        const firebaseDeps = Object.keys(allDeps).filter(dep =>
          dep.includes('firebase') || dep.includes('firestore')
        );

        if (firebaseDeps.length > 0) {
          hasFirebaseDeps = true;
          console.log(chalk.red(`\n❌ Firebase dependencies found in ${pkgPath}:`));
          firebaseDeps.forEach(dep => {
            console.log(chalk.red(`   - ${dep}: ${allDeps[dep]}`));
          });
        }
      } catch (error) {
        console.error(chalk.red(`Error reading ${pkgPath}: ${error.message}`));
      }
    }
  });

  if (!hasFirebaseDeps) {
    console.log(chalk.green('✅ No Firebase dependencies found in package.json files'));
  }

  return hasFirebaseDeps;
}

/**
 * Main execution
 */
function main() {
  console.log(chalk.bold.cyan('\n🔍 Verifying Supabase-Only Implementation\n'));
  console.log(chalk.gray('=' .repeat(50)));

  // Check package.json files
  const hasFirebaseInPackage = checkPackageJson();

  // Scan directories
  console.log(chalk.blue('\n📂 Scanning source code directories...'));

  SCAN_DIRS.forEach(dir => {
    console.log(chalk.gray(`   Scanning ${dir}...`));
    scanDirectory(dir);
  });

  // Report results
  console.log(chalk.blue('\n📊 Scan Results:'));
  console.log(chalk.gray('=' .repeat(50)));

  console.log(`Total files scanned: ${totalFiles}`);
  console.log(`Files with Supabase code: ${chalk.green(filesWithSupabase)}`);
  console.log(`Files with Firebase code: ${filesWithFirebase > 0 ? chalk.red(filesWithFirebase) : chalk.green(0)}`);

  // Show Firebase occurrences if found
  if (firebaseOccurrences.length > 0) {
    console.log(chalk.red('\n❌ Firebase References Found:'));
    firebaseOccurrences.forEach(occurrence => {
      console.log(chalk.yellow(`\nFile: ${occurrence.file}`));
      console.log(chalk.gray(`Pattern: ${occurrence.pattern}`));
      console.log(chalk.gray(`Matches: ${occurrence.matches.join(', ')}`));
    });

    console.log(chalk.red('\n⚠️  Action Required: Remove all Firebase references above'));
  } else {
    console.log(chalk.green('\n✅ No Firebase references found in source code!'));
  }

  // Show Supabase usage
  if (filesWithSupabase > 0) {
    console.log(chalk.green('\n✅ Supabase is being used in the following files:'));
    supabaseOccurrences.slice(0, 10).forEach(file => {
      console.log(chalk.gray(`   - ${file}`));
    });
    if (supabaseOccurrences.length > 10) {
      console.log(chalk.gray(`   ... and ${supabaseOccurrences.length - 10} more files`));
    }
  }

  // Final verdict
  console.log(chalk.blue('\n📋 Final Verification:'));
  console.log(chalk.gray('=' .repeat(50)));

  if (filesWithFirebase === 0 && !hasFirebaseInPackage) {
    console.log(chalk.bold.green('✅ SUCCESS: No Firebase code detected!'));
    console.log(chalk.green('✅ The application is using Supabase exclusively.'));
  } else {
    console.log(chalk.bold.red('❌ FAILED: Firebase references still exist.'));
    console.log(chalk.yellow('⚠️  Please remove all Firebase code and dependencies.'));
  }

  // Recommendations
  console.log(chalk.blue('\n💡 Recommendations:'));
  console.log(chalk.gray('=' .repeat(50)));

  if (filesWithSupabase === 0) {
    console.log(chalk.yellow('⚠️  No Supabase usage detected. Make sure Supabase is properly integrated.'));
  } else {
    console.log(chalk.green('✅ Supabase is properly integrated.'));
  }

  console.log(chalk.cyan('\n🔒 Security Checklist:'));
  console.log('   [ ] Environment variables are using SUPABASE_* prefix');
  console.log('   [ ] No Firebase config files (firebase.json, .firebaserc)');
  console.log('   [ ] All auth middleware uses Supabase JWT verification');
  console.log('   [ ] Database queries use Supabase client or direct PostgreSQL');
  console.log('   [ ] RLS (Row Level Security) policies are configured in Supabase');

  process.exit(filesWithFirebase > 0 || hasFirebaseInPackage ? 1 : 0);
}

// Run the verification
main();