import React, { useEffect } from 'react';
import PresenceIndicator from './PresenceIndicator';
import { usePresence } from '../../hooks/useSocket';

const CreatorPresence = ({ 
  userId, 
  showLabel = false,
  size = 'md',
  className = '' 
}) => {
  const { userPresence, getUserPresence } = usePresence();
  
  // Fetch presence on mount
  useEffect(() => {
    if (userId) {
      getUserPresence([userId]);
    }
  }, [userId, getUserPresence]);
  
  const presence = userPresence.get(userId) || { status: 'offline' };
  
  return (
    <PresenceIndicator 
      status={presence.status}
      size={size}
      showLabel={showLabel}
      className={className}
    />
  );
};

export default CreatorPresence;