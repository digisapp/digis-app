const { clearRoleCache, clearAllRoleCache } = require('./middleware/roleVerification');

// Clear all role cache to ensure fresh data
clearAllRoleCache();
console.log('✅ All role cache cleared successfully');

// Specific admin user ID if needed
const adminSupabaseId = '904b9325-08c6-4221-a0ea-2557f852699c';
clearRoleCache(adminSupabaseId);
console.log(`✅ Role cache cleared for admin user: ${adminSupabaseId}`);

process.exit(0);