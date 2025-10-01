/**
 * Hook for managing experiences/trips
 * @module hooks/useExperiences
 */

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../../utils/auth-helpers';

// Mock trips data
const mockTrips = [
  {
    id: 1,
    destination: 'Miami Beach Retreat',
    location: 'Miami, Florida',
    dates: 'March 15-20, 2024',
    organizer: 'Digis',
    organizerAvatar: '🌴',
    description: 'Exclusive creator retreat with workshops, networking, and beachside content creation.',
    activities: ['Content Workshops', 'Networking Events', 'Beach Photoshoots', 'Brand Meetups'],
    tokenCost: 25000,
    maxParticipants: 20,
    participants: 12,
    image: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&h=600&fit=crop',
    category: 'Retreat',
    duration: '5 days',
    status: 'upcoming'
  },
  {
    id: 2,
    destination: 'NYC Creator Week',
    location: 'New York City',
    dates: 'April 5-10, 2024',
    organizer: 'Digis',
    organizerAvatar: '🗽',
    description: 'Experience the best of NYC with exclusive access to studios, events, and creator spaces.',
    activities: ['Studio Tours', 'Broadway Shows', 'Creator Meetups', 'Brand Partnerships'],
    tokenCost: 30000,
    maxParticipants: 15,
    participants: 8,
    image: 'https://images.unsplash.com/photo-1522083165195-3424ed129620?w=800&h=600&fit=crop',
    category: 'Workshop',
    duration: '5 days',
    status: 'upcoming'
  }
];

/**
 * Manages experiences/trips data and actions
 */
export const useExperiences = (user) => {
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: 'all',
    priceRange: 'all',
    sortBy: 'upcoming'
  });

  /**
   * Fetch experiences/trips
   */
  const fetchExperiences = useCallback(async () => {
    try {
      let headers = {};
      if (user) {
        const authToken = await getAuthToken();
        headers = { 'Authorization': `Bearer ${authToken}` };
      }
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/public/experiences`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Map API response to expected format
        const apiTrips = (data.experiences || []).map(exp => ({
          id: exp.id,
          destination: exp.title,
          location: exp.location,
          dates: exp.dates,
          organizer: exp.organizer || 'Digis',
          organizerAvatar: exp.organizer_avatar || '🌴',
          description: exp.description,
          activities: exp.activities || [],
          tokenCost: exp.token_cost,
          maxParticipants: exp.max_participants,
          participants: exp.current_participants || 0,
          image: exp.image_url,
          category: exp.category,
          duration: exp.duration,
          status: exp.status || 'upcoming'
        }));
        
        setExperiences(apiTrips.length > 0 ? apiTrips : mockTrips);
      } else {
        setExperiences(mockTrips);
      }
    } catch (error) {
      console.error('Error fetching experiences:', error);
      setExperiences(mockTrips);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Join an experience
   */
  const joinExperience = useCallback(async (experienceId) => {
    if (!user) {
      toast.error('Please sign in to join experiences');
      return false;
    }

    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/experiences/${experienceId}/join`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        toast.success('Successfully joined experience!');
        
        // Update local state
        setExperiences(prev => prev.map(exp => 
          exp.id === experienceId
            ? { ...exp, participants: exp.participants + 1 }
            : exp
        ));
        
        return true;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to join');
      }
    } catch (error) {
      console.error('Error joining experience:', error);
      toast.error(error.message || 'Failed to join experience');
      return false;
    }
  }, [user]);

  /**
   * Create new experience (admin/creator only)
   */
  const createExperience = useCallback(async (experienceData) => {
    if (!user) {
      toast.error('Please sign in to create experiences');
      return null;
    }

    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/experiences`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(experienceData)
      });

      if (response.ok) {
        const newExperience = await response.json();
        toast.success('Experience created successfully!');
        
        // Add to local state
        setExperiences(prev => [newExperience, ...prev]);
        return newExperience;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create');
      }
    } catch (error) {
      console.error('Error creating experience:', error);
      toast.error(error.message || 'Failed to create experience');
      return null;
    }
  }, [user]);

  /**
   * Cancel experience booking
   */
  const cancelExperienceBooking = useCallback(async (experienceId) => {
    if (!user) {
      toast.error('Please sign in to cancel bookings');
      return false;
    }

    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/experiences/${experienceId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (response.ok) {
        toast.success('Booking cancelled successfully');
        
        // Update local state
        setExperiences(prev => prev.map(exp => 
          exp.id === experienceId
            ? { ...exp, participants: Math.max(0, exp.participants - 1) }
            : exp
        ));
        
        return true;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error(error.message || 'Failed to cancel booking');
      return false;
    }
  }, [user]);

  /**
   * Filter experiences
   */
  const getFilteredExperiences = useCallback(() => {
    let filtered = [...experiences];

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(exp => 
        exp.category.toLowerCase() === filters.category.toLowerCase()
      );
    }

    // Price range filter
    switch (filters.priceRange) {
      case 'low':
        filtered = filtered.filter(exp => exp.tokenCost <= 20000);
        break;
      case 'medium':
        filtered = filtered.filter(exp => exp.tokenCost > 20000 && exp.tokenCost <= 35000);
        break;
      case 'high':
        filtered = filtered.filter(exp => exp.tokenCost > 35000);
        break;
      default:
        break;
    }

    // Sort
    switch (filters.sortBy) {
      case 'upcoming':
        filtered.sort((a, b) => new Date(a.dates) - new Date(b.dates));
        break;
      case 'price-low':
        filtered.sort((a, b) => a.tokenCost - b.tokenCost);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.tokenCost - a.tokenCost);
        break;
      case 'availability':
        filtered.sort((a, b) => 
          (b.maxParticipants - b.participants) - (a.maxParticipants - a.participants)
        );
        break;
      default:
        break;
    }

    return filtered;
  }, [experiences, filters]);

  useEffect(() => {
    fetchExperiences();
  }, [fetchExperiences]);

  return {
    experiences: getFilteredExperiences(),
    loading,
    filters,
    setFilters,
    joinExperience,
    createExperience,
    cancelExperienceBooking,
    refetchExperiences: fetchExperiences
  };
};

export default useExperiences;