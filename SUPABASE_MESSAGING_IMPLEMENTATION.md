# Supabase Messaging System Implementation Guide

## Overview

We're replacing Agora.io Chat with a custom Supabase-based messaging system that integrates with the Digis token economy.

## ✅ Completed

### 1. Database Schema (`backend/migrations/016_create_messaging_system.sql`)

**Tables Created:**
- `conversations` - Tracks 1-on-1 conversation threads between users
- `messages` - Stores all messages with support for text, media, and token-gated content
- `typing_indicators` - Real-time typing status (auto-expires after 10 seconds)
- `message_reactions` - Emoji reactions to messages (❤️, 👍, etc.)
- `message_reports` - User-reported messages for moderation

**Key Features:**
- Token-gated messaging (creators can charge tokens per message)
- Premium/unlockable media messages
- Message reactions and read receipts
- Soft delete (messages can be deleted without losing data)
- RLS (Row Level Security) for privacy
- Realtime subscriptions enabled

**Database Functions:**
- `get_or_create_conversation(user1_id, user2_id)` - Get or create conversation
- `mark_messages_as_read(conversation_id, user_id)` - Bulk mark as read
- `get_unread_count(user_id)` - Get total unread count

### 2. Backend API Routes (`backend/routes/messages.js`)

**Endpoints:**

#### Conversations
- `GET /api/v1/messages/conversations` - Get all conversations
- `POST /api/v1/messages/conversations` - Create conversation with user

#### Messages
- `GET /api/v1/messages/conversation/:conversationId` - Get messages
- `POST /api/v1/messages/send` - Send a message (with token deduction)
- `PATCH /api/v1/messages/:messageId` - Update message (mark read/delete)

#### Features
- `POST /api/v1/messages/:conversationId/typing` - Update typing status
- `POST /api/v1/messages/:messageId/react` - Add/remove reaction
- `GET /api/v1/messages/unread/count` - Get unread count
- `GET /api/v1/messages/rates/:creatorId` - Get creator message rates
- `POST /api/v1/messages/upload` - Upload media

**Token Economy Integration:**
- Automatically deducts tokens from sender
- Credits tokens to creator
- Records transactions in `token_transactions` table
- Returns 402 error if insufficient balance

## 📋 Next Steps

### 3. Run Database Migration

**Option 1: Supabase Dashboard (Recommended)**
1. Go to https://supabase.com/dashboard
2. Select your project: `lpphsjowsivjtcmafxnj`
3. Navigate to **SQL Editor**
4. Copy contents of `backend/migrations/016_create_messaging_system.sql`
5. Paste and click **Run**
6. Verify tables created in **Table Editor**

**Option 2: Command Line (if psql is installed)**
```bash
cd backend
psql "$DATABASE_URL" -f migrations/016_create_messaging_system.sql
```

### 4. Create React Hooks

**Files to Create:**
- `frontend/src/hooks/useConversations.js`
- `frontend/src/hooks/useMessages.js`
- `frontend/src/hooks/useSendMessage.js`
- `frontend/src/hooks/useTypingIndicator.js`

**Example Hook Structure:**
```javascript
// frontend/src/hooks/useMessages.js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiGet, apiPost } from '../lib/api';

export function useMessages(conversationId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) return;

    // Fetch initial messages
    fetchMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [conversationId]);

  const fetchMessages = async () => {
    const data = await apiGet(`/messages/conversation/${conversationId}`);
    setMessages(data.messages);
    setLoading(false);
  };

  return { messages, loading };
}
```

### 5. Build ChatWindow Component

**Component:** `frontend/src/components/ChatWindow.jsx`

**Features to Implement:**
- Message list with infinite scroll
- Message input with token cost display
- Send button (disabled if insufficient tokens)
- Typing indicator ("User is typing...")
- Read receipts
- Message reactions
- Media preview

**Key UI Elements:**
```jsx
<div className="chat-window">
  <MessageList messages={messages} />
  <TypingIndicator user={otherUser} isTyping={isTyping} />
  <MessageInput
    onSend={sendMessage}
    tokenCost={messageCost}
    userBalance={tokenBalance}
  />
</div>
```

