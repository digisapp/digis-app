/**
 * Utility functions for filtering and managing creator data
 */

/**
 * Universal "is self" checker - works for any user-like object
 * Checks both IDs and usernames for maximum reliability
 * Use this as the single source of truth across the entire app
 *
 * @param {Object} userLike - Any object representing a user (creator, follower, subscriber, etc.)
 * @param {string} currentUserId - Current user's ID to compare against
 * @param {string} currentUsername - Current user's username to compare against
 * @returns {boolean} - True if userLike is the current user
 */
export function isSelf(userLike, currentUserId, currentUsername) {
  if (!userLike || (!currentUserId && !currentUsername)) return false;

  // Normalize all known ID shapes we've seen in the app
  const ids = [
    userLike.id,
    userLike.uid,
    userLike.user_id,
    userLike.supabase_id,
    userLike.profile?.user_id,
  ].filter(Boolean).map(String);

  // Normalize all known username fields
  const names = [
    userLike.username,
    userLike.handle,
    userLike.profile?.username
  ].filter(Boolean).map(String);

  return (
    (currentUserId && ids.includes(String(currentUserId))) ||
    (currentUsername && names.includes(String(currentUsername)))
  );
}

/**
 * Legacy alias for backwards compatibility
 * @deprecated Use isSelf() instead
 */
export function isSelfCreator(creator, currentUserId, currentUsername) {
  return isSelf(creator, currentUserId, currentUsername);
}

/**
 * Filter out the current user from a list of creators
 * Used in Explore pages to prevent creators from seeing themselves
 *
 * @param {Array} creators - Array of creator objects
 * @param {string} currentUserId - Current user's ID
 * @returns {Array} - Filtered array without the current user
 */
export function filterSelfFromCreators(creators, currentUserId) {
  if (!Array.isArray(creators) || !currentUserId) return creators;

  return creators.filter(creator => !isSelfCreator(creator, currentUserId));
}

/**
 * Legacy alias for backwards compatibility
 * @deprecated Use isSelf() instead
 */
export function isSelfUser(user, currentUserId, currentUsername) {
  return isSelf(user, currentUserId, currentUsername);
}

/**
 * Filter out the current user from a list of users (followers/subscribers)
 *
 * @param {Array} users - Array of user objects
 * @param {string} currentUserId - Current user's ID
 * @returns {Array} - Filtered array without the current user
 */
export function filterSelfFromUsers(users, currentUserId) {
  if (!Array.isArray(users) || !currentUserId) return users;

  return users.filter(user => !isSelfUser(user, currentUserId));
}
