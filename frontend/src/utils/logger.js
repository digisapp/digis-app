/**
 * Logger utility - Centralized logging with environment awareness
 *
 * Replaces scattered console.log statements throughout the app.
 * In production, debug logs are disabled for performance.
 */

const isDevelopment = import.meta.env.MODE === 'development';
const isTest = import.meta.env.MODE === 'test';

// Log levels
const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Current log level (can be configured)
const currentLevel = isDevelopment || isTest ? LEVELS.DEBUG : LEVELS.WARN;

/**
 * Format log message with timestamp and category
 */
const formatMessage = (category, message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  return [`[${timestamp}] [${category}]`, message, ...args];
};

/**
 * Logger class
 */
class Logger {
  constructor(category) {
    this.category = category;
  }

  debug(message, ...args) {
    if (currentLevel <= LEVELS.DEBUG) {
      console.log(...formatMessage(this.category, message, ...args));
    }
  }

  info(message, ...args) {
    if (currentLevel <= LEVELS.INFO) {
      console.info(...formatMessage(this.category, message, ...args));
    }
  }

  warn(message, ...args) {
    if (currentLevel <= LEVELS.WARN) {
      console.warn(...formatMessage(this.category, message, ...args));
    }
  }

  error(message, ...args) {
    if (currentLevel <= LEVELS.ERROR) {
      console.error(...formatMessage(this.category, message, ...args));
    }
  }

  /**
   * Device detection logs (replaces duplicate device logging)
   */
  device(deviceInfo) {
    if (isDevelopment) {
      this.debug('Device detection:', deviceInfo);
    }
  }

  /**
   * Auth state logs (replaces scattered auth logging)
   */
  auth(event, data) {
    if (isDevelopment) {
      const emoji = {
        'login': '🔐',
        'logout': '🚪',
        'profile': '👤',
        'token': '💰',
        'session': '🔑',
        'error': '❌'
      }[event] || '🔵';

      this.debug(`${emoji} ${event}:`, data);
    }
  }

  /**
   * Socket logs (replaces socket logging)
   */
  socket(event, data) {
    if (isDevelopment) {
      const emoji = {
        'connected': '📡',
        'disconnected': '📴',
        'call': '📞',
        'message': '💬',
        'balance': '💰',
        'error': '❌'
      }[event] || '🔵';

      this.debug(`${emoji} Socket ${event}:`, data);
    }
  }

  /**
   * Modal logs (replaces modal logging)
   */
  modal(action, modalName, props = {}) {
    if (isDevelopment) {
      const emoji = action === 'open' ? '🔵' : '🔴';
      this.debug(`${emoji} Modal ${action}:`, modalName, props);
    }
  }

  /**
   * Route logs (replaces navigation logging)
   */
  route(from, to) {
    if (isDevelopment) {
      this.debug('➡️ Route change:', { from, to });
    }
  }
}

/**
 * Create logger instance for a category
 */
export const createLogger = (category) => new Logger(category);

/**
 * Default logger instance
 */
export const logger = new Logger('App');

/**
 * Category-specific loggers
 */
export const authLogger = new Logger('Auth');
export const socketLogger = new Logger('Socket');
export const modalLogger = new Logger('Modal');
export const deviceLogger = new Logger('Device');
export const routeLogger = new Logger('Route');

export default logger;
