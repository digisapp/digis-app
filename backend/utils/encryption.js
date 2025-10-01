const crypto = require('crypto');
const { logger } = require('./secureLogger');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

class EncryptionService {
  constructor() {
    this.masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!this.masterKey) {
      logger.error('ENCRYPTION_MASTER_KEY not set in environment');
      throw new Error('Encryption key not configured');
    }
  }

  /**
   * Derive key from master key and salt
   */
  deriveKey(salt) {
    return crypto.pbkdf2Sync(this.masterKey, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  }

  /**
   * Encrypt sensitive data
   * @param {string|object} data - Data to encrypt
   * @returns {string} Encrypted data with metadata
   */
  encrypt(data) {
    try {
      // Convert object to string if needed
      const text = typeof data === 'object' ? JSON.stringify(data) : String(data);
      
      // Generate random salt and IV
      const salt = crypto.randomBytes(SALT_LENGTH);
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Derive key from salt
      const key = this.deriveKey(salt);
      
      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final()
      ]);
      
      // Get auth tag
      const tag = cipher.getAuthTag();
      
      // Combine all components
      const combined = Buffer.concat([
        salt,
        iv,
        tag,
        encrypted
      ]);
      
      // Return base64 encoded
      return combined.toString('base64');
    } catch (error) {
      logger.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @returns {string|object} Decrypted data
   */
  decrypt(encryptedData) {
    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const salt = combined.slice(0, SALT_LENGTH);
      const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const tag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
      const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
      
      // Derive key
      const key = this.deriveKey(salt);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]).toString('utf8');
      
      // Try to parse as JSON
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (error) {
      logger.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash sensitive data (one-way)
   * @param {string} data - Data to hash
   * @returns {string} Hashed data
   */
  hash(data) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const hash = crypto.pbkdf2Sync(data, salt, PBKDF2_ITERATIONS, 64, 'sha512');
    return salt.toString('hex') + ':' + hash.toString('hex');
  }

  /**
   * Verify hashed data
   * @param {string} data - Plain data to verify
   * @param {string} hashedData - Previously hashed data
   * @returns {boolean} Match result
   */
  verifyHash(data, hashedData) {
    const [salt, hash] = hashedData.split(':');
    const verifyHash = crypto.pbkdf2Sync(
      data,
      Buffer.from(salt, 'hex'),
      PBKDF2_ITERATIONS,
      64,
      'sha512'
    );
    return hash === verifyHash.toString('hex');
  }

  /**
   * Encrypt bank account details
   * @param {object} bankDetails - Bank account information
   * @returns {string} Encrypted bank details
   */
  encryptBankDetails(bankDetails) {
    // Validate required fields
    const required = ['accountNumber', 'routingNumber'];
    for (const field of required) {
      if (!bankDetails[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Add metadata
    const dataToEncrypt = {
      ...bankDetails,
      encryptedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    return this.encrypt(dataToEncrypt);
  }

  /**
   * Decrypt bank account details
   * @param {string} encryptedData - Encrypted bank details
   * @returns {object} Bank account information
   */
  decryptBankDetails(encryptedData) {
    const decrypted = this.decrypt(encryptedData);
    
    // Remove metadata before returning
    const { encryptedAt, version, ...bankDetails } = decrypted;
    
    return bankDetails;
  }

  /**
   * Generate secure random token
   * @param {number} length - Token length
   * @returns {string} Random token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate secure API key
   * @returns {string} API key
   */
  generateApiKey() {
    const prefix = 'dk_live_'; // digis key
    const key = crypto.randomBytes(32).toString('hex');
    return prefix + key;
  }

  /**
   * Mask sensitive data for logging
   * @param {string} data - Data to mask
   * @param {number} visibleChars - Number of visible characters
   * @returns {string} Masked data
   */
  mask(data, visibleChars = 4) {
    if (!data || data.length <= visibleChars) {
      return '****';
    }
    
    const visible = data.slice(-visibleChars);
    const masked = '*'.repeat(Math.max(4, data.length - visibleChars));
    return masked + visible;
  }

  /**
   * Encrypt file
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} filename - Original filename
   * @returns {object} Encrypted file data and metadata
   */
  encryptFile(fileBuffer, filename) {
    try {
      // Generate file key
      const fileKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Encrypt file
      const cipher = crypto.createCipheriv(ALGORITHM, fileKey, iv);
      const encrypted = Buffer.concat([
        cipher.update(fileBuffer),
        cipher.final()
      ]);
      const tag = cipher.getAuthTag();
      
      // Encrypt file key with master key
      const encryptedKey = this.encrypt(fileKey.toString('base64'));
      
      // Create metadata
      const metadata = {
        filename,
        size: fileBuffer.length,
        encryptedAt: new Date().toISOString(),
        algorithm: ALGORITHM,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        key: encryptedKey
      };
      
      return {
        encrypted,
        metadata
      };
    } catch (error) {
      logger.error('File encryption error:', error);
      throw new Error('Failed to encrypt file');
    }
  }

  /**
   * Decrypt file
   * @param {Buffer} encryptedBuffer - Encrypted file buffer
   * @param {object} metadata - File metadata
   * @returns {Buffer} Decrypted file
   */
  decryptFile(encryptedBuffer, metadata) {
    try {
      // Decrypt file key
      const fileKey = Buffer.from(this.decrypt(metadata.key), 'base64');
      const iv = Buffer.from(metadata.iv, 'base64');
      const tag = Buffer.from(metadata.tag, 'base64');
      
      // Decrypt file
      const decipher = crypto.createDecipheriv(metadata.algorithm || ALGORITHM, fileKey, iv);
      decipher.setAuthTag(tag);
      
      return Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
      ]);
    } catch (error) {
      logger.error('File decryption error:', error);
      throw new Error('Failed to decrypt file');
    }
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();

// Helper functions for backward compatibility
const encrypt = (data) => encryptionService.encrypt(data);
const decrypt = (data) => encryptionService.decrypt(data);
const encryptBankDetails = (details) => encryptionService.encryptBankDetails(details);
const decryptBankDetails = (data) => encryptionService.decryptBankDetails(data);
const generateToken = (length) => encryptionService.generateToken(length);
const generateApiKey = () => encryptionService.generateApiKey();
const mask = (data, chars) => encryptionService.mask(data, chars);

module.exports = {
  encryptionService,
  encrypt,
  decrypt,
  encryptBankDetails,
  decryptBankDetails,
  generateToken,
  generateApiKey,
  mask
};