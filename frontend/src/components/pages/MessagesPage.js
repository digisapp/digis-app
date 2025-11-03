// components/pages/MessagesPage.js
// Messages page with Supabase messaging system
import React, { useState } from 'react';
import ConversationList from '../chat/ConversationList';
import ChatWindow from '../chat/ChatWindow';
import { useAuth } from '../../contexts/AuthContext';

/**
 * MessagesPage - Main messages interface
 * Two-column layout: conversations list + chat window
 */
const MessagesPage = ({ onStartVideoCall, onStartVoiceCall }) => {
  const { user } = useAuth();
  const [activeConversation, setActiveConversation] = useState(null);
  const [showChat, setShowChat] = useState(false); // For mobile view

  const handleSelectConversation = (conversation) => {
    setActiveConversation(conversation);
    setShowChat(true); // Show chat on mobile
  };

  const handleBack = () => {
    setShowChat(false); // Back to conversation list on mobile
  };

  const handleVideoCall = (otherUser) => {
    if (onStartVideoCall) {
      onStartVideoCall(otherUser);
    }
  };

  const handleVoiceCall = (otherUser) => {
    if (onStartVoiceCall) {
      onStartVoiceCall(otherUser);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Conversation List - Hidden on mobile when chat is open */}
      <div className={`${showChat ? 'hidden lg:flex' : 'flex'} flex-shrink-0`}>
        <ConversationList
          activeConversationId={activeConversation?.id}
          onSelectConversation={handleSelectConversation}
          onNewMessage={() => {
            // TODO: Open new message modal/page
            console.log('New message clicked');
          }}
        />
      </div>

      {/* Chat Window - Hidden on mobile when no conversation selected */}
      <div className={`${!showChat ? 'hidden lg:flex' : 'flex'} flex-1`}>
        <ChatWindow
          conversation={activeConversation}
          onBack={handleBack}
          onVideoCall={handleVideoCall}
          onVoiceCall={handleVoiceCall}
        />
      </div>
    </div>
  );
};

export default MessagesPage;
