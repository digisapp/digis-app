// Console log cleaner - only shows logs in development mode
const isDevelopment = import.meta.env.DEV || process.env.NODE_ENV === 'development';

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug
};

// Override console methods in production
if (!isDevelopment) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};

  // Keep warnings and errors but make them less verbose
  console.warn = (...args) => {
    // Filter out non-critical warnings
    const message = args.join(' ');
    if (message.includes('Socket') ||
        message.includes('retry') ||
        message.includes('throttled')) {
      return;
    }
    originalConsole.warn(...args);
  };

  console.error = (...args) => {
    // Filter out non-critical errors
    const message = args.join(' ');
    if (message.includes('Socket connection') ||
        message.includes('non-critical')) {
      return;
    }
    originalConsole.error(...args);
  };
}

// Export a safe logger for critical messages
export const logger = {
  critical: (...args) => originalConsole.error('[CRITICAL]', ...args),
  important: (...args) => {
    if (isDevelopment) {
      originalConsole.log('[INFO]', ...args);
    }
  },
  debug: (...args) => {
    if (isDevelopment) {
      originalConsole.debug('[DEBUG]', ...args);
    }
  }
};