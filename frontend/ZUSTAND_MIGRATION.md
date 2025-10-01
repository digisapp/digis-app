# Zustand Migration Guide

This codebase has been migrated from React Context API to Zustand for state management.

## Store Structure

The main store is located at `/src/stores/useStore.js` and combines all previous contexts:
- AppContext functionality
- ThemeContext functionality  
- ContentContext functionality
- Additional token management from useAppStore

## Usage

### Direct Store Access

```javascript
import useStore from '../stores/useStore';

// Access state
const user = useStore((state) => state.user);
const theme = useStore((state) => state.theme);

// Access actions
const setUser = useStore((state) => state.setUser);
const toggleTheme = useStore((state) => state.toggleTheme);
```

### Using Hook Wrappers

For easier migration, hook wrappers are provided that maintain the same API as the previous Context hooks:

```javascript
// AppContext replacement
import { useApp } from '../hooks/useApp';
const { state, dispatch, addNotification } = useApp();

// ThemeContext replacement  
import { useTheme } from '../hooks/useTheme';
const { theme, toggleTheme, isDark } = useTheme();

// ContentContext replacement
import { useContent } from '../hooks/useContent';
const { creatorContent, addCreatorContent } = useContent();
```

## Key Features

1. **Persistence**: Theme settings and token balance are automatically persisted to localStorage
2. **DevTools**: Redux DevTools integration for debugging
3. **Immer Integration**: State mutations are handled immutably using Immer
4. **Auth Sync**: Automatic synchronization with Supabase auth state
5. **Theme Management**: Automatic application of theme settings to DOM

## Migration Notes

- All Context providers have been removed from the component tree
- The store initializes automatically when imported
- Theme settings are applied globally without needing a provider
- Auth state is synchronized automatically via Supabase subscriptions