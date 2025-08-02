#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files that still have Firebase references
const filesToClean = [
  // Frontend components
  'frontend/src/components/AuthDebug.js',
  'frontend/src/components/VideoCall.js',
  'frontend/src/components/__tests__/VideoCall.test.js',
  'frontend/src/components/__tests__/LiveChat.test.js',
  'frontend/src/components/__tests__/EnhancedVideoCall.test.js',
  
  // Backend routes
  'backend/routes/admin.js',
  'backend/routes/auth.js',
  'backend/routes/challenges.js',
  'backend/routes/creators.js',
  'backend/routes/goals.js',
  'backend/routes/offers.js',
  'backend/routes/users.js'
];

function cleanFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const originalContent = content;
    
    // For AuthDebug.js - this appears to be a debug component, update it
    if (filePath.includes('AuthDebug.js')) {
      content = content.replace(/Calling Firebase signIn\.\.\./g, 'Calling Supabase signIn...');
      content = content.replace(/const token = await userCredential\.user\.getIdToken\(\);/g, 
        'const token = data.session?.access_token;');
    }
    
    // For VideoCall.js - update comment
    if (filePath.includes('VideoCall.js')) {
      content = content.replace(/\/\/ Get Firebase token for API auth/g, 
        '// Get Supabase token for API auth');
    }
    
    // For test files - update mocks and references
    if (filePath.includes('__tests__')) {
      // Update Firebase mocks to Supabase
      content = content.replace(/jest\.mock\('\.\.\/\.\.\/utils\/firebase'/g, 
        "jest.mock('../../utils/auth-helpers'");
      content = content.replace(/getIdToken: jest\.fn\(\)/g, 
        'getAuthToken: jest.fn()');
      content = content.replace(/mockResolvedValue\('mock-firebase-token'\)/g, 
        "mockResolvedValue('mock-supabase-token')");
    }
    
    // For backend routes - update column names and references
    if (filePath.includes('backend/routes')) {
      // Replace firebase_user_id with supabase_id
      content = content.replace(/firebase_user_id/g, 'supabase_id');
      content = content.replace(/firebase_uid/g, 'supabase_id');
      
      // Update hasFirebaseId to hasSupabaseId
      content = content.replace(/hasFirebaseId:/g, 'hasSupabaseId:');
      
      // Update any Firebase-specific comments
      content = content.replace(/Firebase/g, 'Supabase');
      content = content.replace(/firebase/g, 'supabase');
    }
    
    // Check if file was modified
    if (content !== originalContent) {
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

console.log('🔍 Complete Firebase Removal Check\n');

let cleanedCount = 0;
let alreadyClean = 0;
let errors = 0;

filesToClean.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    const result = cleanFile(fullPath);
    if (result === true) cleanedCount++;
    else if (result === false) alreadyClean++;
  } else {
    console.log(`⚠️  File not found: ${file}`);
    errors++;
  }
});

console.log('\n📊 Summary:');
console.log(`✅ Cleaned: ${cleanedCount} files`);
console.log(`✔️  Already clean: ${alreadyClean} files`);
console.log(`❌ Errors: ${errors} files`);

// Also check for any remaining references
console.log('\n🔍 Final verification...\n');

const { execSync } = require('child_process');

try {
  // Check frontend components
  console.log('Checking frontend components...');
  const frontendCmd = 'grep -r "firebase\\|Firebase\\|getIdToken\\|firebaseToken" frontend/src/components --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude="*.backup" | grep -v "auth-helpers" | grep -v "supabase" || true';
  const frontendResult = execSync(frontendCmd, { encoding: 'utf8' });
  
  if (frontendResult.trim()) {
    console.log('⚠️  Remaining Firebase references in frontend:');
    console.log(frontendResult);
  } else {
    console.log('✅ No Firebase references in frontend components');
  }
  
  // Check backend routes
  console.log('\nChecking backend routes...');
  const backendCmd = 'grep -r "firebase\\|Firebase\\|firebase_uid\\|firebase_user_id" backend/routes --include="*.js" --exclude="*.backup" | grep -v "supabase" || true';
  const backendResult = execSync(backendCmd, { encoding: 'utf8' });
  
  if (backendResult.trim()) {
    console.log('⚠️  Remaining Firebase references in backend:');
    console.log(backendResult);
  } else {
    console.log('✅ No Firebase references in backend routes');
  }
  
  // Check for getIdToken specifically
  console.log('\nChecking for getIdToken calls...');
  const tokenCmd = 'grep -r "getIdToken" frontend/src --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude="*.backup" || true';
  const tokenResult = execSync(tokenCmd, { encoding: 'utf8' });
  
  if (tokenResult.trim()) {
    console.log('⚠️  Remaining getIdToken calls:');
    console.log(tokenResult);
  } else {
    console.log('✅ No getIdToken calls found');
  }
  
} catch (error) {
  console.error('Error during verification:', error.message);
}

console.log('\n✨ Firebase removal check complete!');