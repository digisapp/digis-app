import { supabase } from '../config/supabase';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3005';

// Helper to get auth token
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

// API service for saved creators
export const savedCreatorsAPI = {
  // Get all saved creators for the current user
  async getSavedCreators() {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/saved-creators`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch saved creators');

      const data = await response.json();
      return data.savedCreators || [];
    } catch (error) {
      console.error('Error fetching saved creators:', error);
      return [];
    }
  },

  // Check if a specific creator is saved
  async isCreatorSaved(creatorId) {
    try {
      const token = await getAuthToken();
      if (!token) return false;

      const response = await fetch(`${API_URL}/saved-creators/check/${creatorId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data.isSaved || false;
    } catch (error) {
      console.error('Error checking saved status:', error);
      return false;
    }
  },

  // Save a creator
  async saveCreator(creatorId, options = {}) {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/saved-creators`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          creatorId,
          notes: options.notes || '',
          notificationEnabled: options.notificationEnabled || false
        })
      });

      if (response.status === 409) {
        // Creator already saved
        return { success: true, alreadySaved: true };
      }

      if (!response.ok) throw new Error('Failed to save creator');

      const data = await response.json();
      return { success: true, ...data };
    } catch (error) {
      console.error('Error saving creator:', error);
      return { success: false, error: error.message };
    }
  },

  // Remove a saved creator
  async unsaveCreator(creatorId) {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/saved-creators/${creatorId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to unsave creator');

      return { success: true };
    } catch (error) {
      console.error('Error unsaving creator:', error);
      return { success: false, error: error.message };
    }
  },

  // Toggle save status
  async toggleSaveCreator(creatorId, currentlySaved) {
    if (currentlySaved) {
      return await this.unsaveCreator(creatorId);
    } else {
      return await this.saveCreator(creatorId);
    }
  },

  // Update saved creator settings (notes, notifications)
  async updateSavedCreator(creatorId, updates) {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/saved-creators/${creatorId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update saved creator');

      const data = await response.json();
      return { success: true, ...data };
    } catch (error) {
      console.error('Error updating saved creator:', error);
      return { success: false, error: error.message };
    }
  },

  // Get creators with notifications enabled
  async getNotificationEnabledCreators() {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/saved-creators/notifications-enabled`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch creators with notifications');

      const data = await response.json();
      return data.creators || [];
    } catch (error) {
      console.error('Error fetching notification-enabled creators:', error);
      return [];
    }
  }
};

// Hook for React components
import { useState, useEffect } from 'react';

export const useSavedCreators = () => {
  const [savedCreators, setSavedCreators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedCreators();
  }, []);

  const loadSavedCreators = async () => {
    setLoading(true);
    const creators = await savedCreatorsAPI.getSavedCreators();
    setSavedCreators(creators);
    setLoading(false);
  };

  const toggleSave = async (creatorId) => {
    const isSaved = savedCreators.some(c => c.creator_id === creatorId);
    const result = await savedCreatorsAPI.toggleSaveCreator(creatorId, isSaved);

    if (result.success) {
      if (isSaved) {
        setSavedCreators(prev => prev.filter(c => c.creator_id !== creatorId));
      } else {
        // Reload to get the full creator data
        await loadSavedCreators();
      }
    }

    return result;
  };

  return {
    savedCreators,
    loading,
    toggleSave,
    reload: loadSavedCreators
  };
};