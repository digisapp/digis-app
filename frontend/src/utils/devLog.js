// Development-only logging utility
// Strips all console logs in production builds to improve performance

const isDevelopment = import.meta.env.DEV || process.env.NODE_ENV === 'development';

// Main logging function
export const devLog = (...args) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

// Specialized log levels
export const devError = (...args) => {
  if (isDevelopment) {
    console.error(...args);
  }
};

export const devWarn = (...args) => {
  if (isDevelopment) {
    console.warn(...args);
  }
};

export const devInfo = (...args) => {
  if (isDevelopment) {
    console.info(...args);
  }
};

export const devTable = (data) => {
  if (isDevelopment && console.table) {
    console.table(data);
  }
};

export const devTime = (label) => {
  if (isDevelopment && console.time) {
    console.time(label);
  }
};

export const devTimeEnd = (label) => {
  if (isDevelopment && console.timeEnd) {
    console.timeEnd(label);
  }
};

// Group logging for better organization
export const devGroup = (label) => {
  if (isDevelopment && console.group) {
    console.group(label);
  }
};

export const devGroupCollapsed = (label) => {
  if (isDevelopment && console.groupCollapsed) {
    console.groupCollapsed(label);
  }
};

export const devGroupEnd = () => {
  if (isDevelopment && console.groupEnd) {
    console.groupEnd();
  }
};

// Performance logging
export const devPerf = (label, fn) => {
  if (isDevelopment) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`⏱ ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  }
  return fn();
};

// Assert for development checks
export const devAssert = (condition, message) => {
  if (isDevelopment && !condition) {
    console.error(`Assertion failed: ${message}`);
    if (console.trace) {
      console.trace();
    }
  }
};

// Default export for convenience
export default devLog;