/**
 * Generate stable, consistent Agora UID from user ID
 *
 * Requirements:
 * - Must be a positive 32-bit integer
 * - Must be consistent (same userId always produces same UID)
 * - Must be unique (different userIds produce different UIDs)
 *
 * @param {string} userId - Supabase user ID (UUID string)
 * @returns {number} - Positive 32-bit integer for Agora
 */
function generateStableAgoraUid(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }

  // Use a simple but stable hash function
  // Hash the userId string to a 32-bit integer
  let hash = 0;

  for (let i = 0; i < userId.length; i++) {
    // Multiply by 31 (prime) and add char code
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    // Convert to 32-bit integer
    hash = hash & hash;
  }

  // Ensure positive and within safe range
  // Max safe 32-bit signed int is 2147483647
  const uid = Math.abs(hash) % 2147483647;

  // Ensure non-zero (Agora requires UID > 0)
  return uid === 0 ? 1 : uid;
}

/**
 * Validate that a UID is valid for Agora
 *
 * @param {number} uid - UID to validate
 * @returns {boolean} - True if valid
 */
function isValidAgoraUid(uid) {
  return (
    typeof uid === 'number' &&
    Number.isInteger(uid) &&
    uid > 0 &&
    uid <= 2147483647
  );
}

/**
 * Test the UID generation for consistency
 * Run this in development to verify stability
 */
function testUidStability() {
  const testUserId = 'test-user-123';
  const uid1 = generateStableAgoraUid(testUserId);
  const uid2 = generateStableAgoraUid(testUserId);

  console.log('UID Stability Test:');
  console.log(`  Input: ${testUserId}`);
  console.log(`  UID 1: ${uid1}`);
  console.log(`  UID 2: ${uid2}`);
  console.log(`  Consistent: ${uid1 === uid2}`);
  console.log(`  Valid: ${isValidAgoraUid(uid1)}`);

  return uid1 === uid2;
}

module.exports = {
  generateStableAgoraUid,
  isValidAgoraUid,
  testUidStability
};
