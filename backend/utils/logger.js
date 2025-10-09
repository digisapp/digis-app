const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Detect serverless environment
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Create logs directory if it doesn't exist (skip on serverless)
let logsDir;
if (isServerless) {
  // On serverless, use /tmp (only writable directory)
  logsDir = '/tmp/logs';
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (err) {
    // Ignore filesystem errors on serverless - will use console only
    console.warn('Could not create logs directory (using console only):', err.message);
  }
} else {
  logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

// Create transports array
const transports = [];

// Always add console transport
transports.push(new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  )
}));

// Add file transports only if NOT on serverless
if (!isServerless) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log')
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'digis-backend',
    environment: process.env.NODE_ENV || 'development',
    serverless: isServerless
  },
  transports
});

module.exports = logger;