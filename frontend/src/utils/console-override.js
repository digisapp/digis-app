// Smart console override for production - TEMPORARILY DISABLED FOR DEBUGGING
const isDev = true; // Force development mode to enable all console logs
const noop = () => {};

// Store original console methods
window._originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
  trace: console.trace
};

if (!isDev) {
  // In production, suppress most logs but keep critical errors
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.trace = noop;
  console.group = noop;
  console.groupEnd = noop;
  console.groupCollapsed = noop;
  console.table = noop;
  console.time = noop;
  console.timeEnd = noop;
  console.timeLog = noop;
  console.count = noop;
  console.countReset = noop;
  console.dir = noop;
  console.dirxml = noop;
  console.profile = noop;
  console.profileEnd = noop;
  console.timeStamp = noop;

  // Filter warnings - only show critical ones
  console.warn = (...args) => {
    const message = args.join(' ');
    // Filter out non-critical warnings
    if (message.includes('Socket') ||
        message.includes('retry') ||
        message.includes('throttled') ||
        message.includes('Multiple GoTrueClient')) {
      return;
    }
    window._originalConsole.warn(...args);
  };

  // Filter errors - only show critical ones
  console.error = (...args) => {
    const message = args.join(' ');
    // Filter out non-critical errors
    if (message.includes('Socket connection') ||
        message.includes('non-critical') ||
        message.includes('Rate limited') ||
        message.includes('Token refresh')) {
      return;
    }
    window._originalConsole.error(...args);
  };

  console.assert = (condition, ...args) => {
    if (!condition) {
      console.error('Assertion failed:', ...args);
    }
  };
} else {
  // In development, filter out noisy logs
  const originalLog = console.log;
  console.log = (...args) => {
    const message = args.join(' ');
    // Filter out very noisy logs
    if (message.includes('GoTrueClient@') ||
        message.includes('#_acquireLock') ||
        message.includes('lock acquired') ||
        message.includes('lock released')) {
      return;
    }
    originalLog(...args);
  };
}