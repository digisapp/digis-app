// Logger utility with environment-based output control
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Log levels
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Current log level based on environment
const currentLogLevel = isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR;

// Format timestamp for logs
const timestamp = () => new Date().toISOString();

// Logger implementation
class Logger {
  constructor(prefix = '[DIGIS]') {
    this.prefix = prefix;
  }

  debug(...args) {
    if (currentLogLevel <= LogLevel.DEBUG && !isTest) {
      console.log(`${timestamp()} ${this.prefix}[DEBUG]`, ...args);
    }
  }

  info(...args) {
    if (currentLogLevel <= LogLevel.INFO && !isTest) {
      console.info(`${timestamp()} ${this.prefix}[INFO]`, ...args);
    }
  }

  log(...args) {
    this.info(...args); // Alias for info
  }

  warn(...args) {
    if (currentLogLevel <= LogLevel.WARN && !isTest) {
      console.warn(`${timestamp()} ${this.prefix}[WARN]`, ...args);
    }
  }

  error(...args) {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(`${timestamp()} ${this.prefix}[ERROR]`, ...args);
    }
  }

  // Create a child logger with additional prefix
  child(childPrefix) {
    return new Logger(`${this.prefix}[${childPrefix}]`);
  }

  // Performance timing helper
  time(label) {
    if (isDevelopment && !isTest) {
      console.time(`${this.prefix} ${label}`);
    }
  }

  timeEnd(label) {
    if (isDevelopment && !isTest) {
      console.timeEnd(`${this.prefix} ${label}`);
    }
  }

  // Group related logs
  group(label) {
    if (isDevelopment && !isTest) {
      console.group(`${this.prefix} ${label}`);
    }
  }

  groupEnd() {
    if (isDevelopment && !isTest) {
      console.groupEnd();
    }
  }
}

// Create default logger instance
const logger = new Logger();

// Export both class and default instance
export { Logger, logger as default };

// Convenience exports for direct use
export const log = (...args) => logger.log(...args);
export const debug = (...args) => logger.debug(...args);
export const info = (...args) => logger.info(...args);
export const warn = (...args) => logger.warn(...args);
export const error = (...args) => logger.error(...args);