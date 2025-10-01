/**
 * Hook for managing collaborations
 * @module hooks/useCollaborations
 */

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../../utils/auth-helpers';

// Mock data for demonstration
const mockCollaborations = [
  {
    id: 1,
    title: 'Looking for co-host for cooking streams',
    description: 'I stream cooking content 3x/week and looking for someone to co-host themed cooking challenges.',
    creator: {
      id: 'creator1',
      name: 'ChefMaria',
      avatar: '/api/placeholder/40/40',
      rating: 4.8,
      followers: 12500
    },
    type: 'Co-streaming',
    categories: ['cooking', 'entertainment'],
    requirements: '5k+ followers, cooking experience',
    benefits: 'Revenue split, cross-promotion',
    postedAt: new Date(Date.now() - 86400000),
    applications: 5,
    status: 'open'
  },
  {
    id: 2,
    title: 'Fashion Week Coverage Partnership',
    description: 'Planning comprehensive Fashion Week coverage across multiple cities. Need partners for different locations.',
    creator: {
      id: 'creator2',
      name: 'StyleIcon',
      avatar: '/api/placeholder/40/40',
      rating: 4.9,
      followers: 45000
    },
    type: 'Content Series',
    categories: ['fashion', 'travel'],
    requirements: 'Fashion content creator, travel ready',
    benefits: 'Sponsored travel, brand deals',
    postedAt: new Date(Date.now() - 172800000),
    applications: 12,
    status: 'open'
  }
];

/**
 * Manages collaboration data and actions
 */
export const useCollaborations = (user) => {
  const [collaborations, setCollaborations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: 'all',
    type: 'all',
    sortBy: 'recent'
  });

  /**
   * Fetch collaborations
   */
  const fetchCollaborations = useCallback(async () => {
    try {
      let headers = {};
      if (user) {
        const authToken = await getAuthToken();
        headers = { 'Authorization': `Bearer ${authToken}` };
      }
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/public/collaborations`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Map API response to expected format
        const apiCollabs = (data.collaborations || []).map(collab => ({
          id: collab.id,
          title: collab.title,
          description: collab.description,
          creator: {
            id: collab.creator_id,
            name: collab.creator_name || collab.creator_username,
            avatar: collab.creator_avatar,
            rating: collab.creator_rating || 0,
            followers: collab.creator_followers || 0
          },
          type: collab.collaboration_type || 'Co-streaming',
          categories: collab.categories || [],
          requirements: collab.requirements,
          benefits: collab.benefits,
          postedAt: new Date(collab.created_at),
          applications: collab.applications_count || 0,
          status: collab.status || 'open'
        }));
        
        setCollaborations(apiCollabs.length > 0 ? apiCollabs : mockCollaborations);
      } else {
        setCollaborations(mockCollaborations);
      }
    } catch (error) {
      console.error('Error fetching collaborations:', error);
      setCollaborations(mockCollaborations);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Create new collaboration
   */
  const createCollaboration = useCallback(async (collaborationData) => {
    if (!user) {
      toast.error('Please sign in to create collaborations');
      return null;
    }

    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/collaborations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(collaborationData)
      });

      if (response.ok) {
        const newCollab = await response.json();
        toast.success('Collaboration created successfully!');
        
        // Add to local state
        setCollaborations(prev => [newCollab, ...prev]);
        return newCollab;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create collaboration');
      }
    } catch (error) {
      console.error('Error creating collaboration:', error);
      toast.error(error.message || 'Failed to create collaboration');
      return null;
    }
  }, [user]);

  /**
   * Apply to collaboration
   */
  const applyToCollaboration = useCallback(async (collaborationId, message) => {
    if (!user) {
      toast.error('Please sign in to apply for collaborations');
      return false;
    }

    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/collaborations/${collaborationId}/apply`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message })
        }
      );

      if (response.ok) {
        toast.success('Application sent successfully!');
        
        // Update local state
        setCollaborations(prev => prev.map(collab => 
          collab.id === collaborationId
            ? { ...collab, applications: collab.applications + 1 }
            : collab
        ));
        
        return true;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to apply');
      }
    } catch (error) {
      console.error('Error applying to collaboration:', error);
      toast.error(error.message || 'Failed to apply to collaboration');
      return false;
    }
  }, [user]);

  /**
   * Delete collaboration
   */
  const deleteCollaboration = useCallback(async (collaborationId) => {
    if (!user) {
      toast.error('Please sign in to delete collaborations');
      return false;
    }

    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/collaborations/${collaborationId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (response.ok) {
        toast.success('Collaboration deleted successfully');
        
        // Remove from local state
        setCollaborations(prev => prev.filter(collab => collab.id !== collaborationId));
        return true;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting collaboration:', error);
      toast.error(error.message || 'Failed to delete collaboration');
      return false;
    }
  }, [user]);

  /**
   * Filter collaborations
   */
  const getFilteredCollaborations = useCallback(() => {
    let filtered = [...collaborations];

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(collab => 
        collab.categories.includes(filters.category)
      );
    }

    // Type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(collab => 
        collab.type === filters.type
      );
    }

    // Sort
    switch (filters.sortBy) {
      case 'recent':
        filtered.sort((a, b) => b.postedAt - a.postedAt);
        break;
      case 'popular':
        filtered.sort((a, b) => b.applications - a.applications);
        break;
      case 'followers':
        filtered.sort((a, b) => b.creator.followers - a.creator.followers);
        break;
      default:
        break;
    }

    return filtered;
  }, [collaborations, filters]);

  useEffect(() => {
    fetchCollaborations();
  }, [fetchCollaborations]);

  return {
    collaborations: getFilteredCollaborations(),
    loading,
    filters,
    setFilters,
    createCollaboration,
    applyToCollaboration,
    deleteCollaboration,
    refetchCollaborations: fetchCollaborations
  };
};

export default useCollaborations;