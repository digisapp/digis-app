const argon2 = require('argon2');

/**
 * Hash a password using Argon2id
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
  try {
    // Argon2id is the recommended variant (hybrid of Argon2i and Argon2d)
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3, // 3 iterations
      parallelism: 1, // 1 thread
    });
    return hash;
  } catch (error) {
    throw new Error('Password hashing failed');
  }
}

/**
 * Verify a password against a hash
 * @param {string} hash - Hashed password
 * @param {string} password - Plain text password to verify
 * @returns {Promise<boolean>} - True if password matches
 */
async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    throw new Error('Password verification failed');
  }
}

/**
 * Check if a hash needs rehashing (e.g., after security updates)
 * @param {string} hash - Current password hash
 * @returns {boolean} - True if rehashing is recommended
 */
function needsRehash(hash) {
  return argon2.needsRehash(hash, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  needsRehash
};