#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Additional files to update
const filesToUpdate = [
  'frontend/src/components/AdminDashboard.js',
  'frontend/src/components/pages/ProfilePage.js',
  'frontend/src/components/CreatorSelectionPopup.js',
  'frontend/src/components/TipCreatorPopup.js',
  'frontend/src/components/CreatorDirectory.js',
  'frontend/src/components/PreCallValidation.js',
  'frontend/src/components/mobile/MobileOptimizedAuth.js',
  'frontend/src/components/AnalyticsDashboard.js',
  'frontend/src/components/SessionBilling.js',
  'frontend/src/components/NotificationSystem.js',
  'frontend/src/components/ImprovedTokenPurchase.js',
  'frontend/src/components/FanEngagementSystem.js',
  'frontend/src/components/CreatorProtectionSystem.js',
  'frontend/src/components/CreatorOffers.js',
  'frontend/src/components/CreatorAvailabilitySystem.js',
  'frontend/src/components/CoHostManager.js',
  'frontend/src/components/CallRecordingSystem.js',
  'frontend/src/components/CallQueueSystem.js',
  'frontend/src/components/DailyChallenges.js',
  // Test files
  'frontend/src/components/__tests__/VideoCall.test.js',
  'frontend/src/components/__tests__/LiveChat.test.js',
  'frontend/src/components/__tests__/EnhancedVideoCall.test.js',
  // API service files
  'frontend/src/services/api.js',
  'frontend/src/utils/api.js'
];

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // For test files, replace mock Firebase
    if (filePath.includes('__tests__')) {
      // Replace Firebase mock imports
      if (content.includes("jest.mock('../../utils/firebase'")) {
        content = content.replace(
          /jest\.mock\('\.\.\/\.\.\/utils\/firebase'[^}]+\}\);?/gs,
          `jest.mock('../../utils/auth-helpers', () => ({
  getAuthToken: jest.fn().mockResolvedValue('mock-supabase-token'),
  getCurrentUser: jest.fn().mockResolvedValue({ id: 'test-user-123' }),
  getUserId: jest.fn().mockResolvedValue('test-user-123')
}));`
        );
        modified = true;
      }
      
      // Replace mock token references
      content = content.replace(/mock-firebase-token/g, 'mock-supabase-token');
      content = content.replace(/getIdToken: jest\.fn\(\)\.mockResolvedValue\([^)]+\)/g, 'getAuthToken: jest.fn().mockResolvedValue(\'mock-supabase-token\')');
      if (content.includes('mock-supabase-token')) modified = true;
    }
    
    // Check if we need to add import
    if (!content.includes("import { getAuthToken }") && 
        !content.includes("import {getAuthToken}") &&
        (content.includes('getIdToken') || content.includes('firebaseToken'))) {
      // Add import after the last import statement
      const lastImportMatch = content.match(/import[^;]+from[^;]+;/g);
      if (lastImportMatch) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const insertPosition = content.indexOf(lastImport) + lastImport.length;
        content = content.slice(0, insertPosition) + "\nimport { getAuthToken } from '../utils/auth-helpers';" + content.slice(insertPosition);
        modified = true;
      }
    }
    
    // Replace inline getIdToken calls
    content = content.replace(/await\s+user\.getIdToken\(\)/g, 'await getAuthToken()');
    content = content.replace(/await\s+auth\.currentUser\.getIdToken\(\)/g, 'await getAuthToken()');
    content = content.replace(/\$\{await\s+user\.getIdToken\(\)\}/g, '${await getAuthToken()}');
    
    // Replace stored token patterns
    content = content.replace(/const\s+firebaseToken\s*=\s*await\s+(?:user|auth\.currentUser)\.getIdToken\(\);?/g, 'const authToken = await getAuthToken();');
    content = content.replace(/let\s+firebaseToken\s*=\s*await\s+(?:user|auth\.currentUser)\.getIdToken\(\);?/g, 'let authToken = await getAuthToken();');
    
    // Replace firebaseToken usage
    content = content.replace(/firebaseToken/g, 'authToken');
    
    // Replace user.uid with user.id
    content = content.replace(/user\.uid/g, 'user.id');
    content = content.replace(/currentUser\.uid/g, 'currentUser.id');
    
    // Replace firebase_uid with supabase_id
    content = content.replace(/firebase_uid/g, 'supabase_id');
    content = content.replace(/firebaseUid/g, 'supabaseId');
    content = content.replace(/firebaseUID/g, 'supabaseID');
    
    // Check if any replacements were made
    if (content.includes('getAuthToken') || content.includes('supabase_id')) {
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

// Run the migration
console.log('🚀 Starting remaining Firebase to Supabase migration...\n');

let updatedCount = 0;
let errorCount = 0;

filesToUpdate.forEach(file => {
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

console.log(`\n✅ Migration complete!`);
console.log(`📊 Updated ${updatedCount} files`);
console.log(`⚠️  ${errorCount} files not found`);