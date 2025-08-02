import { useState, useEffect } from 'react';
import { getAuthToken } from '../utils/auth-helpers.js';

// Cache for usernames to avoid repeated API calls
const usernameCache = new Map();

export const useUsername = (user) => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUsername = async () => {
      if (!user) {
        setUsername('');
        return;
      }

      // Check cache first
      if (usernameCache.has(user.id)) {
        setUsername(usernameCache.get(user.id));
        return;
      }

      setLoading(true);
      try {
        const token = await getAuthToken();
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/users/profile?uid=${user.id}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const fetchedUsername = data.username || 'Unknown User';
          setUsername(fetchedUsername);
          // Cache the username
          usernameCache.set(user.id, fetchedUsername);
        } else {
          setUsername('Unknown User');
        }
      } catch (error) {
        console.error('Error fetching username:', error);
        setUsername('Unknown User');
      } finally {
        setLoading(false);
      }
    };

    fetchUsername();
  }, [user]);

  return { username, loading };
};

// Utility function to get username by user ID
export const fetchUsernameById = async (userId, authToken) => {
  // Check cache first
  if (usernameCache.has(userId)) {
    return usernameCache.get(userId);
  }

  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/users/profile?uid=${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      const username = data.username || 'Unknown User';
      // Cache the username
      usernameCache.set(userId, username);
      return username;
    }
    
    return 'Unknown User';
  } catch (error) {
    console.error('Error fetching username:', error);
    return 'Unknown User';
  }
};

// Remove this line as we're using named export above
// export default useUsername;