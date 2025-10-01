import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
  UsersIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../utils/supabase-auth';

const NewConversationModal = ({ isOpen, onClose, onStartConversation, isCreator }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [initialMessage, setInitialMessage] = useState('');
  
  // Search for users/creators
  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    setLoading(true);
    try {
      const token = await getAuthToken();
      const endpoint = isCreator 
        ? '/api/users/search-fans' 
        : '/api/users/search-creators';
        
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}${endpoint}?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
      } else {
        console.error('Search failed');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      // Fallback to mock data for demo
      setSearchResults([
        {
          id: 'user-1',
          name: 'John Doe',
          username: 'johndoe',
          avatar: null,
          is_creator: !isCreator,
          is_online: true,
          bio: 'Content creator and educator'
        },
        {
          id: 'user-2',
          name: 'Jane Smith',
          username: 'janesmith',
          avatar: null,
          is_creator: !isCreator,
          is_online: false,
          bio: 'Digital artist and designer'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  const handleStartConversation = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }
    
    try {
      // Create new conversation
      const newConversation = {
        id: `conv-${Date.now()}`,
        participant: selectedUser,
        lastMessage: {
          content: initialMessage || 'Started a conversation',
          timestamp: new Date(),
          sender: 'current-user',
          isRead: false
        },
        unreadCount: 0,
        isPinned: false,
        isArchived: false,
        isRequest: false
      };
      
      onStartConversation(newConversation, initialMessage);
      handleClose();
      toast.success('Conversation started');
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation');
    }
  };
  
  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setInitialMessage('');
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserPlusIcon className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Start New Conversation
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">
            {/* Search input */}
            <div className="relative mb-4">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isCreator ? "Search for fans..." : "Search for creators..."}
                className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
            </div>
            
            {/* Search results */}
            <div className="max-h-60 overflow-y-auto mb-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Searching...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map(user => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`w-full p-3 rounded-lg flex items-center gap-3 transition-colors ${
                        selectedUser?.id === user.id
                          ? 'bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-600'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                      }`}
                    >
                      {/* Avatar */}
                      {user.avatar ? (
                        <img 
                          src={user.avatar} 
                          alt={user.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold">
                          {user.name?.charAt(0) || '?'}
                        </div>
                      )}
                      
                      {/* User info */}
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {user.name}
                          </h3>
                          {user.is_creator && (
                            <StarIcon className="w-4 h-4 text-yellow-500" />
                          )}
                          {user.is_online && (
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">@{user.username}</p>
                        {user.bio && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{user.bio}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="text-center py-8 text-gray-500">
                  <UsersIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No users found</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Start typing to search for {isCreator ? 'fans' : 'creators'}</p>
                </div>
              )}
            </div>
            
            {/* Selected user and initial message */}
            {selectedUser && (
              <div className="space-y-3">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    Starting conversation with <strong>{selectedUser.name}</strong>
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Initial message (optional)
                  </label>
                  <textarea
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    placeholder="Type your first message..."
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStartConversation}
              disabled={!selectedUser}
              className={`px-4 py-2 rounded-lg transition-all ${
                !selectedUser
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
              }`}
            >
              Start Conversation
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NewConversationModal;