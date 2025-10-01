/**
 * Stream viewer list component
 * @module components/StreamViewerList
 */

import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircleIcon,
  StarIcon,
  ShieldCheckIcon,
  BoltIcon,
  CrownIcon,
  EllipsisVerticalIcon,
  UserMinusIcon,
  ChatBubbleLeftIcon,
  GiftIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

/**
 * Displays list of stream viewers with their status
 */
const StreamViewerList = memo(({
  viewers = [],
  isCreator,
  onKickUser,
  onBanUser,
  onModUser,
  onMessageUser,
  onViewProfile
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, vip, subscribers, moderators
  const [selectedUser, setSelectedUser] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showTierLegend, setShowTierLegend] = useState(false);

  /**
   * Filter viewers based on search and type
   */
  const filteredViewers = viewers.filter(viewer => {
    const matchesSearch = viewer.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    switch (filterType) {
      case 'vip':
        return matchesSearch && viewer.isVIP;
      case 'subscribers':
        return matchesSearch && viewer.isSubscriber;
      case 'moderators':
        return matchesSearch && viewer.isModerator;
      default:
        return matchesSearch;
    }
  });

  /**
   * Group viewers by type
   */
  const groupedViewers = {
    moderators: filteredViewers.filter(v => v.isModerator),
    vip: filteredViewers.filter(v => v.isVIP && !v.isModerator),
    subscribers: filteredViewers.filter(v => v.isSubscriber && !v.isVIP && !v.isModerator),
    regular: filteredViewers.filter(v => !v.isSubscriber && !v.isVIP && !v.isModerator)
  };

  /**
   * Handle context menu
   */
  const handleContextMenu = (e, viewer) => {
    e.preventDefault();
    setSelectedUser(viewer);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  /**
   * Get viewer badge
   */
  const getViewerBadge = (viewer) => {
    if (viewer.isCreator) {
      return <CrownIcon className="w-4 h-4 text-purple-400" title="Creator" />;
    }
    if (viewer.isModerator) {
      return <ShieldCheckIcon className="w-4 h-4 text-green-400" title="Moderator" />;
    }
    if (viewer.isVIP) {
      return <StarSolidIcon className="w-4 h-4 text-yellow-400" title="VIP" />;
    }
    if (viewer.isSubscriber) {
      return <BoltIcon className="w-4 h-4 text-blue-400" title="Subscriber" />;
    }
    return null;
  };

  /**
   * Get username color based on lifetime token spend tier
   * Uses the finalized medieval-themed tier system
   */
  const getUsernameColor = (viewer) => {
    // Use lifetime tokens spent, not just current stream
    const lifetimeTokensSpent = viewer.lifetimeTokensSpent || viewer.tokensSpent || 0;
    
    // Crown Gifter: 1,000,000+ tokens (Fiery orange-red with royal glow)
    if (lifetimeTokensSpent >= 1000000) {
      return {
        className: 'font-bold',
        style: {
          color: '#FF4500',
          textShadow: '0 0 12px rgba(255, 69, 0, 0.8), 0 0 24px rgba(255, 69, 0, 0.4), 0 0 36px rgba(255, 69, 0, 0.2)'
        },
        tier: 'Crown Gifter',
        tierColor: 'text-orange-500',
        hexColor: '#FF4500'
      };
    }
    
    // Duke Gifter: 100,000-999,999 tokens (Regal amethyst purple with glow)
    if (lifetimeTokensSpent >= 100000) {
      return {
        className: 'font-bold',
        style: {
          color: '#9B59B6',
          textShadow: '0 0 10px rgba(155, 89, 182, 0.6), 0 0 20px rgba(155, 89, 182, 0.3)'
        },
        tier: 'Duke Gifter',
        tierColor: 'text-purple-500',
        hexColor: '#9B59B6'
      };
    }
    
    // Count Gifter: 50,000-99,999 tokens (Deep royal blue with glow)
    if (lifetimeTokensSpent >= 50000) {
      return {
        className: 'font-bold',
        style: {
          color: '#4169E1',
          textShadow: '0 0 8px rgba(65, 105, 225, 0.6), 0 0 16px rgba(65, 105, 225, 0.3)'
        },
        tier: 'Count Gifter',
        tierColor: 'text-blue-500',
        hexColor: '#4169E1'
      };
    }
    
    // Baron Gifter: 20,000-49,999 tokens (Rich golden yellow with glow)
    if (lifetimeTokensSpent >= 20000) {
      return {
        className: 'font-bold',
        style: {
          color: '#FFD700',
          textShadow: '0 0 6px rgba(255, 215, 0, 0.6), 0 0 12px rgba(255, 215, 0, 0.3)'
        },
        tier: 'Baron Gifter',
        tierColor: 'text-yellow-400',
        hexColor: '#FFD700'
      };
    }
    
    // Knight Gifter: 10,000-19,999 tokens (Bold firebrick red)
    if (lifetimeTokensSpent >= 10000) {
      return {
        className: 'font-semibold',
        style: {
          color: '#B22222',
          textShadow: '0 0 4px rgba(178, 34, 34, 0.5)'
        },
        tier: 'Knight Gifter',
        tierColor: 'text-red-600',
        hexColor: '#B22222'
      };
    }
    
    // Squire Gifter: 2,500-9,999 tokens (Vibrant teal)
    if (lifetimeTokensSpent >= 2500) {
      return {
        className: 'font-semibold',
        style: {
          color: '#008080'
        },
        tier: 'Squire Gifter',
        tierColor: 'text-teal-600',
        hexColor: '#008080'
      };
    }
    
    // Supporter: 0-2,499 tokens (Earthy brown - default tier)
    return {
      className: '',
      style: {
        color: '#5C4033'
      },
      tier: 'Supporter',
      tierColor: 'text-brown-600',
      hexColor: '#5C4033'
    };
  };

  /**
   * Viewer item component
   */
  const ViewerItem = ({ viewer }) => {
    const usernameStyle = getUsernameColor(viewer);
    
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        whileHover={{ backgroundColor: 'rgba(107, 114, 128, 0.2)' }}
        className="flex items-center justify-between p-2 rounded-lg cursor-pointer"
        onClick={() => onViewProfile?.(viewer)}
        onContextMenu={(e) => handleContextMenu(e, viewer)}
      >
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div className="relative">
            {viewer.avatar ? (
              <img
                src={viewer.avatar}
                alt={viewer.name}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <UserCircleIcon className="w-8 h-8 text-gray-400" />
            )}
            {viewer.isLive && (
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800" />
            )}
          </div>

          {/* Name with color coding and badges */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span 
                className={`text-sm ${usernameStyle.className}`}
                style={usernameStyle.style}
                title={usernameStyle.tier ? `${usernameStyle.tier} Tier (${viewer.tokensSpent || 0} tokens spent)` : null}
              >
                {viewer.name}
              </span>
              {getViewerBadge(viewer)}
            </div>
            {/* Show tier and tokens spent */}
            {usernameStyle.tier && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs ${usernameStyle.tierColor}`}>
                  {usernameStyle.tier}
                </span>
                <span className="text-xs text-gray-500">
                  {viewer.tokensSpent?.toLocaleString() || 0} tokens
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions button (creator only) */}
        {isCreator && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e, viewer);
            }}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <EllipsisVerticalIcon className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </motion.div>
    );
  };

  /**
   * Viewer group component
   */
  const ViewerGroup = ({ title, viewers, icon }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (viewers.length === 0) return null;

    return (
      <div className="mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-gray-400 text-sm font-semibold">
              {title} ({viewers.length})
            </span>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className="text-gray-400"
          >
            ▼
          </motion.div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              {viewers.map(viewer => (
                <ViewerItem key={viewer.id} viewer={viewer} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold">
            Viewers ({viewers.length})
          </h3>
          {/* Tier Legend Button */}
          <button
            onClick={() => setShowTierLegend(!showTierLegend)}
            className="text-xs text-purple-400 hover:text-purple-300"
            title="View tier colors"
          >
            <StarIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Tier Legend (collapsible) */}
        <AnimatePresence>
          {showTierLegend && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-3"
            >
              <div className="bg-gray-900 rounded-lg p-3 text-xs space-y-2">
                <div className="font-semibold text-gray-400 mb-2">Medieval Loyalty Tiers (Lifetime Tokens):</div>
                <div className="space-y-1">
                  {/* Crown Gifter */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CrownIcon className="w-4 h-4" style={{ color: '#FF4500' }} />
                      <span className="font-bold" style={{ color: '#FF4500', textShadow: '0 0 12px rgba(255, 69, 0, 0.5)' }}>Crown Gifter</span>
                    </div>
                    <span className="text-gray-500">1M+</span>
                  </div>
                  
                  {/* Duke Gifter */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheckIcon className="w-4 h-4" style={{ color: '#9B59B6' }} />
                      <span className="font-bold" style={{ color: '#9B59B6', textShadow: '0 0 10px rgba(155, 89, 182, 0.4)' }}>Duke Gifter</span>
                    </div>
                    <span className="text-gray-500">100K+</span>
                  </div>
                  
                  {/* Count Gifter */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StarSolidIcon className="w-4 h-4" style={{ color: '#4169E1' }} />
                      <span className="font-bold" style={{ color: '#4169E1', textShadow: '0 0 8px rgba(65, 105, 225, 0.4)' }}>Count Gifter</span>
                    </div>
                    <span className="text-gray-500">50K+</span>
                  </div>
                  
                  {/* Baron Gifter */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BoltIcon className="w-4 h-4" style={{ color: '#FFD700' }} />
                      <span className="font-bold" style={{ color: '#FFD700', textShadow: '0 0 6px rgba(255, 215, 0, 0.4)' }}>Baron Gifter</span>
                    </div>
                    <span className="text-gray-500">20K+</span>
                  </div>
                  
                  {/* Knight Gifter */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: '#B22222' }}>Knight Gifter</span>
                    </div>
                    <span className="text-gray-500">10K+</span>
                  </div>
                  
                  {/* Squire Gifter */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: '#008080' }}>Squire Gifter</span>
                    </div>
                    <span className="text-gray-500">2.5K+</span>
                  </div>
                  
                  {/* Supporter */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#5C4033' }}>Supporter</span>
                    </div>
                    <span className="text-gray-500">0-2.5K</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search viewers..."
          className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
        />

        {/* Filter tabs */}
        <div className="flex gap-1">
          {['all', 'moderators', 'vip', 'subscribers'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 text-xs rounded-lg capitalize ${
                filterType === type
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Viewer list */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredViewers.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <UserCircleIcon className="w-12 h-12 mx-auto mb-2" />
            <p>No viewers found</p>
          </div>
        ) : (
          <>
            <ViewerGroup
              title="Moderators"
              viewers={groupedViewers.moderators}
              icon={<ShieldCheckIcon className="w-4 h-4 text-green-400" />}
            />
            <ViewerGroup
              title="VIP"
              viewers={groupedViewers.vip}
              icon={<StarSolidIcon className="w-4 h-4 text-yellow-400" />}
            />
            <ViewerGroup
              title="Subscribers"
              viewers={groupedViewers.subscribers}
              icon={<BoltIcon className="w-4 h-4 text-blue-400" />}
            />
            <ViewerGroup
              title="Viewers"
              viewers={groupedViewers.regular}
              icon={<UserCircleIcon className="w-4 h-4 text-gray-400" />}
            />
          </>
        )}
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {showContextMenu && selectedUser && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowContextMenu(false)}
            />
            
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                position: 'fixed',
                top: contextMenuPosition.y,
                left: contextMenuPosition.x,
                zIndex: 50
              }}
              className="bg-gray-700 rounded-lg shadow-lg py-2 min-w-[160px]"
            >
              <button
                onClick={() => {
                  onViewProfile?.(selectedUser);
                  setShowContextMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-white hover:bg-gray-600 flex items-center gap-2"
              >
                <UserCircleIcon className="w-4 h-4" />
                View Profile
              </button>
              
              <button
                onClick={() => {
                  onMessageUser?.(selectedUser);
                  setShowContextMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-white hover:bg-gray-600 flex items-center gap-2"
              >
                <ChatBubbleLeftIcon className="w-4 h-4" />
                Send Message
              </button>

              {isCreator && (
                <>
                  <div className="border-t border-gray-600 my-1" />
                  
                  {!selectedUser.isModerator && (
                    <button
                      onClick={() => {
                        onModUser?.(selectedUser);
                        setShowContextMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-white hover:bg-gray-600 flex items-center gap-2"
                    >
                      <ShieldCheckIcon className="w-4 h-4" />
                      Make Moderator
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      onKickUser?.(selectedUser);
                      setShowContextMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-orange-400 hover:bg-gray-600 flex items-center gap-2"
                  >
                    <UserMinusIcon className="w-4 h-4" />
                    Kick from Stream
                  </button>
                  
                  <button
                    onClick={() => {
                      onBanUser?.(selectedUser);
                      setShowContextMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-600 flex items-center gap-2"
                  >
                    <UserMinusIcon className="w-4 h-4" />
                    Ban User
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
});

StreamViewerList.displayName = 'StreamViewerList';

export default StreamViewerList;