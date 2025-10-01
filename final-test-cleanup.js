#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Remaining test files to clean
const testFiles = [
  'frontend/src/__tests__/integration/video-call-flow.test.js',
  'frontend/src/__tests__/cross-browser/compatibility.test.js',
  'frontend/src/__tests__/components/AnalyticsDashboard.test.js',
  'frontend/src/__tests__/load/streaming-load-test.js'
];

function cleanTestFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Update mock user objects
    content = content.replace(/getIdToken: jest\.fn\(\),/g, 'getAuthToken: jest.fn(),');
    content = content.replace(/mockUser\.getIdToken\.mockResolvedValue\('mock-firebase-token'\);/g, 
      "mockUser.getAuthToken.mockResolvedValue('mock-supabase-token');");
    content = content.replace(/getIdToken: jest\.fn\(\)\.mockResolvedValue\('mock-token'\),/g, 
      "getAuthToken: jest.fn().mockResolvedValue('mock-supabase-token'),");
    content = content.replace(/getIdToken: jest\.fn\(\)\.mockResolvedValue\('mock-load-test-token'\),/g, 
      "getAuthToken: jest.fn().mockResolvedValue('mock-supabase-token'),");
    
    // Update Firebase references
    content = content.replace(/const mockFirebaseUser/g, 'const mockSupabaseUser');
    content = content.replace(/jest\.mock\('\.\.\/\.\.\/utils\/firebase'/g, 
      "jest.mock('../../utils/auth-helpers'");
    content = content.replace(/currentUser: mockFirebaseUser,/g, 
      'currentUser: mockSupabaseUser,');
    content = content.replace(/mock-firebase-token/g, 'mock-supabase-token');
    
    // Update comments
    content = content.replace(/\/\/ Mock Firebase/g, '// Mock Supabase');
    content = content.replace(/Mock Firebase/g, 'Mock Supabase');
    
    // Check if modifications were made
    if (content.includes('getAuthToken') || content.includes('mock-supabase-token')) {
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Cleaned: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  Already clean: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error cleaning ${filePath}:`, error.message);
    return false;
  }
}

console.log('🧹 Final Test File Cleanup\n');

let cleanedCount = 0;

testFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    if (cleanTestFile(fullPath)) {
      cleanedCount++;
    }
  } else {
    console.log(`⚠️  File not found: ${file}`);
  }
});

console.log(`\n✅ Cleaned ${cleanedCount} test files`);

// Update auth-helpers.js comment
const authHelpersPath = path.join(__dirname, 'frontend/src/utils/auth-helpers.js');
if (fs.existsSync(authHelpersPath)) {
  let content = fs.readFileSync(authHelpersPath, 'utf8');
  content = content.replace(/\* Replaces Firebase's getIdToken\(\) method/g, 
    '* Gets the Supabase session token (replaces Firebase\'s getIdToken)');
  fs.writeFileSync(authHelpersPath, content);
  console.log('✅ Updated auth-helpers.js comment');
}

console.log('\n✨ Test file cleanup complete!');