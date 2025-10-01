/**
 * Token Configuration
 * Centralized token conversion rates and settings
 */

// Token to USD conversion rate
const TOKEN_TO_USD = process.env.TOKEN_TO_USD_RATE || 0.05; // $0.05 per token
const USD_TO_TOKEN = 1 / TOKEN_TO_USD; // 20 tokens per dollar

// Default token prices for different message types
const DEFAULT_MESSAGE_PRICES = {
  text: parseInt(process.env.DEFAULT_TEXT_MESSAGE_PRICE || '1'),
  image: parseInt(process.env.DEFAULT_IMAGE_MESSAGE_PRICE || '2'),
  audio: parseInt(process.env.DEFAULT_AUDIO_MESSAGE_PRICE || '3'),
  video: parseInt(process.env.DEFAULT_VIDEO_MESSAGE_PRICE || '5')
};

// Platform fee percentage (0-100)
const PLATFORM_FEE_PERCENTAGE = parseInt(process.env.PLATFORM_FEE_PERCENTAGE || '0');

module.exports = {
  TOKEN_TO_USD,
  USD_TO_TOKEN,
  DEFAULT_MESSAGE_PRICES,
  PLATFORM_FEE_PERCENTAGE,

  // Helper functions
  usdToTokens: (usd) => Math.ceil(usd * USD_TO_TOKEN),
  tokensToUsd: (tokens) => tokens * TOKEN_TO_USD,

  // Calculate platform fee
  calculatePlatformFee: (amount) => Math.floor(amount * PLATFORM_FEE_PERCENTAGE / 100),
  calculateCreatorEarnings: (amount) => Math.floor(amount * (100 - PLATFORM_FEE_PERCENTAGE) / 100)
};