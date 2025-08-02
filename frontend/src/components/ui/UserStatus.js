import React from 'react';
import PresenceIndicator from './PresenceIndicator';
import { formatDistanceToNow } from 'date-fns';

const UserStatus = ({ 
  user,
  status = 'offline',
  lastSeen = null,
  showLastSeen = true,
  className = ''
}) => {
  const getLastSeenText = () => {
    if (status === 'online') return 'Active now';
    if (!lastSeen) return 'Offline';
    
    try {
      return `Last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}`;
    } catch {
      return 'Offline';
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative">
        <img
          src={user?.profile_pic_url || '/default-avatar.png'}
          alt={user?.username || 'User'}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="absolute -bottom-1 -right-1">
          <PresenceIndicator status={status} size="sm" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 dark:text-white truncate">
          {user?.username || user?.email || 'User'}
        </h4>
        {showLastSeen && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {getLastSeenText()}
          </p>
        )}
      </div>
    </div>
  );
};

export default UserStatus;