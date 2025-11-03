# Live Stream Chat Migration - Agora RTM → Supabase

## ✅ Status: Backend Complete, Frontend Pending

Your live stream chat is being migrated from **Agora RTM** to **Supabase** for consistency and cost savings.

---

## 📊 What's Changed

### **BEFORE:**
- 1-on-1 Messages: ❌ Agora Chat
- Live Stream Chat: ❌ Agora RTM + Ably
- Video/Voice: ✅ Agora SDK

### **NOW:**
- 1-on-1 Messages: ✅ Supabase ✅ DONE
- Live Stream Chat: 🔄 Supabase (BACKEND DONE, FRONTEND PENDING)
- Video/Voice: ✅ Agora SDK

---

## ✅ Completed (Backend)

### **1. Database Schema** (`migrations/017_create_stream_chat.sql`)

Created 2 new tables:

#### **`stream_chat_messages`**
- Stores public chat messages during live streams
- Links to `stream_id` (channel name)
- Tracks user role (host, moderator, subscriber, viewer)
- Soft delete support
- Real-time enabled

#### **`stream_chat_moderation`**
- Tracks banned/muted users per stream
- Supports temporary timeouts (expires_at)
- Tracks who performed moderation action

**Functions Added:**
- `is_user_moderated()` - Check if user is banned/muted
- `cleanup_old_stream_chat()` - Delete old messages (7+ days)
- `get_stream_chat_messages()` - Get messages with user info

### **2. Backend API** (`routes/stream-chat.js`)

Replaced Agora RTM + Ably with Supabase:

**Endpoints:**
- `GET /api/v1/stream-chat/history/:streamId` - Get chat history
- `POST /api/v1/stream-chat/message` - Send message (checks bans/mutes)
- `DELETE /api/v1/stream-chat/message/:messageId` - Delete message
- `POST /api/v1/stream-chat/moderate` - Ban/mute/timeout user
- `POST /api/v1/stream-chat/pin` - Pin/unpin message

**Features:**
- ✅ Ban checking before sending messages
- ✅ Mute checking before sending messages
- ✅ User role tracking (host, moderator, viewer)
- ✅ Soft delete for moderation
- ✅ Compatible with old API format

---

## ⏳ Next Steps

### **Step 1: Run Migration** (5 minutes)

1. Go to https://supabase.com/dashboard/project/lpphsjowsivjtcmafxnj
2. Click **SQL Editor**
3. Copy contents of `backend/migrations/017_create_stream_chat.sql`
4. Paste and click **Run**
5. Verify tables created:
   - `stream_chat_messages`
   - `stream_chat_moderation`

### **Step 2: Update LiveChat Component** (Pending)

The `LiveChat.js` component currently uses **Agora RTM** (line 4):
```javascript
import AgoraRTM from 'agora-rtm-sdk';
```

**This needs to be replaced with Supabase Realtime.**

I can create a new `LiveChatSupabase.jsx` component that:
- Uses Supabase Realtime for chat messages
- Subscribes to `stream_chat_messages` table
- Sends messages via new API endpoints
- Supports all moderation features

### **Step 3: Update StreamingLayout** (Pending)

Replace the LiveChat import in `StreamingLayout.js`:

**OLD:**
```javascript
import LiveChat from './LiveChat';  // Uses Agora RTM
```

**NEW:**
```javascript
import LiveChatSupabase from './LiveChatSupabase';  // Uses Supabase
```

---

## 🎯 Why This Migration?

### **Cost Savings:**
- Agora RTM: $50-200/month for 10K users
- Supabase: Included in your existing plan
- **Savings: $50-200/month**

### **Consistency:**
- All chat (1-on-1 and live stream) uses same system
- Single database for all messages
- Unified moderation tools

### **Benefits:**
- ✅ Better moderation (stored in database)
- ✅ Chat history persists
- ✅ Easier to add features
- ✅ No separate Agora RTM SDK to maintain

---

## 📝 Current System Architecture

```
┌─────────────────────────────────────────────┐
│              DIGIS PLATFORM                 │
├─────────────────────────────────────────────┤
│                                             │
│  1-on-1 Messages        → Supabase ✅      │
│  Live Stream Chat       → Supabase 🔄      │
│  Video Calls            → Agora SDK ✅     │
│  Voice Calls            → Agora SDK ✅     │
│  Live Streaming (video) → Agora SDK ✅     │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🚀 Want Me to Finish?

I can complete the frontend migration by:

1. Creating `LiveChatSupabase.jsx` component
2. Adding Supabase Realtime subscriptions
3. Updating `StreamingLayout.js` to use new component
4. Testing end-to-end

**Just say "continue" and I'll finish the live stream chat migration!**

---

## 📊 Migration Status

- [x] Database schema (tables, functions, RLS)
- [x] Backend API (routes/stream-chat.js)
- [x] Real-time enabled
- [ ] Run migration in Supabase dashboard
- [ ] Create LiveChatSupabase component
- [ ] Update StreamingLayout
- [ ] Test live stream chat

---

## ⚠️ Important Notes

1. **Old messages won't be migrated** - This creates a fresh chat system. Old Agora RTM/Ably messages are separate.

2. **API is backward compatible** - The new API returns messages in the same format as before, so minimal changes needed.

3. **Moderation improvements** - Ban/mute data is now stored in database (was ephemeral before).

4. **Chat history** - Stream chat messages now persist (you can delete old ones with `cleanup_old_stream_chat()`).

---

## 🆘 Need Help?

Let me know if you:
- Want me to finish the frontend component
- Need help testing
- Have questions about the migration

Otherwise, you can run the migration now and I'll complete the frontend when you're ready!
