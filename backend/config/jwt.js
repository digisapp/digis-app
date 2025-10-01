/**
 * JWT Configuration for Enhanced Security
 * - Short-lived access tokens (15 minutes)
 * - Long-lived refresh tokens (7 days)
 * - Secure token rotation
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT Configuration
const JWT_CONFIG = {
  accessToken: {
    secret: process.env.JWT_ACCESS_SECRET || crypto.randomBytes(64).toString('hex'),
    expiresIn: '15m', // 15 minutes
    issuer: 'digis-api',
    audience: 'digis-app'
  },
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex'),
    expiresIn: '7d', // 7 days
    issuer: 'digis-api',
    audience: 'digis-app'
  }
};

// Generate access token
const generateAccessToken = (user) => {
  const payload = {
    id: user.supabase_id,
    email: user.email,
    username: user.username,
    isCreator: user.is_creator || false,
    type: 'access'
  };

  return jwt.sign(payload, JWT_CONFIG.accessToken.secret, {
    expiresIn: JWT_CONFIG.accessToken.expiresIn,
    issuer: JWT_CONFIG.accessToken.issuer,
    audience: JWT_CONFIG.accessToken.audience,
    subject: user.supabase_id.toString()
  });
};

// Generate refresh token
const generateRefreshToken = (user) => {
  const payload = {
    id: user.supabase_id,
    tokenId: crypto.randomBytes(32).toString('hex'), // Unique token ID for rotation
    type: 'refresh'
  };

  return jwt.sign(payload, JWT_CONFIG.refreshToken.secret, {
    expiresIn: JWT_CONFIG.refreshToken.expiresIn,
    issuer: JWT_CONFIG.refreshToken.issuer,
    audience: JWT_CONFIG.refreshToken.audience,
    subject: user.supabase_id.toString()
  });
};

// Verify access token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.accessToken.secret, {
      issuer: JWT_CONFIG.accessToken.issuer,
      audience: JWT_CONFIG.accessToken.audience
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Access token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid access token');
    }
    throw error;
  }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.refreshToken.secret, {
      issuer: JWT_CONFIG.refreshToken.issuer,
      audience: JWT_CONFIG.refreshToken.audience
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
};

// Decode token without verification (for debugging)
const decodeToken = (token) => {
  return jwt.decode(token);
};

// Check if token is expired
const isTokenExpired = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch {
    return true;
  }
};

// Get token expiry time
const getTokenExpiry = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return null;

    return new Date(decoded.exp * 1000);
  } catch {
    return null;
  }
};

module.exports = {
  JWT_CONFIG,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  isTokenExpired,
  getTokenExpiry
};