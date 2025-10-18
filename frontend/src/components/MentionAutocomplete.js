import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import { UserIcon, CheckBadgeIcon, StarIcon } from '@heroicons/react/24/solid';
import { getAuthToken } from '../utils/auth-helpers';
import { debounce } from '../utils/debounce';

const MentionAutocomplete = ({
  searchTerm,
  onSelect,
  onClose,
  position = { top: 0, left: 0 },
  maxResults = 5,
  channelId = null
}) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef(null);
  const itemRefs = useRef([]);

  // Search for users
  const searchUsers = useCallback(async (term) => {
    if (!term || term.length < 1) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/users/search-by-username?q=${encodeURIComponent(term)}&limit=${maxResults}${channelId ? `&channel=${channelId}` : ''}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setSelectedIndex(0);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [maxResults, channelId]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((term) => searchUsers(term), 300),
    [searchUsers]
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (users.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % users.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + users.length) % users.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (users[selectedIndex]) {
            handleSelect(users[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          e.preventDefault();
          if (users[selectedIndex]) {
            handleSelect(users[selectedIndex]);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [users, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  const handleSelect = (user) => {
    onSelect(user);
    onClose();
  };

  const getUserBadge = (user) => {
    if (user.is_creator) {
      return (
        <CheckBadgeIcon className="w-4 h-4 text-purple-400" title="Creator" />
      );
    }
    if (user.is_vip) {
      return (
        <StarIcon className="w-4 h-4 text-yellow-400" title="VIP" />
      );
    }
    return null;
  };

  const getUserRoleColor = (user) => {
    if (user.is_creator) return 'text-purple-400';
    if (user.is_moderator) return 'text-blue-400';
    if (user.is_vip) return 'text-yellow-400';
    if (user.is_subscriber) return 'text-green-400';
    return 'text-gray-400';
  };

  if (!searchTerm || users.length === 0 && !loading) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={dropdownRef}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
        className="absolute z-50 bg-gray-800 rounded-lg shadow-xl border border-purple-500/30 overflow-hidden"
        style={{
          bottom: `${position.bottom || 'auto'}`,
          left: position.left,
          minWidth: '200px',
          maxWidth: '300px',
          maxHeight: '200px'
        }}
      >
        {loading ? (
          <div className="px-4 py-3 text-gray-400 text-sm">
            Searching...
          </div>
        ) : users.length === 0 ? (
          <div className="px-4 py-3 text-gray-500 text-sm">
            No users found
          </div>
        ) : (
          <div className="overflow-y-auto max-h-48">
            {users.map((user, index) => (
              <motion.button
                key={user.id || user.username}
                ref={el => itemRefs.current[index] = el}
                className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-purple-600/20 transition-colors ${
                  index === selectedIndex ? 'bg-purple-600/30' : ''
                }`}
                onClick={() => handleSelect(user)}
                whileHover={{ x: 4 }}
                transition={{ duration: 0.1 }}
              >
                {/* User Avatar */}
                <div className="relative flex-shrink-0">
                  {user.profile_pic_url ? (
                    <img
                      src={user.profile_pic_url}
                      alt={user.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-white" />
                    </div>
                  )}
                  {user.is_online && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800" />
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={`font-medium text-sm ${getUserRoleColor(user)}`}>
                      @{user.username}
                    </span>
                    {getUserBadge(user)}
                  </div>
                  {user.display_name && user.display_name !== user.username && (
                    <div className="text-xs text-gray-500 truncate">
                      {user.display_name}
                    </div>
                  )}
                </div>

                {/* Selection indicator */}
                {index === selectedIndex && (
                  <div className="w-1 h-4 bg-purple-500 rounded-full" />
                )}
              </motion.button>
            ))}
          </div>
        )}

        {/* Footer hint */}
        <div className="px-3 py-1.5 bg-gray-900/50 border-t border-gray-700 text-xs text-gray-500">
          Use ↑↓ to navigate, Enter to select
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

MentionAutocomplete.propTypes = {
  searchTerm: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  position: PropTypes.shape({
    top: PropTypes.number,
    bottom: PropTypes.number,
    left: PropTypes.number
  }),
  maxResults: PropTypes.number,
  channelId: PropTypes.string
};

export default MentionAutocomplete;