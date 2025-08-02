#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files that still need updating
const remainingFiles = [
  // Frontend components that were missed
  'frontend/src/components/InstantChatWidget.js',
  'frontend/src/components/AnalyticsDashboard.js',
  'frontend/src/components/CreatorToolsQuickAccess.js',
  'frontend/src/components/TipCreatorPopup.js',
  'frontend/src/components/CreatorSelectionPopup.js',
  'frontend/src/components/AuthDebug.js',
  'frontend/src/components/ClassReviews.js',
  'frontend/src/components/NotificationBell.js',
  'frontend/src/components/EnhancedNotificationBox.js',
  'frontend/src/components/EnhancedLeaderboards.js',
  'frontend/src/components/CreatorCallModal.js',
  'frontend/src/components/NotificationDropdown.js',
  'frontend/src/components/NotificationCenter.js',
  
  // Hooks and utils
  'frontend/src/hooks/useUsername.js',
  'frontend/src/hooks/api/useAuth.ts',
  'frontend/src/utils/pwa.js',
  
  // Backend test files
  'backend/__tests__/integration/agora-token-flow.test.js'
];

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // For test files, update the mocks
    if (filePath.includes('__tests__') || filePath.includes('test.js')) {
      // Replace Firebase admin mock
      content = content.replace(
        /jest\.mock\('firebase-admin\/auth'[^}]+\}\);?/gs,
        `jest.mock('../../../middleware/auth-enhanced', () => ({
  verifySupabaseToken: jest.fn().mockImplementation((req, res, next) => {
    req.user = { id: 'test-user-123', supabase_id: 'test-user-123' };
    next();
  })
}));`
      );
      
      // Replace firebase token references in tests
      content = content.replace(/validFirebaseToken/g, 'validSupabaseToken');
      content = content.replace(/valid-firebase-token/g, 'valid-supabase-token');
      content = content.replace(/Invalid Firebase token/g, 'Invalid Supabase token');
      
      if (content.includes('validSupabaseToken')) modified = true;
    }
    
    // Add import if needed
    if (!content.includes("import { getAuthToken }") && 
        !content.includes("import {getAuthToken}") &&
        !content.includes('auth-helpers') &&
        (content.includes('getIdToken') || content.includes('firebaseToken'))) {
      
      // Special handling for TypeScript files
      const importPath = filePath.includes('.ts') && !filePath.includes('.test.') 
        ? '../utils/auth-helpers' 
        : '../utils/auth-helpers.js';
      
      const lastImportMatch = content.match(/import[^;]+from[^;]+;/g);
      if (lastImportMatch) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const insertPosition = content.indexOf(lastImport) + lastImport.length;
        content = content.slice(0, insertPosition) + `\nimport { getAuthToken } from '${importPath}';` + content.slice(insertPosition);
        modified = true;
      }
    }
    
    // Replace all variations of getIdToken
    content = content.replace(/await\s+user\.getIdToken\(\)/g, 'await getAuthToken()');
    content = content.replace(/await\s+auth\.currentUser\.getIdToken\(\)/g, 'await getAuthToken()');
    content = content.replace(/await\s+supabase\.auth\.user\(\)\.getIdToken\(\)/g, 'await getAuthToken()');
    content = content.replace(/await\s+supabase\.auth\.user\(\)\?\.getIdToken\(\)/g, 'await getAuthToken()');
    content = content.replace(/await\s+state\.user\.getIdToken\(\)/g, 'await getAuthToken()');
    content = content.replace(/user\.getIdToken\(\)\.then/g, 'getAuthToken().then');
    content = content.replace(/auth\.currentUser\?\.getIdToken\(\)/g, 'getAuthToken()');
    
    // Replace token variable names
    content = content.replace(/const\s+token\s*=\s*await\s+user\.getIdToken\(\);/g, 'const token = await getAuthToken();');
    content = content.replace(/const\s+authToken\s*=\s*user\s*\?\s*await\s+user\.getIdToken\(\)\s*:\s*null;/g, 'const authToken = user ? await getAuthToken() : null;');
    
    // Replace firebaseToken with authToken
    content = content.replace(/firebaseToken/g, 'authToken');
    
    // Replace user.uid with user.id
    content = content.replace(/user\.uid/g, 'user.id');
    
    // Check if modifications were made
    if (content.includes('getAuthToken') || 
        content.includes('authToken') || 
        content.includes('validSupabaseToken')) {
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  No changes needed: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Run the cleanup
console.log('🚀 Starting final Firebase cleanup...\n');

let updatedCount = 0;
let errorCount = 0;

remainingFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    if (updateFile(fullPath)) {
      updatedCount++;
    }
  } else {
    console.log(`⚠️  File not found: ${file}`);
    errorCount++;
  }
});

// Clean up backend insert-test-data.js
const testDataFile = path.join(__dirname, 'backend/insert-test-data.js');
if (fs.existsSync(testDataFile)) {
  let content = fs.readFileSync(testDataFile, 'utf8');
  content = content.replace(/firebase_uid/g, 'supabase_id');
  content = content.replace(/ON CONFLICT \(firebase_uid\)/g, 'ON CONFLICT (supabase_id)');
  fs.writeFileSync(testDataFile, content);
  console.log(`✅ Updated: ${testDataFile}`);
  updatedCount++;
}

console.log(`\n✅ Final cleanup complete!`);
console.log(`📊 Updated ${updatedCount} files`);
console.log(`⚠️  ${errorCount} files not found`);

console.log('\n📝 Remaining tasks:');
console.log('1. Run database migration 007_remove_firebase_columns.sql when ready');
console.log('2. Clean up log files (contains old error messages)');
console.log('3. Remove .pre-supabase-backup files when confirmed working');