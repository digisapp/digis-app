// Store selectors for consistent state access

// Creator status selector - single source of truth
export const selectIsCreator = (state) => {
  // Check store state first
  if (state.isCreator) return true;

  // Check profile data
  if (state.profile?.is_creator === true) return true;
  if (state.profile?.role === 'creator') return true;

  // Check user metadata
  if (state.user?.user_metadata?.is_creator === true) return true;
  if (state.user?.user_metadata?.role === 'creator') return true;

  // Check localStorage as fallback
  if (typeof localStorage !== 'undefined') {
    const storedIsCreator = localStorage.getItem('userIsCreator');
    if (storedIsCreator === 'true') return true;

    const storedRole = localStorage.getItem('userRole');
    if (storedRole === 'creator') return true;
  }

  return false;
};

// Admin status selector
export const selectIsAdmin = (state) => {
  // Check store state
  if (state.isAdmin) return true;

  // Check profile data
  if (state.profile?.is_admin === true) return true;
  if (state.profile?.role === 'admin') return true;

  // Check user metadata
  if (state.user?.user_metadata?.is_admin === true) return true;
  if (state.user?.user_metadata?.role === 'admin') return true;

  // Check localStorage as fallback
  if (typeof localStorage !== 'undefined') {
    const storedRole = localStorage.getItem('userRole');
    if (storedRole === 'admin') return true;
  }

  return false;
};

// Authentication status selector
export const selectIsAuthenticated = (state) => {
  return !!(state.user?.uid || state.user?.id);
};

// Token balance selector
export const selectTokenBalance = (state) => {
  return state.tokenBalance || 0;
};

// Current view selector
export const selectCurrentView = (state) => {
  return state.currentView || 'home';
};

// User profile selector
export const selectUserProfile = (state) => {
  return state.profile || null;
};

// User data selector
export const selectUser = (state) => {
  return state.user || null;
};

// Combined user data selector
export const selectFullUserData = (state) => {
  const user = selectUser(state);
  const profile = selectUserProfile(state);
  const isCreator = selectIsCreator(state);
  const isAdmin = selectIsAdmin(state);

  return {
    ...user,
    ...profile,
    isCreator,
    isAdmin,
    isAuthenticated: selectIsAuthenticated(state)
  };
};

// Notifications selector
export const selectNotifications = (state) => {
  return state.notifications || [];
};

// Unread notifications count selector
export const selectUnreadNotificationCount = (state) => {
  const notifications = selectNotifications(state);
  return notifications.filter(n => !n.isRead).length;
};

// Loading states selectors
export const selectIsLoading = (state) => {
  return state.loading || false;
};

export const selectLoadingStates = (state) => {
  return {
    auth: state.authLoading || false,
    profile: state.profileLoading || false,
    content: state.contentLoading || false,
    messages: state.messagesLoading || false
  };
};

// Creator-specific selectors
export const selectCreatorStats = (state) => {
  if (!selectIsCreator(state)) return null;

  return {
    followers: state.followers || 0,
    subscribers: state.subscribers || 0,
    totalEarnings: state.totalEarnings || 0,
    pendingPayouts: state.pendingPayouts || 0
  };
};

// Mobile/desktop selector
export const selectIsMobile = (state) => {
  return state.isMobile || false;
};

// Theme selector
export const selectTheme = (state) => {
  return state.theme || 'light';
};

// Settings selectors
export const selectSettings = (state) => {
  return {
    notifications: state.notificationSettings || {},
    privacy: state.privacySettings || {},
    appearance: state.appearanceSettings || {}
  };
};

// Active calls selector
export const selectActiveCalls = (state) => {
  return state.activeCalls || [];
};

// Messages/conversations selector
export const selectConversations = (state) => {
  return state.conversations || [];
};

export const selectUnreadMessagesCount = (state) => {
  const conversations = selectConversations(state);
  return conversations.reduce((total, conv) => {
    return total + (conv.unreadCount || 0);
  }, 0);
};

// Export all selectors as a collection
export const selectors = {
  selectIsCreator,
  selectIsAdmin,
  selectIsAuthenticated,
  selectTokenBalance,
  selectCurrentView,
  selectUserProfile,
  selectUser,
  selectFullUserData,
  selectNotifications,
  selectUnreadNotificationCount,
  selectIsLoading,
  selectLoadingStates,
  selectCreatorStats,
  selectIsMobile,
  selectTheme,
  selectSettings,
  selectActiveCalls,
  selectConversations,
  selectUnreadMessagesCount
};