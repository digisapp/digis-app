/**
 * Hook for managing Connect page data
 * @module hooks/useConnectData
 */

import { useState, useEffect, useCallback } from 'react';
import { getAuthToken } from '../../../utils/auth-helpers';

/**
 * Manages overall data fetching for Connect page
 */
export const useConnectData = (user) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetch all data
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Data fetching is handled by individual hooks
      // This hook just manages overall loading state
      await new Promise(resolve => setTimeout(resolve, 100));
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
      setLoading(false);
    }
  }, []);

  /**
   * Refetch data
   */
  const refetchData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    error,
    refetchData
  };
};

export default useConnectData;