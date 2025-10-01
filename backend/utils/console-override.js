const logger = require('./logger');

// Override console methods in production to use structured logging
function overrideConsole() {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (!isDevelopment) {
    // Store original console methods for emergencies
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };

    // Override console.log
    console.log = (...args) => {
      logger.info('console.log', {
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '),
        stack: new Error().stack
      });
    };

    // Override console.error
    console.error = (...args) => {
      logger.error('console.error', {
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '),
        stack: new Error().stack
      });
    };

    // Override console.warn
    console.warn = (...args) => {
      logger.warn('console.warn', {
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')
      });
    };

    // Override console.info
    console.info = (...args) => {
      logger.info('console.info', {
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')
      });
    };

    // Override console.debug
    console.debug = (...args) => {
      logger.debug('console.debug', {
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')
      });
    };

    // Provide emergency restore function
    global.__restoreConsole = () => {
      Object.assign(console, originalConsole);
    };

    logger.info('Console methods overridden in production mode');
  }
}

module.exports = { overrideConsole };