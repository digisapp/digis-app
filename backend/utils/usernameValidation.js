// Username validation utilities

// Reserved routes that cannot be used as usernames
const RESERVED_USERNAMES = [
  // Authentication
  'login', 'signup', 'signin', 'register', 'logout', 'auth',
  
  // Main app pages
  'dashboard', 'classes', 'messages', 'tokens', 'wallet', 'profile',
  'settings', 'notifications',
  
  // Creator pages
  'creator-studio', 'studio', 'earnings', 'analytics', 'apply', 'creator',
  
  // Admin
  'admin', 'moderator', 'mod',
  
  // Public pages
  'about', 'terms', 'privacy', 'help', 'support', 'contact', 'faq',
  'blog', 'press', 'careers',
  
  // API and system
  'api', 'graphql', 'websocket', 'ws', 'static', 'assets', 'public', 'cdn',
  
  // Call/session related
  'call', 'video', 'voice', 'stream', 'live', 'broadcast', 'session',
  
  // Payment related
  'payment', 'payments', 'checkout', 'subscribe', 'subscription',
  'billing', 'invoice',
  
  // Common reserved words
  'home', 'index', 'root', 'www', 'mail', 'email', 'ftp', 'test',
  'dev', 'staging', 'production', 'app', 'web', 'mobile',
  
  // Social/platform specific
  'discover', 'explore', 'trending', 'featured', 'popular', 'new',
  'top', 'best', 'all',
  
  // Digis specific
  'digis', 'token', 'tokens', 'coin', 'coins', 'tip', 'tips',
  'gift', 'gifts',
  
  // Common usernames to block
  'user', 'users', 'member', 'members', 'account', 'accounts',
  'guest', 'anonymous', 'anon', 'deleted', 'removed', 'banned', 'suspended'
];

// Validate username format and availability
const validateUsername = (username) => {
  const errors = [];
  
  if (!username) {
    errors.push('Username is required');
    return { valid: false, errors };
  }
  
  // Convert to lowercase for validation
  const normalizedUsername = username.toLowerCase().trim();
  
  // Length validation
  if (normalizedUsername.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  if (normalizedUsername.length > 30) {
    errors.push('Username must be less than 30 characters long');
  }
  
  // Format validation - only alphanumeric, underscore, and hyphen
  if (!/^[a-zA-Z0-9_-]+$/.test(normalizedUsername)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }
  
  // Must start with a letter or number
  if (!/^[a-zA-Z0-9]/.test(normalizedUsername)) {
    errors.push('Username must start with a letter or number');
  }
  
  // Check reserved usernames
  if (RESERVED_USERNAMES.includes(normalizedUsername)) {
    errors.push('This username is reserved and cannot be used');
  }
  
  // Check for problematic patterns
  const restrictedPrefixes = ['_', '-', '.'];
  const restrictedSuffixes = ['_', '-', '.', '-api', '_api', '-app', '_app'];
  
  for (const prefix of restrictedPrefixes) {
    if (normalizedUsername.startsWith(prefix)) {
      errors.push('Username cannot start with special characters');
      break;
    }
  }
  
  for (const suffix of restrictedSuffixes) {
    if (normalizedUsername.endsWith(suffix)) {
      errors.push('Username cannot end with restricted suffixes');
      break;
    }
  }
  
  // Check if it's only numbers
  if (/^\d+$/.test(normalizedUsername)) {
    errors.push('Username cannot be only numbers');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    normalizedUsername
  };
};

// Check if username is available in database
const checkUsernameAvailability = async (username, db, excludeUserId = null) => {
  try {
    const normalizedUsername = username.toLowerCase().trim();
    
    // Build query
    let query = 'SELECT uid FROM users WHERE LOWER(username) = $1';
    const params = [normalizedUsername];
    
    // Exclude current user if updating
    if (excludeUserId) {
      query += ' AND uid != $2';
      params.push(excludeUserId);
    }
    
    const result = await db.query(query, params);
    
    return {
      available: result.rows.length === 0,
      exists: result.rows.length > 0
    };
  } catch (error) {
    console.error('Error checking username availability:', error);
    throw error;
  }
};

// Generate username suggestions based on a base name
const generateUsernameSuggestions = async (baseName, db, count = 5) => {
  const suggestions = [];
  const cleanBase = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (cleanBase.length < 3) {
    return suggestions;
  }
  
  // Try different patterns
  const patterns = [
    () => cleanBase,
    () => `${cleanBase}${Math.floor(Math.random() * 999)}`,
    () => `${cleanBase}_${Math.floor(Math.random() * 99)}`,
    () => `the_${cleanBase}`,
    () => `${cleanBase}_official`,
    () => `real_${cleanBase}`,
    () => `${cleanBase}${new Date().getFullYear()}`
  ];
  
  for (const pattern of patterns) {
    if (suggestions.length >= count) break;
    
    const username = pattern();
    const validation = validateUsername(username);
    
    if (validation.valid) {
      const availability = await checkUsernameAvailability(username, db);
      if (availability.available) {
        suggestions.push(username);
      }
    }
  }
  
  return suggestions;
};

module.exports = {
  validateUsername,
  checkUsernameAvailability,
  generateUsernameSuggestions,
  RESERVED_USERNAMES
};