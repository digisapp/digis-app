import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import {
  ChevronLeftIcon,
  PhoneIcon,
  VideoCameraIcon,
  EllipsisHorizontalIcon,
  StarIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import MessageItem from './MessageItem';
import MessageInput from './MessageInput';
import MobileMessageInput from './MobileMessageInput';
import MessageSearch from './MessageSearch';
import MessageReactions from './MessageReactions';
import VoiceRecorder from './VoiceRecorder';
import ScheduledMessageModal from './ScheduledMessageModal';
import MessageSkeletonLoader from './MessageSkeletonLoader';
import CallRequestMessage from './CallRequestMessage';
import { formatTimestamp } from '../../utils/dateHelpers';
import { customToast } from '../ui/EnhancedToaster';
import useHybridStore from '../../stores/useHybridStore';
import { useNavigate } from 'react-router-dom';

const MESSAGES_PER_PAGE = 50;
const MESSAGE_HEIGHT = 80; // Estimated average height

const MessageArea = ({
  selectedConversation,
  messages,
  onSendMessage,
  onLoadMoreMessages,
  onToggleVIP,
  onStartVoiceCall,
  onStartVideoCall,
  onReaction,
  onDeleteMessage,
  onEditMessage,
  onScheduleMessage,
  isCreator,
  user,
  isMobile,
  onBack,
  loading,
  hasMore,
  messageRates,
  showRates,
  onToggleRates,
  typingUsers,
  websocket
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [pendingCallRequest, setPendingCallRequest] = useState(null);
  const listRef = useRef();
  const messagesEndRef = useRef();
  const navigate = useNavigate();
  
  // Get token balance from store
  const { tokenBalance } = useHybridStore((state) => ({
    tokenBalance: state.tokenBalance || 0
  }));
  
  // Virtual scrolling setup
  const isItemLoaded = useCallback((index) => {
    return index < messages.length;
  }, [messages.length]);
  
  const loadMoreItems = useCallback(async (startIndex, stopIndex) => {
    if (hasMore && !loading) {
      await onLoadMoreMessages(startIndex, stopIndex);
    }
  }, [hasMore, loading, onLoadMoreMessages]);
  
  // Group messages by date
  const groupedMessages = useCallback(() => {
    const groups = [];
    let currentDate = null;
    
    messages.forEach((message, index) => {
      const messageDate = new Date(message.timestamp).toDateString();
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({
          type: 'date',
          date: messageDate,
          id: `date-${messageDate}`
        });
      }
      groups.push({ ...message, type: 'message', index });
    });
    
    return groups;
  }, [messages]);
  
  const messageGroups = groupedMessages();
  
  // Handle profile navigation
  const handleProfileClick = useCallback((userId, username, isCreator) => {
    if (!userId && !username) return;
    
    // Navigate to appropriate profile page
    if (isCreator) {
      navigate(`/${username || userId}`);
    } else {
      navigate(`/profile/${username || userId}`);
    }
  }, [navigate]);
  
  // Handle call request initiation (for creators)
  const handleCallRequest = useCallback((type) => {
    if (!isCreator) {
      // Fans shouldn't initiate calls directly - they need to wait for creator
      customToast.info('Please wait for the creator to call you');
      return;
    }
    
    if (!selectedConversation?.participant) {
      customToast.error('No participant selected');
      return;
    }
    
    // Get creator's rates
    const ratePerMinute = type === 'video' 
      ? (user?.video_price || 8) 
      : (user?.voice_price || 6);
    
    // Create call request message
    const callRequestMessage = {
      id: `call-request-${Date.now()}`,
      type: 'call_request',
      callType: type,
      status: 'pending',
      caller: {
        id: user?.uid,
        name: user?.displayName || user?.username,
        avatar: user?.profile_pic_url
      },
      ratePerMinute: ratePerMinute,
      minimumDuration: 5,
      timestamp: new Date().toISOString(),
      sender_id: user?.uid,
      receiver_id: selectedConversation.participant.id
    };
    
    // Add to messages locally
    const updatedMessages = [...messages, callRequestMessage];
    
    // Send via WebSocket
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'call:request',
        data: callRequestMessage
      }));
    }
    
    // Update pending call request state
    setPendingCallRequest(callRequestMessage);
    
    customToast.success(`${type === 'video' ? 'Video' : 'Voice'} call request sent!`, {
      icon: type === 'video' ? '🎥' : '📞'
    });
  }, [isCreator, selectedConversation, user, messages, websocket]);
  
  // Handle call request acceptance (for fans)
  const handleAcceptCall = useCallback(async (callId, callData) => {
    // Check token balance
    const minimumRequired = callData.ratePerMinute * callData.minimumDuration;
    if (tokenBalance < minimumRequired) {
      customToast.error(`You need at least ${minimumRequired} tokens for this call`);
      return;
    }
    
    // Send acceptance via WebSocket
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'call:accept',
        data: {
          callId,
          ...callData
        }
      }));
    }
    
    // Navigate to call room
    if (onStartVideoCall && callData.type === 'video') {
      onStartVideoCall(selectedConversation.participant, callData);
    } else if (onStartVoiceCall && callData.type === 'voice') {
      onStartVoiceCall(selectedConversation.participant, callData);
    }
  }, [tokenBalance, websocket, onStartVideoCall, onStartVoiceCall, selectedConversation]);
  
  // Handle call request decline (for fans)
  const handleDeclineCall = useCallback((callId, reason) => {
    // Send decline via WebSocket
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'call:decline',
        data: {
          callId,
          reason
        }
      }));
    }
    
    // Update message status locally
    const updatedMessages = messages.map(msg => 
      msg.id === callId 
        ? { ...msg, status: reason === 'expired' ? 'expired' : 'declined' }
        : msg
    );
    
    // Clear pending call request
    if (pendingCallRequest?.id === callId) {
      setPendingCallRequest(null);
    }
  }, [websocket, messages, pendingCallRequest]);
  
  // Search within messages
  const filteredMessages = useCallback(() => {
    if (!searchQuery) return messageGroups;
    
    return messageGroups.filter(item => {
      if (item.type === 'date') return true;
      return item.content?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [messageGroups, searchQuery]);
  
  const displayMessages = filteredMessages();
  
  // Handle search result navigation
  const handleSearchResultClick = (messageId) => {
    setHighlightedMessageId(messageId);
    const index = displayMessages.findIndex(m => m.id === messageId);
    if (index !== -1 && listRef.current) {
      listRef.current.scrollToItem(index, 'center');
    }
    
    // Remove highlight after 2 seconds
    setTimeout(() => setHighlightedMessageId(null), 2000);
  };
  
  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (listRef.current && displayMessages.length > 0) {
      listRef.current.scrollToItem(displayMessages.length - 1, 'end');
    }
  }, [displayMessages.length]);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === user?.uid || 
          (listRef.current && listRef.current.scrollTop > listRef.current.scrollHeight - 1000)) {
        scrollToBottom();
      }
    }
  }, [messages.length, scrollToBottom, user]);
  
  // Handle scroll position for "scroll to bottom" button
  const handleScroll = ({ scrollOffset, scrollDirection }) => {
    const isNearBottom = scrollOffset > (displayMessages.length * MESSAGE_HEIGHT) - 1000;
    setShowScrollToBottom(!isNearBottom && displayMessages.length > 10);
  };
  
  // Row renderer for virtual list
  const Row = ({ index, style }) => {
    const item = displayMessages[index];
    
    if (item.type === 'date') {
      return (
        <div style={style} className="flex justify-center py-2">
          <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-400">
            {formatTimestamp(item.date, 'date')}
          </span>
        </div>
      );
    }
    
    // Handle call request messages
    if (item.type === 'call_request') {
      return (
        <div style={style}>
          <CallRequestMessage
            message={item}
            isCreator={isCreator}
            onAccept={handleAcceptCall}
            onDecline={handleDeclineCall}
            tokenBalance={tokenBalance}
          />
        </div>
      );
    }
    
    return (
      <div style={style}>
        <MessageItem
          message={item}
          isOwn={item.sender === user?.uid}
          isHighlighted={item.id === highlightedMessageId}
          onReaction={onReaction}
          onDelete={onDeleteMessage}
          onEdit={onEditMessage}
          user={user}
          isCreator={isCreator}
        />
      </div>
    );
  };
  
  if (!selectedConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <ChatBubbleLeftRightIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            Select a conversation
          </h3>
          <p className="text-sm text-gray-500">Choose a conversation to start messaging</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`flex-1 flex flex-col h-full ${isMobile ? 'pb-40' : ''}`}>
      {/* Chat Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
            )}
            
            <div 
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleProfileClick(
                selectedConversation.participant?.id,
                selectedConversation.participant?.username,
                selectedConversation.participant?.is_creator
              )}
            >
              <div className="relative">
                {selectedConversation.participant?.avatar ? (
                  <img 
                    src={selectedConversation.participant.avatar}
                    alt={selectedConversation.participant.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                    {selectedConversation.participant?.name?.charAt(0) || '?'}
                  </div>
                )}
                {selectedConversation.participant?.isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white pointer-events-none"></div>
                )}
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                    {selectedConversation.participant?.name || 'Unknown'}
                  </h3>
                  {selectedConversation.participant?.isVIP && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium pointer-events-none">
                      VIP
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {selectedConversation.participant?.isOnline 
                    ? 'Active now' 
                    : `Last seen ${formatTimestamp(selectedConversation.participant?.lastSeen)}`
                  }
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Search Button */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg transition-colors ${
                showSearch 
                  ? 'bg-purple-100 text-purple-600' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Search messages"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
            </button>
            
            {/* Schedule Message (Creator only) */}
            {isCreator && (
              <button
                onClick={() => setShowScheduleModal(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Schedule message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}
            
            {/* VIP Toggle */}
            {isCreator && (
              <button
                onClick={() => onToggleVIP(selectedConversation.id)}
                className={`p-2 rounded-lg transition-colors ${
                  selectedConversation.participant?.isVIP
                    ? 'text-yellow-500 bg-yellow-50'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title={selectedConversation.participant?.isVIP ? 'Remove from VIPs' : 'Add to VIPs'}
              >
                {selectedConversation.participant?.isVIP ? (
                  <StarIconSolid className="w-5 h-5" />
                ) : (
                  <StarIcon className="w-5 h-5" />
                )}
              </button>
            )}
            
            <button
              onClick={() => handleCallRequest('voice')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Start voice call"
            >
              <PhoneIcon className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => handleCallRequest('video')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Start video call"
            >
              <VideoCameraIcon className="w-5 h-5" />
            </button>
            
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <EllipsisHorizontalIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <AnimatePresence>
          {showSearch && (
            <MessageSearch
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onResultClick={handleSearchResultClick}
              messages={messages}
              onClose={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
            />
          )}
        </AnimatePresence>
      </div>
      
      {/* Messages Area with Virtual Scrolling */}
      <div className="flex-1 relative">
        {loading && messages.length === 0 ? (
          <MessageSkeletonLoader />
        ) : (
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={hasMore ? displayMessages.length + 1 : displayMessages.length}
            loadMoreItems={loadMoreItems}
          >
            {({ onItemsRendered, ref }) => (
              <List
                ref={(list) => {
                  ref(list);
                  listRef.current = list;
                }}
                height={window.innerHeight - (isMobile ? 280 : 200)} // Adjust for mobile fixed input
                itemCount={displayMessages.length}
                itemSize={MESSAGE_HEIGHT}
                onItemsRendered={onItemsRendered}
                onScroll={handleScroll}
                className="px-4"
              >
                {Row}
              </List>
            )}
          </InfiniteLoader>
        )}
        
        {/* Typing Indicator */}
        {typingUsers?.size > 0 && (
          <div className="absolute bottom-2 left-4">
            <div className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-lg inline-flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        
        {/* Scroll to bottom button */}
        <AnimatePresence>
          {showScrollToBottom && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 p-3 bg-white dark:bg-gray-800 shadow-lg rounded-full hover:shadow-xl transition-shadow"
            >
              <ChevronDownIcon className="w-5 h-5 text-gray-600" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      
      {/* Message Input - Use MobileMessageInput on mobile devices */}
      {isMobile ? (
        <MobileMessageInput
          onSendMessage={onSendMessage}
          onScheduleMessage={onScheduleMessage}
          isCreator={isCreator}
          websocket={websocket}
          conversationId={selectedConversation.id}
          userId={user?.uid}
          onRequestCall={handleCallRequest}
        />
      ) : (
        <MessageInput
          onSendMessage={onSendMessage}
          onScheduleMessage={onScheduleMessage}
          isCreator={isCreator}
          messageRates={messageRates}
          showRates={showRates}
          onToggleRates={onToggleRates}
          websocket={websocket}
          conversationId={selectedConversation.id}
          userId={user?.uid}
        />
      )}
      
      {/* Scheduled Message Modal */}
      {isCreator && (
        <ScheduledMessageModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onSchedule={onScheduleMessage}
          recipient={selectedConversation.participant}
        />
      )}
    </div>
  );
};

export default MessageArea;