### 6. Update MessagesPage

**File:** `frontend/src/components/pages/MessagesPage.js`

**Updates Needed:**
- Replace old messaging logic with new hooks
- Add conversation list with real-time updates
- Show unread count badges
- Integrate ChatWindow component
- Add "New Message" button

**Structure:**
```jsx
<MessagesPage>
  <ConversationList
    conversations={conversations}
    onSelect={setActiveConversation}
  />
  <ChatWindow
    conversation={activeConversation}
    messages={messages}
    onSendMessage={handleSend}
  />
</MessagesPage>
```

### 7. Create Storage Bucket for Media

**Supabase Dashboard:**
1. Go to **Storage** → **New Bucket**
2. Name: `message-media`
3. Public: ✅ Yes (for images/videos)
4. Set policies:
   - Allow authenticated users to upload
   - Allow public read access

### 8. Add Environment Variables (if needed)

**frontend/.env**
```env
VITE_SUPABASE_URL=https://lpphsjowsivjtcmafxnj.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 9. Testing Checklist

- [ ] Send text message
- [ ] Send image message
- [ ] Token deduction works correctly
- [ ] Typing indicators appear
- [ ] Messages marked as read
- [ ] Unread count updates
- [ ] Reactions work
- [ ] Realtime updates work
- [ ] Media uploads work

## Benefits vs Agora Chat

| Feature | Agora Chat | Supabase Chat |
|---------|------------|---------------|
| **Cost** | $0.50-$2/MAU | ~$0.01/MAU |
| **Token Integration** | ❌ No | ✅ Built-in |
| **Data Ownership** | ❌ External | ✅ Your DB |
| **Custom Metadata** | ⚠️ Limited | ✅ Unlimited |
| **Analytics** | ⚠️ Limited | ✅ Full SQL |
| **Reactions** | ❌ No | ✅ Yes |
| **Pay-to-Unlock** | ❌ No | ✅ Yes |
| **Search** | ⚠️ Basic | ✅ Full-text |

## Database Schema Diagram

```
conversations
├── id (UUID, PK)
├── user1_id → users.id
├── user2_id → users.id
├── last_message_id → messages.id
└── last_message_at

messages
├── id (UUID, PK)
├── conversation_id → conversations.id
├── sender_id → users.id
├── recipient_id → users.id
├── content (TEXT)
├── media_url (TEXT)
├── tokens_spent (INTEGER)
├── is_premium (BOOLEAN)
├── unlock_price (INTEGER)
├── is_read (BOOLEAN)
└── created_at

typing_indicators
├── conversation_id → conversations.id
├── user_id → users.id
└── started_at (auto-expires after 10s)

message_reactions
├── message_id → messages.id
├── user_id → users.id
└── reaction (VARCHAR)
```

## Token-Gated Messaging Flow

1. User composes message to creator
2. Frontend displays message cost (e.g., "5 tokens")
3. User clicks "Send"
4. Backend checks user balance
5. If sufficient:
   - Deduct tokens from user
   - Credit tokens to creator
   - Insert message
   - Record transaction
6. Realtime updates both users

## Realtime Subscriptions

```javascript
// Subscribe to new messages
supabase
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages'
  }, (payload) => {
    console.log('New message:', payload.new);
  })
  .subscribe();

// Subscribe to typing indicators
supabase
  .channel('typing')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'typing_indicators'
  }, (payload) => {
    console.log('Typing status:', payload);
  })
  .subscribe();
```

## Next Implementation Session

**Priority 1: Run Migration**
- Execute SQL in Supabase dashboard
- Verify all tables created

**Priority 2: Create React Hooks**
- useMessages
- useSendMessage
- useTypingIndicator

**Priority 3: Build UI**
- ChatWindow component
- Message bubbles
- Token cost display

**Priority 4: Integration**
- Update MessagesPage
- Test end-to-end

Let me know when you're ready to continue!
