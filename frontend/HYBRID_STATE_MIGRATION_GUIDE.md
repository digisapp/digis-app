# Hybrid State Management Migration Guide

## Overview
This guide helps you migrate from the old `useStore` to the new hybrid approach using `useHybridStore` with optimized Zustand for global state and React's `useState` for local UI state.

## Quick Start

### 1. Install/Update Dependencies
```bash
npm install zustand@latest
```

### 2. Import the New Store
```javascript
// Old way
import useStore from '../stores/useStore';

// New way - import only what you need
import { 
  useUser, 
  useTokenBalance,
  useAuthActions 
} from '../stores/useHybridStore';
```

## Migration Patterns

### Pattern 1: Authentication Components

**Before:**
```javascript
const Auth = () => {
  const setUser = useStore((state) => state.setUser);
  const setUserProfile = useStore((state) => state.setUserProfile);
  const user = useStore((state) => state.user);
  
  // Everything in global store
  const [email, setEmail] = useStore((state) => [state.email, state.setEmail]);
  const [password, setPassword] = useStore((state) => [state.password, state.setPassword]);
};
```

**After:**
```javascript
const Auth = () => {
  // Global state - user authentication
  const user = useUser();
  const { setUser, setProfile } = useAuthActions();
  
  // Local state - form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
};
```

### Pattern 2: Chat Components

**Before:**
```javascript
const StreamChat = () => {
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
};
```

**After:**
```javascript
const StreamChat = ({ streamId }) => {
  // Global state - shared across components
  const messages = useChannelMessages(streamId);
  const onlineCount = useOnlineUsersCount();
  const { addMessage, setTypingUser } = useChatActions();
  
  // Local state - UI only
  const [inputMessage, setInputMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
};
```

### Pattern 3: Notifications

**Before:**
```javascript
const NotificationBell = () => {
  const notifications = useStore((state) => state.notifications);
  const addNotification = useStore((state) => state.addNotification);
  const [showDropdown, setShowDropdown] = useState(false);
};
```

**After:**
```javascript
const NotificationBell = () => {
  // Global state - notifications are app-wide
  const notifications = useNotifications();
  const unreadCount = useUnreadNotifications();
  const { markNotificationRead } = useNotificationActions();
  
  // Local state - UI display
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState('all');
};
```

## Decision Tree: Zustand vs useState

Use **Zustand** (Global State) for:
- ✅ User authentication data
- ✅ Token balance
- ✅ Chat messages (shared across components)
- ✅ Online users list
- ✅ Notifications
- ✅ Stream status
- ✅ Active calls

Use **useState** (Local State) for:
- ✅ Form inputs (email, password, message input)
- ✅ Modal open/close states
- ✅ Dropdown/menu visibility
- ✅ Loading states for specific components
- ✅ Temporary UI selections
- ✅ Component-specific filters
- ✅ Animation states

## Performance Optimizations

### 1. Use Selective Subscriptions
```javascript
// ❌ Bad - subscribes to entire store
const store = useHybridStore();

// ✅ Good - subscribes only to needed data
const messages = useChannelMessages(channelId);
const onlineCount = useOnlineUsersCount();
```

### 2. Use Action Hooks
```javascript
// ❌ Bad - imports entire store
const store = useHybridStore();
store.addMessage(channelId, message);

// ✅ Good - imports only actions
const { addMessage } = useChatActions();
addMessage(channelId, message);
```

### 3. Memoize Expensive Computations
```javascript
const ExpensiveComponent = () => {
  const messages = useChannelMessages(channelId);
  
  // Memoize filtered messages
  const filteredMessages = useMemo(() => 
    messages.filter(m => m.type === 'tip'),
    [messages]
  );
};
```

## Common Pitfalls to Avoid

### 1. Don't Put Everything in Zustand
```javascript
// ❌ Bad - form state in global store
const useHybridStore = create((set) => ({
  loginEmail: '',
  loginPassword: '',
  setLoginEmail: (email) => set({ loginEmail: email }),
  setLoginPassword: (password) => set({ loginPassword: password })
}));

// ✅ Good - form state in component
const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
};
```

### 2. Don't Create New Objects in Selectors
```javascript
// ❌ Bad - creates new array every render
const useFilteredMessages = () => 
  useHybridStore(state => state.messages.filter(m => m.unread));

// ✅ Good - use separate selector or useMemo
const messages = useChannelMessages(channelId);
const unreadMessages = useMemo(() => 
  messages.filter(m => m.unread),
  [messages]
);
```

### 3. Don't Mix Patterns Inconsistently
```javascript
// ❌ Bad - mixing patterns in same component
const Component = () => {
  const user = useUser(); // Global
  const [user, setUser] = useState(); // Local - confusing!
};

// ✅ Good - clear separation
const Component = () => {
  const globalUser = useUser(); // Global auth state
  const [localUserInput, setLocalUserInput] = useState(''); // Local form state
};
```

## Testing

### Testing Components with Hybrid State

```javascript
import { renderHook, act } from '@testing-library/react-hooks';
import useHybridStore from '../stores/useHybridStore';

// Reset store before each test
beforeEach(() => {
  useHybridStore.getState().resetStore();
});

test('chat messages update correctly', () => {
  const { result } = renderHook(() => useHybridStore());
  
  act(() => {
    result.current.addMessage('channel1', {
      id: '1',
      text: 'Hello',
      sender: 'User1'
    });
  });
  
  expect(result.current.messages.channel1).toHaveLength(1);
});
```

## Migration Checklist

- [ ] Install latest Zustand version
- [ ] Create new `useHybridStore.js` with slices
- [ ] Identify global vs local state in each component
- [ ] Update imports to use specific selectors
- [ ] Move form inputs to useState
- [ ] Move UI toggles to useState
- [ ] Keep shared data in Zustand
- [ ] Test performance with React DevTools
- [ ] Update tests to use new store
- [ ] Remove old store file

## Performance Metrics

After migration, you should see:
- 20-30% reduction in unnecessary re-renders
- Faster form input responses
- Reduced memory usage for large chat histories
- Better React DevTools performance profiling

## Example Migration Timeline

1. **Phase 1** (Day 1-2): Create new store, migrate auth components
2. **Phase 2** (Day 3-4): Migrate chat and streaming components
3. **Phase 3** (Day 5): Migrate notification system
4. **Phase 4** (Day 6): Update remaining components
5. **Phase 5** (Day 7): Testing and optimization

## Support

For questions about the migration:
1. Check the examples in `/src/examples/HybridStateExample.js`
2. Review the store implementation in `/src/stores/useHybridStore.js`
3. Test individual components in isolation first