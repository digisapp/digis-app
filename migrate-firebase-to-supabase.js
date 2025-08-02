#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to update
const filesToUpdate = [
  'frontend/src/components/TokenPurchase.js',
  'frontend/src/components/pages/ClassesPage.js',
  'frontend/src/components/EnhancedCreatorCard.js',
  'frontend/src/components/CreatorCard.js',
  'frontend/src/components/pages/ConnectPage.js',
  'frontend/src/components/AuthDebug.js',
  'frontend/src/components/VideoCall.js',
  'frontend/src/components/PrivacySettings.js',
  'frontend/src/components/Payment.js',
  'frontend/src/components/EnhancedMobileTokenPurchase.js',
  'frontend/src/components/EnhancedCreatorDiscovery.js',
  'frontend/src/components/DigitalWalletPayment.js',
  'frontend/src/components/EnhancedNotificationBox.js',
  'frontend/src/components/Wallet.js',
  'frontend/src/components/CreatorNotificationWidget.js',
  'frontend/src/components/ClassScheduler.js',
  'frontend/src/components/UserProfile.js',
  'frontend/src/components/TokenTipping.js',
  'frontend/src/components/GiftInteractionSystem.js',
  'frontend/src/components/FollowingSystem.js',
  'frontend/src/components/FanEngagement.js',
  'frontend/src/components/CreatorAvailabilityCalendar.js',
  'frontend/src/components/CreatorApplication.js',
  'frontend/src/components/ClassReviews.js',
  'frontend/src/components/ClassReviewModal.js',
  'frontend/src/components/Settings.js',
  'frontend/src/components/StreamingLayout.js',
  'frontend/src/components/StreamingDashboard.js',
  'frontend/src/components/CreatorSavedStreams.js',
  'frontend/src/components/CreatorAnalytics.js',
  'frontend/src/components/CreatorToolsQuickAccess.js',
  'frontend/src/components/VirtualGifts.js',
  'frontend/src/components/TokenAnalytics.js',
  'frontend/src/components/SmartBalanceNotifications.js',
  'frontend/src/components/PublicCreatorProfile.js',
  'frontend/src/components/NotificationDropdown.js',
  'frontend/src/components/NotificationCenter.js',
  'frontend/src/components/NotificationBell.js',
  'frontend/src/components/InteractiveVideoFeatures.js',
  'frontend/src/components/InteractivePolls.js',
  'frontend/src/components/InstantChatWidget.js',
  'frontend/src/components/CreatorCallModal.js',
  'frontend/src/components/Chat.js',
  'frontend/src/components/CreatorProfilePreview.js',
  'frontend/src/components/EnhancedLeaderboards.js'
];

// Replacements to make
const replacements = [
  {
    // Add import for auth helpers if not present
    pattern: /import\s+{[^}]*}\s+from\s+['"]\.\.\/utils\/supabase-auth['"]/,
    checkAndAdd: true,
    addition: "import { getAuthToken } from '../utils/auth-helpers';"
  },
  {
    // Replace getIdToken() calls
    pattern: /const\s+firebaseToken\s*=\s*await\s+(?:user|supabase\.auth\.user\(\))\.getIdToken\(\);?/g,
    replacement: 'const authToken = await getAuthToken();'
  },
  {
    // Replace firebaseToken usage
    pattern: /(['"`])Authorization['"`]\s*:\s*`Bearer\s+\$\{firebaseToken\}`/g,
    replacement: '$1Authorization$1: `Bearer ${authToken}`'
  },
  {
    // Replace firebaseToken in headers
    pattern: /firebaseToken/g,
    replacement: 'authToken'
  },
  {
    // Replace user.uid with user.id
    pattern: /user\.uid/g,
    replacement: 'user.id'
  },
  {
    // Replace firebase_uid with supabase_id
    pattern: /firebase_uid/g,
    replacement: 'supabase_id'
  },
  {
    // Replace firebaseUid with supabaseId
    pattern: /firebaseUid/g,
    replacement: 'supabaseId'
  }
];

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Check if we need to add import
    if (!content.includes("import { getAuthToken }") && 
        !content.includes("import {getAuthToken}") &&
        content.includes('getIdToken')) {
      // Add import after the last import statement
      const lastImportMatch = content.match(/import[^;]+from[^;]+;/g);
      if (lastImportMatch) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const insertPosition = content.indexOf(lastImport) + lastImport.length;
        content = content.slice(0, insertPosition) + "\nimport { getAuthToken } from '../utils/auth-helpers';" + content.slice(insertPosition);
        modified = true;
      }
    }
    
    // Apply replacements
    replacements.forEach(({ pattern, replacement, checkAndAdd, addition }) => {
      if (checkAndAdd) return; // Skip the import check
      
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        content = content.replace(pattern, replacement);
        modified = true;
      }
    });
    
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
console.log('🚀 Starting Firebase to Supabase migration...\n');

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
console.log(`\n📝 Next steps:`);
console.log(`1. Update test files manually`);
console.log(`2. Update database schema (firebase_uid → supabase_id)`);
console.log(`3. Test all features thoroughly`);