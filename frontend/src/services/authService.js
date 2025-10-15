// Centralized authentication service
// Consolidates auth logic from multiple components

import { supabase } from '../utils/supabase-auth';
import { apiClient } from '../utils/apiClient';
import { devLog, devError } from '../utils/devLog';

class AuthService {
  constructor() {
    this.authStateCallbacks = new Set();
  }

  // Core authentication methods
  async signUp({ email, password, username, name, role = 'fan' }) {
    try {
      devLog('Starting signup process for:', email);

      // Step 1: Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            name,
            role
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user account');

      devLog('Supabase user created:', authData.user.id);

      // Step 2: Create or sync user profile
      const profileData = await this.createUserProfile({
        uid: authData.user.id,
        email,
        username,
        name,
        role
      });

      // Step 3: Store auth data locally
      this.storeAuthData({
        user: authData.user,
        profile: profileData,
        session: authData.session
      });

      return {
        success: true,
        user: authData.user,
        profile: profileData,
        session: authData.session
      };
    } catch (error) {
      devError('Signup error:', error);
      return {
        success: false,
        error: this.formatAuthError(error)
      };
    }
  }

  async signIn({ email, password }) {
    try {
      devLog('Starting signin process for:', email);

      // Step 1: Sign in with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Invalid credentials');

      devLog('Supabase signin successful:', authData.user.id);

      // Step 2: Sync user profile
      const profileData = await this.syncUserProfile(authData.user.id);

      // Step 3: Store auth data locally
      this.storeAuthData({
        user: authData.user,
        profile: profileData,
        session: authData.session
      });

      return {
        success: true,
        user: authData.user,
        profile: profileData,
        session: authData.session
      };
    } catch (error) {
      devError('Signin error:', error);
      return {
        success: false,
        error: this.formatAuthError(error)
      };
    }
  }

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      this.clearAuthData();
      this.notifyAuthStateChange(null);

      return { success: true };
    } catch (error) {
      devError('Signout error:', error);
      return {
        success: false,
        error: this.formatAuthError(error)
      };
    }
  }

  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Password reset email sent. Please check your inbox.'
      };
    } catch (error) {
      devError('Password reset error:', error);
      return {
        success: false,
        error: this.formatAuthError(error)
      };
    }
  }

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) throw error;
      if (!user) return null;

      // Get profile data if user exists
      const profile = await this.syncUserProfile(user.id);

      return {
        ...user,
        profile
      };
    } catch (error) {
      devError('Get current user error:', error);
      return null;
    }
  }

  async refreshSession() {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (error) throw error;
      if (!session) return null;

      return session;
    } catch (error) {
      devError('Session refresh error:', error);
      return null;
    }
  }

  // Profile management
  async createUserProfile({ uid, email, username, name, role }) {
    try {
      const response = await apiClient.post('/api/auth/sync-user', {
        uid,
        email,
        username,
        name,
        role
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user profile');
      }

      const data = await response.json();
      return data.user || data;
    } catch (error) {
      devError('Profile creation error:', error);
      // Return minimal profile on error
      return {
        uid,
        email,
        username,
        name,
        role,
        synced: false
      };
    }
  }

  async syncUserProfile(uid) {
    try {
      const response = await apiClient.get(`/api/users/${uid}/profile`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync profile');
      }

      const data = await response.json();
      const profile = data.user || data;

      // Update local storage with latest profile
      const stored = this.getStoredAuthData();
      if (stored) {
        stored.profile = profile;
        this.storeAuthData(stored);
      }

      return profile;
    } catch (error) {
      devError('Profile sync error:', error);
      return null;
    }
  }

  // Role inference - DEPRECATED: Callers should use useAuth().role instead
  inferUserRole(user, profile) {
    // Check multiple sources for role
    if (profile?.role) return profile.role;
    if (profile?.is_creator) return 'creator';
    if (user?.user_metadata?.role) return user.user_metadata.role;

    // NO localStorage reads - AuthContext is single source of truth

    return 'fan'; // Default role
  }

  isCreator(user, profile) {
    const role = this.inferUserRole(user, profile);
    return role === 'creator' || profile?.is_creator === true;
  }

  isAdmin(user, profile) {
    const role = this.inferUserRole(user, profile);
    return role === 'admin' || profile?.is_admin === true;
  }

  // Local storage management
  storeAuthData({ user, profile, session }) {
    try {
      if (user) {
        localStorage.setItem('authUser', JSON.stringify(user));
        localStorage.setItem('userId', user.id);
      }

      if (profile) {
        localStorage.setItem('userProfile', JSON.stringify(profile));
        // NO role localStorage writes - AuthContext is single source of truth
        localStorage.setItem('userName', profile.name || profile.username || '');
      }

      if (session) {
        localStorage.setItem('authSession', JSON.stringify(session));
        localStorage.setItem('accessToken', session.access_token);
      }

      devLog('Auth data stored locally');
    } catch (error) {
      devError('Failed to store auth data:', error);
    }
  }

  getStoredAuthData() {
    try {
      const user = localStorage.getItem('authUser');
      const profile = localStorage.getItem('userProfile');
      const session = localStorage.getItem('authSession');

      return {
        user: user ? JSON.parse(user) : null,
        profile: profile ? JSON.parse(profile) : null,
        session: session ? JSON.parse(session) : null
      };
    } catch (error) {
      devError('Failed to get stored auth data:', error);
      return null;
    }
  }

  clearAuthData() {
    const keysToRemove = [
      'authUser',
      'userProfile',
      'authSession',
      'userId',
      // NO role keys - AuthContext handles all role state
      'userName',
      'accessToken'
    ];

    keysToRemove.forEach(key => localStorage.removeItem(key));
    devLog('Auth data cleared');
  }

  // Auth state listeners
  onAuthStateChange(callback) {
    this.authStateCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.authStateCallbacks.delete(callback);
    };
  }

  notifyAuthStateChange(user) {
    this.authStateCallbacks.forEach(callback => {
      try {
        callback(user);
      } catch (error) {
        devError('Auth state callback error:', error);
      }
    });
  }

  // Error formatting
  formatAuthError(error) {
    if (typeof error === 'string') return error;

    const message = error.message || error.error_description || 'An error occurred';

    // Map common Supabase errors to user-friendly messages
    const errorMap = {
      'Invalid login credentials': 'Invalid email or password',
      'User already registered': 'An account with this email already exists',
      'Email not confirmed': 'Please verify your email before signing in',
      'Password should be at least 6 characters': 'Password must be at least 6 characters long',
      'Invalid email': 'Please enter a valid email address'
    };

    for (const [key, value] of Object.entries(errorMap)) {
      if (message.includes(key)) {
        return value;
      }
    }

    return message;
  }

  // Initialize auth state listener
  initialize() {
    // Listen for Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        devLog('Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await this.syncUserProfile(session.user.id);
          this.storeAuthData({
            user: session.user,
            profile,
            session
          });
          this.notifyAuthStateChange(session.user);
        } else if (event === 'SIGNED_OUT') {
          this.clearAuthData();
          this.notifyAuthStateChange(null);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          const stored = this.getStoredAuthData();
          if (stored) {
            stored.session = session;
            this.storeAuthData(stored);
          }
        }
      }
    );

    return subscription;
  }
}

// Export singleton instance
export const authService = new AuthService();

// Export for testing
export { AuthService };