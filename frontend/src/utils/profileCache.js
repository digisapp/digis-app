// Profile cache utility for persisting user profile across sessions
// This ensures profile data survives page refreshes

const PROFILE_CACHE_KEY = 'digis-profile-cache-v2';
const CACHE_VERSION = '2.0';
const DEFAULT_CACHE_EXPIRY_DAYS = 7;

/**
 * Save profile to localStorage cache
 * @param {Object} profile - User profile object
 * @param {Object} session - Supabase session object (optional, for expiry sync)
 */
export const saveProfileCache = (profile, session = null) => {
  console.log('🔵 saveProfileCache called with:', profile?.username, profile?.email);

  if (!profile || !profile.email) {
    console.warn('⚠️ Cannot cache invalid profile:', profile);
    return;
  }

  try {
    // Use session expiry if available, otherwise default to 7 days
    let expiresAt;
    if (session?.expires_at) {
      // Session expires_at is in Unix seconds
      expiresAt = session.expires_at;
      console.log('📅 Using session expiry:', new Date(expiresAt * 1000).toLocaleString());
    } else {
      // Default to 7 days from now (in Unix seconds)
      expiresAt = Math.floor(Date.now() / 1000) + (DEFAULT_CACHE_EXPIRY_DAYS * 24 * 60 * 60);
      console.log('📅 Using default 7-day expiry:', new Date(expiresAt * 1000).toLocaleString());
    }

    const cacheData = {
      version: CACHE_VERSION,
      timestamp: Math.floor(Date.now() / 1000), // Unix seconds for consistency
      expiresAt: expiresAt, // Unix seconds
      profile: {
        id: profile.id,
        supabase_id: profile.supabase_id,
        email: profile.email,
        username: profile.username,
        display_name: profile.display_name,
        bio: profile.bio,
        profile_pic_url: profile.profile_pic_url,
        banner_url: profile.banner_url,
        is_creator: profile.is_creator,
        is_super_admin: profile.is_super_admin,
        role: profile.role,
        creator_type: profile.creator_type,
        verified: profile.verified,
        token_balance: profile.token_balance,
      }
    };

    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cacheData));
    console.log('✅ Profile cached successfully:', {
      username: profile.username,
      email: profile.email,
      is_creator: profile.is_creator,
      expiresAt: new Date(expiresAt * 1000).toLocaleString(),
      cacheKey: PROFILE_CACHE_KEY
    });

    // Verify it was saved
    const verification = localStorage.getItem(PROFILE_CACHE_KEY);
    console.log('🔍 Cache verification - saved to localStorage:', !!verification);
  } catch (error) {
    console.error('❌ Failed to cache profile:', error);
  }
};

/**
 * Load profile from localStorage cache
 * @returns {Object|null} Cached profile or null if not found/expired
 */
export const loadProfileCache = () => {
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) {
      console.log('📦 No profile cache found');
      return null;
    }

    const cacheData = JSON.parse(cached);

    // Check version - allow migration from v1.0 to v2.0
    if (cacheData.version !== CACHE_VERSION) {
      // If it's the old version, try to migrate it
      if (cacheData.version === '1.0') {
        console.log('📦 Migrating cache from v1.0 to v2.0');
        // Old cache used milliseconds, new uses seconds
        const expiresAtSeconds = Math.floor(cacheData.expiresAt / 1000);
        cacheData.expiresAt = expiresAtSeconds;
        cacheData.timestamp = Math.floor(cacheData.timestamp / 1000);
        cacheData.version = CACHE_VERSION;
      } else {
        console.warn('⚠️ Profile cache version mismatch, clearing');
        clearProfileCache();
        return null;
      }
    }

    // Check expiry (cacheData.expiresAt is in Unix seconds)
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds > cacheData.expiresAt) {
      console.warn('⚠️ Profile cache expired, clearing', {
        now: new Date(nowSeconds * 1000).toLocaleString(),
        expiresAt: new Date(cacheData.expiresAt * 1000).toLocaleString()
      });
      clearProfileCache();
      return null;
    }

    const ageMinutes = Math.floor((nowSeconds - cacheData.timestamp) / 60);
    console.log('✅ Profile loaded from cache:', {
      username: cacheData.profile.username,
      email: cacheData.profile.email,
      is_creator: cacheData.profile.is_creator,
      age: ageMinutes + ' minutes',
      expiresIn: Math.floor((cacheData.expiresAt - nowSeconds) / 3600) + ' hours'
    });

    return cacheData.profile;
  } catch (error) {
    console.error('❌ Failed to load profile cache:', error);
    clearProfileCache();
    return null;
  }
};

/**
 * Clear profile cache
 */
export const clearProfileCache = () => {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
    console.log('🧹 Profile cache cleared');
  } catch (error) {
    console.error('❌ Failed to clear profile cache:', error);
  }
};

/**
 * Check if profile cache exists and is valid
 * @returns {boolean}
 */
export const hasValidProfileCache = () => {
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) return false;

    const cacheData = JSON.parse(cached);
    return cacheData.version === CACHE_VERSION && Date.now() <= cacheData.expiresAt;
  } catch {
    return false;
  }
};
