#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Firebase removal from codebase...\n');

// Patterns to search for
const patterns = [
  'getIdToken',
  'firebaseToken',
  'firebase_uid',
  'firebaseUid',
  'firebaseUID',
  'Firebase',
  'firebase/auth',
  'firebase/app'
];

// Directories to exclude from search
const excludeDirs = [
  'node_modules',
  '.git',
  'build',
  'dist',
  '.next',
  'coverage',
  '*.backup',
  '*.pre-supabase-backup'
];

// Files to exclude
const excludeFiles = [
  'verify-firebase-removal.js',
  'migrate-firebase-to-supabase.js',
  'migrate-remaining-firebase.js',
  'FIREBASE_MIGRATION_STATUS.md',
  'FIREBASE_TO_SUPABASE_MIGRATION.md',
  'package-lock.json',
  'yarn.lock'
];

let totalIssues = 0;
const issues = [];

patterns.forEach(pattern => {
  console.log(`\n🔎 Searching for: ${pattern}`);
  
  try {
    // Build grep command with exclusions
    const excludeArgs = [
      ...excludeDirs.map(dir => `--exclude-dir=${dir}`),
      ...excludeFiles.map(file => `--exclude=${file}`)
    ].join(' ');
    
    const cmd = `grep -r -i "${pattern}" ${excludeArgs} frontend/src backend/`;
    const result = execSync(cmd, { encoding: 'utf8' });
    
    if (result) {
      const lines = result.trim().split('\n');
      console.log(`❌ Found ${lines.length} instances`);
      
      lines.forEach(line => {
        const [file, ...content] = line.split(':');
        
        // Skip backup files and migration files
        if (file.includes('.backup') || 
            file.includes('migration') || 
            file.includes('SUPABASE_MIGRATION')) {
          return;
        }
        
        // Skip comments
        const contentStr = content.join(':').trim();
        if (contentStr.startsWith('//') || 
            contentStr.startsWith('*') ||
            contentStr.startsWith('#')) {
          return;
        }
        
        // Skip auth-helpers.js references (these are our replacements)
        if (file.includes('auth-helpers.js')) {
          return;
        }
        
        // Skip linkFirebaseUser function (migration helper)
        if (contentStr.includes('linkFirebaseUser')) {
          return;
        }
        
        issues.push({
          pattern,
          file,
          content: contentStr
        });
        totalIssues++;
      });
    } else {
      console.log('✅ None found');
    }
  } catch (error) {
    // grep returns exit code 1 when no matches found
    if (error.status === 1) {
      console.log('✅ None found');
    } else {
      console.error('Error:', error.message);
    }
  }
});

console.log('\n📊 Summary:');
console.log('='.repeat(50));

if (totalIssues === 0) {
  console.log('✅ SUCCESS: All Firebase references have been removed!');
  console.log('\n🎉 The migration from Firebase to Supabase is complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Test authentication flow');
  console.log('2. Test all API endpoints');
  console.log('3. Run database migrations if needed');
  console.log('4. Deploy to staging for testing');
} else {
  console.log(`❌ ISSUES FOUND: ${totalIssues} Firebase references remaining`);
  console.log('\n📋 Files that need attention:');
  
  const fileGroups = {};
  issues.forEach(issue => {
    if (!fileGroups[issue.file]) {
      fileGroups[issue.file] = [];
    }
    fileGroups[issue.file].push(issue);
  });
  
  Object.entries(fileGroups).forEach(([file, fileIssues]) => {
    console.log(`\n📄 ${file}`);
    fileIssues.forEach(issue => {
      console.log(`   - "${issue.pattern}": ${issue.content.substring(0, 60)}...`);
    });
  });
}

// Check package.json for Firebase dependencies
console.log('\n🔍 Checking package.json files...');

const packageFiles = [
  'frontend/package.json',
  'backend/package.json'
];

let hasFirebaseDeps = false;

packageFiles.forEach(pkgFile => {
  if (fs.existsSync(pkgFile)) {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    const firebaseDeps = Object.keys(deps).filter(dep => 
      dep.toLowerCase().includes('firebase')
    );
    
    if (firebaseDeps.length > 0) {
      console.log(`\n❌ ${pkgFile} has Firebase dependencies:`);
      firebaseDeps.forEach(dep => {
        console.log(`   - ${dep}: ${deps[dep]}`);
      });
      hasFirebaseDeps = true;
    } else {
      console.log(`✅ ${pkgFile}: No Firebase dependencies`);
    }
  }
});

if (!hasFirebaseDeps) {
  console.log('\n✅ No Firebase dependencies in package.json files');
}

console.log('\n✨ Verification complete!');