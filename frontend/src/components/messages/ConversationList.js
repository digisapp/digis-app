import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  InboxIcon,
  EnvelopeIcon,
  StarIcon,
  UserGroupIcon,
  ArchiveBoxIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckIcon,
  TrashIcon,
  MapPinIcon,
  EllipsisHorizontalIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarIconSolid,
  MapPinIcon as MapPinIconSolid
} from '@heroicons/react/24/solid';
import ConversationItem from './ConversationItem';
import { formatTimestamp } from '../../utils/dateHelpers';

const ConversationList = ({
  conversations,
  selectedConversation,
  onSelectConversation,
  onPinConversation,
  onArchiveConversation,
  onToggleVIP,
  onBulkAction,
  isCreator,
  loading,
  isMobile,
  showConversationList,
  onMassMessage,
  user
}) => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);

  // Inbox tabs configuration
  const inboxTabs = isCreator ? [
    { id: 'all', label: 'All', icon: InboxIcon },
    { id: 'unread', label: 'Unread', icon: EnvelopeIcon },
    { id: 'vips', label: 'VIPs', icon: StarIcon },
    { id: 'requests', label: 'Requests', icon: UserGroupIcon },
    { id: 'archived', label: 'Archived', icon: ArchiveBoxIcon }
  ] : [
    { id: 'all', label: 'All', icon: InboxIcon },
    { id: 'unread', label: 'Unread', icon: EnvelopeIcon },
    { id: 'archived', label: 'Archived', icon: ArchiveBoxIcon }
  ];

  // Calculate tab counts
  const tabCounts = useMemo(() => {
    const counts = {
      all: conversations.filter(c => !c.isArchived).length,
      unread: conversations.filter(c => !c.isArchived && c.unreadCount > 0).length,
      archived: conversations.filter(c => c.isArchived).length
    };
    
    if (isCreator) {
      counts.vips = conversations.filter(c => !c.isArchived && c.participant?.isVIP).length;
      counts.requests = conversations.filter(c => !c.isArchived && c.isRequest).length;
    }
    
    return counts;
  }, [conversations, isCreator]);

  // Filter conversations based on active tab and search
  const filteredConversations = useMemo(() => {
    let filtered = [...conversations];
    
    // Apply tab filter
    switch (activeTab) {
      case 'unread':
        filtered = filtered.filter(c => !c.isArchived && c.unreadCount > 0);
        break;
      case 'vips':
        if (isCreator) {
          filtered = filtered.filter(c => !c.isArchived && c.participant?.isVIP);
        }
        break;
      case 'requests':
        if (isCreator) {
          filtered = filtered.filter(c => !c.isArchived && c.isRequest);
        }
        break;
      case 'archived':
        filtered = filtered.filter(c => c.isArchived);
        break;
      default:
        filtered = filtered.filter(c => !c.isArchived);
    }
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.participant?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.participant?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessage?.content?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Sort: pinned first, then by last message timestamp
    filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0);
    });
    
    return filtered;
  }, [conversations, activeTab, searchQuery, isCreator]);

  const handleSelectForBulk = (conversationId, event) => {
    event?.stopPropagation();
    const newSelected = new Set(selectedConversations);
    if (newSelected.has(conversationId)) {
      newSelected.delete(conversationId);
    } else {
      newSelected.add(conversationId);
    }
    setSelectedConversations(newSelected);
  };

  const handleBulkActionInternal = (action) => {
    onBulkAction(action, Array.from(selectedConversations));
    setSelectedConversations(new Set());
    setBulkActionMode(false);
  };

  if (!showConversationList && isMobile) {
    return null;
  }

  return (
    <motion.div
      initial={{ x: isMobile ? -300 : 0 }}
      animate={{ x: 0 }}
      exit={{ x: isMobile ? -300 : 0 }}
      className={`${
        isMobile ? 'absolute inset-y-0 left-0 z-40' : 'relative'
      } w-full md:w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Messages</h2>
          <div className="flex items-center gap-2">
            {isCreator && !bulkActionMode && (
              <button
                onClick={onMassMessage}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-sm"
              >
                <UserGroupIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Broadcast</span>
              </button>
            )}
            
            {bulkActionMode ? (
              <>
                <button
                  onClick={() => handleBulkActionInternal('read')}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Mark as read"
                >
                  <CheckIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleBulkActionInternal('archive')}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Archive"
                >
                  <ArchiveBoxIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleBulkActionInternal('delete')}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  title="Delete"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setBulkActionMode(false);
                    setSelectedConversations(new Set());
                  }}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setBulkActionMode(true)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Select multiple"
                >
                  <EllipsisHorizontalIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <FunnelIcon className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Search */}
        <div className="flex-1 relative min-w-0">
          <input
            type="search"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-xs sm:text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          />
          <MagnifyingGlassIcon className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>
      
      {/* Inbox Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        {inboxTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tabCounts[tab.id] > 0 && (
              <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                activeTab === tab.id
                  ? 'bg-purple-100 text-purple-600'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {tabCounts[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-3"></div>
            <p className="text-sm text-gray-500">Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <InboxIcon className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-sm">No conversations found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredConversations.map(conversation => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversation?.id === conversation.id}
                isBulkSelected={selectedConversations.has(conversation.id)}
                bulkActionMode={bulkActionMode}
                onSelect={() => !bulkActionMode && onSelectConversation(conversation)}
                onSelectForBulk={(e) => handleSelectForBulk(conversation.id, e)}
                onPin={(e) => onPinConversation(conversation.id, e)}
                onArchive={(e) => onArchiveConversation(conversation.id, e)}
                onToggleVIP={(e) => onToggleVIP(conversation.id, e)}
                isCreator={isCreator}
                user={user}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ConversationList;