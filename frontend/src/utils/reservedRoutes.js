// Reserved routes that cannot be used as usernames
export const RESERVED_ROUTES = [
  // Authentication
  'login',
  'signup',
  'signin',
  'register',
  'logout',
  'auth',
  
  // Main app pages
  'dashboard',
  'classes',
  'messages',
  'tokens',
  'wallet',
  'profile',
  'settings',
  'notifications',
  
  // Creator pages
  'studio',
  'earnings',
  'analytics',
  'apply',
  'creator',
  
  // Admin
  'admin',
  'moderator',
  'mod',
  
  // Public pages
  'about',
  'terms',
  'privacy',
  'help',
  'support',
  'contact',
  'faq',
  'blog',
  'press',
  'careers',
  
  // API and system
  'api',
  'graphql',
  'websocket',
  'ws',
  'static',
  'assets',
  'public',
  'cdn',
  
  // Call/session related
  'call',
  'video',
  'voice',
  'stream',
  'live',
  'broadcast',
  'session',
  
  // Payment related
  'payment',
  'payments',
  'checkout',
  'subscribe',
  'subscription',
  'billing',
  'invoice',
  
  // Common reserved words
  'home',
  'index',
  'root',
  'www',
  'mail',
  'email',
  'ftp',
  'test',
  'dev',
  'staging',
  'production',
  'app',
  'web',
  'mobile',
  
  // Social/platform specific
  'discover',
  'explore',
  'trending',
  'featured',
  'popular',
  'new',
  'top',
  'best',
  'all',
  
  // Digis specific
  'digis',
  'token',
  'tokens',
  'coin',
  'coins',
  'tip',
  'tips',
  'gift',
  'gifts',
  
  // Common usernames to block
  'user',
  'users',
  'member',
  'members',
  'account',
  'accounts',
  'guest',
  'anonymous',
  'anon',
  'deleted',
  'removed',
  'banned',
  'suspended',
  
  // File extensions and system
  'js',
  'css',
  'html',
  'json',
  'xml',
  'txt',
  'php',
  'asp',
  'jsp',
  'cgi',
  'exe',
  'bat',
  'sh',
  'cmd',
  
  // Single letters (optional, but recommended)
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
];

// Function to check if a username is reserved
export const isReservedUsername = (username) => {
  if (!username) return true;
  
  const normalizedUsername = username.toLowerCase().trim();
  
  // Check against reserved list
  if (RESERVED_ROUTES.includes(normalizedUsername)) {
    return true;
  }
  
  // Check for variations with common prefixes/suffixes
  const restrictedPrefixes = ['_', '-', '.'];
  const restrictedSuffixes = ['_', '-', '.', '-api', '_api', '-app', '_app'];
  
  for (const prefix of restrictedPrefixes) {
    if (normalizedUsername.startsWith(prefix)) {
      return true;
    }
  }
  
  for (const suffix of restrictedSuffixes) {
    if (normalizedUsername.endsWith(suffix)) {
      return true;
    }
  }
  
  // Check if it starts with numbers only
  if (/^\d+$/.test(normalizedUsername)) {
    return true;
  }
  
  return false;
};

// Function to validate username format
export const validateUsername = (username) => {
  if (!username) {
    return { valid: false, error: 'Username is required' };
  }
  
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  
  if (username.length > 30) {
    return { valid: false, error: 'Username must be less than 30 characters' };
  }
  
  // Only allow alphanumeric, underscore, and hyphen
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }
  
  // Must start with a letter or number
  if (!/^[a-zA-Z0-9]/.test(username)) {
    return { valid: false, error: 'Username must start with a letter or number' };
  }
  
  // Check if reserved
  if (isReservedUsername(username)) {
    return { valid: false, error: 'This username is reserved and cannot be used' };
  }
  
  return { valid: true };
};